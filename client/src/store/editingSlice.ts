import type { MapObject, CameraZone } from '../types/rpgMakerMV';
import type { EditorState, SliceCreator, TileChange, PassageChange } from './types';
import { EDIT_MODE_STORAGE_KEY, TOOLBAR_STORAGE_KEY } from './types';
import { undoOperation, redoOperation } from './undoRedoOperations';
import {
  updateMapTileOp, updateMapTilesOp, pushUndoOp,
  copyTilesOp, cutTilesOp, pasteTilesOp, deleteTilesOp, moveTilesOp,
} from './tileOperations';
import { resizeMapOp, shiftMapOp } from './mapResizeOperations';
import {
  copyPassageOp, cutPassageOp, pastePassageOp, deletePassageOp, movePassageOp, updateCustomPassageOp,
} from './passageOperations';
import {
  addEventOp, copyEventOp, cutEventOp, pasteEventOp, deleteEventOp,
  copyEventsOp, pasteEventsOp, deleteEventsOp, moveEventsOp,
} from './eventOperations';
import {
  addObjectOp, addObjectFromTilesOp, addObjectFromImageOp, addObjectFromAnimationOp, expandObjectTilesOp, shrinkObjectTilesOp, updateObjectOp, deleteObjectOp,
  copyObjectsOp, pasteObjectsOp, deleteObjectsOp, moveObjectsOp, commitDragUndoOp,
  addCameraZoneOp, updateCameraZoneOp, deleteCameraZoneOp, deleteCameraZonesOp, moveCameraZonesOp, commitCameraZoneDragUndoOp,
} from './objectOperations';

export const editingSlice: SliceCreator<Pick<EditorState,
  'editMode' | 'selectedTool' | 'drawShape' | 'selectedTileId' | 'selectedTiles' | 'selectedTilesWidth' | 'selectedTilesHeight' |
  'currentLayer' | 'clipboard' | 'cursorTileX' | 'cursorTileY' | 'selectionStart' | 'selectionEnd' | 'isPasting' | 'pastePreviewPos' |
  'selectedEventId' | 'selectedEventIds' | 'eventSelectionStart' | 'eventSelectionEnd' | 'isEventPasting' | 'eventPastePreviewPos' |
  'objectSubMode' | 'selectedObjectId' | 'selectedObjectIds' | 'objectSelectionStart' | 'objectSelectionEnd' | 'isObjectPasting' | 'objectPastePreviewPos' |
  'selectedCameraZoneId' | 'selectedCameraZoneIds' | 'undoStack' | 'redoStack' |
  'passageTool' | 'passageShape' | 'selectedPassageTile' | 'passageSelectionStart' | 'passageSelectionEnd' | 'isPassagePasting' | 'passagePastePreviewPos' |
  'setPassageTool' | 'setPassageShape' | 'setSelectedPassageTile' | 'updateCustomPassage' |
  'setPassageSelection' | 'clearPassageSelection' | 'setIsPassagePasting' | 'setPassagePastePreviewPos' |
  'copyPassage' | 'cutPassage' | 'pastePassage' | 'deletePassage' | 'movePassage' |
  'updateMapTile' | 'updateMapTiles' | 'pushUndo' | 'undo' | 'redo' | 'resizeMap' | 'shiftMap' |
  'copyTiles' | 'cutTiles' | 'pasteTiles' | 'deleteTiles' | 'moveTiles' |
  'addEvent' | 'copyEvent' | 'cutEvent' | 'pasteEvent' | 'deleteEvent' |
  'copyEvents' | 'pasteEvents' | 'deleteEvents' | 'moveEvents' |
  'setSelectedEventIds' | 'setEventSelectionStart' | 'setEventSelectionEnd' | 'setIsEventPasting' | 'setEventPastePreviewPos' | 'clearEventSelection' |
  'setObjectSubMode' | 'setSelectedObjectId' | 'setSelectedObjectIds' | 'setObjectSelectionStart' | 'setObjectSelectionEnd' | 'setIsObjectPasting' | 'setObjectPastePreviewPos' | 'clearObjectSelection' |
  'objectPaintTiles' | 'setObjectPaintTiles' |
  'addObject' | 'addObjectFromTiles' | 'addObjectFromImage' | 'addObjectFromAnimation' | 'expandObjectTiles' | 'shrinkObjectTiles' | 'updateObject' | 'deleteObject' | 'copyObjects' | 'pasteObjects' | 'deleteObjects' | 'moveObjects' | 'commitDragUndo' |
  'setSelectedCameraZoneId' | 'setSelectedCameraZoneIds' | 'addCameraZone' | 'updateCameraZone' | 'deleteCameraZone' | 'deleteCameraZones' | 'moveCameraZones' | 'commitCameraZoneDragUndo' |
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
  objectSubMode: 'select',
  selectedObjectId: null,
  selectedObjectIds: [],
  objectSelectionStart: null,
  objectSelectionEnd: null,
  isObjectPasting: false,
  objectPastePreviewPos: null,
  objectPaintTiles: null,
  selectedCameraZoneId: null,
  selectedCameraZoneIds: [],
  passageTool: 'pen',
  passageShape: 'freehand',
  selectedPassageTile: null,
  passageSelectionStart: null,
  passageSelectionEnd: null,
  isPassagePasting: false,
  passagePastePreviewPos: null,
  undoStack: [],
  redoStack: [],

  // Tile operations (delegated)
  updateMapTile: (x, y, z, tileId) => updateMapTileOp(get, set, x, y, z, tileId),
  updateMapTiles: (changes) => updateMapTilesOp(get, set, changes),
  pushUndo: (changes: TileChange[]) => pushUndoOp(get, set, changes),
  copyTiles: (x1, y1, x2, y2) => copyTilesOp(get, set, x1, y1, x2, y2),
  cutTiles: (x1, y1, x2, y2) => cutTilesOp(get, set, x1, y1, x2, y2),
  pasteTiles: (x, y) => pasteTilesOp(get, set, x, y),
  deleteTiles: (x1, y1, x2, y2) => deleteTilesOp(get, set, x1, y1, x2, y2),
  moveTiles: (srcX1, srcY1, srcX2, srcY2, destX, destY) => moveTilesOp(get, set, srcX1, srcY1, srcX2, srcY2, destX, destY),

  // Map resize/shift (delegated)
  resizeMap: (nw, nh, ox, oy) => resizeMapOp(get, set, nw, nh, ox, oy),
  shiftMap: (dx, dy) => shiftMapOp(get, set, dx, dy),

  // Undo/redo (delegated)
  undo: () => undoOperation(get, set),
  redo: () => redoOperation(get, set),

  // Event operations (delegated)
  addEvent: (x?: number, y?: number) => addEventOp(get, set, x, y),
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
  setObjectSubMode: (mode: 'select' | 'create') => {
    set({ objectSubMode: mode });
    const modeNames = { select: '선택', create: '생성' };
    get().showToast(`오브젝트: ${modeNames[mode]}`);
  },
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
  addObjectFromImage: (imageName: string, imageWidth: number, imageHeight: number) => addObjectFromImageOp(get, set, imageName, imageWidth, imageHeight),
  addObjectFromAnimation: (animationId: number, animationName: string) => addObjectFromAnimationOp(get, set, animationId, animationName),
  expandObjectTiles: (objectId: number, paintedTiles: Set<string>) => expandObjectTilesOp(get, set, objectId, paintedTiles),
  shrinkObjectTiles: (objectId: number, removeTiles: Set<string>) => shrinkObjectTilesOp(get, set, objectId, removeTiles),
  updateObject: (id: number, updates: Partial<MapObject>, skipUndo?: boolean) => updateObjectOp(get, set, id, updates, skipUndo),
  deleteObject: (id: number) => deleteObjectOp(get, set, id),
  copyObjects: (objectIds: number[]) => copyObjectsOp(get, set, objectIds),
  pasteObjects: (x: number, y: number) => pasteObjectsOp(get, set, x, y),
  deleteObjects: (objectIds: number[]) => deleteObjectsOp(get, set, objectIds),
  moveObjects: (objectIds: number[], dx: number, dy: number) => moveObjectsOp(get, set, objectIds, dx, dy),
  commitDragUndo: (snapshotObjects: MapObject[]) => commitDragUndoOp(get, set, snapshotObjects),

  // Camera zone operations (delegated)
  setSelectedCameraZoneId: (id: number | null) => set({ selectedCameraZoneId: id }),
  setSelectedCameraZoneIds: (ids: number[]) => set({ selectedCameraZoneIds: ids }),
  addCameraZone: (x: number, y: number, width: number, height: number) => addCameraZoneOp(get, set, x, y, width, height),
  updateCameraZone: (id: number, updates: Partial<CameraZone>, skipUndo?: boolean) => updateCameraZoneOp(get, set, id, updates, skipUndo),
  deleteCameraZone: (id: number) => deleteCameraZoneOp(get, set, id),
  deleteCameraZones: (ids: number[]) => deleteCameraZonesOp(get, set, ids),
  moveCameraZones: (ids: number[], dx: number, dy: number) => moveCameraZonesOp(get, set, ids, dx, dy),
  commitCameraZoneDragUndo: (snapshotZones: CameraZone[]) => commitCameraZoneDragUndoOp(get, set, snapshotZones),

  // Passage operations (delegated)
  setPassageTool: (tool: 'select' | 'pen' | 'eraser') => {
    const updates: Partial<EditorState> = { passageTool: tool };
    if (tool !== 'select') {
      updates.passageSelectionStart = null;
      updates.passageSelectionEnd = null;
      updates.isPassagePasting = false;
      updates.passagePastePreviewPos = null;
    }
    set(updates);
  },
  setPassageShape: (shape: 'freehand' | 'rectangle' | 'ellipse' | 'fill') => set({ passageShape: shape }),
  setSelectedPassageTile: (tile: { x: number; y: number } | null) => set({ selectedPassageTile: tile }),
  setPassageSelection: (start: { x: number; y: number } | null, end: { x: number; y: number } | null) => set({ passageSelectionStart: start, passageSelectionEnd: end }),
  clearPassageSelection: () => set({ passageSelectionStart: null, passageSelectionEnd: null }),
  setIsPassagePasting: (v: boolean) => set({ isPassagePasting: v }),
  setPassagePastePreviewPos: (pos: { x: number; y: number } | null) => set({ passagePastePreviewPos: pos }),
  copyPassage: (x1: number, y1: number, x2: number, y2: number) => copyPassageOp(get, set, x1, y1, x2, y2),
  cutPassage: (x1: number, y1: number, x2: number, y2: number) => cutPassageOp(get, set, x1, y1, x2, y2),
  pastePassage: (x: number, y: number) => pastePassageOp(get, set, x, y),
  deletePassage: (x1: number, y1: number, x2: number, y2: number) => deletePassageOp(get, set, x1, y1, x2, y2),
  movePassage: (srcX1: number, srcY1: number, srcX2: number, srcY2: number, destX: number, destY: number) => movePassageOp(get, set, srcX1, srcY1, srcX2, srcY2, destX, destY),
  updateCustomPassage: (changes: PassageChange[]) => updateCustomPassageOp(get, set, changes),

  // UI setters
  setEditMode: (mode: 'map' | 'event' | 'light' | 'object' | 'cameraZone' | 'passage') => {
    const state = get();
    const updates: Partial<EditorState> = { editMode: mode };
    localStorage.setItem(EDIT_MODE_STORAGE_KEY, mode);
    const modeNames: Record<string, string> = { map: '맵', event: '이벤트', light: '조명', object: '오브젝트', cameraZone: '카메라', passage: '통행' };
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
    if (mode !== 'passage') {
      updates.selectedPassageTile = null;
      updates.passageSelectionStart = null;
      updates.passageSelectionEnd = null;
      updates.isPassagePasting = false;
      updates.passagePastePreviewPos = null;
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
    try {
      const raw = localStorage.getItem(TOOLBAR_STORAGE_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(TOOLBAR_STORAGE_KEY, JSON.stringify({ ...prev, selectedTool: tool }));
    } catch {}
  },
  setDrawShape: (shape: string) => {
    const state = get();
    if (state.drawShape === shape) return;
    set({ drawShape: shape });
    const shapeNames: Record<string, string> = { freehand: '자유', rectangle: '직사각형', ellipse: '타원', fill: '채우기' };
    if (shapeNames[shape]) {
      state.showToast(shapeNames[shape]);
    }
    try {
      const raw = localStorage.getItem(TOOLBAR_STORAGE_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(TOOLBAR_STORAGE_KEY, JSON.stringify({ ...prev, drawShape: shape }));
    } catch {}
  },
  setSelectedTileId: (id: number) => set({ selectedTileId: id, selectedTiles: null, selectedTilesWidth: 1, selectedTilesHeight: 1 }),
  setSelectedTiles: (tiles: number[][] | null, width: number, height: number) => set({ selectedTiles: tiles, selectedTilesWidth: width, selectedTilesHeight: height }),
  setCurrentLayer: (layer: number) => {
    set({ currentLayer: layer });
    try {
      const raw = localStorage.getItem(TOOLBAR_STORAGE_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(TOOLBAR_STORAGE_KEY, JSON.stringify({ ...prev, currentLayer: layer }));
    } catch {}
  },
  setCursorTile: (x: number, y: number) => set({ cursorTileX: x, cursorTileY: y }),
  setSelection: (start, end) => set({ selectionStart: start, selectionEnd: end }),
  setIsPasting: (isPasting: boolean) => set({ isPasting }),
  setPastePreviewPos: (pos) => set({ pastePreviewPos: pos }),
  clearSelection: () => set({ selectionStart: null, selectionEnd: null, isPasting: false, pastePreviewPos: null }),
  setSelectedEventId: (id: number | null) => set({ selectedEventId: id }),
});
