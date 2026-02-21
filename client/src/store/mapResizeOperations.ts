import type { MapObject, CameraZone } from '../types/rpgMakerMV';
import { resizeMapData, resizeEvents } from '../utils/mapResize';
import apiClient from '../api/client';
import type { EditorState, ResizeHistoryEntry } from './types';

type SetFn = (partial: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) => void;
type GetFn = () => EditorState;

export function resizeMapOp(get: GetFn, set: SetFn, newWidth: number, newHeight: number, offsetX: number, offsetY: number) {
  const { currentMap, currentMapId, undoStack, systemData, showToast } = get();
  if (!currentMap || !currentMapId) return;
  const { width: oldW, height: oldH, data: oldData, events: oldEvents } = currentMap;
  if (newWidth === oldW && newHeight === oldH && offsetX === 0 && offsetY === 0) return;
  const nw = Math.max(1, Math.min(256, newWidth));
  const nh = Math.max(1, Math.min(256, newHeight));
  const newData = resizeMapData(oldData, oldW, oldH, nw, nh, offsetX, offsetY);
  const newEvents = resizeEvents(oldEvents, nw, nh, offsetX, offsetY);

  const oldEditorLights = currentMap.editorLights;
  const oldObjects = currentMap.objects;
  const oldCameraZones = currentMap.cameraZones;
  const oldStartX = systemData?.startX;
  const oldStartY = systemData?.startY;

  const updates: Record<string, unknown> = { width: nw, height: nh, data: newData, events: newEvents };
  const stateUpdates: Partial<EditorState> = {};
  if (offsetX !== 0 || offsetY !== 0) {
    if (currentMap.editorLights?.points) {
      updates.editorLights = {
        ...currentMap.editorLights,
        points: currentMap.editorLights.points.map(p => ({ ...p, x: p.x + offsetX, y: p.y + offsetY })),
      };
    }
    if (currentMap.objects) {
      updates.objects = currentMap.objects.map((o: MapObject) => ({ ...o, x: o.x + offsetX, y: o.y + offsetY }));
    }
    if (currentMap.cameraZones) {
      updates.cameraZones = currentMap.cameraZones.map((z: CameraZone) => ({ ...z, x: z.x + offsetX, y: z.y + offsetY }));
    }
  }
  if (systemData && systemData.startMapId === currentMapId) {
    const newSX = Math.max(0, Math.min(nw - 1, systemData.startX + offsetX));
    const newSY = Math.max(0, Math.min(nh - 1, systemData.startY + offsetY));
    if (newSX !== systemData.startX || newSY !== systemData.startY) {
      stateUpdates.systemData = { ...systemData, startX: newSX, startY: newSY };
    }
  }

  const historyEntry: ResizeHistoryEntry = {
    mapId: currentMapId,
    type: 'resize',
    oldWidth: oldW, oldHeight: oldH, oldData, oldEvents,
    oldEditorLights, oldObjects, oldCameraZones,
    oldStartX, oldStartY,
    newWidth: nw, newHeight: nh, newData, newEvents,
    newEditorLights: (updates.editorLights ?? currentMap.editorLights) as any,
    newObjects: (updates.objects ?? currentMap.objects) as any,
    newCameraZones: (updates.cameraZones ?? currentMap.cameraZones) as any,
    newStartX: stateUpdates.systemData?.startX ?? systemData?.startX,
    newStartY: stateUpdates.systemData?.startY ?? systemData?.startY,
  };
  const newStack = [...undoStack, historyEntry];
  if (newStack.length > get().maxUndo) newStack.shift();
  set({
    currentMap: { ...currentMap, ...updates },
    undoStack: newStack,
    redoStack: [],
    ...stateUpdates,
  });
  if (stateUpdates.systemData) {
    apiClient.put('/database/system', stateUpdates.systemData).catch(() => {});
  }
  showToast(`맵 크기 변경 ${oldW}x${oldH} → ${nw}x${nh}`);
}

export function shiftMapOp(get: GetFn, set: SetFn, dx: number, dy: number) {
  const { currentMap, currentMapId, undoStack, showToast } = get();
  if (!currentMap || !currentMapId) return;
  if (dx === 0 && dy === 0) return;
  const { width: w, height: h, data: oldData } = currentMap;
  const newData = new Array(oldData.length).fill(0);
  for (let z = 0; z < 6; z++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcX = x - dx;
        const srcY = y - dy;
        if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
          newData[(z * h + y) * w + x] = oldData[(z * h + srcY) * w + srcX];
        }
      }
    }
  }
  const oldEvents = currentMap.events;
  const newEvents = oldEvents ? oldEvents.map(ev => {
    if (!ev || ev.id === 0) return ev;
    const nx = ev.x + dx;
    const ny = ev.y + dy;
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) return null;
    return { ...ev, x: nx, y: ny };
  }) : oldEvents;

  const historyEntry: ResizeHistoryEntry = {
    mapId: currentMapId,
    type: 'resize',
    oldWidth: w, oldHeight: h, oldData, oldEvents,
    oldEditorLights: currentMap.editorLights, oldObjects: currentMap.objects, oldCameraZones: currentMap.cameraZones,
    oldStartX: undefined, oldStartY: undefined,
    newWidth: w, newHeight: h, newData, newEvents,
    newEditorLights: currentMap.editorLights, newObjects: currentMap.objects, newCameraZones: currentMap.cameraZones,
    newStartX: undefined, newStartY: undefined,
  };
  const newStack = [...undoStack, historyEntry];
  if (newStack.length > get().maxUndo) newStack.shift();
  set({
    currentMap: { ...currentMap, data: newData, events: newEvents },
    undoStack: newStack,
    redoStack: [],
  });
  showToast(`맵 시프트 (${dx}, ${dy})`);
}
