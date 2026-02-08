import React from 'react';
import type { Damage } from '../../types/rpgMakerMV';

const DAMAGE_TYPES = ['None', 'HP Damage', 'MP Damage', 'HP Recover', 'MP Recover', 'HP Drain', 'MP Drain'];

interface DamageEditorProps {
  damage: Damage;
  onChange: (damage: Damage) => void;
}

export default function DamageEditor({ damage, onChange }: DamageEditorProps) {
  const update = (field: keyof Damage, value: unknown) => {
    onChange({ ...damage, [field]: value });
  };

  return (
    <div className="damage-editor">
      <div className="db-form-section">Damage</div>
      <div className="damage-row">
        <label>
          Type
          <select value={damage.type} onChange={e => update('type', Number(e.target.value))}>
            {DAMAGE_TYPES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Element
          <input
            type="number"
            value={damage.elementId}
            onChange={e => update('elementId', Number(e.target.value))}
            min={-1}
            style={{ width: 60 }}
          />
        </label>
      </div>
      {damage.type !== 0 && (
        <>
          <label>
            Formula
            <input
              type="text"
              value={damage.formula}
              onChange={e => update('formula', e.target.value)}
            />
          </label>
          <div className="damage-row">
            <label>
              Variance
              <input
                type="number"
                value={damage.variance}
                onChange={e => update('variance', Number(e.target.value))}
                min={0}
                max={100}
                style={{ width: 60 }}
              />
            </label>
            <label className="db-checkbox-label">
              <input
                type="checkbox"
                checked={damage.critical}
                onChange={e => update('critical', e.target.checked)}
              />
              Critical
            </label>
          </div>
        </>
      )}
    </div>
  );
}
