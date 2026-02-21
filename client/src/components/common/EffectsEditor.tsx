import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Effect } from '../../types/rpgMakerMV';
import apiClient from '../../api/client';
import { DataListPicker } from '../EventEditor/dataListPicker';
import { RecoveryTab, StateTab, ParamTab, OtherTab } from './EffectsEditorTabs';
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

  const tabSharedProps = {
    formCode, formDataId, formValue1, formValue2,
    switchCode, setFormDataId, setFormValue1, setFormValue2,
  };

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
              {tab === 'recovery' && <RecoveryTab {...tabSharedProps} />}
              {tab === 'state' && <StateTab {...tabSharedProps} getStateLabel={getStateLabel} getStateIconIndex={getStateIconIndex} setPickerTarget={setPickerTarget} />}
              {tab === 'param' && <ParamTab {...tabSharedProps} PARAM_NAMES={PARAM_NAMES} />}
              {tab === 'other' && <OtherTab {...tabSharedProps} PARAM_NAMES={PARAM_NAMES} getSkillLabel={getSkillLabel} getSkillIconIndex={getSkillIconIndex} getCELabel={getCELabel} setPickerTarget={setPickerTarget} />}
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
