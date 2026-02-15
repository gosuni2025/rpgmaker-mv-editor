import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Effect } from '../../types/rpgMakerMV';
import apiClient from '../../api/client';
import './EffectsEditor.css';

interface EffectsEditorProps {
  effects: Effect[];
  onChange: (effects: Effect[]) => void;
}

interface RefItem { id: number; name: string }

type EffectTab = 'recovery' | 'state' | 'param' | 'other';

const PARAM_NAMES_KEYS = [
  'params.maxHP', 'params.maxMP', 'params.attack', 'params.defense',
  'params.mAttack', 'params.mDefense', 'params.agility', 'params.luck',
];

export default function EffectsEditor({ effects, onChange }: EffectsEditorProps) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [tab, setTab] = useState<EffectTab>('recovery');

  // Dialog form state
  const [formCode, setFormCode] = useState(11);
  const [formDataId, setFormDataId] = useState(0);
  const [formValue1, setFormValue1] = useState(0);
  const [formValue2, setFormValue2] = useState(0);

  // Reference data
  const [states, setStates] = useState<(RefItem | null)[]>([]);
  const [skills, setSkills] = useState<(RefItem | null)[]>([]);
  const [commonEvents, setCommonEvents] = useState<(RefItem | null)[]>([]);

  const PARAM_NAMES = useMemo(() => PARAM_NAMES_KEYS.map(k => t(k)), [t]);

  useEffect(() => {
    apiClient.get<(RefItem | null)[]>('/database/states').then(d => setStates(d)).catch(() => {});
    apiClient.get<(RefItem | null)[]>('/database/skills').then(d => setSkills(d)).catch(() => {});
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
        return `${codeName} ${st ? st.name : eff.dataId} ${Math.round(eff.value1 * 100)}%`;
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

  // Tab content renderers
  const renderRecoveryTab = () => (
    <div className="effects-dialog-tab-content">
      <div className="effects-dialog-category">
        <div className="effects-dialog-category-title">{t('effects.codes.11')}</div>
        <label className="effects-dialog-radio">
          <input type="radio" name="effectCode" checked={formCode === 11} onChange={() => switchCode(11)} />
          {t('effects.codes.11')}
        </label>
        {formCode === 11 && (
          <div className="effects-dialog-fields">
            <label>
              <span>%</span>
              <input type="number" value={Math.round(formValue1 * 100)} onChange={e => setFormValue1(Number(e.target.value) / 100)} />
            </label>
            <label>
              <span>+</span>
              <input type="number" value={formValue2} onChange={e => setFormValue2(Number(e.target.value))} />
            </label>
          </div>
        )}
      </div>
      <div className="effects-dialog-category">
        <div className="effects-dialog-category-title">{t('effects.codes.12')}</div>
        <label className="effects-dialog-radio">
          <input type="radio" name="effectCode" checked={formCode === 12} onChange={() => switchCode(12)} />
          {t('effects.codes.12')}
        </label>
        {formCode === 12 && (
          <div className="effects-dialog-fields">
            <label>
              <span>%</span>
              <input type="number" value={Math.round(formValue1 * 100)} onChange={e => setFormValue1(Number(e.target.value) / 100)} />
            </label>
            <label>
              <span>+</span>
              <input type="number" value={formValue2} onChange={e => setFormValue2(Number(e.target.value))} />
            </label>
          </div>
        )}
      </div>
      <div className="effects-dialog-category">
        <div className="effects-dialog-category-title">{t('effects.codes.13')}</div>
        <label className="effects-dialog-radio">
          <input type="radio" name="effectCode" checked={formCode === 13} onChange={() => switchCode(13)} />
          {t('effects.codes.13')}
        </label>
        {formCode === 13 && (
          <div className="effects-dialog-fields">
            <label>
              <span>{t('effects.value')}</span>
              <input type="number" value={formValue1} onChange={e => setFormValue1(Number(e.target.value))} />
            </label>
          </div>
        )}
      </div>
    </div>
  );

  const renderStateTab = () => (
    <div className="effects-dialog-tab-content">
      <div className="effects-dialog-category">
        <label className="effects-dialog-radio">
          <input type="radio" name="effectCode" checked={formCode === 21} onChange={() => switchCode(21)} />
          {t('effects.codes.21')}
        </label>
        {formCode === 21 && (
          <div className="effects-dialog-fields">
            <label>
              <span>{t('effects.state')}</span>
              <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
                <option value={0}>{t('common.normalAttack')}</option>
                {states.filter(Boolean).map(s => (
                  <option key={s!.id} value={s!.id}>{String(s!.id).padStart(4, '0')}: {s!.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>%</span>
              <input type="number" value={Math.round(formValue1 * 100)} onChange={e => setFormValue1(Number(e.target.value) / 100)} min={0} max={100} />
            </label>
          </div>
        )}
      </div>
      <div className="effects-dialog-category">
        <label className="effects-dialog-radio">
          <input type="radio" name="effectCode" checked={formCode === 22} onChange={() => switchCode(22)} />
          {t('effects.codes.22')}
        </label>
        {formCode === 22 && (
          <div className="effects-dialog-fields">
            <label>
              <span>{t('effects.state')}</span>
              <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
                {states.filter(Boolean).map(s => (
                  <option key={s!.id} value={s!.id}>{String(s!.id).padStart(4, '0')}: {s!.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>%</span>
              <input type="number" value={Math.round(formValue1 * 100)} onChange={e => setFormValue1(Number(e.target.value) / 100)} min={0} max={100} />
            </label>
          </div>
        )}
      </div>
    </div>
  );

  const renderParamTab = () => (
    <div className="effects-dialog-tab-content">
      <div className="effects-dialog-category">
        <label className="effects-dialog-radio">
          <input type="radio" name="effectCode" checked={formCode === 31} onChange={() => switchCode(31)} />
          {t('effects.codes.31')}
        </label>
        {formCode === 31 && (
          <div className="effects-dialog-fields">
            <label>
              <span>{t('effects.param')}</span>
              <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
                {PARAM_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </label>
            <label>
              <span>{t('effects.turns')}</span>
              <input type="number" value={formValue1} onChange={e => setFormValue1(Number(e.target.value))} min={1} />
            </label>
          </div>
        )}
      </div>
      <div className="effects-dialog-category">
        <label className="effects-dialog-radio">
          <input type="radio" name="effectCode" checked={formCode === 32} onChange={() => switchCode(32)} />
          {t('effects.codes.32')}
        </label>
        {formCode === 32 && (
          <div className="effects-dialog-fields">
            <label>
              <span>{t('effects.param')}</span>
              <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
                {PARAM_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </label>
            <label>
              <span>{t('effects.turns')}</span>
              <input type="number" value={formValue1} onChange={e => setFormValue1(Number(e.target.value))} min={1} />
            </label>
          </div>
        )}
      </div>
      <div className="effects-dialog-category">
        <label className="effects-dialog-radio">
          <input type="radio" name="effectCode" checked={formCode === 33} onChange={() => switchCode(33)} />
          {t('effects.codes.33')}
        </label>
        {formCode === 33 && (
          <div className="effects-dialog-fields">
            <label>
              <span>{t('effects.param')}</span>
              <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
                {PARAM_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>
      <div className="effects-dialog-category">
        <label className="effects-dialog-radio">
          <input type="radio" name="effectCode" checked={formCode === 34} onChange={() => switchCode(34)} />
          {t('effects.codes.34')}
        </label>
        {formCode === 34 && (
          <div className="effects-dialog-fields">
            <label>
              <span>{t('effects.param')}</span>
              <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
                {PARAM_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>
    </div>
  );

  const renderOtherTab = () => (
    <div className="effects-dialog-tab-content">
      <div className="effects-dialog-category">
        <label className="effects-dialog-radio">
          <input type="radio" name="effectCode" checked={formCode === 41} onChange={() => switchCode(41)} />
          {t('effects.codes.41')}
        </label>
        {formCode === 41 && (
          <div className="effects-dialog-fields">
            <label>
              <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
                <option value={0}>{t('effects.specialEffects.0')}</option>
              </select>
            </label>
          </div>
        )}
      </div>
      <div className="effects-dialog-category">
        <label className="effects-dialog-radio">
          <input type="radio" name="effectCode" checked={formCode === 42} onChange={() => switchCode(42)} />
          {t('effects.codes.42')}
        </label>
        {formCode === 42 && (
          <div className="effects-dialog-fields">
            <label>
              <span>{t('effects.param')}</span>
              <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
                {PARAM_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </label>
            <label>
              <span>{t('effects.value')}</span>
              <input type="number" value={formValue1} onChange={e => setFormValue1(Number(e.target.value))} />
            </label>
          </div>
        )}
      </div>
      <div className="effects-dialog-category">
        <label className="effects-dialog-radio">
          <input type="radio" name="effectCode" checked={formCode === 43} onChange={() => switchCode(43)} />
          {t('effects.codes.43')}
        </label>
        {formCode === 43 && (
          <div className="effects-dialog-fields">
            <label>
              <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
                <option value={0}>{t('common.none')}</option>
                {skills.filter(Boolean).map(s => (
                  <option key={s!.id} value={s!.id}>{String(s!.id).padStart(4, '0')}: {s!.name}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>
      <div className="effects-dialog-category">
        <label className="effects-dialog-radio">
          <input type="radio" name="effectCode" checked={formCode === 44} onChange={() => switchCode(44)} />
          {t('effects.codes.44')}
        </label>
        {formCode === 44 && (
          <div className="effects-dialog-fields">
            <label>
              <select value={formDataId} onChange={e => setFormDataId(Number(e.target.value))}>
                <option value={0}>{t('common.none')}</option>
                {commonEvents.filter(Boolean).map(ce => (
                  <option key={ce!.id} value={ce!.id}>{String(ce!.id).padStart(4, '0')}: {ce!.name}</option>
                ))}
              </select>
            </label>
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
              {TABS.map(t => (
                <button
                  key={t.key}
                  className={`effects-dialog-tab${tab === t.key ? ' active' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
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
    </div>
  );
}
