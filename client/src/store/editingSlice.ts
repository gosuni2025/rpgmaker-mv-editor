import type { MapObject, CameraZone } from '../types/rpgMakerMV';
import { resizeMapData, resizeEvents } from '../utils/mapResize';
import apiClient from '../api/client';
import type { EditorState, SliceCreator, TileChange, TileHistoryEntry, ResizeHistoryEntry } from './types';
import { EDIT_MODE_STORAGE_KEY } from './types';
import { recalcAutotiles } from './editingHelpers';
import { undoOperation, redoOperation } from './undoRedoOperations';
import {
  copyEventOp, cutEventOp, pasteEventOp, deleteEventOp,
  copyEventsOp, pasteEventsOp, deleteEventsOp, moveEventsOp,
} from './eventOperations';
import {
  addObjectOp, addObjectFromTilesOp, expandObjectTilesOp, shrinkObjectTilesOp, updateObjectOp, deleteObjectOp,
  copyObjectsOp, pasteObjectsOp, deleteObjectsOp, moveObjectsOp,
  addCameraZoneOp, updateCameraZoneOp, deleteCameraZoneOp, deleteCameraZonesOp, moveCameraZonesOp,
} from './objectOperations';

export const editingSlice: SliceCreator<Pick<EditorState,
  'editMode' | 'selectedTool' | 'drawShape' | 'selectedTileId' | 'selectedTiles' | 'selectedTilesWidth' | 'selectedTilesHeight' |
  'currentLayer' | 'clipboard' | 'cursorTileX' | 'cursorTileY' | 'selectionStart' | 'selectionEnd' | 'isPasting' | 'pastePreviewPos' |
  'selectedEventId' | 'selectedEventIds' | 'eventSelectionStart' | 'eventSelectionEnd' | 'isEventPasting' | 'eventPastePreviewPos' |
  'selectedObjectId' | 'selectedObjectIds' | 'objectSelectionStart' | 'objectSelectionEnd' | 'isObjectPasting' | 'objectPastePreviewPos' |
  'selectedCameraZoneId' | 'selectedCameraZoneIds' | 'undoStack' | 'redoStack' |
  'updateMapTile' | 'updateMapTiles' | 'pushUndo' | 'undo' | 'redo' | 'resizeMap' | 'shiftMap' |
  'copyTiles' | 'cutTiles' | 'pasteTiles' | 'deleteTiles' | 'moveTiles' |
  'copyEvent' | 'cutEvent' | 'pasteEvent' | 'deleteEvent' |
  'copyEvents' | 'pasteEvents' | 'deleteEvents' | 'moveEvents' |
  'setSelectedEventIds' | 'setEventSelectionStart' | 'setEventSelectionEnd' | 'setIsEventPasting' | 'setEventPastePreviewPos' | 'clearEventSelection' |
  'setSelectedObjectId' | 'setSelectedObjectIds' | 'setObjectSelectionStart' | 'setObjectSelectionEnd' | 'setIsObjectPasting' | 'setObjectPastePreviewPos' | 'clearObjectSelection' |
  'objectPaintTiles' | 'setObjectPaintTiles' |
  'addObject' | 'addObjectFromTiles' | 'expandObjectTiles' | 'shrinkObjectTiles' | 'updateObject' | 'deleteObject' | 'copyObjects' | 'pasteObjects' | 'deleteObjects' | 'moveObjects' |
  'setSelectedCameraZoneId' | 'setSelectedCameraZoneIds' | 'addCameraZone' | 'updateCameraZone' | 'deleteCameraZone' | 'deleteCameraZones' | 'moveCameraZones' |
  'setEditMode' | 'setSelectedTool' | 'setDrawShape' | 'setSelectedTileId' | 'setSelectedTiles' |
  'setCurrentLayer' | 'setCursorTile' | 'setSelection' | 'setIsPasting' | 'setPastePreviewPos' | 'clearSelection' | 'setSelectedEventId'
>> = (set, get) => ({
  editMode: 'map',
  selectedTool: 'pen',
  drawShape: 'freehand',
  selectedTileId: 0,
  selectedTiles: null,
  selectedTilesWidth: 1,
  selectedTilesHeight: 1,
  currentLayer: 0,
  clipboard: null,
  cursorTileX: 0,
  cursorTileY: 0,
  selectionStart: null,
  selectionEnd: null,
  isPasting: false,
  pastePreviewPos: null,
  selectedEventId: null,
  selectedEventIds: [],
  eventSelectionStart: null,
  eventSelectionEnd: null,
  isEventPasting: false,
  eventPastePreviewPos: null,
  selectedObjectId: null,
  selectedObjectIds: [],
  objectSelectionStart: null,
  objectSelectionEnd: null,
  isObjectPasting: false,
  objectPastePreviewPos: null,
  objectPaintTiles: null,
  selectedCameraZoneId: null,
  selectedCameraZoneIds: [],
  undoStack: [],
  redoStack: [],

  // Map editing
  updateMapTile: (x: number, y: number, z: number, tileId: number) => {
    const map = get().currentMap;
    if (!map) return;
    const newData = [...map.data];
    newData[(z * map.height + y) * map.width + x] = tileId;
    set({ currentMap: { ...map, data: newData } });
  },

  updateMapTiles: (changes: { x: number; y: number; z: number; tileId: number }[]) => {
    const map = get().currentMap;
    if (!map) return;
    const newData = [...map.data];
    for (const c of changes) {
      newData[(c.z * map.height + c.y) * map.width + c.x] = c.tileId;
    }
    set({ currentMap: { ...map, data: newData } });
  },

  pushUndo: (changes: TileChange[]) => {
    const { currentMapId, undoStack } = get();
    if (!currentMapId || changes.length === 0) return;
    // 동일 좌표+레이어의 중복 변경을 병합: 첫 번째 oldTileId + 마지막 newTileId 유지
    const merged = new Map<string, TileChange>();
    for (const c of changes) {
      const key = `${c.x},${c.y},${c.z}`;
      const existing = merged.get(key);
      if (existing) {
        existing.newTileId = c.newTileId;
      } else {
        merged.set(key, { ...c });
      }
    }
    const mergedChanges = [...merged.values()].filter(c => c.oldTileId !== c.newTileId);
    if (mergedChanges.length === 0) return;
    const newStack = [...undoStack, { mapId: currentMapId, changes: mergedChanges } as TileHistoryEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({ undoStack: newStack, redoStack: [] });
  },

  undo: () => undoOperation(get, set),
  redo: () => redoOperation(get, set),

  resizeMap: (newWidth: number, newHeight: number, offsetX: number, offsetY: number) => {
    const { currentMap, currentMapId, undoStack, systemData, showToast } = get();
    if (!currentMap || !currentMapId) return;
    const { width: oldW, height: oldH, data: oldData, events: oldEvents } = currentMap;
    if (newWidth === oldW && newHeight === oldH && offsetX === 0 && offsetY === 0) return;
    const nw = Math.max(1, Math.min(256, newWidth));
    const nh = Math.max(1, Math.min(256, newHeight));
    const newData = resizeMapData(oldData, oldW, oldH, nw, nh, offsetX, offsetY);
    const newEvents = resizeEvents(oldEvents, nw, nh, offsetX, offsetY);

    // Save old state for undo
    const oldEditorLights = currentMap.editorLights;
    const oldObjects = currentMap.objects;
    const oldCameraZones = currentMap.cameraZones;
    const oldStartX = systemData?.startX;
    const oldStartY = systemData?.startY;

    // Offset lights, objects, camera zones, start position
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
    // Clamp player start position to new map bounds (offset + bounds check)
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
    // Persist systemData change to server
    if (stateUpdates.systemData) {
      apiClient.put('/database/system', stateUpdates.systemData).catch(() => {});
    }
    showToast(`맵 크기 변경 ${oldW}x${oldH} → ${nw}x${nh}`);
  },

  shiftMap: (dx: number, dy: number) => {
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
    // 이벤트도 시프트
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
  },

  // Clipboard - tiles
  copyTiles: (x1: number, y1: number, x2: number, y2: number) => {
    const map = get().currentMap;
    if (!map) return;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const tiles: { x: number; y: number; z: number; tileId: number }[] = [];
    for (let z = 0; z < 5; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const tileId = map.data[(z * map.height + y) * map.width + x];
          tiles.push({ x: x - minX, y: y - minY, z, tileId });
        }
      }
    }
    set({ clipboard: { type: 'tiles', tiles, width: maxX - minX + 1, height: maxY - minY + 1 } });
  },

  cutTiles: (x1: number, y1: number, x2: number, y2: number) => {
    get().copyTiles(x1, y1, x2, y2);
    get().deleteTiles(x1, y1, x2, y2);
  },

  pasteTiles: (x: number, y: number) => {
    const { clipboard, currentMap } = get();
    if (!clipboard || clipboard.type !== 'tiles' || !clipboard.tiles || !currentMap) return;
    const changes: TileChange[] = [];
    const newData = [...currentMap.data];
    const affected: { x: number; y: number; z: number }[] = [];
    for (const t of clipboard.tiles) {
      const tx = x + t.x, ty = y + t.y;
      if (tx < 0 || tx >= currentMap.width || ty < 0 || ty >= currentMap.height) continue;
      const idx = (t.z * currentMap.height + ty) * currentMap.width + tx;
      if (newData[idx] === t.tileId) continue;
      changes.push({ x: tx, y: ty, z: t.z, oldTileId: newData[idx], newTileId: t.tileId });
      newData[idx] = t.tileId;
      affected.push({ x: tx, y: ty, z: t.z });
    }
    recalcAutotiles(newData, currentMap.width, currentMap.height, affected, changes);
    set({ currentMap: { ...currentMap, data: newData } });
    get().pushUndo(changes);
  },

  deleteTiles: (x1: number, y1: number, x2: number, y2: number) => {
    const map = get().currentMap;
    if (!map) return;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const changes: TileChange[] = [];
    const newData = [...map.data];
    const affected: { x: number; y: number; z: number }[] = [];
    for (let z = 0; z < 5; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const idx = (z * map.height + y) * map.width + x;
          if (newData[idx] !== 0) {
            changes.push({ x, y, z, oldTileId: newData[idx], newTileId: 0 });
            newData[idx] = 0;
            affected.push({ x, y, z });
          }
        }
      }
    }
    recalcAutotiles(newData, map.width, map.height, affected, changes);
    set({ currentMap: { ...map, data: newData } });
    get().pushUndo(changes);
  },

  moveTiles: (srcX1: number, srcY1: number, srcX2: number, srcY2: number, destX: number, destY: number) => {
    const { clipboard, currentMap } = get();
    if (!currentMap || !clipboard || clipboard.type !== 'tiles' || !clipboard.tiles) return;
    const minX = Math.min(srcX1, srcX2), maxX = Math.max(srcX1, srcX2);
    const minY = Math.min(srcY1, srcY2), maxY = Math.max(srcY1, srcY2);
    const allChanges: TileChange[] = [];
    const newData = [...currentMap.data];

    // clipboard에서 원본 타일의 실제 데이터를 맵으로 구성
    const origTileMap = new Map<string, number>();
    for (const t of clipboard.tiles) {
      const ox = minX + t.x, oy = minY + t.y;
      origTileMap.set(`${ox},${oy},${t.z}`, t.tileId);
    }

    // 1. 원본 영역 삭제 (타일+그림자 레이어, 리전 제외)
    for (let z = 0; z < 5; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const origTileId = origTileMap.get(`${x},${y},${z}`) ?? 0;
          if (origTileId !== 0) {
            allChanges.push({ x, y, z, oldTileId: origTileId, newTileId: 0 });
          }
          const idx = (z * currentMap.height + y) * currentMap.width + x;
          newData[idx] = 0;
        }
      }
    }
    // 2. 새 위치에 붙여넣기 (모든 레이어)
    const affected: { x: number; y: number; z: number }[] = [];
    for (const t of clipboard.tiles) {
      const tx = destX + t.x, ty = destY + t.y;
      if (tx < 0 || tx >= currentMap.width || ty < 0 || ty >= currentMap.height) continue;
      const idx = (t.z * currentMap.height + ty) * currentMap.width + tx;
      allChanges.push({ x: tx, y: ty, z: t.z, oldTileId: newData[idx], newTileId: t.tileId });
      newData[idx] = t.tileId;
      affected.push({ x: tx, y: ty, z: t.z });
    }
    // 원본 영역도 affected에 추가 (주변 오토타일 재계산용)
    for (let z = 0; z < 5; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          affected.push({ x, y, z });
        }
      }
    }
    recalcAutotiles(newData, currentMap.width, currentMap.height, affected, allChanges);
    set({ currentMap: { ...currentMap, data: newData } });
    get().pushUndo(allChanges);
  },

  // Event operations (delegated)
  copyEvent: (eventId: number) => copyEventOp(get, set, eventId),
  cutEvent: (eventId: number) => cutEventOp(get, set, eventId),
  pasteEvent: (x: number, y: number) => pasteEventOp(get, set, x, y),
  deleteEvent: (eventId: number) => deleteEventOp(get, set, eventId),
  copyEvents: (eventIds: number[]) => copyEventsOp(get, set, eventIds),
  pasteEvents: (x: number, y: number) => pasteEventsOp(get, set, x, y),
  deleteEvents: (eventIds: number[]) => deleteEventsOp(get, set, eventIds),
  moveEvents: (eventIds: number[], dx: number, dy: number) => moveEventsOp(get, set, eventIds, dx, dy),

  setSelectedEventIds: (ids: number[]) => set({ selectedEventIds: ids }),
  setEventSelectionStart: (pos) => set({ eventSelectionStart: pos }),
  setEventSelectionEnd: (pos) => set({ eventSelectionEnd: pos }),
  setIsEventPasting: (isPasting: boolean) => set({ isEventPasting: isPasting }),
  setEventPastePreviewPos: (pos) => set({ eventPastePreviewPos: pos }),
  clearEventSelection: () => set({ eventSelectionStart: null, eventSelectionEnd: null, selectedEventIds: [], selectedEventId: null, isEventPasting: false, eventPastePreviewPos: null }),

  // Object operations (delegated)
  setSelectedObjectId: (id: number | null) => set({ selectedObjectId: id }),
  setSelectedObjectIds: (ids: number[]) => set({ selectedObjectIds: ids }),
  setObjectSelectionStart: (pos) => set({ objectSelectionStart: pos }),
  setObjectSelectionEnd: (pos) => set({ objectSelectionEnd: pos }),
  setIsObjectPasting: (isPasting: boolean) => set({ isObjectPasting: isPasting }),
  setObjectPastePreviewPos: (pos) => set({ objectPastePreviewPos: pos }),
  clearObjectSelection: () => set({ objectSelectionStart: null, objectSelectionEnd: null, selectedObjectIds: [], selectedObjectId: null, isObjectPasting: false, objectPastePreviewPos: null }),

  setObjectPaintTiles: (tiles: Set<string> | null) => set({ objectPaintTiles: tiles }),
  addObject: (x: number, y: number) => addObjectOp(get, set, x, y),
  addObjectFromTiles: (paintedTiles: Set<string>) => addObjectFromTilesOp(get, set, paintedTiles),
  expandObjectTiles: (objectId: number, paintedTiles: Set<string>) => expandObjectTilesOp(get, set, objectId, paintedTiles),
  shrinkObjectTiles: (objectId: number, removeTiles: Set<string>) => shrinkObjectTilesOp(get, set, objectId, removeTiles),
  updateObject: (id: number, updates: Partial<MapObject>) => updateObjectOp(get, set, id, updates),
  deleteObject: (id: number) => deleteObjectOp(get, set, id),
  copyObjects: (objectIds: number[]) => copyObjectsOp(get, set, objectIds),
  pasteObjects: (x: number, y: number) => pasteObjectsOp(get, set, x, y),
  deleteObjects: (objectIds: number[]) => deleteObjectsOp(get, set, objectIds),
  moveObjects: (objectIds: number[], dx: number, dy: number) => moveObjectsOp(get, set, objectIds, dx, dy),

  // Camera zone operations (delegated)
  setSelectedCameraZoneId: (id: number | null) => set({ selectedCameraZoneId: id }),
  setSelectedCameraZoneIds: (ids: number[]) => set({ selectedCameraZoneIds: ids }),
  addCameraZone: (x: number, y: number, width: number, height: number) => addCameraZoneOp(get, set, x, y, width, height),
  updateCameraZone: (id: number, updates: Partial<CameraZone>) => updateCameraZoneOp(get, set, id, updates),
  deleteCameraZone: (id: number) => deleteCameraZoneOp(get, set, id),
  deleteCameraZones: (ids: number[]) => deleteCameraZonesOp(get, set, ids),
  moveCameraZones: (ids: number[], dx: number, dy: number) => moveCameraZonesOp(get, set, ids, dx, dy),

  // UI setters
  setEditMode: (mode: 'map' | 'event' | 'light' | 'object' | 'cameraZone') => {
    const state = get();
    const updates: Partial<EditorState> = { editMode: mode };
    localStorage.setItem(EDIT_MODE_STORAGE_KEY, mode);
    const modeNames: Record<string, string> = { map: '맵', event: '이벤트', light: '조명', object: '오브젝트', cameraZone: '카메라' };
    if (state.editMode !== mode) {
      state.showToast(`${modeNames[mode]} 모드`);
    }
    if (mode !== 'map') {
      updates.selectionStart = null;
      updates.selectionEnd = null;
      updates.isPasting = false;
      updates.pastePreviewPos = null;
    }
    if (mode === 'light') {
      updates.lightEditMode = true;
      updates.shadowLight = true;
      if (typeof (window as any).ConfigManager !== 'undefined') {
        (window as any).ConfigManager.shadowLight = true;
      }
      setTimeout(() => get().initEditorLights(), 0);
    } else {
      if (state.editMode === 'light') {
        updates.lightEditMode = false;
        updates.selectedLightId = null;
        updates.selectedLightIds = [];
        updates.lightSelectionStart = null;
        updates.lightSelectionEnd = null;
        updates.isLightPasting = false;
        updates.lightPastePreviewPos = null;
      }
    }
    if (mode !== 'object') {
      updates.selectedObjectId = null;
      updates.selectedObjectIds = [];
      updates.objectSelectionStart = null;
      updates.objectSelectionEnd = null;
      updates.isObjectPasting = false;
      updates.objectPastePreviewPos = null;
    }
    if (mode !== 'event') {
      updates.selectedEventId = null;
      updates.selectedEventIds = [];
      updates.eventSelectionStart = null;
      updates.eventSelectionEnd = null;
      updates.isEventPasting = false;
      updates.eventPastePreviewPos = null;
    }
    if (mode !== 'cameraZone') {
      updates.selectedCameraZoneId = null;
      updates.selectedCameraZoneIds = [];
    }
    set(updates);
  },
  setSelectedTool: (tool: string) => {
    const state = get();
    if (state.selectedTool === tool) return;
    const updates: Partial<EditorState> = { selectedTool: tool };
    if (tool !== 'select') {
      updates.selectionStart = null;
      updates.selectionEnd = null;
      updates.isPasting = false;
      updates.pastePreviewPos = null;
    }
    const toolNames: Record<string, string> = { select: '선택', pen: '연필', eraser: '지우개', shadow: '그림자' };
    if (toolNames[tool]) {
      state.showToast(toolNames[tool]);
    }
    set(updates);
  },
  setDrawShape: (shape: string) => {
    const state = get();
    if (state.drawShape === shape) return;
    set({ drawShape: shape });
    const shapeNames: Record<string, string> = { freehand: '자유', rectangle: '직사각형', ellipse: '타원', fill: '채우기' };
    if (shapeNames[shape]) {
      state.showToast(shapeNames[shape]);
    }
  },
  setSelectedTileId: (id: number) => set({ selectedTileId: id, selectedTiles: null, selectedTilesWidth: 1, selectedTilesHeight: 1 }),
  setSelectedTiles: (tiles: number[][] | null, width: number, height: number) => set({ selectedTiles: tiles, selectedTilesWidth: width, selectedTilesHeight: height }),
  setCurrentLayer: (layer: number) => set({ currentLayer: layer }),
  setCursorTile: (x: number, y: number) => set({ cursorTileX: x, cursorTileY: y }),
  setSelection: (start, end) => set({ selectionStart: start, selectionEnd: end }),
  setIsPasting: (isPasting: boolean) => set({ isPasting }),
  setPastePreviewPos: (pos) => set({ pastePreviewPos: pos }),
  clearSelection: () => set({ selectionStart: null, selectionEnd: null, isPasting: false, pastePreviewPos: null }),
  setSelectedEventId: (id: number | null) => set({ selectedEventId: id }),
});
