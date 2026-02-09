import apiClient from '../api/client';
import type { MapInfo, MapData, TilesetData, SystemData } from '../types/rpgMakerMV';
import type { EditorState, SliceCreator } from './types';
import { PROJECT_STORAGE_KEY, MAP_STORAGE_KEY } from './types';

export const projectSlice: SliceCreator<Pick<EditorState,
  'projectPath' | 'projectName' | 'maps' | 'currentMapId' | 'currentMap' | 'tilesetInfo' |
  'systemData' | 'playerCharacterName' | 'playerCharacterIndex' |
  'openProject' | 'closeProject' | 'restoreLastProject' | 'loadMaps' | 'selectMap' |
  'saveCurrentMap' | 'createMap' | 'deleteMap' | 'updateMapInfos' | 'setPlayerStartPosition'
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
});
