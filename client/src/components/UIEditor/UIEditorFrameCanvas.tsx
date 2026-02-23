import React, { useEffect, useRef, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import './UIEditor.css';

// RPG Maker MV Window.png 구조 상수
const SKIN_W = 192;
const SKIN_H = 192;
const FRAME_X = 96;  // 프레임 영역 시작 x
const FRAME_SZ = 96; // 프레임 영역 크기 (96×96)
const DISPLAY_SCALE = 3; // 캔버스 표시 배율

interface Region {
  x: number; y: number; w: number; h: number;
  color: string; label: string;
}

const REGIONS: Region[] = [
  { x: 0,  y: 0,  w: 96, h: 96,  color: 'rgba(80,200,100,0.18)',  label: '배경' },
  { x: 0,  y: 96, w: 96, h: 96,  color: 'rgba(50,160,80,0.14)',   label: '배경 반복' },
  { x: 96, y: 0,  w: 96, h: 96,  color: 'rgba(38,117,191,0.18)',  label: '프레임' },
  { x: 96, y: 96, w: 96, h: 96,  color: 'rgba(200,120,0,0.14)',   label: '커서/화살표' },
];

function drawSkin(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cornerSize: number,
) {
  const S = DISPLAY_SCALE;
  const cw = SKIN_W * S;
  const ch = SKIN_H * S;

  ctx.clearRect(0, 0, cw, ch);

  // 배경 (체커보드 패턴)
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, cw, ch);
  for (let y = 0; y < SKIN_H; y += 8) {
    for (let x = 0; x < SKIN_W; x += 8) {
      if ((x / 8 + y / 8) % 2 === 0) {
        ctx.fillStyle = '#222';
        ctx.fillRect(x * S, y * S, 8 * S, 8 * S);
      }
    }
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, cw, ch);

  // 영역별 컬러 오버레이
  for (const r of REGIONS) {
    ctx.fillStyle = r.color;
    ctx.fillRect(r.x * S, r.y * S, r.w * S, r.h * S);
  }

  // 사분면 구분선 (흰색)
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(96 * S + 0.5, 0); ctx.lineTo(96 * S + 0.5, ch);
  ctx.moveTo(0, 96 * S + 0.5); ctx.lineTo(cw, 96 * S + 0.5);
  ctx.stroke();

  // 9-slice 격자선 (프레임 영역 내부, FRAME_X ~ FRAME_X+FRAME_SZ, 0 ~ FRAME_SZ)
  const cs = Math.max(1, Math.min(cornerSize, FRAME_SZ / 2 - 1));
  ctx.strokeStyle = 'rgba(255, 220, 0, 0.95)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);

  // 수직선: x = FRAME_X+cs, x = FRAME_X+FRAME_SZ-cs
  const vx1 = (FRAME_X + cs) * S + 0.5;
  const vx2 = (FRAME_X + FRAME_SZ - cs) * S + 0.5;
  const frameTop = 0;
  const frameBot = FRAME_SZ * S;
  ctx.beginPath(); ctx.moveTo(vx1, frameTop); ctx.lineTo(vx1, frameBot); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(vx2, frameTop); ctx.lineTo(vx2, frameBot); ctx.stroke();

  // 수평선: y = cs, y = FRAME_SZ-cs (프레임 영역 내)
  const hy1 = cs * S + 0.5;
  const hy2 = (FRAME_SZ - cs) * S + 0.5;
  const frameLeft = FRAME_X * S;
  const frameRight = (FRAME_X + FRAME_SZ) * S;
  ctx.beginPath(); ctx.moveTo(frameLeft, hy1); ctx.lineTo(frameRight, hy1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(frameLeft, hy2); ctx.lineTo(frameRight, hy2); ctx.stroke();

  ctx.setLineDash([]);

  // 코너 강조 박스
  ctx.strokeStyle = 'rgba(255,220,0,0.6)';
  ctx.lineWidth = 0.5;
  const corners = [
    { x: FRAME_X, y: 0 },
    { x: FRAME_X + FRAME_SZ - cs, y: 0 },
    { x: FRAME_X, y: FRAME_SZ - cs },
    { x: FRAME_X + FRAME_SZ - cs, y: FRAME_SZ - cs },
  ];
  for (const c of corners) {
    ctx.strokeRect(c.x * S + 0.5, c.y * S + 0.5, cs * S - 1, cs * S - 1);
  }

  // 영역 라벨
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `bold ${9 * S}px sans-serif`;
  ctx.fillText('배경', 4 * S, 11 * S);
  ctx.fillText('배경 반복', 4 * S, 100 * S);
  ctx.fillText('프레임', 100 * S, 11 * S);
  ctx.fillText('커서/화살표', 100 * S, 100 * S);

  // 코너 크기 레이블
  ctx.fillStyle = 'rgba(255,220,0,0.9)';
  ctx.font = `${7 * S}px sans-serif`;
  ctx.fillText(`${cs}px`, (FRAME_X + 1) * S, (cs / 2 + 1) * S);
}

export default function UIEditorFrameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const projectPath = useEditorStore((s) => s.projectPath);
  const uiSelectedSkin = useEditorStore((s) => s.uiSelectedSkin);
  const uiSkinCornerSize = useEditorStore((s) => s.uiSkinCornerSize);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawSkin(ctx, img, uiSkinCornerSize);
  }, [uiSkinCornerSize]);

  // 스킨 이미지 로드
  useEffect(() => {
    if (!projectPath || !uiSelectedSkin) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = SKIN_W * DISPLAY_SCALE;
    canvas.height = SKIN_H * DISPLAY_SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 로딩 표시
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.fillText('Loading...', 8, 20);

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      drawSkin(ctx, img, uiSkinCornerSize);
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

  // cornerSize 변경 시 리드로우
  useEffect(() => { redraw(); }, [redraw]);

  if (!projectPath) {
    return (
      <div className="ui-frame-canvas-area">
        <div className="ui-editor-no-project">프로젝트를 먼저 열어주세요</div>
      </div>
    );
  }

  return (
    <div className="ui-frame-canvas-area">
      <div className="ui-frame-canvas-scroll">
        <canvas
          ref={canvasRef}
          className="ui-frame-canvas"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <div className="ui-frame-canvas-legend">
        <span className="ui-frame-legend-item legend-bg">배경 (96×96 타일)</span>
        <span className="ui-frame-legend-item legend-frame">프레임 (9-slice)</span>
        <span className="ui-frame-legend-item legend-ui">커서/화살표</span>
        <span className="ui-frame-legend-item legend-slice">― 9-slice 경계</span>
      </div>
    </div>
  );
}
