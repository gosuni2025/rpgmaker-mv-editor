import React, { useEffect, useRef, useCallback, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { DISPLAY_SCALE, DragState, drawSkin, getHit, getCursor, clamp } from './UIEditorFrameCanvasUtils';
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
  const setUiSkinCornerSize = useEditorStore((s) => s.setUiSkinCornerSize);
  const setUiSkinFrame     = useEditorStore((s) => s.setUiSkinFrame);
  const setUiSkinFill      = useEditorStore((s) => s.setUiSkinFill);
  const setUiSkinCursor    = useEditorStore((s) => s.setUiSkinCursor);
  const setUiSkinGaugeBg   = useEditorStore((s) => s.setUiSkinGaugeBg);
  const setUiSkinGaugeFill = useEditorStore((s) => s.setUiSkinGaugeFill);

  // suppress unused-var warnings — used via st.setUiSkinXxx() in callbacks
  void setUiSkinCornerSize; void setUiSkinFrame; void setUiSkinFill; void setUiSkinCursor;
  void setUiSkinGaugeBg; void setUiSkinGaugeFill;

  const [zoom, setZoom] = useState(1);

  const toImageCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      ix: (clientX - rect.left) * (canvas.width / rect.width) / DISPLAY_SCALE,
      iy: (clientY - rect.top)  * (canvas.height / rect.height) / DISPLAY_SCALE,
    };
  }, []);

  const saveToServer = useCallback(async (fields: Record<string, number | boolean>) => {
    const { projectPath: pp, uiSelectedSkin: skin } = useEditorStore.getState();
    if (!pp || !skin) return;
    await fetch(`/api/ui-editor/skins/${encodeURIComponent(skin)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  }, []);

  const getActiveTab = (subMode: string): 'frame' | 'cursor' | 'gauge' => {
    if (subMode === 'cursor') return 'cursor';
    if (subMode === 'gauge') return 'gauge';
    return 'frame';
  };

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
    img.onerror = () => {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f66';
      ctx.font = '14px sans-serif';
      ctx.fillText(`스킨을 불러올 수 없음: ${uiSelectedSkinFile}`, 8, 20);
    };
    img.src = `/img/system/${uiSelectedSkinFile}.png?v=${Date.now()}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath, uiSelectedSkin, uiSelectedSkinFile]);

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

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = toImageCoords(e.clientX, e.clientY);
    if (!coords) return;
    const s = useEditorStore.getState();

    let hit: DragState;
    if (altKeyRef.current) {
      // Alt 모드: fill 영역 내부면 fill 이동, 아니면 frame 이동
      const inFill = coords.ix >= s.uiSkinFillX && coords.ix <= s.uiSkinFillX + s.uiSkinFillW
                  && coords.iy >= s.uiSkinFillY && coords.iy <= s.uiSkinFillY + s.uiSkinFillH;
      if (inFill) {
        hit = { type: 'fill_move', ox: coords.ix - s.uiSkinFillX, oy: coords.iy - s.uiSkinFillY, startFX: s.uiSkinFillX, startFY: s.uiSkinFillY };
      } else {
        hit = { type: 'frame_move', ox: coords.ix - s.uiSkinFrameX, oy: coords.iy - s.uiSkinFrameY, startFX: s.uiSkinFrameX, startFY: s.uiSkinFrameY };
      }
    } else {
      hit = getHit(coords.ix, coords.iy, s.uiSkinFrameX, s.uiSkinFrameY, s.uiSkinFrameW, s.uiSkinFrameH, s.uiSkinFillX, s.uiSkinFillY, s.uiSkinFillW, s.uiSkinFillH, s.uiSkinCursorX, s.uiSkinCursorY, s.uiSkinCursorW, s.uiSkinCursorH, s.uiSkinCornerSize, getActiveTab(s.uiEditSubMode), s.uiSkinGaugeBgX, s.uiSkinGaugeBgY, s.uiSkinGaugeBgW, s.uiSkinGaugeBgH, s.uiSkinGaugeFillX, s.uiSkinGaugeFillY, s.uiSkinGaugeFillW, s.uiSkinGaugeFillH);
      if (!hit) return;
    }

    e.preventDefault();
    useEditorStore.getState().pushUiSkinUndo();
    dragRef.current = hit;
    document.body.style.cursor = altKeyRef.current ? 'grabbing' : getCursor(hit);

    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const c = toImageCoords(ev.clientX, ev.clientY);
      if (!c) return;
      const st = useEditorStore.getState();
      const iw = imgRef.current?.naturalWidth ?? 192;
      const ih = imgRef.current?.naturalHeight ?? 192;

      if (drag.type === 'slice') {
        const { uiSkinFrameX: fx, uiSkinFrameY: fy, uiSkinFrameW: fw, uiSkinFrameH: fh } = st;
        const maxCs = Math.floor(Math.min(fw, fh) / 2) - 1;
        const raw = drag.axis === 'x'
          ? (drag.nearFirst ? c.ix - fx : fw - (c.ix - fx))
          : (drag.nearFirst ? c.iy - fy : fh - (c.iy - fy));
        st.setUiSkinCornerSize(clamp(Math.round(raw), 1, Math.max(1, maxCs)));
      } else if (drag.type === 'frame_move') {
        const nx = clamp(Math.round(c.ix - drag.ox), 0, iw - st.uiSkinFrameW);
        const ny = clamp(Math.round(c.iy - drag.oy), 0, ih - st.uiSkinFrameH);
        st.setUiSkinFrame(nx, ny, st.uiSkinFrameW, st.uiSkinFrameH);
      } else if (drag.type === 'frame_resize') {
        const { startFX, startFY, startFW, startFH, edge } = drag;
        const MIN_SZ = 10;
        if (edge === 'right')  st.setUiSkinFrame(startFX, startFY, clamp(Math.round(c.ix - startFX), MIN_SZ, iw - startFX), startFH);
        if (edge === 'bottom') st.setUiSkinFrame(startFX, startFY, startFW, clamp(Math.round(c.iy - startFY), MIN_SZ, ih - startFY));
        if (edge === 'left') {
          const newX = clamp(Math.round(c.ix), 0, startFX + startFW - MIN_SZ);
          st.setUiSkinFrame(newX, startFY, startFX + startFW - newX, startFH);
        }
        if (edge === 'top') {
          const newY = clamp(Math.round(c.iy), 0, startFY + startFH - MIN_SZ);
          st.setUiSkinFrame(startFX, newY, startFW, startFY + startFH - newY);
        }
      } else if (drag.type === 'fill_move') {
        const nx = clamp(Math.round(c.ix - drag.ox), 0, iw - st.uiSkinFillW);
        const ny = clamp(Math.round(c.iy - drag.oy), 0, ih - st.uiSkinFillH);
        st.setUiSkinFill(nx, ny, st.uiSkinFillW, st.uiSkinFillH);
      } else if (drag.type === 'fill_resize') {
        const { startFX, startFY, startFW, startFH, edge } = drag;
        const MIN_SZ = 8;
        if (edge === 'right')  st.setUiSkinFill(startFX, startFY, clamp(Math.round(c.ix - startFX), MIN_SZ, iw - startFX), startFH);
        if (edge === 'bottom') st.setUiSkinFill(startFX, startFY, startFW, clamp(Math.round(c.iy - startFY), MIN_SZ, ih - startFY));
        if (edge === 'left') {
          const newX = clamp(Math.round(c.ix), 0, startFX + startFW - MIN_SZ);
          st.setUiSkinFill(newX, startFY, startFX + startFW - newX, startFH);
        }
        if (edge === 'top') {
          const newY = clamp(Math.round(c.iy), 0, startFY + startFH - MIN_SZ);
          st.setUiSkinFill(startFX, newY, startFW, startFY + startFH - newY);
        }
      } else if (drag.type === 'cursor_move') {
        const nx = clamp(Math.round(c.ix - drag.ox), 0, iw - st.uiSkinCursorW);
        const ny = clamp(Math.round(c.iy - drag.oy), 0, ih - st.uiSkinCursorH);
        st.setUiSkinCursor(nx, ny, st.uiSkinCursorW, st.uiSkinCursorH);
      } else if (drag.type === 'cursor_resize') {
        const { startCX, startCY, startCW, startCH, edge } = drag;
        const MIN_SZ = 4;
        if (edge === 'right')  st.setUiSkinCursor(startCX, startCY, clamp(Math.round(c.ix - startCX), MIN_SZ, iw - startCX), startCH);
        if (edge === 'bottom') st.setUiSkinCursor(startCX, startCY, startCW, clamp(Math.round(c.iy - startCY), MIN_SZ, ih - startCY));
        if (edge === 'left') {
          const newX = clamp(Math.round(c.ix), 0, startCX + startCW - MIN_SZ);
          st.setUiSkinCursor(newX, startCY, startCX + startCW - newX, startCH);
        }
        if (edge === 'top') {
          const newY = clamp(Math.round(c.iy), 0, startCY + startCH - MIN_SZ);
          st.setUiSkinCursor(startCX, newY, startCW, startCY + startCH - newY);
        }
      } else if (drag.type === 'gauge_bg_move') {
        const nx = clamp(Math.round(c.ix - drag.ox), 0, iw - st.uiSkinGaugeBgW);
        const ny = clamp(Math.round(c.iy - drag.oy), 0, ih - st.uiSkinGaugeBgH);
        st.setUiSkinGaugeBg(nx, ny, st.uiSkinGaugeBgW, st.uiSkinGaugeBgH);
      } else if (drag.type === 'gauge_bg_resize') {
        const { startX, startY, startW, startH, edge } = drag;
        const MIN_SZ = 2;
        if (edge === 'right')  st.setUiSkinGaugeBg(startX, startY, clamp(Math.round(c.ix - startX), MIN_SZ, iw - startX), startH);
        if (edge === 'bottom') st.setUiSkinGaugeBg(startX, startY, startW, clamp(Math.round(c.iy - startY), MIN_SZ, ih - startY));
        if (edge === 'left') {
          const newX = clamp(Math.round(c.ix), 0, startX + startW - MIN_SZ);
          st.setUiSkinGaugeBg(newX, startY, startX + startW - newX, startH);
        }
        if (edge === 'top') {
          const newY = clamp(Math.round(c.iy), 0, startY + startH - MIN_SZ);
          st.setUiSkinGaugeBg(startX, newY, startW, startY + startH - newY);
        }
      } else if (drag.type === 'gauge_fill_move') {
        const nx = clamp(Math.round(c.ix - drag.ox), 0, iw - st.uiSkinGaugeFillW);
        const ny = clamp(Math.round(c.iy - drag.oy), 0, ih - st.uiSkinGaugeFillH);
        st.setUiSkinGaugeFill(nx, ny, st.uiSkinGaugeFillW, st.uiSkinGaugeFillH);
      } else if (drag.type === 'gauge_fill_resize') {
        const { startX, startY, startW, startH, edge } = drag;
        const MIN_SZ = 2;
        if (edge === 'right')  st.setUiSkinGaugeFill(startX, startY, clamp(Math.round(c.ix - startX), MIN_SZ, iw - startX), startH);
        if (edge === 'bottom') st.setUiSkinGaugeFill(startX, startY, startW, clamp(Math.round(c.iy - startY), MIN_SZ, ih - startY));
        if (edge === 'left') {
          const newX = clamp(Math.round(c.ix), 0, startX + startW - MIN_SZ);
          st.setUiSkinGaugeFill(newX, startY, startX + startW - newX, startH);
        }
        if (edge === 'top') {
          const newY = clamp(Math.round(c.iy), 0, startY + startH - MIN_SZ);
          st.setUiSkinGaugeFill(startX, newY, startW, startY + startH - newY);
        }
      }
    };

    const onUp = async () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      document.body.style.cursor = '';
      if (canvasRef.current) canvasRef.current.style.cursor = altKeyRef.current ? 'grab' : 'default';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const st = useEditorStore.getState();
      if (drag.type === 'slice') {
        await saveToServer({ cornerSize: st.uiSkinCornerSize });
      } else if (drag.type === 'fill_move' || drag.type === 'fill_resize') {
        await saveToServer({ fillX: st.uiSkinFillX, fillY: st.uiSkinFillY, fillW: st.uiSkinFillW, fillH: st.uiSkinFillH });
      } else if (drag.type === 'cursor_move' || drag.type === 'cursor_resize') {
        await saveToServer({ cursorX: st.uiSkinCursorX, cursorY: st.uiSkinCursorY, cursorW: st.uiSkinCursorW, cursorH: st.uiSkinCursorH });
      } else if (drag.type === 'gauge_bg_move' || drag.type === 'gauge_bg_resize') {
        await saveToServer({ gaugeBgX: st.uiSkinGaugeBgX, gaugeBgY: st.uiSkinGaugeBgY, gaugeBgW: st.uiSkinGaugeBgW, gaugeBgH: st.uiSkinGaugeBgH });
      } else if (drag.type === 'gauge_fill_move' || drag.type === 'gauge_fill_resize') {
        await saveToServer({ gaugeFillX: st.uiSkinGaugeFillX, gaugeFillY: st.uiSkinGaugeFillY, gaugeFillW: st.uiSkinGaugeFillW, gaugeFillH: st.uiSkinGaugeFillH });
      } else {
        await saveToServer({ frameX: st.uiSkinFrameX, frameY: st.uiSkinFrameY, frameW: st.uiSkinFrameW, frameH: st.uiSkinFrameH });
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [toImageCoords, saveToServer]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (altKeyRef.current) {
      canvas.style.cursor = 'grab';
      if (hoverHitRef.current?.type === 'slice') { hoverHitRef.current = null; redraw(); }
      return;
    }

    const coords = toImageCoords(e.clientX, e.clientY);
    if (!coords) return;
    const s = useEditorStore.getState();
    const hit = getHit(coords.ix, coords.iy, s.uiSkinFrameX, s.uiSkinFrameY, s.uiSkinFrameW, s.uiSkinFrameH, s.uiSkinFillX, s.uiSkinFillY, s.uiSkinFillW, s.uiSkinFillH, s.uiSkinCursorX, s.uiSkinCursorY, s.uiSkinCursorW, s.uiSkinCursorH, s.uiSkinCornerSize, getActiveTab(s.uiEditSubMode), s.uiSkinGaugeBgX, s.uiSkinGaugeBgY, s.uiSkinGaugeBgW, s.uiSkinGaugeBgH, s.uiSkinGaugeFillX, s.uiSkinGaugeFillY, s.uiSkinGaugeFillW, s.uiSkinGaugeFillH);
    canvas.style.cursor = getCursor(hit);

    // slice 호버 하이라이트 갱신
    const prevIsSlice = hoverHitRef.current?.type === 'slice';
    const nextIsSlice = hit?.type === 'slice';
    const changed = prevIsSlice !== nextIsSlice ||
      (nextIsSlice && (
        (hit as Extract<DragState, { type: 'slice' }>).axis !== (hoverHitRef.current as Extract<DragState, { type: 'slice' }>).axis ||
        (hit as Extract<DragState, { type: 'slice' }>).nearFirst !== (hoverHitRef.current as Extract<DragState, { type: 'slice' }>).nearFirst
      ));
    hoverHitRef.current = hit;
    if (changed) redraw();
  }, [toImageCoords, redraw]);

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
