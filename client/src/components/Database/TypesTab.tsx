import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SystemData } from '../../types/rpgMakerMV';

interface TypesTabProps {
  data: SystemData | undefined;
  onChange: (data: SystemData) => void;
}

type TypeCategory = 'elements' | 'skillTypes' | 'weaponTypes' | 'armorTypes' | 'equipTypes';

export default function TypesTab({ data, onChange }: TypesTabProps) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<TypeCategory>('elements');

  const CATEGORIES: { key: TypeCategory; labelKey: string }[] = [
    { key: 'elements', labelKey: 'typeCategories.elements' },
    { key: 'skillTypes', labelKey: 'typeCategories.skillTypes' },
    { key: 'weaponTypes', labelKey: 'typeCategories.weaponTypes' },
    { key: 'armorTypes', labelKey: 'typeCategories.armorTypes' },
    { key: 'equipTypes', labelKey: 'typeCategories.equipTypes' },
  ];

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

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 1 || target >= items.length) return; // Don't swap with index 0 (null entry)
    if (index < 1) return;
    const newItems = [...items];
    [newItems[index], newItems[target]] = [newItems[target], newItems[index]];
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
            {t(cat.labelKey)}
          </div>
        ))}
      </div>
      <div className="db-form">
        <div className="db-form-section">
          {t(CATEGORIES.find((c) => c.key === activeCategory)?.labelKey || '')}
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
              <>
                <button className="db-btn-small" onClick={() => moveItem(i, -1)} disabled={i <= 1} title={t('eventCommands.moveUp')}>&uarr;</button>
                <button className="db-btn-small" onClick={() => moveItem(i, 1)} disabled={i >= items.length - 1} title={t('eventCommands.moveDown')}>&darr;</button>
                <button className="db-btn-small" onClick={() => removeItem(i)}>-</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
