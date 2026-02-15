import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Skill, Damage, Effect } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import DamageEditor from '../common/DamageEditor';
import TranslateButton from '../common/TranslateButton';
import EffectsEditor from '../common/EffectsEditor';
import apiClient from '../../api/client';

interface SkillsTabProps {
  data: (Skill | null)[] | undefined;
  onChange: (data: (Skill | null)[]) => void;
}

interface RefItem { id: number; name: string }

const DEFAULT_DAMAGE: Damage = { critical: false, elementId: 0, formula: '', type: 0, variance: 0 };

export default function SkillsTab({ data, onChange }: SkillsTabProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);
  const [skillTypes, setSkillTypes] = useState<string[]>([]);
  const [weaponTypes, setWeaponTypes] = useState<string[]>([]);
  const [animations, setAnimations] = useState<RefItem[]>([]);

  const SCOPE_OPTIONS = [
    { value: 0, label: t('scope.none') },
    { value: 1, label: t('scope.oneEnemy') },
    { value: 2, label: t('scope.allEnemies') },
    { value: 3, label: t('scope.randomEnemy1') },
    { value: 4, label: t('scope.randomEnemy2') },
    { value: 5, label: t('scope.randomEnemy3') },
    { value: 6, label: t('scope.randomEnemy4') },
    { value: 7, label: t('scope.oneAlly') },
    { value: 8, label: t('scope.allAllies') },
    { value: 9, label: t('scope.oneAllyDead') },
    { value: 10, label: t('scope.allAlliesDead') },
    { value: 11, label: t('scope.theUser') },
  ];

  const OCCASION_OPTIONS = [
    { value: 0, label: t('occasion.always') },
    { value: 1, label: t('occasion.onlyInBattle') },
    { value: 2, label: t('occasion.onlyFromMenu') },
    { value: 3, label: t('occasion.never') },
  ];

  const HIT_TYPE_OPTIONS = [
    { value: 0, label: t('hitType.certainHit') },
    { value: 1, label: t('hitType.physicalAttack') },
    { value: 2, label: t('hitType.magicalAttack') },
  ];

  useEffect(() => {
    apiClient.get<{ skillTypes?: string[]; weaponTypes?: string[] }>('/database/system').then(sys => {
      if (sys.skillTypes) setSkillTypes(sys.skillTypes);
      if (sys.weaponTypes) setWeaponTypes(sys.weaponTypes);
    }).catch(() => {});
    apiClient.get<(RefItem | null)[]>('/database/animations').then(d => {
      setAnimations(d.filter(Boolean) as RefItem[]);
    }).catch(() => {});
  }, []);

  const handleFieldChange = (field: keyof Skill, value: unknown) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange(newData);
  };

  const handleAddSkill = () => {
    if (!data) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newSkill: Skill = {
      id: maxId + 1,
      name: '',
      iconIndex: 0,
      description: '',
      stypeId: 1,
      scope: 0,
      occasion: 0,
      mpCost: 0,
      tpCost: 0,
      speed: 0,
      successRate: 100,
      repeats: 1,
      tpGain: 0,
      hitType: 0,
      animationId: 0,
      damage: { ...DEFAULT_DAMAGE },
      effects: [],
      message1: '',
      message2: '',
      note: '',
      requiredWtypeId1: 0,
      requiredWtypeId2: 0,
    };
    const newData = [...data, newSkill];
    onChange(newData);
    setSelectedId(newSkill.id);
  };

  return (
    <div className="db-tab-layout">
      {/* 좌측: 스킬 목록 */}
      <div className="db-list">
        <div className="db-list-header">
          <span>{t('database.tabs.skills')}</span>
          <button className="db-btn-small" onClick={handleAddSkill}>+</button>
        </div>
        {data?.filter(Boolean).map((item) => (
          <div
            key={item!.id}
            className={`db-list-item${item!.id === selectedId ? ' selected' : ''}`}
            onClick={() => setSelectedId(item!.id)}
          >
            {String(item!.id).padStart(4, '0')}: {item!.name}
          </div>
        ))}
      </div>

      {/* 중앙 + 우측: 2컬럼 폼 */}
      {selectedItem && (
        <div className="db-form-columns">
          {/* 중앙 컬럼: 일반 설정 */}
          <div className="db-form-col">
            <div className="db-form-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
              {t('skills.generalSettings')}
            </div>

            {/* 이름 + 아이콘 (한 줄) */}
            <div className="db-form-row">
              <label style={{ flex: 2 }}>
                {t('common.name')}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={selectedItem.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <TranslateButton csvPath="database/skills.csv" entryKey={`${selectedItem.id}.name`} sourceText={selectedItem.name || ''} />
                </div>
              </label>
              <label style={{ flex: 0, minWidth: 'fit-content' }}>
                {t('common.icon')}
                <IconPicker
                  value={selectedItem.iconIndex || 0}
                  onChange={(v) => handleFieldChange('iconIndex', v)}
                />
              </label>
            </div>

            {/* 설명 */}
            <label>
              {t('common.description')}
              <div style={{ display: 'flex', gap: 4, alignItems: 'start' }}>
                <textarea
                  value={selectedItem.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  rows={2}
                  style={{ flex: 1 }}
                />
                <TranslateButton csvPath="database/skills.csv" entryKey={`${selectedItem.id}.description`} sourceText={selectedItem.description || ''} />
              </div>
            </label>

            {/* 스킬 타입 / 소비 MP / 소비 TP (한 줄) */}
            <div className="db-form-row">
              <label>
                {t('fields.skillType')}
                <select value={selectedItem.stypeId || 0} onChange={(e) => handleFieldChange('stypeId', Number(e.target.value))}>
                  {skillTypes.map((name, i) => name ? <option key={i} value={i}>{String(i).padStart(2, '0')}: {name}</option> : null)}
                  {skillTypes.length === 0 && <option value={selectedItem.stypeId || 0}>{selectedItem.stypeId}</option>}
                </select>
              </label>
              <label>
                {t('fields.mpCost')}
                <input
                  type="number"
                  value={selectedItem.mpCost || 0}
                  onChange={(e) => handleFieldChange('mpCost', Number(e.target.value))}
                  min={0}
                />
              </label>
              <label>
                {t('fields.tpCost')}
                <input
                  type="number"
                  value={selectedItem.tpCost || 0}
                  onChange={(e) => handleFieldChange('tpCost', Number(e.target.value))}
                  min={0}
                />
              </label>
            </div>

            {/* 범위 / 사용 가능시 (한 줄) */}
            <div className="db-form-row">
              <label>
                {t('fields.scope')}
                <select
                  value={selectedItem.scope || 0}
                  onChange={(e) => handleFieldChange('scope', Number(e.target.value))}
                >
                  {SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('fields.occasion')}
                <select
                  value={selectedItem.occasion || 0}
                  onChange={(e) => handleFieldChange('occasion', Number(e.target.value))}
                >
                  {OCCASION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* 발동 섹션 */}
            <div className="db-form-section">{t('fields.invocation')}</div>

            {/* 속도 / 성공률 / 연속 횟수 / TP 획득 (한 줄) */}
            <div className="db-form-row">
              <label>
                {t('fields.speed')}
                <input
                  type="number"
                  value={selectedItem.speed || 0}
                  onChange={(e) => handleFieldChange('speed', Number(e.target.value))}
                />
              </label>
              <label>
                {t('fields.successRate')}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    value={selectedItem.successRate ?? 100}
                    onChange={(e) => handleFieldChange('successRate', Number(e.target.value))}
                    min={0}
                    max={100}
                    style={{ flex: 1 }}
                  />
                  <span style={{ color: '#aaa', fontSize: 12 }}>%</span>
                </div>
              </label>
              <label>
                {t('fields.repeats')}
                <input
                  type="number"
                  value={selectedItem.repeats || 1}
                  onChange={(e) => handleFieldChange('repeats', Number(e.target.value))}
                  min={1}
                />
              </label>
              <label>
                {t('fields.tpGain')}
                <input
                  type="number"
                  value={selectedItem.tpGain || 0}
                  onChange={(e) => handleFieldChange('tpGain', Number(e.target.value))}
                  min={0}
                />
              </label>
            </div>

            {/* 히트 유형 / 애니메이션 (한 줄) */}
            <div className="db-form-row">
              <label>
                {t('fields.hitType')}
                <select
                  value={selectedItem.hitType || 0}
                  onChange={(e) => handleFieldChange('hitType', Number(e.target.value))}
                >
                  {HIT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('common.animation')}
                <select value={selectedItem.animationId || 0} onChange={(e) => handleFieldChange('animationId', Number(e.target.value))}>
                  <option value={0}>{t('common.none')}</option>
                  {animations.map(a => <option key={a.id} value={a.id}>{String(a.id).padStart(4, '0')}: {a.name}</option>)}
                </select>
              </label>
            </div>

            {/* 메시지 섹션 */}
            <div className="db-form-section">{t('fields.message')}</div>

            <label>
              ({t('fields.userName')})
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  type="text"
                  value={selectedItem.message1 || ''}
                  onChange={(e) => handleFieldChange('message1', e.target.value)}
                  style={{ flex: 1 }}
                />
                <TranslateButton csvPath="database/skills.csv" entryKey={`${selectedItem.id}.message1`} sourceText={selectedItem.message1 || ''} />
              </div>
            </label>

            <label>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  type="text"
                  value={selectedItem.message2 || ''}
                  onChange={(e) => handleFieldChange('message2', e.target.value)}
                  style={{ flex: 1 }}
                />
                <TranslateButton csvPath="database/skills.csv" entryKey={`${selectedItem.id}.message2`} sourceText={selectedItem.message2 || ''} />
              </div>
            </label>

            {/* 필요한 무기 섹션 */}
            <div className="db-form-section">{t('fields.requiredWeaponTypes')}</div>

            <div className="db-form-row">
              <label>
                {t('fields.requiredWeaponType1')}
                <select value={selectedItem.requiredWtypeId1 || 0} onChange={(e) => handleFieldChange('requiredWtypeId1', Number(e.target.value))}>
                  <option value={0}>{t('common.none')}</option>
                  {weaponTypes.map((name, i) => name ? <option key={i} value={i}>{String(i).padStart(2, '0')}: {name}</option> : null)}
                </select>
              </label>
              <label>
                {t('fields.requiredWeaponType2')}
                <select value={selectedItem.requiredWtypeId2 || 0} onChange={(e) => handleFieldChange('requiredWtypeId2', Number(e.target.value))}>
                  <option value={0}>{t('common.none')}</option>
                  {weaponTypes.map((name, i) => name ? <option key={i} value={i}>{String(i).padStart(2, '0')}: {name}</option> : null)}
                </select>
              </label>
            </div>
          </div>

          {/* 우측 컬럼: 손상 + 사용 효과 + 메모 */}
          <div className="db-form-col">
            <div className="db-form-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
              {t('fields.damage')}
            </div>

            <DamageEditor
              damage={selectedItem.damage || { ...DEFAULT_DAMAGE }}
              onChange={(damage) => handleFieldChange('damage', damage)}
            />

            <div className="db-form-section">{t('fields.effects')}</div>

            <EffectsEditor
              effects={selectedItem.effects || []}
              onChange={(effects) => handleFieldChange('effects', effects)}
            />

            <div className="db-form-section">{t('common.note')}</div>

            <textarea
              value={selectedItem.note || ''}
              onChange={(e) => handleFieldChange('note', e.target.value)}
              rows={5}
              style={{
                background: '#2b2b2b',
                border: '1px solid #555',
                borderRadius: 3,
                padding: '4px 8px',
                color: '#ddd',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                flex: 1,
                minHeight: 60,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
