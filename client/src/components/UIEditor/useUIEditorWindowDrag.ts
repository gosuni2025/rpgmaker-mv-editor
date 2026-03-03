import { useState, useCallback, useEffect, useRef } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { UIWindowInfo } from '../../store/types';
import {
  type HandleDir, type DragState,
  computeUpdates,
} from './UIEditorCanvasUtils';

interface UseUIEditorWindowDragOptions {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  scaleRef: React.RefObject<number>;
  setUiEditorOverride: (className: string, prop: 'x' | 'y' | 'width' | 'height', value: number) => void;
  setUiEditorWindows: (windows: UIWindowInfo[]) => void;
  setUiEditorSelectedWindowId: (id: string | null) => void;
  pushUiOverrideUndo: () => void;
}

export function useUIEditorWindowDrag({
  iframeRef,
  scaleRef,
  setUiEditorOverride,
  setUiEditorWindows,
  setUiEditorSelectedWindowId,
  pushUiOverrideUndo,
}: UseUIEditorWindowDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);

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
  }, [dragState, iframeRef]);

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
  }, [dragState, setUiEditorOverride, iframeRef, scaleRef, setUiEditorWindows]);

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

  return { dragState, handleWindowMouseDown, handleResizeMouseDown };
}
