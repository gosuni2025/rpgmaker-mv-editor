import type { EditorState, SliceCreator, UIWindowInfo, UIWindowOverride } from './types';

export const uiEditorSlice: SliceCreator<Pick<EditorState,
  'editorMode' | 'uiEditorScene' | 'uiEditorIframeReady' | 'uiEditorWindows' |
  'uiEditorSelectedWindowId' | 'uiEditorOverrides' | 'uiEditorDirty' |
  'uiEditSubMode' | 'uiSelectedSkin' | 'uiSkinCornerSize' | 'uiShowSkinLabels' |
  'uiEditorSelectedElementType' |
  'setEditorMode' | 'setUiEditorScene' | 'setUiEditorIframeReady' | 'setUiEditorWindows' |
  'setUiEditorSelectedWindowId' | 'setUiEditorOverride' | 'resetUiEditorOverride' |
  'loadUiEditorOverrides' | 'setUiEditorDirty' |
  'setUiEditSubMode' | 'setUiSelectedSkin' | 'setUiSkinCornerSize' | 'setUiShowSkinLabels' |
  'setUiEditorSelectedElementType' | 'setUiElementOverride'
>> = (set) => ({
  editorMode: 'map',
  uiEditorScene: 'Scene_Options',
  uiEditorIframeReady: false,
  uiEditorWindows: [],
  uiEditorSelectedWindowId: null,
  uiEditorOverrides: {},
  uiEditorDirty: false,
  uiEditSubMode: 'window',
  uiSelectedSkin: 'Window',
  uiSkinCornerSize: 24,
  uiShowSkinLabels: false,
  uiEditorSelectedElementType: null,

  setEditorMode: (mode) => set({ editorMode: mode }),
  setUiEditorScene: (scene) => set({ uiEditorScene: scene, uiEditorWindows: [], uiEditorSelectedWindowId: null, uiEditorSelectedElementType: null }),
  setUiEditorIframeReady: (ready) => set({ uiEditorIframeReady: ready }),
  setUiEditorWindows: (windows: UIWindowInfo[]) => set({ uiEditorWindows: windows }),
  setUiEditorSelectedWindowId: (id) => set({ uiEditorSelectedWindowId: id, uiEditorSelectedElementType: null }),
  setUiEditorOverride: (className, prop, value) => {
    set((state) => {
      const prev = state.uiEditorOverrides[className] || { className };
      return {
        uiEditorOverrides: {
          ...state.uiEditorOverrides,
          [className]: { ...prev, [prop]: value } as UIWindowOverride,
        },
        uiEditorDirty: true,
      };
    });
  },
  resetUiEditorOverride: (className) => {
    set((state) => {
      const next = { ...state.uiEditorOverrides };
      delete next[className];
      return { uiEditorOverrides: next, uiEditorDirty: true };
    });
  },
  loadUiEditorOverrides: (overrides) => set({ uiEditorOverrides: overrides, uiEditorDirty: false }),
  setUiEditorDirty: (dirty) => set({ uiEditorDirty: dirty }),
  setUiEditSubMode: (mode) => set({ uiEditSubMode: mode }),
  setUiSelectedSkin: (skin) => set({ uiSelectedSkin: skin }),
  setUiSkinCornerSize: (size) => set({ uiSkinCornerSize: size }),
  setUiShowSkinLabels: (show) => set({ uiShowSkinLabels: show }),
  setUiEditorSelectedElementType: (type) => set({ uiEditorSelectedElementType: type }),
  setUiElementOverride: (className, elementType, prop, value) => {
    set((state) => {
      const prev = state.uiEditorOverrides[className] || { className };
      const prevElems = prev.elements || {};
      const prevElem = prevElems[elementType] || {};
      return {
        uiEditorOverrides: {
          ...state.uiEditorOverrides,
          [className]: {
            ...prev,
            elements: {
              ...prevElems,
              [elementType]: { ...prevElem, [prop]: value },
            },
          } as UIWindowOverride,
        },
        uiEditorDirty: true,
      };
    });
  },
});
