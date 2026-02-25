import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Skill, Damage, Effect } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import DamageEditor from '../common/DamageEditor';
import TranslateButton from '../common/TranslateButton';
import EffectsEditor from '../common/EffectsEditor';
import AnimationPickerDialog from '../EventEditor/AnimationPickerDialog';
import DatabaseList from './DatabaseList';
import apiClient from '../../api/client';
import { useDatabaseTab } from './useDatabaseTab';
import { makeScopeOptions, makeOccasionOptions, makeHitTypeOptions } from './dbConstants';
import { useDbRef } from './useDbRef';

const DEFAULT_DAMAGE: Damage = { critical: false, elementId: 0, formula: '', type: 0, variance: 0 };

function createNewSkill(id: number): Skill {
  return {
    id,
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
}

function deepCopySkill(source: Skill): Partial<Skill> {
  return {
    damage: { ...source.damage },
    effects: source.effects.map((e: Effect) => ({ ...e })),
  };
}

interface SkillsTabProps {
  data: (Skill | null)[] | undefined;
  onChange: (data: (Skill | null)[]) => void;
}

export default function SkillsTab({ data, onChange }: SkillsTabProps) {
  const { t } = useTranslation();
  const { selectedId, setSelectedId, selectedItem, handleFieldChange, handleAdd, handleDelete, handleDuplicate, handleReorder } =
    useDatabaseTab(data, onChange, createNewSkill, deepCopySkill);
  const [skillTypes, setSkillTypes] = useState<string[]>([]);
  const [weaponTypes, setWeaponTypes] = useState<string[]>([]);
  const animations = useDbRef('/database/animations');
  const [showAnimPicker, setShowAnimPicker] = useState(false);

  const SCOPE_OPTIONS = makeScopeOptions(t);
  const OCCASION_OPTIONS = makeOccasionOptions(t);
  const HIT_TYPE_OPTIONS = makeHitTypeOptions(t);

  useEffect(() => {
    apiClient.get<{ skillTypes?: string[]; weaponTypes?: string[] }>('/database/system').then(sys => {
      if (sys.skillTypes) setSkillTypes(sys.skillTypes);
      if (sys.weaponTypes) setWeaponTypes(sys.weaponTypes);
    }).catch(() => {});
  }, []);

  return (
    <div className="db-tab-layout">
      <DatabaseList
        items={data}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onReorder={handleReorder}
        title={t('database.tabs.skills')}
      />

      {selectedItem && (
        <div className="db-form-columns">
          <div className="db-form-col">
            <div className="db-form-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
              {t('skills.generalSettings')}
            </div>

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
              <div className="db-form-field-label" style={{ flex: 0, minWidth: 'fit-content' }}>
                {t('common.icon')}
                <IconPicker
                  value={selectedItem.iconIndex || 0}
                  onChange={(v) => handleFieldChange('iconIndex', v)}
                />
              </div>
            </div>

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

            <div className="db-form-row">
              <label>
                {t('fields.skillType')}
                <select value={selectedItem.stypeId || 0} onChange={(e) => handleFieldChange('stypeId', Number(e.target.value))}>
                  <option value={0}>{t('common.none')}</option>
                  {skillTypes.map((name, i) => i > 0 && name ? <option key={i} value={i}>{name}</option> : null)}
                </select>
              </label>
              <label>
                {t('fields.mpCost')}
                <input type="number" value={selectedItem.mpCost || 0} onChange={(e) => handleFieldChange('mpCost', Number(e.target.value))} min={0} />
              </label>
              <label>
                {t('fields.tpCost')}
                <input type="number" value={selectedItem.tpCost || 0} onChange={(e) => handleFieldChange('tpCost', Number(e.target.value))} min={0} />
              </label>
            </div>

            <div className="db-form-row">
              <label>
                {t('fields.scope')}
                <select value={selectedItem.scope || 0} onChange={(e) => handleFieldChange('scope', Number(e.target.value))}>
                  {SCOPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>
              <label>
                {t('fields.occasion')}
                <select value={selectedItem.occasion || 0} onChange={(e) => handleFieldChange('occasion', Number(e.target.value))}>
                  {OCCASION_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>
            </div>

            <div className="db-form-section">{t('fields.invocation')}</div>

            <div className="db-form-row">
              <label>
                {t('fields.speed')}
                <input type="number" value={selectedItem.speed || 0} onChange={(e) => handleFieldChange('speed', Number(e.target.value))} />
              </label>
              <label>
                {t('fields.successRate')}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" value={selectedItem.successRate ?? 100} onChange={(e) => handleFieldChange('successRate', Number(e.target.value))} min={0} max={100} style={{ flex: 1 }} />
                  <span style={{ color: '#aaa', fontSize: 12 }}>%</span>
                </div>
              </label>
              <label>
                {t('fields.repeats')}
                <input type="number" value={selectedItem.repeats || 1} onChange={(e) => handleFieldChange('repeats', Number(e.target.value))} min={1} />
              </label>
              <label>
                {t('fields.tpGain')}
                <input type="number" value={selectedItem.tpGain || 0} onChange={(e) => handleFieldChange('tpGain', Number(e.target.value))} min={0} />
              </label>
            </div>

            <div className="db-form-row">
              <label>
                {t('fields.hitType')}
                <select value={selectedItem.hitType || 0} onChange={(e) => handleFieldChange('hitType', Number(e.target.value))}>
                  {HIT_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>
              <label>
                {t('common.animation')}
                <button className="db-picker-btn" onClick={() => setShowAnimPicker(true)}>
                  {selectedItem.animationId === -1 ? t('common.normalAttack') :
                   selectedItem.animationId === 0 || selectedItem.animationId == null ? t('common.none') :
                   `${String(selectedItem.animationId).padStart(4, '0')}: ${animations.find(a => a.id === selectedItem.animationId)?.name || ''}`}
                </button>
              </label>
            </div>

            <div className="db-form-section">{t('fields.message')}</div>

            <label>
              ({t('fields.userName')})
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input type="text" value={selectedItem.message1 || ''} onChange={(e) => handleFieldChange('message1', e.target.value)} style={{ flex: 1 }} />
                <TranslateButton csvPath="database/skills.csv" entryKey={`${selectedItem.id}.message1`} sourceText={selectedItem.message1 || ''} />
              </div>
            </label>

            <label>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input type="text" value={selectedItem.message2 || ''} onChange={(e) => handleFieldChange('message2', e.target.value)} style={{ flex: 1 }} />
                <TranslateButton csvPath="database/skills.csv" entryKey={`${selectedItem.id}.message2`} sourceText={selectedItem.message2 || ''} />
              </div>
            </label>

            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  className="db-btn-small"
                  onClick={() => {
                    handleFieldChange('message1', t(`skills.msgPreset${n}`));
                    handleFieldChange('message2', '');
                  }}
                >
                  {t(`skills.msgPreset${n}Label`)}
                </button>
              ))}
            </div>

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
              className="db-note-textarea"
              value={selectedItem.note || ''}
              onChange={(e) => handleFieldChange('note', e.target.value)}
              rows={5}
            />
          </div>
        </div>
      )}

      {showAnimPicker && selectedItem && (
        <AnimationPickerDialog
          value={selectedItem.animationId ?? 0}
          onChange={(id) => handleFieldChange('animationId', id)}
          onClose={() => setShowAnimPicker(false)}
        />
      )}
    </div>
  );
}
