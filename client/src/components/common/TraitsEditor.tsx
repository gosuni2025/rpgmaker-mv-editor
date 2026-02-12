import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Trait } from '../../types/rpgMakerMV';
import './TraitsEditor.css';

function getValueDisplay(code: number, value: number): string {
  if ([11, 12, 13, 21, 22, 23].includes(code)) return `${Math.round(value * 100)}%`;
  if ([32].includes(code)) return `${Math.round(value * 100)}%`;
  if (code === 33) return String(value);
  if (code === 34 || code === 61) return `+${value}`;
  return String(value);
}

interface TraitsEditorProps {
  traits: Trait[];
  onChange: (traits: Trait[]) => void;
}

export default function TraitsEditor({ traits, onChange }: TraitsEditorProps) {
  const { t } = useTranslation();

  const TRAIT_CODES: Record<number, string> = useMemo(() => ({
    11: t('traits.codes.11'), 12: t('traits.codes.12'), 13: t('traits.codes.13'), 14: t('traits.codes.14'),
    21: t('traits.codes.21'), 22: t('traits.codes.22'), 23: t('traits.codes.23'),
    31: t('traits.codes.31'), 32: t('traits.codes.32'), 33: t('traits.codes.33'), 34: t('traits.codes.34'),
    41: t('traits.codes.41'), 42: t('traits.codes.42'), 43: t('traits.codes.43'), 44: t('traits.codes.44'),
    51: t('traits.codes.51'), 52: t('traits.codes.52'), 53: t('traits.codes.53'), 54: t('traits.codes.54'), 55: t('traits.codes.55'),
    61: t('traits.codes.61'), 62: t('traits.codes.62'), 63: t('traits.codes.63'), 64: t('traits.codes.64'),
  }), [t]);

  const PARAM_NAMES = useMemo(() => [
    t('params.maxHP'), t('params.maxMP'), t('params.attack'), t('params.defense'),
    t('params.mAttack'), t('params.mDefense'), t('params.agility'), t('params.luck'),
  ], [t]);

  const XPARAM_NAMES = useMemo(() => [
    t('traits.xparams.0'), t('traits.xparams.1'), t('traits.xparams.2'), t('traits.xparams.3'),
    t('traits.xparams.4'), t('traits.xparams.5'), t('traits.xparams.6'), t('traits.xparams.7'),
    t('traits.xparams.8'), t('traits.xparams.9'),
  ], [t]);

  const SPARAM_NAMES = useMemo(() => [
    t('traits.sparams.0'), t('traits.sparams.1'), t('traits.sparams.2'), t('traits.sparams.3'),
    t('traits.sparams.4'), t('traits.sparams.5'), t('traits.sparams.6'), t('traits.sparams.7'),
    t('traits.sparams.8'), t('traits.sparams.9'),
  ], [t]);

  const SPECIAL_FLAGS = useMemo(() => [
    t('traits.specialFlags.0'), t('traits.specialFlags.1'), t('traits.specialFlags.2'), t('traits.specialFlags.3'),
  ], [t]);

  const COLLAPSE_EFFECTS = useMemo(() => [
    t('traits.collapseEffects.0'), t('traits.collapseEffects.1'), t('traits.collapseEffects.2'),
  ], [t]);

  const PARTY_ABILITIES = useMemo(() => [
    t('traits.partyAbilities.0'), t('traits.partyAbilities.1'), t('traits.partyAbilities.2'),
    t('traits.partyAbilities.3'), t('traits.partyAbilities.4'), t('traits.partyAbilities.5'),
  ], [t]);

  const getDataIdLabel = (code: number, dataId: number): string => {
    if (code === 21) return PARAM_NAMES[dataId] || `Param ${dataId}`;
    if (code === 22) return XPARAM_NAMES[dataId] || `XParam ${dataId}`;
    if (code === 23) return SPARAM_NAMES[dataId] || `SParam ${dataId}`;
    if (code === 62) return SPECIAL_FLAGS[dataId] || `Flag ${dataId}`;
    if (code === 63) return COLLAPSE_EFFECTS[dataId] || `Collapse ${dataId}`;
    if (code === 64) return PARTY_ABILITIES[dataId] || `Ability ${dataId}`;
    return String(dataId);
  };

  const addTrait = () => {
    onChange([...traits, { code: 11, dataId: 0, value: 1 }]);
  };

  const removeTrait = (index: number) => {
    onChange(traits.filter((_, i) => i !== index));
  };

  const updateTrait = (index: number, field: keyof Trait, value: number) => {
    const newTraits = traits.map((t, i) => i === index ? { ...t, [field]: value } : t);
    onChange(newTraits);
  };

  const getDataIdOptions = (code: number): { value: number; label: string }[] => {
    if (code === 21) return PARAM_NAMES.map((n, i) => ({ value: i, label: n }));
    if (code === 22) return XPARAM_NAMES.map((n, i) => ({ value: i, label: n }));
    if (code === 23) return SPARAM_NAMES.map((n, i) => ({ value: i, label: n }));
    if (code === 62) return SPECIAL_FLAGS.map((n, i) => ({ value: i, label: n }));
    if (code === 63) return COLLAPSE_EFFECTS.map((n, i) => ({ value: i, label: n }));
    if (code === 64) return PARTY_ABILITIES.map((n, i) => ({ value: i, label: n }));
    return [];
  };

  const isRateTrait = (code: number) => [11, 12, 13, 21, 22, 23, 32].includes(code);
  const isNoValue = (code: number) => [14, 31, 41, 42, 43, 44, 51, 52, 53, 54, 55, 62, 63, 64].includes(code);

  return (
    <div className="traits-editor">
      <div className="traits-header">
        <span>{t('traits.title')}</span>
        <button className="db-btn-small" onClick={addTrait}>+</button>
      </div>
      <div className="traits-list">
        {traits.map((trait, i) => (
          <div key={i} className="trait-row">
            <select
              value={trait.code}
              onChange={(e) => updateTrait(i, 'code', Number(e.target.value))}
            >
              {Object.entries(TRAIT_CODES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
            {getDataIdOptions(trait.code).length > 0 ? (
              <select
                value={trait.dataId}
                onChange={(e) => updateTrait(i, 'dataId', Number(e.target.value))}
              >
                {getDataIdOptions(trait.code).map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                value={trait.dataId}
                onChange={(e) => updateTrait(i, 'dataId', Number(e.target.value))}
                style={{ width: 60 }}
              />
            )}
            {!isNoValue(trait.code) && (
              isRateTrait(trait.code) ? (
                <input
                  type="number"
                  value={Math.round(trait.value * 100)}
                  onChange={(e) => updateTrait(i, 'value', Number(e.target.value) / 100)}
                  style={{ width: 60 }}
                  min={0}
                />
              ) : (
                <input
                  type="number"
                  value={trait.value}
                  onChange={(e) => updateTrait(i, 'value', Number(e.target.value))}
                  style={{ width: 60 }}
                />
              )
            )}
            {isRateTrait(trait.code) && <span className="trait-unit">%</span>}
            <button className="db-btn-small" onClick={() => removeTrait(i)}>x</button>
          </div>
        ))}
        {traits.length === 0 && <div className="traits-empty">{t('traits.noTraits')}</div>}
      </div>
    </div>
  );
}
