export const DISPLAY_SCALE = 3;
export const SLICE_HIT = 5;
export const EDGE_HIT = 6;

// RPG Maker MV 표준 192×192 스킨일 때만 표시하는 영역 안내
interface Region { x: number; y: number; w: number; h: number; color: string; label: string; }
export const MV_REGIONS: Region[] = [
  { x: 0,  y: 0,  w: 96, h: 96,  color: 'rgba(80,200,100,0.15)',  label: '배경' },
  { x: 0,  y: 96, w: 96, h: 96,  color: 'rgba(50,160,80,0.12)',   label: '배경 반복' },
  { x: 96, y: 0,  w: 96, h: 96,  color: 'rgba(38,117,191,0.15)',  label: '프레임' },
  { x: 96, y: 96, w: 96, h: 96,  color: 'rgba(200,120,0,0.12)',   label: '커서/화살표' },
];

export type DragState =
  | { type: 'slice'; axis: 'x' | 'y'; nearFirst: boolean }
  | { type: 'frame_move'; ox: number; oy: number; startFX: number; startFY: number }
  | { type: 'frame_resize'; edge: 'left' | 'right' | 'top' | 'bottom'; startFX: number; startFY: number; startFW: number; startFH: number }
  | { type: 'fill_move'; ox: number; oy: number; startFX: number; startFY: number }
  | { type: 'fill_resize'; edge: 'left' | 'right' | 'top' | 'bottom'; startFX: number; startFY: number; startFW: number; startFH: number }
  | { type: 'cursor_move'; ox: number; oy: number; startCX: number; startCY: number }
  | { type: 'cursor_resize'; edge: 'left' | 'right' | 'top' | 'bottom'; startCX: number; startCY: number; startCW: number; startCH: number }
  | { type: 'gauge_bg_move'; ox: number; oy: number; startX: number; startY: number }
  | { type: 'gauge_bg_resize'; edge: 'left' | 'right' | 'top' | 'bottom'; startX: number; startY: number; startW: number; startH: number }
  | { type: 'gauge_fill_move'; ox: number; oy: number; startX: number; startY: number }
  | { type: 'gauge_fill_resize'; edge: 'left' | 'right' | 'top' | 'bottom'; startX: number; startY: number; startW: number; startH: number }
  | null;

export function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

export function drawSkin(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  imgW: number, imgH: number,
  frameX: number, frameY: number, frameW: number, frameH: number,
  fillX: number, fillY: number, fillW: number, fillH: number,
  cornerSize: number,
  cursorX: number, cursorY: number, cursorW: number, cursorH: number,
  cursorCornerSize: number,
  showLabels: boolean,
  showCheckerboard: boolean,
  showRegionOverlay: boolean,
  hoverHit: DragState,
  activeTab: 'frame' | 'cursor' | 'gauge',
  gaugeBgX?: number, gaugeBgY?: number, gaugeBgW?: number, gaugeBgH?: number,
  gaugeFillX?: number, gaugeFillY?: number, gaugeFillW?: number, gaugeFillH?: number,
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

  // 게이지 탭 전용 드로잉
  if (activeTab === 'gauge') {
    const bgX = (gaugeBgX ?? 0) * S, bgY = (gaugeBgY ?? 0) * S;
    const bgW = (gaugeBgW ?? 0) * S, bgH = (gaugeBgH ?? 0) * S;
    const fX = (gaugeFillX ?? 0) * S, fY = (gaugeFillY ?? 0) * S;
    const fW = (gaugeFillW ?? 0) * S, fH = (gaugeFillH ?? 0) * S;

    if (bgW > 0 && bgH > 0) {
      ctx.fillStyle = 'rgba(50,120,255,0.18)';
      ctx.fillRect(bgX, bgY, bgW, bgH);
      ctx.strokeStyle = 'rgba(80,160,255,0.9)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(bgX + 0.5, bgY + 0.5, bgW - 1, bgH - 1);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(80,160,255,0.9)';
      ctx.font = `bold ${7 * S}px sans-serif`;
      ctx.fillText('gauge bg', bgX + 2 * S, bgY + 9 * S);
    }

    if (fW > 0 && fH > 0) {
      ctx.fillStyle = 'rgba(255,120,30,0.18)';
      ctx.fillRect(fX, fY, fW, fH);
      ctx.strokeStyle = 'rgba(255,160,30,0.9)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(fX + 0.5, fY + 0.5, fW - 1, fH - 1);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,160,30,0.9)';
      ctx.font = `bold ${7 * S}px sans-serif`;
      ctx.fillText('gauge fill', fX + 2 * S, fY + 9 * S);
    }
    return;
  }

  // 비활성 탭 영역: 커서 모드에서는 프레임/fill 숨김, 프레임 모드에서는 커서 흐리게
  const cursorAlpha = activeTab === 'cursor' ? 1 : 0.25;

  // ── fill/프레임/9-slice 하이라이트 (프레임 탭에서만 표시) ──────────────────
  const cs_val = clamp(cornerSize, 1, Math.max(1, Math.floor(Math.min(frameW, frameH) / 2) - 1));
  const fx = frameX * S, fy = frameY * S, fw = frameW * S, fh = frameH * S;
  const vx1 = (frameX + cs_val) * S + 0.5;
  const vx2 = (frameX + frameW - cs_val) * S + 0.5;
  const hy1 = (frameY + cs_val) * S + 0.5;
  const hy2 = (frameY + frameH - cs_val) * S + 0.5;

  if (activeTab === 'frame') {
    const flx = fillX * S, fly = fillY * S, flw = fillW * S, flh = fillH * S;

    // fill 영역
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

    // 프레임 반투명 오버레이
    ctx.fillStyle = 'rgba(38,117,191,0.22)';
    ctx.fillRect(fx, fy, fw, fh);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1);

    // 9-slice 경계선
    ctx.strokeStyle = 'rgba(255, 220, 0, 0.95)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(vx1, fy); ctx.lineTo(vx1, fy + fh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(vx2, fy); ctx.lineTo(vx2, fy + fh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx, hy1); ctx.lineTo(fx + fw, hy1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx, hy2); ctx.lineTo(fx + fw, hy2); ctx.stroke();
    ctx.setLineDash([]);

    // slice 호버 하이라이트
    if (hoverHit?.type === 'slice') {
      const HW = SLICE_HIT * S;
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
      { x: frameX + frameW - cs_val, y: frameY },
      { x: frameX, y: frameY + frameH - cs_val },
      { x: frameX + frameW - cs_val, y: frameY + frameH - cs_val },
    ]) {
      ctx.strokeRect(c.x * S + 0.5, c.y * S + 0.5, cs_val * S - 1, cs_val * S - 1);
    }
  }

  // ── 커서 영역 하이라이트 ───────────────────────────────────────────────────
  ctx.globalAlpha = cursorAlpha;
  const crx = cursorX * S, cry = cursorY * S, crw = cursorW * S, crh = cursorH * S;

  ctx.fillStyle = 'rgba(255,160,0,0.18)';
  ctx.fillRect(crx, cry, crw, crh);

  ctx.strokeStyle = 'rgba(255,160,0,0.9)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(crx + 0.5, cry + 0.5, crw - 1, crh - 1);
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255,160,0,0.9)';
  ctx.font = `bold ${7 * S}px sans-serif`;
  ctx.fillText('cursor', crx + 2 * S, cry + 9 * S);

  // 커서 9-slice 경계선
  if (cursorW >= 4 && cursorH >= 4) {
    const curMaxCs = Math.floor(Math.min(cursorW, cursorH) / 2) - 1;
    const ccs = clamp(cursorCornerSize, 1, Math.max(1, curMaxCs));
    ctx.strokeStyle = 'rgba(255,160,0,0.5)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    const cvx1 = (cursorX + ccs) * S + 0.5;
    const cvx2 = (cursorX + cursorW - ccs) * S + 0.5;
    const chy1 = (cursorY + ccs) * S + 0.5;
    const chy2 = (cursorY + cursorH - ccs) * S + 0.5;
    ctx.beginPath(); ctx.moveTo(cvx1, cry); ctx.lineTo(cvx1, cry + crh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cvx2, cry); ctx.lineTo(cvx2, cry + crh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(crx, chy1); ctx.lineTo(crx + crw, chy1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(crx, chy2); ctx.lineTo(crx + crw, chy2); ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.globalAlpha = 1;
  // 영역 라벨 (프레임 탭에서만)
  if (activeTab === 'frame' && showLabels && showRegionOverlay && imgW === 192 && imgH === 192) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `bold ${9 * S}px sans-serif`;
    ctx.fillText('배경', 4 * S, 11 * S);
    ctx.fillText('배경 반복', 4 * S, 100 * S);
    ctx.fillText('프레임', 100 * S, 11 * S);
    ctx.fillText('커서/화살표', 100 * S, 100 * S);
  }

  // cornerSize / 프레임 크기 수치 표시 (프레임 탭에서만)
  if (activeTab === 'frame') {
    ctx.fillStyle = 'rgba(255,220,0,0.9)';
    ctx.font = `${7 * S}px sans-serif`;
    ctx.fillText(`${cs_val}px`, (frameX + 1) * S, (frameY + cs_val / 2 + 4) * S);

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${6 * S}px sans-serif`;
    ctx.fillText(`${frameW}×${frameH}`, fx + 2, fy + fh - 3 * S);
  }
}

// ─── 히트 판정 ────────────────────────────────────────────────────────────────

export function getHit(
  ix: number, iy: number,
  frameX: number, frameY: number, frameW: number, frameH: number,
  fillX: number, fillY: number, fillW: number, fillH: number,
  cursorX: number, cursorY: number, cursorW: number, cursorH: number,
  cs: number,
  activeTab: 'frame' | 'cursor' | 'gauge',
  gaugeBgX?: number, gaugeBgY?: number, gaugeBgW?: number, gaugeBgH?: number,
  gaugeFillX?: number, gaugeFillY?: number, gaugeFillW?: number, gaugeFillH?: number,
): DragState {
  const csC = clamp(cs, 1, Math.floor(Math.min(frameW, frameH) / 2) - 1);
  const inFX = ix >= frameX && ix <= frameX + frameW;
  const inFY = iy >= frameY && iy <= frameY + frameH;

  // 게이지 탭: 배경/채움 영역만 처리
  if (activeTab === 'gauge') {
    const gbX = gaugeBgX ?? 0, gbY = gaugeBgY ?? 0, gbW = gaugeBgW ?? 0, gbH = gaugeBgH ?? 0;
    const gfX = gaugeFillX ?? 0, gfY = gaugeFillY ?? 0, gfW = gaugeFillW ?? 0, gfH = gaugeFillH ?? 0;

    const inGbX = ix >= gbX && ix <= gbX + gbW;
    const inGbY = iy >= gbY && iy <= gbY + gbH;
    if (gbW > 0 && gbH > 0) {
      const onLeft   = inGbY && Math.abs(ix - gbX) <= EDGE_HIT;
      const onRight  = inGbY && Math.abs(ix - (gbX + gbW)) <= EDGE_HIT;
      const onTop    = inGbX && Math.abs(iy - gbY) <= EDGE_HIT;
      const onBottom = inGbX && Math.abs(iy - (gbY + gbH)) <= EDGE_HIT;
      if (onLeft)   return { type: 'gauge_bg_resize', edge: 'left',   startX: gbX, startY: gbY, startW: gbW, startH: gbH };
      if (onRight)  return { type: 'gauge_bg_resize', edge: 'right',  startX: gbX, startY: gbY, startW: gbW, startH: gbH };
      if (onTop)    return { type: 'gauge_bg_resize', edge: 'top',    startX: gbX, startY: gbY, startW: gbW, startH: gbH };
      if (onBottom) return { type: 'gauge_bg_resize', edge: 'bottom', startX: gbX, startY: gbY, startW: gbW, startH: gbH };
      if (inGbX && inGbY) return { type: 'gauge_bg_move', ox: ix - gbX, oy: iy - gbY, startX: gbX, startY: gbY };
    }

    const inGfX = ix >= gfX && ix <= gfX + gfW;
    const inGfY = iy >= gfY && iy <= gfY + gfH;
    if (gfW > 0 && gfH > 0) {
      const onLeft   = inGfY && Math.abs(ix - gfX) <= EDGE_HIT;
      const onRight  = inGfY && Math.abs(ix - (gfX + gfW)) <= EDGE_HIT;
      const onTop    = inGfX && Math.abs(iy - gfY) <= EDGE_HIT;
      const onBottom = inGfX && Math.abs(iy - (gfY + gfH)) <= EDGE_HIT;
      if (onLeft)   return { type: 'gauge_fill_resize', edge: 'left',   startX: gfX, startY: gfY, startW: gfW, startH: gfH };
      if (onRight)  return { type: 'gauge_fill_resize', edge: 'right',  startX: gfX, startY: gfY, startW: gfW, startH: gfH };
      if (onTop)    return { type: 'gauge_fill_resize', edge: 'top',    startX: gfX, startY: gfY, startW: gfW, startH: gfH };
      if (onBottom) return { type: 'gauge_fill_resize', edge: 'bottom', startX: gfX, startY: gfY, startW: gfW, startH: gfH };
      if (inGfX && inGfY) return { type: 'gauge_fill_move', ox: ix - gfX, oy: iy - gfY, startX: gfX, startY: gfY };
    }

    // 게이지 탭: 배경이 없으면 드래그로 새 배경 영역 생성 가능하도록 null 반환
    return null;
  }

  // 커서 탭에서는 프레임/fill 드래그 비활성화
  if (activeTab === 'cursor') {
    const inCrX = ix >= cursorX && ix <= cursorX + cursorW;
    const inCrY = iy >= cursorY && iy <= cursorY + cursorH;
    const onCrLeft   = inCrY && Math.abs(ix - cursorX) <= EDGE_HIT;
    const onCrRight  = inCrY && Math.abs(ix - (cursorX + cursorW)) <= EDGE_HIT;
    const onCrTop    = inCrX && Math.abs(iy - cursorY) <= EDGE_HIT;
    const onCrBottom = inCrX && Math.abs(iy - (cursorY + cursorH)) <= EDGE_HIT;
    if (onCrLeft)   return { type: 'cursor_resize', edge: 'left',   startCX: cursorX, startCY: cursorY, startCW: cursorW, startCH: cursorH };
    if (onCrRight)  return { type: 'cursor_resize', edge: 'right',  startCX: cursorX, startCY: cursorY, startCW: cursorW, startCH: cursorH };
    if (onCrTop)    return { type: 'cursor_resize', edge: 'top',    startCX: cursorX, startCY: cursorY, startCW: cursorW, startCH: cursorH };
    if (onCrBottom) return { type: 'cursor_resize', edge: 'bottom', startCX: cursorX, startCY: cursorY, startCW: cursorW, startCH: cursorH };
    if (inCrX && inCrY) return { type: 'cursor_move', ox: ix - cursorX, oy: iy - cursorY, startCX: cursorX, startCY: cursorY };
    return null;
  }

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

  // 커서 영역 테두리 리사이즈
  const inCrX = ix >= cursorX && ix <= cursorX + cursorW;
  const inCrY = iy >= cursorY && iy <= cursorY + cursorH;
  const onCrLeft   = inCrY && Math.abs(ix - cursorX) <= EDGE_HIT;
  const onCrRight  = inCrY && Math.abs(ix - (cursorX + cursorW)) <= EDGE_HIT;
  const onCrTop    = inCrX && Math.abs(iy - cursorY) <= EDGE_HIT;
  const onCrBottom = inCrX && Math.abs(iy - (cursorY + cursorH)) <= EDGE_HIT;
  if (onCrLeft)   return { type: 'cursor_resize', edge: 'left',   startCX: cursorX, startCY: cursorY, startCW: cursorW, startCH: cursorH };
  if (onCrRight)  return { type: 'cursor_resize', edge: 'right',  startCX: cursorX, startCY: cursorY, startCW: cursorW, startCH: cursorH };
  if (onCrTop)    return { type: 'cursor_resize', edge: 'top',    startCX: cursorX, startCY: cursorY, startCW: cursorW, startCH: cursorH };
  if (onCrBottom) return { type: 'cursor_resize', edge: 'bottom', startCX: cursorX, startCY: cursorY, startCW: cursorW, startCH: cursorH };

  // 커서 내부 — 이동
  if (inCrX && inCrY) return { type: 'cursor_move', ox: ix - cursorX, oy: iy - cursorY, startCX: cursorX, startCY: cursorY };

  return null;
}

export function getCursor(hit: DragState): string {
  if (!hit) return 'default';
  if (hit.type === 'slice') return hit.axis === 'x' ? 'ew-resize' : 'ns-resize';
  if (hit.type === 'frame_move' || hit.type === 'fill_move' || hit.type === 'cursor_move' || hit.type === 'gauge_bg_move' || hit.type === 'gauge_fill_move') return 'move';
  if (hit.type === 'frame_resize' || hit.type === 'fill_resize' || hit.type === 'cursor_resize' || hit.type === 'gauge_bg_resize' || hit.type === 'gauge_fill_resize') {
    if (hit.edge === 'left' || hit.edge === 'right') return 'ew-resize';
    return 'ns-resize';
  }
  return 'default';
}
