import React, { useState, useEffect } from 'react';
import type { Skill, Damage, Effect } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import DamageEditor from '../common/DamageEditor';
import EffectsEditor from '../common/EffectsEditor';
import apiClient from '../../api/client';

interface SkillsTabProps {
  data: (Skill | null)[] | undefined;
  onChange: (data: (Skill | null)[]) => void;
}

interface RefItem { id: number; name: string }

const SCOPE_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 1, label: '1 Enemy' },
  { value: 2, label: 'All Enemies' },
  { value: 3, label: '1 Random Enemy' },
  { value: 4, label: '2 Random Enemies' },
  { value: 5, label: '3 Random Enemies' },
  { value: 6, label: '4 Random Enemies' },
  { value: 7, label: '1 Ally' },
  { value: 8, label: 'All Allies' },
  { value: 9, label: '1 Ally (Dead)' },
  { value: 10, label: 'All Allies (Dead)' },
  { value: 11, label: 'The User' },
];

const OCCASION_OPTIONS = [
  { value: 0, label: 'Always' },
  { value: 1, label: 'Only in Battle' },
  { value: 2, label: 'Only from Menu' },
  { value: 3, label: 'Never' },
];

const HIT_TYPE_OPTIONS = [
  { value: 0, label: 'Certain Hit' },
  { value: 1, label: 'Physical Attack' },
  { value: 2, label: 'Magical Attack' },
];

const DEFAULT_DAMAGE: Damage = { critical: false, elementId: 0, formula: '', type: 0, variance: 0 };
const selectStyle: React.CSSProperties = { background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13, width: '100%' };

export default function SkillsTab({ data, onChange }: SkillsTabProps) {
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);
  const [skillTypes, setSkillTypes] = useState<string[]>([]);
  const [weaponTypes, setWeaponTypes] = useState<string[]>([]);
  const [animations, setAnimations] = useState<RefItem[]>([]);

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
      <div className="db-list">
        <div className="db-list-header">
          <span>Skills</span>
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

            <label>
              Icon
            </label>
            <IconPicker
              value={selectedItem.iconIndex || 0}
              onChange={(v) => handleFieldChange('iconIndex', v)}
            />

            <label>
              Description
              <textarea
                value={selectedItem.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                rows={2}
              />
            </label>

            <label>
              Skill Type
              <select value={selectedItem.stypeId || 0} onChange={(e) => handleFieldChange('stypeId', Number(e.target.value))} style={selectStyle}>
                {skillTypes.map((name, i) => name ? <option key={i} value={i}>{String(i).padStart(2, '0')}: {name}</option> : null)}
                {skillTypes.length === 0 && <option value={selectedItem.stypeId || 0}>{selectedItem.stypeId}</option>}
              </select>
            </label>

            <label>
              MP Cost
              <input
                type="number"
                value={selectedItem.mpCost || 0}
                onChange={(e) => handleFieldChange('mpCost', Number(e.target.value))}
                min={0}
              />
            </label>

            <label>
              TP Cost
              <input
                type="number"
                value={selectedItem.tpCost || 0}
                onChange={(e) => handleFieldChange('tpCost', Number(e.target.value))}
                min={0}
              />
            </label>

            <label>
              Scope
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
              Occasion
              <select
                value={selectedItem.occasion || 0}
                onChange={(e) => handleFieldChange('occasion', Number(e.target.value))}
              >
                {OCCASION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <label>
              Hit Type
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
              Speed
              <input
                type="number"
                value={selectedItem.speed || 0}
                onChange={(e) => handleFieldChange('speed', Number(e.target.value))}
              />
            </label>

            <label>
              Success Rate
              <input
                type="number"
                value={selectedItem.successRate ?? 100}
                onChange={(e) => handleFieldChange('successRate', Number(e.target.value))}
                min={0}
                max={100}
              />
            </label>

            <label>
              Repeats
              <input
                type="number"
                value={selectedItem.repeats || 1}
                onChange={(e) => handleFieldChange('repeats', Number(e.target.value))}
                min={1}
              />
            </label>

            <label>
              TP Gain
              <input
                type="number"
                value={selectedItem.tpGain || 0}
                onChange={(e) => handleFieldChange('tpGain', Number(e.target.value))}
                min={0}
              />
            </label>

            <label>
              Animation
              <select value={selectedItem.animationId || 0} onChange={(e) => handleFieldChange('animationId', Number(e.target.value))} style={selectStyle}>
                <option value={0}>(None)</option>
                {animations.map(a => <option key={a.id} value={a.id}>{String(a.id).padStart(4, '0')}: {a.name}</option>)}
              </select>
            </label>

            <DamageEditor
              damage={selectedItem.damage || { ...DEFAULT_DAMAGE }}
              onChange={(damage) => handleFieldChange('damage', damage)}
            />

            <div className="db-form-section">Invocation</div>

            <label>
              Message 1
              <input
                type="text"
                value={selectedItem.message1 || ''}
                onChange={(e) => handleFieldChange('message1', e.target.value)}
              />
            </label>

            <label>
              Message 2
              <input
                type="text"
                value={selectedItem.message2 || ''}
                onChange={(e) => handleFieldChange('message2', e.target.value)}
              />
            </label>

            <div className="db-form-section">Required Weapon Types</div>

            <label>
              Required Weapon Type 1
              <select value={selectedItem.requiredWtypeId1 || 0} onChange={(e) => handleFieldChange('requiredWtypeId1', Number(e.target.value))} style={selectStyle}>
                <option value={0}>(None)</option>
                {weaponTypes.map((name, i) => name ? <option key={i} value={i}>{String(i).padStart(2, '0')}: {name}</option> : null)}
              </select>
            </label>

            <label>
              Required Weapon Type 2
              <select value={selectedItem.requiredWtypeId2 || 0} onChange={(e) => handleFieldChange('requiredWtypeId2', Number(e.target.value))} style={selectStyle}>
                <option value={0}>(None)</option>
                {weaponTypes.map((name, i) => name ? <option key={i} value={i}>{String(i).padStart(2, '0')}: {name}</option> : null)}
              </select>
            </label>

            <EffectsEditor
              effects={selectedItem.effects || []}
              onChange={(effects) => handleFieldChange('effects', effects)}
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
