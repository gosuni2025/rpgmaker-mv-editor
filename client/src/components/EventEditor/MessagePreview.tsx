import React, { useEffect, useRef, useState, useCallback } from 'react';
import { parseExtendedText, AnyTextSeg, TextBlockSeg } from './extendedTextDefs';

// ─── RPG Maker MV 기본 텍스트 색상 팔레트 (\C[n]) ───
const TEXT_COLORS: string[] = [
  '#ffffff', '#20a0d6', '#ff784c', '#66cc40',
  '#99ccff', '#ccc0ff', '#ffffa0', '#c8c8c8',
  '#e8e8e8', '#2080cc', '#ff3810', '#00a010',
  '#3e9ade', '#875496', '#ddd000', '#666666',
  '#00d8d8', '#c8a800', '#e82878', '#d8d8b8',
  '#8888cc', '#a06020', '#d8a800', '#888800',
  '#00e000', '#0088aa', '#a06020', '#4444aa',
  '#880000', '#002888', '#444400', '#000000',
];

const GW = 816;
const GH = 624;
const WIN_H = 180;
const FACE_SZ = 144;
const PAD = 12;
const LINE_H = 36;
const BASE_FONT = 26;
const ICON_SZ = 32;
const ICON_COLS = 16;

// VN 모드 상수 (VisualNovelMode.js 기본값)
const VN_X = 60;
const VN_Y = 40;
const VN_W = 700;
const VN_H = 520;
const VN_OVERLAY_ALPHA = 120 / 255;
const VN_SPEAKER_COLOR = '#ffe066';

// 타이프라이터: 2프레임에 1글자 (RPG Maker MV 기본)
const CHARS_PER_FRAME = 0.5;

// ─── 이미지 캐시 ───
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

// ─── DrawSeg 타입 (애니메이션 파라미터 포함) ───
interface DrawText {
  type: 'text';
  text: string;
  color: string;
  size: number;
  outlineColor?: string;
  outlineWidth?: number;
  gradient?: [string, string];
  // 확장 태그 애니메이션
  shakeAmp?: number;
  shakeSpeed?: number;
  gradWaveSpeed?: number;
  fadeFrames?: number;      // 페이드인 지속 프레임
  dissolveSpeed?: number;
  blurFadeDuration?: number; // 흐릿하게 나타나기 지속 프레임
}
interface DrawIcon { type: 'icon'; index: number; size: number; }
interface DrawWaiter { type: 'waiter'; size: number; }
type DrawSeg = DrawText | DrawIcon | DrawWaiter;

// ─── 줄 → DrawSeg[] 변환 ───
function buildDrawSegs(line: string): DrawSeg[] {
  const result: DrawSeg[] = [];
  let color = '#ffffff';
  let size = BASE_FONT;

  function processSegs(
    segs: AnyTextSeg[],
    overColor?: string,
    outline?: { color: string; width: number },
    gradient?: [string, string],
    shakeAmp?: number, shakeSpeed?: number,
    gradWaveSpeed?: number,
    fadeFrames?: number,
    dissolveSpeed?: number,
    blurFadeDuration?: number,
  ) {
    for (const seg of segs) {
      if (seg.type === 'escape') {
        const r = seg.raw;
        const cM = r.match(/^\\C\[(\d+)\]$/);
        const iM = r.match(/^\\I\[(\d+)\]$/);
        const vM = r.match(/^\\V\[(\d+)\]$/);
        const nM = r.match(/^\\N\[(\d+)\]$/);
        const pM = r.match(/^\\P\[(\d+)\]$/);
        if (cM) { color = TEXT_COLORS[+cM[1]] || '#ffffff'; }
        else if (iM) { result.push({ type: 'icon', index: +iM[1], size }); }
        else if (vM) { result.push({ type: 'text', text: `#${vM[1]}변수`, color: '#ffffaa', size }); }
        else if (nM) { result.push({ type: 'text', text: `[이름${nM[1]}]`, color: '#aaffaa', size }); }
        else if (pM) { result.push({ type: 'text', text: `[파티${pM[1]}]`, color: '#aaffaa', size }); }
        else if (r === '\\G') { result.push({ type: 'text', text: '골드', color: overColor || color, size }); }
        else if (r === '\\{') { size = Math.min(size + 4, BASE_FONT + 16); }
        else if (r === '\\}') { size = Math.max(size - 4, BASE_FONT - 8); }
        else if (r === '\\!') { result.push({ type: 'waiter', size }); }
      } else if (seg.type === 'text') {
        if (seg.text) {
          result.push({
            type: 'text', text: seg.text,
            color: overColor || color, size,
            outlineColor: outline?.color, outlineWidth: outline?.width,
            gradient, shakeAmp, shakeSpeed, gradWaveSpeed, fadeFrames, dissolveSpeed, blurFadeDuration,
          });
        }
      } else if (seg.type === 'block') {
        const b = seg as TextBlockSeg;
        let nc = overColor, no = outline, ng = gradient;
        let sa = shakeAmp, ss = shakeSpeed, gw = gradWaveSpeed, ff = fadeFrames, ds = dissolveSpeed, bf = blurFadeDuration;

        if (b.tag === 'color') nc = b.params.value || overColor;
        else if (b.tag === 'outline') no = { color: b.params.color || '#000000', width: +(b.params.thickness || '3') };
        else if (b.tag === 'gradient') ng = [b.params.color1 || '#ffffff', b.params.color2 || '#000000'];
        else if (b.tag === 'shake') { sa = +(b.params.amplitude || '3'); ss = +(b.params.speed || '1'); }
        else if (b.tag === 'gradient-wave') gw = +(b.params.speed || '1');
        else if (b.tag === 'fade') ff = +(b.params.duration || '60');
        else if (b.tag === 'dissolve') ds = +(b.params.speed || '1');
        else if (b.tag === 'blur-fade') bf = +(b.params.duration || '60');
        // hologram, typewriter → 정적 미리보기에서 기본 처리

        processSegs(b.children, nc, no, ng, sa, ss, gw, ff, ds, bf);
      }
    }
  }

  processSegs(parseExtendedText(line));
  return result;
}

// ─── 전체 글자 수 계산 (타이프라이터용) ───
function countTotalChars(lines: string[]): number {
  let total = 0;
  for (const line of lines) {
    for (const seg of buildDrawSegs(line)) {
      if (seg.type === 'text') total += seg.text.length;
      else total += 1;
    }
  }
  return total;
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

// ─── 한 줄 텍스트 렌더링 (charBudget: 남은 표시 가능 글자, animFrame: 애니 프레임) ───
function drawLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number, baselineY: number, maxW: number,
  iconImg: HTMLImageElement | null,
  charBudget: { remaining: number },
  animFrame: number,
) {
  const segs = buildDrawSegs(line);
  let cx = x;
  let segIdx = 0; // 세그먼트 내 offset (dissolve 등에 사용)

  for (const seg of segs) {
    if (cx >= x + maxW) break;
    if (charBudget.remaining <= 0) break;

    if (seg.type === 'icon') {
      if (iconImg) {
        const col = seg.index % ICON_COLS;
        const row = Math.floor(seg.index / ICON_COLS);
        ctx.drawImage(iconImg, col * ICON_SZ, row * ICON_SZ, ICON_SZ, ICON_SZ, cx, baselineY - seg.size + 4, seg.size, seg.size);
      } else {
        ctx.fillStyle = 'rgba(180,180,180,0.4)';
        ctx.fillRect(cx, baselineY - seg.size + 4, seg.size, seg.size);
      }
      cx += seg.size + 2;
      charBudget.remaining -= 1;
    } else if (seg.type === 'waiter') {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = `${seg.size * 0.55}px serif`;
      ctx.fillText('▼', cx, baselineY);
      cx += seg.size * 0.55 + 2;
      ctx.restore();
      charBudget.remaining -= 1;
    } else if (seg.type === 'text' && seg.text) {
      const fs = seg.size;
      const fontStr = `${fs}px "GameFont","MS PGothic","dotumche","나눔고딕",serif`;
      ctx.font = fontStr;

      // 타이프라이터: charBudget만큼만 표시
      const visibleText = seg.text.slice(0, charBudget.remaining);
      charBudget.remaining -= visibleText.length;
      if (!visibleText) { segIdx++; continue; }

      ctx.font = fontStr;
      const tw = ctx.measureText(visibleText).width;

      ctx.save();

      // ── fade 효과: 페이드인 (animFrame=0 정적 모드는 완료 상태=alpha 1) ──
      if (seg.fadeFrames) {
        ctx.globalAlpha = animFrame <= 0 ? 1 : Math.min(1, animFrame / seg.fadeFrames);
      }

      // ── dissolve 효과: 글자별 페이드인 ──
      if (seg.dissolveSpeed) {
        ctx.globalAlpha = animFrame <= 0 ? 1 : Math.min(1, (animFrame * seg.dissolveSpeed) / 30);
      }

      // ── blur-fade 효과: 흐릿하게 나타나기 ──
      if (seg.blurFadeDuration) {
        const progress = animFrame <= 0 ? 1 : Math.min(1, animFrame / seg.blurFadeDuration);
        const blurPx = (1 - progress) * 8;
        ctx.globalAlpha = animFrame <= 0 ? 1 : (0.2 + progress * 0.8);
        if (blurPx > 0.1) ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
      }

      // ── shake 효과: sin 파형으로 Y 흔들림 ──
      let dy = 0;
      if (seg.shakeAmp && animFrame > 0) {
        dy = Math.sin(animFrame * (seg.shakeSpeed || 1) * 0.18) * (seg.shakeAmp || 3);
      }

      // ── gradient-wave 효과: 색상 위상 이동 ──
      if (seg.gradWaveSpeed && animFrame > 0) {
        const phase = (animFrame * (seg.gradWaveSpeed || 1) * 0.04) % (Math.PI * 2);
        const r = Math.floor(128 + 127 * Math.sin(phase));
        const g = Math.floor(128 + 127 * Math.sin(phase + 2.094));
        const b = Math.floor(128 + 127 * Math.sin(phase + 4.189));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        // 그림자
        ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.75;
        ctx.fillText(visibleText, cx + 2, baselineY + dy + 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillText(visibleText, cx, baselineY + dy);
        cx += tw;
        ctx.restore();
        segIdx++;
        continue;
      }

      // ── 일반 텍스트 렌더링 ──
      if (seg.gradient) {
        const gr = ctx.createLinearGradient(cx, baselineY + dy - fs, cx + tw, baselineY + dy);
        gr.addColorStop(0, seg.gradient[0]);
        gr.addColorStop(1, seg.gradient[1]);
        if (seg.outlineColor) {
          ctx.strokeStyle = seg.outlineColor; ctx.lineWidth = (seg.outlineWidth || 3) * 2;
          ctx.lineJoin = 'round'; ctx.strokeText(visibleText, cx, baselineY + dy);
        }
        ctx.fillStyle = gr;
        ctx.fillText(visibleText, cx, baselineY + dy);
      } else {
        // 그림자
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = prevAlpha * 0.75;
        ctx.fillStyle = '#000000';
        ctx.fillText(visibleText, cx + 2, baselineY + dy + 2);
        ctx.globalAlpha = prevAlpha;

        if (seg.outlineColor) {
          ctx.strokeStyle = seg.outlineColor; ctx.lineWidth = (seg.outlineWidth || 3) * 2;
          ctx.lineJoin = 'round'; ctx.strokeText(visibleText, cx, baselineY + dy);
        }
        ctx.fillStyle = seg.color;
        ctx.fillText(visibleText, cx, baselineY + dy);
      }
      cx += tw;
      ctx.restore();
    }
    segIdx++;
  }
}

// ─── 배경 그리기 ───
function drawBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#3a4a5a';
  ctx.fillRect(0, 0, GW, GH);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
  for (let x = 0; x < GW; x += 48) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, GH); ctx.stroke(); }
  for (let y = 0; y < GH; y += 48) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(GW, y + .5); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(GW / 2 - 16, GH / 2 - 56, 32, 56);
}

// ─── 일반 메시지 창 렌더링 ───
function renderNormal(
  ctx: CanvasRenderingContext2D,
  faceName: string, faceIndex: number, background: number, positionType: number, text: string,
  faceImg: HTMLImageElement | null, winImg: HTMLImageElement | null, iconImg: HTMLImageElement | null,
  animFrame: number,
) {
  drawBackground(ctx);
  if (background === 1) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, GW, GH); }
  const winY = positionType === 0 ? 0 : positionType === 1 ? Math.floor((GH - WIN_H) / 2) : GH - WIN_H;

  if (background !== 2) {
    if (winImg) drawWindowPng(ctx, winImg, 0, winY, GW, WIN_H);
    else drawWindowFallback(ctx, 0, winY, GW, WIN_H);
  }

  const hasFace = !!(faceName && faceImg);
  if (hasFace && faceImg) {
    const col = faceIndex % 4, row = Math.floor(faceIndex / 4);
    ctx.drawImage(faceImg, col * FACE_SZ, row * FACE_SZ, FACE_SZ, FACE_SZ, PAD, winY + PAD, FACE_SZ, FACE_SZ);
  }

  const textX = hasFace ? PAD + FACE_SZ + 16 : PAD;
  const textMaxW = GW - textX - PAD;
  const lines = text.split('\n').slice(0, 4);

  // 타이프라이터: visibleChars 계산
  const totalChars = countTotalChars(lines);
  const visibleChars = animFrame <= 0 ? Infinity : Math.floor(animFrame * CHARS_PER_FRAME);
  const typingDone = visibleChars >= totalChars;
  const charBudget = { remaining: animFrame <= 0 ? Infinity : visibleChars };

  lines.forEach((line, i) => {
    if (charBudget.remaining <= 0) return;
    drawLine(ctx, line, textX, winY + PAD + i * LINE_H + BASE_FONT + 2, textMaxW, iconImg, charBudget, animFrame);
  });

  // ▼ 입력 대기 (타이핑 완료 후 깜빡임)
  if (animFrame <= 0 || typingDone) {
    const blink = animFrame <= 0 || Math.floor(animFrame / 30) % 2 === 0;
    if (blink) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '18px serif';
      ctx.fillText('▼', GW - 22, winY + WIN_H - 10);
    }
  }
}

// ─── VN 모드 렌더링 ───
function renderVN(
  ctx: CanvasRenderingContext2D,
  faceName: string, faceIndex: number, text: string,
  faceImg: HTMLImageElement | null, winImg: HTMLImageElement | null, iconImg: HTMLImageElement | null,
  animFrame: number,
) {
  drawBackground(ctx);
  ctx.fillStyle = `rgba(0,0,0,${VN_OVERLAY_ALPHA})`;
  ctx.fillRect(0, 0, GW, GH);

  if (winImg) drawWindowPng(ctx, winImg, VN_X, VN_Y, VN_W, VN_H);
  else drawWindowFallback(ctx, VN_X, VN_Y, VN_W, VN_H);

  const innerX = VN_X + PAD;
  const innerY = VN_Y + PAD;
  const innerW = VN_W - PAD * 2;

  const hasFace = !!(faceName && faceImg);
  let textStartX = innerX;
  if (hasFace && faceImg) {
    const col = faceIndex % 4, row = Math.floor(faceIndex / 4);
    const faceDst = 120;
    ctx.drawImage(faceImg, col * FACE_SZ, row * FACE_SZ, FACE_SZ, FACE_SZ, innerX, innerY, faceDst, faceDst);
    textStartX = innerX + faceDst + 12;
  }

  const textW = VN_X + VN_W - textStartX - PAD;
  let curY = innerY;

  if (faceName) {
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.font = `bold 22px "GameFont","MS PGothic","dotumche","나눔고딕",serif`;
    ctx.fillText(faceName, textStartX + 1, curY + 22 + 1);
    ctx.fillStyle = VN_SPEAKER_COLOR;
    ctx.fillText(faceName, textStartX, curY + 22);
    ctx.restore();
    curY += LINE_H;
  }

  const lines = text.split('\n');
  const maxLines = Math.floor((VN_Y + VN_H - curY - PAD) / LINE_H);
  const displayLines = lines.slice(0, maxLines);

  const totalChars = countTotalChars(displayLines);
  const visibleChars = animFrame <= 0 ? Infinity : Math.floor(animFrame * CHARS_PER_FRAME);
  const typingDone = visibleChars >= totalChars;
  const charBudget = { remaining: animFrame <= 0 ? Infinity : visibleChars };

  displayLines.forEach((line, i) => {
    if (charBudget.remaining <= 0) return;
    drawLine(ctx, line, textStartX, curY + i * LINE_H + BASE_FONT + 2, textW, iconImg, charBudget, animFrame);
  });

  if (lines.length > maxLines) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '14px serif';
    ctx.fillText(`↓ (${lines.length - maxLines}줄 더 있음)`, textStartX, VN_Y + VN_H - 8);
  }

  if (animFrame <= 0 || typingDone) {
    const blink = animFrame <= 0 || Math.floor(animFrame / 30) % 2 === 0;
    if (blink) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '18px serif';
      ctx.fillText('▼', VN_X + VN_W - 22, VN_Y + VN_H - 10);
    }
  }

  ctx.save();
  ctx.fillStyle = 'rgba(255,224,102,0.85)';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('VN MODE', VN_X + 4, VN_Y - 4);
  ctx.restore();
}

// ─── 진입점 ───
function render(
  ctx: CanvasRenderingContext2D,
  faceName: string, faceIndex: number, background: number, positionType: number, text: string,
  faceImg: HTMLImageElement | null, winImg: HTMLImageElement | null, iconImg: HTMLImageElement | null,
  animFrame: number,
) {
  const lineCount = text.split('\n').length;
  if (lineCount > 4) {
    renderVN(ctx, faceName, faceIndex, text, faceImg, winImg, iconImg, animFrame);
  } else {
    renderNormal(ctx, faceName, faceIndex, background, positionType, text, faceImg, winImg, iconImg, animFrame);
  }
}

// ─── MessagePreview 컴포넌트 ───
interface MessagePreviewProps {
  faceName: string;
  faceIndex: number;
  background: number;
  positionType: number;
  text: string;
}

export function MessagePreview({ faceName, faceIndex, background, positionType, text }: MessagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgs, setImgs] = useState<{
    face: HTMLImageElement | null;
    win: HTMLImageElement | null;
    icon: HTMLImageElement | null;
  }>({ face: null, win: null, icon: null });

  const isVNMode = text.split('\n').length > 4;

  // ─── 재생 상태 ───
  const [isPlaying, setIsPlaying] = useState(false);
  const animFrameRef = useRef(0);    // 현재 애니 프레임
  const rafRef = useRef(0);          // requestAnimationFrame handle
  const imgsRef = useRef(imgs);
  useEffect(() => { imgsRef.current = imgs; }, [imgs]);

  // ─── 이미지 로드 ───
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadImg('/img/system/Window.png'),
      loadImg('/img/system/IconSet.png'),
      faceName ? loadImg(`/img/faces/${faceName}.png`) : Promise.resolve(null),
    ]).then(([win, icon, face]) => {
      if (!cancelled) setImgs({ win, icon, face });
    });
    return () => { cancelled = true; };
  }, [faceName]);

  // ─── 정적 렌더링 (재생 중이 아닐 때) ───
  const renderStatic = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = GW; canvas.height = GH;
    render(ctx, faceName, faceIndex, background, positionType, text, imgsRef.current.face, imgsRef.current.win, imgsRef.current.icon, 0);
  }, [faceName, faceIndex, background, positionType, text]);

  useEffect(() => {
    if (!isPlaying) renderStatic();
  }, [imgs, faceName, faceIndex, background, positionType, text, isPlaying, renderStatic]);

  // ─── 재생 루프 ───
  const startPlay = useCallback(() => {
    animFrameRef.current = 0;

    const allLines = text.split('\n');
    const displayLines = allLines.length > 4
      ? allLines.slice(0, Math.floor((VN_H - LINE_H * (faceName ? 1 : 0) - PAD * 2) / LINE_H))
      : allLines.slice(0, 4);
    const totalChars = countTotalChars(displayLines);
    // 타이핑 완료 후 2초(120f) + 애니메이션 지속 60f
    const totalFrames = Math.ceil(totalChars / CHARS_PER_FRAME) + 180;

    const tick = () => {
      animFrameRef.current += 1;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = GW; canvas.height = GH;
      const { face, win, icon } = imgsRef.current;
      render(ctx, faceName, faceIndex, background, positionType, text, face, win, icon, animFrameRef.current);

      if (animFrameRef.current < totalFrames) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setIsPlaying(false);
        animFrameRef.current = 0;
        // 최종 정적 렌더링
        const { face: f, win: w, icon: ic } = imgsRef.current;
        render(ctx, faceName, faceIndex, background, positionType, text, f, w, ic, 0);
      }
    };

    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [faceName, faceIndex, background, positionType, text]);

  const stopPlay = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    animFrameRef.current = 0;
    setIsPlaying(false);
    renderStatic();
  }, [renderStatic]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

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

      {/* 재생 컨트롤 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
        <button
          onClick={isPlaying ? stopPlay : startPlay}
          style={{
            background: isPlaying ? '#5a1a1a' : '#1a3a1a',
            border: `1px solid ${isPlaying ? '#c44' : '#4a8'}`,
            borderRadius: 4,
            color: isPlaying ? '#f88' : '#6da',
            fontSize: 14,
            padding: '3px 14px',
            cursor: 'pointer',
            fontWeight: 'bold',
            minWidth: 70,
          }}
        >
          {isPlaying ? '■ 정지' : '▶ 재생'}
        </button>
        <span style={{ fontSize: 11, color: '#555' }}>
          {isPlaying ? '타이프라이터 + 애니메이션 재생 중...' : '재생 버튼으로 실제 애니메이션 미리보기'}
        </span>
      </div>
    </div>
  );
}
