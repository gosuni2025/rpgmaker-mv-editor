import type { EditorState, TileChange, TileHistoryEntry, ResizeHistoryEntry, ObjectHistoryEntry, LightHistoryEntry, CameraZoneHistoryEntry, EventHistoryEntry, PlayerStartHistoryEntry } from './types';
import apiClient from '../api/client';

type SetFn = (partial: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) => void;
type GetFn = () => EditorState;

export function undoOperation(get: GetFn, set: SetFn) {
  const { undoStack, currentMap, currentMapId, showToast } = get();
  if (undoStack.length === 0 || !currentMap || !currentMapId) return;
  const entry = undoStack[undoStack.length - 1];
  if (entry.mapId !== currentMapId) return;

  if (entry.type === 'resize') {
    const re = entry as ResizeHistoryEntry;
    const redoEntry: ResizeHistoryEntry = {
      mapId: currentMapId,
      type: 'resize',
      oldWidth: re.newWidth, oldHeight: re.newHeight, oldData: re.newData, oldEvents: re.newEvents,
      oldEditorLights: re.newEditorLights, oldObjects: re.newObjects, oldCameraZones: re.newCameraZones,
      oldStartX: re.newStartX, oldStartY: re.newStartY,
      newWidth: re.oldWidth, newHeight: re.oldHeight, newData: re.oldData, newEvents: re.oldEvents,
      newEditorLights: re.oldEditorLights, newObjects: re.oldObjects, newCameraZones: re.oldCameraZones,
      newStartX: re.oldStartX, newStartY: re.oldStartY,
    };
    const mapUpdates: Record<string, unknown> = {
      width: re.oldWidth, height: re.oldHeight, data: re.oldData, events: re.oldEvents,
    };
    if (re.oldEditorLights !== undefined) mapUpdates.editorLights = re.oldEditorLights;
    if (re.oldObjects !== undefined) mapUpdates.objects = re.oldObjects;
    if (re.oldCameraZones !== undefined) mapUpdates.cameraZones = re.oldCameraZones;
    const stateUpdates: Partial<EditorState> = {
      currentMap: { ...currentMap, ...mapUpdates } as any,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, redoEntry],
    };
    // Restore player start position
    const { systemData } = get();
    if (systemData && re.oldStartX !== undefined && re.oldStartY !== undefined && systemData.startMapId === currentMapId) {
      stateUpdates.systemData = { ...systemData, startX: re.oldStartX, startY: re.oldStartY };
    }
    set(stateUpdates);
    showToast(`실행 취소 (맵 크기 ${re.oldWidth}x${re.oldHeight})`);
    return;
  }

  if (entry.type === 'object') {
    const oe = entry as ObjectHistoryEntry;
    const redoEntry: ObjectHistoryEntry = {
      mapId: currentMapId, type: 'object',
      oldObjects: oe.newObjects, newObjects: oe.oldObjects,
      oldSelectedObjectId: get().selectedObjectId,
      oldSelectedObjectIds: get().selectedObjectIds,
    };
    set({
      currentMap: { ...currentMap, objects: oe.oldObjects },
      selectedObjectId: oe.oldSelectedObjectId,
      selectedObjectIds: oe.oldSelectedObjectIds ?? [],
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, redoEntry],
    });
    showToast('실행 취소 (오브젝트)');
    return;
  }

  if (entry.type === 'light') {
    const le = entry as LightHistoryEntry;
    const redoEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light',
      oldLights: le.newLights, newLights: le.oldLights,
      oldSelectedLightId: get().selectedLightId,
      oldSelectedLightIds: get().selectedLightIds,
    };
    set({
      currentMap: { ...currentMap, editorLights: le.oldLights },
      selectedLightId: le.oldSelectedLightId,
      selectedLightIds: le.oldSelectedLightIds ?? [],
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, redoEntry],
    });
    showToast('실행 취소 (조명)');
    return;
  }

  if (entry.type === 'cameraZone') {
    const cze = entry as CameraZoneHistoryEntry;
    const redoEntry: CameraZoneHistoryEntry = {
      mapId: currentMapId, type: 'cameraZone',
      oldZones: cze.newZones, newZones: cze.oldZones,
      oldSelectedCameraZoneId: get().selectedCameraZoneId,
    };
    set({
      currentMap: { ...currentMap, cameraZones: cze.oldZones },
      selectedCameraZoneId: cze.oldSelectedCameraZoneId,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, redoEntry],
    });
    showToast('실행 취소 (카메라 영역)');
    return;
  }

  if (entry.type === 'event') {
    const ee = entry as EventHistoryEntry;
    const redoEntry: EventHistoryEntry = {
      mapId: currentMapId, type: 'event',
      oldEvents: ee.newEvents, newEvents: ee.oldEvents,
      oldSelectedEventId: get().selectedEventId,
      oldSelectedEventIds: get().selectedEventIds,
    };
    set({
      currentMap: { ...currentMap, events: ee.oldEvents },
      selectedEventId: ee.oldSelectedEventId,
      selectedEventIds: ee.oldSelectedEventIds,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, redoEntry],
    });
    showToast('실행 취소 (이벤트)');
    return;
  }

  if (entry.type === 'playerStart') {
    const pe = entry as PlayerStartHistoryEntry;
    const redoEntry: PlayerStartHistoryEntry = {
      mapId: currentMapId, type: 'playerStart',
      oldMapId: pe.newMapId, oldX: pe.newX, oldY: pe.newY,
      newMapId: pe.oldMapId, newX: pe.oldX, newY: pe.oldY,
    };
    const { systemData } = get();
    if (systemData) {
      const updated = { ...systemData, startMapId: pe.oldMapId, startX: pe.oldX, startY: pe.oldY };
      set({
        systemData: updated,
        undoStack: undoStack.slice(0, -1),
        redoStack: [...get().redoStack, redoEntry],
      });
      apiClient.put('/database/system', updated).catch(() => {});
    }
    showToast('실행 취소 (시작 위치)');
    return;
  }

  const te = entry as TileHistoryEntry;
  const newData = [...currentMap.data];
  const redoChanges: TileChange[] = [];
  for (const c of te.changes) {
    const idx = (c.z * currentMap.height + c.y) * currentMap.width + c.x;
    redoChanges.push({ ...c, oldTileId: c.newTileId, newTileId: c.oldTileId });
    newData[idx] = c.oldTileId;
  }

  set({
    currentMap: { ...currentMap, data: newData },
    undoStack: undoStack.slice(0, -1),
    redoStack: [...get().redoStack, { mapId: currentMapId, changes: redoChanges } as TileHistoryEntry],
  });
  showToast(`실행 취소 (타일 ${te.changes.length}개 변경)`);
}

export function redoOperation(get: GetFn, set: SetFn) {
  const { redoStack, currentMap, currentMapId, showToast } = get();
  if (redoStack.length === 0 || !currentMap || !currentMapId) return;
  const entry = redoStack[redoStack.length - 1];
  if (entry.mapId !== currentMapId) return;

  if (entry.type === 'resize') {
    const re = entry as ResizeHistoryEntry;
    const undoEntry: ResizeHistoryEntry = {
      mapId: currentMapId,
      type: 'resize',
      oldWidth: re.newWidth, oldHeight: re.newHeight, oldData: re.newData, oldEvents: re.newEvents,
      oldEditorLights: re.newEditorLights, oldObjects: re.newObjects, oldCameraZones: re.newCameraZones,
      oldStartX: re.newStartX, oldStartY: re.newStartY,
      newWidth: re.oldWidth, newHeight: re.oldHeight, newData: re.oldData, newEvents: re.oldEvents,
      newEditorLights: re.oldEditorLights, newObjects: re.oldObjects, newCameraZones: re.oldCameraZones,
      newStartX: re.oldStartX, newStartY: re.oldStartY,
    };
    const mapUpdates: Record<string, unknown> = {
      width: re.oldWidth, height: re.oldHeight, data: re.oldData, events: re.oldEvents,
    };
    if (re.oldEditorLights !== undefined) mapUpdates.editorLights = re.oldEditorLights;
    if (re.oldObjects !== undefined) mapUpdates.objects = re.oldObjects;
    if (re.oldCameraZones !== undefined) mapUpdates.cameraZones = re.oldCameraZones;
    const stateUpdates: Partial<EditorState> = {
      currentMap: { ...currentMap, ...mapUpdates } as any,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, undoEntry],
    };
    // Restore player start position
    const { systemData } = get();
    if (systemData && re.oldStartX !== undefined && re.oldStartY !== undefined && systemData.startMapId === currentMapId) {
      stateUpdates.systemData = { ...systemData, startX: re.oldStartX, startY: re.oldStartY };
    }
    set(stateUpdates);
    showToast(`다시 실행 (맵 크기 ${re.oldWidth}x${re.oldHeight})`);
    return;
  }

  if (entry.type === 'object') {
    const oe = entry as ObjectHistoryEntry;
    const undoEntry: ObjectHistoryEntry = {
      mapId: currentMapId, type: 'object',
      oldObjects: oe.newObjects, newObjects: oe.oldObjects,
      oldSelectedObjectId: get().selectedObjectId,
      oldSelectedObjectIds: get().selectedObjectIds,
    };
    set({
      currentMap: { ...currentMap, objects: oe.oldObjects },
      selectedObjectId: oe.oldSelectedObjectId,
      selectedObjectIds: oe.oldSelectedObjectIds ?? [],
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, undoEntry],
    });
    showToast('다시 실행 (오브젝트)');
    return;
  }

  if (entry.type === 'light') {
    const le = entry as LightHistoryEntry;
    const undoEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light',
      oldLights: le.newLights, newLights: le.oldLights,
      oldSelectedLightId: get().selectedLightId,
      oldSelectedLightIds: get().selectedLightIds,
    };
    set({
      currentMap: { ...currentMap, editorLights: le.oldLights },
      selectedLightId: le.oldSelectedLightId,
      selectedLightIds: le.oldSelectedLightIds ?? [],
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, undoEntry],
    });
    showToast('다시 실행 (조명)');
    return;
  }

  if (entry.type === 'cameraZone') {
    const cze = entry as CameraZoneHistoryEntry;
    const undoEntry: CameraZoneHistoryEntry = {
      mapId: currentMapId, type: 'cameraZone',
      oldZones: cze.newZones, newZones: cze.oldZones,
      oldSelectedCameraZoneId: get().selectedCameraZoneId,
    };
    set({
      currentMap: { ...currentMap, cameraZones: cze.oldZones },
      selectedCameraZoneId: cze.oldSelectedCameraZoneId,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, undoEntry],
    });
    showToast('다시 실행 (카메라 영역)');
    return;
  }

  if (entry.type === 'event') {
    const ee = entry as EventHistoryEntry;
    const undoEntry: EventHistoryEntry = {
      mapId: currentMapId, type: 'event',
      oldEvents: ee.newEvents, newEvents: ee.oldEvents,
      oldSelectedEventId: get().selectedEventId,
      oldSelectedEventIds: get().selectedEventIds,
    };
    set({
      currentMap: { ...currentMap, events: ee.oldEvents },
      selectedEventId: ee.oldSelectedEventId,
      selectedEventIds: ee.oldSelectedEventIds,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, undoEntry],
    });
    showToast('다시 실행 (이벤트)');
    return;
  }

  if (entry.type === 'playerStart') {
    const pe = entry as PlayerStartHistoryEntry;
    const undoEntry: PlayerStartHistoryEntry = {
      mapId: currentMapId, type: 'playerStart',
      oldMapId: pe.newMapId, oldX: pe.newX, oldY: pe.newY,
      newMapId: pe.oldMapId, newX: pe.oldX, newY: pe.oldY,
    };
    const { systemData } = get();
    if (systemData) {
      const updated = { ...systemData, startMapId: pe.oldMapId, startX: pe.oldX, startY: pe.oldY };
      set({
        systemData: updated,
        redoStack: redoStack.slice(0, -1),
        undoStack: [...get().undoStack, undoEntry],
      });
      apiClient.put('/database/system', updated).catch(() => {});
    }
    showToast('다시 실행 (시작 위치)');
    return;
  }

  const te = entry as TileHistoryEntry;
  const newData = [...currentMap.data];
  const undoChanges: TileChange[] = [];
  for (const c of te.changes) {
    const idx = (c.z * currentMap.height + c.y) * currentMap.width + c.x;
    undoChanges.push({ ...c, oldTileId: c.newTileId, newTileId: c.oldTileId });
    newData[idx] = c.newTileId;
  }

  set({
    currentMap: { ...currentMap, data: newData },
    redoStack: redoStack.slice(0, -1),
    undoStack: [...get().undoStack, { mapId: currentMapId, changes: undoChanges } as TileHistoryEntry],
  });
  showToast(`다시 실행 (타일 ${te.changes.length}개 변경)`);
}
