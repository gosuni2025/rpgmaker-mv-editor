import React, { useEffect, useRef, useCallback, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import './UIEditor.css';

const DISPLAY_SCALE = 3;
const SLICE_HIT = 5;
const EDGE_HIT = 6;

// RPG Maker MV 표준 192×192 스킨일 때만 표시하는 영역 안내
interface Region { x: number; y: number; w: number; h: number; color: string; label: string; }
const MV_REGIONS: Region[] = [
  { x: 0,  y: 0,  w: 96, h: 96,  color: 'rgba(80,200,100,0.15)',  label: '배경' },
  { x: 0,  y: 96, w: 96, h: 96,  color: 'rgba(50,160,80,0.12)',   label: '배경 반복' },
  { x: 96, y: 0,  w: 96, h: 96,  color: 'rgba(38,117,191,0.15)',  label: '프레임' },
  { x: 96, y: 96, w: 96, h: 96,  color: 'rgba(200,120,0,0.12)',   label: '커서/화살표' },
];

type DragState =
  | { type: 'slice'; axis: 'x' | 'y'; nearFirst: boolean }
  | { type: 'frame_move'; ox: number; oy: number; startFX: number; startFY: number }
  | { type: 'frame_resize'; edge: 'left' | 'right' | 'top' | 'bottom'; startFX: number; startFY: number; startFW: number; startFH: number }
  | { type: 'fill_move'; ox: number; oy: number; startFX: number; startFY: number }
  | { type: 'fill_resize'; edge: 'left' | 'right' | 'top' | 'bottom'; startFX: number; startFY: number; startFW: number; startFH: number }
  | null;

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function drawSkin(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  imgW: number, imgH: number,
  frameX: number, frameY: number, frameW: number, frameH: number,
  fillX: number, fillY: number, fillW: number, fillH: number,
  cornerSize: number,
  showLabels: boolean,
  showCheckerboard: boolean,
  showRegionOverlay: boolean,
  hoverHit: DragState,
) {
  const S = DISPLAY_SCALE;
  const cw = imgW * S;
  const ch = imgH * S;

  ctx.clearRect(0, 0, cw, ch);

  // 체커보드 배경
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, cw, ch);
  if (showCheckerboard) {
    for (let cy = 0; cy < imgH; cy += 8) {
      for (let cx = 0; cx < imgW; cx += 8) {
        if ((Math.floor(cx / 8) + Math.floor(cy / 8)) % 2 === 0) {
          ctx.fillStyle = '#222';
          ctx.fillRect(cx * S, cy * S, 8 * S, 8 * S);
        }
      }
    }
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, cw, ch);

  // RPG MV 표준 192×192일 때만 영역 컬러 오버레이 표시
  if (showRegionOverlay && imgW === 192 && imgH === 192) {
    for (const r of MV_REGIONS) {
      ctx.fillStyle = r.color;
      ctx.fillRect(r.x * S, r.y * S, r.w * S, r.h * S);
    }
    // 사분면 구분선
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(96 * S + 0.5, 0); ctx.lineTo(96 * S + 0.5, ch);
    ctx.moveTo(0, 96 * S + 0.5); ctx.lineTo(cw, 96 * S + 0.5);
    ctx.stroke();
  }

  // ── fill 영역 하이라이트 ───────────────────────────────────────────────────
  const flx = fillX * S, fly = fillY * S, flw = fillW * S, flh = fillH * S;

  ctx.fillStyle = 'rgba(80,200,100,0.2)';
  ctx.fillRect(flx, fly, flw, flh);

  ctx.strokeStyle = 'rgba(80,220,80,0.8)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(flx + 0.5, fly + 0.5, flw - 1, flh - 1);
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(80,220,80,0.85)';
  ctx.font = `bold ${7 * S}px sans-serif`;
  ctx.fillText('fill', flx + 2 * S, fly + 9 * S);

  // ── 프레임 영역 하이라이트 ─────────────────────────────────────────────────
  const fx = frameX * S, fy = frameY * S, fw = frameW * S, fh = frameH * S;

  // 프레임 반투명 오버레이
  ctx.fillStyle = 'rgba(38,117,191,0.22)';
  ctx.fillRect(fx, fy, fw, fh);

  // 프레임 테두리 (흰색 실선)
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1);

  // ── 9-slice 경계선 (프레임 내부) ──────────────────────────────────────────
  const maxCs = Math.floor(Math.min(frameW, frameH) / 2) - 1;
  const cs = clamp(cornerSize, 1, Math.max(1, maxCs));

  ctx.strokeStyle = 'rgba(255, 220, 0, 0.95)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);

  const vx1 = (frameX + cs) * S + 0.5;
  const vx2 = (frameX + frameW - cs) * S + 0.5;
  ctx.beginPath(); ctx.moveTo(vx1, fy); ctx.lineTo(vx1, fy + fh); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(vx2, fy); ctx.lineTo(vx2, fy + fh); ctx.stroke();

  const hy1 = (frameY + cs) * S + 0.5;
  const hy2 = (frameY + frameH - cs) * S + 0.5;
  ctx.beginPath(); ctx.moveTo(fx, hy1); ctx.lineTo(fx + fw, hy1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(fx, hy2); ctx.lineTo(fx + fw, hy2); ctx.stroke();

  ctx.setLineDash([]);

  // ── slice 라인 호버 하이라이트 ─────────────────────────────────────────────
  if (hoverHit?.type === 'slice') {
    const HW = SLICE_HIT * S;  // 하이라이트 너비 (픽셀)
    ctx.fillStyle = 'rgba(80,255,120,0.25)';
    ctx.strokeStyle = 'rgba(80,255,120,0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    if (hoverHit.axis === 'x') {
      const lx = (hoverHit.nearFirst ? vx1 : vx2) - HW / 2;
      ctx.fillRect(lx, fy, HW, fh);
      ctx.strokeRect(lx + 0.5, fy + 0.5, HW - 1, fh - 1);
    } else {
      const ly = (hoverHit.nearFirst ? hy1 : hy2) - HW / 2;
      ctx.fillRect(fx, ly, fw, HW);
      ctx.strokeRect(fx + 0.5, ly + 0.5, fw - 1, HW - 1);
    }
  }

  // 코너 강조 박스
  ctx.strokeStyle = 'rgba(255,220,0,0.6)';
  ctx.lineWidth = 0.5;
  for (const c of [
    { x: frameX, y: frameY },
    { x: frameX + frameW - cs, y: frameY },
    { x: frameX, y: frameY + frameH - cs },
    { x: frameX + frameW - cs, y: frameY + frameH - cs },
  ]) {
    ctx.strokeRect(c.x * S + 0.5, c.y * S + 0.5, cs * S - 1, cs * S - 1);
  }

  // 영역 라벨
  if (showLabels && showRegionOverlay && imgW === 192 && imgH === 192) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `bold ${9 * S}px sans-serif`;
    ctx.fillText('배경', 4 * S, 11 * S);
    ctx.fillText('배경 반복', 4 * S, 100 * S);
    ctx.fillText('프레임', 100 * S, 11 * S);
    ctx.fillText('커서/화살표', 100 * S, 100 * S);
  }

  // cornerSize 수치 표시
  ctx.fillStyle = 'rgba(255,220,0,0.9)';
  ctx.font = `${7 * S}px sans-serif`;
  ctx.fillText(`${cs}px`, (frameX + 1) * S, (frameY + cs / 2 + 4) * S);

  // 프레임 크기 수치 표시
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `${6 * S}px sans-serif`;
  ctx.fillText(`${frameW}×${frameH}`, fx + 2, fy + fh - 3 * S);
}

// ─── 히트 판정 ────────────────────────────────────────────────────────────────

function getHit(
  ix: number, iy: number,
  frameX: number, frameY: number, frameW: number, frameH: number,
  fillX: number, fillY: number, fillW: number, fillH: number,
  cs: number,
): DragState {
  const csC = clamp(cs, 1, Math.floor(Math.min(frameW, frameH) / 2) - 1);
  const inFX = ix >= frameX && ix <= frameX + frameW;
  const inFY = iy >= frameY && iy <= frameY + frameH;

  // 9-slice 경계선 (프레임 내부)
  const vx1 = frameX + csC, vx2 = frameX + frameW - csC;
  const hy1 = frameY + csC, hy2 = frameY + frameH - csC;
  if (inFY && Math.abs(ix - vx1) <= SLICE_HIT) return { type: 'slice', axis: 'x', nearFirst: true };
  if (inFY && Math.abs(ix - vx2) <= SLICE_HIT) return { type: 'slice', axis: 'x', nearFirst: false };
  if (inFX && Math.abs(iy - hy1) <= SLICE_HIT) return { type: 'slice', axis: 'y', nearFirst: true };
  if (inFX && Math.abs(iy - hy2) <= SLICE_HIT) return { type: 'slice', axis: 'y', nearFirst: false };

  // 프레임 테두리 리사이즈 (외곽 EDGE_HIT px)
  const onLeft   = inFY && Math.abs(ix - frameX) <= EDGE_HIT;
  const onRight  = inFY && Math.abs(ix - (frameX + frameW)) <= EDGE_HIT;
  const onTop    = inFX && Math.abs(iy - frameY) <= EDGE_HIT;
  const onBottom = inFX && Math.abs(iy - (frameY + frameH)) <= EDGE_HIT;
  if (onLeft)   return { type: 'frame_resize', edge: 'left',   startFX: frameX, startFY: frameY, startFW: frameW, startFH: frameH };
  if (onRight)  return { type: 'frame_resize', edge: 'right',  startFX: frameX, startFY: frameY, startFW: frameW, startFH: frameH };
  if (onTop)    return { type: 'frame_resize', edge: 'top',    startFX: frameX, startFY: frameY, startFW: frameW, startFH: frameH };
  if (onBottom) return { type: 'frame_resize', edge: 'bottom', startFX: frameX, startFY: frameY, startFW: frameW, startFH: frameH };

  // 프레임 내부 — 이동
  if (inFX && inFY) return { type: 'frame_move', ox: ix - frameX, oy: iy - frameY, startFX: frameX, startFY: frameY };

  // fill 영역 테두리 리사이즈
  const inFlX = ix >= fillX && ix <= fillX + fillW;
  const inFlY = iy >= fillY && iy <= fillY + fillH;
  const onFlLeft   = inFlY && Math.abs(ix - fillX) <= EDGE_HIT;
  const onFlRight  = inFlY && Math.abs(ix - (fillX + fillW)) <= EDGE_HIT;
  const onFlTop    = inFlX && Math.abs(iy - fillY) <= EDGE_HIT;
  const onFlBottom = inFlX && Math.abs(iy - (fillY + fillH)) <= EDGE_HIT;
  if (onFlLeft)   return { type: 'fill_resize', edge: 'left',   startFX: fillX, startFY: fillY, startFW: fillW, startFH: fillH };
  if (onFlRight)  return { type: 'fill_resize', edge: 'right',  startFX: fillX, startFY: fillY, startFW: fillW, startFH: fillH };
  if (onFlTop)    return { type: 'fill_resize', edge: 'top',    startFX: fillX, startFY: fillY, startFW: fillW, startFH: fillH };
  if (onFlBottom) return { type: 'fill_resize', edge: 'bottom', startFX: fillX, startFY: fillY, startFW: fillW, startFH: fillH };

  // fill 내부 — 이동
  if (inFlX && inFlY) return { type: 'fill_move', ox: ix - fillX, oy: iy - fillY, startFX: fillX, startFY: fillY };

  return null;
}

function getCursor(hit: DragState): string {
  if (!hit) return 'default';
  if (hit.type === 'slice') return hit.axis === 'x' ? 'ew-resize' : 'ns-resize';
  if (hit.type === 'frame_move' || hit.type === 'fill_move') return 'move';
  if (hit.type === 'frame_resize' || hit.type === 'fill_resize') {
    if (hit.edge === 'left' || hit.edge === 'right') return 'ew-resize';
    return 'ns-resize';
  }
  return 'default';
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function UIEditorFrameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const hoverHitRef = useRef<DragState>(null);
  const [imgSize, setImgSize] = useState({ w: 192, h: 192 });

  const projectPath   = useEditorStore((s) => s.projectPath);
  const uiSelectedSkin = useEditorStore((s) => s.uiSelectedSkin);
  const uiSkinCornerSize = useEditorStore((s) => s.uiSkinCornerSize);
  const uiSkinFrameX  = useEditorStore((s) => s.uiSkinFrameX);
  const uiSkinFrameY  = useEditorStore((s) => s.uiSkinFrameY);
  const uiSkinFrameW  = useEditorStore((s) => s.uiSkinFrameW);
  const uiSkinFrameH  = useEditorStore((s) => s.uiSkinFrameH);
  const uiSkinFillX   = useEditorStore((s) => s.uiSkinFillX);
  const uiSkinFillY   = useEditorStore((s) => s.uiSkinFillY);
  const uiSkinFillW   = useEditorStore((s) => s.uiSkinFillW);
  const uiSkinFillH   = useEditorStore((s) => s.uiSkinFillH);
  const uiShowSkinLabels = useEditorStore((s) => s.uiShowSkinLabels);
  const uiShowCheckerboard = useEditorStore((s) => s.uiShowCheckerboard);
  const uiShowRegionOverlay = useEditorStore((s) => s.uiShowRegionOverlay);
  const setUiSkinCornerSize = useEditorStore((s) => s.setUiSkinCornerSize);
  const setUiSkinFrame = useEditorStore((s) => s.setUiSkinFrame);
  const setUiSkinFill  = useEditorStore((s) => s.setUiSkinFill);

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

  const saveToServer = useCallback(async (fields: Record<string, number>) => {
    const { projectPath: pp, uiSelectedSkin: skin } = useEditorStore.getState();
    if (!pp || !skin) return;
    await fetch(`/api/ui-editor/skins/${encodeURIComponent(skin)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  }, []);

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
      s.uiSkinCornerSize, s.uiShowSkinLabels, s.uiShowCheckerboard, s.uiShowRegionOverlay,
      hoverHitRef.current);
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
        s.uiSkinCornerSize, s.uiShowSkinLabels, s.uiShowCheckerboard, s.uiShowRegionOverlay,
        hoverHitRef.current);
    };
    img.onerror = () => {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f66';
      ctx.font = '14px sans-serif';
      ctx.fillText(`스킨을 불러올 수 없음: ${uiSelectedSkin}`, 8, 20);
    };
    img.src = `/img/system/${uiSelectedSkin}.png?v=${Date.now()}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath, uiSelectedSkin]);

  useEffect(() => { redraw(); }, [redraw, uiSkinCornerSize, uiSkinFrameX, uiSkinFrameY, uiSkinFrameW, uiSkinFrameH, uiSkinFillX, uiSkinFillY, uiSkinFillW, uiSkinFillH, uiShowSkinLabels, uiShowCheckerboard, uiShowRegionOverlay]);

  // 휠 줌 — canvas에 직접 달아야 bubble 차단 없이 확실히 동작함
  useEffect(() => {
    const el = canvasRef.current;
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
    const hit = getHit(coords.ix, coords.iy, s.uiSkinFrameX, s.uiSkinFrameY, s.uiSkinFrameW, s.uiSkinFrameH, s.uiSkinFillX, s.uiSkinFillY, s.uiSkinFillW, s.uiSkinFillH, s.uiSkinCornerSize);
    if (!hit) return;
    e.preventDefault();
    dragRef.current = hit;
    document.body.style.cursor = getCursor(hit);

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
      }
    };

    const onUp = async () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const st = useEditorStore.getState();
      if (drag.type === 'slice') {
        await saveToServer({ cornerSize: st.uiSkinCornerSize });
      } else if (drag.type === 'fill_move' || drag.type === 'fill_resize') {
        await saveToServer({ fillX: st.uiSkinFillX, fillY: st.uiSkinFillY, fillW: st.uiSkinFillW, fillH: st.uiSkinFillH });
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
    const coords = toImageCoords(e.clientX, e.clientY);
    if (!coords) return;
    const s = useEditorStore.getState();
    const hit = getHit(coords.ix, coords.iy, s.uiSkinFrameX, s.uiSkinFrameY, s.uiSkinFrameW, s.uiSkinFrameH, s.uiSkinFillX, s.uiSkinFillY, s.uiSkinFillW, s.uiSkinFillH, s.uiSkinCornerSize);
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
        <div style={{ width: canvasCssW * zoom, height: canvasCssH * zoom, position: 'relative', flexShrink: 0 }}>
          <canvas
            ref={canvasRef}
            className="ui-frame-canvas"
            style={{
              imageRendering: 'pixelated',
              display: 'block',
              position: 'absolute',
              top: 0, left: 0,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
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
