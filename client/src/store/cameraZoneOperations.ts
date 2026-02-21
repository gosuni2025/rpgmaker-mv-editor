import type { CameraZone } from '../types/rpgMakerMV';
import type { EditorState, CameraZoneHistoryEntry } from './types';

type SetFn = (partial: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) => void;
type GetFn = () => EditorState;

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

export function updateCameraZoneOp(get: GetFn, set: SetFn, id: number, updates: Partial<CameraZone>, skipUndo?: boolean) {
  const { currentMap, currentMapId, undoStack, selectedCameraZoneId, selectedCameraZoneIds } = get();
  if (!currentMap || !currentMapId || !currentMap.cameraZones) return;
  if (updates.width !== undefined) updates.width = Math.max(updates.width, MIN_CAMERA_ZONE_WIDTH);
  if (updates.height !== undefined) updates.height = Math.max(updates.height, MIN_CAMERA_ZONE_HEIGHT);
  const oldZones = currentMap.cameraZones;
  const zones = oldZones.map(z => z.id === id ? { ...z, ...updates } : z);
  if (skipUndo) {
    set({ currentMap: { ...currentMap, cameraZones: zones } });
    return;
  }
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

/** 카메라존 드래그 완료 시 수동으로 undo entry를 push */
export function commitCameraZoneDragUndoOp(get: GetFn, set: SetFn, snapshotZones: CameraZone[]) {
  const { currentMap, currentMapId, undoStack, selectedCameraZoneId, selectedCameraZoneIds } = get();
  if (!currentMap || !currentMapId || !currentMap.cameraZones) return;
  if (snapshotZones === currentMap.cameraZones) return;
  const historyEntry: CameraZoneHistoryEntry = {
    mapId: currentMapId, type: 'cameraZone',
    oldZones: snapshotZones, newZones: currentMap.cameraZones,
    oldSelectedCameraZoneId: selectedCameraZoneId,
    oldSelectedCameraZoneIds: selectedCameraZoneIds,
  };
  const newStack = [...undoStack, historyEntry];
  if (newStack.length > get().maxUndo) newStack.shift();
  set({ undoStack: newStack, redoStack: [] });
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
