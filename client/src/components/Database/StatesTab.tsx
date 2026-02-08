import React, { useState } from 'react';
import type { State } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import TraitsEditor from '../common/TraitsEditor';

interface StatesTabProps {
  data: (State | null)[] | undefined;
  onChange: (data: (State | null)[]) => void;
}

const SV_MOTION_LABELS: Record<number, string> = {
  0: 'Normal',
  1: 'Abnormal',
  2: 'Sleep',
  3: 'Dead',
};

const SV_OVERLAY_LABELS: Record<number, string> = {
  0: 'None',
  1: 'Poison',
  2: 'Blind',
  3: 'Silence',
  4: 'Rage',
  5: 'Confusion',
  6: 'Fascination',
  7: 'Sleep',
  8: 'Paralyze',
  9: 'Curse',
};

export default function StatesTab({ data, onChange }: StatesTabProps) {
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);

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
              Name
              <input
                type="text"
                value={selectedItem.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
              />
            </label>

            <div className="db-form-section">Icon</div>
            <IconPicker
              value={selectedItem.iconIndex || 0}
              onChange={(idx) => handleFieldChange('iconIndex', idx)}
            />

            <label>
              Restriction
              <select
                value={selectedItem.restriction || 0}
                onChange={(e) => handleFieldChange('restriction', Number(e.target.value))}
                style={{ background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13 }}
              >
                <option value={0}>None</option>
                <option value={1}>Attack an enemy</option>
                <option value={2}>Attack anyone</option>
                <option value={3}>Attack an ally</option>
                <option value={4}>Cannot move</option>
              </select>
            </label>
            <label>
              Priority
              <input
                type="number"
                min={0}
                max={100}
                value={selectedItem.priority || 0}
                onChange={(e) => handleFieldChange('priority', Number(e.target.value))}
              />
            </label>

            <div className="db-form-section">Removal Conditions</div>
            <label className="db-checkbox-label">
              <input
                type="checkbox"
                checked={selectedItem.removeAtBattleEnd ?? false}
                onChange={(e) => handleFieldChange('removeAtBattleEnd', e.target.checked)}
              />
              Remove at Battle End
            </label>
            <label className="db-checkbox-label">
              <input
                type="checkbox"
                checked={selectedItem.removeByRestriction ?? false}
                onChange={(e) => handleFieldChange('removeByRestriction', e.target.checked)}
              />
              Remove by Restriction
            </label>
            <label>
              Auto-Removal Timing
              <select
                value={selectedItem.autoRemovalTiming || 0}
                onChange={(e) => handleFieldChange('autoRemovalTiming', Number(e.target.value))}
                style={{ background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13 }}
              >
                <option value={0}>None</option>
                <option value={1}>Action End</option>
                <option value={2}>Turn End</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ flex: 1 }}>
                Min Turns
                <input
                  type="number"
                  value={selectedItem.minTurns || 0}
                  onChange={(e) => handleFieldChange('minTurns', Number(e.target.value))}
                />
              </label>
              <label style={{ flex: 1 }}>
                Max Turns
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
              Remove by Damage
            </label>
            <label>
              Chance by Damage (%)
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
              Remove by Walking
            </label>
            <label>
              Steps to Remove
              <input
                type="number"
                value={selectedItem.stepsToRemove || 0}
                onChange={(e) => handleFieldChange('stepsToRemove', Number(e.target.value))}
              />
            </label>

            <div className="db-form-section">SV (Side View)</div>
            <label>
              SV Motion
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
              SV Overlay
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

            <div className="db-form-section">Messages</div>
            <label>
              Message 1 (Actor)
              <input
                type="text"
                value={selectedItem.message1 || ''}
                onChange={(e) => handleFieldChange('message1', e.target.value)}
              />
            </label>
            <label>
              Message 2 (Enemy)
              <input
                type="text"
                value={selectedItem.message2 || ''}
                onChange={(e) => handleFieldChange('message2', e.target.value)}
              />
            </label>
            <label>
              Message 3 (Persist)
              <input
                type="text"
                value={selectedItem.message3 || ''}
                onChange={(e) => handleFieldChange('message3', e.target.value)}
              />
            </label>
            <label>
              Message 4 (Remove)
              <input
                type="text"
                value={selectedItem.message4 || ''}
                onChange={(e) => handleFieldChange('message4', e.target.value)}
              />
            </label>

            <div className="db-form-section">Traits</div>
            <TraitsEditor
              traits={selectedItem.traits || []}
              onChange={(traits) => handleFieldChange('traits', traits)}
            />

            <label>
              Note
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
