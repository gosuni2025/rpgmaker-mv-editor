import React, { useMemo, useRef, useLayoutEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { getTileDescription } from '../../utils/tileHelper';
import './TileInfoTooltip.css';

interface TileInfoTooltipProps {
  tileX: number;
  tileY: number;
  mouseX: number;
  mouseY: number;
}

const LAYER_NAMES = ['z0 (지면)', 'z1 (장식)', 'z2 (상층)', 'z3 (상층2)', 'z4 (그림자)', 'z5 (리전)'];

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

    return { tileX, tileY, layers };
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
          {desc ? (
            <>
              <div className="tile-info-row">
                <span className="tile-info-label">종류:</span>
                <span>{desc.category}</span>
                {desc.tags.map((tag) => (
                  <span key={tag} className="tile-info-tag">{tag}</span>
                ))}
              </div>
              <div className="tile-info-row">
                <span className="tile-info-label">이름:</span>
                <span>{desc.name}</span>
              </div>
              {desc.fileName && (
                <div className="tile-info-row">
                  <span className="tile-info-label">파일:</span>
                  <span className="tile-info-file">{desc.fileName}</span>
                </div>
              )}
              <div className="tile-info-row">
                <span className="tile-info-label">ID:</span>
                <span>{tileId}</span>
                <span className="tile-info-label" style={{ marginLeft: 6 }}>시트 #{desc.sheetIndex}</span>
                <span className="tile-info-label" style={{ marginLeft: 6 }}>인덱스 {desc.indexInSheet}</span>
              </div>
            </>
          ) : (
            <div className="tile-info-row">타일 ID: {tileId}</div>
          )}
        </div>
      ))}
    </div>
  );
}
