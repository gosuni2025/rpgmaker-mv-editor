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

  // 최신 값을 ref로 유지
  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;
  const resizeMapRef = useRef(resizeMap);
  resizeMapRef.current = resizeMap;

  // ref를 통해 최신 로직을 참조하는 안정적인 이벤트 핸들러
  const moveImpl = useRef<(e: MouseEvent) => void>(() => {});
  const upImpl = useRef<() => void>(() => {});
  const keyDownImpl = useRef<(e: KeyboardEvent) => void>(() => {});

  // 한 번만 생성되는 안정적인 래퍼 함수 (addEventListener/removeEventListener에서 동일 참조 보장)
  const [stableHandlers] = useState(() => ({
    move: (e: MouseEvent) => moveImpl.current(e),
    up: () => upImpl.current(),
    keyDown: (e: KeyboardEvent) => keyDownImpl.current(e),
  }));

  const cleanup = useCallback(() => {
    window.removeEventListener('mousemove', stableHandlers.move);
    window.removeEventListener('mouseup', stableHandlers.up);
    window.removeEventListener('keydown', stableHandlers.keyDown);
  }, [stableHandlers]);

  // mousemove 구현
  moveImpl.current = (e: MouseEvent) => {
    if (!isResizing.current || !resizeEdge.current) return;
    const canvas = webglCanvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const px = (e.clientX - rect.left) / zoomLevelRef.current;
    const py = (e.clientY - rect.top) / zoomLevelRef.current;
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
  };

  // mouseup 구현: 리사이즈 확정
  upImpl.current = () => {
    if (!isResizing.current) return;
    const preview = resizePreviewRef.current;
    isResizing.current = false;
    resizeEdge.current = null;
    cleanup();
    if (preview) {
      const { dLeft, dTop, dRight, dBottom } = preview;
      if (dLeft !== 0 || dTop !== 0 || dRight !== 0 || dBottom !== 0) {
        const origW = resizeOrigSize.current.w;
        const origH = resizeOrigSize.current.h;
        const newW = origW + dRight - dLeft;
        const newH = origH + dBottom - dTop;
        resizeMapRef.current(newW, newH, -dLeft, -dTop);
      }
    }
    updateResizePreview(null);
  };

  // keydown 구현: ESC로 리사이즈 취소
  keyDownImpl.current = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isResizing.current) {
      e.preventDefault();
      e.stopPropagation();
      isResizing.current = false;
      resizeEdge.current = null;
      cleanup();
      updateResizePreview(null);
    }
  };

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const startResize = useCallback((edge: ResizeEdge, px: { x: number; y: number }, mapSize: { w: number; h: number }) => {
    if (!edge) return;
    isResizing.current = true;
    resizeEdge.current = edge;
    resizeStartPx.current = px;
    resizeOrigSize.current = mapSize;
    updateResizePreview({ dLeft: 0, dTop: 0, dRight: 0, dBottom: 0 });
    window.addEventListener('mousemove', stableHandlers.move);
    window.addEventListener('mouseup', stableHandlers.up);
    window.addEventListener('keydown', stableHandlers.keyDown);
  }, [stableHandlers, updateResizePreview]);

  return {
    isResizing,
    resizeOrigSize,
    resizePreview,
    resizeCursor,
    setResizeCursor,
    startResize,
  };
}
