import React, { useState } from 'react';
import type { SystemData } from '../../types/rpgMakerMV';

interface TypesTabProps {
  data: SystemData | undefined;
  onChange: (data: SystemData) => void;
}

type TypeCategory = 'elements' | 'skillTypes' | 'weaponTypes' | 'armorTypes' | 'equipTypes';

const CATEGORIES: { key: TypeCategory; label: string }[] = [
  { key: 'elements', label: 'Elements' },
  { key: 'skillTypes', label: 'Skill Types' },
  { key: 'weaponTypes', label: 'Weapon Types' },
  { key: 'armorTypes', label: 'Armor Types' },
  { key: 'equipTypes', label: 'Equip Types' },
];

export default function TypesTab({ data, onChange }: TypesTabProps) {
  const [activeCategory, setActiveCategory] = useState<TypeCategory>('elements');

  if (!data) return null;

  const items = (data[activeCategory] || []) as string[];

  const handleItemChange = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    onChange({ ...data, [activeCategory]: newItems });
  };

  const addItem = () => {
    const newItems = [...items, ''];
    onChange({ ...data, [activeCategory]: newItems });
  };

  const removeItem = (index: number) => {
    if (index === 0) return; // Don't remove null entry at index 0
    const newItems = items.filter((_: string, i: number) => i !== index);
    onChange({ ...data, [activeCategory]: newItems });
  };

  return (
    <div className="db-tab-layout">
      <div className="db-list">
        {CATEGORIES.map((cat) => (
          <div
            key={cat.key}
            className={`db-list-item${activeCategory === cat.key ? ' selected' : ''}`}
            onClick={() => setActiveCategory(cat.key)}
          >
            {cat.label}
          </div>
        ))}
      </div>
      <div className="db-form">
        <div className="db-form-section">
          {CATEGORIES.find((c) => c.key === activeCategory)?.label}
          <button className="db-btn-small" onClick={addItem}>+</button>
        </div>
        {items.map((item: string, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ minWidth: 40, color: '#999', fontSize: 12 }}>{String(i).padStart(4, '0')}</span>
            <input
              type="text"
              value={item || ''}
              onChange={(e) => handleItemChange(i, e.target.value)}
              style={{ flex: 1, background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13 }}
            />
            {i > 0 && (
              <button className="db-btn-small" onClick={() => removeItem(i)}>-</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
