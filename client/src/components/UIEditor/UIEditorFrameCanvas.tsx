import React, { useEffect, useRef, useCallback, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { DISPLAY_SCALE, type DragState, drawSkin } from './UIEditorFrameCanvasUtils';
import { useFrameCanvasDrag, getActiveTab } from './useFrameCanvasDrag';
import './UIEditor.css';

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function UIEditorFrameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const hoverHitRef = useRef<DragState>(null);
  const altKeyRef = useRef(false);
  const [imgSize, setImgSize] = useState({ w: 192, h: 192 });

  const projectPath        = useEditorStore((s) => s.projectPath);
  const uiSelectedSkin     = useEditorStore((s) => s.uiSelectedSkin);
  const uiSelectedSkinFile = useEditorStore((s) => s.uiSelectedSkinFile);
  const uiSkinCornerSize   = useEditorStore((s) => s.uiSkinCornerSize);
  const uiSkinFrameX       = useEditorStore((s) => s.uiSkinFrameX);
  const uiSkinFrameY       = useEditorStore((s) => s.uiSkinFrameY);
  const uiSkinFrameW       = useEditorStore((s) => s.uiSkinFrameW);
  const uiSkinFrameH       = useEditorStore((s) => s.uiSkinFrameH);
  const uiSkinFillX        = useEditorStore((s) => s.uiSkinFillX);
  const uiSkinFillY        = useEditorStore((s) => s.uiSkinFillY);
  const uiSkinFillW        = useEditorStore((s) => s.uiSkinFillW);
  const uiSkinFillH        = useEditorStore((s) => s.uiSkinFillH);
  const uiSkinCursorX      = useEditorStore((s) => s.uiSkinCursorX);
  const uiSkinCursorY      = useEditorStore((s) => s.uiSkinCursorY);
  const uiSkinCursorW      = useEditorStore((s) => s.uiSkinCursorW);
  const uiSkinCursorH      = useEditorStore((s) => s.uiSkinCursorH);
  const uiSkinCursorCornerSize = useEditorStore((s) => s.uiSkinCursorCornerSize);
  const uiSkinGaugeFile    = useEditorStore((s) => s.uiSkinGaugeFile);
  const uiSkinGaugeBgX     = useEditorStore((s) => s.uiSkinGaugeBgX);
  const uiSkinGaugeBgY     = useEditorStore((s) => s.uiSkinGaugeBgY);
  const uiSkinGaugeBgW     = useEditorStore((s) => s.uiSkinGaugeBgW);
  const uiSkinGaugeBgH     = useEditorStore((s) => s.uiSkinGaugeBgH);
  const uiSkinGaugeFillX   = useEditorStore((s) => s.uiSkinGaugeFillX);
  const uiSkinGaugeFillY   = useEditorStore((s) => s.uiSkinGaugeFillY);
  const uiSkinGaugeFillW   = useEditorStore((s) => s.uiSkinGaugeFillW);
  const uiSkinGaugeFillH   = useEditorStore((s) => s.uiSkinGaugeFillH);
  const uiShowSkinLabels   = useEditorStore((s) => s.uiShowSkinLabels);
  const uiShowCheckerboard = useEditorStore((s) => s.uiShowCheckerboard);
  const uiShowRegionOverlay = useEditorStore((s) => s.uiShowRegionOverlay);
  const uiEditSubMode      = useEditorStore((s) => s.uiEditSubMode);

  const [zoom, setZoom] = useState(1);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = useEditorStore.getState();
    drawSkin(ctx, img, imgSize.w, imgSize.h,
      s.uiSkinFrameX, s.uiSkinFrameY, s.uiSkinFrameW, s.uiSkinFrameH,
      s.uiSkinFillX, s.uiSkinFillY, s.uiSkinFillW, s.uiSkinFillH,
      s.uiSkinCornerSize,
      s.uiSkinCursorX, s.uiSkinCursorY, s.uiSkinCursorW, s.uiSkinCursorH, s.uiSkinCursorCornerSize,
      s.uiShowSkinLabels, s.uiShowCheckerboard, s.uiShowRegionOverlay,
      hoverHitRef.current, getActiveTab(s.uiEditSubMode),
      s.uiSkinGaugeBgX, s.uiSkinGaugeBgY, s.uiSkinGaugeBgW, s.uiSkinGaugeBgH,
      s.uiSkinGaugeFillX, s.uiSkinGaugeFillY, s.uiSkinGaugeFillW, s.uiSkinGaugeFillH);
  }, [imgSize]);

  const { handleMouseDown, handleCanvasMouseMove } = useFrameCanvasDrag(
    canvasRef, imgRef, dragRef, hoverHitRef, altKeyRef, redraw,
  );

  // 스킨 이미지 로드 — 실제 naturalWidth/Height 기반으로 캔버스 크기 설정
  useEffect(() => {
    if (!projectPath || !uiSelectedSkin) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.fillText('Loading...', 8, 20);

    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      canvas.width  = w * DISPLAY_SCALE;
      canvas.height = h * DISPLAY_SCALE;
      setImgSize({ w, h });
      imgRef.current = img;
      const s = useEditorStore.getState();
      drawSkin(ctx, img, w, h,
        s.uiSkinFrameX, s.uiSkinFrameY, s.uiSkinFrameW, s.uiSkinFrameH,
        s.uiSkinFillX, s.uiSkinFillY, s.uiSkinFillW, s.uiSkinFillH,
        s.uiSkinCornerSize,
        s.uiSkinCursorX, s.uiSkinCursorY, s.uiSkinCursorW, s.uiSkinCursorH, s.uiSkinCursorCornerSize,
        s.uiShowSkinLabels, s.uiShowCheckerboard, s.uiShowRegionOverlay,
        hoverHitRef.current, getActiveTab(s.uiEditSubMode),
        s.uiSkinGaugeBgX, s.uiSkinGaugeBgY, s.uiSkinGaugeBgW, s.uiSkinGaugeBgH,
        s.uiSkinGaugeFillX, s.uiSkinGaugeFillY, s.uiSkinGaugeFillW, s.uiSkinGaugeFillH);
    };
    const isGaugeTab = useEditorStore.getState().uiEditSubMode === 'gauge';
    const gaugeFile = useEditorStore.getState().uiSkinGaugeFile;
    const displayFile = (isGaugeTab && gaugeFile) ? gaugeFile : uiSelectedSkinFile;
    img.onerror = () => {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f66';
      ctx.font = '14px sans-serif';
      ctx.fillText(`스킨을 불러올 수 없음: ${displayFile}`, 8, 20);
    };
    img.src = `/img/system/${displayFile}.png?v=${Date.now()}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath, uiSelectedSkin, uiSelectedSkinFile, uiEditSubMode, uiSkinGaugeFile]);

  useEffect(() => { redraw(); }, [redraw, uiSkinCornerSize, uiSkinFrameX, uiSkinFrameY, uiSkinFrameW, uiSkinFrameH, uiSkinFillX, uiSkinFillY, uiSkinFillW, uiSkinFillH, uiSkinCursorX, uiSkinCursorY, uiSkinCursorW, uiSkinCursorH, uiSkinCursorCornerSize, uiSkinGaugeBgX, uiSkinGaugeBgY, uiSkinGaugeBgW, uiSkinGaugeBgH, uiSkinGaugeFillX, uiSkinGaugeFillY, uiSkinGaugeFillW, uiSkinGaugeFillH, uiShowSkinLabels, uiShowCheckerboard, uiShowRegionOverlay, uiEditSubMode]);

  // 키보드: Alt 커서 + Cmd+Z undo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        altKeyRef.current = true;
        if (canvasRef.current && !dragRef.current) canvasRef.current.style.cursor = 'grab';
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useEditorStore.getState().undoUiSkin();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return;
      altKeyRef.current = false;
      if (canvasRef.current && !dragRef.current) canvasRef.current.style.cursor = 'default';
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  // 휠 줌 — scroll 컨테이너에 달아야 zoom 관계없이 전체 영역에서 동작
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((prev) => Math.max(0.25, Math.min(8, prev * (e.deltaY < 0 ? 1.1 : 0.9))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  if (!projectPath) {
    return (
      <div className="ui-frame-canvas-area">
        <div className="ui-editor-no-project">프로젝트를 먼저 열어주세요</div>
      </div>
    );
  }

  const canvasCssW = imgSize.w * DISPLAY_SCALE;
  const canvasCssH = imgSize.h * DISPLAY_SCALE;

  return (
    <div className="ui-frame-canvas-area">
      <div ref={scrollRef} className="ui-frame-canvas-scroll">
        <canvas
          ref={canvasRef}
          className="ui-frame-canvas"
          style={{
            imageRendering: 'pixelated',
            display: 'block',
            width: canvasCssW * zoom,
            height: canvasCssH * zoom,
            flexShrink: 0,
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => {
            if (canvasRef.current) canvasRef.current.style.cursor = 'default';
            if (hoverHitRef.current?.type === 'slice') { hoverHitRef.current = null; redraw(); }
            else hoverHitRef.current = null;
          }}
        />
      </div>
      <div className="ui-frame-canvas-legend">
        <span style={{ fontSize: 11, color: '#888', marginRight: 8 }}>
          휠: 줌 {Math.round(zoom * 100)}%
        </span>
        {imgSize.w === 192 && imgSize.h === 192 && (
          <>
            <span className="ui-frame-legend-item legend-bg">배경</span>
            <span className="ui-frame-legend-item legend-frame">프레임</span>
            <span className="ui-frame-legend-item legend-ui">커서/화살표</span>
          </>
        )}
        <span style={{ fontSize: 11, color: '#888' }}>{imgSize.w}×{imgSize.h}px</span>
        <span className="ui-frame-legend-item legend-slice">― 9-slice / 테두리 드래그</span>
      </div>
    </div>
  );
}
