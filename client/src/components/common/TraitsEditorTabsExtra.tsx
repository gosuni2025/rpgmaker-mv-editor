import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TraitsTabSharedProps } from './TraitsEditorTabs';

// --- Equip Tab (장비) ---

interface EquipTabProps extends TraitsTabSharedProps {
  weaponTypes: string[];
  armorTypes: string[];
  equipTypes: string[];
}

export function EquipTab({
  formCode, formDataId,
  switchCode, setFormDataId,
  weaponTypes, armorTypes, equipTypes,
}: EquipTabProps) {
  const { t } = useTranslation();
  return (
    <div className="trait-tab-content">
      {/* 장착 무기 유형 (51) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 51} onChange={() => switchCode(51)} />
          <span className="trait-radio-label">{t('traits.codes.51')}</span>
        </label>
        {formCode === 51 && (
          <div className="trait-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {weaponTypes.map((name, i) => name ? <option key={i} value={i}>{name}</option> : null)}
            </select>
          </div>
        )}
      </div>
      {/* 장착 방어구 유형 (52) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 52} onChange={() => switchCode(52)} />
          <span className="trait-radio-label">{t('traits.codes.52')}</span>
        </label>
        {formCode === 52 && (
          <div className="trait-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {armorTypes.map((name, i) => name ? <option key={i} value={i}>{name}</option> : null)}
            </select>
          </div>
        )}
      </div>
      {/* 장착 고정 (53) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 53} onChange={() => switchCode(53)} />
          <span className="trait-radio-label">{t('traits.codes.53')}</span>
        </label>
        {formCode === 53 && (
          <div className="trait-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {equipTypes.map((name, i) => name ? <option key={i} value={i}>{name}</option> : null)}
            </select>
          </div>
        )}
      </div>
      {/* 장착 봉인 (54) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 54} onChange={() => switchCode(54)} />
          <span className="trait-radio-label">{t('traits.codes.54')}</span>
        </label>
        {formCode === 54 && (
          <div className="trait-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {equipTypes.map((name, i) => name ? <option key={i} value={i}>{name}</option> : null)}
            </select>
          </div>
        )}
      </div>
      {/* 슬롯 타입 (55) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 55} onChange={() => switchCode(55)} />
          <span className="trait-radio-label">{t('traits.codes.55')}</span>
        </label>
        {formCode === 55 && (
          <div className="trait-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              <option value={0}>{t('traits.slotTypes.0')}</option>
              <option value={1}>{t('traits.slotTypes.1')}</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Other Tab (기타) ---

interface OtherTabProps extends TraitsTabSharedProps {
  SPECIAL_FLAGS: string[];
  COLLAPSE_EFFECTS: string[];
  PARTY_ABILITIES: string[];
}

export function OtherTab({
  formCode, formDataId, formValue,
  switchCode, setFormDataId, setFormValue,
  SPECIAL_FLAGS, COLLAPSE_EFFECTS, PARTY_ABILITIES,
}: OtherTabProps) {
  const { t } = useTranslation();
  return (
    <div className="trait-tab-content">
      {/* 행동 횟수 추가 (61) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 61} onChange={() => switchCode(61)} />
          <span className="trait-radio-label">{t('traits.codes.61')}</span>
        </label>
        {formCode === 61 && (
          <div className="trait-fields">
            <div className="trait-field-group">
              <input type="number" value={Math.round(formValue * 100)} onChange={e => setFormValue(Number(e.target.value) / 100)} min={0} max={100} />
              <span className="trait-unit">%</span>
            </div>
          </div>
        )}
      </div>
      {/* 특수 플래그 (62) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 62} onChange={() => switchCode(62)} />
          <span className="trait-radio-label">{t('traits.codes.62')}</span>
        </label>
        {formCode === 62 && (
          <div className="trait-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {SPECIAL_FLAGS.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
          </div>
        )}
      </div>
      {/* 소멸 이펙트 (63) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 63} onChange={() => switchCode(63)} />
          <span className="trait-radio-label">{t('traits.codes.63')}</span>
        </label>
        {formCode === 63 && (
          <div className="trait-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {COLLAPSE_EFFECTS.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
          </div>
        )}
      </div>
      {/* 파티 능력 (64) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 64} onChange={() => switchCode(64)} />
          <span className="trait-radio-label">{t('traits.codes.64')}</span>
        </label>
        {formCode === 64 && (
          <div className="trait-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {PARTY_ABILITIES.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
