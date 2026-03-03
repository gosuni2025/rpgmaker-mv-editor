import { useState, useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { WidgetDragState } from './UIEditorCanvasUtils';
import { computeUpdates } from './UIEditorCanvasUtils';

interface UseUIEditorWidgetDragOptions {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  scaleRef: React.RefObject<number>;
  updateWidget: (sceneId: string, widgetId: string, updates: any) => void;
  saveCustomScenes: () => Promise<void>;
}

export function useUIEditorWidgetDrag({
  iframeRef,
  scaleRef,
  updateWidget,
  saveCustomScenes,
}: UseUIEditorWidgetDragOptions) {
  const [widgetDragState, setWidgetDragState] = useState<WidgetDragState | null>(null);

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
  }, [widgetDragState, updateWidget, saveCustomScenes, iframeRef, scaleRef]);

  return { widgetDragState, setWidgetDragState };
}
