import { create } from 'zustand';
import apiClient from '../api/client';
import type { MapInfo, MapData, TilesetData, SystemData, EditorPointLight, EditorAmbientLight, EditorDirectionalLight, EditorPlayerLight, EditorSpotLight, EditorShadowSettings, EditorLights, MapObject, RPGEvent } from '../types/rpgMakerMV';
import { DEFAULT_EDITOR_LIGHTS } from '../types/rpgMakerMV';
import { resizeMapData, resizeEvents } from '../utils/mapResize';

const PROJECT_STORAGE_KEY = 'rpg-editor-current-project';
const MAP_STORAGE_KEY = 'rpg-editor-current-map';

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
  newWidth: number;
  newHeight: number;
  newData: number[];
  newEvents: (RPGEvent | null)[];
}

export interface ObjectHistoryEntry {
  mapId: number;
  type: 'object';
  oldObjects: MapObject[];
  newObjects: MapObject[];
  oldSelectedObjectId: number | null;
}

export interface LightHistoryEntry {
  mapId: number;
  type: 'light';
  oldLights: EditorLights;
  newLights: EditorLights;
  oldSelectedLightId: number | null;
}

export type HistoryEntry = TileHistoryEntry | ResizeHistoryEntry | ObjectHistoryEntry | LightHistoryEntry;

export interface ClipboardData {
  type: 'tiles' | 'event';
  tiles?: { x: number; y: number; z: number; tileId: number }[];
  width?: number;
  height?: number;
  event?: unknown;
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
  editMode: 'map' | 'event' | 'light' | 'object';

  // Drawing tools
  selectedTool: string;
  selectedTileId: number;
  selectedTiles: number[][] | null; // 2D array [row][col] of tile IDs for multi-tile selection
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

  // Selection (for rectangle/ellipse preview and copy)
  selectionStart: { x: number; y: number } | null;
  selectionEnd: { x: number; y: number } | null;

  // Event editor
  selectedEventId: number | null;

  // Object editor
  selectedObjectId: number | null;

  // 3D / Lighting
  mode3d: boolean;
  shadowLight: boolean;
  depthOfField: boolean;

  // Palette tab
  paletteTab: 'A' | 'B' | 'C' | 'D' | 'E' | 'R';

  // Light editor
  lightEditMode: boolean;
  selectedLightId: number | null;
  selectedLightType: 'point' | 'ambient' | 'directional';

  // Toast
  toastMessage: string | null;
  showToast: (message: string) => void;

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

  // Actions - Map editing
  updateMapTile: (x: number, y: number, z: number, tileId: number) => void;
  updateMapTiles: (changes: { x: number; y: number; z: number; tileId: number }[]) => void;
  pushUndo: (changes: TileChange[]) => void;
  undo: () => void;
  redo: () => void;
  resizeMap: (newWidth: number, newHeight: number, offsetX: number, offsetY: number) => void;

  // Actions - Clipboard
  copyTiles: (x1: number, y1: number, x2: number, y2: number) => void;
  cutTiles: (x1: number, y1: number, x2: number, y2: number) => void;
  pasteTiles: (x: number, y: number) => void;
  deleteTiles: (x1: number, y1: number, x2: number, y2: number) => void;

  // Actions - Event
  copyEvent: (eventId: number) => void;
  cutEvent: (eventId: number) => void;
  pasteEvent: (x: number, y: number) => void;
  deleteEvent: (eventId: number) => void;

  // Actions - Object
  setSelectedObjectId: (id: number | null) => void;
  addObject: (x: number, y: number) => void;
  updateObject: (id: number, updates: Partial<MapObject>) => void;
  deleteObject: (id: number) => void;

  // Actions - UI
  setEditMode: (mode: 'map' | 'event' | 'light' | 'object') => void;
  setSelectedTool: (tool: string) => void;
  setSelectedTileId: (id: number) => void;
  setSelectedTiles: (tiles: number[][] | null, width: number, height: number) => void;
  setCurrentLayer: (layer: number) => void;
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomActualSize: () => void;
  setCursorTile: (x: number, y: number) => void;
  setSelection: (start: { x: number; y: number } | null, end: { x: number; y: number } | null) => void;
  setSelectedEventId: (id: number | null) => void;
  setMode3d: (enabled: boolean) => void;
  setShadowLight: (enabled: boolean) => void;
  setDepthOfField: (enabled: boolean) => void;

  // Actions - Palette
  setPaletteTab: (tab: 'A' | 'B' | 'C' | 'D' | 'E' | 'R') => void;

  // Actions - Light editor
  setLightEditMode: (enabled: boolean) => void;
  setSelectedLightId: (id: number | null) => void;
  setSelectedLightType: (type: 'point' | 'ambient' | 'directional') => void;
  initEditorLights: () => void;
  addPointLight: (x: number, y: number) => void;
  updatePointLight: (id: number, updates: Partial<EditorPointLight>) => void;
  deletePointLight: (id: number) => void;
  updateAmbientLight: (updates: Partial<EditorAmbientLight>) => void;
  updateDirectionalLight: (updates: Partial<EditorDirectionalLight>) => void;
  updatePlayerLight: (updates: Partial<EditorPlayerLight>) => void;
  updateSpotLight: (updates: Partial<EditorSpotLight>) => void;
  updateShadowSettings: (updates: Partial<EditorShadowSettings>) => void;

  // Actions - Start position
  setPlayerStartPosition: (mapId: number, x: number, y: number) => Promise<void>;

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
}

const ZOOM_LEVELS = [0.25, 0.5, 1, 2, 4];
const MAX_UNDO = 20;

const useEditorStore = create<EditorState>((set, get) => ({
  // State
  projectPath: null,
  projectName: null,
  maps: [],
  currentMapId: null,
  currentMap: null,
  tilesetInfo: null,
  systemData: null,
  playerCharacterName: null,
  playerCharacterIndex: 0,
  editMode: 'map',
  selectedTool: 'pen',
  selectedTileId: 0,
  selectedTiles: null,
  selectedTilesWidth: 1,
  selectedTilesHeight: 1,
  currentLayer: 0,
  zoomLevel: 1,
  undoStack: [],
  redoStack: [],
  clipboard: null,
  cursorTileX: 0,
  cursorTileY: 0,
  selectionStart: null,
  selectionEnd: null,
  selectedEventId: null,
  selectedObjectId: null,
  mode3d: false,
  shadowLight: false,
  depthOfField: false,
  paletteTab: 'A',
  lightEditMode: false,
  selectedLightId: null,
  selectedLightType: 'point',
  toastMessage: null,
  showToast: (message: string) => {
    set({ toastMessage: message });
    setTimeout(() => set({ toastMessage: null }), 2000);
  },
  showOpenProjectDialog: false,
  showNewProjectDialog: false,
  showDatabaseDialog: false,
  showDeployDialog: false,
  showFindDialog: false,
  showPluginManagerDialog: false,
  showSoundTestDialog: false,
  showEventSearchDialog: false,
  showResourceManagerDialog: false,
  showCharacterGeneratorDialog: false,

  // Project actions
  openProject: async (projectPath: string) => {
    const res = await apiClient.post<{ name?: string }>('/project/open', { path: projectPath });
    set({
      projectPath,
      projectName: res.name || projectPath.split('/').pop() || null,
      undoStack: [],
      redoStack: [],
      clipboard: null,
      selectedEventId: null,
    });
    localStorage.setItem(PROJECT_STORAGE_KEY, projectPath);
    get().loadMaps();
    // Load system data for player start position etc.
    apiClient.get<SystemData>('/database/system').then(async (sys) => {
      set({ systemData: sys });
      // Load leader actor's character info
      if (sys.partyMembers && sys.partyMembers.length > 0) {
        try {
          const actors = await apiClient.get<({ characterName: string; characterIndex: number } | null)[]>('/database/actors');
          const leader = actors[sys.partyMembers[0]];
          if (leader) {
            set({ playerCharacterName: leader.characterName, playerCharacterIndex: leader.characterIndex });
          }
        } catch {}
      }
    }).catch(() => {});
  },

  closeProject: () => {
    apiClient.post('/project/close', {}).catch(() => {});
    set({
      projectPath: null,
      projectName: null,
      maps: [],
      currentMapId: null,
      currentMap: null,
      tilesetInfo: null,
      systemData: null,
      playerCharacterName: null,
      playerCharacterIndex: 0,
      undoStack: [],
      redoStack: [],
      clipboard: null,
      selectedEventId: null,
    });
    localStorage.removeItem(PROJECT_STORAGE_KEY);
    localStorage.removeItem(MAP_STORAGE_KEY);
  },

  restoreLastProject: async () => {
    const saved = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (saved) {
      try {
        await get().openProject(saved);
        const savedMap = localStorage.getItem(MAP_STORAGE_KEY);
        if (savedMap) {
          const mapId = parseInt(savedMap, 10);
          if (!isNaN(mapId) && mapId > 0) {
            await get().selectMap(mapId);
          }
        }
      } catch {
        localStorage.removeItem(PROJECT_STORAGE_KEY);
        localStorage.removeItem(MAP_STORAGE_KEY);
      }
    }
  },

  loadMaps: async () => {
    const maps = await apiClient.get<(MapInfo | null)[]>('/maps');
    set({ maps });
  },

  selectMap: async (mapId: number) => {
    set({ currentMapId: mapId, undoStack: [], redoStack: [] });
    localStorage.setItem(MAP_STORAGE_KEY, String(mapId));
    const map = await apiClient.get<MapData>(`/maps/${mapId}`);
    if (map.tilesetId) {
      try {
        const tilesets = await apiClient.get<(TilesetData | null)[]>('/database/tilesets');
        const tilesetInfo = tilesets[map.tilesetId];
        if (tilesetInfo) {
          map.tilesetNames = tilesetInfo.tilesetNames;
          set({ currentMap: map, tilesetInfo });
        } else {
          set({ currentMap: map });
        }
      } catch {
        set({ currentMap: map });
      }
    } else {
      set({ currentMap: map });
    }
  },

  saveCurrentMap: async () => {
    const { currentMapId, currentMap, showToast } = get();
    if (!currentMapId || !currentMap) return;
    await apiClient.put(`/maps/${currentMapId}`, currentMap);
    showToast('저장 완료');
  },

  createMap: async (opts) => {
    try {
      const res = await apiClient.post<{ id: number }>('/maps', opts);
      await get().loadMaps();
      return res.id;
    } catch {
      return null;
    }
  },

  deleteMap: async (mapId: number) => {
    await apiClient.delete(`/maps/${mapId}`);
    const { currentMapId } = get();
    if (currentMapId === mapId) {
      set({ currentMapId: null, currentMap: null, tilesetInfo: null });
    }
    await get().loadMaps();
  },

  updateMapInfos: async (mapInfos: (MapInfo | null)[]) => {
    await apiClient.put('/maps', mapInfos);
    set({ maps: mapInfos });
  },

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
    const newStack = [...undoStack, { mapId: currentMapId, changes } as TileHistoryEntry];
    if (newStack.length > MAX_UNDO) newStack.shift();
    set({ undoStack: newStack, redoStack: [] });
  },

  undo: () => {
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
        newWidth: re.oldWidth, newHeight: re.oldHeight, newData: re.oldData, newEvents: re.oldEvents,
      };
      set({
        currentMap: { ...currentMap, width: re.oldWidth, height: re.oldHeight, data: re.oldData, events: re.oldEvents },
        undoStack: undoStack.slice(0, -1),
        redoStack: [...get().redoStack, redoEntry],
      });
      showToast(`실행 취소 (맵 크기 ${re.oldWidth}x${re.oldHeight})`);
      return;
    }

    if (entry.type === 'object') {
      const oe = entry as ObjectHistoryEntry;
      const redoEntry: ObjectHistoryEntry = {
        mapId: currentMapId, type: 'object',
        oldObjects: oe.newObjects, newObjects: oe.oldObjects,
        oldSelectedObjectId: get().selectedObjectId,
      };
      set({
        currentMap: { ...currentMap, objects: oe.oldObjects },
        selectedObjectId: oe.oldSelectedObjectId,
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
      };
      set({
        currentMap: { ...currentMap, editorLights: le.oldLights },
        selectedLightId: le.oldSelectedLightId,
        undoStack: undoStack.slice(0, -1),
        redoStack: [...get().redoStack, redoEntry],
      });
      showToast('실행 취소 (조명)');
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
  },

  redo: () => {
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
        newWidth: re.oldWidth, newHeight: re.oldHeight, newData: re.oldData, newEvents: re.oldEvents,
      };
      set({
        currentMap: { ...currentMap, width: re.oldWidth, height: re.oldHeight, data: re.oldData, events: re.oldEvents },
        redoStack: redoStack.slice(0, -1),
        undoStack: [...get().undoStack, undoEntry],
      });
      showToast(`다시 실행 (맵 크기 ${re.oldWidth}x${re.oldHeight})`);
      return;
    }

    if (entry.type === 'object') {
      const oe = entry as ObjectHistoryEntry;
      const undoEntry: ObjectHistoryEntry = {
        mapId: currentMapId, type: 'object',
        oldObjects: oe.newObjects, newObjects: oe.oldObjects,
        oldSelectedObjectId: get().selectedObjectId,
      };
      set({
        currentMap: { ...currentMap, objects: oe.oldObjects },
        selectedObjectId: oe.oldSelectedObjectId,
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
      };
      set({
        currentMap: { ...currentMap, editorLights: le.oldLights },
        selectedLightId: le.oldSelectedLightId,
        redoStack: redoStack.slice(0, -1),
        undoStack: [...get().undoStack, undoEntry],
      });
      showToast('다시 실행 (조명)');
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
  },

  resizeMap: (newWidth: number, newHeight: number, offsetX: number, offsetY: number) => {
    const { currentMap, currentMapId, undoStack, showToast } = get();
    if (!currentMap || !currentMapId) return;
    const { width: oldW, height: oldH, data: oldData, events: oldEvents } = currentMap;
    if (newWidth === oldW && newHeight === oldH && offsetX === 0 && offsetY === 0) return;
    const nw = Math.max(1, Math.min(256, newWidth));
    const nh = Math.max(1, Math.min(256, newHeight));
    const newData = resizeMapData(oldData, oldW, oldH, nw, nh, offsetX, offsetY);
    const newEvents = resizeEvents(oldEvents, nw, nh, offsetX, offsetY);
    const historyEntry: ResizeHistoryEntry = {
      mapId: currentMapId,
      type: 'resize',
      oldWidth: oldW, oldHeight: oldH, oldData, oldEvents,
      newWidth: nw, newHeight: nh, newData, newEvents,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > MAX_UNDO) newStack.shift();
    set({
      currentMap: { ...currentMap, width: nw, height: nh, data: newData, events: newEvents },
      undoStack: newStack,
      redoStack: [],
    });
    showToast(`맵 크기 변경 ${oldW}x${oldH} → ${nw}x${nh}`);
  },

  // Clipboard - tiles
  copyTiles: (x1: number, y1: number, x2: number, y2: number) => {
    const map = get().currentMap;
    if (!map) return;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const tiles: { x: number; y: number; z: number; tileId: number }[] = [];
    for (let z = 0; z < 4; z++) {
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
    for (const t of clipboard.tiles) {
      const tx = x + t.x, ty = y + t.y;
      if (tx < 0 || tx >= currentMap.width || ty < 0 || ty >= currentMap.height) continue;
      const idx = (t.z * currentMap.height + ty) * currentMap.width + tx;
      changes.push({ x: tx, y: ty, z: t.z, oldTileId: newData[idx], newTileId: t.tileId });
      newData[idx] = t.tileId;
    }
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
    for (let z = 0; z < 4; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const idx = (z * map.height + y) * map.width + x;
          if (newData[idx] !== 0) {
            changes.push({ x, y, z, oldTileId: newData[idx], newTileId: 0 });
            newData[idx] = 0;
          }
        }
      }
    }
    set({ currentMap: { ...map, data: newData } });
    get().pushUndo(changes);
  },

  // Clipboard - events
  copyEvent: (eventId: number) => {
    const map = get().currentMap;
    if (!map || !map.events) return;
    const ev = map.events.find((e) => e && e.id === eventId);
    if (ev) set({ clipboard: { type: 'event', event: JSON.parse(JSON.stringify(ev)) } });
  },

  cutEvent: (eventId: number) => {
    get().copyEvent(eventId);
    get().deleteEvent(eventId);
  },

  pasteEvent: (x: number, y: number) => {
    const { clipboard, currentMap } = get();
    if (!clipboard || clipboard.type !== 'event' || !clipboard.event || !currentMap) return;
    const events = [...(currentMap.events || [])];
    const maxId = events.reduce((max, e) => (e && e.id > max ? e.id : max), 0);
    const newEvent = { ...(clipboard.event as Record<string, unknown>), id: maxId + 1, x, y };
    while (events.length <= maxId + 1) events.push(null);
    events[maxId + 1] = newEvent as MapData['events'][0];
    set({ currentMap: { ...currentMap, events } });
  },

  deleteEvent: (eventId: number) => {
    const map = get().currentMap;
    if (!map || !map.events) return;
    const events = map.events.map((e) => (e && e.id === eventId ? null : e));
    set({ currentMap: { ...map, events } });
  },

  // Object actions
  setSelectedObjectId: (id: number | null) => set({ selectedObjectId: id }),

  addObject: (x: number, y: number) => {
    const { currentMap, currentMapId, selectedTiles, selectedTilesWidth, selectedTilesHeight, selectedTileId, undoStack, selectedObjectId } = get();
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
    // 스마트 통행 설정: 하단 행만 불가, 나머지 가능
    const passability: boolean[][] = [];
    for (let row = 0; row < h; row++) {
      passability.push(Array(w).fill(row < h - 1)); // 마지막 행(하단) = false(불가)
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
    const historyEntry: ObjectHistoryEntry = {
      mapId: currentMapId, type: 'object',
      oldObjects: oldObjects, newObjects: objects,
      oldSelectedObjectId: selectedObjectId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > MAX_UNDO) newStack.shift();
    set({
      currentMap: { ...currentMap, objects },
      selectedObjectId: newId,
      undoStack: newStack,
      redoStack: [],
    });
  },

  updateObject: (id: number, updates: Partial<MapObject>) => {
    const { currentMap, currentMapId, undoStack, selectedObjectId } = get();
    if (!currentMap || !currentMapId || !currentMap.objects) return;
    const oldObjects = currentMap.objects;
    const objects = oldObjects.map(o => o.id === id ? { ...o, ...updates } : o);
    const historyEntry: ObjectHistoryEntry = {
      mapId: currentMapId, type: 'object',
      oldObjects, newObjects: objects,
      oldSelectedObjectId: selectedObjectId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > MAX_UNDO) newStack.shift();
    set({
      currentMap: { ...currentMap, objects },
      undoStack: newStack,
      redoStack: [],
    });
  },

  deleteObject: (id: number) => {
    const { currentMap, currentMapId, undoStack, selectedObjectId } = get();
    if (!currentMap || !currentMapId || !currentMap.objects) return;
    const oldObjects = currentMap.objects;
    const objects = oldObjects.filter(o => o.id !== id);
    const historyEntry: ObjectHistoryEntry = {
      mapId: currentMapId, type: 'object',
      oldObjects, newObjects: objects,
      oldSelectedObjectId: selectedObjectId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > MAX_UNDO) newStack.shift();
    set({
      currentMap: { ...currentMap, objects },
      selectedObjectId: selectedObjectId === id ? null : selectedObjectId,
      undoStack: newStack,
      redoStack: [],
    });
  },

  // UI actions
  setEditMode: (mode: 'map' | 'event' | 'light' | 'object') => {
    const state = get();
    const updates: Partial<EditorState> = { editMode: mode };
    // light mode: activate lightEditMode + shadowLight
    if (mode === 'light') {
      updates.lightEditMode = true;
      updates.shadowLight = true;
      if (typeof (window as any).ConfigManager !== 'undefined') {
        (window as any).ConfigManager.shadowLight = true;
      }
      // Initialize editor lights if needed
      setTimeout(() => get().initEditorLights(), 0);
    } else {
      // Exiting light mode: deactivate lightEditMode
      if (state.editMode === 'light') {
        updates.lightEditMode = false;
        updates.selectedLightId = null;
      }
    }
    if (mode !== 'object') {
      updates.selectedObjectId = null;
    }
    if (mode !== 'event') {
      updates.selectedEventId = null;
    }
    set(updates);
  },
  setSelectedTool: (tool: string) => set({ selectedTool: tool }),
  setSelectedTileId: (id: number) => set({ selectedTileId: id, selectedTiles: null, selectedTilesWidth: 1, selectedTilesHeight: 1 }),
  setSelectedTiles: (tiles: number[][] | null, width: number, height: number) => set({ selectedTiles: tiles, selectedTilesWidth: width, selectedTilesHeight: height }),
  setCurrentLayer: (layer: number) => set({ currentLayer: layer }),
  setZoomLevel: (level: number) => set({ zoomLevel: level }),
  zoomIn: () => {
    const { zoomLevel } = get();
    const idx = ZOOM_LEVELS.indexOf(zoomLevel);
    if (idx < ZOOM_LEVELS.length - 1) set({ zoomLevel: ZOOM_LEVELS[idx + 1] });
  },
  zoomOut: () => {
    const { zoomLevel } = get();
    const idx = ZOOM_LEVELS.indexOf(zoomLevel);
    if (idx > 0) set({ zoomLevel: ZOOM_LEVELS[idx - 1] });
  },
  zoomActualSize: () => set({ zoomLevel: 1 }),
  setCursorTile: (x: number, y: number) => set({ cursorTileX: x, cursorTileY: y }),
  setSelection: (start, end) => set({ selectionStart: start, selectionEnd: end }),
  setSelectedEventId: (id: number | null) => set({ selectedEventId: id }),
  setMode3d: (enabled: boolean) => {
    const ConfigManager = (window as any).ConfigManager;
    if (ConfigManager) ConfigManager.mode3d = enabled;
    set({ mode3d: enabled });
  },
  setShadowLight: (enabled: boolean) => {
    const ConfigManager = (window as any).ConfigManager;
    if (ConfigManager) ConfigManager.shadowLight = enabled;
    set({ shadowLight: enabled });
  },
  setDepthOfField: (enabled: boolean) => {
    const ConfigManager = (window as any).ConfigManager;
    if (ConfigManager) ConfigManager.depthOfField = enabled;
    set({ depthOfField: enabled });
  },

  // Palette actions
  setPaletteTab: (tab: 'A' | 'B' | 'C' | 'D' | 'E' | 'R') => set({ paletteTab: tab }),

  // Light editor actions
  setLightEditMode: (enabled: boolean) => set({ lightEditMode: enabled, selectedLightId: null }),
  setSelectedLightId: (id: number | null) => set({ selectedLightId: id }),
  setSelectedLightType: (type: 'point' | 'ambient' | 'directional') => set({ selectedLightType: type, selectedLightId: null }),

  initEditorLights: () => {
    const map = get().currentMap;
    if (!map) return;
    if (!map.editorLights) {
      set({ currentMap: { ...map, editorLights: JSON.parse(JSON.stringify(DEFAULT_EDITOR_LIGHTS)) } });
    }
  },

  addPointLight: (x: number, y: number) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const points = [...map.editorLights.points];
    const newId = points.length > 0 ? Math.max(...points.map(p => p.id)) + 1 : 1;
    const newLight: EditorPointLight = { id: newId, x, y, z: 30, color: '#ffcc88', intensity: 1.0, distance: 150, decay: 0 };
    points.push(newLight);
    const newLights = { ...map.editorLights, points };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > MAX_UNDO) newStack.shift();
    set({
      currentMap: { ...map, editorLights: newLights },
      selectedLightId: newId,
      undoStack: newStack,
      redoStack: [],
    });
  },

  updatePointLight: (id: number, updates: Partial<EditorPointLight>) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const points = map.editorLights.points.map(p => p.id === id ? { ...p, ...updates } : p);
    const newLights = { ...map.editorLights, points };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > MAX_UNDO) newStack.shift();
    set({
      currentMap: { ...map, editorLights: newLights },
      undoStack: newStack,
      redoStack: [],
    });
  },

  deletePointLight: (id: number) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const points = map.editorLights.points.filter(p => p.id !== id);
    const newLights = { ...map.editorLights, points };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > MAX_UNDO) newStack.shift();
    set({
      currentMap: { ...map, editorLights: newLights },
      selectedLightId: selectedLightId === id ? null : selectedLightId,
      undoStack: newStack,
      redoStack: [],
    });
  },

  updateAmbientLight: (updates: Partial<EditorAmbientLight>) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const newLights = { ...map.editorLights, ambient: { ...map.editorLights.ambient, ...updates } };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > MAX_UNDO) newStack.shift();
    set({
      currentMap: { ...map, editorLights: newLights },
      undoStack: newStack,
      redoStack: [],
    });
  },

  updateDirectionalLight: (updates: Partial<EditorDirectionalLight>) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const newLights = { ...map.editorLights, directional: { ...map.editorLights.directional, ...updates } };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > MAX_UNDO) newStack.shift();
    set({
      currentMap: { ...map, editorLights: newLights },
      undoStack: newStack,
      redoStack: [],
    });
  },

  updatePlayerLight: (updates: Partial<EditorPlayerLight>) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const cur = map.editorLights.playerLight ?? { color: '#a25f06', intensity: 0.8, distance: 200, z: 40 };
    const newLights = { ...map.editorLights, playerLight: { ...cur, ...updates } };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > MAX_UNDO) newStack.shift();
    set({ currentMap: { ...map, editorLights: newLights }, undoStack: newStack, redoStack: [] });
  },

  updateSpotLight: (updates: Partial<EditorSpotLight>) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const cur = map.editorLights.spotLight ?? { enabled: true, color: '#ffeedd', intensity: 0.8, distance: 250, angle: 0.60, penumbra: 0.9, z: 120, shadowMapSize: 2048, targetDistance: 70 };
    const newLights = { ...map.editorLights, spotLight: { ...cur, ...updates } };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > MAX_UNDO) newStack.shift();
    set({ currentMap: { ...map, editorLights: newLights }, undoStack: newStack, redoStack: [] });
  },

  updateShadowSettings: (updates: Partial<EditorShadowSettings>) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const cur = map.editorLights.shadow ?? { opacity: 0.4, color: '#000000', offsetScale: 0.6 };
    const newLights = { ...map.editorLights, shadow: { ...cur, ...updates } };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > MAX_UNDO) newStack.shift();
    set({ currentMap: { ...map, editorLights: newLights }, undoStack: newStack, redoStack: [] });
  },

  // Start position
  setPlayerStartPosition: async (mapId: number, x: number, y: number) => {
    const { systemData, showToast } = get();
    if (!systemData) return;
    const updated = { ...systemData, startMapId: mapId, startX: x, startY: y };
    try {
      await apiClient.put('/database/system', updated);
      set({ systemData: updated });
      showToast(`시작 위치 설정: 맵 ${mapId} (${x}, ${y})`);
    } catch {
      showToast('시작 위치 저장 실패');
    }
  },

  // Dialog toggles
  setShowOpenProjectDialog: (show: boolean) => set({ showOpenProjectDialog: show }),
  setShowNewProjectDialog: (show: boolean) => set({ showNewProjectDialog: show }),
  setShowDatabaseDialog: (show: boolean) => set({ showDatabaseDialog: show }),
  setShowDeployDialog: (show: boolean) => set({ showDeployDialog: show }),
  setShowFindDialog: (show: boolean) => set({ showFindDialog: show }),
  setShowPluginManagerDialog: (show: boolean) => set({ showPluginManagerDialog: show }),
  setShowSoundTestDialog: (show: boolean) => set({ showSoundTestDialog: show }),
  setShowEventSearchDialog: (show: boolean) => set({ showEventSearchDialog: show }),
  setShowResourceManagerDialog: (show: boolean) => set({ showResourceManagerDialog: show }),
  setShowCharacterGeneratorDialog: (show: boolean) => set({ showCharacterGeneratorDialog: show }),
}));

// Debug: expose store globally
(window as unknown as Record<string, unknown>).__editorStore = useEditorStore;

export default useEditorStore;
