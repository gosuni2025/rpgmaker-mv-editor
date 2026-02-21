import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconSprite } from '../EventEditor/dataListPicker';

export interface TraitsTabSharedProps {
  formCode: number;
  formDataId: number;
  formValue: number;
  switchCode: (code: number) => void;
  setFormDataId: (id: number) => void;
  setFormValue: (val: number) => void;
}

// --- Rate Tab (속성 효과율 / 상태 이상 유효율) ---

interface RateTabProps extends TraitsTabSharedProps {
  elements: string[];
  getStateLabel: (id: number) => string;
  getStateIconIndex: (id: number) => number | undefined;
  setPickerTarget: (target: 'state12' | 'state13' | 'state14') => void;
}

export function RateTab({
  formCode, formDataId, formValue,
  switchCode, setFormDataId, setFormValue,
  elements, getStateLabel, getStateIconIndex, setPickerTarget,
}: RateTabProps) {
  const { t } = useTranslation();
  return (
    <div className="trait-tab-content">
      {/* 속성 효과율 (11) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 11} onChange={() => switchCode(11)} />
          <span className="trait-radio-label">{t('traits.codes.11')}</span>
        </label>
        {formCode === 11 && (
          <div className="trait-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {elements.map((name, i) => name ? <option key={i} value={i}>{name}</option> : null)}
            </select>
            <span className="trait-separator">*</span>
            <div className="trait-field-group">
              <input type="number" value={Math.round(formValue * 100)} onChange={e => setFormValue(Number(e.target.value) / 100)} />
              <span className="trait-unit">%</span>
            </div>
          </div>
        )}
      </div>
      {/* 약화 유효율 (12) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 12} onChange={() => switchCode(12)} />
          <span className="trait-radio-label">{t('traits.codes.12')}</span>
        </label>
        {formCode === 12 && (
          <div className="trait-fields">
            <button className="trait-picker-btn" onClick={() => setPickerTarget('state12')}>
              {formDataId > 0 && getStateIconIndex(formDataId) != null && getStateIconIndex(formDataId)! > 0 && <IconSprite iconIndex={getStateIconIndex(formDataId)!} />}
              <span>{getStateLabel(formDataId)}</span>
            </button>
            <span className="trait-separator">*</span>
            <div className="trait-field-group">
              <input type="number" value={Math.round(formValue * 100)} onChange={e => setFormValue(Number(e.target.value) / 100)} />
              <span className="trait-unit">%</span>
            </div>
          </div>
        )}
      </div>
      {/* 스탯 비율 (13) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 13} onChange={() => switchCode(13)} />
          <span className="trait-radio-label">{t('traits.codes.13')}</span>
        </label>
        {formCode === 13 && (
          <div className="trait-fields">
            <button className="trait-picker-btn" onClick={() => setPickerTarget('state13')}>
              {formDataId > 0 && getStateIconIndex(formDataId) != null && getStateIconIndex(formDataId)! > 0 && <IconSprite iconIndex={getStateIconIndex(formDataId)!} />}
              <span>{getStateLabel(formDataId)}</span>
            </button>
            <span className="trait-separator">*</span>
            <div className="trait-field-group">
              <input type="number" value={Math.round(formValue * 100)} onChange={e => setFormValue(Number(e.target.value) / 100)} />
              <span className="trait-unit">%</span>
            </div>
          </div>
        )}
      </div>
      {/* 스탯 무효화 (14) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 14} onChange={() => switchCode(14)} />
          <span className="trait-radio-label">{t('traits.codes.14')}</span>
        </label>
        {formCode === 14 && (
          <div className="trait-fields">
            <button className="trait-picker-btn" onClick={() => setPickerTarget('state14')}>
              {formDataId > 0 && getStateIconIndex(formDataId) != null && getStateIconIndex(formDataId)! > 0 && <IconSprite iconIndex={getStateIconIndex(formDataId)!} />}
              <span>{getStateLabel(formDataId)}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Param Tab (능력치) ---

interface ParamTabProps extends TraitsTabSharedProps {
  PARAM_NAMES: string[];
  XPARAM_NAMES: string[];
  SPARAM_NAMES: string[];
}

export function ParamTab({
  formCode, formDataId, formValue,
  switchCode, setFormDataId, setFormValue,
  PARAM_NAMES, XPARAM_NAMES, SPARAM_NAMES,
}: ParamTabProps) {
  const { t } = useTranslation();
  return (
    <div className="trait-tab-content">
      {/* 일반 능력치 (21) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 21} onChange={() => switchCode(21)} />
          <span className="trait-radio-label">{t('traits.codes.21')}</span>
        </label>
        {formCode === 21 && (
          <div className="trait-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {PARAM_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
            <span className="trait-separator">*</span>
            <div className="trait-field-group">
              <input type="number" value={Math.round(formValue * 100)} onChange={e => setFormValue(Number(e.target.value) / 100)} />
              <span className="trait-unit">%</span>
            </div>
          </div>
        )}
      </div>
      {/* 추가 능력치 (22) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 22} onChange={() => switchCode(22)} />
          <span className="trait-radio-label">{t('traits.codes.22')}</span>
        </label>
        {formCode === 22 && (
          <div className="trait-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {XPARAM_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
            <span className="trait-separator">+</span>
            <div className="trait-field-group">
              <input type="number" value={Math.round(formValue * 100)} onChange={e => setFormValue(Number(e.target.value) / 100)} />
              <span className="trait-unit">%</span>
            </div>
          </div>
        )}
      </div>
      {/* 특수 능력치 (23) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 23} onChange={() => switchCode(23)} />
          <span className="trait-radio-label">{t('traits.codes.23')}</span>
        </label>
        {formCode === 23 && (
          <div className="trait-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {SPARAM_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
            <span className="trait-separator">*</span>
            <div className="trait-field-group">
              <input type="number" value={Math.round(formValue * 100)} onChange={e => setFormValue(Number(e.target.value) / 100)} />
              <span className="trait-unit">%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Attack Tab (공격) ---

interface AttackTabProps extends TraitsTabSharedProps {
  elements: string[];
  getStateLabel: (id: number) => string;
  getStateIconIndex: (id: number) => number | undefined;
  setPickerTarget: (target: 'state32') => void;
}

export function AttackTab({
  formCode, formDataId, formValue,
  switchCode, setFormDataId, setFormValue,
  elements, getStateLabel, getStateIconIndex, setPickerTarget,
}: AttackTabProps) {
  const { t } = useTranslation();
  return (
    <div className="trait-tab-content">
      {/* 공격 시 속성 (31) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 31} onChange={() => switchCode(31)} />
          <span className="trait-radio-label">{t('traits.codes.31')}</span>
        </label>
        {formCode === 31 && (
          <div className="trait-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {elements.map((name, i) => name ? <option key={i} value={i}>{name}</option> : null)}
            </select>
          </div>
        )}
      </div>
      {/* 공격 시 스탯 (32) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 32} onChange={() => switchCode(32)} />
          <span className="trait-radio-label">{t('traits.codes.32')}</span>
        </label>
        {formCode === 32 && (
          <div className="trait-fields">
            <button className="trait-picker-btn" onClick={() => setPickerTarget('state32')}>
              {formDataId > 0 && getStateIconIndex(formDataId) != null && getStateIconIndex(formDataId)! > 0 && <IconSprite iconIndex={getStateIconIndex(formDataId)!} />}
              <span>{getStateLabel(formDataId)}</span>
            </button>
            <span className="trait-separator">+</span>
            <div className="trait-field-group">
              <input type="number" value={Math.round(formValue * 100)} onChange={e => setFormValue(Number(e.target.value) / 100)} min={0} max={1000} />
              <span className="trait-unit">%</span>
            </div>
          </div>
        )}
      </div>
      {/* 공격 속도 (33) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 33} onChange={() => switchCode(33)} />
          <span className="trait-radio-label">{t('traits.codes.33')}</span>
        </label>
        {formCode === 33 && (
          <div className="trait-fields">
            <div className="trait-field-group">
              <input type="number" value={formValue} onChange={e => setFormValue(Number(e.target.value))} />
            </div>
          </div>
        )}
      </div>
      {/* 공격 추가 횟수 (34) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 34} onChange={() => switchCode(34)} />
          <span className="trait-radio-label">{t('traits.codes.34')}</span>
        </label>
        {formCode === 34 && (
          <div className="trait-fields">
            <div className="trait-field-group">
              <input type="number" value={formValue} onChange={e => setFormValue(Number(e.target.value))} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Skill Tab (스킬) ---

interface SkillTabProps extends TraitsTabSharedProps {
  skillTypes: string[];
  getSkillLabel: (id: number) => string;
  getSkillIconIndex: (id: number) => number | undefined;
  setPickerTarget: (target: 'skill43' | 'skill44') => void;
}

export function SkillTab({
  formCode, formDataId,
  switchCode, setFormDataId,
  skillTypes, getSkillLabel, getSkillIconIndex, setPickerTarget,
}: SkillTabProps) {
  const { t } = useTranslation();
  return (
    <div className="trait-tab-content">
      {/* 스킬 타입 추가 (41) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 41} onChange={() => switchCode(41)} />
          <span className="trait-radio-label">{t('traits.codes.41')}</span>
        </label>
        {formCode === 41 && (
          <div className="trait-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {skillTypes.map((name, i) => name ? <option key={i} value={i}>{name}</option> : null)}
            </select>
          </div>
        )}
      </div>
      {/* 스킬 타입 봉인 (42) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 42} onChange={() => switchCode(42)} />
          <span className="trait-radio-label">{t('traits.codes.42')}</span>
        </label>
        {formCode === 42 && (
          <div className="trait-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {skillTypes.map((name, i) => name ? <option key={i} value={i}>{name}</option> : null)}
            </select>
          </div>
        )}
      </div>
      {/* 스킬 추가 (43) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 43} onChange={() => switchCode(43)} />
          <span className="trait-radio-label">{t('traits.codes.43')}</span>
        </label>
        {formCode === 43 && (
          <div className="trait-fields">
            <button className="trait-picker-btn" onClick={() => setPickerTarget('skill43')}>
              {formDataId > 0 && getSkillIconIndex(formDataId) != null && getSkillIconIndex(formDataId)! > 0 && <IconSprite iconIndex={getSkillIconIndex(formDataId)!} />}
              <span>{getSkillLabel(formDataId)}</span>
            </button>
          </div>
        )}
      </div>
      {/* 스킬 봉인 (44) */}
      <div className="trait-item">
        <label className="trait-radio">
          <input type="radio" name="traitCode" checked={formCode === 44} onChange={() => switchCode(44)} />
          <span className="trait-radio-label">{t('traits.codes.44')}</span>
        </label>
        {formCode === 44 && (
          <div className="trait-fields">
            <button className="trait-picker-btn" onClick={() => setPickerTarget('skill44')}>
              {formDataId > 0 && getSkillIconIndex(formDataId) != null && getSkillIconIndex(formDataId)! > 0 && <IconSprite iconIndex={getSkillIconIndex(formDataId)!} />}
              <span>{getSkillLabel(formDataId)}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export { EquipTab, OtherTab } from './TraitsEditorTabsExtra';
