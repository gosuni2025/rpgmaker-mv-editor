import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Trait } from '../../types/rpgMakerMV';
import apiClient from '../../api/client';
<<<<<<< HEAD
import { DataListPicker, IconSprite } from '../EventEditor/dataListPicker';
=======
import { DataListPicker } from '../EventEditor/dataListPicker';
import { RateTab, ParamTab, AttackTab, SkillTab, EquipTab, OtherTab } from './TraitsEditorTabs';
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
import './TraitsEditor.css';

interface TraitsEditorProps {
  traits: Trait[];
  onChange: (traits: Trait[]) => void;
}

interface RefItem { id: number; name: string; iconIndex?: number }

type TraitTab = 'rate' | 'param' | 'attack' | 'skill' | 'equip' | 'other';

type PickerTarget = 'element11' | 'state12' | 'state13' | 'state14' | 'element31' | 'state32' | 'skill43' | 'skill44';

const PARAM_NAMES_KEYS = [
  'params.maxHP', 'params.maxMP', 'params.attack', 'params.defense',
  'params.mAttack', 'params.mDefense', 'params.agility', 'params.luck',
];

export default function TraitsEditor({ traits, onChange }: TraitsEditorProps) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [tab, setTab] = useState<TraitTab>('rate');

  const [formCode, setFormCode] = useState(11);
  const [formDataId, setFormDataId] = useState(0);
  const [formValue, setFormValue] = useState(1);

  const [elements, setElements] = useState<string[]>([]);
  const [states, setStates] = useState<(RefItem | null)[]>([]);
  const [skills, setSkills] = useState<(RefItem | null)[]>([]);
  const [skillTypes, setSkillTypes] = useState<string[]>([]);
  const [weaponTypes, setWeaponTypes] = useState<string[]>([]);
  const [armorTypes, setArmorTypes] = useState<string[]>([]);
  const [equipTypes, setEquipTypes] = useState<string[]>([]);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const PARAM_NAMES = useMemo(() => PARAM_NAMES_KEYS.map(k => t(k)), [t]);

  const XPARAM_NAMES = useMemo(() => Array.from({ length: 10 }, (_, i) => t(`traits.xparams.${i}`)), [t]);
  const SPARAM_NAMES = useMemo(() => Array.from({ length: 10 }, (_, i) => t(`traits.sparams.${i}`)), [t]);
  const SPECIAL_FLAGS = useMemo(() => Array.from({ length: 4 }, (_, i) => t(`traits.specialFlags.${i}`)), [t]);
  const COLLAPSE_EFFECTS = useMemo(() => Array.from({ length: 3 }, (_, i) => t(`traits.collapseEffects.${i}`)), [t]);
  const PARTY_ABILITIES = useMemo(() => Array.from({ length: 6 }, (_, i) => t(`traits.partyAbilities.${i}`)), [t]);

  useEffect(() => {
    apiClient.get<{ elements?: string[]; skillTypes?: string[]; weaponTypes?: string[]; armorTypes?: string[]; equipTypes?: string[] }>('/database/system').then(sys => {
      if (sys.elements) setElements(sys.elements);
      if (sys.skillTypes) setSkillTypes(sys.skillTypes);
      if (sys.weaponTypes) setWeaponTypes(sys.weaponTypes);
      if (sys.armorTypes) setArmorTypes(sys.armorTypes);
      if (sys.equipTypes) setEquipTypes(sys.equipTypes);
    }).catch(() => {});
    apiClient.get<(RefItem | null)[]>('/database/states').then(d => {
      setStates(d.map(s => s ? { id: s.id, name: s.name, iconIndex: s.iconIndex } : null));
    }).catch(() => {});
    apiClient.get<(RefItem | null)[]>('/database/skills').then(d => {
      setSkills(d.map(s => s ? { id: s.id, name: s.name, iconIndex: s.iconIndex } : null));
    }).catch(() => {});
  }, []);

  const getTabForCode = (code: number): TraitTab => {
    if ([11, 12, 13, 14].includes(code)) return 'rate';
    if ([21, 22, 23].includes(code)) return 'param';
    if ([31, 32, 33, 34].includes(code)) return 'attack';
    if ([41, 42, 43, 44].includes(code)) return 'skill';
    if ([51, 52, 53, 54, 55].includes(code)) return 'equip';
    return 'other';
  };

  const openAddDialog = () => {
    setEditIndex(null);
    setFormCode(11);
    setFormDataId(1);
    setFormValue(1);
    setTab('rate');
    setDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    const tr = traits[index];
    setEditIndex(index);
    setFormCode(tr.code);
    setFormDataId(tr.dataId);
    setFormValue(tr.value);
    setTab(getTabForCode(tr.code));
    setDialogOpen(true);
  };

  const handleOk = () => {
    const newTrait: Trait = { code: formCode, dataId: formDataId, value: formValue };
    if (editIndex !== null) {
      const newTraits = traits.map((t, i) => i === editIndex ? newTrait : t);
      onChange(newTraits);
    } else {
      onChange([...traits, newTrait]);
    }
    setDialogOpen(false);
  };

  const removeTrait = (index: number) => {
    onChange(traits.filter((_, i) => i !== index));
  };

  const switchCode = (code: number) => {
    setFormCode(code);
    setFormDataId(getDefaultDataId(code));
    setFormValue(getDefaultValue(code));
  };

  const getDefaultDataId = (code: number): number => {
    if ([11, 31].includes(code)) return 1; // element (skip empty 0)
    if ([12, 13, 14, 32].includes(code)) return 1; // state (skip null 0)
    if ([41, 42].includes(code)) return 1; // skill type
    if ([43, 44].includes(code)) return 1; // skill
    if ([51].includes(code)) return 1; // weapon type
    if ([52].includes(code)) return 1; // armor type
    if ([53, 54, 55].includes(code)) return 1; // equip type
    return 0;
<<<<<<< HEAD
  };

  const getDefaultValue = (code: number): number => {
    if ([11, 12, 13, 21, 22, 23, 32].includes(code)) return 1; // 100%
    if (code === 33) return 0;
    if (code === 34 || code === 61) return 0;
    return 0;
=======
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
  };

  const getDefaultValue = (code: number): number => {
    if ([11, 12, 13, 21, 22, 23, 32].includes(code)) return 1; // 100%
    if (code === 33) return 0;
    if (code === 34 || code === 61) return 0;
    return 0;
  };

  // --- Label helpers ---
  const getElementLabel = (id: number) => {
    if (id === 0) return t('common.none');
    return elements[id] ? `${String(id).padStart(2, '0')}: ${elements[id]}` : String(id);
  };

  const getStateLabel = (id: number) => {
    if (id === 0) return t('common.none');
    const st = states.find(s => s && s.id === id);
    return st ? `${String(id).padStart(4, '0')}: ${st.name}` : String(id);
  };

  const getSkillLabel = (id: number) => {
    if (id === 0) return t('common.none');
    const sk = skills.find(s => s && s.id === id);
    return sk ? `${String(id).padStart(4, '0')}: ${sk.name}` : String(id);
  };

  const getStateIconIndex = (id: number) => {
    const st = states.find(s => s && s.id === id);
    return st?.iconIndex;
  };

  const getSkillIconIndex = (id: number) => {
    const sk = skills.find(s => s && s.id === id);
    return sk?.iconIndex;
  };

  // Picker data
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

  // --- Description for list display ---
  const getTraitDescription = (tr: Trait): string => {
    const codeName = t(`traits.codes.${tr.code}`, `Code ${tr.code}`);
    switch (tr.code) {
      case 11: return `${codeName} ${getElementLabel(tr.dataId)} * ${Math.round(tr.value * 100)}%`;
      case 12: {
        const st = states.find(s => s && s.id === tr.dataId);
        return `${codeName} ${st ? st.name : tr.dataId} * ${Math.round(tr.value * 100)}%`;
      }
      case 13: {
        const st = states.find(s => s && s.id === tr.dataId);
        return `${codeName} ${st ? st.name : tr.dataId} * ${Math.round(tr.value * 100)}%`;
      }
      case 14: {
        const st = states.find(s => s && s.id === tr.dataId);
        return `${codeName} ${st ? st.name : tr.dataId}`;
      }
      case 21: return `${codeName} ${PARAM_NAMES[tr.dataId] || tr.dataId} * ${Math.round(tr.value * 100)}%`;
      case 22: return `${codeName} ${XPARAM_NAMES[tr.dataId] || tr.dataId} + ${Math.round(tr.value * 100)}%`;
      case 23: return `${codeName} ${SPARAM_NAMES[tr.dataId] || tr.dataId} * ${Math.round(tr.value * 100)}%`;
      case 31: return `${codeName} ${getElementLabel(tr.dataId)}`;
      case 32: {
        const st = states.find(s => s && s.id === tr.dataId);
        return `${codeName} ${st ? st.name : tr.dataId} + ${Math.round(tr.value * 100)}%`;
      }
      case 33: return `${codeName} ${tr.value}`;
      case 34: return `${codeName} +${tr.value}`;
      case 41: return `${codeName} ${skillTypes[tr.dataId] || tr.dataId}`;
      case 42: return `${codeName} ${skillTypes[tr.dataId] || tr.dataId}`;
      case 43: {
        const sk = skills.find(s => s && s.id === tr.dataId);
        return `${codeName} ${sk ? sk.name : tr.dataId}`;
      }
      case 44: {
        const sk = skills.find(s => s && s.id === tr.dataId);
        return `${codeName} ${sk ? sk.name : tr.dataId}`;
      }
      case 51: return `${codeName} ${weaponTypes[tr.dataId] || tr.dataId}`;
      case 52: return `${codeName} ${armorTypes[tr.dataId] || tr.dataId}`;
      case 53: return `${codeName} ${equipTypes[tr.dataId] || tr.dataId}`;
      case 54: return `${codeName} ${equipTypes[tr.dataId] || tr.dataId}`;
      case 55: return `${codeName} ${tr.dataId === 1 ? t('traits.slotTypes.1') : t('traits.slotTypes.0')}`;
      case 61: return `${codeName} +${Math.round(tr.value * 100)}%`;
      case 62: return `${codeName} ${SPECIAL_FLAGS[tr.dataId] || tr.dataId}`;
      case 63: return `${codeName} ${COLLAPSE_EFFECTS[tr.dataId] || tr.dataId}`;
      case 64: return `${codeName} ${PARTY_ABILITIES[tr.dataId] || tr.dataId}`;
      default: return `Code ${tr.code}`;
    }
  };

  const sharedTabProps = {
    formCode,
    formDataId,
    formValue,
    switchCode,
    setFormDataId,
    setFormValue,
  };

  const TABS: { key: TraitTab; label: string }[] = [
    { key: 'rate', label: t('traits.tabRate') },
    { key: 'param', label: t('traits.tabParam') },
    { key: 'attack', label: t('traits.tabAttack') },
    { key: 'skill', label: t('traits.tabSkill') },
    { key: 'equip', label: t('traits.tabEquip') },
    { key: 'other', label: t('traits.tabOther') },
  ];

  // --- Label helpers ---
  const getElementLabel = (id: number) => {
    if (id === 0) return t('common.none');
    return elements[id] ? `${String(id).padStart(2, '0')}: ${elements[id]}` : String(id);
  };

  const getStateLabel = (id: number) => {
    if (id === 0) return t('common.none');
    const st = states.find(s => s && s.id === id);
    return st ? `${String(id).padStart(4, '0')}: ${st.name}` : String(id);
  };

  const getSkillLabel = (id: number) => {
    if (id === 0) return t('common.none');
    const sk = skills.find(s => s && s.id === id);
    return sk ? `${String(id).padStart(4, '0')}: ${sk.name}` : String(id);
  };

  const getStateIconIndex = (id: number) => {
    const st = states.find(s => s && s.id === id);
    return st?.iconIndex;
  };

  const getSkillIconIndex = (id: number) => {
    const sk = skills.find(s => s && s.id === id);
    return sk?.iconIndex;
  };

  // Picker data
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

  // --- Description for list display ---
  const getTraitDescription = (tr: Trait): string => {
    const codeName = t(`traits.codes.${tr.code}`, `Code ${tr.code}`);
    switch (tr.code) {
      case 11: return `${codeName} ${getElementLabel(tr.dataId)} * ${Math.round(tr.value * 100)}%`;
      case 12: {
        const st = states.find(s => s && s.id === tr.dataId);
        return `${codeName} ${st ? st.name : tr.dataId} * ${Math.round(tr.value * 100)}%`;
      }
      case 13: {
        const st = states.find(s => s && s.id === tr.dataId);
        return `${codeName} ${st ? st.name : tr.dataId} * ${Math.round(tr.value * 100)}%`;
      }
      case 14: {
        const st = states.find(s => s && s.id === tr.dataId);
        return `${codeName} ${st ? st.name : tr.dataId}`;
      }
      case 21: return `${codeName} ${PARAM_NAMES[tr.dataId] || tr.dataId} * ${Math.round(tr.value * 100)}%`;
      case 22: return `${codeName} ${XPARAM_NAMES[tr.dataId] || tr.dataId} + ${Math.round(tr.value * 100)}%`;
      case 23: return `${codeName} ${SPARAM_NAMES[tr.dataId] || tr.dataId} * ${Math.round(tr.value * 100)}%`;
      case 31: return `${codeName} ${getElementLabel(tr.dataId)}`;
      case 32: {
        const st = states.find(s => s && s.id === tr.dataId);
        return `${codeName} ${st ? st.name : tr.dataId} + ${Math.round(tr.value * 100)}%`;
      }
      case 33: return `${codeName} ${tr.value}`;
      case 34: return `${codeName} +${tr.value}`;
      case 41: return `${codeName} ${skillTypes[tr.dataId] || tr.dataId}`;
      case 42: return `${codeName} ${skillTypes[tr.dataId] || tr.dataId}`;
      case 43: {
        const sk = skills.find(s => s && s.id === tr.dataId);
        return `${codeName} ${sk ? sk.name : tr.dataId}`;
      }
      case 44: {
        const sk = skills.find(s => s && s.id === tr.dataId);
        return `${codeName} ${sk ? sk.name : tr.dataId}`;
      }
      case 51: return `${codeName} ${weaponTypes[tr.dataId] || tr.dataId}`;
      case 52: return `${codeName} ${armorTypes[tr.dataId] || tr.dataId}`;
      case 53: return `${codeName} ${equipTypes[tr.dataId] || tr.dataId}`;
      case 54: return `${codeName} ${equipTypes[tr.dataId] || tr.dataId}`;
      case 55: return `${codeName} ${tr.dataId === 1 ? t('traits.slotTypes.1') : t('traits.slotTypes.0')}`;
      case 61: return `${codeName} +${Math.round(tr.value * 100)}%`;
      case 62: return `${codeName} ${SPECIAL_FLAGS[tr.dataId] || tr.dataId}`;
      case 63: return `${codeName} ${COLLAPSE_EFFECTS[tr.dataId] || tr.dataId}`;
      case 64: return `${codeName} ${PARTY_ABILITIES[tr.dataId] || tr.dataId}`;
      default: return `Code ${tr.code}`;
    }
  };

  // --- Tab renderers ---
  const renderRateTab = () => (
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

  const renderParamTab = () => (
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

  const renderAttackTab = () => (
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

  const renderSkillTab = () => (
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

  const renderEquipTab = () => (
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

  const renderOtherTab = () => (
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

  const TABS: { key: TraitTab; label: string }[] = [
    { key: 'rate', label: t('traits.tabRate') },
    { key: 'param', label: t('traits.tabParam') },
    { key: 'attack', label: t('traits.tabAttack') },
    { key: 'skill', label: t('traits.tabSkill') },
    { key: 'equip', label: t('traits.tabEquip') },
    { key: 'other', label: t('traits.tabOther') },
  ];

  return (
    <div className="traits-editor">
      <div className="traits-list">
        {traits.map((tr, i) => (
          <div key={i} className="traits-list-item" onDoubleClick={() => openEditDialog(i)}>
            <span className="traits-list-text">{getTraitDescription(tr)}</span>
            <button className="db-btn-small" onClick={() => removeTrait(i)}>x</button>
          </div>
        ))}
        {traits.length === 0 && <div className="traits-empty">{t('traits.noTraits')}</div>}
      </div>
      <div className="traits-buttons">
        <button className="db-btn-small" onClick={openAddDialog}>+</button>
      </div>

      {dialogOpen && (
        <div className="traits-dialog-overlay" onClick={() => setDialogOpen(false)}>
          <div className="traits-dialog" onClick={e => e.stopPropagation()}>
            <div className="traits-dialog-header">
              <span>{t('traits.title')}</span>
              <button className="db-dialog-close" onClick={() => setDialogOpen(false)}>&times;</button>
            </div>
            <div className="traits-dialog-tabs">
              {TABS.map(tb => (
                <button
                  key={tb.key}
                  className={`traits-dialog-tab${tab === tb.key ? ' active' : ''}`}
                  onClick={() => setTab(tb.key)}
                >
                  {tb.label}
                </button>
              ))}
            </div>
            <div className="traits-dialog-body">
<<<<<<< HEAD
              {tab === 'rate' && renderRateTab()}
              {tab === 'param' && renderParamTab()}
              {tab === 'attack' && renderAttackTab()}
              {tab === 'skill' && renderSkillTab()}
              {tab === 'equip' && renderEquipTab()}
              {tab === 'other' && renderOtherTab()}
=======
              {tab === 'rate' && (
                <RateTab
                  {...sharedTabProps}
                  elements={elements}
                  getStateLabel={getStateLabel}
                  getStateIconIndex={getStateIconIndex}
                  setPickerTarget={(target) => setPickerTarget(target)}
                />
              )}
              {tab === 'param' && (
                <ParamTab
                  {...sharedTabProps}
                  PARAM_NAMES={PARAM_NAMES}
                  XPARAM_NAMES={XPARAM_NAMES}
                  SPARAM_NAMES={SPARAM_NAMES}
                />
              )}
              {tab === 'attack' && (
                <AttackTab
                  {...sharedTabProps}
                  elements={elements}
                  getStateLabel={getStateLabel}
                  getStateIconIndex={getStateIconIndex}
                  setPickerTarget={(target) => setPickerTarget(target)}
                />
              )}
              {tab === 'skill' && (
                <SkillTab
                  {...sharedTabProps}
                  skillTypes={skillTypes}
                  getSkillLabel={getSkillLabel}
                  getSkillIconIndex={getSkillIconIndex}
                  setPickerTarget={(target) => setPickerTarget(target)}
                />
              )}
              {tab === 'equip' && (
                <EquipTab
                  {...sharedTabProps}
                  weaponTypes={weaponTypes}
                  armorTypes={armorTypes}
                  equipTypes={equipTypes}
                />
              )}
              {tab === 'other' && (
                <OtherTab
                  {...sharedTabProps}
                  SPECIAL_FLAGS={SPECIAL_FLAGS}
                  COLLAPSE_EFFECTS={COLLAPSE_EFFECTS}
                  PARTY_ABILITIES={PARTY_ABILITIES}
                />
              )}
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
            </div>
            <div className="traits-dialog-footer">
              <button className="db-btn" onClick={handleOk}>{t('common.ok')}</button>
              <button className="db-btn" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {pickerTarget && ['state12', 'state13', 'state14', 'state32'].includes(pickerTarget) && (
        <DataListPicker
          items={stateNames}
          value={formDataId}
          onChange={(id) => setFormDataId(id)}
          onClose={() => setPickerTarget(null)}
          title={t(`traits.codes.${pickerTarget === 'state12' ? '12' : pickerTarget === 'state13' ? '13' : pickerTarget === 'state14' ? '14' : '32'}`) + ' 선택'}
          iconIndices={stateIcons}
        />
      )}

      {pickerTarget && ['skill43', 'skill44'].includes(pickerTarget) && (
        <DataListPicker
          items={skillNames}
          value={formDataId}
          onChange={(id) => setFormDataId(id)}
          onClose={() => setPickerTarget(null)}
          title={t(`traits.codes.${pickerTarget === 'skill43' ? '43' : '44'}`) + ' 선택'}
          iconIndices={skillIcons}
        />
      )}
    </div>
  );
}
