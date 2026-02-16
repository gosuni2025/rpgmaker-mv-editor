import type { EditorState, SliceCreator } from './types';
import { DEFAULT_MAX_UNDO, DEFAULT_ZOOM_STEP, MIN_ZOOM, MAX_ZOOM, TOOLBAR_STORAGE_KEY } from './types';

function saveToolbarPartial(partial: Record<string, unknown>) {
  try {
    const raw = localStorage.getItem(TOOLBAR_STORAGE_KEY);
    const prev = raw ? JSON.parse(raw) : {};
    localStorage.setItem(TOOLBAR_STORAGE_KEY, JSON.stringify({ ...prev, ...partial }));
  } catch {}
}

export const uiSlice: SliceCreator<Pick<EditorState,
  'zoomLevel' | 'mode3d' | 'shadowLight' | 'disableFow' | 'paletteTab' | 'toastMessage' | 'toastPersistent' |
  'showGrid' | 'showPassability' |
  'transparentColor' | 'maxUndo' | 'zoomStep' |
  'showOpenProjectDialog' | 'showNewProjectDialog' | 'showDatabaseDialog' | 'showDeployDialog' |
  'showFindDialog' | 'showPluginManagerDialog' | 'showSoundTestDialog' | 'showEventSearchDialog' |
  'showResourceManagerDialog' | 'showCharacterGeneratorDialog' | 'showOptionsDialog' | 'showLocalizationDialog' |
  'showToast' | 'dismissToast' | 'setZoomLevel' | 'zoomIn' | 'zoomOut' | 'zoomActualSize' |
  'postProcessConfig' | 'setPostProcessConfig' | 'updatePostProcessEffect' |
  'setShowGrid' | 'setShowPassability' |
  'setMode3d' | 'setShadowLight' | 'setDisableFow' | 'setPaletteTab' |
  'setShowOpenProjectDialog' | 'setShowNewProjectDialog' | 'setShowDatabaseDialog' | 'setShowDeployDialog' |
  'setShowFindDialog' | 'setShowPluginManagerDialog' | 'setShowSoundTestDialog' | 'setShowEventSearchDialog' |
  'setShowResourceManagerDialog' | 'setShowCharacterGeneratorDialog' | 'setShowOptionsDialog' | 'setShowLocalizationDialog' |
  'setTransparentColor' | 'setMaxUndo' | 'setZoomStep'
>> = (set, get) => ({
  zoomLevel: 1,
  mode3d: false,
  shadowLight: false,
  disableFow: true,
  showGrid: true,
  showPassability: false,
  postProcessConfig: {},
  paletteTab: 'A',
  toastMessage: null,
  toastPersistent: false,
  transparentColor: { r: 255, g: 255, b: 255 },
  maxUndo: DEFAULT_MAX_UNDO,
  zoomStep: DEFAULT_ZOOM_STEP,

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
  showLocalizationDialog: false,

  showToast: (message: string, persistent?: boolean) => {
    set({ toastMessage: message, toastPersistent: !!persistent });
    if (!persistent) {
      setTimeout(() => set({ toastMessage: null, toastPersistent: false }), 2000);
    }
  },
  dismissToast: () => {
    set({ toastMessage: null, toastPersistent: false });
  },

  setZoomLevel: (level: number) => {
    set({ zoomLevel: level });
    saveToolbarPartial({ zoomLevel: level });
  },
  zoomIn: () => {
    const { zoomLevel, zoomStep } = get();
    const step = zoomStep / 100;
    const newZoom = Math.min(MAX_ZOOM, Math.round((zoomLevel + step) * 100) / 100);
    set({ zoomLevel: newZoom });
    saveToolbarPartial({ zoomLevel: newZoom });
  },
  zoomOut: () => {
    const { zoomLevel, zoomStep } = get();
    const step = zoomStep / 100;
    const newZoom = Math.max(MIN_ZOOM, Math.round((zoomLevel - step) * 100) / 100);
    set({ zoomLevel: newZoom });
    saveToolbarPartial({ zoomLevel: newZoom });
  },
  zoomActualSize: () => {
    set({ zoomLevel: 1 });
    saveToolbarPartial({ zoomLevel: 1 });
  },

  setShowGrid: (show: boolean) => {
    set({ showGrid: show });
    saveToolbarPartial({ showGrid: show });
  },
  setShowPassability: (show: boolean) => {
    set({ showPassability: show });
    saveToolbarPartial({ showPassability: show });
  },
  setMode3d: (enabled: boolean) => {
    const ConfigManager = (window as any).ConfigManager;
    if (ConfigManager) ConfigManager.mode3d = enabled;
    set({ mode3d: enabled });
    saveToolbarPartial({ mode3d: enabled });
    get().showToast(`3D ${enabled ? 'ON' : 'OFF'}`);
  },
  setShadowLight: (enabled: boolean) => {
    const ConfigManager = (window as any).ConfigManager;
    if (ConfigManager) ConfigManager.shadowLight = enabled;
    set({ shadowLight: enabled });
    saveToolbarPartial({ shadowLight: enabled });
    get().showToast(`조명 ${enabled ? 'ON' : 'OFF'}`);
  },
  setDisableFow: (disabled: boolean) => {
    set({ disableFow: disabled });
    saveToolbarPartial({ disableFow: disabled });
    get().showToast(`FOW ${disabled ? 'OFF' : 'ON'}`);
  },
  setPostProcessConfig: (config) => {
    set({ postProcessConfig: config });
    // 맵 데이터에도 반영
    const cm = get().currentMap;
    if (cm) set({ currentMap: { ...cm, postProcessConfig: config } });
  },
  updatePostProcessEffect: (effectKey, params) => {
    const prev = get().postProcessConfig;
    const prevEffect = prev[effectKey] || { enabled: false };
    const newConfig = { ...prev, [effectKey]: { ...prevEffect, ...params } };
    set({ postProcessConfig: newConfig });
    // 맵 데이터에도 반영
    const cm = get().currentMap;
    if (cm) set({ currentMap: { ...cm, postProcessConfig: newConfig } });
  },

  setPaletteTab: (tab: 'A' | 'B' | 'C' | 'D' | 'E' | 'R') => {
    set({ paletteTab: tab });
    saveToolbarPartial({ paletteTab: tab });
  },

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
  setShowLocalizationDialog: (show: boolean) => set({ showLocalizationDialog: show }),
  setTransparentColor: (color: { r: number; g: number; b: number }) => {
    set({ transparentColor: color });
  },
  setMaxUndo: (max: number) => {
    const clamped = Math.max(1, Math.min(999, max));
    set({ maxUndo: clamped });
  },
  setZoomStep: (step: number) => {
    const clamped = Math.max(1, Math.min(100, step));
    set({ zoomStep: clamped });
  },
});
