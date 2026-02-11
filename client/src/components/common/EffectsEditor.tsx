import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Effect } from '../../types/rpgMakerMV';

interface EffectsEditorProps {
  effects: Effect[];
  onChange: (effects: Effect[]) => void;
}

export default function EffectsEditor({ effects, onChange }: EffectsEditorProps) {
  const { t } = useTranslation();

  const EFFECT_CODES: Record<number, string> = useMemo(() => ({
    11: t('effects.codes.11'), 12: t('effects.codes.12'), 13: t('effects.codes.13'),
    21: t('effects.codes.21'), 22: t('effects.codes.22'),
    31: t('effects.codes.31'), 32: t('effects.codes.32'), 33: t('effects.codes.33'), 34: t('effects.codes.34'),
    41: t('effects.codes.41'), 42: t('effects.codes.42'), 43: t('effects.codes.43'), 44: t('effects.codes.44'),
  }), [t]);

  const PARAM_NAMES = useMemo(() => [
    t('params.maxHP'), t('params.maxMP'), t('params.attack'), t('params.defense'),
    t('params.mAttack'), t('params.mDefense'), t('params.agility'), t('params.luck'),
  ], [t]);

  const SPECIAL_EFFECTS = useMemo(() => [
    t('effects.specialEffects.0'),
  ], [t]);

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
      case 21: return `${t('effects.codes.21')} [${eff.dataId}] ${Math.round(eff.value1 * 100)}%`;
      case 22: return `${t('effects.codes.22')} [${eff.dataId}] ${Math.round(eff.value1 * 100)}%`;
      case 31: return `${t('effects.codes.31')} ${PARAM_NAMES[eff.dataId] || eff.dataId} ${eff.value1} turns`;
      case 32: return `${t('effects.codes.32')} ${PARAM_NAMES[eff.dataId] || eff.dataId} ${eff.value1} turns`;
      case 33: return `${t('effects.codes.33')} ${PARAM_NAMES[eff.dataId] || eff.dataId}`;
      case 34: return `${t('effects.codes.34')} ${PARAM_NAMES[eff.dataId] || eff.dataId}`;
      case 41: return `${t('effects.codes.41')}: ${SPECIAL_EFFECTS[eff.dataId] || eff.dataId}`;
      case 42: return `${t('effects.codes.42')} ${PARAM_NAMES[eff.dataId] || eff.dataId} +${eff.value1}`;
      case 43: return `${t('effects.codes.43')} [${eff.dataId}]`;
      case 44: return `${t('effects.codes.44')} [${eff.dataId}]`;
      default: return `Code ${eff.code}`;
    }
  };

  return (
    <div className="traits-editor">
      <div className="traits-header">
        <span>{t('effects.title')}</span>
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
        {effects.length === 0 && <div className="traits-empty">{t('effects.noEffects')}</div>}
      </div>
    </div>
  );
}
