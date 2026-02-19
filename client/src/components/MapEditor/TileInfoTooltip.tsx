import React, { useMemo, useRef, useLayoutEffect, useEffect, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { getTileDescription, getTileRenderInfo, TILE_SIZE_PX } from '../../utils/tileHelper';
import './TileInfoTooltip.css';

interface TileInfoTooltipProps {
  tileX: number;
  tileY: number;
  mouseX: number;
  mouseY: number;
}

const LAYER_NAMES = ['z0 (지면)', 'z1 (장식)', 'z2 (상층)', 'z3 (상층2)', 'z4 (그림자)', 'z5 (리전)'];
const HALF = TILE_SIZE_PX / 2;

// 모듈 레벨 이미지 캐시
const imageCache = new Map<string, HTMLImageElement>();
function getCachedImage(name: string): HTMLImageElement | null {
  if (imageCache.has(name)) return imageCache.get(name)!;
  const img = new Image();
  img.src = `/api/resources/img_tilesets/${name}.png`;
  img.onload = () => { imageCache.set(name, img); };
  imageCache.set(name, img); // 로드 전에도 캐시에 넣어서 중복 요청 방지
  return img;
}

/** Region(R 레이어) 타일을 팔레트와 동일한 방식으로 그리는 컴포넌트 */
function RegionPreviewCanvas({ regionId }: { regionId: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SIZE = 32;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // 팔레트와 동일한 색상 계산
    if (regionId > 0) {
      ctx.fillStyle = `hsl(${(regionId * 137) % 360}, 50%, 30%)`;
    } else {
      ctx.fillStyle = '#2b2b2b';
    }
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 테두리
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);

    // 숫자 텍스트
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(regionId), SIZE / 2, SIZE / 2);
  });

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={32}
      className="tile-info-preview"
    />
  );
}

/** 단일 타일 ID를 32x32 캔버스에 미리보기로 그리는 컴포넌트 */
function TilePreviewCanvas({ tileId, tilesetNames }: { tileId: number; tilesetNames?: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setRerender] = useState(0);

  // Region ID (1~255)는 별도 컴포넌트로 처리
  const isRegion = tileId >= 1 && tileId <= 255;

  const renderInfo = useMemo(() => (!isRegion ? getTileRenderInfo(tileId) : null), [tileId, isRegion]);

  useEffect(() => {
    if (!renderInfo || !tilesetNames) return;
    // 이미지가 아직 로드 안 됐으면 로드 후 re-render
    const sheetIndices = renderInfo.type === 'normal'
      ? [renderInfo.sheet]
      : renderInfo.quarters.map(q => q.sheet);
    const uniqueSheets = [...new Set(sheetIndices)];
    let needRerender = false;
    for (const si of uniqueSheets) {
      const name = tilesetNames[si];
      if (!name) continue;
      const img = getCachedImage(name);
      if (img && !img.complete) {
        needRerender = true;
        const prev = img.onload;
        img.onload = () => {
          if (prev) (prev as () => void)();
          setRerender(n => n + 1);
        };
      }
    }
    if (!needRerender) setRerender(n => n + 1);
  }, [renderInfo, tilesetNames]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderInfo || !tilesetNames) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SIZE = 32;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.imageSmoothingEnabled = false;

    if (renderInfo.type === 'normal') {
      const name = tilesetNames[renderInfo.sheet];
      if (!name) return;
      const img = getCachedImage(name);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, renderInfo.sx, renderInfo.sy, renderInfo.sw, renderInfo.sh, 0, 0, SIZE, SIZE);
      }
    } else {
      // autotile - 4 quarters
      const qs = renderInfo.quarters;
      const halfSize = SIZE / 2;
      for (let j = 0; j < 4; j++) {
        const name = tilesetNames[qs[j].sheet];
        if (!name) continue;
        const img = getCachedImage(name);
        if (img && img.complete && img.naturalWidth > 0) {
          const dx = (j % 2) * halfSize;
          const dy = Math.floor(j / 2) * halfSize;
          ctx.drawImage(img, qs[j].sx, qs[j].sy, HALF, HALF, dx, dy, halfSize, halfSize);
        }
      }
    }
  });

  if (isRegion) return <RegionPreviewCanvas regionId={tileId} />;
  if (!renderInfo) return null;

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={32}
      className="tile-info-preview"
    />
  );
}

export default function TileInfoTooltip({ tileX, tileY, mouseX, mouseY }: TileInfoTooltipProps) {
  const currentMap = useEditorStore((s) => s.currentMap);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const info = useMemo(() => {
    if (!currentMap) return null;
    const { width, height, data, tilesetNames } = currentMap;
    if (tileX < 0 || tileX >= width || tileY < 0 || tileY >= height) return null;

    const layers: { z: number; tileId: number; desc: ReturnType<typeof getTileDescription> }[] = [];
    for (let z = 0; z <= 5; z++) {
      const idx = (z * height + tileY) * width + tileX;
      const tileId = data[idx];
      if (tileId !== 0 && tileId !== undefined) {
        const desc = getTileDescription(tileId, tilesetNames);
        layers.push({ z, tileId, desc });
      }
    }

    return { tileX, tileY, layers, tilesetNames };
  }, [currentMap, tileX, tileY]);

  // 화면 밖으로 나가지 않도록 위치 보정
  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = mouseX + 16;
    let top = mouseY + 16;
    if (left + rect.width > vw) left = mouseX - rect.width - 8;
    if (top + rect.height > vh) top = mouseY - rect.height - 8;
    if (left < 0) left = 4;
    if (top < 0) top = 4;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  });

  if (!info || info.layers.length === 0) {
    return (
      <div ref={tooltipRef} className="tile-info-tooltip" style={{ left: mouseX + 16, top: mouseY + 16 }}>
        <div className="tile-info-pos">({tileX}, {tileY}) 빈 타일</div>
      </div>
    );
  }

  return (
    <div ref={tooltipRef} className="tile-info-tooltip" style={{ left: mouseX + 16, top: mouseY + 16 }}>
      <div className="tile-info-pos">위치: ({tileX}, {tileY})</div>
      {info.layers.map(({ z, tileId, desc }) => (
        <div key={z} className="tile-info-layer">
          <div className="tile-info-layer-header">{LAYER_NAMES[z] ?? `z${z}`}</div>
          <div className="tile-info-content">
            <TilePreviewCanvas tileId={tileId} tilesetNames={info.tilesetNames} />
            <div className="tile-info-details">
              {desc ? (
                <>
                  <div className="tile-info-row">
                    <span>{desc.category}</span>
                    {desc.tags.map((tag) => (
                      <span key={tag} className="tile-info-tag">{tag}</span>
                    ))}
                  </div>
                  <div className="tile-info-row">
                    <span>{desc.name}</span>
                  </div>
                  {desc.fileName && (
                    <div className="tile-info-row">
                      <span className="tile-info-file">{desc.fileName}</span>
                    </div>
                  )}
                  <div className="tile-info-row">
                    <span className="tile-info-label">ID {tileId}</span>
                    <span className="tile-info-label">시트#{desc.sheetIndex}</span>
                    <span className="tile-info-label">#{desc.indexInSheet}</span>
                  </div>
                </>
              ) : (
                <div className="tile-info-row">타일 ID: {tileId}</div>
              )}
            </div>
          </div>
        </div>
      ))}
      <div className="tile-info-hint">타일 패널의 [정보] 체크박스로 끌 수 있습니다</div>
    </div>
  );
}

/** 팔레트 툴팁용 - 단일 tileId의 정보 + 미리보기 */
export function PaletteTileTooltip({ tileId, mouseX, mouseY, tilesetNames }: {
  tileId: number; mouseX: number; mouseY: number; tilesetNames?: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const desc = useMemo(() => getTileDescription(tileId, tilesetNames), [tileId, tilesetNames]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = mouseX + 16;
    let top = mouseY + 16;
    if (left + rect.width > vw) left = mouseX - rect.width - 8;
    if (top + rect.height > vh) top = mouseY - rect.height - 8;
    if (left < 0) left = 4;
    if (top < 0) top = 4;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  });

  if (!desc) return null;

  return (
    <div ref={ref} className="tile-info-tooltip" style={{ left: mouseX + 16, top: mouseY + 16 }}>
      <div className="tile-info-content">
        <TilePreviewCanvas tileId={tileId} tilesetNames={tilesetNames} />
        <div className="tile-info-details">
          <div className="tile-info-row">
            <span>{desc.category}</span>
            {desc.tags.map((tag) => (
              <span key={tag} className="tile-info-tag">{tag}</span>
            ))}
          </div>
          <div className="tile-info-row">
            <span>{desc.name}</span>
          </div>
          {desc.fileName && (
            <div className="tile-info-row">
              <span className="tile-info-file">{desc.fileName}</span>
            </div>
          )}
          <div className="tile-info-row">
            <span className="tile-info-label">ID {tileId}</span>
            <span className="tile-info-label">시트#{desc.sheetIndex}</span>
            <span className="tile-info-label">#{desc.indexInSheet}</span>
          </div>
        </div>
      </div>
      <div className="tile-info-hint">[정보] 체크박스로 끌 수 있습니다</div>
    </div>
  );
}
