import React, { useEffect, useRef, useCallback, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { UIWindowInfo } from '../../store/types';
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
  const uiEditorWindows = useEditorStore((s) => s.uiEditorWindows);
  const uiEditorSelectedWindowId = useEditorStore((s) => s.uiEditorSelectedWindowId);
  const uiEditorOverrides = useEditorStore((s) => s.uiEditorOverrides);
  const uiEditorSelectedElementType = useEditorStore((s) => s.uiEditorSelectedElementType);
  const setUiEditorIframeReady = useEditorStore((s) => s.setUiEditorIframeReady);
  const setUiEditorWindows = useEditorStore((s) => s.setUiEditorWindows);
  const setUiEditorSelectedWindowId = useEditorStore((s) => s.setUiEditorSelectedWindowId);
  const setUiEditorOverride = useEditorStore((s) => s.setUiEditorOverride);
  const loadUiEditorOverrides = useEditorStore((s) => s.loadUiEditorOverrides);
  const setUiEditorSelectedElementType = useEditorStore((s) => s.setUiEditorSelectedElementType);

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
    fetch('/api/ui-editor/config')
      .then((r) => r.json())
      .then((data) => {
        if (data.overrides && Object.keys(data.overrides).length > 0) {
          loadUiEditorOverrides(data.overrides);
        }
      })
      .catch(() => {});
  }, [projectPath, loadUiEditorOverrides]);

  // postMessage 수신
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const { type } = e.data ?? {};
      if (type === 'bridgeReady') {
        setUiEditorIframeReady(true);
      } else if (type === 'sceneReady') {
        setUiEditorWindows(e.data.windows ?? []);
        // 씬 로드 후 저장된 오버라이드를 iframe에 적용
        const overrides = useEditorStore.getState().uiEditorOverrides;
        Object.values(overrides).forEach((ov) => {
          Object.entries(ov).forEach(([prop, value]) => {
            if (prop === 'className') return;
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
        fetch('/api/ui-editor/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ overrides: s.uiEditorOverrides }),
        }).then(() => {
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
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'loadScene', sceneName: uiEditorScene }, '*'
    );
  }, [uiEditorIframeReady, uiEditorScene]);

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
    };
    const onMouseUp = () => setDragState(null);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragState, setUiEditorOverride]);

  const handleWindowMouseDown = useCallback((e: React.MouseEvent, win: UIWindowInfo) => {
    e.stopPropagation();
    e.preventDefault();
    setUiEditorSelectedWindowId(win.id);
    setDragState({
      windowId: win.id,
      className: win.className,
      handleDir: 'move',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWin: { x: win.x, y: win.y, width: win.width, height: win.height },
    });
  }, [setUiEditorSelectedWindowId]);

  const handleResizeMouseDown = useCallback((
    e: React.MouseEvent, win: UIWindowInfo, dir: HandleDir
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setDragState({
      windowId: win.id,
      className: win.className,
      handleDir: dir,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWin: { x: win.x, y: win.y, width: win.width, height: win.height },
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setUiEditorIframeReady(false);
    setUiEditorWindows([]);
    if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
  }, [setUiEditorIframeReady, setUiEditorWindows]);

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
                    return (
                      <div
                        key={elem.type}
                        className={`ui-overlay-element${isElemSelected ? ' selected' : ''}`}
                        style={{
                          left: padding + ex,
                          top: padding + ey,
                          width: ew,
                          height: eh,
                        }}
                        title={elem.label}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setUiEditorSelectedElementType(isElemSelected ? null : elem.type);
                        }}
                      >
                        <div className="ui-overlay-element-label">{elem.label}</div>
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
