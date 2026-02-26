import type { MapInfo, MapData, TilesetData, SystemData, EditorPointLight, EditorAmbientLight, EditorDirectionalLight, EditorPlayerLight, EditorSpotLight, EditorShadowSettings, EditorLights, MapObject, RPGEvent, CameraZone, PostProcessConfig, PostProcessEffectParams } from '../types/rpgMakerMV';

// Re-exports — 기존 import 경로 유지를 위해
export * from './constants';
export * from './historyTypes';
export * from './clipboardTypes';
export * from './uiEditorTypes';

import type { HistoryEntry, TileChange, PassageChange } from './historyTypes';
import type { ClipboardData } from './clipboardTypes';
import type { UIWindowInfo, UIWindowOverride, UiSkinUndoEntry, CustomScenesData, CustomSceneDef, CustomWindowDef } from './uiEditorTypes';

export interface RendererInitError {
  title: string;
  details: string;
  browserInfo: string;
  webglSupport: string;
  originalError?: string;
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

  // Top-level editor mode
  editorMode: 'map' | 'ui';

  // UI Editor state
  uiEditorScene: string;
  uiEditorIframeReady: boolean;
  uiEditorWindows: UIWindowInfo[];
  uiEditorOriginalWindows: UIWindowInfo[];
  uiEditorSelectedWindowId: string | null;
  uiEditorOverrides: Record<string, UIWindowOverride>;
  uiEditorDirty: boolean;
  // UI Editor 서브모드: 창 배치 편집 vs 프레임(스킨) 편집 vs 커서 편집 vs 폰트 설정
  uiEditSubMode: 'window' | 'frame' | 'cursor' | 'font';
  uiSelectedSkin: string;      // 선택된 스킨 ID (name 필드)
  uiSelectedSkinFile: string;  // 선택된 스킨의 이미지 파일 경로 (확장자 제외)
  uiSkinCornerSize: number;    // 9-slice 코너 크기 px
  uiSkinFrameX: number;        // 프레임 영역 X (이미지 픽셀 기준)
  uiSkinFrameY: number;        // 프레임 영역 Y
  uiSkinFrameW: number;        // 프레임 영역 너비
  uiSkinFrameH: number;        // 프레임 영역 높이
  uiSkinFillX: number;         // fill 영역 X
  uiSkinFillY: number;         // fill 영역 Y
  uiSkinFillW: number;         // fill 영역 너비
  uiSkinFillH: number;         // fill 영역 높이
  uiSkinUseCenterFill: boolean; // true: 9-slice 정중앙을 fill로 자동 계산
  uiSkinCursorX: number;       // 커서 소스 X
  uiSkinCursorY: number;       // 커서 소스 Y
  uiSkinCursorW: number;       // 커서 소스 너비
  uiSkinCursorH: number;       // 커서 소스 높이
  uiSkinCursorCornerSize: number; // 커서 9-slice 코너 크기
  uiSkinCursorRenderMode: 'nineSlice' | 'stretch' | 'tile'; // 커서 렌더링 모드
  uiSkinCursorBlendMode: 'normal' | 'add' | 'multiply' | 'screen'; // 커서 blend mode
  uiSkinCursorOpacity: number;   // 커서 최대 불투명도 (0~255)
  uiSkinCursorBlink: boolean;    // 커서 깜박임 on/off
  uiSkinCursorPadding: number;   // 커서 패딩 (선택 영역 대비 확장, 기본 2)
  uiSkinCursorToneR: number;     // 색조 R (-255~255)
  uiSkinCursorToneG: number;     // 색조 G (-255~255)
  uiSkinCursorToneB: number;     // 색조 B (-255~255)
  uiSkinsReloadToken: number;  // 증가하면 스킨 목록 강제 리로드
  uiSkinUndoStack: UiSkinUndoEntry[];
  uiOverrideUndoStack: Record<string, UIWindowOverride>[];
  uiOverrideRedoStack: Record<string, UIWindowOverride>[];
  uiEditorSelectedElementType: string | null; // 선택된 요소 타입 (actorName, hp 등)
  uiShowSkinLabels: boolean;    // 프레임 캔버스 영역 라벨 표시 여부
  uiShowCheckerboard: boolean;  // 프레임 캔버스 투명 체크보드 표시 여부
  uiShowRegionOverlay: boolean; // 프레임 캔버스 영역 컬러 오버레이 표시 여부
  uiFontSelectedFamily: string; // 폰트 에디터: 현재 선택된 font-family
  uiFontDefaultFace: string;    // 폰트 에디터: 저장된 기본 폰트
  uiFontList: Array<{ name: string; file: string; family: string }>; // 프로젝트 폰트 목록
  uiFontSceneFonts: Record<string, string>; // 씬별 기본 폰트 (sceneName → fontFamily)

  // Custom scenes
  customScenes: CustomScenesData;
  customSceneDirty: boolean;
  sceneRedirects: Record<string, string>; // 씬 이름 → 대체할 커스텀 씬 이름

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
  passageTool: 'select' | 'pen' | 'forceOpen' | 'upperLayer' | 'lowerLayer' | 'eraser';
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
  postProcessConfig: PostProcessConfig;
  setPostProcessConfig: (config: PostProcessConfig) => void;
  updatePostProcessEffect: (effectKey: string, params: Partial<PostProcessEffectParams>) => void;

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

  // Demo mode (DEMO_MODE=true 서버에서 설정)
  demoMode: boolean;

  // Renderer init error
  rendererInitError: RendererInitError | null;

  // 미실행 프로젝트 팝업
  uninitializedProjectPath: string | null;
  setUninitializedProjectPath: (path: string | null) => void;

  // Toast
  toastQueue: { id: number; message: string; persistent: boolean; createdAt: number; count: number }[];
  showToast: (message: string, persistent?: boolean) => void;
  dismissToast: (id: number) => void;
  dismissAllToasts: () => void;

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
  showMCPStatusDialog: boolean;
  showWebpConvertDialog: boolean;
  showPngConvertDialog: boolean;
  useWebp: boolean;
  webpConverting: boolean;


  // Actions - Editor mode
  setEditorMode: (mode: 'map' | 'ui') => void;

  // Actions - UI Editor
  setUiEditorScene: (scene: string) => void;
  setUiEditorIframeReady: (ready: boolean) => void;
  setUiEditorWindows: (windows: UIWindowInfo[]) => void;
  setUiEditorOriginalWindows: (windows: UIWindowInfo[]) => void;
  setUiEditorSelectedWindowId: (id: string | null) => void;
  setUiEditorOverride: (className: string, prop: keyof Omit<UIWindowOverride, 'className'>, value: unknown) => void;
  resetUiEditorOverride: (className: string) => void;
  loadUiEditorOverrides: (overrides: Record<string, UIWindowOverride>) => void;
  setUiEditorDirty: (dirty: boolean) => void;
  setUiEditSubMode: (mode: 'window' | 'frame' | 'cursor' | 'font') => void;
  setUiSelectedSkin: (skin: string) => void;
  setUiSelectedSkinFile: (file: string) => void;
  setUiSkinCornerSize: (size: number) => void;
  setUiSkinFrame: (x: number, y: number, w: number, h: number) => void;
  setUiSkinFill: (x: number, y: number, w: number, h: number) => void;
  setUiSkinUseCenterFill: (v: boolean) => void;
  setUiSkinCursor: (x: number, y: number, w: number, h: number) => void;
  setUiSkinCursorCornerSize: (size: number) => void;
  setUiSkinCursorRenderMode: (mode: 'nineSlice' | 'stretch' | 'tile') => void;
  setUiSkinCursorBlendMode: (mode: 'normal' | 'add' | 'multiply' | 'screen') => void;
  setUiSkinCursorOpacity: (v: number) => void;
  setUiSkinCursorBlink: (v: boolean) => void;
  setUiSkinCursorPadding: (v: number) => void;
  setUiSkinCursorTone: (r: number, g: number, b: number) => void;
  triggerSkinsReload: () => void;
  pushUiSkinUndo: () => void;
  undoUiSkin: () => void;
  pushUiOverrideUndo: () => void;
  undoUiOverride: () => void;
  redoUiOverride: () => void;
  setUiEditorSelectedElementType: (type: string | null) => void;
  setUiElementOverride: (className: string, elementType: string, prop: string, value: unknown) => void;
  setUiShowSkinLabels: (show: boolean) => void;
  setUiShowCheckerboard: (show: boolean) => void;
  setUiShowRegionOverlay: (show: boolean) => void;
  setUiFontSelectedFamily: (family: string) => void;
  setUiFontDefaultFace: (face: string) => void;
  setUiFontList: (list: Array<{ name: string; file: string; family: string }>) => void;
  setUiFontSceneFonts: (sceneFonts: Record<string, string>) => void;

  // Actions - Custom Scenes
  loadCustomScenes: () => Promise<void>;
  saveCustomScenes: () => Promise<void>;
  addCustomScene: (scene: CustomSceneDef) => void;
  removeCustomScene: (id: string) => void;
  updateCustomScene: (id: string, updates: Partial<CustomSceneDef>) => void;
  addCustomWindow: (sceneId: string, def: CustomWindowDef) => void;
  removeCustomWindow: (sceneId: string, winId: string) => void;
  updateCustomWindow: (sceneId: string, winId: string, updates: Partial<CustomWindowDef>) => void;
  setSceneRedirects: (redirects: Record<string, string>) => void;

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
  pasteEvents: (x: number, y: number) => { pastedCount: number; blockedPositions: number };
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
  setPassageTool: (tool: 'select' | 'pen' | 'forceOpen' | 'upperLayer' | 'lowerLayer' | 'eraser') => void;
  setPassageShape: (shape: 'freehand' | 'rectangle' | 'ellipse' | 'fill') => void;
  setSelectedPassageTile: (tile: { x: number; y: number } | null) => void;
  updateCustomPassage: (changes: PassageChange[]) => void;
  updateCustomUpperLayer: (changes: PassageChange[]) => void;
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
  setShowMCPStatusDialog: (show: boolean) => void;
  setShowWebpConvertDialog: (show: boolean) => void;
  setShowPngConvertDialog: (show: boolean) => void;
  setUseWebp: (v: boolean) => void;
  setWebpConverting: (v: boolean) => void;
  setTransparentColor: (color: { r: number; g: number; b: number }) => void;
  setMaxUndo: (max: number) => void;
  setZoomStep: (step: number) => void;
}

export type SliceCreator<T> = (
  set: (partial: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) => void,
  get: () => EditorState,
  api: any,
) => T;
