import React, { useRef, useState, useCallback, useEffect } from 'react';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import type { ResizeEdge } from './useMapTools';

export interface ResizeHandlersResult {
  isResizing: React.MutableRefObject<boolean>;
  resizeOrigSize: React.MutableRefObject<{ w: number; h: number }>;
  resizePreview: { dLeft: number; dTop: number; dRight: number; dBottom: number } | null;
  resizeCursor: string | null;
  setResizeCursor: (cursor: string | null) => void;
  startResize: (edge: ResizeEdge, px: { x: number; y: number }, mapSize: { w: number; h: number }) => void;
}

export function useResizeHandlers(
  webglCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  zoomLevel: number,
  resizeMap: (newWidth: number, newHeight: number, offsetX: number, offsetY: number) => void,
): ResizeHandlersResult {
  const isResizing = useRef(false);
  const resizeEdge = useRef<ResizeEdge>(null);
  const resizeStartPx = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const resizeOrigSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const [resizePreview, setResizePreview] = useState<{ dLeft: number; dTop: number; dRight: number; dBottom: number } | null>(null);
  const resizePreviewRef = useRef<{ dLeft: number; dTop: number; dRight: number; dBottom: number } | null>(null);
  const updateResizePreview = useCallback((val: { dLeft: number; dTop: number; dRight: number; dBottom: number } | null) => {
    resizePreviewRef.current = val;
    setResizePreview(val);
  }, []);
  const [resizeCursor, setResizeCursor] = useState<string | null>(null);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !resizeEdge.current) return;
    const canvas = webglCanvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const px = (e.clientX - rect.left) / zoomLevel;
    const py = (e.clientY - rect.top) / zoomLevel;
    const dx = px - resizeStartPx.current.x;
    const dy = py - resizeStartPx.current.y;
    const edge = resizeEdge.current;
    const dtX = Math.round(dx / TILE_SIZE_PX);
    const dtY = Math.round(dy / TILE_SIZE_PX);
    let dLeft = 0, dTop = 0, dRight = 0, dBottom = 0;
    if (edge.includes('e')) dRight = dtX;
    if (edge.includes('w')) dLeft = dtX;
    if (edge.includes('s')) dBottom = dtY;
    if (edge.includes('n')) dTop = dtY;
    const origW = resizeOrigSize.current.w;
    const origH = resizeOrigSize.current.h;
    const newW = origW + dRight - dLeft;
    const newH = origH + dBottom - dTop;
    if (newW < 1) { if (dRight !== 0) dRight = 1 - origW + dLeft; else dLeft = origW + dRight - 1; }
    if (newH < 1) { if (dBottom !== 0) dBottom = 1 - origH + dTop; else dTop = origH + dBottom - 1; }
    if (newW > 256) { if (dRight !== 0) dRight = 256 - origW + dLeft; else dLeft = origW + dRight - 256; }
    if (newH > 256) { if (dBottom !== 0) dBottom = 256 - origH + dTop; else dTop = origH + dBottom - 256; }
    updateResizePreview({ dLeft, dTop, dRight, dBottom });
  }, [zoomLevel, updateResizePreview]);

  const handleResizeUp = useCallback(() => {
    if (!isResizing.current) return;
    isResizing.current = false;
    resizeEdge.current = null;
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeUp);
    const preview = resizePreviewRef.current;
    if (preview) {
      const { dLeft, dTop, dRight, dBottom } = preview;
      if (dLeft !== 0 || dTop !== 0 || dRight !== 0 || dBottom !== 0) {
        const origW = resizeOrigSize.current.w;
        const origH = resizeOrigSize.current.h;
        const newW = origW + dRight - dLeft;
        const newH = origH + dBottom - dTop;
        resizeMap(newW, newH, -dLeft, -dTop);
      }
    }
    updateResizePreview(null);
  }, [handleResizeMove, resizeMap, updateResizePreview]);

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeUp);
    };
  }, [handleResizeMove, handleResizeUp]);

  const startResize = useCallback((edge: ResizeEdge, px: { x: number; y: number }, mapSize: { w: number; h: number }) => {
    if (!edge) return;
    isResizing.current = true;
    resizeEdge.current = edge;
    resizeStartPx.current = px;
    resizeOrigSize.current = mapSize;
    updateResizePreview({ dLeft: 0, dTop: 0, dRight: 0, dBottom: 0 });
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
  }, [handleResizeMove, handleResizeUp, updateResizePreview]);

  return {
    isResizing,
    resizeOrigSize,
    resizePreview,
    resizeCursor,
    setResizeCursor,
    startResize,
  };
}
