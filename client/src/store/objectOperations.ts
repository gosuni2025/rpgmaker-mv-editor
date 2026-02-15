import type { MapObject, CameraZone } from '../types/rpgMakerMV';
import type { EditorState, CameraZoneHistoryEntry } from './types';
import { pushObjectUndoEntry, incrementName } from './editingHelpers';

type SetFn = (partial: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) => void;
type GetFn = () => EditorState;

// ============================================================
// Object operations
// ============================================================

export function addObjectFromTilesOp(get: GetFn, set: SetFn, paintedTiles: Set<string>) {
  const { currentMap, currentMapId } = get();
  if (!currentMap || !currentMapId || paintedTiles.size === 0) return;
  const oldObjects = currentMap.objects || [];

  // 바운딩 박스 계산
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const key of paintedTiles) {
    const [sx, sy] = key.split(',');
    const tx = parseInt(sx), ty = parseInt(sy);
    if (tx < minX) minX = tx;
    if (ty < minY) minY = ty;
    if (tx > maxX) maxX = tx;
    if (ty > maxY) maxY = ty;
  }

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const mapW = currentMap.width;
  const mapH = currentMap.height;
  const data = currentMap.data;

  // tileIds[row][col] 배열 생성 (row 0 = 상단)
  const tileIds: number[][] = [];
  for (let row = 0; row < h; row++) {
    const rowArr: number[] = [];
    for (let col = 0; col < w; col++) {
      const tx = minX + col;
      const ty = minY + row;
      if (paintedTiles.has(`${tx},${ty}`)) {
        // z=3(상층)부터 z=0(하층)까지 탐색하여 가장 위 비어있지 않은 타일 선택
        let tid = 0;
        for (let z = 3; z >= 0; z--) {
          const idx = (z * mapH + ty) * mapW + tx;
          if (data[idx] !== 0) {
            tid = data[idx];
            break;
          }
        }
        rowArr.push(tid);
      } else {
        rowArr.push(0);
      }
    }
    tileIds.push(rowArr);
  }

  // passability 배열 생성 (하단 행만 불통, 나머지 통행)
  const passability: boolean[][] = [];
  for (let row = 0; row < h; row++) {
    passability.push(Array(w).fill(row < h - 1));
  }

  const objects = [...oldObjects];
  const newId = objects.length > 0 ? Math.max(...objects.map(o => o.id)) + 1 : 1;
  // y = maxY (하단 기준점)
  const newObj: MapObject = {
    id: newId,
    name: `OBJ${newId}`,
    x: minX,
    y: maxY,
    tileIds,
    width: w,
    height: h,
    zHeight: 0,
    passability,
  };
  objects.push(newObj);
  set({ currentMap: { ...currentMap, objects }, selectedObjectId: newId, selectedObjectIds: [newId] });
  pushObjectUndoEntry(get, set, oldObjects, objects);
}

export function addObjectOp(get: GetFn, set: SetFn, x: number, y: number) {
  const { currentMap, currentMapId, selectedTiles, selectedTilesWidth, selectedTilesHeight, selectedTileId } = get();
  if (!currentMap || !currentMapId) return;
  const oldObjects = currentMap.objects || [];
  const objects = [...oldObjects];
  const newId = objects.length > 0 ? Math.max(...objects.map(o => o.id)) + 1 : 1;
  let tileIds: number[][];
  let w: number, h: number;
  if (selectedTiles && selectedTilesWidth > 0 && selectedTilesHeight > 0) {
    tileIds = selectedTiles.map(row => [...row]);
    w = selectedTilesWidth;
    h = selectedTilesHeight;
  } else {
    tileIds = [[selectedTileId]];
    w = 1;
    h = 1;
  }
  const passability: boolean[][] = [];
  for (let row = 0; row < h; row++) {
    passability.push(Array(w).fill(row < h - 1));
  }
  const newObj: MapObject = {
    id: newId,
    name: `OBJ${newId}`,
    x,
    y,
    tileIds,
    width: w,
    height: h,
    zHeight: 0,
    passability,
  };
  objects.push(newObj);
  set({ currentMap: { ...currentMap, objects }, selectedObjectId: newId, selectedObjectIds: [newId] });
  pushObjectUndoEntry(get, set, oldObjects, objects);
}

export function updateObjectOp(get: GetFn, set: SetFn, id: number, updates: Partial<MapObject>) {
  const { currentMap, currentMapId } = get();
  if (!currentMap || !currentMapId || !currentMap.objects) return;
  const oldObjects = currentMap.objects;
  const objects = oldObjects.map(o => o.id === id ? { ...o, ...updates } : o);
  set({ currentMap: { ...currentMap, objects } });
  pushObjectUndoEntry(get, set, oldObjects, objects);
}

export function deleteObjectOp(get: GetFn, set: SetFn, id: number) {
  const { currentMap, currentMapId, selectedObjectId } = get();
  if (!currentMap || !currentMapId || !currentMap.objects) return;
  const oldObjects = currentMap.objects;
  const objects = oldObjects.filter(o => o.id !== id);
  set({
    currentMap: { ...currentMap, objects },
    selectedObjectId: selectedObjectId === id ? null : selectedObjectId,
    selectedObjectIds: get().selectedObjectIds.filter(oid => oid !== id),
  });
  pushObjectUndoEntry(get, set, oldObjects, objects);
}

export function copyObjectsOp(get: GetFn, set: SetFn, objectIds: number[]) {
  const map = get().currentMap;
  if (!map || !map.objects || objectIds.length === 0) return;
  const objs = objectIds
    .map(id => map.objects?.find(o => o.id === id))
    .filter((o): o is NonNullable<typeof o> => !!o);
  if (objs.length === 0) return;
  set({ clipboard: { type: 'objects', objects: JSON.parse(JSON.stringify(objs)) } });
}

export function pasteObjectsOp(get: GetFn, set: SetFn, x: number, y: number) {
  const { clipboard, currentMap } = get();
  if (!currentMap || !clipboard || clipboard.type !== 'objects' || !clipboard.objects) return;
  const objs = clipboard.objects as MapObject[];
  if (objs.length === 0) return;
  const minX = Math.min(...objs.map(o => o.x));
  const minY = Math.min(...objs.map(o => o.y));
  const oldObjects = currentMap.objects || [];
  const objects = [...oldObjects];
  let maxId = objects.length > 0 ? Math.max(...objects.map(o => o.id)) : 0;
  const newIds: number[] = [];
  for (const obj of objs) {
    const newId = ++maxId;
    const nx = x + (obj.x - minX);
    const ny = y + (obj.y - minY);
    const newName = incrementName(obj.name, objects);
    const newObj: MapObject = { ...obj, id: newId, x: nx, y: ny, name: newName };
    objects.push(newObj);
    newIds.push(newId);
  }
  set({ currentMap: { ...currentMap, objects }, selectedObjectIds: newIds, selectedObjectId: newIds[0] ?? null });
  pushObjectUndoEntry(get, set, oldObjects, objects);
}

export function deleteObjectsOp(get: GetFn, set: SetFn, objectIds: number[]) {
  const { currentMap } = get();
  if (!currentMap || !currentMap.objects || objectIds.length === 0) return;
  const oldObjects = currentMap.objects;
  const idSet = new Set(objectIds);
  const objects = oldObjects.filter(o => !idSet.has(o.id));
  set({ currentMap: { ...currentMap, objects }, selectedObjectIds: [], selectedObjectId: null });
  pushObjectUndoEntry(get, set, oldObjects, objects);
}

export function moveObjectsOp(get: GetFn, set: SetFn, objectIds: number[], dx: number, dy: number) {
  const { currentMap } = get();
  if (!currentMap || !currentMap.objects || objectIds.length === 0) return;
  if (dx === 0 && dy === 0) return;
  const idSet = new Set(objectIds);
  const oldObjects = currentMap.objects;
  const objects = oldObjects.map(o => {
    if (idSet.has(o.id)) {
      return { ...o, x: o.x + dx, y: o.y + dy };
    }
    return o;
  });
  set({ currentMap: { ...currentMap, objects } });
  pushObjectUndoEntry(get, set, oldObjects, objects);
}

// ============================================================
// Camera zone operations
// ============================================================

// 카메라존 최소 크기 = 화면 타일 수 (816/48=17, 624/48=13)
const MIN_CAMERA_ZONE_WIDTH = Math.ceil(816 / 48);
const MIN_CAMERA_ZONE_HEIGHT = Math.ceil(624 / 48);

export function addCameraZoneOp(get: GetFn, set: SetFn, x: number, y: number, width: number, height: number) {
  const { currentMap, currentMapId, undoStack, selectedCameraZoneId, selectedCameraZoneIds } = get();
  if (!currentMap || !currentMapId) return;
  width = Math.max(width, MIN_CAMERA_ZONE_WIDTH);
  height = Math.max(height, MIN_CAMERA_ZONE_HEIGHT);
  const oldZones = currentMap.cameraZones || [];
  const zones = [...oldZones];
  const newId = zones.length > 0 ? Math.max(...zones.map(z => z.id)) + 1 : 1;
  const newZone: CameraZone = {
    id: newId,
    name: `Zone${newId}`,
    x, y, width, height,
    zoom: 1.0,
    tilt: 60,
    yaw: 0,
    fov: 60,
    transitionSpeed: 1.0,
    priority: 0,
    enabled: true,
    dofEnabled: false,
    dofFocusY: 0.55,
    dofFocusRange: 0.1,
    dofMaxBlur: 0.05,
    dofBlurPower: 1.5,
  };
  zones.push(newZone);
  const historyEntry: CameraZoneHistoryEntry = {
    mapId: currentMapId, type: 'cameraZone',
    oldZones: oldZones, newZones: zones,
    oldSelectedCameraZoneId: selectedCameraZoneId,
    oldSelectedCameraZoneIds: selectedCameraZoneIds,
  };
  const newStack = [...undoStack, historyEntry];
  if (newStack.length > get().maxUndo) newStack.shift();
  set({
    currentMap: { ...currentMap, cameraZones: zones },
    selectedCameraZoneId: newId,
    selectedCameraZoneIds: [newId],
    undoStack: newStack,
    redoStack: [],
  });
}

export function updateCameraZoneOp(get: GetFn, set: SetFn, id: number, updates: Partial<CameraZone>) {
  const { currentMap, currentMapId, undoStack, selectedCameraZoneId, selectedCameraZoneIds } = get();
  if (!currentMap || !currentMapId || !currentMap.cameraZones) return;
  if (updates.width !== undefined) updates.width = Math.max(updates.width, MIN_CAMERA_ZONE_WIDTH);
  if (updates.height !== undefined) updates.height = Math.max(updates.height, MIN_CAMERA_ZONE_HEIGHT);
  const oldZones = currentMap.cameraZones;
  const zones = oldZones.map(z => z.id === id ? { ...z, ...updates } : z);
  const historyEntry: CameraZoneHistoryEntry = {
    mapId: currentMapId, type: 'cameraZone',
    oldZones, newZones: zones,
    oldSelectedCameraZoneId: selectedCameraZoneId,
    oldSelectedCameraZoneIds: selectedCameraZoneIds,
  };
  const newStack = [...undoStack, historyEntry];
  if (newStack.length > get().maxUndo) newStack.shift();
  set({
    currentMap: { ...currentMap, cameraZones: zones },
    undoStack: newStack,
    redoStack: [],
  });
}

export function deleteCameraZoneOp(get: GetFn, set: SetFn, id: number) {
  const { currentMap, currentMapId, undoStack, selectedCameraZoneId, selectedCameraZoneIds } = get();
  if (!currentMap || !currentMapId || !currentMap.cameraZones) return;
  const oldZones = currentMap.cameraZones;
  const zones = oldZones.filter(z => z.id !== id);
  const historyEntry: CameraZoneHistoryEntry = {
    mapId: currentMapId, type: 'cameraZone',
    oldZones, newZones: zones,
    oldSelectedCameraZoneId: selectedCameraZoneId,
    oldSelectedCameraZoneIds: selectedCameraZoneIds,
  };
  const newStack = [...undoStack, historyEntry];
  if (newStack.length > get().maxUndo) newStack.shift();
  set({
    currentMap: { ...currentMap, cameraZones: zones },
    selectedCameraZoneId: selectedCameraZoneId === id ? null : selectedCameraZoneId,
    selectedCameraZoneIds: selectedCameraZoneIds.filter(i => i !== id),
    undoStack: newStack,
    redoStack: [],
  });
}

export function deleteCameraZonesOp(get: GetFn, set: SetFn, ids: number[]) {
  const { currentMap, currentMapId, undoStack, selectedCameraZoneId, selectedCameraZoneIds } = get();
  if (!currentMap || !currentMapId || !currentMap.cameraZones || ids.length === 0) return;
  const idSet = new Set(ids);
  const oldZones = currentMap.cameraZones;
  const zones = oldZones.filter(z => !idSet.has(z.id));
  const historyEntry: CameraZoneHistoryEntry = {
    mapId: currentMapId, type: 'cameraZone',
    oldZones, newZones: zones,
    oldSelectedCameraZoneId: selectedCameraZoneId,
    oldSelectedCameraZoneIds: selectedCameraZoneIds,
  };
  const newStack = [...undoStack, historyEntry];
  if (newStack.length > get().maxUndo) newStack.shift();
  set({
    currentMap: { ...currentMap, cameraZones: zones },
    selectedCameraZoneId: null,
    selectedCameraZoneIds: [],
    undoStack: newStack,
    redoStack: [],
  });
}

export function moveCameraZonesOp(get: GetFn, set: SetFn, ids: number[], dx: number, dy: number) {
  const { currentMap, currentMapId, undoStack, selectedCameraZoneId, selectedCameraZoneIds } = get();
  if (!currentMap || !currentMapId || !currentMap.cameraZones || ids.length === 0) return;
  if (dx === 0 && dy === 0) return;
  const idSet = new Set(ids);
  const oldZones = currentMap.cameraZones;
  const zones = oldZones.map(z => idSet.has(z.id) ? { ...z, x: z.x + dx, y: z.y + dy } : z);
  const historyEntry: CameraZoneHistoryEntry = {
    mapId: currentMapId, type: 'cameraZone',
    oldZones, newZones: zones,
    oldSelectedCameraZoneId: selectedCameraZoneId,
    oldSelectedCameraZoneIds: selectedCameraZoneIds,
  };
  const newStack = [...undoStack, historyEntry];
  if (newStack.length > get().maxUndo) newStack.shift();
  set({
    currentMap: { ...currentMap, cameraZones: zones },
    undoStack: newStack,
    redoStack: [],
  });
}
