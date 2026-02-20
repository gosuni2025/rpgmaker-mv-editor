import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { BloomConfig, DofConfig } from '../../types/rpgMakerMV';
import { DEFAULT_BLOOM_CONFIG, DEFAULT_DOF_CONFIG } from '../../types/rpgMakerMV';
import ExtBadge from '../common/ExtBadge';
import { AnimSlider } from './AnimTileShaderSection';

interface PPEffectEntry {
  key: string;
  name: string;
}

interface PPParamDef {
  key: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  default: any;
  type?: string;
  options?: { v: number; l: string }[];
}

function getEffectList(): PPEffectEntry[] {
  const w = window as any;
  if (w.PostProcessEffects?.EFFECT_LIST) {
    return w.PostProcessEffects.EFFECT_LIST.map((e: any) => ({ key: e.key, name: e.name }));
  }
  return [];
}

function getEffectParams(key: string): PPParamDef[] {
  const w = window as any;
  if (w.PostProcessEffects?.EFFECT_PARAMS?.[key]) {
    return w.PostProcessEffects.EFFECT_PARAMS[key];
  }
  return [];
}

export function PostProcessSection({ currentMap, updateMapField }: {
  currentMap: any;
  updateMapField: (field: string, value: unknown) => void;
}) {
  const postProcessConfig = useEditorStore((s) => s.postProcessConfig);
  const updatePostProcessEffect = useEditorStore((s) => s.updatePostProcessEffect);
  const [expandedEffects, setExpandedEffects] = useState<Set<string>>(new Set());

  const [effectList, setEffectList] = useState<PPEffectEntry[]>(() => getEffectList());
  useEffect(() => {
    if (effectList.length > 0) return;
    const timer = setInterval(() => {
      const list = getEffectList();
      if (list.length > 0) {
        setEffectList(list);
        clearInterval(timer);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [effectList.length]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedEffects(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleToggleEffect = useCallback((key: string, enabled: boolean) => {
    updatePostProcessEffect(key, { enabled });
  }, [updatePostProcessEffect]);

  const handleParamChange = useCallback((effectKey: string, paramKey: string, value: any) => {
    updatePostProcessEffect(effectKey, { [paramKey]: value });
  }, [updatePostProcessEffect]);

  const handleResetEffect = useCallback((key: string) => {
    const params = getEffectParams(key);
    const defaults: Record<string, any> = { enabled: false };
    for (const p of params) {
      defaults[p.key] = p.default;
    }
    updatePostProcessEffect(key, defaults);
  }, [updatePostProcessEffect]);

  // 블룸
  const bloom: BloomConfig = currentMap.bloomConfig || DEFAULT_BLOOM_CONFIG;

  const updateBloom = useCallback((field: keyof BloomConfig, value: unknown) => {
    const cur: BloomConfig = useEditorStore.getState().currentMap?.bloomConfig || DEFAULT_BLOOM_CONFIG;
    const updated = { ...cur, [field]: value };
    updateMapField('bloomConfig', updated);
    const DOF = (window as any).PostProcess;
    if (DOF) {
      DOF.bloomConfig.threshold = updated.threshold;
      DOF.bloomConfig.strength = updated.strength;
      DOF.bloomConfig.radius = updated.radius;
      DOF.bloomConfig.downscale = updated.downscale;
      if (DOF._bloomPass) DOF._bloomPass.enabled = updated.enabled;
    }
  }, [updateMapField]);

  const handleBloomReset = useCallback(() => {
    updateMapField('bloomConfig', undefined);
    const DOF = (window as any).PostProcess;
    if (DOF) {
      DOF.bloomConfig.threshold = DEFAULT_BLOOM_CONFIG.threshold;
      DOF.bloomConfig.strength = DEFAULT_BLOOM_CONFIG.strength;
      DOF.bloomConfig.radius = DEFAULT_BLOOM_CONFIG.radius;
      DOF.bloomConfig.downscale = DEFAULT_BLOOM_CONFIG.downscale;
      if (DOF._bloomPass) DOF._bloomPass.enabled = DEFAULT_BLOOM_CONFIG.enabled;
    }
  }, [updateMapField]);

  // DoF
  const dof: DofConfig = currentMap.dofConfig || DEFAULT_DOF_CONFIG;

  const updateDof = useCallback((field: keyof DofConfig, value: unknown) => {
    const cur: DofConfig = useEditorStore.getState().currentMap?.dofConfig || DEFAULT_DOF_CONFIG;
    const updated = { ...cur, [field]: value };
    updateMapField('dofConfig', updated);
    const PP = (window as any).PostProcess;
    if (PP) {
      PP.config.focusY = updated.focusY;
      PP.config.focusRange = updated.focusRange;
      PP.config.maxblur = updated.maxBlur;
      PP.config.blurPower = updated.blurPower;
      if ((window as any).ConfigManager) (window as any).ConfigManager.depthOfField = updated.enabled;
    }
  }, [updateMapField]);

  const handleDofReset = useCallback(() => {
    updateMapField('dofConfig', undefined);
    const PP = (window as any).PostProcess;
    if (PP) {
      PP.config.focusY = DEFAULT_DOF_CONFIG.focusY;
      PP.config.focusRange = DEFAULT_DOF_CONFIG.focusRange;
      PP.config.maxblur = DEFAULT_DOF_CONFIG.maxBlur;
      PP.config.blurPower = DEFAULT_DOF_CONFIG.blurPower;
      if ((window as any).ConfigManager) (window as any).ConfigManager.depthOfField = DEFAULT_DOF_CONFIG.enabled;
    }
  }, [updateMapField]);

  const enabledCount = useMemo(() => {
    let count = Object.values(postProcessConfig).filter(c => c?.enabled).length;
    if (bloom.enabled !== false) count++;
    if (dof.enabled) count++;
    return count;
  }, [postProcessConfig, bloom.enabled, dof.enabled]);

  return (
    <div className="light-inspector-section">
      <div className="light-inspector-title">
        포스트 프로세싱
        <ExtBadge inline />
        {enabledCount > 0 && (
          <span className="pp-enabled-count">{enabledCount}</span>
        )}
      </div>

      {/* 블룸 */}
      <div className="anim-tile-kind-panel">
        <div className="anim-tile-kind-header" onClick={() => toggleExpand('__bloom__')}>
          <span className="anim-tile-kind-arrow">{expandedEffects.has('__bloom__') ? '\u25BC' : '\u25B6'}</span>
          <span className="anim-tile-kind-name">블룸</span>
          {bloom.enabled !== false && <span className="pp-effect-active-dot" title="활성">{'\u2022'}</span>}
        </div>
        {expandedEffects.has('__bloom__') && (
          <div className="anim-tile-kind-body">
            <label className="map-inspector-checkbox">
              <input type="checkbox" checked={bloom.enabled !== false}
                onChange={(e) => updateBloom('enabled', e.target.checked)} />
              <span>활성화</span>
            </label>
            {bloom.enabled !== false && (
              <>
                <AnimSlider label="밝기 임계값" value={bloom.threshold} min={0} max={1} step={0.05}
                  onChange={(v) => updateBloom('threshold', v)} />
                <AnimSlider label="강도" value={bloom.strength} min={0} max={10} step={0.05}
                  onChange={(v) => updateBloom('strength', v)} />
                <AnimSlider label="블러 반경" value={bloom.radius} min={0} max={10} step={0.1}
                  onChange={(v) => updateBloom('radius', v)} />
                <AnimSlider label="다운스케일" value={bloom.downscale} min={1} max={8} step={1}
                  onChange={(v) => updateBloom('downscale', v)} />
                {currentMap.bloomConfig && (
                  <button className="anim-tile-reset-btn" onClick={handleBloomReset}>
                    초기화
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* DoF (피사계 심도) */}
      <div className="anim-tile-kind-panel">
        <div className="anim-tile-kind-header" onClick={() => toggleExpand('__dof__')}>
          <span className="anim-tile-kind-arrow">{expandedEffects.has('__dof__') ? '\u25BC' : '\u25B6'}</span>
          <span className="anim-tile-kind-name">DoF (피사계 심도)</span>
          {dof.enabled && <span className="pp-effect-active-dot" title="활성">{'\u2022'}</span>}
        </div>
        {expandedEffects.has('__dof__') && (
          <div className="anim-tile-kind-body">
            <label className="map-inspector-checkbox">
              <input type="checkbox" checked={dof.enabled}
                onChange={(e) => updateDof('enabled', e.target.checked)} />
              <span>활성화</span>
            </label>
            {dof.enabled && (
              <>
                <AnimSlider label="Focus Y" value={dof.focusY} min={0} max={1} step={0.01}
                  onChange={(v) => updateDof('focusY', v)} />
                <AnimSlider label="Range" value={dof.focusRange} min={0} max={0.5} step={0.01}
                  onChange={(v) => updateDof('focusRange', v)} />
                <AnimSlider label="Max Blur" value={dof.maxBlur} min={0} max={0.2} step={0.005}
                  onChange={(v) => updateDof('maxBlur', v)} />
                <AnimSlider label="Blur Power" value={dof.blurPower} min={0.5} max={5} step={0.1}
                  onChange={(v) => updateDof('blurPower', v)} />
                {currentMap.dofConfig && (
                  <button className="anim-tile-reset-btn" onClick={handleDofReset}>
                    초기화
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {effectList.map(effect => {
        const config = postProcessConfig[effect.key] || { enabled: false };
        const expanded = expandedEffects.has(effect.key);
        const params = getEffectParams(effect.key);
        return (
          <div key={effect.key} className="anim-tile-kind-panel">
            <div className="anim-tile-kind-header" onClick={() => toggleExpand(effect.key)}>
              <span className="anim-tile-kind-arrow">{expanded ? '\u25BC' : '\u25B6'}</span>
              <span className="anim-tile-kind-name">{effect.name}</span>
              {config.enabled && <span className="pp-effect-active-dot" title="활성">{'\u2022'}</span>}
            </div>
            {expanded && (
              <div className="anim-tile-kind-body">
                <label className="map-inspector-checkbox">
                  <input
                    type="checkbox"
                    checked={!!config.enabled}
                    onChange={(e) => handleToggleEffect(effect.key, e.target.checked)}
                  />
                  <span>활성화</span>
                </label>
                {config.enabled && params.map(p => {
                  if (p.type === 'select' && p.options) {
                    const val = config[p.key] ?? p.default;
                    return (
                      <div key={p.key} className="anim-tile-slider-row">
                        <span className="anim-tile-slider-label">{p.label}</span>
                        <select
                          className="map-inspector-select"
                          style={{ flex: 1 }}
                          value={val}
                          onChange={(e) => handleParamChange(effect.key, p.key, Number(e.target.value))}
                        >
                          {p.options.map(o => (
                            <option key={o.v} value={o.v}>{o.l}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  if (p.type === 'color') {
                    const val = config[p.key] ?? p.default;
                    return (
                      <div key={p.key} className="light-inspector-row">
                        <span className="light-inspector-label">{p.label}</span>
                        <input
                          type="color"
                          value={val}
                          onChange={(e) => handleParamChange(effect.key, p.key, e.target.value)}
                          style={{ width: 32, height: 20, padding: 0, border: '1px solid #555' }}
                        />
                      </div>
                    );
                  }
                  const val = config[p.key] ?? p.default;
                  return (
                    <AnimSlider
                      key={p.key}
                      label={p.label}
                      value={val}
                      min={p.min ?? 0}
                      max={p.max ?? 1}
                      step={p.step ?? 0.01}
                      onChange={(v) => handleParamChange(effect.key, p.key, v)}
                    />
                  );
                })}
                {config.enabled && (
                  <button className="anim-tile-reset-btn" onClick={() => handleResetEffect(effect.key)}>
                    초기화
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
