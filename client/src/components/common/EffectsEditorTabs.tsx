import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconSprite } from '../EventEditor/dataListPicker';

export interface EffectsTabSharedProps {
  formCode: number;
  formDataId: number;
  formValue1: number;
  formValue2: number;
  switchCode: (code: number) => void;
  setFormDataId: (id: number) => void;
  setFormValue1: (val: number) => void;
  setFormValue2: (val: number) => void;
}

// --- Recovery Tab (회복) ---

export function RecoveryTab({
  formCode, formValue1, formValue2,
  switchCode, setFormValue1, setFormValue2,
}: EffectsTabSharedProps) {
  const { t } = useTranslation();
  return (
    <div className="eff-tab-content">
      <div className="eff-item">
        <label className="eff-radio">
          <input type="radio" name="effectCode" checked={formCode === 11} onChange={() => switchCode(11)} />
          <span className="eff-radio-label">{t('effects.codes.11')}</span>
        </label>
        {formCode === 11 && (
          <div className="eff-fields">
            <div className="eff-field-group">
              <input type="number" value={Math.round(formValue1 * 100)} onChange={e => setFormValue1(Number(e.target.value) / 100)} min={-100} max={100} />
              <span className="eff-unit">%</span>
            </div>
            <span className="eff-separator">+</span>
            <div className="eff-field-group">
              <input type="number" value={formValue2} onChange={e => setFormValue2(Number(e.target.value))} />
            </div>
          </div>
        )}
      </div>
      <div className="eff-item">
        <label className="eff-radio">
          <input type="radio" name="effectCode" checked={formCode === 12} onChange={() => switchCode(12)} />
          <span className="eff-radio-label">{t('effects.codes.12')}</span>
        </label>
        {formCode === 12 && (
          <div className="eff-fields">
            <div className="eff-field-group">
              <input type="number" value={Math.round(formValue1 * 100)} onChange={e => setFormValue1(Number(e.target.value) / 100)} min={-100} max={100} />
              <span className="eff-unit">%</span>
            </div>
            <span className="eff-separator">+</span>
            <div className="eff-field-group">
              <input type="number" value={formValue2} onChange={e => setFormValue2(Number(e.target.value))} />
            </div>
          </div>
        )}
      </div>
      <div className="eff-item">
        <label className="eff-radio">
          <input type="radio" name="effectCode" checked={formCode === 13} onChange={() => switchCode(13)} />
          <span className="eff-radio-label">{t('effects.codes.13')}</span>
        </label>
        {formCode === 13 && (
          <div className="eff-fields">
            <div className="eff-field-group">
              <input type="number" value={formValue1} onChange={e => setFormValue1(Number(e.target.value))} min={0} max={100} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- State Tab (스테이트) ---

interface StateTabProps extends EffectsTabSharedProps {
  getStateLabel: (id: number) => string;
  getStateIconIndex: (id: number) => number | undefined;
  setPickerTarget: (target: 'state21' | 'state22') => void;
}

export function StateTab({
  formCode, formDataId, formValue1,
  switchCode, setFormValue1,
  getStateLabel, getStateIconIndex, setPickerTarget,
}: StateTabProps) {
  const { t } = useTranslation();
  return (
    <div className="eff-tab-content">
      <div className="eff-item">
        <label className="eff-radio">
          <input type="radio" name="effectCode" checked={formCode === 21} onChange={() => switchCode(21)} />
          <span className="eff-radio-label">{t('effects.codes.21')}</span>
        </label>
        {formCode === 21 && (
          <div className="eff-fields">
            <button className="eff-picker-btn" onClick={() => setPickerTarget('state21')}>
              {formDataId > 0 && getStateIconIndex(formDataId) != null && getStateIconIndex(formDataId)! > 0 && <IconSprite iconIndex={getStateIconIndex(formDataId)!} />}
              <span>{getStateLabel(formDataId)}</span>
            </button>
            <div className="eff-field-group">
              <input type="number" value={Math.round(formValue1 * 100)} onChange={e => setFormValue1(Number(e.target.value) / 100)} min={0} max={1000} />
              <span className="eff-unit">%</span>
            </div>
          </div>
        )}
      </div>
      <div className="eff-item">
        <label className="eff-radio">
          <input type="radio" name="effectCode" checked={formCode === 22} onChange={() => switchCode(22)} />
          <span className="eff-radio-label">{t('effects.codes.22')}</span>
        </label>
        {formCode === 22 && (
          <div className="eff-fields">
            <button className="eff-picker-btn" onClick={() => setPickerTarget('state22')}>
              {formDataId > 0 && getStateIconIndex(formDataId) != null && getStateIconIndex(formDataId)! > 0 && <IconSprite iconIndex={getStateIconIndex(formDataId)!} />}
              <span>{getStateLabel(formDataId)}</span>
            </button>
            <div className="eff-field-group">
              <input type="number" value={Math.round(formValue1 * 100)} onChange={e => setFormValue1(Number(e.target.value) / 100)} min={0} max={100} />
              <span className="eff-unit">%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Param Tab (능력치) ---

interface ParamTabProps extends EffectsTabSharedProps {
  PARAM_NAMES: string[];
}

export function ParamTab({
  formCode, formDataId, formValue1,
  switchCode, setFormDataId, setFormValue1,
  PARAM_NAMES,
}: ParamTabProps) {
  const { t } = useTranslation();
  return (
    <div className="eff-tab-content">
      <div className="eff-item">
        <label className="eff-radio">
          <input type="radio" name="effectCode" checked={formCode === 31} onChange={() => switchCode(31)} />
          <span className="eff-radio-label">{t('effects.codes.31')}</span>
        </label>
        {formCode === 31 && (
          <div className="eff-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {PARAM_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
            <div className="eff-field-group">
              <input type="number" value={formValue1} onChange={e => setFormValue1(Number(e.target.value))} min={1} max={1000} />
              <span className="eff-unit">{t('effects.turns')}</span>
            </div>
          </div>
        )}
      </div>
      <div className="eff-item">
        <label className="eff-radio">
          <input type="radio" name="effectCode" checked={formCode === 32} onChange={() => switchCode(32)} />
          <span className="eff-radio-label">{t('effects.codes.32')}</span>
        </label>
        {formCode === 32 && (
          <div className="eff-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {PARAM_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
            <div className="eff-field-group">
              <input type="number" value={formValue1} onChange={e => setFormValue1(Number(e.target.value))} min={1} max={1000} />
              <span className="eff-unit">{t('effects.turns')}</span>
            </div>
          </div>
        )}
      </div>
      <div className="eff-item">
        <label className="eff-radio">
          <input type="radio" name="effectCode" checked={formCode === 33} onChange={() => switchCode(33)} />
          <span className="eff-radio-label">{t('effects.codes.33')}</span>
        </label>
        {formCode === 33 && (
          <div className="eff-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {PARAM_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="eff-item">
        <label className="eff-radio">
          <input type="radio" name="effectCode" checked={formCode === 34} onChange={() => switchCode(34)} />
          <span className="eff-radio-label">{t('effects.codes.34')}</span>
        </label>
        {formCode === 34 && (
          <div className="eff-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {PARAM_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Other Tab (기타) ---

interface OtherTabProps extends EffectsTabSharedProps {
  PARAM_NAMES: string[];
  getSkillLabel: (id: number) => string;
  getSkillIconIndex: (id: number) => number | undefined;
  getCELabel: (id: number) => string;
  setPickerTarget: (target: 'skill' | 'commonEvent') => void;
}

export function OtherTab({
  formCode, formDataId, formValue1,
  switchCode, setFormDataId, setFormValue1,
  PARAM_NAMES, getSkillLabel, getSkillIconIndex, getCELabel, setPickerTarget,
}: OtherTabProps) {
  const { t } = useTranslation();
  return (
    <div className="eff-tab-content">
      <div className="eff-item">
        <label className="eff-radio">
          <input type="radio" name="effectCode" checked={formCode === 41} onChange={() => switchCode(41)} />
          <span className="eff-radio-label">{t('effects.codes.41')}</span>
        </label>
        {formCode === 41 && (
          <div className="eff-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              <option value={0}>{t('effects.specialEffects.0')}</option>
            </select>
          </div>
        )}
      </div>
      <div className="eff-item">
        <label className="eff-radio">
          <input type="radio" name="effectCode" checked={formCode === 42} onChange={() => switchCode(42)} />
          <span className="eff-radio-label">{t('effects.codes.42')}</span>
        </label>
        {formCode === 42 && (
          <div className="eff-fields">
            <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
              {PARAM_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
            <div className="eff-field-group">
              <input type="number" value={formValue1} onChange={e => setFormValue1(Number(e.target.value))} min={1} max={1000} />
            </div>
          </div>
        )}
      </div>
      <div className="eff-item">
        <label className="eff-radio">
          <input type="radio" name="effectCode" checked={formCode === 43} onChange={() => switchCode(43)} />
          <span className="eff-radio-label">{t('effects.codes.43')}</span>
        </label>
        {formCode === 43 && (
          <div className="eff-fields">
            <button className="eff-picker-btn" onClick={() => setPickerTarget('skill')}>
              {formDataId > 0 && getSkillIconIndex(formDataId) != null && getSkillIconIndex(formDataId)! > 0 && <IconSprite iconIndex={getSkillIconIndex(formDataId)!} />}
              <span>{getSkillLabel(formDataId)}</span>
            </button>
          </div>
        )}
      </div>
      <div className="eff-item">
        <label className="eff-radio">
          <input type="radio" name="effectCode" checked={formCode === 44} onChange={() => switchCode(44)} />
          <span className="eff-radio-label">{t('effects.codes.44')}</span>
        </label>
        {formCode === 44 && (
          <div className="eff-fields">
            <button className="eff-picker-btn" onClick={() => setPickerTarget('commonEvent')}>
              <span>{getCELabel(formDataId)}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
