import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Damage } from '../../types/rpgMakerMV';
import './DamageEditor.css';

interface DamageEditorProps {
  damage: Damage;
  onChange: (damage: Damage) => void;
}

export default function DamageEditor({ damage, onChange }: DamageEditorProps) {
  const { t } = useTranslation();

  const DAMAGE_TYPES = useMemo(() => [
    t('damage.types.0'), t('damage.types.1'), t('damage.types.2'), t('damage.types.3'),
    t('damage.types.4'), t('damage.types.5'), t('damage.types.6'),
  ], [t]);

  const update = (field: keyof Damage, value: unknown) => {
    onChange({ ...damage, [field]: value });
  };

  return (
    <div className="damage-editor">
      <div className="db-form-section">{t('damage.title')}</div>
      <div className="damage-row">
        <label>
          {t('damage.type')}
          <select value={damage.type} onChange={e => update('type', Number(e.target.value))}>
            {DAMAGE_TYPES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          {t('damage.element')}
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
            {t('damage.formula')}
            <input
              type="text"
              value={damage.formula}
              onChange={e => update('formula', e.target.value)}
            />
          </label>
          <div className="damage-row">
            <label>
              {t('damage.variance')}
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
              {t('damage.critical')}
            </label>
          </div>
        </>
      )}
    </div>
  );
}
