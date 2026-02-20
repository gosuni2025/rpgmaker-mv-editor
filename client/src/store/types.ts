import type { MapInfo, MapData, TilesetData, SystemData, EditorPointLight, EditorAmbientLight, EditorDirectionalLight, EditorPlayerLight, EditorSpotLight, EditorShadowSettings, EditorLights, MapObject, RPGEvent, CameraZone } from '../types/rpgMakerMV';

export const PROJECT_STORAGE_KEY = 'rpg-editor-current-project';
export const MAP_STORAGE_KEY = 'rpg-editor-current-map';
export const EDIT_MODE_STORAGE_KEY = 'rpg-editor-edit-mode';
export const TOOLBAR_STORAGE_KEY = 'rpg-editor-toolbar';
export const SCROLL_POSITIONS_STORAGE_KEY = 'rpg-editor-scroll-positions';
export const ZOOM_LEVELS = [0.25, 0.5, 1, 2, 4];
export const DEFAULT_MAX_UNDO = 100;
export const DEFAULT_ZOOM_STEP = 10; // percent
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

export interface RendererInitError {
  title: string;
  details: string;
  browserInfo: string;
  webglSupport: string;
  originalError?: string;
}

export interface TileChange {
  x: number;
  y: number;
  z: number;
  oldTileId: number;
  newTileId: number;
}

export interface TileHistoryEntry {
  mapId: number;
  type?: 'tile';
  changes: TileChange[];
}

export interface ResizeHistoryEntry {
  mapId: number;
  type: 'resize';
  oldWidth: number;
  oldHeight: number;
  oldData: number[];
  oldEvents: (RPGEvent | null)[];
  oldEditorLights?: EditorLights;
  oldObjects?: MapObject[];
  oldCameraZones?: CameraZone[];
  oldStartX?: number;
  oldStartY?: number;
  newWidth: number;
  newHeight: number;
  newData: number[];
  newEvents: (RPGEvent | null)[];
  newEditorLights?: EditorLights;
  newObjects?: MapObject[];
  newCameraZones?: CameraZone[];
  newStartX?: number;
  newStartY?: number;
}

export interface ObjectHistoryEntry {
  mapId: number;
  type: 'object';
  oldObjects: MapObject[];
  newObjects: MapObject[];
  oldSelectedObjectId: number | null;
  oldSelectedObjectIds: number[];
}

export interface LightHistoryEntry {
  mapId: number;
  type: 'light';
  oldLights: EditorLights;
  newLights: EditorLights;
  oldSelectedLightId: number | null;
  oldSelectedLightIds: number[];
}

export interface CameraZoneHistoryEntry {
  mapId: number;
  type: 'cameraZone';
  oldZones: CameraZone[];
  newZones: CameraZone[];
  oldSelectedCameraZoneId: number | null;
  oldSelectedCameraZoneIds: number[];
}

export interface EventHistoryEntry {
  mapId: number;
  type: 'event';
  oldEvents: (RPGEvent | null)[];
  newEvents: (RPGEvent | null)[];
  oldSelectedEventId: number | null;
  oldSelectedEventIds: number[];
}

export interface PlayerStartHistoryEntry {
  mapId: number;
  type: 'playerStart';
  oldMapId: number;
  oldX: number;
  oldY: number;
  newMapId: number;
  newX: number;
  newY: number;
}

export interface PassageChange {
  x: number;
  y: number;
  oldValue: number;
  newValue: number;
}

export interface PassageHistoryEntry {
  mapId: number;
  type: 'passage';
  changes: PassageChange[];
}

export interface MapDeleteHistoryEntry {
  mapId: number;
  type: 'mapDelete';
  mapInfo: any;
  mapData: any;
  extData: any;
}

export interface MapRenameHistoryEntry {
  mapId: number;
  type: 'mapRename';
  oldName: string;
  newName: string;
}

export type HistoryEntry = TileHistoryEntry | ResizeHistoryEntry | ObjectHistoryEntry | LightHistoryEntry | CameraZoneHistoryEntry | EventHistoryEntry | PlayerStartHistoryEntry | PassageHistoryEntry | MapDeleteHistoryEntry | MapRenameHistoryEntry;

export interface ClipboardData {
  type: 'tiles' | 'event' | 'events' | 'lights' | 'objects' | 'passage';
  tiles?: { x: number; y: number; z: number; tileId: number }[];
  width?: number;
  height?: number;
  event?: unknown;
  events?: unknown[];
  lights?: unknown[];
  objects?: unknown[];
  passage?: { x: number; y: number; value: number }[];
}

export interface EditorState {
  // Project
  projectPath: string | null;
  projectName: string | null;

  // Maps
  maps: (MapInfo | null)[];
  currentMapId: number | null;
  currentMap: (MapData & { tilesetNames?: string[] }) | null;

  // Tileset
  tilesetInfo: TilesetData | null;

  // System
  systemData: SystemData | null;
  playerCharacterName: string | null;
  playerCharacterIndex: number;

  // Mode
  editMode: 'map' | 'event' | 'light' | 'object' | 'cameraZone' | 'passage';

  // Drawing tools
  selectedTool: string;  // 'select' | 'pen' | 'eraser' | 'shadow'
  drawShape: string;     // 'freehand' | 'rectangle' | 'ellipse' | 'fill'
  selectedTileId: number;
  selectedTiles: number[][] | null;
  selectedTilesWidth: number;
  selectedTilesHeight: number;
  currentLayer: number;

  // Zoom
  zoomLevel: number;

  // Undo/Redo
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  // Clipboard
  clipboard: ClipboardData | null;

  // Mouse position
  cursorTileX: number;
  cursorTileY: number;

  // Selection
  selectionStart: { x: number; y: number } | null;
  selectionEnd: { x: number; y: number } | null;
  isPasting: boolean;
  pastePreviewPos: { x: number; y: number } | null;

  // Event editor
  selectedEventId: number | null;
  selectedEventIds: number[];
  eventSelectionStart: { x: number; y: number } | null;
  eventSelectionEnd: { x: number; y: number } | null;
  isEventPasting: boolean;
  eventPastePreviewPos: { x: number; y: number } | null;

  // Object editor
  objectSubMode: 'select' | 'create';
  selectedObjectId: number | null;
  selectedObjectIds: number[];
  objectSelectionStart: { x: number; y: number } | null;
  objectSelectionEnd: { x: number; y: number } | null;
  isObjectPasting: boolean;
  objectPastePreviewPos: { x: number; y: number } | null;

  // Camera zone editor
  selectedCameraZoneId: number | null;
  selectedCameraZoneIds: number[];

  // Passage editor
  passageTool: 'select' | 'pen' | 'eraser';
  passageShape: 'freehand' | 'rectangle' | 'ellipse' | 'fill';
  selectedPassageTile: { x: number; y: number } | null;
  passageSelectionStart: { x: number; y: number } | null;
  passageSelectionEnd: { x: number; y: number } | null;
  isPassagePasting: boolean;
  passagePastePreviewPos: { x: number; y: number } | null;

  // Display toggles
  showGrid: boolean;
  showPassability: boolean;
  showTileInfo: boolean;
  showRegion: boolean;

  // 3D / Lighting
  mode3d: boolean;
  shadowLight: boolean;
  disableFow: boolean;
  // Post-processing config (맵 데이터에 저장됨)
  postProcessConfig: Record<string, { enabled: boolean; [key: string]: any }>;
  setPostProcessConfig: (config: Record<string, { enabled: boolean; [key: string]: any }>) => void;
  updatePostProcessEffect: (effectKey: string, params: { enabled?: boolean; [key: string]: any }) => void;

  // Palette tab
  paletteTab: 'A' | 'B' | 'C' | 'D' | 'E' | 'R';

  // Light editor
  lightEditMode: boolean;
  selectedLightId: number | null;
  selectedLightIds: number[];
  lightSelectionStart: { x: number; y: number } | null;
  lightSelectionEnd: { x: number; y: number } | null;
  isLightPasting: boolean;
  lightPastePreviewPos: { x: number; y: number } | null;
  selectedLightType: 'point' | 'ambient' | 'directional' | 'playerLight' | 'spotLight';

  // Parse errors
  parseErrors: { file: string; error: string }[] | null;

  // Renderer init error
  rendererInitError: RendererInitError | null;

  // 미실행 프로젝트 팝업
  uninitializedProjectPath: string | null;
  setUninitializedProjectPath: (path: string | null) => void;

  // Toast
  toastQueue: { id: number; message: string; persistent: boolean }[];
  showToast: (message: string, persistent?: boolean) => void;
  dismissToast: (id: number) => void;

  // Options
  transparentColor: { r: number; g: number; b: number };
  maxUndo: number;
  zoomStep: number; // percent (e.g. 10 = 10%)

  // UI dialogs
  showOpenProjectDialog: boolean;
  showNewProjectDialog: boolean;
  showDatabaseDialog: boolean;
  showDeployDialog: boolean;
  showFindDialog: boolean;
  showPluginManagerDialog: boolean;
  showSoundTestDialog: boolean;
  showEventSearchDialog: boolean;
  showResourceManagerDialog: boolean;
  showCharacterGeneratorDialog: boolean;
  showOptionsDialog: boolean;
  showLocalizationDialog: boolean;
  showUpdateCheckDialog: boolean;


  // Actions - Project
  openProject: (path: string) => Promise<void>;
  closeProject: () => void;
  restoreLastProject: () => Promise<void>;
  loadMaps: () => Promise<void>;
  selectMap: (mapId: number) => Promise<void>;
  saveCurrentMap: () => Promise<void>;

  // Actions - Map CRUD
  createMap: (opts: { name?: string; width?: number; height?: number; tilesetId?: number; parentId?: number }) => Promise<number | null>;
  deleteMap: (mapId: number) => Promise<void>;
  updateMapInfos: (mapInfos: (MapInfo | null)[]) => Promise<void>;
  renameMap: (mapId: number, newName: string) => Promise<void>;

  // Actions - Map editing
  updateMapTile: (x: number, y: number, z: number, tileId: number) => void;
  updateMapTiles: (changes: { x: number; y: number; z: number; tileId: number }[]) => void;
  pushUndo: (changes: TileChange[]) => void;
  undo: () => void;
  redo: () => void;
  resizeMap: (newWidth: number, newHeight: number, offsetX: number, offsetY: number) => void;
  shiftMap: (dx: number, dy: number) => void;

  // Actions - Clipboard
  copyTiles: (x1: number, y1: number, x2: number, y2: number) => void;
  cutTiles: (x1: number, y1: number, x2: number, y2: number) => void;
  pasteTiles: (x: number, y: number) => void;
  deleteTiles: (x1: number, y1: number, x2: number, y2: number) => void;
  moveTiles: (srcX1: number, srcY1: number, srcX2: number, srcY2: number, destX: number, destY: number) => void;

  // Actions - Event
  addEvent: (x?: number, y?: number) => number | null;
  copyEvent: (eventId: number) => void;
  cutEvent: (eventId: number) => void;
  pasteEvent: (x: number, y: number) => void;
  deleteEvent: (eventId: number) => void;
  copyEvents: (eventIds: number[]) => void;
  pasteEvents: (x: number, y: number) => void;
  deleteEvents: (eventIds: number[]) => void;
  moveEvents: (eventIds: number[], dx: number, dy: number) => void;
  setSelectedEventIds: (ids: number[]) => void;
  setEventSelectionStart: (pos: { x: number; y: number } | null) => void;
  setEventSelectionEnd: (pos: { x: number; y: number } | null) => void;
  setIsEventPasting: (isPasting: boolean) => void;
  setEventPastePreviewPos: (pos: { x: number; y: number } | null) => void;
  clearEventSelection: () => void;

  // Actions - Object
  setObjectSubMode: (mode: 'select' | 'create') => void;
  setSelectedObjectId: (id: number | null) => void;
  setSelectedObjectIds: (ids: number[]) => void;
  setObjectSelectionStart: (pos: { x: number; y: number } | null) => void;
  setObjectSelectionEnd: (pos: { x: number; y: number } | null) => void;
  setIsObjectPasting: (isPasting: boolean) => void;
  setObjectPastePreviewPos: (pos: { x: number; y: number } | null) => void;
  clearObjectSelection: () => void;
  objectPaintTiles: Set<string> | null;
  setObjectPaintTiles: (tiles: Set<string> | null) => void;
  addObject: (x: number, y: number) => void;
  addObjectFromTiles: (paintedTiles: Set<string>) => void;
  addObjectFromImage: (imageName: string, imageWidth: number, imageHeight: number) => void;
  addObjectFromAnimation: (animationId: number, animationName: string) => void;
  expandObjectTiles: (objectId: number, paintedTiles: Set<string>) => void;
  shrinkObjectTiles: (objectId: number, removeTiles: Set<string>) => void;
  updateObject: (id: number, updates: Partial<MapObject>, skipUndo?: boolean) => void;
  deleteObject: (id: number) => void;
  copyObjects: (objectIds: number[]) => void;
  pasteObjects: (x: number, y: number) => void;
  deleteObjects: (objectIds: number[]) => void;
  moveObjects: (objectIds: number[], dx: number, dy: number) => void;
  commitDragUndo: (snapshotObjects: MapObject[]) => void;

  // Actions - Camera Zone
  setSelectedCameraZoneId: (id: number | null) => void;
  setSelectedCameraZoneIds: (ids: number[]) => void;
  addCameraZone: (x: number, y: number, width: number, height: number) => void;
  updateCameraZone: (id: number, updates: Partial<CameraZone>, skipUndo?: boolean) => void;
  deleteCameraZone: (id: number) => void;
  deleteCameraZones: (ids: number[]) => void;
  moveCameraZones: (ids: number[], dx: number, dy: number) => void;
  commitCameraZoneDragUndo: (snapshotZones: CameraZone[]) => void;

  // Actions - Passage
  setPassageTool: (tool: 'select' | 'pen' | 'eraser') => void;
  setPassageShape: (shape: 'freehand' | 'rectangle' | 'ellipse' | 'fill') => void;
  setSelectedPassageTile: (tile: { x: number; y: number } | null) => void;
  updateCustomPassage: (changes: PassageChange[]) => void;
  setPassageSelection: (start: { x: number; y: number } | null, end: { x: number; y: number } | null) => void;
  clearPassageSelection: () => void;
  setIsPassagePasting: (v: boolean) => void;
  setPassagePastePreviewPos: (pos: { x: number; y: number } | null) => void;
  copyPassage: (x1: number, y1: number, x2: number, y2: number) => void;
  cutPassage: (x1: number, y1: number, x2: number, y2: number) => void;
  pastePassage: (x: number, y: number) => void;
  deletePassage: (x1: number, y1: number, x2: number, y2: number) => void;
  movePassage: (srcX1: number, srcY1: number, srcX2: number, srcY2: number, destX: number, destY: number) => void;

  // Actions - UI
  setEditMode: (mode: 'map' | 'event' | 'light' | 'object' | 'cameraZone' | 'passage') => void;
  setSelectedTool: (tool: string) => void;
  setDrawShape: (shape: string) => void;
  setSelectedTileId: (id: number) => void;
  setSelectedTiles: (tiles: number[][] | null, width: number, height: number) => void;
  setCurrentLayer: (layer: number) => void;
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomActualSize: () => void;
  setCursorTile: (x: number, y: number) => void;
  setSelection: (start: { x: number; y: number } | null, end: { x: number; y: number } | null) => void;
  setIsPasting: (isPasting: boolean) => void;
  setPastePreviewPos: (pos: { x: number; y: number } | null) => void;
  clearSelection: () => void;
  setSelectedEventId: (id: number | null) => void;
  setShowGrid: (show: boolean) => void;
  setShowPassability: (show: boolean) => void;
  setShowTileInfo: (show: boolean) => void;
  setShowRegion: (show: boolean) => void;
  setMode3d: (enabled: boolean) => void;
  setShadowLight: (enabled: boolean) => void;
  setDisableFow: (disabled: boolean) => void;
  // Actions - Palette
  setPaletteTab: (tab: 'A' | 'B' | 'C' | 'D' | 'E' | 'R') => void;

  // Actions - Light editor
  setLightEditMode: (enabled: boolean) => void;
  setSelectedLightId: (id: number | null) => void;
  setSelectedLightIds: (ids: number[]) => void;
  setLightSelectionStart: (pos: { x: number; y: number } | null) => void;
  setLightSelectionEnd: (pos: { x: number; y: number } | null) => void;
  setIsLightPasting: (isPasting: boolean) => void;
  setLightPastePreviewPos: (pos: { x: number; y: number } | null) => void;
  clearLightSelection: () => void;
  setSelectedLightType: (type: 'point' | 'ambient' | 'directional' | 'playerLight' | 'spotLight') => void;
  initEditorLights: () => void;
  addPointLight: (x: number, y: number) => void;
  updatePointLight: (id: number, updates: Partial<EditorPointLight>, skipUndo?: boolean) => void;
  deletePointLight: (id: number) => void;
  copyLights: (lightIds: number[]) => void;
  pasteLights: (x: number, y: number) => void;
  deleteLights: (lightIds: number[]) => void;
  moveLights: (lightIds: number[], dx: number, dy: number) => void;
  updateEditorLightsEnabled: (enabled: boolean) => void;
  updateAmbientLight: (updates: Partial<EditorAmbientLight>, skipUndo?: boolean) => void;
  updateDirectionalLight: (updates: Partial<EditorDirectionalLight>, skipUndo?: boolean) => void;
  updatePlayerLight: (updates: Partial<EditorPlayerLight>, skipUndo?: boolean) => void;
  updateSpotLight: (updates: Partial<EditorSpotLight>, skipUndo?: boolean) => void;
  updateShadowSettings: (updates: Partial<EditorShadowSettings>, skipUndo?: boolean) => void;
  commitLightDragUndo: (snapshotLights: any) => void;

  // Start position selection
  selectedStartPosition: 'player' | 'boat' | 'ship' | 'airship' | null;

  // Actions - Start position
  setSelectedStartPosition: (pos: 'player' | 'boat' | 'ship' | 'airship' | null) => void;
  setPlayerStartPosition: (mapId: number, x: number, y: number) => Promise<void>;
  setVehicleStartPosition: (vehicle: 'boat' | 'ship' | 'airship', mapId: number, x: number, y: number) => Promise<void>;
  clearVehicleStartPosition: (vehicle: 'boat' | 'ship' | 'airship') => Promise<void>;
  setTestStartPosition: (x: number, y: number) => void;
  clearTestStartPosition: () => void;

  // Actions - Dialog toggles
  setShowOpenProjectDialog: (show: boolean) => void;
  setShowNewProjectDialog: (show: boolean) => void;
  setShowDatabaseDialog: (show: boolean) => void;
  setShowDeployDialog: (show: boolean) => void;
  setShowFindDialog: (show: boolean) => void;
  setShowPluginManagerDialog: (show: boolean) => void;
  setShowSoundTestDialog: (show: boolean) => void;
  setShowEventSearchDialog: (show: boolean) => void;
  setShowResourceManagerDialog: (show: boolean) => void;
  setShowCharacterGeneratorDialog: (show: boolean) => void;
  setShowOptionsDialog: (show: boolean) => void;
  setShowLocalizationDialog: (show: boolean) => void;
  setShowUpdateCheckDialog: (show: boolean) => void;
  setTransparentColor: (color: { r: number; g: number; b: number }) => void;
  setMaxUndo: (max: number) => void;
  setZoomStep: (step: number) => void;
}

export type SliceCreator<T> = (
  set: (partial: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) => void,
  get: () => EditorState,
  api: any,
) => T;
