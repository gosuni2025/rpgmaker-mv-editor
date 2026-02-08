import React from 'react';
import type { Effect } from '../../types/rpgMakerMV';

const EFFECT_CODES: Record<number, string> = {
  11: 'Recover HP', 12: 'Recover MP', 13: 'Gain TP',
  21: 'Add State', 22: 'Remove State',
  31: 'Add Buff', 32: 'Add Debuff', 33: 'Remove Buff', 34: 'Remove Debuff',
  41: 'Special Effect', 42: 'Grow', 43: 'Learn Skill', 44: 'Common Event',
};

const PARAM_NAMES = ['Max HP', 'Max MP', 'Attack', 'Defense', 'M.Attack', 'M.Defense', 'Agility', 'Luck'];
const SPECIAL_EFFECTS = ['Escape'];

interface EffectsEditorProps {
  effects: Effect[];
  onChange: (effects: Effect[]) => void;
}

export default function EffectsEditor({ effects, onChange }: EffectsEditorProps) {
  const addEffect = () => {
    onChange([...effects, { code: 11, dataId: 0, value1: 0, value2: 0 }]);
  };

  const removeEffect = (index: number) => {
    onChange(effects.filter((_, i) => i !== index));
  };

  const updateEffect = (index: number, field: keyof Effect, value: number) => {
    const newEffects = effects.map((e, i) => i === index ? { ...e, [field]: value } : e);
    onChange(newEffects);
  };

  const getEffectDescription = (eff: Effect): string => {
    switch (eff.code) {
      case 11: return `HP ${eff.value1 >= 0 ? '+' : ''}${Math.round(eff.value1 * 100)}% + ${eff.value2}`;
      case 12: return `MP ${eff.value1 >= 0 ? '+' : ''}${Math.round(eff.value1 * 100)}% + ${eff.value2}`;
      case 13: return `TP +${eff.value1}`;
      case 21: return `Add State [${eff.dataId}] ${Math.round(eff.value1 * 100)}%`;
      case 22: return `Remove State [${eff.dataId}] ${Math.round(eff.value1 * 100)}%`;
      case 31: return `Buff ${PARAM_NAMES[eff.dataId] || eff.dataId} ${eff.value1} turns`;
      case 32: return `Debuff ${PARAM_NAMES[eff.dataId] || eff.dataId} ${eff.value1} turns`;
      case 33: return `Remove Buff ${PARAM_NAMES[eff.dataId] || eff.dataId}`;
      case 34: return `Remove Debuff ${PARAM_NAMES[eff.dataId] || eff.dataId}`;
      case 41: return `Special: ${SPECIAL_EFFECTS[eff.dataId] || eff.dataId}`;
      case 42: return `Grow ${PARAM_NAMES[eff.dataId] || eff.dataId} +${eff.value1}`;
      case 43: return `Learn Skill [${eff.dataId}]`;
      case 44: return `Common Event [${eff.dataId}]`;
      default: return `Code ${eff.code}`;
    }
  };

  return (
    <div className="traits-editor">
      <div className="traits-header">
        <span>Effects</span>
        <button className="db-btn-small" onClick={addEffect}>+</button>
      </div>
      <div className="traits-list">
        {effects.map((eff, i) => (
          <div key={i} className="trait-row">
            <select
              value={eff.code}
              onChange={(e) => updateEffect(i, 'code', Number(e.target.value))}
            >
              {Object.entries(EFFECT_CODES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
            {([21, 22, 31, 32, 33, 34, 42, 43, 44].includes(eff.code)) && (
              <input
                type="number"
                value={eff.dataId}
                onChange={(e) => updateEffect(i, 'dataId', Number(e.target.value))}
                style={{ width: 50 }}
                placeholder="ID"
              />
            )}
            {([11, 12].includes(eff.code)) && (
              <>
                <input
                  type="number"
                  value={Math.round(eff.value1 * 100)}
                  onChange={(e) => updateEffect(i, 'value1', Number(e.target.value) / 100)}
                  style={{ width: 50 }}
                  placeholder="%"
                />
                <span>%+</span>
                <input
                  type="number"
                  value={eff.value2}
                  onChange={(e) => updateEffect(i, 'value2', Number(e.target.value))}
                  style={{ width: 50 }}
                />
              </>
            )}
            {eff.code === 13 && (
              <input
                type="number"
                value={eff.value1}
                onChange={(e) => updateEffect(i, 'value1', Number(e.target.value))}
                style={{ width: 50 }}
              />
            )}
            {([21, 22].includes(eff.code)) && (
              <input
                type="number"
                value={Math.round(eff.value1 * 100)}
                onChange={(e) => updateEffect(i, 'value1', Number(e.target.value) / 100)}
                style={{ width: 50 }}
                placeholder="%"
              />
            )}
            {([31, 32].includes(eff.code)) && (
              <input
                type="number"
                value={eff.value1}
                onChange={(e) => updateEffect(i, 'value1', Number(e.target.value))}
                style={{ width: 50 }}
                placeholder="turns"
              />
            )}
            {eff.code === 42 && (
              <input
                type="number"
                value={eff.value1}
                onChange={(e) => updateEffect(i, 'value1', Number(e.target.value))}
                style={{ width: 50 }}
              />
            )}
            <button className="db-btn-small" onClick={() => removeEffect(i)}>x</button>
          </div>
        ))}
        {effects.length === 0 && <div className="traits-empty">No effects</div>}
      </div>
    </div>
  );
}
