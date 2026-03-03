import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { WidgetDef, WidgetDef_Panel } from '../../store/uiEditorTypes';
import {
  GAME_W, GAME_H,
  type WidgetAbsPos,
  computeAllWidgetPositions, flattenWidgetIds,
} from './UIEditorCanvasUtils';
import { useUIEditorIframe } from './useUIEditorIframe';
import { useUIEditorWindowDrag } from './useUIEditorWindowDrag';
import { useUIEditorWidgetDrag } from './useUIEditorWidgetDrag';
import UIStatsOverlay from './UIStatsOverlay';
import UIEditorNavVisual from './UIEditorNavVisual';
import UIEditorWidgetOverlay from './UIEditorWidgetOverlay';
import UIEditorWindowOverlay from './UIEditorWindowOverlay';
import './UIEditor.css';

export default function UIEditorCanvas() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ scale: 1, left: 0, top: 0 });
  const scaleRef = useRef(1);

  const projectPath = useEditorStore((s) => s.projectPath);
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);
  const uiEditorIframeReady = useEditorStore((s) => s.uiEditorIframeReady);
  const uiEditorWindows = useEditorStore((s) => s.uiEditorWindows);
  const uiEditorSelectedWindowId = useEditorStore((s) => s.uiEditorSelectedWindowId);
  const uiEditorOverrides = useEditorStore((s) => s.uiEditorOverrides);
  const uiEditorSelectedElementType = useEditorStore((s) => s.uiEditorSelectedElementType);
  const setUiEditorIframeReady = useEditorStore((s) => s.setUiEditorIframeReady);
  const setUiEditorWindows = useEditorStore((s) => s.setUiEditorWindows);
  const setUiEditorSelectedWindowId = useEditorStore((s) => s.setUiEditorSelectedWindowId);
  const setUiEditorOverride = useEditorStore((s) => s.setUiEditorOverride);
  const setUiEditorSelectedElementType = useEditorStore((s) => s.setUiEditorSelectedElementType);
  const pushUiOverrideUndo = useEditorStore((s) => s.pushUiOverrideUndo);
  const undoUiOverride = useEditorStore((s) => s.undoUiOverride);
  const redoUiOverride = useEditorStore((s) => s.redoUiOverride);
  const undoCustomScene = useEditorStore((s) => s.undoCustomScene);
  const redoCustomScene = useEditorStore((s) => s.redoCustomScene);
  const pushCustomSceneUndo = useEditorStore((s) => s.pushCustomSceneUndo);
  const customScenes = useEditorStore((s) => s.customScenes);
  const customSceneSelectedWidget = useEditorStore((s) => s.customSceneSelectedWidget);
  const setCustomSceneSelectedWidget = useEditorStore((s) => s.setCustomSceneSelectedWidget);
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const saveCustomScenes = useEditorStore((s) => s.saveCustomScenes);
  const uiNavVisual = useEditorStore((s) => s.uiNavVisual);
  const showStats = useEditorStore((s) => s.showStats);

  // iframe communication hook
  const { statsData } = useUIEditorIframe(iframeRef);

  const customSceneId = uiEditorScene.startsWith('Scene_CS_') ? uiEditorScene.replace('Scene_CS_', '') : null;
  const customScene = customSceneId ? (customScenes.scenes[customSceneId] as any) : null;
  const widgetPositions = useMemo(() => {
    if (!customScene?.root) return new Map<string, WidgetAbsPos>();
    return computeAllWidgetPositions(customScene.root as WidgetDef_Panel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customScene?.root]);
  const widgetOrderedIds = useMemo(() => {
    if (!customScene?.root) return [] as string[];
    return flattenWidgetIds(customScene.root as WidgetDef_Panel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customScene?.root]);
  const widgetById = useMemo(() => {
    const map = new Map<string, WidgetDef>();
    function walk(w: WidgetDef) { map.set(w.id, w); (w.children || []).forEach(walk); }
    if (customScene?.root) walk(customScene.root as WidgetDef);
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customScene?.root]);

  // Layout 계산 (ResizeObserver)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const update = () => {
      const sw = wrapper.clientWidth / GAME_W;
      const sh = wrapper.clientHeight / GAME_H;
      const s = Math.min(sw, sh, 1);
      scaleRef.current = s;
      setLayout({
        scale: s,
        left: Math.max(0, (wrapper.clientWidth - GAME_W * s) / 2),
        top: Math.max(0, (wrapper.clientHeight - GAME_H * s) / 2),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  // 창 드래그/리사이즈 훅
  const { dragState: _dragState, handleWindowMouseDown, handleResizeMouseDown } = useUIEditorWindowDrag({
    iframeRef,
    scaleRef,
    setUiEditorOverride,
    setUiEditorWindows,
    setUiEditorSelectedWindowId,
    pushUiOverrideUndo,
  });

  // 위젯 드래그/리사이즈 훅
  const { widgetDragState: _widgetDragState, setWidgetDragState } = useUIEditorWidgetDrag({
    iframeRef,
    scaleRef,
    updateWidget,
    saveCustomScenes,
  });

  // Cmd+Z / Cmd+Shift+Z undo/redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) {
        const state = useEditorStore.getState();
        if (state.customScenesRedoStack.length > 0) redoCustomScene();
        else redoUiOverride();
      } else {
        const state = useEditorStore.getState();
        if (state.customScenesUndoStack.length > 0) undoCustomScene();
        else undoUiOverride();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undoUiOverride, redoUiOverride, undoCustomScene, redoCustomScene]);

  const handleRefresh = useCallback(() => {
    setUiEditorIframeReady(false);
    setUiEditorWindows([]);
    if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
  }, [setUiEditorIframeReady, setUiEditorWindows]);

  const getIframe = () =>
    (document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null)?.contentWindow ?? null;

  const handlePreviewEntrance = useCallback(() => {
    const s = useEditorStore.getState();
    const className = s.uiEditorWindows.find((w) => w.id === s.uiEditorSelectedWindowId)?.className ?? null;
    const override = className ? (s.uiEditorOverrides[className] ?? null) : null;
    getIframe()?.postMessage({ type: 'previewEntrance', className, override }, '*');
  }, []);

  const handlePreviewExit = useCallback(() => {
    const s = useEditorStore.getState();
    const className = s.uiEditorWindows.find((w) => w.id === s.uiEditorSelectedWindowId)?.className ?? null;
    const override = className ? (s.uiEditorOverrides[className] ?? null) : null;
    getIframe()?.postMessage({ type: 'previewExit', className, override }, '*');
  }, []);

  if (!projectPath) {
    return (
      <div className="ui-editor-canvas">
        <div className="ui-editor-no-project">프로젝트를 먼저 열어주세요</div>
      </div>
    );
  }

  return (
    <div className="ui-editor-canvas">
      <div className="ui-editor-canvas-toolbar">
        <span className="ui-canvas-scene-label">씬: {uiEditorScene}</span>
        <button className="ui-canvas-toolbar-btn" onClick={handleRefresh}>새로고침</button>
        <button
          className="ui-canvas-toolbar-btn ui-preview-entrance-btn"
          title="선택한 창(없으면 씬 전체)의 등장 애니메이션 재생"
          onClick={handlePreviewEntrance}
        >▶ 등장</button>
        <button
          className="ui-canvas-toolbar-btn ui-preview-exit-btn"
          title="선택한 창(없으면 씬 전체)의 퇴장 애니메이션 재생"
          onClick={handlePreviewExit}
        >◀ 퇴장</button>
      </div>

      <div ref={wrapperRef} className="ui-editor-canvas-wrapper" style={{ position: 'relative' }}>
        {showStats && <UIStatsOverlay data={statsData ?? {}} />}
        <div
          ref={containerRef}
          className="ui-editor-game-container"
          style={{
            transform: `scale(${layout.scale})`,
            transformOrigin: 'top left',
            left: layout.left,
            top: layout.top,
          }}
        >
          <iframe
            id="ui-editor-iframe"
            ref={iframeRef}
            className="ui-editor-iframe"
            src="/api/ui-editor/preview"
            title="UI 에디터 미리보기"
          />

          {/* 창 선택/드래그 오버레이 */}
          <div className="ui-overlay-container">
            {/* 커스텀 씬 위젯 오버레이 */}
            {customSceneId && (
              <UIEditorWidgetOverlay
                customSceneId={customSceneId}
                widgetOrderedIds={widgetOrderedIds}
                widgetPositions={widgetPositions}
                widgetById={widgetById}
                customSceneSelectedWidget={customSceneSelectedWidget}
                setCustomSceneSelectedWidget={setCustomSceneSelectedWidget}
                pushCustomSceneUndo={pushCustomSceneUndo}
                setWidgetDragState={setWidgetDragState}
              />
            )}
            {!customSceneId && (
              <UIEditorWindowOverlay
                uiEditorWindows={uiEditorWindows}
                uiEditorSelectedWindowId={uiEditorSelectedWindowId}
                uiEditorOverrides={uiEditorOverrides}
                uiEditorSelectedElementType={uiEditorSelectedElementType}
                handleWindowMouseDown={handleWindowMouseDown}
                handleResizeMouseDown={handleResizeMouseDown}
                setUiEditorSelectedElementType={setUiEditorSelectedElementType}
              />
            )}
          </div>

          {/* Nav Visual: 위젯 간 방향키 네비게이션 연결 화살표 */}
          {customSceneId && uiNavVisual && (
            <UIEditorNavVisual widgetById={widgetById} widgetPositions={widgetPositions} />
          )}
        </div>

        {!uiEditorIframeReady && (
          <div className="ui-editor-loading">게임 런타임 로딩 중...</div>
        )}
      </div>
    </div>
  );
}
