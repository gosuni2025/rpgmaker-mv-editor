import type { EditorState, SliceCreator, UIWindowInfo, UIWindowOverride } from './types';
import { TOOLBAR_STORAGE_KEY } from './types';

/** undo/redo 후 iframe에 전체 override 상태를 재적용 (씬 새로고침으로 처리) */
function _syncOverridesToIframe(overrides: Record<string, UIWindowOverride>) {
  const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
  if (!iframe?.contentWindow) return;
  // clearRuntimeOverride로 전체 초기화 후 applyOverride로 재적용
  iframe.contentWindow.postMessage({ type: 'clearAllRuntimeOverrides' }, '*');
  Object.values(overrides).forEach((ov) => {
    Object.entries(ov).forEach(([prop, value]) => {
      if (prop === 'className') return;
      iframe.contentWindow!.postMessage(
        { type: 'applyOverride', className: ov.className, prop, value }, '*'
      );
    });
  });
}

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
  'editorMode' | 'uiEditorScene' | 'uiEditorIframeReady' | 'uiEditorWindows' | 'uiEditorOriginalWindows' |
  'uiEditorSelectedWindowId' | 'uiEditorOverrides' | 'uiEditorDirty' |
  'uiEditSubMode' | 'uiSelectedSkin' | 'uiSelectedSkinFile' | 'uiSkinCornerSize' | 'uiSkinFrameX' | 'uiSkinFrameY' | 'uiSkinFrameW' | 'uiSkinFrameH' | 'uiSkinFillX' | 'uiSkinFillY' | 'uiSkinFillW' | 'uiSkinFillH' | 'uiSkinUseCenterFill' | 'uiSkinCursorX' | 'uiSkinCursorY' | 'uiSkinCursorW' | 'uiSkinCursorH' | 'uiSkinCursorCornerSize' | 'uiSkinCursorRenderMode' | 'uiSkinCursorBlendMode' | 'uiSkinCursorOpacity' | 'uiSkinCursorBlink' | 'uiSkinCursorPadding' | 'uiSkinCursorToneR' | 'uiSkinCursorToneG' | 'uiSkinCursorToneB' | 'uiSkinsReloadToken' | 'uiSkinUndoStack' | 'uiOverrideUndoStack' | 'uiOverrideRedoStack' | 'uiShowSkinLabels' | 'uiShowCheckerboard' | 'uiShowRegionOverlay' |
  'uiFontSelectedFamily' | 'uiFontDefaultFace' | 'uiFontList' | 'uiFontSceneFonts' |
  'uiEditorSelectedElementType' |
  'setEditorMode' | 'setUiEditorScene' | 'setUiEditorIframeReady' | 'setUiEditorWindows' | 'setUiEditorOriginalWindows' |
  'setUiEditorSelectedWindowId' | 'setUiEditorOverride' | 'resetUiEditorOverride' |
  'loadUiEditorOverrides' | 'setUiEditorDirty' |
  'setUiEditSubMode' | 'setUiSelectedSkin' | 'setUiSelectedSkinFile' | 'setUiSkinCornerSize' | 'setUiSkinFrame' | 'setUiSkinFill' | 'setUiSkinUseCenterFill' | 'setUiSkinCursor' | 'setUiSkinCursorCornerSize' | 'setUiSkinCursorRenderMode' | 'setUiSkinCursorBlendMode' | 'setUiSkinCursorOpacity' | 'setUiSkinCursorBlink' | 'setUiSkinCursorPadding' | 'setUiSkinCursorTone' | 'triggerSkinsReload' | 'pushUiSkinUndo' | 'undoUiSkin' | 'setUiShowSkinLabels' | 'setUiShowCheckerboard' | 'setUiShowRegionOverlay' |
  'setUiFontSelectedFamily' | 'setUiFontDefaultFace' | 'setUiFontList' | 'setUiFontSceneFonts' |
  'setUiEditorSelectedElementType' | 'setUiElementOverride' |
  'pushUiOverrideUndo' | 'undoUiOverride' | 'redoUiOverride'
>> = (set) => ({
  editorMode: 'map',
  uiEditorScene: 'Scene_Options',
  uiEditorIframeReady: false,
  uiEditorWindows: [],
  uiEditorOriginalWindows: [],
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
  uiSkinCursorPadding: 2,
  uiSkinCursorToneR: 0,
  uiSkinCursorToneG: 0,
  uiSkinCursorToneB: 0,
  uiSkinsReloadToken: 0,
  uiSkinUndoStack: [],
  uiOverrideUndoStack: [],
  uiOverrideRedoStack: [],
  uiShowSkinLabels: false,
  uiShowCheckerboard: false,
  uiShowRegionOverlay: false,
  uiFontSelectedFamily: 'GameFont',
  uiFontDefaultFace: '',
  uiFontList: [],
  uiFontSceneFonts: {},
  uiEditorSelectedElementType: null,

  setEditorMode: (mode) => { saveToolbarKeys({ editorMode: mode }); set({ editorMode: mode }); },
  setUiEditorScene: (scene) => set({ uiEditorScene: scene, uiEditorWindows: [], uiEditorOriginalWindows: [], uiEditorSelectedWindowId: null, uiEditorSelectedElementType: null }),
  setUiEditorIframeReady: (ready) => set({ uiEditorIframeReady: ready }),
  setUiEditorWindows: (windows: UIWindowInfo[]) => set({ uiEditorWindows: windows }),
  setUiEditorOriginalWindows: (windows: UIWindowInfo[]) => set({ uiEditorOriginalWindows: windows }),
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
  setUiEditSubMode: (mode: 'window' | 'frame' | 'cursor' | 'font') => { saveToolbarKeys({ uiEditSubMode: mode }); set({ uiEditSubMode: mode }); },
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
  setUiSkinCursorPadding: (v: number) => set({ uiSkinCursorPadding: v }),
  setUiSkinCursorTone: (r: number, g: number, b: number) => set({ uiSkinCursorToneR: r, uiSkinCursorToneG: g, uiSkinCursorToneB: b }),
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
      cursorPadding: state.uiSkinCursorPadding,
      cursorToneR: state.uiSkinCursorToneR,
      cursorToneG: state.uiSkinCursorToneG,
      cursorToneB: state.uiSkinCursorToneB,
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
      uiSkinCursorPadding: prev.cursorPadding ?? 2,
      uiSkinCursorToneR: prev.cursorToneR ?? 0,
      uiSkinCursorToneG: prev.cursorToneG ?? 0,
      uiSkinCursorToneB: prev.cursorToneB ?? 0,
      uiEditorDirty: true,
    };
  }),
  pushUiOverrideUndo: () => set((state) => ({
    uiOverrideUndoStack: [...state.uiOverrideUndoStack, state.uiEditorOverrides].slice(-50),
    uiOverrideRedoStack: [],
  })),
  undoUiOverride: () => {
    set((state) => {
      const stack = state.uiOverrideUndoStack;
      if (stack.length === 0) return {};
      const prev = stack[stack.length - 1];
      _syncOverridesToIframe(prev);
      return {
        uiOverrideUndoStack: stack.slice(0, -1),
        uiOverrideRedoStack: [...state.uiOverrideRedoStack, state.uiEditorOverrides].slice(-50),
        uiEditorOverrides: prev,
        uiEditorDirty: true,
      };
    });
  },
  redoUiOverride: () => {
    set((state) => {
      const stack = state.uiOverrideRedoStack;
      if (stack.length === 0) return {};
      const next = stack[stack.length - 1];
      _syncOverridesToIframe(next);
      return {
        uiOverrideRedoStack: stack.slice(0, -1),
        uiOverrideUndoStack: [...state.uiOverrideUndoStack, state.uiEditorOverrides].slice(-50),
        uiEditorOverrides: next,
        uiEditorDirty: true,
      };
    });
  },
  setUiShowSkinLabels: (show) => { saveToolbarKeys({ uiShowSkinLabels: show }); set({ uiShowSkinLabels: show }); },
  setUiShowCheckerboard: (show) => { saveToolbarKeys({ uiShowCheckerboard: show }); set({ uiShowCheckerboard: show }); },
  setUiShowRegionOverlay: (show) => { saveToolbarKeys({ uiShowRegionOverlay: show }); set({ uiShowRegionOverlay: show }); },
  setUiFontSelectedFamily: (family) => set({ uiFontSelectedFamily: family }),
  setUiFontDefaultFace: (face) => set({ uiFontDefaultFace: face }),
  setUiFontList: (list) => set({ uiFontList: list }),
  setUiFontSceneFonts: (sceneFonts) => set({ uiFontSceneFonts: sceneFonts }),
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
