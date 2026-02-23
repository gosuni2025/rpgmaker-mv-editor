import React, { useEffect, useRef, useCallback, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import './UIEditor.css';

// RPG Maker MV Window.png 구조 상수 (엔진에 하드코딩된 레이아웃)
const SKIN_W = 192;
const SKIN_H = 192;
const FRAME_X = 96;  // 프레임 영역 시작 x (우측 상단 96×96)
const FRAME_SZ = 96;
const DISPLAY_SCALE = 3; // 캔버스 내부 해상도 배율

const SLICE_HIT = 5; // 9-slice 경계선 히트 판정 (이미지 픽셀 기준)

interface Region { x: number; y: number; w: number; h: number; color: string; label: string; }
const REGIONS: Region[] = [
  { x: 0,  y: 0,  w: 96, h: 96,  color: 'rgba(80,200,100,0.18)',  label: '배경' },
  { x: 0,  y: 96, w: 96, h: 96,  color: 'rgba(50,160,80,0.14)',   label: '배경 반복' },
  { x: 96, y: 0,  w: 96, h: 96,  color: 'rgba(38,117,191,0.18)',  label: '프레임' },
  { x: 96, y: 96, w: 96, h: 96,  color: 'rgba(200,120,0,0.14)',   label: '커서/화살표' },
];

function drawSkin(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cornerSize: number, showLabels: boolean) {
  const S = DISPLAY_SCALE;
  const cw = SKIN_W * S;
  const ch = SKIN_H * S;

  ctx.clearRect(0, 0, cw, ch);

  // 체커보드 배경
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

  // 영역별 컬러 오버레이 (코드에서 그리는 것 — 이미지 구조는 MV 엔진에 하드코딩됨)
  for (const r of REGIONS) {
    ctx.fillStyle = r.color;
    ctx.fillRect(r.x * S, r.y * S, r.w * S, r.h * S);
  }

  // 사분면 구분선
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(96 * S + 0.5, 0); ctx.lineTo(96 * S + 0.5, ch);
  ctx.moveTo(0, 96 * S + 0.5); ctx.lineTo(cw, 96 * S + 0.5);
  ctx.stroke();

  // 9-slice 경계선 (드래그 가능)
  const cs = Math.max(1, Math.min(cornerSize, FRAME_SZ / 2 - 1));
  ctx.strokeStyle = 'rgba(255, 220, 0, 0.95)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);

  const vx1 = (FRAME_X + cs) * S + 0.5;
  const vx2 = (FRAME_X + FRAME_SZ - cs) * S + 0.5;
  ctx.beginPath(); ctx.moveTo(vx1, 0); ctx.lineTo(vx1, FRAME_SZ * S); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(vx2, 0); ctx.lineTo(vx2, FRAME_SZ * S); ctx.stroke();

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
  for (const c of [
    { x: FRAME_X, y: 0 },
    { x: FRAME_X + FRAME_SZ - cs, y: 0 },
    { x: FRAME_X, y: FRAME_SZ - cs },
    { x: FRAME_X + FRAME_SZ - cs, y: FRAME_SZ - cs },
  ]) {
    ctx.strokeRect(c.x * S + 0.5, c.y * S + 0.5, cs * S - 1, cs * S - 1);
  }

  // 영역 라벨 (토글 가능)
  if (showLabels) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `bold ${9 * S}px sans-serif`;
    ctx.fillText('배경', 4 * S, 11 * S);
    ctx.fillText('배경 반복', 4 * S, 100 * S);
    ctx.fillText('프레임', 100 * S, 11 * S);
    ctx.fillText('커서/화살표', 100 * S, 100 * S);
  }

  // cornerSize 수치 표시 (항상)
  ctx.fillStyle = 'rgba(255,220,0,0.9)';
  ctx.font = `${7 * S}px sans-serif`;
  ctx.fillText(`${cs}px`, (FRAME_X + 1) * S, (cs / 2 + 1) * S);
}

// ─── 9-slice 드래그 유틸 ─────────────────────────────────────────────────────

type DragState = { axis: 'x' | 'y'; nearFirst: boolean } | null;

function getSliceHit(ix: number, iy: number, cs: number): DragState {
  const csC = Math.max(1, Math.min(cs, FRAME_SZ / 2 - 1));
  const vx1 = FRAME_X + csC, vx2 = FRAME_X + FRAME_SZ - csC;
  const hy1 = csC, hy2 = FRAME_SZ - csC;
  const inFX = ix >= FRAME_X && ix <= FRAME_X + FRAME_SZ;
  const inFY = iy >= 0 && iy <= FRAME_SZ;
  if (inFY && Math.abs(ix - vx1) <= SLICE_HIT) return { axis: 'x', nearFirst: true };
  if (inFY && Math.abs(ix - vx2) <= SLICE_HIT) return { axis: 'x', nearFirst: false };
  if (inFX && Math.abs(iy - hy1) <= SLICE_HIT) return { axis: 'y', nearFirst: true };
  if (inFX && Math.abs(iy - hy2) <= SLICE_HIT) return { axis: 'y', nearFirst: false };
  return null;
}

function calcCornerSize(ix: number, iy: number, drag: NonNullable<DragState>): number {
  const max = FRAME_SZ / 2 - 1;
  const raw = drag.axis === 'x'
    ? (drag.nearFirst ? ix - FRAME_X : FRAME_SZ - (ix - FRAME_X))
    : (drag.nearFirst ? iy : FRAME_SZ - iy);
  return Math.max(1, Math.min(max, Math.round(raw)));
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function UIEditorFrameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState>(null);

  const projectPath = useEditorStore((s) => s.projectPath);
  const uiSelectedSkin = useEditorStore((s) => s.uiSelectedSkin);
  const uiSkinCornerSize = useEditorStore((s) => s.uiSkinCornerSize);
  const uiShowSkinLabels = useEditorStore((s) => s.uiShowSkinLabels);
  const setUiSkinCornerSize = useEditorStore((s) => s.setUiSkinCornerSize);

  const [zoom, setZoom] = useState(1);

  // 마우스 클라이언트 좌표 → 이미지 좌표 변환 (zoom 자동 반영)
  const toImageCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      ix: (clientX - rect.left) * (canvas.width / rect.width) / DISPLAY_SCALE,
      iy: (clientY - rect.top) * (canvas.height / rect.height) / DISPLAY_SCALE,
    };
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawSkin(ctx, img, uiSkinCornerSize, uiShowSkinLabels);
  }, [uiSkinCornerSize, uiShowSkinLabels]);

  // 스킨 이미지 로드
  useEffect(() => {
    if (!projectPath || !uiSelectedSkin) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = SKIN_W * DISPLAY_SCALE;
    canvas.height = SKIN_H * DISPLAY_SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.fillText('Loading...', 8, 20);

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const s = useEditorStore.getState();
      drawSkin(ctx, img, s.uiSkinCornerSize, s.uiShowSkinLabels);
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

  useEffect(() => { redraw(); }, [redraw]);

  // 휠 줌 (passive:false 필요해서 useEffect로 등록)
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

  // canvas 마우스다운 → 9-slice 경계 드래그 시작
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = toImageCoords(e.clientX, e.clientY);
    if (!coords) return;
    const hit = getSliceHit(coords.ix, coords.iy, useEditorStore.getState().uiSkinCornerSize);
    if (!hit) return;
    e.preventDefault();
    dragRef.current = hit;
    document.body.style.cursor = hit.axis === 'x' ? 'ew-resize' : 'ns-resize';

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const c = toImageCoords(ev.clientX, ev.clientY);
      if (!c) return;
      useEditorStore.getState().setUiSkinCornerSize(calcCornerSize(c.ix, c.iy, dragRef.current));
    };

    const onUp = async (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const c = toImageCoords(ev.clientX, ev.clientY);
      if (c) {
        const newCs = calcCornerSize(c.ix, c.iy, dragRef.current);
        useEditorStore.getState().setUiSkinCornerSize(newCs);
        // 서버에 즉시 저장
        const { projectPath: pp, uiSelectedSkin: skin } = useEditorStore.getState();
        if (pp && skin) {
          await fetch(`/api/ui-editor/skins/${encodeURIComponent(skin)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cornerSize: newCs }),
          });
        }
      }
      dragRef.current = null;
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [toImageCoords]);

  // canvas 마우스무브 → 경계선 근처에서 커서 변경
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const coords = toImageCoords(e.clientX, e.clientY);
    if (!coords) return;
    const hit = getSliceHit(coords.ix, coords.iy, useEditorStore.getState().uiSkinCornerSize);
    canvas.style.cursor = hit ? (hit.axis === 'x' ? 'ew-resize' : 'ns-resize') : 'default';
  }, [toImageCoords]);

  if (!projectPath) {
    return (
      <div className="ui-frame-canvas-area">
        <div className="ui-editor-no-project">프로젝트를 먼저 열어주세요</div>
      </div>
    );
  }

  const canvasCssPx = SKIN_W * DISPLAY_SCALE;

  return (
    <div className="ui-frame-canvas-area">
      <div ref={scrollRef} className="ui-frame-canvas-scroll">
        {/* zoom 배율만큼 크기를 확보해 스크롤바가 정상 동작하게 함 */}
        <div style={{ width: canvasCssPx * zoom, height: canvasCssPx * zoom, position: 'relative', flexShrink: 0 }}>
          <canvas
            ref={canvasRef}
            className="ui-frame-canvas"
            style={{
              imageRendering: 'pixelated',
              display: 'block',
              position: 'absolute',
              top: 0,
              left: 0,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={() => { if (canvasRef.current) canvasRef.current.style.cursor = 'default'; }}
          />
        </div>
      </div>
      <div className="ui-frame-canvas-legend">
        <span style={{ fontSize: 11, color: '#888', marginRight: 8 }}>
          휠: 줌 {Math.round(zoom * 100)}%
        </span>
        <span className="ui-frame-legend-item legend-bg">배경 (96×96 타일)</span>
        <span className="ui-frame-legend-item legend-frame">프레임 (9-slice)</span>
        <span className="ui-frame-legend-item legend-ui">커서/화살표</span>
        <span className="ui-frame-legend-item legend-slice">― 드래그로 9-slice 조절</span>
      </div>
    </div>
  );
}
