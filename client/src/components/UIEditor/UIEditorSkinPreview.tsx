import React, { useEffect, useRef, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';

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
  const projectPath  = useEditorStore((s) => s.projectPath);
  const uiSelectedSkin = useEditorStore((s) => s.uiSelectedSkin);
  const uiSelectedSkinFile = useEditorStore((s) => s.uiSelectedSkinFile);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [, forceUpdate] = React.useState(0);

  useEffect(() => {
    if (!projectPath || !uiSelectedSkin) { imgRef.current = null; forceUpdate(n => n + 1); return; }
    const file = uiSelectedSkinFile || uiSelectedSkin;
    const img = new Image();
    img.onload = () => { imgRef.current = img; forceUpdate(n => n + 1); };
    img.onerror = () => { imgRef.current = null; forceUpdate(n => n + 1); };
    img.src = `/img/system/${file}.png?v=${Date.now()}`;
  }, [projectPath, uiSelectedSkin, uiSelectedSkinFile]);

  return (
    <div className="ui-skin-preview-panel">
      <div className="ui-skin-preview-header">프리뷰</div>
      {!imgRef.current ? (
        <div className="ui-skin-preview-empty">스킨을 선택하세요</div>
      ) : (
        <>
          <PreviewItem label="정사각형"       width={100} height={100} skinImg={imgRef.current} />
          <PreviewItem label="가로 직사각형"  width={200} height={72}  skinImg={imgRef.current} />
          <PreviewItem label="세로 직사각형"  width={72}  height={160} skinImg={imgRef.current} />
        </>
      )}
    </div>
  );
}
