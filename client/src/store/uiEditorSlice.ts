import type { EditorState, SliceCreator, UIWindowInfo, UIWindowOverride } from './types';
import { TOOLBAR_STORAGE_KEY } from './types';

function saveToolbarKeys(keys: Partial<Record<string, unknown>>) {
  try {
    const raw = localStorage.getItem(TOOLBAR_STORAGE_KEY);
    const tb = raw ? JSON.parse(raw) : {};
    localStorage.setItem(TOOLBAR_STORAGE_KEY, JSON.stringify({ ...tb, ...keys }));
  } catch {}
}

/** 9-slice 정중앙 fill 좌표 자동 계산 */
function calcCenterFill(frameX: number, frameY: number, frameW: number, frameH: number, cs: number) {
  const c = Math.max(1, Math.min(Math.floor(Math.min(frameW, frameH) / 2) - 1, cs));
  return { uiSkinFillX: frameX + c, uiSkinFillY: frameY + c, uiSkinFillW: frameW - 2 * c, uiSkinFillH: frameH - 2 * c };
}

export const uiEditorSlice: SliceCreator<Pick<EditorState,
  'editorMode' | 'uiEditorScene' | 'uiEditorIframeReady' | 'uiEditorWindows' |
  'uiEditorSelectedWindowId' | 'uiEditorOverrides' | 'uiEditorDirty' |
  'uiEditSubMode' | 'uiSelectedSkin' | 'uiSelectedSkinFile' | 'uiSkinCornerSize' | 'uiSkinFrameX' | 'uiSkinFrameY' | 'uiSkinFrameW' | 'uiSkinFrameH' | 'uiSkinFillX' | 'uiSkinFillY' | 'uiSkinFillW' | 'uiSkinFillH' | 'uiSkinUseCenterFill' | 'uiSkinCursorX' | 'uiSkinCursorY' | 'uiSkinCursorW' | 'uiSkinCursorH' | 'uiSkinCursorCornerSize' | 'uiSkinCursorRenderMode' | 'uiSkinCursorBlendMode' | 'uiSkinCursorOpacity' | 'uiSkinCursorBlink' | 'uiSkinsReloadToken' | 'uiSkinUndoStack' | 'uiShowSkinLabels' | 'uiShowCheckerboard' | 'uiShowRegionOverlay' |
  'uiEditorSelectedElementType' |
  'setEditorMode' | 'setUiEditorScene' | 'setUiEditorIframeReady' | 'setUiEditorWindows' |
  'setUiEditorSelectedWindowId' | 'setUiEditorOverride' | 'resetUiEditorOverride' |
  'loadUiEditorOverrides' | 'setUiEditorDirty' |
  'setUiEditSubMode' | 'setUiSelectedSkin' | 'setUiSelectedSkinFile' | 'setUiSkinCornerSize' | 'setUiSkinFrame' | 'setUiSkinFill' | 'setUiSkinUseCenterFill' | 'setUiSkinCursor' | 'setUiSkinCursorCornerSize' | 'setUiSkinCursorRenderMode' | 'setUiSkinCursorBlendMode' | 'setUiSkinCursorOpacity' | 'setUiSkinCursorBlink' | 'triggerSkinsReload' | 'pushUiSkinUndo' | 'undoUiSkin' | 'setUiShowSkinLabels' | 'setUiShowCheckerboard' | 'setUiShowRegionOverlay' |
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
  uiSelectedSkinFile: 'Window',
  uiSkinCornerSize: 24,
  uiSkinFrameX: 96,
  uiSkinFrameY: 0,
  uiSkinFrameW: 96,
  uiSkinFrameH: 96,
  uiSkinFillX: 120,  // calcCenterFill(96,0,96,96,24) → 120,24,48,48
  uiSkinFillY: 24,
  uiSkinFillW: 48,
  uiSkinFillH: 48,
  uiSkinUseCenterFill: true,
  uiSkinCursorX: 96,
  uiSkinCursorY: 96,
  uiSkinCursorW: 48,
  uiSkinCursorH: 48,
  uiSkinCursorCornerSize: 4,
  uiSkinCursorRenderMode: 'nineSlice' as const,
  uiSkinCursorBlendMode: 'normal' as const,
  uiSkinCursorOpacity: 192,
  uiSkinCursorBlink: true,
  uiSkinsReloadToken: 0,
  uiSkinUndoStack: [],
  uiShowSkinLabels: false,
  uiShowCheckerboard: false,
  uiShowRegionOverlay: false,
  uiEditorSelectedElementType: null,

  setEditorMode: (mode) => { saveToolbarKeys({ editorMode: mode }); set({ editorMode: mode }); },
  setUiEditorScene: (scene) => set({ uiEditorScene: scene, uiEditorWindows: [], uiEditorSelectedWindowId: null, uiEditorSelectedElementType: null }),
  setUiEditorIframeReady: (ready) => set({ uiEditorIframeReady: ready }),
  setUiEditorWindows: (windows: UIWindowInfo[]) => set({ uiEditorWindows: windows }),
  setUiEditorSelectedWindowId: (id) => set({ uiEditorSelectedWindowId: id, uiEditorSelectedElementType: null }),
  setUiEditorOverride: (className, prop, value) => {
    set((state) => {
      const prev = state.uiEditorOverrides[className] || { className };
      if (value === undefined) {
        const next = { ...prev } as Record<string, unknown>;
        delete next[prop as string];
        return {
          uiEditorOverrides: {
            ...state.uiEditorOverrides,
            [className]: next as unknown as UIWindowOverride,
          },
          uiEditorDirty: true,
        };
      }
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
  setUiEditSubMode: (mode) => { saveToolbarKeys({ uiEditSubMode: mode }); set({ uiEditSubMode: mode }); },
  setUiSelectedSkin: (skin) => set({ uiSelectedSkin: skin }),
  setUiSelectedSkinFile: (file) => set({ uiSelectedSkinFile: file }),
  setUiSkinCornerSize: (size) => set((state) => ({
    uiSkinCornerSize: size,
    ...(state.uiSkinUseCenterFill
      ? calcCenterFill(state.uiSkinFrameX, state.uiSkinFrameY, state.uiSkinFrameW, state.uiSkinFrameH, size)
      : {}),
  })),
  setUiSkinFrame: (x, y, w, h) => set((state) => ({
    uiSkinFrameX: x, uiSkinFrameY: y, uiSkinFrameW: w, uiSkinFrameH: h,
    ...(state.uiSkinUseCenterFill
      ? calcCenterFill(x, y, w, h, state.uiSkinCornerSize)
      : {}),
  })),
  setUiSkinFill: (x, y, w, h) => set({ uiSkinFillX: x, uiSkinFillY: y, uiSkinFillW: w, uiSkinFillH: h }),
  setUiSkinUseCenterFill: (v) => set((state) => ({
    uiSkinUseCenterFill: v,
    ...(v ? calcCenterFill(state.uiSkinFrameX, state.uiSkinFrameY, state.uiSkinFrameW, state.uiSkinFrameH, state.uiSkinCornerSize) : {}),
  })),
  triggerSkinsReload: () => set((state) => ({ uiSkinsReloadToken: state.uiSkinsReloadToken + 1 })),
  setUiSkinCursor: (x, y, w, h) => set({ uiSkinCursorX: x, uiSkinCursorY: y, uiSkinCursorW: w, uiSkinCursorH: h }),
  setUiSkinCursorCornerSize: (size) => set({ uiSkinCursorCornerSize: size }),
  setUiSkinCursorRenderMode: (mode: 'nineSlice' | 'stretch' | 'tile') => set({ uiSkinCursorRenderMode: mode }),
  setUiSkinCursorBlendMode: (mode: 'normal' | 'add' | 'multiply' | 'screen') => set({ uiSkinCursorBlendMode: mode }),
  setUiSkinCursorOpacity: (v: number) => set({ uiSkinCursorOpacity: v }),
  setUiSkinCursorBlink: (v: boolean) => set({ uiSkinCursorBlink: v }),
  pushUiSkinUndo: () => set((state) => ({
    uiSkinUndoStack: [...state.uiSkinUndoStack, {
      frameX: state.uiSkinFrameX, frameY: state.uiSkinFrameY,
      frameW: state.uiSkinFrameW, frameH: state.uiSkinFrameH,
      fillX: state.uiSkinFillX, fillY: state.uiSkinFillY,
      fillW: state.uiSkinFillW, fillH: state.uiSkinFillH,
      cornerSize: state.uiSkinCornerSize,
      cursorX: state.uiSkinCursorX, cursorY: state.uiSkinCursorY,
      cursorW: state.uiSkinCursorW, cursorH: state.uiSkinCursorH,
      cursorCornerSize: state.uiSkinCursorCornerSize,
      cursorRenderMode: state.uiSkinCursorRenderMode,
      cursorBlendMode: state.uiSkinCursorBlendMode,
      cursorOpacity: state.uiSkinCursorOpacity,
      cursorBlink: state.uiSkinCursorBlink,
    }].slice(-50),
  })),
  undoUiSkin: () => set((state) => {
    const stack = state.uiSkinUndoStack;
    if (stack.length === 0) return {};
    const prev = stack[stack.length - 1];
    return {
      uiSkinUndoStack: stack.slice(0, -1),
      uiSkinFrameX: prev.frameX, uiSkinFrameY: prev.frameY,
      uiSkinFrameW: prev.frameW, uiSkinFrameH: prev.frameH,
      uiSkinFillX: prev.fillX, uiSkinFillY: prev.fillY,
      uiSkinFillW: prev.fillW, uiSkinFillH: prev.fillH,
      uiSkinCornerSize: prev.cornerSize,
      uiSkinCursorX: prev.cursorX, uiSkinCursorY: prev.cursorY,
      uiSkinCursorW: prev.cursorW, uiSkinCursorH: prev.cursorH,
      uiSkinCursorCornerSize: prev.cursorCornerSize,
      uiSkinCursorRenderMode: prev.cursorRenderMode ?? 'nineSlice',
      uiSkinCursorBlendMode: prev.cursorBlendMode ?? 'normal',
      uiSkinCursorOpacity: prev.cursorOpacity ?? 192,
      uiSkinCursorBlink: prev.cursorBlink ?? true,
      uiEditorDirty: true,
    };
  }),
  setUiShowSkinLabels: (show) => { saveToolbarKeys({ uiShowSkinLabels: show }); set({ uiShowSkinLabels: show }); },
  setUiShowCheckerboard: (show) => { saveToolbarKeys({ uiShowCheckerboard: show }); set({ uiShowCheckerboard: show }); },
  setUiShowRegionOverlay: (show) => { saveToolbarKeys({ uiShowRegionOverlay: show }); set({ uiShowRegionOverlay: show }); },
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
