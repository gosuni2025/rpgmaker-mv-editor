import React from 'react';
import type { Trait } from '../../types/rpgMakerMV';

const TRAIT_CODES: Record<number, string> = {
  11: 'Element Rate', 12: 'Debuff Rate', 13: 'State Rate', 14: 'State Resist',
  21: 'Parameter', 22: 'Ex-Parameter', 23: 'Sp-Parameter',
  31: 'Attack Element', 32: 'Attack State', 33: 'Attack Speed', 34: 'Attack Times+',
  41: 'Add Skill Type', 42: 'Seal Skill Type', 43: 'Add Skill', 44: 'Seal Skill',
  51: 'Equip Weapon Type', 52: 'Equip Armor Type', 53: 'Lock Equip', 54: 'Seal Equip', 55: 'Slot Type',
  61: 'Action Times+', 62: 'Special Flag', 63: 'Collapse Effect', 64: 'Party Ability',
};

const PARAM_NAMES = ['Max HP', 'Max MP', 'Attack', 'Defense', 'M.Attack', 'M.Defense', 'Agility', 'Luck'];
const XPARAM_NAMES = ['Hit Rate', 'Evasion', 'Critical', 'Crit Evasion', 'Magic Evasion', 'Magic Reflect', 'Counter', 'HP Regen', 'MP Regen', 'TP Regen'];
const SPARAM_NAMES = ['Target Rate', 'Guard Effect', 'Recovery', 'Pharmacology', 'MP Cost', 'TP Charge', 'Physical Damage', 'Magical Damage', 'Floor Damage', 'EXP Rate'];
const SPECIAL_FLAGS = ['Auto Battle', 'Guard', 'Substitute', 'Preserve TP'];
const COLLAPSE_EFFECTS = ['Boss', 'Instant', 'Not Disappear'];
const PARTY_ABILITIES = ['Encounter Half', 'Encounter None', 'Cancel Surprise', 'Raise Preemptive', 'Gold Double', 'Drop Item Double'];

function getDataIdLabel(code: number, dataId: number): string {
  if (code === 21) return PARAM_NAMES[dataId] || `Param ${dataId}`;
  if (code === 22) return XPARAM_NAMES[dataId] || `XParam ${dataId}`;
  if (code === 23) return SPARAM_NAMES[dataId] || `SParam ${dataId}`;
  if (code === 62) return SPECIAL_FLAGS[dataId] || `Flag ${dataId}`;
  if (code === 63) return COLLAPSE_EFFECTS[dataId] || `Collapse ${dataId}`;
  if (code === 64) return PARTY_ABILITIES[dataId] || `Ability ${dataId}`;
  return String(dataId);
}

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
        <span>Traits</span>
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
        {traits.length === 0 && <div className="traits-empty">No traits</div>}
      </div>
    </div>
  );
}
