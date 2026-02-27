import type { EditorState, SliceCreator, UIWindowInfo, UIWindowOverride } from './types';
import type { CustomScenesData, CustomSceneDef, CustomWindowDef, WidgetDef, NavigationConfig, CustomSceneDefV2 } from './uiEditorTypes';
import { TOOLBAR_STORAGE_KEY } from './types';
import apiClient from '../api/client';

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
  'uiEditSubMode' | 'uiSelectedSkin' | 'uiSelectedSkinFile' | 'uiSkinCornerSize' | 'uiSkinFrameX' | 'uiSkinFrameY' | 'uiSkinFrameW' | 'uiSkinFrameH' | 'uiSkinFillX' | 'uiSkinFillY' | 'uiSkinFillW' | 'uiSkinFillH' | 'uiSkinUseCenterFill' | 'uiSkinCursorX' | 'uiSkinCursorY' | 'uiSkinCursorW' | 'uiSkinCursorH' | 'uiSkinCursorCornerSize' | 'uiSkinCursorRenderMode' | 'uiSkinCursorBlendMode' | 'uiSkinCursorOpacity' | 'uiSkinCursorBlink' | 'uiSkinCursorPadding' | 'uiSkinCursorToneR' | 'uiSkinCursorToneG' | 'uiSkinCursorToneB' | 'uiSkinGaugeFile' | 'uiSkinGaugeBgX' | 'uiSkinGaugeBgY' | 'uiSkinGaugeBgW' | 'uiSkinGaugeBgH' | 'uiSkinGaugeFillX' | 'uiSkinGaugeFillY' | 'uiSkinGaugeFillW' | 'uiSkinGaugeFillH' | 'uiSkinGaugeFillDir' | 'uiSkinsReloadToken' | 'uiSkinUndoStack' | 'uiOverrideUndoStack' | 'uiOverrideRedoStack' | 'uiShowSkinLabels' | 'uiShowCheckerboard' | 'uiShowRegionOverlay' |
  'uiFontSelectedFamily' | 'uiFontDefaultFace' | 'uiFontList' | 'uiFontSceneFonts' |
  'uiEditorSelectedElementType' |
  'customScenes' | 'customSceneDirty' | 'sceneRedirects' |
  'setEditorMode' | 'setUiEditorScene' | 'setUiEditorIframeReady' | 'setUiEditorWindows' | 'setUiEditorOriginalWindows' |
  'setUiEditorSelectedWindowId' | 'setUiEditorOverride' | 'resetUiEditorOverride' |
  'loadUiEditorOverrides' | 'setUiEditorDirty' |
  'setUiEditSubMode' | 'setUiSelectedSkin' | 'setUiSelectedSkinFile' | 'setUiSkinCornerSize' | 'setUiSkinFrame' | 'setUiSkinFill' | 'setUiSkinUseCenterFill' | 'setUiSkinCursor' | 'setUiSkinCursorCornerSize' | 'setUiSkinCursorRenderMode' | 'setUiSkinCursorBlendMode' | 'setUiSkinCursorOpacity' | 'setUiSkinCursorBlink' | 'setUiSkinCursorPadding' | 'setUiSkinCursorTone' | 'setUiSkinGaugeFile' | 'setUiSkinGaugeBg' | 'setUiSkinGaugeFill' | 'setUiSkinGaugeFillDir' | 'triggerSkinsReload' | 'pushUiSkinUndo' | 'undoUiSkin' | 'setUiShowSkinLabels' | 'setUiShowCheckerboard' | 'setUiShowRegionOverlay' |
  'setUiFontSelectedFamily' | 'setUiFontDefaultFace' | 'setUiFontList' | 'setUiFontSceneFonts' |
  'setUiEditorSelectedElementType' | 'setUiElementOverride' |
  'pushUiOverrideUndo' | 'undoUiOverride' | 'redoUiOverride' |
  'customSceneSelectedWidget' | 'customScenesUndoStack' | 'customScenesRedoStack' |
  'loadCustomScenes' | 'saveCustomScenes' | 'addCustomScene' | 'removeCustomScene' | 'updateCustomScene' |
  'addCustomWindow' | 'removeCustomWindow' | 'updateCustomWindow' | 'setSceneRedirects' |
  'setCustomSceneSelectedWidget' | 'pushCustomSceneUndo' | 'undoCustomScene' | 'redoCustomScene' |
  'addWidget' | 'removeWidget' | 'updateWidget' | 'moveWidgetWithChildren' | 'reorderWidgetInTree' | 'updateNavigation' | 'updateSceneRoot'
>> = (set, get) => ({
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
  uiSkinGaugeFile: '',
  uiSkinGaugeBgX: 0,
  uiSkinGaugeBgY: 0,
  uiSkinGaugeBgW: 0,
  uiSkinGaugeBgH: 0,
  uiSkinGaugeFillX: 0,
  uiSkinGaugeFillY: 0,
  uiSkinGaugeFillW: 0,
  uiSkinGaugeFillH: 0,
  uiSkinGaugeFillDir: 'horizontal' as const,
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
  customScenes: { scenes: {} },
  customSceneDirty: false,
  customSceneSelectedWidget: null as string | null,
  sceneRedirects: {},
  customScenesUndoStack: [],
  customScenesRedoStack: [],

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
  setUiEditSubMode: (mode: 'window' | 'frame' | 'cursor' | 'gauge' | 'font') => { saveToolbarKeys({ uiEditSubMode: mode }); set({ uiEditSubMode: mode }); },
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
  setUiSkinGaugeFile: (file: string) => set({ uiSkinGaugeFile: file }),
  setUiSkinGaugeBg: (x: number, y: number, w: number, h: number) => set({ uiSkinGaugeBgX: x, uiSkinGaugeBgY: y, uiSkinGaugeBgW: w, uiSkinGaugeBgH: h }),
  setUiSkinGaugeFill: (x: number, y: number, w: number, h: number) => set({ uiSkinGaugeFillX: x, uiSkinGaugeFillY: y, uiSkinGaugeFillW: w, uiSkinGaugeFillH: h }),
  setUiSkinGaugeFillDir: (dir: 'horizontal' | 'vertical') => set({ uiSkinGaugeFillDir: dir }),
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
      gaugeFile: state.uiSkinGaugeFile,
      gaugeBgX: state.uiSkinGaugeBgX, gaugeBgY: state.uiSkinGaugeBgY,
      gaugeBgW: state.uiSkinGaugeBgW, gaugeBgH: state.uiSkinGaugeBgH,
      gaugeFillX: state.uiSkinGaugeFillX, gaugeFillY: state.uiSkinGaugeFillY,
      gaugeFillW: state.uiSkinGaugeFillW, gaugeFillH: state.uiSkinGaugeFillH,
      gaugeFillDir: state.uiSkinGaugeFillDir,
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
      uiSkinGaugeFile: prev.gaugeFile ?? '',
      uiSkinGaugeBgX: prev.gaugeBgX ?? 0, uiSkinGaugeBgY: prev.gaugeBgY ?? 0,
      uiSkinGaugeBgW: prev.gaugeBgW ?? 0, uiSkinGaugeBgH: prev.gaugeBgH ?? 0,
      uiSkinGaugeFillX: prev.gaugeFillX ?? 0, uiSkinGaugeFillY: prev.gaugeFillY ?? 0,
      uiSkinGaugeFillW: prev.gaugeFillW ?? 0, uiSkinGaugeFillH: prev.gaugeFillH ?? 0,
      uiSkinGaugeFillDir: prev.gaugeFillDir ?? 'horizontal',
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

  // ── Custom Scenes ──────────────────────────────────────
  loadCustomScenes: async () => {
    try {
      const data = await apiClient.get<CustomScenesData>('/ui-editor/scenes');
      set({ customScenes: data, customSceneDirty: false });
    } catch {
      // API가 없거나 실패 시 빈 상태 유지
    }
  },
  saveCustomScenes: async () => {
    try {
      await apiClient.put('/ui-editor/scenes', get().customScenes);
      set({ customSceneDirty: false });
    } catch {
      // ignore
    }
  },
  addCustomScene: (scene: CustomSceneDef) => {
    set((state) => ({
      customScenes: { scenes: { ...state.customScenes.scenes, [scene.id]: scene } },
      customSceneDirty: true,
    }));
  },
  removeCustomScene: (id: string) => {
    set((state) => {
      const { [id]: _, ...rest } = state.customScenes.scenes;
      return { customScenes: { scenes: rest }, customSceneDirty: true };
    });
  },
  updateCustomScene: (id: string, updates: Partial<CustomSceneDef>) => {
    set((state) => {
      const scene = state.customScenes.scenes[id];
      if (!scene) return {};
      return {
        customScenes: { scenes: { ...state.customScenes.scenes, [id]: { ...scene, ...updates } } },
        customSceneDirty: true,
      };
    });
  },
  addCustomWindow: (sceneId: string, def: CustomWindowDef) => {
    set((state) => {
      const scene = state.customScenes.scenes[sceneId];
      if (!scene) return {};
      return {
        customScenes: {
          scenes: {
            ...state.customScenes.scenes,
            [sceneId]: { ...scene, windows: [...scene.windows, def] },
          },
        },
        customSceneDirty: true,
      };
    });
  },
  removeCustomWindow: (sceneId: string, winId: string) => {
    set((state) => {
      const scene = state.customScenes.scenes[sceneId];
      if (!scene) return {};
      return {
        customScenes: {
          scenes: {
            ...state.customScenes.scenes,
            [sceneId]: { ...scene, windows: scene.windows.filter((w) => w.id !== winId) },
          },
        },
        customSceneDirty: true,
      };
    });
  },
  updateCustomWindow: (sceneId: string, winId: string, updates: Partial<CustomWindowDef>) => {
    set((state) => {
      const scene = state.customScenes.scenes[sceneId];
      if (!scene) return {};
      return {
        customScenes: {
          scenes: {
            ...state.customScenes.scenes,
            [sceneId]: {
              ...scene,
              windows: scene.windows.map((w) => w.id === winId ? { ...w, ...updates } : w),
            },
          },
        },
        customSceneDirty: true,
      };
    });
  },
  setSceneRedirects: (redirects: Record<string, string>) => set({ sceneRedirects: redirects }),

  setCustomSceneSelectedWidget: (id: string | null) => set({ customSceneSelectedWidget: id }),

  pushCustomSceneUndo: () => set((state) => ({
    customScenesUndoStack: [...state.customScenesUndoStack, state.customScenes].slice(-50),
    customScenesRedoStack: [],
  })),
  undoCustomScene: () => set((state) => {
    const stack = state.customScenesUndoStack;
    if (stack.length === 0) return {};
    const prev = stack[stack.length - 1];
    return {
      customScenesUndoStack: stack.slice(0, -1),
      customScenesRedoStack: [...state.customScenesRedoStack, state.customScenes].slice(-50),
      customScenes: prev,
      customSceneDirty: true,
    };
  }),
  redoCustomScene: () => set((state) => {
    const stack = state.customScenesRedoStack;
    if (stack.length === 0) return {};
    const next = stack[stack.length - 1];
    return {
      customScenesRedoStack: stack.slice(0, -1),
      customScenesUndoStack: [...state.customScenesUndoStack, state.customScenes].slice(-50),
      customScenes: next,
      customSceneDirty: true,
    };
  }),

  updateSceneRoot: (sceneId: string, root: WidgetDef) => {
    set((state) => {
      const scene = state.customScenes.scenes[sceneId];
      if (!scene) return {};
      return {
        customScenes: {
          scenes: {
            ...state.customScenes.scenes,
            [sceneId]: { ...scene, root, formatVersion: 2 } as CustomSceneDefV2 as any,
          },
        },
        customSceneDirty: true,
      };
    });
  },

  updateNavigation: (sceneId: string, nav: Partial<NavigationConfig>) => {
    set((state) => {
      const scene = state.customScenes.scenes[sceneId] as CustomSceneDefV2;
      if (!scene) return {};
      return {
        customScenes: {
          scenes: {
            ...state.customScenes.scenes,
            [sceneId]: { ...scene, navigation: { ...(scene.navigation || {}), ...nav }, formatVersion: 2 } as any,
          },
        },
        customSceneDirty: true,
      };
    });
  },

  addWidget: (sceneId: string, parentId: string, def: WidgetDef) => {
    set((state) => {
      const scene = state.customScenes.scenes[sceneId] as CustomSceneDefV2;
      if (!scene || !scene.root) return {};

      function addToParent(widget: WidgetDef): WidgetDef {
        if (widget.id === parentId) {
          return { ...widget, children: [...(widget.children || []), def] };
        }
        if (!widget.children?.length) return widget;
        return { ...widget, children: widget.children.map(addToParent) };
      }

      return {
        customScenes: {
          scenes: {
            ...state.customScenes.scenes,
            [sceneId]: { ...scene, root: addToParent(scene.root) } as any,
          },
        },
        customSceneDirty: true,
      };
    });
  },

  removeWidget: (sceneId: string, widgetId: string) => {
    set((state) => {
      const scene = state.customScenes.scenes[sceneId] as CustomSceneDefV2;
      if (!scene || !scene.root) return {};

      function removeFromTree(widget: WidgetDef): WidgetDef | null {
        if (widget.id === widgetId) return null;
        if (!widget.children?.length) return widget;
        return { ...widget, children: widget.children.map(removeFromTree).filter(Boolean) as WidgetDef[] };
      }

      const newRoot = removeFromTree(scene.root);
      if (!newRoot) return {};

      return {
        customScenes: {
          scenes: { ...state.customScenes.scenes, [sceneId]: { ...scene, root: newRoot } as any },
        },
        customSceneDirty: true,
      };
    });
  },

  updateWidget: (sceneId: string, widgetId: string, updates: Partial<WidgetDef>) => {
    set((state) => {
      const scene = state.customScenes.scenes[sceneId] as CustomSceneDefV2;
      if (!scene || !scene.root) return {};

      function updateInTree(widget: WidgetDef): WidgetDef {
        if (widget.id === widgetId) return { ...widget, ...updates } as WidgetDef;
        if (!widget.children?.length) return widget;
        return { ...widget, children: widget.children.map(updateInTree) };
      }

      return {
        customScenes: {
          scenes: { ...state.customScenes.scenes, [sceneId]: { ...scene, root: updateInTree(scene.root) } as any },
        },
        customSceneDirty: true,
      };
    });
  },

  moveWidgetWithChildren: (sceneId: string, widgetId: string, x: number, y: number) => {
    set((state) => {
      const scene = state.customScenes.scenes[sceneId] as CustomSceneDefV2;
      if (!scene || !scene.root) return {};

      // 자식들은 절대 좌표 → delta만큼 함께 이동
      function applyDelta(widget: WidgetDef, dx: number, dy: number): WidgetDef {
        const moved = { ...widget, x: widget.x + dx, y: widget.y + dy };
        if (!moved.children?.length) return moved;
        return { ...moved, children: moved.children.map(c => applyDelta(c, dx, dy)) };
      }

      function moveInTree(widget: WidgetDef): WidgetDef {
        if (widget.id === widgetId) return applyDelta(widget, x - widget.x, y - widget.y);
        if (!widget.children?.length) return widget;
        return { ...widget, children: widget.children.map(moveInTree) };
      }

      return {
        customScenes: {
          scenes: { ...state.customScenes.scenes, [sceneId]: { ...scene, root: moveInTree(scene.root) } as any },
        },
        customSceneDirty: true,
      };
    });
  },

  reorderWidgetInTree: (sceneId: string, dragId: string, targetId: string, position: 'before' | 'inside') => {
    console.log('[reorderWidgetInTree]', { dragId, targetId, position });
    set((state) => {
      const scene = state.customScenes.scenes[sceneId] as CustomSceneDefV2;
      if (!scene || !scene.root) { console.log('[reorderWidgetInTree] no scene/root'); return {}; }

      // 1. dragId 위젯을 트리에서 추출
      let dragged: WidgetDef | null = null;
      function extract(widget: WidgetDef): WidgetDef {
        if (!widget.children?.length) return widget;
        const idx = widget.children.findIndex((c) => c.id === dragId);
        if (idx >= 0) {
          dragged = widget.children[idx];
          return { ...widget, children: widget.children.filter((_, i) => i !== idx) };
        }
        return { ...widget, children: widget.children.map(extract) };
      }
      const rootAfterExtract = extract(scene.root);
      console.log('[reorderWidgetInTree] extracted:', dragged ? (dragged as WidgetDef).id : 'null (not found)');
      if (!dragged) return {};

      // 2. targetId 위치에 삽입
      let inserted = false;
      function insert(widget: WidgetDef): WidgetDef {
        const ch = widget.children || [];
        if (position === 'inside' && widget.id === targetId) {
          inserted = true;
          return { ...widget, children: [...ch, dragged!] };
        }
        const idx = ch.findIndex((c) => c.id === targetId);
        if (idx >= 0 && position === 'before') {
          inserted = true;
          const next = [...ch];
          next.splice(idx, 0, dragged!);
          return { ...widget, children: next };
        }
        if (!ch.length) return widget;
        return { ...widget, children: ch.map(insert) };
      }
      const newRoot = insert(rootAfterExtract);
      console.log('[reorderWidgetInTree] inserted:', inserted, '| root children:', newRoot.children?.map((c: WidgetDef) => c.id));

      return {
        customScenes: {
          scenes: {
            ...state.customScenes.scenes,
            [sceneId]: { ...scene, root: newRoot } as any,
          },
        },
        customSceneDirty: true,
      };
    });
  },
});
