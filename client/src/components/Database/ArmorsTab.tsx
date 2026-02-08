import React, { useState } from 'react';
import type { Armor, Trait } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import TraitsEditor from '../common/TraitsEditor';

interface ArmorsTabProps {
  data: (Armor | null)[] | undefined;
  onChange: (data: (Armor | null)[]) => void;
}

const PARAM_NAMES = ['Max HP', 'Max MP', 'Attack', 'Defense', 'M.Attack', 'M.Defense', 'Agility', 'Luck'];

export default function ArmorsTab({ data, onChange }: ArmorsTabProps) {
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);

  const handleFieldChange = (field: keyof Armor, value: unknown) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange(newData);
  };

  const handleParamChange = (index: number, value: number) => {
    const params = [...(selectedItem?.params || [0, 0, 0, 0, 0, 0, 0, 0])];
    params[index] = value;
    handleFieldChange('params', params);
  };

  const handleAddNew = () => {
    if (!data) return;
    const existingItems = data.filter(Boolean) as Armor[];
    const maxId = existingItems.length > 0 ? Math.max(...existingItems.map((i) => i.id)) : 0;
    const newId = maxId + 1;
    const newArmor: Armor = {
      id: newId,
      name: '',
      iconIndex: 0,
      description: '',
      atypeId: 0,
      etypeId: 2,
      params: [0, 0, 0, 0, 0, 0, 0, 0],
      price: 0,
      traits: [],
      note: '',
    };
    onChange([...data, newArmor]);
    setSelectedId(newId);
  };

  return (
    <div className="db-tab-layout">
      <div className="db-list">
        <div className="db-list-header">
          <span>Armors</span>
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
              <input
                type="text"
                value={selectedItem.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
              />
            </label>

            <div className="db-form-row">
              <span className="db-form-label">Icon</span>
              <IconPicker
                value={selectedItem.iconIndex || 0}
                onChange={(v) => handleFieldChange('iconIndex', v)}
              />
            </div>

            <label>
              Description
              <textarea
                value={selectedItem.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                rows={2}
              />
            </label>
            <label>
              Armor Type ID
              <input
                type="number"
                value={selectedItem.atypeId || 0}
                onChange={(e) => handleFieldChange('atypeId', Number(e.target.value))}
              />
            </label>
            <label>
              Equip Type ID
              <input
                type="number"
                value={selectedItem.etypeId || 0}
                onChange={(e) => handleFieldChange('etypeId', Number(e.target.value))}
              />
            </label>
            <label>
              Price
              <input
                type="number"
                value={selectedItem.price || 0}
                onChange={(e) => handleFieldChange('price', Number(e.target.value))}
              />
            </label>

            <div className="db-form-section">Parameters</div>
            {PARAM_NAMES.map((name, i) => (
              <label key={i}>
                {name}
                <input
                  type="number"
                  value={selectedItem.params?.[i] ?? 0}
                  onChange={(e) => handleParamChange(i, Number(e.target.value))}
                />
              </label>
            ))}

            <TraitsEditor
              traits={selectedItem.traits || []}
              onChange={(traits: Trait[]) => handleFieldChange('traits', traits)}
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
