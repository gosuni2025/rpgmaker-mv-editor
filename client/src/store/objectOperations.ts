import type { MapObject } from '../types/rpgMakerMV';
import type { EditorState } from './types';
import { pushObjectUndoEntry, incrementName } from './editingHelpers';

export { addObjectFromTilesOp, expandObjectTilesOp, shrinkObjectTilesOp } from './objectTileOperations';

type SetFn = (partial: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) => void;
type GetFn = () => EditorState;

export function addObjectFromAnimationOp(get: GetFn, set: SetFn, animationId: number, animationName: string) {
  const { currentMap, currentMapId } = get();
  if (!currentMap || !currentMapId) return;
  const oldObjects = currentMap.objects || [];
  const objects = [...oldObjects];
  const newId = objects.length > 0 ? Math.max(...objects.map(o => o.id)) + 1 : 1;

  // 애니메이션 셀 크기 192px → 4x4 타일 (192/48=4)
  const w = 4, h = 4;
  const tileIds: number[][][] = [];
  for (let row = 0; row < h; row++) {
    const rowArr: number[][] = [];
    for (let col = 0; col < w; col++) {
      rowArr.push([0, 0, 0, 0]);
    }
    tileIds.push(rowArr);
  }
  const passability: boolean[][] = [];
  for (let row = 0; row < h; row++) {
    passability.push(Array(w).fill(true)); // 전부 통행 가능
  }

  const cx = Math.floor(currentMap.width / 2);
  const cy = Math.floor(currentMap.height / 2);

  const newObj: MapObject = {
    id: newId,
    name: animationName,
    x: cx,
    y: cy + h - 1,
    tileIds,
    width: w,
    height: h,
    zHeight: 0,
    passability,
    animationId,
    animationLoop: 'forward',
    animationSe: false,
  };
  objects.push(newObj);
  set({ currentMap: { ...currentMap, objects }, selectedObjectId: newId, selectedObjectIds: [newId] });
  pushObjectUndoEntry(get, set, oldObjects, objects);
}

export function addObjectFromImageOp(get: GetFn, set: SetFn, imageName: string, imageWidth: number, imageHeight: number) {
  const { currentMap, currentMapId } = get();
  if (!currentMap || !currentMapId) return;
  const oldObjects = currentMap.objects || [];
  const objects = [...oldObjects];
  const newId = objects.length > 0 ? Math.max(...objects.map(o => o.id)) + 1 : 1;

  const tileSize = 48;
  const w = Math.max(1, Math.ceil(imageWidth / tileSize));
  const h = Math.max(1, Math.ceil(imageHeight / tileSize));

  // tileIds: 모두 빈 타일 (이미지로 렌더링)
  const tileIds: number[][][] = [];
  for (let row = 0; row < h; row++) {
    const rowArr: number[][] = [];
    for (let col = 0; col < w; col++) {
      rowArr.push([0, 0, 0, 0]);
    }
    tileIds.push(rowArr);
  }

  const passability: boolean[][] = [];
  for (let row = 0; row < h; row++) {
    passability.push(Array(w).fill(row < h - 1));
  }

  // 맵 중앙 근처에 배치
  const cx = Math.floor(currentMap.width / 2);
  const cy = Math.floor(currentMap.height / 2);

  const newObj: MapObject = {
    id: newId,
    name: imageName,
    x: cx,
    y: cy + h - 1,
    tileIds,
    width: w,
    height: h,
    zHeight: 0,
    passability,
    imageName,
    anchorY: 1.0,
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
  let tileIds: number[][][];
  let w: number, h: number;
  if (selectedTiles && selectedTilesWidth > 0 && selectedTilesHeight > 0) {
    tileIds = selectedTiles.map(row => row.map(t => [t, 0, 0, 0]));
    w = selectedTilesWidth;
    h = selectedTilesHeight;
  } else {
    tileIds = [[[selectedTileId, 0, 0, 0]]];
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

export function updateObjectOp(get: GetFn, set: SetFn, id: number, updates: Partial<MapObject>, skipUndo?: boolean) {
  const { currentMap, currentMapId } = get();
  if (!currentMap || !currentMapId || !currentMap.objects) return;
  const oldObjects = currentMap.objects;
  const objects = oldObjects.map(o => o.id === id ? { ...o, ...updates } : o);
  set({ currentMap: { ...currentMap, objects } });
  if (!skipUndo) pushObjectUndoEntry(get, set, oldObjects, objects);
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

  // 붙여넣기할 위치 계산
  const newPositions = objs.map(o => ({ x: x + (o.x - minX), y: y + (o.y - minY) }));

  // 맵 경계 체크
  if (newPositions.some(p => p.x < 0 || p.x >= currentMap.width || p.y < 0 || p.y >= currentMap.height)) return;

  // 기존 오브젝트와 겹침 체크
  const existingPositions = new Set(
    (currentMap.objects || []).map(o => `${o.x},${o.y}`)
  );
  // 붙여넣기 대상끼리 겹침 체크
  const pastePositions = new Set<string>();
  for (const p of newPositions) {
    const key = `${p.x},${p.y}`;
    if (existingPositions.has(key) || pastePositions.has(key)) return;
    pastePositions.add(key);
  }

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

  // 이동할 오브젝트들의 새 위치 계산
  const movingObjects = currentMap.objects.filter(o => idSet.has(o.id));
  const newPositions = movingObjects.map(o => ({ x: o.x + dx, y: o.y + dy }));

  // 맵 경계 체크
  if (newPositions.some(p => p.x < 0 || p.x >= currentMap.width || p.y < 0 || p.y >= currentMap.height)) return;

  // 이동하지 않는 오브젝트와 겹침 체크
  const staticPositions = new Set(
    currentMap.objects.filter(o => !idSet.has(o.id)).map(o => `${o.x},${o.y}`)
  );
  // 이동 대상끼리 겹침 체크
  const movedPositions = new Set<string>();
  for (const p of newPositions) {
    const key = `${p.x},${p.y}`;
    if (staticPositions.has(key) || movedPositions.has(key)) return;
    movedPositions.add(key);
  }

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

/** 드래그 완료 시 수동으로 undo entry를 push (DragLabel skipUndo 패턴용) */
export function commitDragUndoOp(get: GetFn, set: SetFn, snapshotObjects: MapObject[]) {
  const { currentMap } = get();
  if (!currentMap || !currentMap.objects) return;
  if (snapshotObjects === currentMap.objects) return; // 변경 없음
  pushObjectUndoEntry(get, set, snapshotObjects, currentMap.objects);
}

export { addCameraZoneOp, updateCameraZoneOp, deleteCameraZoneOp, deleteCameraZonesOp, moveCameraZonesOp, commitCameraZoneDragUndoOp } from './cameraZoneOperations';
