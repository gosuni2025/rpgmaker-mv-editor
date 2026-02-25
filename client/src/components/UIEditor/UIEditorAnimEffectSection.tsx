import React, { useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { UIWindowOverride, UIWindowEntranceEffect, EntranceEffectType, EntranceEasing, AnimPivotAnchor } from '../../store/types';
import DragLabel from '../common/DragLabel';
import {
  EFFECT_LABELS, EXIT_EFFECT_LABELS, EASING_LABELS,
  EFFECT_TYPES, EASING_TYPES, PIVOT_GRID, PIVOT_DOTS, makeDefaultEffect,
} from './UIEditorInspectorConstants';

// ── 회전 기준점 선택기 (3×3 그리드) ──────────────────────────────────────────

export function PivotAnchorSelector({ value, onChange }: {
  value: AnimPivotAnchor;
  onChange: (v: AnimPivotAnchor) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 20px)', gap: 2 }}>
      {PIVOT_GRID.map((row) =>
        row.map((anchor) => (
          <div key={anchor} title={anchor}
            onClick={() => onChange(anchor)}
            style={{
              width: 20, height: 20,
              border: `1px solid ${value === anchor ? '#2675bf' : '#555'}`,
              background: value === anchor ? '#2675bf33' : '#2a2a2a',
              cursor: 'pointer', borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: value === anchor ? '#7fb3e8' : '#888',
            }}
          >{PIVOT_DOTS[anchor]}</div>
        ))
      )}
    </div>
  );
}

// ── 등장/퇴장 효과 섹션 ───────────────────────────────────────────────────────

export function AnimEffectSection({ label, fieldKey, override, setMeta }: {
  label: string;
  fieldKey: 'entrances' | 'exits';
  override: UIWindowOverride | null;
  setMeta: (prop: keyof Omit<UIWindowOverride, 'className' | 'elements'>, value: unknown) => void;
}) {
  const pushUiOverrideUndo = useEditorStore((s) => s.pushUiOverrideUndo);
  const effects = override?.[fieldKey] ?? [];
  const [addOpen, setAddOpen] = useState(false);
  const effectLabels = fieldKey === 'exits' ? EXIT_EFFECT_LABELS : EFFECT_LABELS;

  const addEffect = (type: EntranceEffectType) => {
    setMeta(fieldKey, [...effects, makeDefaultEffect(type)]);
  };
  const removeEffect = (idx: number) => {
    setMeta(fieldKey, effects.filter((_, i) => i !== idx));
  };
  const updateEffect = (idx: number, patch: Partial<UIWindowEntranceEffect>) => {
    setMeta(fieldKey, effects.map((e, i) => i === idx ? { ...e, ...patch } : e));
  };
  const moveEffect = (idx: number, dir: -1 | 1) => {
    const next = [...effects];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setMeta(fieldKey, next);
  };

  const SLIDE_REVERSE: Partial<Record<EntranceEffectType, EntranceEffectType>> = {
    fadeIn: 'fadeOut', fadeOut: 'fadeIn',
  };
  const copyFromEntranceReversed = () => {
    const src = override?.entrances ?? [];
    if (src.length === 0) return;
    setMeta('exits', src.map((e) => ({ ...e, type: SLIDE_REVERSE[e.type] ?? e.type })));
  };

  return (
    <div className="ui-inspector-section">
      <div className="ui-inspector-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <div style={{ display: 'flex', gap: 4, position: 'relative' }}>
          {fieldKey === 'exits' && (
            <button
              className="ui-canvas-toolbar-btn"
              style={{ fontSize: 11, padding: '1px 7px' }}
              title="등장 효과를 반전시켜 퇴장 효과로 복사"
              onClick={copyFromEntranceReversed}
            >↩ 반전</button>
          )}
          <button
            className="ui-canvas-toolbar-btn"
            style={{ fontSize: 11, padding: '1px 7px' }}
            onClick={() => setAddOpen((v) => !v)}
          >＋ 추가</button>
          {addOpen && (
            <div className="ui-entrance-add-menu">
              {EFFECT_TYPES.map((t) => (
                <div key={t} className="ui-entrance-add-item"
                  onClick={() => { addEffect(t); setAddOpen(false); }}>
                  {effectLabels[t]}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {effects.length === 0 ? (
        <div style={{ padding: '4px 0', fontSize: 11, color: '#666' }}>효과 없음</div>
      ) : (
        effects.map((eff, idx) => (
          <div key={idx} className="ui-entrance-effect-card">
            <div className="ui-entrance-card-header">
              <span className="ui-entrance-card-label">{effectLabels[eff.type]}</span>
              <div className="ui-entrance-card-actions">
                <button title="위로" onClick={() => moveEffect(idx, -1)} disabled={idx === 0}>▲</button>
                <button title="아래로" onClick={() => moveEffect(idx, 1)} disabled={idx === effects.length - 1}>▼</button>
                <button title="삭제" className="ui-entrance-card-remove" onClick={() => removeEffect(idx)}>×</button>
              </div>
            </div>
            <div className="ui-inspector-row" style={{ marginTop: 4 }}>
              <span className="ui-inspector-label" style={{ width: 48 }}>효과</span>
              <select className="ui-entrance-select" value={eff.type}
                onChange={(e) => updateEffect(idx, { type: e.target.value as EntranceEffectType })}>
                {EFFECT_TYPES.map((t) => <option key={t} value={t}>{effectLabels[t]}</option>)}
              </select>
            </div>
            <div className="ui-inspector-row">
              <span className="ui-inspector-label" style={{ width: 48 }}>이징</span>
              <select className="ui-entrance-select" value={eff.easing}
                onChange={(e) => updateEffect(idx, { easing: e.target.value as EntranceEasing })}>
                {EASING_TYPES.map((t) => <option key={t} value={t}>{EASING_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="ui-inspector-row">
              <DragLabel label="지속 (ms)" value={eff.duration} min={50} max={3000}
                onDragStart={() => pushUiOverrideUndo()}
                onChange={(v) => updateEffect(idx, { duration: Math.round(v) })} />
            </div>
            <div className="ui-inspector-row">
              <DragLabel label="딜레이 (ms)" value={eff.delay ?? 0} min={0} max={3000}
                onDragStart={() => pushUiOverrideUndo()}
                onChange={(v) => updateEffect(idx, { delay: Math.round(v) })} />
            </div>
            {(eff.type === 'zoom' || eff.type === 'bounce') && (
              <div className="ui-inspector-row">
                <DragLabel label="시작 크기" value={Math.round((eff.fromScale ?? 0) * 100)} min={0} max={200}
                  onDragStart={() => pushUiOverrideUndo()}
                  onChange={(v) => updateEffect(idx, { fromScale: v / 100 })} />
                <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>%</span>
              </div>
            )}
            {(eff.type === 'rotate' || eff.type === 'rotateX' || eff.type === 'rotateY') && (
              <div className="ui-inspector-row">
                <DragLabel label="각도" value={eff.fromAngle ?? (eff.type === 'rotate' ? 180 : 90)} min={-720} max={720}
                  onDragStart={() => pushUiOverrideUndo()}
                  onChange={(v) => updateEffect(idx, { fromAngle: Math.round(v) })} />
                <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>°</span>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
