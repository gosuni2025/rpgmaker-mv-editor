import React, { useState } from 'react';
import type { QuestCategory } from '../../types/rpgMakerMV';

export interface CategoryManagerProps {
  categories: QuestCategory[];
  onChange: (cats: QuestCategory[]) => void;
}

export function CategoryManager({ categories, onChange }: CategoryManagerProps) {
  const [newCatId, setNewCatId] = useState('');
  const [newCatName, setNewCatName] = useState('');

  const addCategory = () => {
    if (!newCatId.trim() || !newCatName.trim()) return;
    onChange([...categories, { id: newCatId.trim(), name: newCatName.trim() }]);
    setNewCatId('');
    setNewCatName('');
  };

  const deleteCat = (id: string) => onChange(categories.filter((c) => c.id !== id));

  const updateName = (id: string, name: string) =>
    onChange(categories.map((c) => c.id === id ? { ...c, name } : c));

  return (
    <div className="qs-cat-manager">
      <div className="qs-cat-header">카테고리 관리</div>
      {categories.map((c) => (
        <div key={c.id} className="qs-cat-row">
          <code className="qs-cat-id">{c.id}</code>
          <input
            type="text"
            value={c.name}
            onChange={(e) => updateName(c.id, e.target.value)}
            style={{ flex: 1 }}
          />
          <button onClick={() => deleteCat(c.id)} className="qs-btn-danger" title="삭제">×</button>
        </div>
      ))}
      <div className="qs-cat-add-row">
        <input
          type="text"
          value={newCatId}
          onChange={(e) => setNewCatId(e.target.value)}
          placeholder="ID (영문)"
          style={{ width: 80 }}
        />
        <input
          type="text"
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          placeholder="표시 이름"
          style={{ flex: 1 }}
        />
        <button onClick={addCategory} className="qs-btn-add">추가</button>
      </div>
    </div>
  );
}
