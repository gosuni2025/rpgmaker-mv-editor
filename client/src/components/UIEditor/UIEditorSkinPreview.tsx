import React, { useEffect, useRef, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';

// ── 게이지 프리뷰 렌더링 ──────────────────────────────────────────────────

// fill 영역 좌/우(또는 상/하) 중앙 픽셀 색상 샘플링
function samplePixelColor(img: HTMLImageElement, x: number, y: number): string {
  const offscreen = document.createElement('canvas');
  offscreen.width = img.naturalWidth;
  offscreen.height = img.naturalHeight;
  const c = offscreen.getContext('2d')!;
  c.drawImage(img, 0, 0);
  const d = c.getImageData(x, y, 1, 1).data;
  return `rgba(${d[0]},${d[1]},${d[2]},${d[3] / 255})`;
}

function drawGaugePreview(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  bgX: number, bgY: number, bgW: number, bgH: number,
  fillX: number, fillY: number, fillW: number, fillH: number,
  fillDir: 'horizontal' | 'vertical',
  renderMode: 'image' | 'palette',
  rate: number,   // 0.0 ~ 1.0
  tw: number, th: number,
) {
  ctx.clearRect(0, 0, tw, th);

  // 체커보드 배경
  for (let y = 0; y < th; y += 8) {
    for (let x = 0; x < tw; x += 8) {
      ctx.fillStyle = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? '#222' : '#1a1a1a';
      ctx.fillRect(x, y, 8, 8);
    }
  }

  ctx.imageSmoothingEnabled = false;

  // 배경 stretch
  if (bgW > 0 && bgH > 0) {
    ctx.drawImage(img, bgX, bgY, bgW, bgH, 0, 0, tw, th);
  }

  if (fillW > 0 && fillH > 0 && rate > 0) {
    if (renderMode === 'palette') {
      // 팔레트 모드: fill 영역에서 색상 2개 샘플링 → gradientFillRect
      const midY = fillY + Math.floor(fillH / 2);
      const midX = fillX + Math.floor(fillW / 2);
      let color1: string, color2: string;
      if (fillDir === 'vertical') {
        color1 = samplePixelColor(img, midX, fillY);
        color2 = samplePixelColor(img, midX, fillY + fillH - 1);
        const dstH = Math.round(th * rate);
        const grad = ctx.createLinearGradient(0, th - dstH, 0, th);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, th - dstH, tw, dstH);
      } else {
        color1 = samplePixelColor(img, fillX, midY);
        color2 = samplePixelColor(img, fillX + fillW - 1, midY);
        const dstW = Math.round(tw * rate);
        const grad = ctx.createLinearGradient(0, 0, dstW, 0);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, dstW, th);
      }
    } else {
      // 이미지 모드: fill 영역 클리핑 blt
      if (fillDir === 'vertical') {
        const dstH = Math.round(th * rate);
        const dstY = th - dstH;
        const srcH = Math.round(fillH * rate);
        const srcY = fillY + fillH - srcH;
        ctx.drawImage(img, fillX, srcY, fillW, srcH, 0, dstY, tw, dstH);
      } else {
        const dstW = Math.round(tw * rate);
        const srcW = Math.round(fillW * rate);
        ctx.drawImage(img, fillX, fillY, srcW, fillH, 0, 0, dstW, th);
      }
    }
  }
}

// ── 게이지 단일 프리뷰 캔버스 ────────────────────────────────────────────

interface GaugePreviewItemProps {
  label: string;
  rate: number;
  gaugeImg: HTMLImageElement | null;
}

function GaugePreviewItem({ label, rate, gaugeImg }: GaugePreviewItemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tw = 200, th = 24;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gaugeImg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = useEditorStore.getState();
    drawGaugePreview(ctx, gaugeImg,
      s.uiSkinGaugeBgX,   s.uiSkinGaugeBgY,   s.uiSkinGaugeBgW,   s.uiSkinGaugeBgH,
      s.uiSkinGaugeFillX, s.uiSkinGaugeFillY, s.uiSkinGaugeFillW, s.uiSkinGaugeFillH,
      s.uiSkinGaugeFillDir as 'horizontal' | 'vertical',
      'image',  // 편집 프리뷰는 항상 이미지 모드 (fill 영역 그대로 표시)
      rate, tw, th);
  }, [gaugeImg, rate]);

  useEffect(() => { redraw(); }, [redraw]);

  const uiSkinGaugeBgX   = useEditorStore((s) => s.uiSkinGaugeBgX);
  const uiSkinGaugeBgY   = useEditorStore((s) => s.uiSkinGaugeBgY);
  const uiSkinGaugeBgW   = useEditorStore((s) => s.uiSkinGaugeBgW);
  const uiSkinGaugeBgH   = useEditorStore((s) => s.uiSkinGaugeBgH);
  const uiSkinGaugeFillX = useEditorStore((s) => s.uiSkinGaugeFillX);
  const uiSkinGaugeFillY = useEditorStore((s) => s.uiSkinGaugeFillY);
  const uiSkinGaugeFillW = useEditorStore((s) => s.uiSkinGaugeFillW);
  const uiSkinGaugeFillH = useEditorStore((s) => s.uiSkinGaugeFillH);
  const uiSkinGaugeFillDir = useEditorStore((s) => s.uiSkinGaugeFillDir);

  useEffect(() => { redraw(); }, [redraw,
    uiSkinGaugeBgX, uiSkinGaugeBgY, uiSkinGaugeBgW, uiSkinGaugeBgH,
    uiSkinGaugeFillX, uiSkinGaugeFillY, uiSkinGaugeFillW, uiSkinGaugeFillH,
    uiSkinGaugeFillDir,
  ]);

  return (
    <div className="ui-skin-preview-item">
      <div className="ui-skin-preview-label">{label} ({Math.round(rate * 100)}%)</div>
      <canvas
        ref={canvasRef}
        width={tw}
        height={th}
        className="ui-skin-preview-canvas"
        style={{ imageRendering: 'pixelated', width: tw, height: th }}
      />
    </div>
  );
}

// ── 9-slice + fill 렌더링 ──────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function drawPreview(
  ctx: CanvasRenderingContext2D,
  skin: HTMLImageElement,
  frameX: number, frameY: number, frameW: number, frameH: number,
  fillX: number, fillY: number, fillW: number, fillH: number,
  cornerSize: number,
  tw: number, th: number,
) {
  ctx.clearRect(0, 0, tw, th);

  // 체커보드 배경 (투명도 확인용)
  for (let y = 0; y < th; y += 8) {
    for (let x = 0; x < tw; x += 8) {
      ctx.fillStyle = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? '#222' : '#1a1a1a';
      ctx.fillRect(x, y, 8, 8);
    }
  }

  ctx.imageSmoothingEnabled = false;

  // 1. Fill (배경 stretch)
  if (fillW > 0 && fillH > 0) {
    ctx.drawImage(skin, fillX, fillY, fillW, fillH, 0, 0, tw, th);
  }

  // 2. 9-slice 프레임
  const cs = clamp(cornerSize, 1, Math.floor(Math.min(frameW, frameH) / 2) - 1);
  // 가로/세로 방향 독립적으로 클램핑 (한쪽이 짧아도 다른 방향 코너 크기는 유지)
  const tcX = Math.min(cs, Math.floor(tw / 2) - 1);
  const tcY = Math.min(cs, Math.floor(th / 2) - 1);

  // 소스 좌표
  const sx1 = frameX, sx2 = frameX + cs, sx3 = frameX + frameW - cs;
  const sy1 = frameY, sy2 = frameY + cs, sy3 = frameY + frameH - cs;

  // 타겟 좌표
  const tx2 = tcX, tx3 = tw - tcX;
  const ty2 = tcY, ty3 = th - tcY;

  // 코너 4개
  ctx.drawImage(skin, sx1, sy1, cs, cs, 0,   0,   tcX, tcY);
  ctx.drawImage(skin, sx3, sy1, cs, cs, tx3, 0,   tcX, tcY);
  ctx.drawImage(skin, sx1, sy3, cs, cs, 0,   ty3, tcX, tcY);
  ctx.drawImage(skin, sx3, sy3, cs, cs, tx3, ty3, tcX, tcY);

  // 엣지 4개 (stretch)
  if (tx3 > tx2) {
    ctx.drawImage(skin, sx2, sy1, sx3 - sx2, cs, tx2, 0,   tx3 - tx2, tcY);
    ctx.drawImage(skin, sx2, sy3, sx3 - sx2, cs, tx2, ty3, tx3 - tx2, tcY);
  }
  if (ty3 > ty2) {
    ctx.drawImage(skin, sx1, sy2, cs, sy3 - sy2, 0,   ty2, tcX, ty3 - ty2);
    ctx.drawImage(skin, sx3, sy2, cs, sy3 - sy2, tx3, ty2, tcX, ty3 - ty2);
  }
}

// ── 단일 프리뷰 캔버스 ──────────────────────────────────────────────────────

interface PreviewItemProps {
  label: string;
  width: number;
  height: number;
  skinImg: HTMLImageElement | null;
}

function PreviewItem({ label, width, height, skinImg }: PreviewItemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !skinImg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = useEditorStore.getState();
    drawPreview(ctx, skinImg,
      s.uiSkinFrameX, s.uiSkinFrameY, s.uiSkinFrameW, s.uiSkinFrameH,
      s.uiSkinFillX,  s.uiSkinFillY,  s.uiSkinFillW,  s.uiSkinFillH,
      s.uiSkinCornerSize, width, height);
  }, [skinImg, width, height]);

  // skinImg 변경 혹은 store 값 변경 시 redraw
  useEffect(() => { redraw(); }, [redraw]);

  // Zustand store 구독 — 관련 값 변경 시 redraw
  const uiSkinCornerSize = useEditorStore((s) => s.uiSkinCornerSize);
  const uiSkinFrameX = useEditorStore((s) => s.uiSkinFrameX);
  const uiSkinFrameY = useEditorStore((s) => s.uiSkinFrameY);
  const uiSkinFrameW = useEditorStore((s) => s.uiSkinFrameW);
  const uiSkinFrameH = useEditorStore((s) => s.uiSkinFrameH);
  const uiSkinFillX  = useEditorStore((s) => s.uiSkinFillX);
  const uiSkinFillY  = useEditorStore((s) => s.uiSkinFillY);
  const uiSkinFillW  = useEditorStore((s) => s.uiSkinFillW);
  const uiSkinFillH  = useEditorStore((s) => s.uiSkinFillH);

  useEffect(() => { redraw(); }, [redraw,
    uiSkinCornerSize,
    uiSkinFrameX, uiSkinFrameY, uiSkinFrameW, uiSkinFrameH,
    uiSkinFillX, uiSkinFillY, uiSkinFillW, uiSkinFillH,
  ]);

  return (
    <div className="ui-skin-preview-item">
      <div className="ui-skin-preview-label">{label}</div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="ui-skin-preview-canvas"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export default function UIEditorSkinPreview() {
  const projectPath        = useEditorStore((s) => s.projectPath);
  const uiSelectedSkin     = useEditorStore((s) => s.uiSelectedSkin);
  const uiSelectedSkinFile = useEditorStore((s) => s.uiSelectedSkinFile);
  const uiSkinGaugeFile    = useEditorStore((s) => s.uiSkinGaugeFile);
  const uiEditSubMode      = useEditorStore((s) => s.uiEditSubMode);

  const imgRef      = useRef<HTMLImageElement | null>(null);
  const gaugeImgRef = useRef<HTMLImageElement | null>(null);
  const [, forceUpdate] = React.useState(0);

  // 스킨 메인 이미지
  useEffect(() => {
    if (!projectPath || !uiSelectedSkin) { imgRef.current = null; forceUpdate(n => n + 1); return; }
    const file = uiSelectedSkinFile || uiSelectedSkin;
    const img = new Image();
    img.onload = () => { imgRef.current = img; forceUpdate(n => n + 1); };
    img.onerror = () => { imgRef.current = null; forceUpdate(n => n + 1); };
    img.src = `/img/system/${file}.png?v=${Date.now()}`;
  }, [projectPath, uiSelectedSkin, uiSelectedSkinFile]);

  // 게이지 전용 이미지 (gaugeFile이 있으면 그것, 없으면 메인 스킨 이미지 재사용)
  useEffect(() => {
    if (!projectPath || !uiSelectedSkin) { gaugeImgRef.current = null; forceUpdate(n => n + 1); return; }
    const file = uiSkinGaugeFile || uiSelectedSkinFile || uiSelectedSkin;
    const img = new Image();
    img.onload = () => { gaugeImgRef.current = img; forceUpdate(n => n + 1); };
    img.onerror = () => { gaugeImgRef.current = null; forceUpdate(n => n + 1); };
    img.src = `/img/system/${file}.png?v=${Date.now()}`;
  }, [projectPath, uiSelectedSkin, uiSelectedSkinFile, uiSkinGaugeFile]);

  const isGaugeMode = uiEditSubMode === 'gauge';

  return (
    <div className="ui-skin-preview-panel">
      <div className="ui-skin-preview-header">프리뷰</div>
      {isGaugeMode ? (
        !gaugeImgRef.current ? (
          <div className="ui-skin-preview-empty">스킨을 선택하세요</div>
        ) : (
          <>
            <GaugePreviewItem label="게이지 100%" rate={1.0}  gaugeImg={gaugeImgRef.current} />
            <GaugePreviewItem label="게이지 60%"  rate={0.6}  gaugeImg={gaugeImgRef.current} />
            <GaugePreviewItem label="게이지 20%"  rate={0.2}  gaugeImg={gaugeImgRef.current} />
          </>
        )
      ) : (
        !imgRef.current ? (
          <div className="ui-skin-preview-empty">스킨을 선택하세요</div>
        ) : (
          <>
            <PreviewItem label="정사각형"       width={100} height={100} skinImg={imgRef.current} />
            <PreviewItem label="가로 직사각형"  width={200} height={72}  skinImg={imgRef.current} />
            <PreviewItem label="세로 직사각형"  width={72}  height={160} skinImg={imgRef.current} />
          </>
        )
      )}
    </div>
  );
}
