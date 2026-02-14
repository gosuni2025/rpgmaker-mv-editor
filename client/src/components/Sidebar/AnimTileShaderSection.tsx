import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { AnimTileShaderSettings } from '../../types/rpgMakerMV';
import { DEFAULT_WATER_SETTINGS, DEFAULT_WATERFALL_SETTINGS } from '../../types/rpgMakerMV';
import { getA1KindName, getA1KindType, getUsedA1Kinds } from '../../utils/tileHelper';

function getDefaultForKind(kind: number): AnimTileShaderSettings {
  const type = getA1KindType(kind);
  if (type === 'waterfall') return DEFAULT_WATERFALL_SETTINGS;
  return DEFAULT_WATER_SETTINGS;
}

// A1 kind별 "완전 내부" 타일 미리보기를 조합하여 그리기
// rpg_core.js의 Tilemap._drawAutotile + FLOOR/WATERFALL_AUTOTILE_TABLE 기반
// 수면 오토타일: shape 0 = [[2,4],[1,4],[2,3],[1,3]] (내부 패턴)
// 폭포 오토타일: shape 3 = [[0,0],[3,0],[0,1],[3,1]] (내부 패턴)
function drawA1KindIcon(ctx: CanvasRenderingContext2D, img: HTMLImageElement, kind: number) {
  let bx: number, by: number;
  const isWaterfall = kind >= 4 && kind % 2 === 1;

  if (kind === 0) { bx = 0; by = 0; }
  else if (kind === 1) { bx = 0; by = 3; }
  else if (kind === 2) { bx = 6; by = 0; }
  else if (kind === 3) { bx = 6; by = 3; }
  else {
    const tx = kind % 8;
    const ty = Math.floor(kind / 8);
    bx = Math.floor(tx / 4) * 8;
    by = ty * 6 + Math.floor(tx / 2) % 2 * 3;
    if (isWaterfall) bx += 6;
  }

  // 반타일 크기 = 24px, 아이콘 = 24x24 (반타일 12px로 축소)
  const hw = 12; // 아이콘에서 반타일 크기
  const sw = 24; // 소스에서 반타일 크기

  // 내부 패턴의 반타일 4개 좌표 (qsx, qsy)
  let quarters: [number, number][];
  if (isWaterfall) {
    // WATERFALL_AUTOTILE_TABLE[3] = [[0,0],[3,0],[0,1],[3,1]]
    quarters = [[0, 0], [3, 0], [0, 1], [3, 1]];
  } else {
    // FLOOR_AUTOTILE_TABLE[0] = [[2,4],[1,4],[2,3],[1,3]]
    quarters = [[2, 4], [1, 4], [2, 3], [1, 3]];
  }

  for (let i = 0; i < 4; i++) {
    const [qsx, qsy] = quarters[i];
    const srcX = (bx * 2 + qsx) * sw;
    const srcY = (by * 2 + qsy) * sw;
    const dx = (i % 2) * hw;
    const dy = Math.floor(i / 2) * hw;
    ctx.drawImage(img, srcX, srcY, sw, sw, dx, dy, hw, hw);
  }
}

/** A1 타일셋에서 kind의 내부 패턴 미리보기 캔버스 (24x24) */
function A1KindIcon({ kind, tilesetNames }: { kind: number; tilesetNames?: string[] }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 24, 24);

    const a1Name = tilesetNames?.[0];
    if (!a1Name) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => drawA1KindIcon(ctx, img, kind);
    img.src = `/img/tilesets/${a1Name}.png`;
  }, [kind, tilesetNames]);

  return <canvas ref={canvasRef} width={24} height={24} style={{ width: 24, height: 24, imageRendering: 'pixelated', flexShrink: 0 }} />;
}

/** A1 txt 파일에서 kind별 이름 파싱 (kind 0~15, 구분자 '|'로 다국어 분리) */
function useA1KindNames(tilesetNames?: string[]): { names: string[][] | null; langCount: number } {
  const [names, setNames] = useState<string[][] | null>(null);
  const a1Name = tilesetNames?.[0];

  useEffect(() => {
    if (!a1Name) { setNames(null); return; }
    fetch(`/img/tilesets/${a1Name}.txt`)
      .then(r => r.ok ? r.text() : null)
      .then(text => {
        if (!text) { setNames(null); return; }
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        setNames(lines.map(l => l.split('|').map(s => s.trim())));
      })
      .catch(() => setNames(null));
  }, [a1Name]);

  const langCount = names && names.length > 0 ? names[0].length : 0;
  return { names, langCount };
}

export function AnimTileShaderSection({ currentMap, updateMapField, ExtBadge }: {
  currentMap: any;
  updateMapField: (field: string, value: unknown) => void;
  ExtBadge: React.ComponentType<{ inline?: boolean }>;
}) {
  const [expandedKinds, setExpandedKinds] = useState<Set<number>>(new Set());
  const [langIndex, setLangIndex] = useState(0);

  const settings: Record<number, AnimTileShaderSettings> = currentMap.animTileSettings || {};
  const usedKindSet = useMemo(() => {
    const kinds = getUsedA1Kinds(currentMap.data || [], currentMap.width || 0, currentMap.height || 0);
    return new Set(kinds);
  }, [currentMap.data, currentMap.width, currentMap.height]);
  // kind 2,3은 정적 오토타일 (애니메이션 없음) → 셰이더 대상 제외
  const ALL_KINDS = [0,1,4,5,6,7,8,9,10,11,12,13,14,15];

  const { names: a1Names, langCount } = useA1KindNames(currentMap.tilesetNames);

  const getKindDisplayName = useCallback((kind: number): string => {
    if (a1Names && kind < a1Names.length) {
      const entry = a1Names[kind];
      const li = Math.min(langIndex, entry.length - 1);
      if (entry[li]) return entry[li];
    }
    return getA1KindName(kind);
  }, [a1Names, langIndex]);

  const toggleExpand = (kind: number) => {
    setExpandedKinds(prev => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind); else next.add(kind);
      return next;
    });
  };

  const updateKindSetting = (kind: number, field: keyof AnimTileShaderSettings, value: unknown) => {
    const current = settings[kind] || getDefaultForKind(kind);
    const updated = { ...settings, [kind]: { ...current, [field]: value } };
    updateMapField('animTileSettings', updated);
  };

  const resetKind = (kind: number) => {
    const updated = { ...settings };
    delete updated[kind];
    updateMapField('animTileSettings', Object.keys(updated).length > 0 ? updated : undefined);
  };

  return (
    <div className="light-inspector-section">
      <div className="light-inspector-title">
        애니메이션 타일 셰이더
        <ExtBadge inline />
        {langCount > 1 && (
          <button
            className="anim-tile-lang-btn"
            title="이름 언어 전환"
            onClick={(e) => { e.stopPropagation(); setLangIndex(i => (i + 1) % langCount); }}
          >
            언어 : {langIndex + 1}/{langCount}
          </button>
        )}
      </div>
      {ALL_KINDS.map(kind => {
        const s = settings[kind] || getDefaultForKind(kind);
        const expanded = expandedKinds.has(kind);
        const kindType = getA1KindType(kind);
        const hasCustom = !!settings[kind];
        const isUsed = usedKindSet.has(kind);
        return (
          <div key={kind} className={`anim-tile-kind-panel${!isUsed ? ' anim-tile-kind-unused' : ''}`}>
            <div
              className="anim-tile-kind-header"
              onClick={() => toggleExpand(kind)}
            >
              <span className="anim-tile-kind-arrow">{expanded ? '\u25BC' : '\u25B6'}</span>
              <A1KindIcon kind={kind} tilesetNames={currentMap.tilesetNames} />
              <span className="anim-tile-kind-name">{getKindDisplayName(kind)}{!isUsed && <span className="anim-tile-unused-tag">(미사용)</span>}</span>
              <span className={`anim-tile-kind-type anim-tile-kind-type-${kindType}`}>{kindType}</span>
              {hasCustom && <span className="anim-tile-kind-custom" title="커스텀 설정 적용됨">{'\u2022'}</span>}
            </div>
            {expanded && (
              <div className="anim-tile-kind-body">
                <label className="map-inspector-checkbox">
                  <input type="checkbox" checked={s.enabled !== false}
                    onChange={(e) => updateKindSetting(kind, 'enabled', e.target.checked)} />
                  <span>셰이더 적용</span>
                </label>
                {s.enabled !== false && (
                  <>
                    <AnimSlider label="물결 진폭" value={s.waveAmplitude} min={0} max={0.05} step={0.001}
                      onChange={(v) => updateKindSetting(kind, 'waveAmplitude', v)} />
                    <AnimSlider label="물결 주파수" value={s.waveFrequency} min={0} max={20} step={0.5}
                      onChange={(v) => updateKindSetting(kind, 'waveFrequency', v)} />
                    <AnimSlider label="물결 속도" value={s.waveSpeed} min={0} max={10} step={0.1}
                      onChange={(v) => updateKindSetting(kind, 'waveSpeed', v)} />
                    <AnimSlider label="색상 밝기" value={s.waterAlpha} min={0} max={1} step={0.05}
                      onChange={(v) => updateKindSetting(kind, 'waterAlpha', v)} />
                    <AnimSlider label="반사 강도" value={s.specularStrength} min={0} max={3} step={0.1}
                      onChange={(v) => updateKindSetting(kind, 'specularStrength', v)} />
                    <AnimSlider label="발광 강도" value={s.emissive} min={0} max={2} step={0.05}
                      onChange={(v) => updateKindSetting(kind, 'emissive', v)} />
                    {s.emissive > 0 && (
                      <div className="light-inspector-row">
                        <span className="light-inspector-label">발광 색상</span>
                        <input type="color" value={s.emissiveColor || '#ffffff'}
                          onChange={(e) => updateKindSetting(kind, 'emissiveColor', e.target.value)}
                          style={{ width: 32, height: 20, padding: 0, border: '1px solid #555' }} />
                      </div>
                    )}
                    {hasCustom && (
                      <button className="anim-tile-reset-btn" onClick={() => resetKind(kind)}>
                        기본값 복원
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AnimSlider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="anim-tile-slider-row">
      <span className="anim-tile-slider-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        className="anim-tile-slider"
        onChange={(e) => onChange(Number(e.target.value))} />
      <input type="number" step={step} value={value}
        className="anim-tile-slider-value"
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
