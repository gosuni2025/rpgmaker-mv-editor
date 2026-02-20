import React, { useEffect, useRef, useState } from 'react';

// ─── 상수 (Window_Message / VisualNovelMode 기본값) ───
const GW = 816;
const GH = 624;
const WIN_H = 180;
const FACE_SZ = 144;
const PAD = 12;
const LINE_H = 36;

const VN_X = 60;
const VN_Y = 40;
const VN_W = 700;
const VN_H = 520;
const VN_OVERLAY_ALPHA = 120 / 255;
const VN_SPEAKER_COLOR = '#ffe066';

// ─── 이미지 캐시 (face/window skin용) ───
const imgCache: Record<string, HTMLImageElement | null> = {};
function loadImg(src: string): Promise<HTMLImageElement | null> {
  if (src in imgCache) return Promise.resolve(imgCache[src]);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { imgCache[src] = img; resolve(img); };
    img.onerror = () => { imgCache[src] = null; resolve(null); };
    img.src = src;
  });
}

// ─── Window 폴백 (Window.png 없을 때) ───
function drawWindowFallback(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.globalAlpha = 0.88;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(8,14,40,0.96)');
  g.addColorStop(1, 'rgba(4,8,22,0.98)');
  ctx.fillStyle = g;
  rrect(ctx, x, y, w, h, 6); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(160,200,255,0.75)'; ctx.lineWidth = 2;
  rrect(ctx, x + 1, y + 1, w - 2, h - 2, 5); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,100,200,0.4)'; ctx.lineWidth = 1;
  rrect(ctx, x + 4, y + 4, w - 8, h - 8, 3); ctx.stroke();
  ctx.restore();
}
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Window.png 9-slice ───
function drawWindowPng(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.globalAlpha = 0.82;
  const off = document.createElement('canvas');
  off.width = 64; off.height = 64;
  off.getContext('2d')!.drawImage(img, 0, 0, 64, 64, 0, 0, 64, 64);
  const pat = ctx.createPattern(off, 'repeat');
  if (pat) { ctx.fillStyle = pat; ctx.fillRect(x + 4, y + 4, w - 8, h - 8); }
  ctx.globalAlpha = 1;
  const M = 12, bx = 64, by = 64, bw = 64, bh = 64;
  const sl = [
    [bx, by, M, M, x, y, M, M], [bx+bw-M, by, M, M, x+w-M, y, M, M],
    [bx, by+bh-M, M, M, x, y+h-M, M, M], [bx+bw-M, by+bh-M, M, M, x+w-M, y+h-M, M, M],
    [bx+M, by, bw-M*2, M, x+M, y, w-M*2, M], [bx+M, by+bh-M, bw-M*2, M, x+M, y+h-M, w-M*2, M],
    [bx, by+M, M, bh-M*2, x, y+M, M, h-M*2], [bx+bw-M, by+M, M, bh-M*2, x+w-M, y+M, M, h-M*2],
  ];
  for (const [sx, sy, sw, sh, dx, dy, dw, dh] of sl) {
    if (dw > 0 && dh > 0) ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  ctx.restore();
}

// ─── 배경 ───
function drawBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#3a4a5a';
  ctx.fillRect(0, 0, GW, GH);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
  for (let x = 0; x < GW; x += 48) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, GH); ctx.stroke(); }
  for (let y = 0; y < GH; y += 48) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(GW, y + .5); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(GW / 2 - 16, GH / 2 - 56, 32, 56);
}

// ─── Window_Base 오프스크린 렌더러 생성 ───
// Window.prototype.initialize (ThreeContainer 등)를 건너뛰고,
// Window_Base.prototype 메서드(drawTextEx, drawFace, ExtendedText 등)만 사용
function createTextRenderer(contentsW: number, contentsH: number): any | null {
  const WB = (window as any).Window_Base;
  const BitmapCls = (window as any).Bitmap;
  if (!WB || !BitmapCls) return null;

  const bmp = new BitmapCls(Math.max(1, contentsW), Math.max(1, contentsH));
  const r = Object.create(WB.prototype);

  // Window.prototype에 contents/width/height/padding 모두 setter가 있어서
  // 직접 할당하면 _windowContentsSprite/_refreshAllParts 등을 호출하므로
  // defineProperty로 shadow하여 우회
  Object.defineProperty(r, 'contents', { value: bmp,              writable: true, configurable: true });
  Object.defineProperty(r, 'width',    { value: contentsW + 36,   writable: true, configurable: true });
  Object.defineProperty(r, 'height',   { value: contentsH + 36,   writable: true, configurable: true });
  Object.defineProperty(r, 'padding',  { value: 18,               writable: true, configurable: true });

  // windowskin: getter가 this._windowskin을 반환하므로 직접 _windowskin에 설정
  // (setter 우회 → addLoadListener/_onWindowskinLoad 호출 방지)
  r._windowskin = (window as any).ImageManager
    ? (window as any).ImageManager.loadSystem('Window')
    : null;

  // ExtendedText.js 상태 초기화
  r._etTags = null;
  r._etEffectStack = [];
  r._etAnimSegs = [];

  try {
    WB.prototype.resetFontSettings.call(r);
  } catch (e) {
    // $gameSystem 미준비 / windowskin 미로드 시 폴백
    try { bmp.fontFace = 'Dotum, AppleGothic, sans-serif'; } catch (_) {}
    try { bmp.fontSize = 28; } catch (_) {}
    try { bmp.textColor = '#ffffff'; } catch (_) {}
  }

  return r;
}

// ─── 텍스트를 renderer에 그리기 ───
function setupRendererText(renderer: any, lines: string[]) {
  const WB = (window as any).Window_Base;
  if (!WB || !renderer) return;
  renderer.contents.clear();
  renderer._etTags = null;
  renderer._etEffectStack = [];
  renderer._etAnimSegs = [];
  try { WB.prototype.resetFontSettings.call(renderer); } catch (e) {}
  lines.forEach((line, i) => {
    try {
      WB.prototype.drawTextEx.call(renderer, line, 0, i * LINE_H);
    } catch (e) {
      console.warn('[MessagePreview] drawTextEx error:', e);
    }
  });
}

// ─── Props ───
interface MessagePreviewProps {
  faceName: string;
  faceIndex: number;
  background: number;
  positionType: number;
  text: string;
}

export function MessagePreview({ faceName, faceIndex, background, positionType, text }: MessagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<any>(null);
  const rafRef = useRef(0);

  // 최신 props를 ref로 유지 (RAF 클로저에서 사용)
  const propsRef = useRef({ faceName, faceIndex, background, positionType, text });
  propsRef.current = { faceName, faceIndex, background, positionType, text };

  const [imgs, setImgs] = useState<{ face: HTMLImageElement | null; win: HTMLImageElement | null }>({ face: null, win: null });
  const imgsRef = useRef(imgs);
  useEffect(() => { imgsRef.current = imgs; }, [imgs]);

  const [runtimeReady, setRuntimeReady] = useState(() => !!(window as any).Window_Base && !!(window as any).Bitmap);

  const isVNMode = text.split('\n').length > 4;

  // ─── 런타임 로드 대기 ───
  useEffect(() => {
    if (runtimeReady) return;
    const id = setInterval(() => {
      if ((window as any).Window_Base && (window as any).Bitmap) {
        setRuntimeReady(true);
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [runtimeReady]);

  // ─── 이미지 로드 (face, window skin) ───
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadImg('/img/system/Window.png'),
      faceName ? loadImg(`/img/faces/${faceName}.png`) : Promise.resolve(null),
    ]).then(([win, face]) => {
      if (!cancelled) setImgs({ win, face });
    });
    return () => { cancelled = true; };
  }, [faceName]);

  // ─── renderer 생성 + drawTextEx 호출 (텍스트/face 변경 시) ───
  useEffect(() => {
    if (!runtimeReady) return;

    const allLines = text.split('\n');
    const isVN = allLines.length > 4;

    let contentsW: number, contentsH: number;
    if (isVN) {
      const hasFace = !!faceName;
      const textOffsetX = hasFace ? 120 + 12 : 0;
      const speakerH = faceName ? LINE_H : 0;
      contentsW = VN_W - PAD * 2 - textOffsetX;
      // 모든 줄이 들어갈 높이
      contentsH = Math.max(LINE_H, allLines.length * LINE_H);
    } else {
      const hasFace = !!faceName;
      contentsW = GW - PAD * 2 - (hasFace ? FACE_SZ + 16 : 0);
      contentsH = WIN_H - PAD * 2; // 4줄 * 36 = 144 < 156, 충분
    }

    const renderer = createTextRenderer(contentsW, contentsH);
    rendererRef.current = renderer;

    if (renderer) {
      const lines = isVN ? allLines : allLines.slice(0, 4);
      setupRendererText(renderer, lines);
    }
  }, [runtimeReady, text, faceName]);

  // ─── canvas 렌더 함수 ───
  const renderToCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = GW;
    canvas.height = GH;

    const { faceName: fn, faceIndex: fi, background: bg, positionType: pt, text: txt } = propsRef.current;
    const { face: faceImg, win: winImg } = imgsRef.current;
    const renderer = rendererRef.current;
    const isVN = txt.split('\n').length > 4;

    if (isVN) {
      // ── VN 모드 ──
      drawBackground(ctx);
      ctx.fillStyle = `rgba(0,0,0,${VN_OVERLAY_ALPHA})`;
      ctx.fillRect(0, 0, GW, GH);

      if (winImg) drawWindowPng(ctx, winImg, VN_X, VN_Y, VN_W, VN_H);
      else drawWindowFallback(ctx, VN_X, VN_Y, VN_W, VN_H);

      const innerX = VN_X + PAD;
      const innerY = VN_Y + PAD;

      const hasFace = !!(fn && faceImg);
      let textStartX = innerX;
      if (hasFace && faceImg) {
        const col = fi % 4, row = Math.floor(fi / 4);
        ctx.drawImage(faceImg, col * FACE_SZ, row * FACE_SZ, FACE_SZ, FACE_SZ, innerX, innerY, 120, 120);
        textStartX = innerX + 120 + 12;
      }

      let curY = innerY;
      if (fn) {
        ctx.save();
        ctx.fillStyle = '#000000';
        ctx.font = `bold 22px "GameFont","MS PGothic","dotumche","나눔고딕",serif`;
        ctx.fillText(fn, textStartX + 1, curY + 22 + 1);
        ctx.fillStyle = VN_SPEAKER_COLOR;
        ctx.fillText(fn, textStartX, curY + 22);
        ctx.restore();
        curY += LINE_H;
      }

      // 텍스트 Bitmap 합성 (창 내부 클리핑)
      if (renderer) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(textStartX, curY, VN_X + VN_W - textStartX - PAD, VN_Y + VN_H - curY - PAD);
        ctx.clip();
        ctx.drawImage(renderer.contents.canvas, textStartX, curY);
        ctx.restore();
      }

      // 넘침 표시
      const allLines = txt.split('\n');
      const maxLines = Math.floor((VN_Y + VN_H - curY - PAD) / LINE_H);
      if (allLines.length > maxLines) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '14px serif';
        ctx.fillText(`↓ (${allLines.length - maxLines}줄 더 있음)`, textStartX, VN_Y + VN_H - 8);
      }

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '18px serif';
      ctx.fillText('▼', VN_X + VN_W - 22, VN_Y + VN_H - 10);

      ctx.save();
      ctx.fillStyle = 'rgba(255,224,102,0.85)';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('VN MODE', VN_X + 4, VN_Y - 4);
      ctx.restore();

    } else {
      // ── 일반 모드 ──
      drawBackground(ctx);
      if (bg === 1) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, GW, GH); }
      const winY = pt === 0 ? 0 : pt === 1 ? Math.floor((GH - WIN_H) / 2) : GH - WIN_H;

      if (bg !== 2) {
        if (winImg) drawWindowPng(ctx, winImg, 0, winY, GW, WIN_H);
        else drawWindowFallback(ctx, 0, winY, GW, WIN_H);
      }

      const hasFace = !!(fn && faceImg);
      if (hasFace && faceImg) {
        const col = fi % 4, row = Math.floor(fi / 4);
        ctx.drawImage(faceImg, col * FACE_SZ, row * FACE_SZ, FACE_SZ, FACE_SZ, PAD, winY + PAD, FACE_SZ, FACE_SZ);
      }

      const textX = hasFace ? PAD + FACE_SZ + 16 : PAD;

      // 텍스트 Bitmap 합성 (창 내부 클리핑)
      if (renderer) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(textX, winY, GW - textX - PAD, WIN_H);
        ctx.clip();
        ctx.drawImage(renderer.contents.canvas, textX, winY + PAD);
        ctx.restore();
      }

      // ▼ 입력 대기
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '18px serif';
      ctx.fillText('▼', GW - 22, winY + WIN_H - 10);
    }
  };

  // ─── RAF 루프 (항상 실행 — ExtendedText 애니메이션) ───
  useEffect(() => {
    if (!runtimeReady) return;

    let running = true;
    const tick = () => {
      if (!running) return;

      // ExtendedText._time 진행
      const ET = (window as any).ExtendedText;
      if (ET) ET._time += 1 / 60;

      // 애니메이션 패스
      const r = rendererRef.current;
      if (r?._etAnimSegs?.length > 0) {
        try { r._etRunAnimPass(); } catch (e) {}
      }

      renderToCanvas();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeReady]);

  // 이미지 로드 완료 시 즉시 재렌더
  useEffect(() => {
    renderToCanvas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 4 }}>
      {/* 모드 배지 */}
      <div style={{ fontSize: 11, color: isVNMode ? '#ffe066' : '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
        {isVNMode
          ? <><span style={{ background: '#5a4200', border: '1px solid #ffe066', borderRadius: 3, padding: '1px 6px', color: '#ffe066', fontWeight: 'bold' }}>VN MODE</span> 4줄 초과 — Visual Novel 렌더링</>
          : <><span style={{ background: '#1a3a1a', border: '1px solid #4a8', borderRadius: 3, padding: '1px 6px', color: '#4da' }}>NORMAL</span> Window_Message 렌더링</>
        }
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', aspectRatio: `${GW}/${GH}`, display: 'block', imageRendering: 'pixelated', background: '#222' }}
      />

      {!runtimeReady && (
        <div style={{ fontSize: 11, color: '#888' }}>런타임 로딩 중...</div>
      )}
    </div>
  );
}
