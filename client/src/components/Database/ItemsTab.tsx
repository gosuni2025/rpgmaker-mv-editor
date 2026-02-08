import React, { useState, useEffect } from 'react';
import type { Item, Damage, Effect } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import DamageEditor from '../common/DamageEditor';
import EffectsEditor from '../common/EffectsEditor';
import apiClient from '../../api/client';

interface ItemsTabProps {
  data: (Item | null)[] | undefined;
  onChange: (data: (Item | null)[]) => void;
}

interface RefItem { id: number; name: string }

const SCOPE_OPTIONS = [
  'None', '1 Enemy', 'All Enemies', '1 Random Enemy', '2 Random', '3 Random', '4 Random',
  '1 Ally', 'All Allies', '1 Ally (Dead)', 'All Allies (Dead)', 'The User',
];
const OCCASION_OPTIONS = ['Always', 'Only in Battle', 'Only from Menu', 'Never'];
const HIT_TYPE_OPTIONS = ['Certain Hit', 'Physical Attack', 'Magical Attack'];
const ITEM_TYPE_OPTIONS = ['Regular Item', 'Key Item', 'Hidden Item A', 'Hidden Item B'];

const selectStyle: React.CSSProperties = { background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13, width: '100%' };

export default function ItemsTab({ data, onChange }: ItemsTabProps) {
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);
  const [animations, setAnimations] = useState<RefItem[]>([]);

  useEffect(() => {
    apiClient.get<(RefItem | null)[]>('/database/animations').then(d => {
      setAnimations(d.filter(Boolean) as RefItem[]);
    }).catch(() => {});
  }, []);

  const handleFieldChange = (field: keyof Item, value: unknown) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange(newData);
  };

  const handleAddNew = () => {
    if (!data) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newItem: Item = {
      id: maxId + 1, name: '', iconIndex: 0, description: '', itypeId: 1,
      price: 0, consumable: true, scope: 0, occasion: 0, speed: 0,
      successRate: 100, repeats: 1, tpGain: 0, hitType: 0, animationId: 0,
      damage: { type: 0, elementId: 0, formula: '', variance: 20, critical: false },
      effects: [], note: '',
    };
    const newData = [...data];
    while (newData.length <= maxId + 1) newData.push(null);
    newData[maxId + 1] = newItem;
    onChange(newData);
    setSelectedId(maxId + 1);
  };

  return (
    <div className="db-tab-layout">
      <div className="db-list">
        <div className="db-list-header">
          <button className="db-btn-small" onClick={handleAddNew}>+</button>
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
              <input type="text" value={selectedItem.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} />
            </label>
            <div className="db-form-row">
              <label>
                Icon
                <IconPicker value={selectedItem.iconIndex || 0} onChange={(v) => handleFieldChange('iconIndex', v)} />
              </label>
            </div>
            <label>
              Description
              <textarea value={selectedItem.description || ''} onChange={(e) => handleFieldChange('description', e.target.value)} rows={2} />
            </label>
            <label>
              Item Type
              <select value={selectedItem.itypeId || 1} onChange={(e) => handleFieldChange('itypeId', Number(e.target.value))}>
                {ITEM_TYPE_OPTIONS.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
              </select>
            </label>
            <label>
              Price
              <input type="number" value={selectedItem.price || 0} onChange={(e) => handleFieldChange('price', Number(e.target.value))} min={0} />
            </label>
            <label className="db-checkbox-label">
              <input type="checkbox" checked={selectedItem.consumable ?? true} onChange={(e) => handleFieldChange('consumable', e.target.checked)} />
              Consumable
            </label>
            <label>
              Scope
              <select value={selectedItem.scope || 0} onChange={(e) => handleFieldChange('scope', Number(e.target.value))}>
                {SCOPE_OPTIONS.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </label>
            <label>
              Occasion
              <select value={selectedItem.occasion || 0} onChange={(e) => handleFieldChange('occasion', Number(e.target.value))}>
                {OCCASION_OPTIONS.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </label>

            <div className="db-form-section">Invocation</div>
            <label>
              Speed
              <input type="number" value={selectedItem.speed || 0} onChange={(e) => handleFieldChange('speed', Number(e.target.value))} />
            </label>
            <label>
              Success Rate
              <input type="number" value={selectedItem.successRate ?? 100} onChange={(e) => handleFieldChange('successRate', Number(e.target.value))} min={0} max={100} />
            </label>
            <label>
              Repeats
              <input type="number" value={selectedItem.repeats || 1} onChange={(e) => handleFieldChange('repeats', Number(e.target.value))} min={1} />
            </label>
            <label>
              TP Gain
              <input type="number" value={selectedItem.tpGain || 0} onChange={(e) => handleFieldChange('tpGain', Number(e.target.value))} />
            </label>
            <label>
              Hit Type
              <select value={selectedItem.hitType || 0} onChange={(e) => handleFieldChange('hitType', Number(e.target.value))}>
                {HIT_TYPE_OPTIONS.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </label>
            <label>
              Animation
              <select value={selectedItem.animationId || 0} onChange={(e) => handleFieldChange('animationId', Number(e.target.value))} style={selectStyle}>
                <option value={0}>(None)</option>
                {animations.map(a => <option key={a.id} value={a.id}>{String(a.id).padStart(4, '0')}: {a.name}</option>)}
              </select>
            </label>

            <DamageEditor
              damage={selectedItem.damage || { type: 0, elementId: 0, formula: '', variance: 20, critical: false }}
              onChange={(d) => handleFieldChange('damage', d)}
            />

            <EffectsEditor
              effects={selectedItem.effects || []}
              onChange={(e) => handleFieldChange('effects', e)}
            />

            <label>
              Note
              <textarea value={selectedItem.note || ''} onChange={(e) => handleFieldChange('note', e.target.value)} rows={3} />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
