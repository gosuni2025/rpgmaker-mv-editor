import React, { useState } from 'react';
import type { TilesetData } from '../../types/rpgMakerMV';

interface TilesetsTabProps {
  data: (TilesetData | null)[] | undefined;
  onChange: (data: (TilesetData | null)[]) => void;
}

const TILESET_LABELS = ['A1', 'A2', 'A3', 'A4', 'A5', 'B', 'C', 'D', 'E'];
const MODE_OPTIONS = ['Field', 'Area'];

export default function TilesetsTab({ data, onChange }: TilesetsTabProps) {
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);

  const handleFieldChange = (field: keyof TilesetData, value: unknown) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange(newData);
  };

  const handleTilesetNameChange = (index: number, value: string) => {
    const tilesetNames = [...(selectedItem?.tilesetNames || Array(9).fill(''))];
    tilesetNames[index] = value;
    handleFieldChange('tilesetNames', tilesetNames);
  };

  const handleAddNew = () => {
    if (!data) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newId = maxId + 1;
    const newItem: TilesetData = {
      id: newId,
      name: '',
      mode: 0,
      tilesetNames: Array(9).fill(''),
      flags: [],
      note: '',
    };
    const newData = [...data, newItem];
    onChange(newData);
    setSelectedId(newId);
  };

  return (
    <div className="db-tab-layout">
      <div className="db-list">
        {data?.filter(Boolean).map((item) => (
          <div
            key={item!.id}
            className={`db-list-item${item!.id === selectedId ? ' selected' : ''}`}
            onClick={() => setSelectedId(item!.id)}
          >
            {String(item!.id).padStart(4, '0')}: {item!.name}
          </div>
        ))}
        <button className="db-btn-small" style={{ margin: '4px 8px', width: 'calc(100% - 16px)' }} onClick={handleAddNew}>+ Add</button>
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
              Mode
              <select
                value={selectedItem.mode || 0}
                onChange={(e) => handleFieldChange('mode', Number(e.target.value))}
                style={{ background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13 }}
              >
                {MODE_OPTIONS.map((label, i) => (
                  <option key={i} value={i}>{label}</option>
                ))}
              </select>
            </label>

            <div className="db-form-section">Tileset Images</div>
            {TILESET_LABELS.map((label, i) => (
              <label key={i}>
                {label}
                <input
                  type="text"
                  value={(selectedItem.tilesetNames || [])[i] || ''}
                  onChange={(e) => handleTilesetNameChange(i, e.target.value)}
                />
              </label>
            ))}

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
