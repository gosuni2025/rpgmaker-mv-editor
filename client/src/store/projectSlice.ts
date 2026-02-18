import apiClient from '../api/client';
import type { MapInfo, MapData, TilesetData, SystemData } from '../types/rpgMakerMV';
import type { EditorState, SliceCreator, PlayerStartHistoryEntry, MapDeleteHistoryEntry } from './types';
import { PROJECT_STORAGE_KEY, MAP_STORAGE_KEY, EDIT_MODE_STORAGE_KEY, TOOLBAR_STORAGE_KEY } from './types';

export const projectSlice: SliceCreator<Pick<EditorState,
  'projectPath' | 'projectName' | 'maps' | 'currentMapId' | 'currentMap' | 'tilesetInfo' |
  'systemData' | 'playerCharacterName' | 'playerCharacterIndex' | 'parseErrors' |
  'openProject' | 'closeProject' | 'restoreLastProject' | 'loadMaps' | 'selectMap' |
  'saveCurrentMap' | 'createMap' | 'deleteMap' | 'updateMapInfos' | 'setPlayerStartPosition' | 'setVehicleStartPosition' |
  'setTestStartPosition' | 'clearTestStartPosition'
>> = (set, get) => ({
  projectPath: null,
  projectName: null,
  maps: [],
  currentMapId: null,
  currentMap: null,
  tilesetInfo: null,
  systemData: null,
  playerCharacterName: null,
  playerCharacterIndex: 0,
  parseErrors: null,

  openProject: async (projectPath: string) => {
    const res = await apiClient.post<{ name?: string; parseErrors?: { file: string; error: string }[] }>('/project/open', { path: projectPath });
    set({
      projectPath,
      projectName: res.name || projectPath.split('/').pop() || null,
      undoStack: [],
      redoStack: [],
      clipboard: null,
      selectedEventId: null,
      parseErrors: res.parseErrors || null,
    });
    localStorage.setItem(PROJECT_STORAGE_KEY, projectPath);
    get().loadMaps();
    apiClient.get<SystemData>('/database/system').then(async (sys) => {
      set({ systemData: sys });
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
    localStorage.removeItem(EDIT_MODE_STORAGE_KEY);
  },

  restoreLastProject: async () => {
    // Restore toolbar state (project-independent UI settings)
    try {
      const toolbarRaw = localStorage.getItem(TOOLBAR_STORAGE_KEY);
      if (toolbarRaw) {
        const tb = JSON.parse(toolbarRaw);
        const updates: Partial<EditorState> = {};
        if (typeof tb.mode3d === 'boolean') {
          updates.mode3d = tb.mode3d;
          const ConfigManager = (window as any).ConfigManager;
          if (ConfigManager) ConfigManager.mode3d = tb.mode3d;
        }
        if (typeof tb.shadowLight === 'boolean') {
          updates.shadowLight = tb.shadowLight;
          const ConfigManager = (window as any).ConfigManager;
          if (ConfigManager) ConfigManager.shadowLight = tb.shadowLight;
        }
        if (typeof tb.disableFow === 'boolean') updates.disableFow = tb.disableFow;
        if (typeof tb.zoomLevel === 'number') updates.zoomLevel = tb.zoomLevel;
        if (typeof tb.paletteTab === 'string') updates.paletteTab = tb.paletteTab as EditorState['paletteTab'];
        if (typeof tb.selectedTool === 'string') updates.selectedTool = tb.selectedTool;
        if (typeof tb.drawShape === 'string') updates.drawShape = tb.drawShape;
        if (typeof tb.currentLayer === 'number') updates.currentLayer = tb.currentLayer;
        if (typeof tb.showGrid === 'boolean') updates.showGrid = tb.showGrid;
        if (typeof tb.showPassability === 'boolean') updates.showPassability = tb.showPassability;
        set(updates);
      }
    } catch {}

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
        const savedMode = localStorage.getItem(EDIT_MODE_STORAGE_KEY);
        if (savedMode && ['map', 'event', 'light', 'object', 'cameraZone'].includes(savedMode)) {
          get().setEditMode(savedMode as EditorState['editMode']);
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
    // Preserve mapDelete entries (project-level) when switching maps
    const { undoStack, redoStack } = get();
    const preservedUndo = undoStack.filter(e => e.type === 'mapDelete');
    const preservedRedo = redoStack.filter(e => e.type === 'mapDelete');
    set({ currentMapId: mapId, undoStack: preservedUndo, redoStack: preservedRedo });
    localStorage.setItem(MAP_STORAGE_KEY, String(mapId));
    const map = await apiClient.get<MapData>(`/maps/${mapId}`);
    // 맵 데이터에서 postProcessConfig 로드
    set({ postProcessConfig: map.postProcessConfig || {} });
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
    const res = await apiClient.put<{ success: boolean; l10nDiff?: { added: string[]; modified: string[]; deleted: string[] } }>(`/maps/${currentMapId}`, currentMap);
    let msg = '저장 완료';
    if (res.l10nDiff) {
      const parts: string[] = [];
      if (res.l10nDiff.added.length) parts.push(`추가 ${res.l10nDiff.added.length}`);
      if (res.l10nDiff.modified.length) parts.push(`변경 ${res.l10nDiff.modified.length}`);
      if (res.l10nDiff.deleted.length) parts.push(`삭제 ${res.l10nDiff.deleted.length}`);
      msg += ` (L10n: ${parts.join(', ')})`;
    }
    showToast(msg);
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
    const res = await apiClient.delete<{ success: boolean; mapInfo: any; mapData: any; extData: any }>(`/maps/${mapId}`);
    const { currentMapId, undoStack, maxUndo, showToast } = get();

    // Push undo entry with the deleted map data
    if (res.mapInfo) {
      const entry: MapDeleteHistoryEntry = {
        mapId,
        type: 'mapDelete',
        mapInfo: res.mapInfo,
        mapData: res.mapData,
        extData: res.extData,
      };
      const newStack = [...undoStack, entry];
      if (newStack.length > maxUndo) newStack.shift();
      set({ undoStack: newStack, redoStack: [] });
    }

    if (currentMapId === mapId) {
      set({ currentMapId: null, currentMap: null, tilesetInfo: null });
    }
    await get().loadMaps();
    showToast(`맵 ${mapId} 삭제됨 (Ctrl+Z로 복원 가능)`);
  },

  updateMapInfos: async (mapInfos: (MapInfo | null)[]) => {
    await apiClient.put('/maps', mapInfos);
    set({ maps: mapInfos });
  },

  setPlayerStartPosition: async (mapId: number, x: number, y: number) => {
    const { systemData, showToast, currentMapId, undoStack, maxUndo } = get();
    if (!systemData) return;
    const oldMapId = systemData.startMapId;
    const oldX = systemData.startX;
    const oldY = systemData.startY;
    if (oldMapId === mapId && oldX === x && oldY === y) return;
    const updated = { ...systemData, startMapId: mapId, startX: x, startY: y };
    try {
      await apiClient.put('/database/system', updated);
      const entry: PlayerStartHistoryEntry = {
        mapId: currentMapId!, type: 'playerStart',
        oldMapId, oldX, oldY,
        newMapId: mapId, newX: x, newY: y,
      };
      const newStack = [...undoStack, entry];
      if (newStack.length > maxUndo) newStack.shift();
      set({ systemData: updated, undoStack: newStack, redoStack: [] });
      showToast(`시작 위치 설정: 맵 ${mapId} (${x}, ${y})`);
    } catch {
      showToast('시작 위치 저장 실패');
    }
  },

  setVehicleStartPosition: async (vehicle: 'boat' | 'ship' | 'airship', mapId: number, x: number, y: number) => {
    const { systemData, showToast } = get();
    if (!systemData) return;
    const v = systemData[vehicle];
    if (v.startMapId === mapId && v.startX === x && v.startY === y) return;
    const updatedVehicle = { ...v, startMapId: mapId, startX: x, startY: y };
    const updated = { ...systemData, [vehicle]: updatedVehicle };
    const vehicleNames: Record<string, string> = { boat: '보트', ship: '선박', airship: '비행선' };
    try {
      await apiClient.put('/database/system', updated);
      set({ systemData: updated });
      showToast(`${vehicleNames[vehicle]} 시작 위치 설정: 맵 ${mapId} (${x}, ${y})`);
    } catch {
      showToast(`${vehicleNames[vehicle]} 시작 위치 저장 실패`);
    }
  },

  setTestStartPosition: (x: number, y: number) => {
    const { currentMap, showToast } = get();
    if (!currentMap) return;
    set({ currentMap: { ...currentMap, testStartPosition: { x, y } } });
    showToast(`테스트 시작 위치 설정: (${x}, ${y})`);
  },

  clearTestStartPosition: () => {
    const { currentMap, showToast } = get();
    if (!currentMap) return;
    const updated = { ...currentMap };
    delete updated.testStartPosition;
    set({ currentMap: updated });
    showToast('테스트 시작 위치 해제');
  },
});
