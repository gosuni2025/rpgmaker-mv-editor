import React, { useEffect, useRef, useState } from 'react';
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

// ─── 게임 해상도 & 창 치수 ───
const GW = 816;
const GH = 624;
const WIN_H = 180;
const FACE_SZ = 144; // 얼굴 이미지 1셀 크기
const PAD = 12;
const LINE_H = 36;
const BASE_FONT = 26;
const ICON_SZ = 32;
const ICON_COLS = 16;

// ─── 이미지 캐시 (글로벌, 모듈 생명주기) ───
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

// ─── 내부 세그먼트 타입 ───
interface DrawText {
  type: 'text';
  text: string;
  color: string;
  size: number;
  outlineColor?: string;
  outlineWidth?: number;
  gradient?: [string, string];
}
interface DrawIcon { type: 'icon'; index: number; size: number; }
interface DrawWaiter { type: 'waiter'; size: number; }
type DrawSeg = DrawText | DrawIcon | DrawWaiter;

// ─── 한 줄 파싱 → DrawSeg[] ───
function buildDrawSegs(line: string): DrawSeg[] {
  const result: DrawSeg[] = [];
  let color = '#ffffff';
  let size = BASE_FONT;

  function processSegs(
    segs: AnyTextSeg[],
    overColor?: string,
    outline?: { color: string; width: number },
    gradient?: [string, string],
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
        else if (vM) { result.push({ type: 'text', text: `#${vM[1]}변수`, color: '#ffffaa', size, outlineColor: outline?.color, outlineWidth: outline?.width }); }
        else if (nM) { result.push({ type: 'text', text: `[이름${nM[1]}]`, color: '#aaffaa', size, outlineColor: outline?.color, outlineWidth: outline?.width }); }
        else if (pM) { result.push({ type: 'text', text: `[파티${pM[1]}]`, color: '#aaffaa', size, outlineColor: outline?.color, outlineWidth: outline?.width }); }
        else if (r === '\\G') { result.push({ type: 'text', text: '골드', color: overColor || color, size }); }
        else if (r === '\\{') { size = Math.min(size + 4, BASE_FONT + 16); }
        else if (r === '\\}') { size = Math.max(size - 4, BASE_FONT - 8); }
        else if (r === '\\!') { result.push({ type: 'waiter', size }); }
        // \. \| \> \< \^ 타이밍 코드 무시
      } else if (seg.type === 'text') {
        if (seg.text) {
          result.push({ type: 'text', text: seg.text, color: overColor || color, size, outlineColor: outline?.color, outlineWidth: outline?.width, gradient });
        }
      } else if (seg.type === 'block') {
        const b = seg as TextBlockSeg;
        let nc = overColor;
        let no = outline;
        let ng = gradient;
        if (b.tag === 'color') nc = b.params.value || overColor;
        else if (b.tag === 'outline') no = { color: b.params.color || '#000000', width: +(b.params.thickness || '3') };
        else if (b.tag === 'gradient') ng = [b.params.color1 || '#ffffff', b.params.color2 || '#000000'];
        // 애니메이션 태그(shake/fade/typewriter 등)는 정적 미리보기에서 색상만 표현
        processSegs(b.children, nc, no, ng);
      }
    }
  }

  processSegs(parseExtendedText(line));
  return result;
}

// ─── 창 배경 폴백 (Window.png 없을 때) ───
function drawWindowFallback(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.globalAlpha = 0.88;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(8, 14, 40, 0.96)');
  g.addColorStop(1, 'rgba(4, 8, 22, 0.98)');
  ctx.fillStyle = g;
  rrect(ctx, x, y, w, h, 6); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(160, 200, 255, 0.75)'; ctx.lineWidth = 2;
  rrect(ctx, x + 1, y + 1, w - 2, h - 2, 5); ctx.stroke();
  ctx.strokeStyle = 'rgba(60, 100, 200, 0.4)'; ctx.lineWidth = 1;
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

// ─── Window.png 9-slice 렌더링 ───
function drawWindowPng(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  // Window.png 128×128 구조:
  //  [0,0..63,63]   창 배경 (타일)
  //  [64,0..127,63] 커서
  //  [0,64..63,127] 화살표/버튼
  //  [64,64..127,127] 창 테두리 (9-slice)
  ctx.save();
  // 배경 타일 (좌상단 64×64)
  ctx.globalAlpha = 0.82;
  const pat = ctx.createPattern(
    (() => {
      const offscreen = document.createElement('canvas');
      offscreen.width = 64; offscreen.height = 64;
      const o = offscreen.getContext('2d')!;
      o.drawImage(img, 0, 0, 64, 64, 0, 0, 64, 64);
      return offscreen;
    })(),
    'repeat',
  );
  if (pat) {
    ctx.fillStyle = pat;
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  }

  // 테두리 9-slice (우하단 64×64, bx=64 by=64)
  ctx.globalAlpha = 1;
  const M = 12; // 모서리 크기
  const bx = 64, by = 64, bw = 64, bh = 64;

  const slices = [
    // corners
    [bx,        by,        M, M,          x,         y,         M, M        ],
    [bx+bw-M,   by,        M, M,          x+w-M,     y,         M, M        ],
    [bx,        by+bh-M,   M, M,          x,         y+h-M,     M, M        ],
    [bx+bw-M,   by+bh-M,   M, M,          x+w-M,     y+h-M,     M, M        ],
    // edges
    [bx+M,      by,        bw-M*2, M,     x+M,       y,         w-M*2, M    ],
    [bx+M,      by+bh-M,   bw-M*2, M,     x+M,       y+h-M,     w-M*2, M    ],
    [bx,        by+M,      M, bh-M*2,     x,         y+M,       M, h-M*2    ],
    [bx+bw-M,   by+M,      M, bh-M*2,     x+w-M,     y+M,       M, h-M*2    ],
  ];
  for (const [sx, sy, sw, sh, dx, dy, dw, dh] of slices) {
    if (dw > 0 && dh > 0) ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  ctx.restore();
}

// ─── 한 줄 텍스트 렌더링 ───
function drawLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  baselineY: number,
  maxW: number,
  iconImg: HTMLImageElement | null,
) {
  const segs = buildDrawSegs(line);
  let cx = x;

  for (const seg of segs) {
    if (cx >= x + maxW) break;

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
    } else if (seg.type === 'waiter') {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = `${seg.size * 0.55}px serif`;
      ctx.fillText('▼', cx, baselineY);
      cx += seg.size * 0.55 + 2;
      ctx.restore();
    } else if (seg.type === 'text' && seg.text) {
      const fs = seg.size;
      ctx.font = `${fs}px "GameFont","MS PGothic","dotumche","나눔고딕",serif`;
      const tw = ctx.measureText(seg.text).width;

      if (seg.gradient) {
        // 그라데이션 텍스트
        const gr = ctx.createLinearGradient(cx, baselineY - fs, cx + tw, baselineY);
        gr.addColorStop(0, seg.gradient[0]);
        gr.addColorStop(1, seg.gradient[1]);
        if (seg.outlineColor) {
          ctx.strokeStyle = seg.outlineColor;
          ctx.lineWidth = (seg.outlineWidth || 3) * 2;
          ctx.lineJoin = 'round';
          ctx.strokeText(seg.text, cx, baselineY);
        }
        ctx.fillStyle = gr;
        ctx.fillText(seg.text, cx, baselineY);
      } else {
        // 기본 그림자 (RPG Maker MV 스타일: 우하단 2px 검은 텍스트)
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#000000';
        ctx.font = `${fs}px "GameFont","MS PGothic","dotumche","나눔고딕",serif`;
        ctx.fillText(seg.text, cx + 2, baselineY + 2);
        ctx.restore();
        // 외곽선
        if (seg.outlineColor) {
          ctx.save();
          ctx.strokeStyle = seg.outlineColor;
          ctx.lineWidth = (seg.outlineWidth || 3) * 2;
          ctx.lineJoin = 'round';
          ctx.strokeText(seg.text, cx, baselineY);
          ctx.restore();
        }
        ctx.fillStyle = seg.color;
        ctx.font = `${fs}px "GameFont","MS PGothic","dotumche","나눔고딕",serif`;
        ctx.fillText(seg.text, cx, baselineY);
      }
      cx += tw;
    }
  }
}

// ─── 전체 씬 렌더링 ───
function render(
  ctx: CanvasRenderingContext2D,
  faceName: string,
  faceIndex: number,
  background: number,
  positionType: number,
  text: string,
  faceImg: HTMLImageElement | null,
  winImg: HTMLImageElement | null,
  iconImg: HTMLImageElement | null,
) {
  // 맵 배경 시뮬레이션
  ctx.fillStyle = '#3a4a5a';
  ctx.fillRect(0, 0, GW, GH);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < GW; x += 48) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, GH); ctx.stroke(); }
  for (let y = 0; y < GH; y += 48) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(GW, y + 0.5); ctx.stroke(); }
  // 캐릭터 placeholder
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(GW / 2 - 16, GH / 2 - 56, 32, 56);

  // background=1: 전체 어두운 오버레이
  if (background === 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, GW, GH);
  }

  // 창의 Y 위치
  let winY = positionType === 0 ? 0 : positionType === 1 ? Math.floor((GH - WIN_H) / 2) : GH - WIN_H;

  // 창 그리기 (background=2 투명은 창 생략)
  if (background !== 2) {
    if (winImg) drawWindowPng(ctx, winImg, 0, winY, GW, WIN_H);
    else drawWindowFallback(ctx, 0, winY, GW, WIN_H);
  }

  // 얼굴 이미지
  const hasFace = !!(faceName && faceImg);
  if (hasFace && faceImg) {
    const col = faceIndex % 4;
    const row = Math.floor(faceIndex / 4);
    ctx.drawImage(faceImg, col * FACE_SZ, row * FACE_SZ, FACE_SZ, FACE_SZ, PAD, winY + PAD, FACE_SZ, FACE_SZ);
  }

  // 텍스트 영역
  const textX = hasFace ? PAD + FACE_SZ + 16 : PAD;
  const textMaxW = GW - textX - PAD;
  const lines = text.split('\n').slice(0, 4);
  lines.forEach((line, i) => {
    drawLine(ctx, line, textX, winY + PAD + i * LINE_H + BASE_FONT + 2, textMaxW, iconImg);
  });

  // 입력 대기 인디케이터 (▼) 우하단
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '18px serif';
  ctx.fillText('▼', GW - 22, winY + WIN_H - 10);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = GW;
    canvas.height = GH;
    render(ctx, faceName, faceIndex, background, positionType, text, imgs.face, imgs.win, imgs.icon);
  }, [imgs, faceName, faceIndex, background, positionType, text]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', aspectRatio: `${GW}/${GH}`, display: 'block', imageRendering: 'pixelated', background: '#222' }}
    />
  );
}
