import type { EditorState, SliceCreator } from './types';
import { ZOOM_LEVELS } from './types';

const TRANSPARENT_COLOR_KEY = 'rpg-editor-transparent-color';

function loadTransparentColor(): { r: number; g: number; b: number } {
  try {
    const saved = localStorage.getItem(TRANSPARENT_COLOR_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { r: 255, g: 255, b: 255 };
}

export const uiSlice: SliceCreator<Pick<EditorState,
  'zoomLevel' | 'mode3d' | 'shadowLight' | 'depthOfField' | 'paletteTab' | 'toastMessage' |
  'transparentColor' |
  'showOpenProjectDialog' | 'showNewProjectDialog' | 'showDatabaseDialog' | 'showDeployDialog' |
  'showFindDialog' | 'showPluginManagerDialog' | 'showSoundTestDialog' | 'showEventSearchDialog' |
  'showResourceManagerDialog' | 'showCharacterGeneratorDialog' | 'showOptionsDialog' |
  'showToast' | 'setZoomLevel' | 'zoomIn' | 'zoomOut' | 'zoomActualSize' |
  'setMode3d' | 'setShadowLight' | 'setDepthOfField' | 'setPaletteTab' |
  'setShowOpenProjectDialog' | 'setShowNewProjectDialog' | 'setShowDatabaseDialog' | 'setShowDeployDialog' |
  'setShowFindDialog' | 'setShowPluginManagerDialog' | 'setShowSoundTestDialog' | 'setShowEventSearchDialog' |
  'setShowResourceManagerDialog' | 'setShowCharacterGeneratorDialog' | 'setShowOptionsDialog' |
  'setTransparentColor'
>> = (set, get) => ({
  zoomLevel: 1,
  mode3d: false,
  shadowLight: false,
  depthOfField: false,
  paletteTab: 'A',
  toastMessage: null,
  transparentColor: loadTransparentColor(),

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
  showOptionsDialog: false,

  showToast: (message: string) => {
    set({ toastMessage: message });
    setTimeout(() => set({ toastMessage: null }), 2000);
  },

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

  setPaletteTab: (tab: 'A' | 'B' | 'C' | 'D' | 'E' | 'R') => set({ paletteTab: tab }),

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
  setShowOptionsDialog: (show: boolean) => set({ showOptionsDialog: show }),
  setTransparentColor: (color: { r: number; g: number; b: number }) => {
    localStorage.setItem(TRANSPARENT_COLOR_KEY, JSON.stringify(color));
    set({ transparentColor: color });
  },
});
