import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import apiClient from '../../api/client';
import useEditorStore from '../../store/useEditorStore';
import type { UIWindowInfo, UIWindowOverride } from '../../store/types';
import type { WidgetDef, WidgetDef_Panel } from '../../store/uiEditorTypes';
import './UIEditor.css';

const GAME_W = 816;
const GAME_H = 624;
type HandleDir = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
const RESIZE_HANDLES: HandleDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface DragState {
  windowId: string;
  className: string;
  handleDir: HandleDir;
  startClientX: number;
  startClientY: number;
  startWin: { x: number; y: number; width: number; height: number };
}

type WidgetAbsPos = {
  absX: number; absY: number; width: number; height: number;
  parentInnerAbsX: number; parentInnerAbsY: number;
};

interface WidgetDragState {
  sceneId: string; widgetId: string; handleDir: HandleDir;
  startClientX: number; startClientY: number;
  startRelX: number; startRelY: number; startWidth: number; startHeight: number;
  parentInnerAbsX: number; parentInnerAbsY: number;
}

function computeAllWidgetPositions(root: WidgetDef_Panel): Map<string, WidgetAbsPos> {
  const res = new Map<string, WidgetAbsPos>();
  function visit(w: WidgetDef, ax: number, ay: number, pix: number, piy: number) {
    res.set(w.id, { absX: ax, absY: ay, width: w.width, height: w.height ?? 36, parentInnerAbsX: pix, parentInnerAbsY: piy });
    if (w.type === 'panel') {
      const p = w as WidgetDef_Panel;
      const pad = p.windowed !== false ? (p.padding ?? 18) : 0;
      for (const c of p.children ?? []) visit(c, ax + pad + c.x, ay + pad + c.y, ax + pad, ay + pad);
    }
  }
  visit(root, root.x, root.y, 0, 0);
  return res;
}

function flattenWidgetIds(root: WidgetDef_Panel): string[] {
  const ids: string[] = [];
  function visit(w: WidgetDef) {
    ids.push(w.id);
    if (w.type === 'panel') for (const c of (w as WidgetDef_Panel).children ?? []) visit(c);
  }
  visit(root);
  return ids;
}

function computeUpdates(
  dir: HandleDir,
  dx: number,
  dy: number,
  { x: wx, y: wy, width: ww, height: wh }: { x: number; y: number; width: number; height: number },
): Partial<Record<'x' | 'y' | 'width' | 'height', number>> {
  const updates: Partial<Record<'x' | 'y' | 'width' | 'height', number>> = {};
  if (dir === 'move') {
    updates.x = Math.round(wx + dx);
    updates.y = Math.round(wy + dy);
    return updates;
  }
  if (dir === 'w' || dir === 'nw' || dir === 'sw') {
    const newW = Math.max(32, ww - dx);
    updates.x = Math.round(wx + ww - newW);
    updates.width = Math.round(newW);
  }
  if (dir === 'e' || dir === 'ne' || dir === 'se') {
    updates.width = Math.max(32, Math.round(ww + dx));
  }
  if (dir === 'n' || dir === 'nw' || dir === 'ne') {
    const newH = Math.max(32, wh - dy);
    updates.y = Math.round(wy + wh - newH);
    updates.height = Math.round(newH);
  }
  if (dir === 's' || dir === 'sw' || dir === 'se') {
    updates.height = Math.max(32, Math.round(wh + dy));
  }
  return updates;
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
  const setSceneRedirects = useEditorStore((s) => s.setSceneRedirects);
  const setUiEditorSelectedElementType = useEditorStore((s) => s.setUiEditorSelectedElementType);
  const pushUiOverrideUndo = useEditorStore((s) => s.pushUiOverrideUndo);
  const undoUiOverride = useEditorStore((s) => s.undoUiOverride);
  const redoUiOverride = useEditorStore((s) => s.redoUiOverride);
  const customScenes = useEditorStore((s) => s.customScenes);
  const customSceneSelectedWidget = useEditorStore((s) => s.customSceneSelectedWidget);
  const setCustomSceneSelectedWidget = useEditorStore((s) => s.setCustomSceneSelectedWidget);
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const saveCustomScenes = useEditorStore((s) => s.saveCustomScenes);

  const [widgetDragState, setWidgetDragState] = useState<WidgetDragState | null>(null);

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

  // 저장된 config 로드
  useEffect(() => {
    if (!projectPath) return;
    if (Object.keys(useEditorStore.getState().uiEditorOverrides).length > 0) return;
    apiClient.get<{ overrides?: Record<string, UIWindowOverride>; sceneRedirects?: Record<string, string> }>('/ui-editor/config')
      .then((data) => {
        if (data.overrides && Object.keys(data.overrides).length > 0) {
          loadUiEditorOverrides(data.overrides);
        }
        if (data.sceneRedirects) {
          setSceneRedirects(data.sceneRedirects);
        }
      })
      .catch(() => {});
  }, [projectPath, loadUiEditorOverrides, setSceneRedirects]);

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

  // iframe ready 후 씬 로드
  useEffect(() => {
    if (!uiEditorIframeReady) return;
    // 커스텀 씬인 경우 먼저 reloadCustomScenes를 보내서 최신 정의를 반영
    if (uiEditorScene.startsWith('Scene_CS_')) {
      iframeRef.current?.contentWindow?.postMessage({ type: 'reloadCustomScenes' }, '*');
    }
    // 저장된 리다이렉트 재적용 (씬 전환 시 초기화되므로)
    const redirects = useEditorStore.getState().sceneRedirects;
    if (Object.keys(redirects).length > 0) {
      iframeRef.current?.contentWindow?.postMessage({ type: 'updateSceneRedirects', redirects }, '*');
    }
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'loadScene', sceneName: uiEditorScene }, '*'
    );
  }, [uiEditorIframeReady, uiEditorScene]);

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
      if (e.shiftKey) redoUiOverride();
      else undoUiOverride();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undoUiOverride, redoUiOverride]);

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

      <div ref={wrapperRef} className="ui-editor-canvas-wrapper">
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
            {customSceneId && widgetOrderedIds
              .filter(id => id !== 'root')
              .map(id => {
                const pos = widgetPositions.get(id);
                if (!pos) return null;
                const isSel = id === customSceneSelectedWidget;
                return (
                  <div
                    key={id}
                    className={`ui-overlay-widget${isSel ? ' selected' : ''}`}
                    style={{ left: pos.absX, top: pos.absY, width: pos.width, height: pos.height }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setCustomSceneSelectedWidget(id);
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
              })}
            {uiEditorWindows.map((win) => {
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
        </div>

        {!uiEditorIframeReady && (
          <div className="ui-editor-loading">게임 런타임 로딩 중...</div>
        )}
      </div>
    </div>
  );
}
