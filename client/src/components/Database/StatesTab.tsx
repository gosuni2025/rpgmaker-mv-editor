import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { State } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import TraitsEditor from '../common/TraitsEditor';
import TranslateButton from '../common/TranslateButton';

interface StatesTabProps {
  data: (State | null)[] | undefined;
  onChange: (data: (State | null)[]) => void;
}

export default function StatesTab({ data, onChange }: StatesTabProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);

  const SV_MOTION_LABELS: Record<number, string> = {
    0: t('svMotion.normal'),
    1: t('svMotion.abnormal'),
    2: t('svMotion.sleep'),
    3: t('svMotion.dead'),
  };

  const SV_OVERLAY_LABELS: Record<number, string> = {
    0: t('svOverlay.none'),
    1: t('svOverlay.poison'),
    2: t('svOverlay.blind'),
    3: t('svOverlay.silence'),
    4: t('svOverlay.rage'),
    5: t('svOverlay.confusion'),
    6: t('svOverlay.fascination'),
    7: t('svOverlay.sleep'),
    8: t('svOverlay.paralyze'),
    9: t('svOverlay.curse'),
  };

  const handleFieldChange = (field: keyof State, value: unknown) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange(newData);
  };

  const addNewState = () => {
    if (!data) return;
    const existing = data.filter(Boolean) as State[];
    const maxId = existing.length > 0 ? Math.max(...existing.map(s => s.id)) : 0;
    const newState: State = {
      id: maxId + 1,
      name: '',
      iconIndex: 0,
      restriction: 0,
      priority: 50,
      removeAtBattleEnd: false,
      removeByRestriction: false,
      autoRemovalTiming: 0,
      minTurns: 1,
      maxTurns: 1,
      removeByDamage: false,
      chanceByDamage: 100,
      removeByWalking: false,
      stepsToRemove: 100,
      message1: '',
      message2: '',
      message3: '',
      message4: '',
      motion: 0,
      overlay: 0,
      traits: [],
      note: '',
    };
    const newData = [...data, newState];
    onChange(newData);
    setSelectedId(newState.id);
  };

  return (
    <div className="db-tab-layout">
      <div className="db-list">
        <div className="db-list-header">
          <button className="db-btn-small" onClick={addNewState}>+</button>
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
      <div className="db-form">
        {selectedItem && (
          <>
            <label>
              {t('common.name')}
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <input
                  type="text"
                  value={selectedItem.name || ''}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  style={{flex:1}}
                />
                <TranslateButton csvPath="database/states.csv" entryKey={`${selectedItem.id}.name`} sourceText={selectedItem.name || ''} />
              </div>
            </label>

            <div className="db-form-section">{t('common.icon')}</div>
            <IconPicker
              value={selectedItem.iconIndex || 0}
              onChange={(idx) => handleFieldChange('iconIndex', idx)}
            />

            <label>
              {t('fields.restriction')}
              <select
                value={selectedItem.restriction || 0}
                onChange={(e) => handleFieldChange('restriction', Number(e.target.value))}
                style={{ background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13 }}
              >
                <option value={0}>{t('restriction.none')}</option>
                <option value={1}>{t('restriction.attackEnemy')}</option>
                <option value={2}>{t('restriction.attackAnyone')}</option>
                <option value={3}>{t('restriction.attackAlly')}</option>
                <option value={4}>{t('restriction.cannotMove')}</option>
              </select>
            </label>
            <label>
              {t('fields.priority')}
              <input
                type="number"
                min={0}
                max={100}
                value={selectedItem.priority || 0}
                onChange={(e) => handleFieldChange('priority', Number(e.target.value))}
              />
            </label>

            <div className="db-form-section">{t('fields.removalConditions')}</div>
            <label className="db-checkbox-label">
              <input
                type="checkbox"
                checked={selectedItem.removeAtBattleEnd ?? false}
                onChange={(e) => handleFieldChange('removeAtBattleEnd', e.target.checked)}
              />
              {t('fields.removeAtBattleEnd')}
            </label>
            <label className="db-checkbox-label">
              <input
                type="checkbox"
                checked={selectedItem.removeByRestriction ?? false}
                onChange={(e) => handleFieldChange('removeByRestriction', e.target.checked)}
              />
              {t('fields.removeByRestriction')}
            </label>
            <label>
              {t('fields.autoRemovalTiming')}
              <select
                value={selectedItem.autoRemovalTiming || 0}
                onChange={(e) => handleFieldChange('autoRemovalTiming', Number(e.target.value))}
                style={{ background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13 }}
              >
                <option value={0}>{t('autoRemoval.none')}</option>
                <option value={1}>{t('autoRemoval.actionEnd')}</option>
                <option value={2}>{t('autoRemoval.turnEnd')}</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ flex: 1 }}>
                {t('fields.minTurns')}
                <input
                  type="number"
                  value={selectedItem.minTurns || 0}
                  onChange={(e) => handleFieldChange('minTurns', Number(e.target.value))}
                />
              </label>
              <label style={{ flex: 1 }}>
                {t('fields.maxTurns')}
                <input
                  type="number"
                  value={selectedItem.maxTurns || 0}
                  onChange={(e) => handleFieldChange('maxTurns', Number(e.target.value))}
                />
              </label>
            </div>
            <label className="db-checkbox-label">
              <input
                type="checkbox"
                checked={selectedItem.removeByDamage ?? false}
                onChange={(e) => handleFieldChange('removeByDamage', e.target.checked)}
              />
              {t('fields.removeByDamage')}
            </label>
            <label>
              {t('fields.chanceByDamage')}
              <input
                type="number"
                min={0}
                max={100}
                value={selectedItem.chanceByDamage || 0}
                onChange={(e) => handleFieldChange('chanceByDamage', Number(e.target.value))}
              />
            </label>
            <label className="db-checkbox-label">
              <input
                type="checkbox"
                checked={selectedItem.removeByWalking ?? false}
                onChange={(e) => handleFieldChange('removeByWalking', e.target.checked)}
              />
              {t('fields.removeByWalking')}
            </label>
            <label>
              {t('fields.stepsToRemove')}
              <input
                type="number"
                value={selectedItem.stepsToRemove || 0}
                onChange={(e) => handleFieldChange('stepsToRemove', Number(e.target.value))}
              />
            </label>

            <div className="db-form-section">{t('fields.svSideView')}</div>
            <label>
              {t('fields.svMotion')}
              <select
                value={selectedItem.motion || 0}
                onChange={(e) => handleFieldChange('motion', Number(e.target.value))}
                style={{ background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13 }}
              >
                {Object.entries(SV_MOTION_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              {t('fields.svOverlay')}
              <select
                value={selectedItem.overlay || 0}
                onChange={(e) => handleFieldChange('overlay', Number(e.target.value))}
                style={{ background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13 }}
              >
                {Object.entries(SV_OVERLAY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </label>

            <div className="db-form-section">{t('fields.messages')}</div>
            <label>
              {t('fields.message1Actor')}
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <input
                  type="text"
                  value={selectedItem.message1 || ''}
                  onChange={(e) => handleFieldChange('message1', e.target.value)}
                  style={{flex:1}}
                />
                <TranslateButton csvPath="database/states.csv" entryKey={`${selectedItem.id}.message1`} sourceText={selectedItem.message1 || ''} />
              </div>
            </label>
            <label>
              {t('fields.message2Enemy')}
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <input
                  type="text"
                  value={selectedItem.message2 || ''}
                  onChange={(e) => handleFieldChange('message2', e.target.value)}
                  style={{flex:1}}
                />
                <TranslateButton csvPath="database/states.csv" entryKey={`${selectedItem.id}.message2`} sourceText={selectedItem.message2 || ''} />
              </div>
            </label>
            <label>
              {t('fields.message3Persist')}
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <input
                  type="text"
                  value={selectedItem.message3 || ''}
                  onChange={(e) => handleFieldChange('message3', e.target.value)}
                  style={{flex:1}}
                />
                <TranslateButton csvPath="database/states.csv" entryKey={`${selectedItem.id}.message3`} sourceText={selectedItem.message3 || ''} />
              </div>
            </label>
            <label>
              {t('fields.message4Remove')}
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <input
                  type="text"
                  value={selectedItem.message4 || ''}
                  onChange={(e) => handleFieldChange('message4', e.target.value)}
                  style={{flex:1}}
                />
                <TranslateButton csvPath="database/states.csv" entryKey={`${selectedItem.id}.message4`} sourceText={selectedItem.message4 || ''} />
              </div>
            </label>

            <div className="db-form-section">{t('fields.traits')}</div>
            <TraitsEditor
              traits={selectedItem.traits || []}
              onChange={(traits) => handleFieldChange('traits', traits)}
            />

            <label>
              {t('common.note')}
              <textarea
                value={selectedItem.note || ''}
                onChange={(e) => handleFieldChange('note', e.target.value)}
                rows={3}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
