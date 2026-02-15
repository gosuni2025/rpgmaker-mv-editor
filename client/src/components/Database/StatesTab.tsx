import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { State } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import TraitsEditor from '../common/TraitsEditor';
import TranslateButton from '../common/TranslateButton';
import DatabaseList from './DatabaseList';
import './StatesTab.css';

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

  const addNewState = useCallback(() => {
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
  }, [data, onChange]);

  const handleDelete = useCallback((id: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as State[];
    if (items.length <= 1) return;
    const newData = data.filter((item) => !item || item.id !== id);
    onChange(newData);
    if (id === selectedId) {
      const remaining = newData.filter(Boolean) as State[];
      if (remaining.length > 0) setSelectedId(remaining[0].id);
    }
  }, [data, onChange, selectedId]);

  const handleDuplicate = useCallback((id: number) => {
    if (!data) return;
    const source = data.find((item) => item && item.id === id);
    if (!source) return;
    const existing = data.filter(Boolean) as State[];
    const maxId = existing.length > 0 ? Math.max(...existing.map(s => s.id)) : 0;
    const newId = maxId + 1;
    const newData = [...data, { ...source, id: newId, traits: source.traits.map(t => ({ ...t })) }];
    onChange(newData);
    setSelectedId(newId);
  }, [data, onChange]);

  const handleReorder = useCallback((fromId: number, toId: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as State[];
    const fromIdx = items.findIndex(item => item.id === fromId);
    if (fromIdx < 0) return;
    const [moved] = items.splice(fromIdx, 1);
    if (toId === -1) {
      items.push(moved);
    } else {
      const toIdx = items.findIndex(item => item.id === toId);
      if (toIdx < 0) items.push(moved);
      else items.splice(toIdx, 0, moved);
    }
    onChange([null, ...items]);
  }, [data, onChange]);

  return (
    <div className="db-tab-layout">
      <DatabaseList
        items={data}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={addNewState}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onReorder={handleReorder}
      />

      {selectedItem && (
        <div className="states-main">
          {/* 가운데 패널: 일반설정 + 해제조건 + 메시지 */}
          <div className="states-center">
            <div className="states-section-title">{t('fields.generalSettings')}</div>

            {/* 일반설정 2열 그리드 */}
            <div className="states-grid-2col">
              <label className="states-label">
                {t('common.name')}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    className="states-input"
                    type="text"
                    value={selectedItem.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <TranslateButton csvPath="database/states.csv" entryKey={`${selectedItem.id}.name`} sourceText={selectedItem.name || ''} />
                </div>
              </label>

              <label className="states-label">
                {t('common.icon')}
                <IconPicker
                  value={selectedItem.iconIndex || 0}
                  onChange={(idx) => handleFieldChange('iconIndex', idx)}
                />
              </label>

              <label className="states-label">
                {t('fields.restriction')}
                <select
                  className="states-select"
                  value={selectedItem.restriction || 0}
                  onChange={(e) => handleFieldChange('restriction', Number(e.target.value))}
                >
                  <option value={0}>{t('restriction.none')}</option>
                  <option value={1}>{t('restriction.attackEnemy')}</option>
                  <option value={2}>{t('restriction.attackAnyone')}</option>
                  <option value={3}>{t('restriction.attackAlly')}</option>
                  <option value={4}>{t('restriction.cannotMove')}</option>
                </select>
              </label>

              <label className="states-label">
                {t('fields.priority')}
                <input
                  className="states-input"
                  type="number"
                  min={0}
                  max={100}
                  value={selectedItem.priority || 0}
                  onChange={(e) => handleFieldChange('priority', Number(e.target.value))}
                />
              </label>

              <label className="states-label">
                {t('fields.svMotion')}
                <select
                  className="states-select"
                  value={selectedItem.motion || 0}
                  onChange={(e) => handleFieldChange('motion', Number(e.target.value))}
                >
                  {Object.entries(SV_MOTION_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="states-label">
                {t('fields.svOverlay')}
                <select
                  className="states-select"
                  value={selectedItem.overlay || 0}
                  onChange={(e) => handleFieldChange('overlay', Number(e.target.value))}
                >
                  {Object.entries(SV_OVERLAY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* 해제 조건 2열 그리드 */}
            <div className="states-section-title">{t('fields.removalConditions')}</div>

            <div className="states-grid-2col">
              <label className="states-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedItem.removeAtBattleEnd ?? false}
                  onChange={(e) => handleFieldChange('removeAtBattleEnd', e.target.checked)}
                />
                {t('fields.removeAtBattleEnd')}
              </label>

              <label className="states-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedItem.removeByRestriction ?? false}
                  onChange={(e) => handleFieldChange('removeByRestriction', e.target.checked)}
                />
                {t('fields.removeByRestriction')}
              </label>

              <label className="states-label">
                {t('fields.autoRemovalTiming')}
                <select
                  className="states-select"
                  value={selectedItem.autoRemovalTiming || 0}
                  onChange={(e) => handleFieldChange('autoRemovalTiming', Number(e.target.value))}
                >
                  <option value={0}>{t('autoRemoval.none')}</option>
                  <option value={1}>{t('autoRemoval.actionEnd')}</option>
                  <option value={2}>{t('autoRemoval.turnEnd')}</option>
                </select>
              </label>

              <div className="states-label">
                {t('fields.durationTurns')}
                <div className="states-turns-row">
                  <input
                    className="states-input"
                    type="number"
                    value={selectedItem.minTurns || 0}
                    onChange={(e) => handleFieldChange('minTurns', Number(e.target.value))}
                  />
                  <span className="states-tilde">~</span>
                  <input
                    className="states-input"
                    type="number"
                    value={selectedItem.maxTurns || 0}
                    onChange={(e) => handleFieldChange('maxTurns', Number(e.target.value))}
                  />
                </div>
              </div>

              <label className="states-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedItem.removeByDamage ?? false}
                  onChange={(e) => handleFieldChange('removeByDamage', e.target.checked)}
                />
                {t('fields.removeByDamage')}
              </label>

              <div className="states-label">
                {t('fields.chanceByDamage')}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    className="states-input"
                    type="number"
                    min={0}
                    max={100}
                    value={selectedItem.chanceByDamage || 0}
                    onChange={(e) => handleFieldChange('chanceByDamage', Number(e.target.value))}
                  />
                  <span style={{ color: '#aaa', fontSize: 12 }}>%</span>
                </div>
              </div>

              <label className="states-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedItem.removeByWalking ?? false}
                  onChange={(e) => handleFieldChange('removeByWalking', e.target.checked)}
                />
                {t('fields.removeByWalking')}
              </label>

              <div className="states-label">
                {t('fields.stepsToRemove')}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    className="states-input"
                    type="number"
                    value={selectedItem.stepsToRemove || 0}
                    onChange={(e) => handleFieldChange('stepsToRemove', Number(e.target.value))}
                  />
                  <span style={{ color: '#aaa', fontSize: 12 }}>{t('fields.steps')}</span>
                </div>
              </div>
            </div>

            {/* 메시지 */}
            <div className="states-section-title">{t('fields.messages')}</div>

            <div className="states-msg-grid">
              <span className="states-msg-label">{t('fields.message1Actor')}</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  className="states-input"
                  type="text"
                  value={selectedItem.message1 || ''}
                  onChange={(e) => handleFieldChange('message1', e.target.value)}
                  style={{ flex: 1 }}
                />
                <TranslateButton csvPath="database/states.csv" entryKey={`${selectedItem.id}.message1`} sourceText={selectedItem.message1 || ''} />
              </div>

              <span className="states-msg-label">{t('fields.message2Enemy')}</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  className="states-input"
                  type="text"
                  value={selectedItem.message2 || ''}
                  onChange={(e) => handleFieldChange('message2', e.target.value)}
                  style={{ flex: 1 }}
                />
                <TranslateButton csvPath="database/states.csv" entryKey={`${selectedItem.id}.message2`} sourceText={selectedItem.message2 || ''} />
              </div>

              <span className="states-msg-label">{t('fields.message3Persist')}</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  className="states-input"
                  type="text"
                  value={selectedItem.message3 || ''}
                  onChange={(e) => handleFieldChange('message3', e.target.value)}
                  style={{ flex: 1 }}
                />
                <TranslateButton csvPath="database/states.csv" entryKey={`${selectedItem.id}.message3`} sourceText={selectedItem.message3 || ''} />
              </div>

              <span className="states-msg-label">{t('fields.message4Remove')}</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  className="states-input"
                  type="text"
                  value={selectedItem.message4 || ''}
                  onChange={(e) => handleFieldChange('message4', e.target.value)}
                  style={{ flex: 1 }}
                />
                <TranslateButton csvPath="database/states.csv" entryKey={`${selectedItem.id}.message4`} sourceText={selectedItem.message4 || ''} />
              </div>
            </div>
          </div>

          {/* 오른쪽 패널: 특성 + 메모 */}
          <div className="states-right">
            <div className="states-section-title">{t('fields.traits')}</div>
            <TraitsEditor
              traits={selectedItem.traits || []}
              onChange={(traits) => handleFieldChange('traits', traits)}
            />

            <div className="states-section-title">{t('common.note')}</div>
            <textarea
              className="states-note"
              value={selectedItem.note || ''}
              onChange={(e) => handleFieldChange('note', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
