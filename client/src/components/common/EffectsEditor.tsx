import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Effect } from '../../types/rpgMakerMV';
import apiClient from '../../api/client';
import { DataListPicker, IconSprite } from '../EventEditor/dataListPicker';
import './EffectsEditor.css';

interface EffectsEditorProps {
  effects: Effect[];
  onChange: (effects: Effect[]) => void;
}

interface RefItem { id: number; name: string; iconIndex?: number }

type EffectTab = 'recovery' | 'state' | 'param' | 'other';

type PickerTarget = 'state21' | 'state22' | 'skill' | 'commonEvent';

const PARAM_NAMES_KEYS = [
  'params.maxHP', 'params.maxMP', 'params.attack', 'params.defense',
  'params.mAttack', 'params.mDefense', 'params.agility', 'params.luck',
];

export default function EffectsEditor({ effects, onChange }: EffectsEditorProps) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [tab, setTab] = useState<EffectTab>('recovery');

  const [formCode, setFormCode] = useState(11);
  const [formDataId, setFormDataId] = useState(0);
  const [formValue1, setFormValue1] = useState(0);
  const [formValue2, setFormValue2] = useState(0);

  const [states, setStates] = useState<(RefItem | null)[]>([]);
  const [skills, setSkills] = useState<(RefItem | null)[]>([]);
  const [commonEvents, setCommonEvents] = useState<(RefItem | null)[]>([]);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const PARAM_NAMES = useMemo(() => PARAM_NAMES_KEYS.map(k => t(k)), [t]);

  useEffect(() => {
    apiClient.get<({ id: number; name: string; iconIndex?: number } | null)[]>('/database/states').then(d => {
      setStates(d.map(s => s ? { id: s.id, name: s.name, iconIndex: s.iconIndex } : null));
    }).catch(() => {});
    apiClient.get<({ id: number; name: string; iconIndex?: number } | null)[]>('/database/skills').then(d => {
      setSkills(d.map(s => s ? { id: s.id, name: s.name, iconIndex: s.iconIndex } : null));
    }).catch(() => {});
    apiClient.get<(RefItem | null)[]>('/database/commonevents').then(d => setCommonEvents(d)).catch(() => {});
  }, []);

  const getTabForCode = (code: number): EffectTab => {
    if ([11, 12, 13].includes(code)) return 'recovery';
    if ([21, 22].includes(code)) return 'state';
    if ([31, 32, 33, 34].includes(code)) return 'param';
    return 'other';
  };

  const openAddDialog = () => {
    setEditIndex(null);
    setFormCode(11);
    setFormDataId(0);
    setFormValue1(0);
    setFormValue2(0);
    setTab('recovery');
    setDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    const eff = effects[index];
    setEditIndex(index);
    setFormCode(eff.code);
    setFormDataId(eff.dataId);
    setFormValue1(eff.value1);
    setFormValue2(eff.value2);
    setTab(getTabForCode(eff.code));
    setDialogOpen(true);
  };

  const handleOk = () => {
    const newEffect: Effect = { code: formCode, dataId: formDataId, value1: formValue1, value2: formValue2 };
    if (editIndex !== null) {
      const newEffects = effects.map((e, i) => i === editIndex ? newEffect : e);
      onChange(newEffects);
    } else {
      onChange([...effects, newEffect]);
    }
    setDialogOpen(false);
  };

  const removeEffect = (index: number) => {
    onChange(effects.filter((_, i) => i !== index));
  };

  const switchCode = (code: number) => {
    setFormCode(code);
    setFormDataId(0);
    setFormValue1(0);
    setFormValue2(0);
  };

  const getEffectDescription = (eff: Effect): string => {
    const codeName = t(`effects.codes.${eff.code}`, `Code ${eff.code}`);
    switch (eff.code) {
      case 11: return `${codeName} ${Math.round(eff.value1 * 100)}% + ${eff.value2}`;
      case 12: return `${codeName} ${Math.round(eff.value1 * 100)}% + ${eff.value2}`;
      case 13: return `${codeName} ${eff.value1}`;
      case 21: {
        const st = states.find(s => s && s.id === eff.dataId);
        return `${codeName} ${eff.dataId === 0 ? t('common.normalAttack') : (st ? st.name : eff.dataId)} ${Math.round(eff.value1 * 100)}%`;
      }
      case 22: {
        const st = states.find(s => s && s.id === eff.dataId);
        return `${codeName} ${st ? st.name : eff.dataId} ${Math.round(eff.value1 * 100)}%`;
      }
      case 31: return `${codeName} ${PARAM_NAMES[eff.dataId] || eff.dataId} ${eff.value1}${t('effects.turns')}`;
      case 32: return `${codeName} ${PARAM_NAMES[eff.dataId] || eff.dataId} ${eff.value1}${t('effects.turns')}`;
      case 33: return `${codeName} ${PARAM_NAMES[eff.dataId] || eff.dataId}`;
      case 34: return `${codeName} ${PARAM_NAMES[eff.dataId] || eff.dataId}`;
      case 41: return `${codeName}: ${t(`effects.specialEffects.${eff.dataId}`, String(eff.dataId))}`;
      case 42: return `${codeName} ${PARAM_NAMES[eff.dataId] || eff.dataId} +${eff.value1}`;
      case 43: {
        const sk = skills.find(s => s && s.id === eff.dataId);
        return `${codeName} ${sk ? sk.name : eff.dataId}`;
      }
      case 44: {
        const ce = commonEvents.find(c => c && c.id === eff.dataId);
        return `${codeName} ${ce ? ce.name : eff.dataId}`;
      }
      default: return `Code ${eff.code}`;
    }
  };

  const renderRecoveryTab = () => (
    <div className="eff-tab-content">
      {/* HP 회복 */}
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
      {/* MP 회복 */}
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
      {/* TP 획득 */}
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

  const getStateLabel = (id: number) => {
    if (id === 0) return t('common.normalAttack');
    const st = states.find(s => s && s.id === id);
    return st ? `${String(id).padStart(4, '0')}: ${st.name}` : String(id);
  };

  const getSkillLabel = (id: number) => {
    if (id === 0) return t('common.none');
    const sk = skills.find(s => s && s.id === id);
    return sk ? `${String(id).padStart(4, '0')}: ${sk.name}` : String(id);
  };

  const getCELabel = (id: number) => {
    if (id === 0) return t('common.none');
    const ce = commonEvents.find(c => c && c.id === id);
    return ce ? `${String(id).padStart(4, '0')}: ${ce.name}` : String(id);
  };

  const getStateIconIndex = (id: number) => {
    const st = states.find(s => s && s.id === id);
    return st?.iconIndex;
  };

  const getSkillIconIndex = (id: number) => {
    const sk = skills.find(s => s && s.id === id);
    return sk?.iconIndex;
  };

  const stateNames = useMemo(() => {
    const arr: string[] = [];
    for (const s of states) { if (s) arr[s.id] = s.name; }
    return arr;
  }, [states]);

  const stateIcons = useMemo(() => {
    const arr: (number | undefined)[] = [];
    for (const s of states) { if (s) arr[s.id] = s.iconIndex; }
    return arr;
  }, [states]);

  const skillNames = useMemo(() => {
    const arr: string[] = [];
    for (const s of skills) { if (s) arr[s.id] = s.name; }
    return arr;
  }, [skills]);

  const skillIcons = useMemo(() => {
    const arr: (number | undefined)[] = [];
    for (const s of skills) { if (s) arr[s.id] = s.iconIndex; }
    return arr;
  }, [skills]);

  const ceNames = useMemo(() => {
    const arr: string[] = [];
    for (const c of commonEvents) { if (c) arr[c.id] = c.name; }
    return arr;
  }, [commonEvents]);

  const renderStateTab = () => (
    <div className="eff-tab-content">
      {/* 스테이트 부여 */}
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
      {/* 스테이트 해제 */}
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

  const renderParamTab = () => (
    <div className="eff-tab-content">
      {/* 버프 부여 */}
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
      {/* 디버프 부여 */}
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
      {/* 버프 해제 */}
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
      {/* 디버프 해제 */}
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

  const renderOtherTab = () => (
    <div className="eff-tab-content">
      {/* 특수 효과 */}
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
      {/* 성장 */}
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
      {/* 스킬 습득 */}
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
      {/* 커먼 이벤트 */}
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

  const TABS: { key: EffectTab; label: string }[] = [
    { key: 'recovery', label: t('effects.tabRecovery') },
    { key: 'state', label: t('effects.tabState') },
    { key: 'param', label: t('effects.tabParam') },
    { key: 'other', label: t('effects.tabOther') },
  ];

  return (
    <div className="effects-editor">
      <div className="effects-list">
        {effects.map((eff, i) => (
          <div key={i} className="effects-list-item" onDoubleClick={() => openEditDialog(i)}>
            <span className="effects-list-text">{getEffectDescription(eff)}</span>
            <button className="db-btn-small" onClick={() => removeEffect(i)}>x</button>
          </div>
        ))}
        {effects.length === 0 && <div className="effects-empty">{t('effects.noEffects')}</div>}
      </div>
      <div className="effects-buttons">
        <button className="db-btn-small" onClick={openAddDialog}>+</button>
      </div>

      {dialogOpen && (
        <div className="effects-dialog-overlay" onClick={() => setDialogOpen(false)}>
          <div className="effects-dialog" onClick={e => e.stopPropagation()}>
            <div className="effects-dialog-header">
              <span>{t('effects.title')}</span>
              <button className="db-dialog-close" onClick={() => setDialogOpen(false)}>&times;</button>
            </div>
            <div className="effects-dialog-tabs">
              {TABS.map(tb => (
                <button
                  key={tb.key}
                  className={`effects-dialog-tab${tab === tb.key ? ' active' : ''}`}
                  onClick={() => setTab(tb.key)}
                >
                  {tb.label}
                </button>
              ))}
            </div>
            <div className="effects-dialog-body">
              {tab === 'recovery' && renderRecoveryTab()}
              {tab === 'state' && renderStateTab()}
              {tab === 'param' && renderParamTab()}
              {tab === 'other' && renderOtherTab()}
            </div>
            <div className="effects-dialog-footer">
              <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
              <button className="db-btn" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {pickerTarget && (pickerTarget === 'state21' || pickerTarget === 'state22') && (
        <DataListPicker
          items={stateNames}
          value={formDataId}
          onChange={(id) => setFormDataId(id)}
          onClose={() => setPickerTarget(null)}
          title={t('effects.codes.' + (pickerTarget === 'state21' ? '21' : '22')) + ' 선택'}
          iconIndices={stateIcons}
        />
      )}

      {pickerTarget === 'skill' && (
        <DataListPicker
          items={skillNames}
          value={formDataId}
          onChange={(id) => setFormDataId(id)}
          onClose={() => setPickerTarget(null)}
          title={t('effects.codes.43') + ' 선택'}
          iconIndices={skillIcons}
        />
      )}

      {pickerTarget === 'commonEvent' && (
        <DataListPicker
          items={ceNames}
          value={formDataId}
          onChange={(id) => setFormDataId(id)}
          onClose={() => setPickerTarget(null)}
          title={t('effects.codes.44') + ' 선택'}
        />
      )}
    </div>
  );
}
