import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import apiClient from '../../api/client';
import useEditorStore from '../../store/useEditorStore';
import type { UIWindowInfo, UIWindowOverride } from '../../store/types';
import type { WidgetDef, WidgetDef_Panel } from '../../store/uiEditorTypes';
import {
  GAME_W, GAME_H, RESIZE_HANDLES,
  type HandleDir, type DragState, type WidgetAbsPos, type WidgetDragState,
  computeAllWidgetPositions, flattenWidgetIds, computeUpdates,
} from './UIEditorCanvasUtils';
import './UIEditor.css';

function fmtNum(n: number | null) {
  if (n == null) return '-';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function UIStatsOverlay({ data }: { data: Record<string, number | string | null> }) {
  return (
    <div style={{
      position: 'absolute', top: 8, right: 8, zIndex: 9999,
      background: 'rgba(0,0,0,0.82)', color: '#0f0',
      fontFamily: 'monospace', fontSize: 11,
      padding: '6px 10px', borderRadius: 4, border: '1px solid #2a2a2a',
      pointerEvents: 'none', lineHeight: 1.7, minWidth: 110, userSelect: 'none',
    }}>
      <div><span style={{ color: '#ff4' }}>FPS</span>{'  '}<span style={{ color: '#fff' }}>{data.fps ?? '-'}</span></div>
      <div><span style={{ color: '#888' }}>Rndr</span> <span style={{ color: '#ccc' }}>{data.renderer ?? '-'}</span></div>
      <div style={{ borderTop: '1px solid #333', marginTop: 3, paddingTop: 3 }}>
        <span style={{ color: '#4cf' }}>DC</span>{'   '}<span style={{ color: '#fff' }}>{fmtNum(data.dc as number)}</span>
      </div>
      <div><span style={{ color: '#4cf' }}>Tri</span>{'  '}<span style={{ color: '#fff' }}>{fmtNum(data.tri as number)}</span></div>
      <div><span style={{ color: '#4cf' }}>Tex</span>{'  '}<span style={{ color: '#fff' }}>{fmtNum(data.tex as number)}</span></div>
      <div><span style={{ color: '#4cf' }}>Geo</span>{'  '}<span style={{ color: '#fff' }}>{fmtNum(data.geo as number)}</span></div>
      <div><span style={{ color: '#4cf' }}>Prg</span>{'  '}<span style={{ color: '#fff' }}>{fmtNum(data.prg as number)}</span></div>
      {data.mem != null && (
        <div style={{ borderTop: '1px solid #333', marginTop: 3, paddingTop: 3 }}>
          <span style={{ color: '#fa6' }}>Mem</span>{'  '}<span style={{ color: '#fff' }}>{data.mem}MB</span>
        </div>
      )}
    </div>
  );
}

export default function UIEditorCanvas() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ scale: 1, left: 0, top: 0 });
  const scaleRef = useRef(1);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const projectPath = useEditorStore((s) => s.projectPath);
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);
  const uiEditorIframeReady = useEditorStore((s) => s.uiEditorIframeReady);
  const uiSkinsReloadToken = useEditorStore((s) => s.uiSkinsReloadToken);
  const uiEditorWindows = useEditorStore((s) => s.uiEditorWindows);
  const uiEditorSelectedWindowId = useEditorStore((s) => s.uiEditorSelectedWindowId);
  const uiEditorOverrides = useEditorStore((s) => s.uiEditorOverrides);
  const uiEditorSelectedElementType = useEditorStore((s) => s.uiEditorSelectedElementType);
  const setUiEditorIframeReady = useEditorStore((s) => s.setUiEditorIframeReady);
  const setUiEditorWindows = useEditorStore((s) => s.setUiEditorWindows);
  const setUiEditorSelectedWindowId = useEditorStore((s) => s.setUiEditorSelectedWindowId);
  const setUiEditorOverride = useEditorStore((s) => s.setUiEditorOverride);
  const loadUiEditorOverrides = useEditorStore((s) => s.loadUiEditorOverrides);
  const sceneRedirects = useEditorStore((s) => s.sceneRedirects);
  const setSceneRedirects = useEditorStore((s) => s.setSceneRedirects);
  const uiEditorConfigLoaded = useEditorStore((s) => s.uiEditorConfigLoaded);
  const setUiEditorConfigLoaded = useEditorStore((s) => s.setUiEditorConfigLoaded);
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
  const loadCustomScenes = useEditorStore((s) => s.loadCustomScenes);
  const uiNavVisual = useEditorStore((s) => s.uiNavVisual);
  const showStats = useEditorStore((s) => s.showStats);

  const [widgetDragState, setWidgetDragState] = useState<WidgetDragState | null>(null);
  const [statsData, setStatsData] = useState<Record<string, number | string | null> | null>(null);

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

  // Stats: showStats 변경 시 iframe 내 RendererStatsPanel에 postMessage로 토글 전달
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'setStats', show: showStats }, '*');
  }, [showStats, uiEditorIframeReady]);

  // 저장된 config 로드
  useEffect(() => {
    if (!projectPath) return;
    setUiEditorConfigLoaded(false);
    if (Object.keys(useEditorStore.getState().uiEditorOverrides).length > 0) {
      // 이미 오버라이드가 로드된 상태 → config도 로드된 것으로 간주
      setUiEditorConfigLoaded(true);
      return;
    }
    apiClient.get<{ overrides?: Record<string, UIWindowOverride>; sceneRedirects?: Record<string, string> }>('/ui-editor/config')
      .then((data) => {
        if (data.overrides && Object.keys(data.overrides).length > 0) {
          loadUiEditorOverrides(data.overrides);
        }
        if (data.sceneRedirects) {
          setSceneRedirects(data.sceneRedirects);
        }
        setUiEditorConfigLoaded(true);
      })
      .catch(() => { setUiEditorConfigLoaded(true); });
  }, [projectPath, loadUiEditorOverrides, setSceneRedirects, setUiEditorConfigLoaded]);

  // postMessage 수신
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const { type } = e.data ?? {};
      if (type === 'bridgeReady') {
        setUiEditorIframeReady(true);
      } else if (type === 'sceneReady') {
        const wins: UIWindowInfo[] = e.data.windows ?? [];
        setUiEditorWindows(wins);
        // originalX/Y/W/H는 UITheme.js가 applyLayout 전 저장한 진짜 RMMV 원본값
        useEditorStore.getState().setUiEditorOriginalWindows(
          wins.map((w) => ({
            ...w,
            x: w.originalX ?? w.x, y: w.originalY ?? w.y,
            width: w.originalWidth ?? w.width, height: w.originalHeight ?? w.height,
          }))
        );
        // 씬 로드 후 저장된 오버라이드를 iframe에 적용
        // rotation 계열 먼저 적용 → pivot이 설정된 후 x, y가 계산되어야 위치 오류 없음
        const ROTATION_FIRST = ['rotationX', 'rotationY', 'rotationZ', 'animPivot', 'renderCamera'];
        const overrides = useEditorStore.getState().uiEditorOverrides;
        Object.values(overrides).forEach((ov) => {
          const entries = Object.entries(ov).filter(([p]) => p !== 'className');
          const sorted = [
            ...entries.filter(([p]) => ROTATION_FIRST.includes(p)),
            ...entries.filter(([p]) => !ROTATION_FIRST.includes(p)),
          ];
          sorted.forEach(([prop, value]) => {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'applyOverride', className: ov.className, prop, value }, '*'
            );
          });
        });
      } else if (type === 'windowUpdated') {
        setUiEditorWindows(e.data.windows ?? []);
      } else if (type === 'windowClicked') {
        setUiEditorSelectedWindowId(e.data.windowId ?? null);
      } else if (type === 'sceneDefUpdated') {
        // 엔진이 nativeDefault 위치를 서버에 저장했으므로 씬 재로드
        useEditorStore.getState().loadCustomScenes();
      } else if (type === 'statsUpdate') {
        setStatsData(e.data.data ?? null);
      } else if (type === 'cmdSave') {
        const s = useEditorStore.getState();
        apiClient.put('/ui-editor/config', { overrides: s.uiEditorOverrides, sceneRedirects: s.sceneRedirects })
        .then(() => {
          s.setUiEditorDirty(false);
          s.showToast('UI 테마 저장 완료');
        }).catch(() => s.showToast('저장 실패', true));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setUiEditorIframeReady, setUiEditorWindows, setUiEditorSelectedWindowId]);

  // iframe ready 후 씬 로드 (sceneRedirects 포함 — API 로드 후 redirect 후킹이 올바르게 복원되도록)
  useEffect(() => {
    if (!uiEditorIframeReady) return;
    if (!uiEditorConfigLoaded) return; // config 로드 완료 전엔 씬 로드 대기
    const currentRedirect = sceneRedirects[uiEditorScene];
    const hasCustomRedirect = currentRedirect?.startsWith('Scene_CS_');
    // 커스텀 씬이거나, 현재 씬이 커스텀 씬으로 리다이렉트된 경우 reloadCustomScenes 먼저 전송
    if (uiEditorScene.startsWith('Scene_CS_') || hasCustomRedirect) {
      iframeRef.current?.contentWindow?.postMessage({ type: 'reloadCustomScenes' }, '*');
    }
    // 저장된 리다이렉트 재적용 (씬 전환 시 초기화되므로)
    // 현재 씬의 리다이렉트가 커스텀 씬이면 포함 (커스텀 씬으로 교체된 씬은 커스텀 씬을 프리뷰)
    // 원본 씬 편집 중이거나 비커스텀 리다이렉트인 경우 현재 씬 리다이렉트 제외
    const previewRedirects = hasCustomRedirect
      ? sceneRedirects
      : Object.fromEntries(Object.entries(sceneRedirects).filter(([k]) => k !== uiEditorScene));
    iframeRef.current?.contentWindow?.postMessage({ type: 'updateSceneRedirects', redirects: previewRedirects }, '*');
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'loadScene', sceneName: uiEditorScene }, '*'
    );
  }, [uiEditorIframeReady, uiEditorScene, sceneRedirects, uiEditorConfigLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // 스킨 데이터 변경(기본 스킨 변경 등) 시 씬 재로드
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!uiEditorIframeReady) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'loadScene', sceneName: uiEditorScene }, '*'
    );
  }, [uiSkinsReloadToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // 드래그 중 커서 스타일 + iframe pointer-events 비활성화
  useEffect(() => {
    if (!dragState) return;
    const cursor = dragState.handleDir === 'move' ? 'grabbing' : `${dragState.handleDir}-resize`;
    document.body.style.cursor = cursor;
    if (iframeRef.current) iframeRef.current.style.pointerEvents = 'none';
    return () => {
      document.body.style.cursor = '';
      if (iframeRef.current) iframeRef.current.style.pointerEvents = '';
    };
  }, [dragState]);

  // 드래그/리사이즈 마우스 이벤트
  useEffect(() => {
    if (!dragState) return;
    const onMouseMove = (e: MouseEvent) => {
      const s = scaleRef.current;
      const dx = (e.clientX - dragState.startClientX) / s;
      const dy = (e.clientY - dragState.startClientY) / s;
      const updates = computeUpdates(dragState.handleDir, dx, dy, dragState.startWin);
      const iframe = iframeRef.current?.contentWindow;
      for (const [prop, value] of Object.entries(updates) as ['x' | 'y' | 'width' | 'height', number][]) {
        setUiEditorOverride(dragState.className, prop, value);
        iframe?.postMessage(
          { type: 'updateWindowProp', windowId: dragState.windowId, prop, value }, '*'
        );
      }
      // 오버레이 즉시 업데이트 (iframe windowUpdated round-trip 대기 없이)
      setUiEditorWindows(
        useEditorStore.getState().uiEditorWindows.map((w) =>
          w.id === dragState.windowId ? { ...w, ...updates } : w
        )
      );
    };
    const onMouseUp = () => setDragState(null);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragState, setUiEditorOverride]);

  // 위젯 드래그/리사이즈 effect
  useEffect(() => {
    if (!widgetDragState) return;
    const cursor = widgetDragState.handleDir === 'move' ? 'grabbing' : `${widgetDragState.handleDir}-resize`;
    document.body.style.cursor = cursor;
    if (iframeRef.current) iframeRef.current.style.pointerEvents = 'none';
    const onMove = (e: MouseEvent) => {
      const s = scaleRef.current;
      const dx = (e.clientX - widgetDragState.startClientX) / s;
      const dy = (e.clientY - widgetDragState.startClientY) / s;
      let upd: any;
      if (widgetDragState.handleDir === 'move') {
        upd = { x: Math.round(widgetDragState.startRelX + dx), y: Math.round(widgetDragState.startRelY + dy) };
      } else {
        const ax = widgetDragState.parentInnerAbsX + widgetDragState.startRelX;
        const ay = widgetDragState.parentInnerAbsY + widgetDragState.startRelY;
        const ab = computeUpdates(widgetDragState.handleDir, dx, dy, { x: ax, y: ay, width: widgetDragState.startWidth, height: widgetDragState.startHeight });
        upd = {};
        if (ab.x !== undefined) upd.x = Math.round(ab.x - widgetDragState.parentInnerAbsX);
        if (ab.y !== undefined) upd.y = Math.round(ab.y - widgetDragState.parentInnerAbsY);
        if (ab.width !== undefined) upd.width = ab.width;
        if (ab.height !== undefined) upd.height = ab.height;
      }
      updateWidget(widgetDragState.sceneId, widgetDragState.widgetId, upd);
    };
    const onUp = () => {
      setWidgetDragState(null);
      saveCustomScenes().then(() => {
        const sn = useEditorStore.getState().uiEditorScene;
        iframeRef.current?.contentWindow?.postMessage({ type: 'reloadCustomScenes' }, '*');
        iframeRef.current?.contentWindow?.postMessage({ type: 'loadScene', sceneName: sn }, '*');
      });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.body.style.cursor = '';
      if (iframeRef.current) iframeRef.current.style.pointerEvents = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [widgetDragState, updateWidget, saveCustomScenes]);

  const handleWindowMouseDown = useCallback((e: React.MouseEvent, win: UIWindowInfo) => {
    e.stopPropagation();
    e.preventDefault();
    // undo 복원을 위해 현재 위치를 override에 미리 기록 (없을 때만)
    const curOv = useEditorStore.getState().uiEditorOverrides[win.className] ?? {};
    if (curOv.x === undefined) setUiEditorOverride(win.className, 'x', win.x);
    if (curOv.y === undefined) setUiEditorOverride(win.className, 'y', win.y);
    pushUiOverrideUndo();
    setUiEditorSelectedWindowId(win.id);
    setDragState({
      windowId: win.id,
      className: win.className,
      handleDir: 'move',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWin: { x: win.x, y: win.y, width: win.width, height: win.height },
    });
  }, [setUiEditorSelectedWindowId, setUiEditorOverride, pushUiOverrideUndo]);

  const handleResizeMouseDown = useCallback((
    e: React.MouseEvent, win: UIWindowInfo, dir: HandleDir
  ) => {
    e.stopPropagation();
    e.preventDefault();
    // undo 복원을 위해 현재 위치/크기를 override에 미리 기록 (없을 때만)
    const curOv = useEditorStore.getState().uiEditorOverrides[win.className] ?? {};
    if (curOv.x === undefined) setUiEditorOverride(win.className, 'x', win.x);
    if (curOv.y === undefined) setUiEditorOverride(win.className, 'y', win.y);
    if (curOv.width === undefined) setUiEditorOverride(win.className, 'width', win.width);
    if (curOv.height === undefined) setUiEditorOverride(win.className, 'height', win.height);
    pushUiOverrideUndo();
    setDragState({
      windowId: win.id,
      className: win.className,
      handleDir: dir,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWin: { x: win.x, y: win.y, width: win.width, height: win.height },
    });
  }, [setUiEditorOverride, pushUiOverrideUndo]);

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
            {customSceneId && (() => {
              // 선택된 위젯을 마지막에 렌더링 → DOM 상단에 위치, 리사이즈 핸들 가시 + 클릭 우선처리
              const ids = widgetOrderedIds.filter(id => id !== 'root');
              const sortedIds = customSceneSelectedWidget
                ? [...ids.filter(id => id !== customSceneSelectedWidget), customSceneSelectedWidget]
                : ids;
              return sortedIds.map(id => {
                const pos = widgetPositions.get(id);
                if (!pos) return null;
                if (widgetById.get(id)?.previewSelectable === false) return null;
                const isSel = id === customSceneSelectedWidget;
                return (
                  <div
                    key={id}
                    className={`ui-overlay-widget${isSel ? ' selected' : ''}`}
                    style={{ left: pos.absX, top: pos.absY, width: pos.width, height: pos.height }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setCustomSceneSelectedWidget(id);
                      pushCustomSceneUndo();
                      setWidgetDragState({
                        sceneId: customSceneId,
                        widgetId: id,
                        handleDir: 'move',
                        startClientX: e.clientX,
                        startClientY: e.clientY,
                        startRelX: pos.absX - pos.parentInnerAbsX,
                        startRelY: pos.absY - pos.parentInnerAbsY,
                        startWidth: pos.width,
                        startHeight: pos.height,
                        parentInnerAbsX: pos.parentInnerAbsX,
                        parentInnerAbsY: pos.parentInnerAbsY,
                      });
                    }}
                  >
                    {isSel && <div className="ui-overlay-label">{id}</div>}
                    {isSel && RESIZE_HANDLES.map(dir => (
                      <div
                        key={dir}
                        className={`ui-resize-handle handle-${dir}`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          pushCustomSceneUndo();
                          setWidgetDragState({
                            sceneId: customSceneId,
                            widgetId: id,
                            handleDir: dir,
                            startClientX: e.clientX,
                            startClientY: e.clientY,
                            startRelX: pos.absX - pos.parentInnerAbsX,
                            startRelY: pos.absY - pos.parentInnerAbsY,
                            startWidth: pos.width,
                            startHeight: pos.height,
                            parentInnerAbsX: pos.parentInnerAbsX,
                            parentInnerAbsY: pos.parentInnerAbsY,
                          });
                        }}
                      />
                    ))}
                  </div>
                );
              });
            })()}
            {!customSceneId && uiEditorWindows.map((win) => {
              const isSelected = win.id === uiEditorSelectedWindowId;
              const windowOverride = uiEditorOverrides[win.className];
              const padding = win.padding ?? 18;
              const elements = win.elements ?? [];

              return (
                <div
                  key={win.id}
                  className={`ui-overlay-window${isSelected ? ' selected' : ''}`}
                  style={{ left: win.x, top: win.y, width: win.width, height: win.height }}
                  title={win.className}
                  onMouseDown={(e) => handleWindowMouseDown(e, win)}
                >
                  {isSelected && (
                    <div className="ui-overlay-label">
                      {win.className.replace(/^Window_/, '')}
                    </div>
                  )}
                  {isSelected && RESIZE_HANDLES.map((dir) => (
                    <div
                      key={dir}
                      className={`ui-resize-handle handle-${dir}`}
                      onMouseDown={(e) => handleResizeMouseDown(e, win, dir)}
                    />
                  ))}

                  {/* 요소 오버레이 (창 선택 시 표시) */}
                  {isSelected && elements.map((elem) => {
                    const elemOv = windowOverride?.elements?.[elem.type] ?? {};
                    const ex = elemOv.x ?? elem.x;
                    const ey = elemOv.y ?? elem.y;
                    const ew = elemOv.width ?? elem.width;
                    const eh = elemOv.height ?? elem.height;
                    const isElemSelected = uiEditorSelectedElementType === elem.type;
                    const isElemHidden = elemOv.visible === false;
                    return (
                      <div
                        key={elem.type}
                        className={`ui-overlay-element${isElemSelected ? ' selected' : ''}${isElemHidden ? ' hidden' : ''}`}
                        style={{
                          left: padding + ex,
                          top: padding + ey,
                          width: ew,
                          height: eh,
                        }}
                        title={isElemHidden ? `${elem.label} (숨김)` : elem.label}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setUiEditorSelectedElementType(isElemSelected ? null : elem.type);
                        }}
                      >
                        <div className="ui-overlay-element-label">
                          {isElemHidden ? '🚫 ' : ''}{elem.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Nav Visual: 위젯 간 방향키 네비게이션 연결 화살표 */}
          {customSceneId && uiNavVisual && (() => {
            const NAV_COLORS = { navUp: '#4af', navDown: '#f84', navLeft: '#4f4', navRight: '#fa4' } as const;
            type NavKey = keyof typeof NAV_COLORS;
            const arrows: React.ReactNode[] = [];
            widgetById.forEach((w, srcId) => {
              const srcPos = widgetPositions.get(srcId);
              if (!srcPos) return;
              const sx = srcPos.absX + srcPos.width / 2;
              const sy = srcPos.absY + (srcPos.height ?? 40) / 2;
              (Object.keys(NAV_COLORS) as NavKey[]).forEach((key) => {
                const tgtRaw = (w as any)[key] as string | undefined;
                if (!tgtRaw) return;
                // 풀 경로("navTest/root/main_panel/btn_close") → 마지막 세그먼트("btn_close")
                const tgtId = tgtRaw.includes('/') ? tgtRaw.split('/').pop()! : tgtRaw;
                const tgtPos = widgetPositions.get(tgtId);
                if (!tgtPos) return;
                const tx = tgtPos.absX + tgtPos.width / 2;
                const ty = tgtPos.absY + (tgtPos.height ?? 40) / 2;
                const color = NAV_COLORS[key];
                const markerId = `nav-arrow-${key}`;

                const dx = tx - sx, dy = ty - sy;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len < 1) return;

                // 끝점 여백 (위젯 중심에서 margin만큼 후퇴)
                const margin = 10;
                const ux = dx / len, uy = dy / len;
                const x1 = sx + ux * margin, y1 = sy + uy * margin;
                const x2 = tx - ux * margin, y2 = ty - uy * margin;

                // 진행 방향 오른쪽 수직 단위벡터 (시계방향 90°)
                const rpx = uy, rpy = -ux;
                // 곡률 offset: 거리에 비례하되 최소 20, 최대 45
                const curve = Math.min(45, Math.max(20, len * 0.22));
                const cx = (x1 + x2) / 2 + rpx * curve;
                const cy = (y1 + y2) / 2 + rpy * curve;

                arrows.push(
                  <path key={`${srcId}-${key}`}
                    d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                    stroke={color} strokeWidth={1.5} opacity={0.85} fill="none"
                    markerEnd={`url(#${markerId})`}
                  />
                );
              });
            });
            return (
              <svg style={{ position: 'absolute', left: 0, top: 0, width: GAME_W, height: GAME_H, pointerEvents: 'none', overflow: 'visible' }}
                viewBox={`0 0 ${GAME_W} ${GAME_H}`}
              >
                <defs>
                  {(Object.keys(NAV_COLORS) as NavKey[]).map((key) => (
                    <marker key={key} id={`nav-arrow-${key}`} markerWidth="7" markerHeight="7" refX="7" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L7,3 z" fill={NAV_COLORS[key]} />
                    </marker>
                  ))}
                </defs>
                {arrows}
              </svg>
            );
          })()}
        </div>

        {!uiEditorIframeReady && (
          <div className="ui-editor-loading">게임 런타임 로딩 중...</div>
        )}
      </div>
    </div>
  );
}
