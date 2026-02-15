import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TilesetData } from '../../types/rpgMakerMV';
import ImagePicker from '../common/ImagePicker';
import TileFlagsEditor from './TileFlagsEditor';
import DatabaseList from './DatabaseList';

interface TilesetsTabProps {
  data: (TilesetData | null)[] | undefined;
  onChange: (data: (TilesetData | null)[]) => void;
}

const TILESET_LABELS = ['A1', 'A2', 'A3', 'A4', 'A5', 'B', 'C', 'D', 'E'];

export default function TilesetsTab({ data, onChange }: TilesetsTabProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(1);
  const MODE_OPTIONS = [t('tilesetMode.field'), t('tilesetMode.area')];
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

  const handleAddNew = useCallback(() => {
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
  }, [data, onChange]);

  const handleDelete = useCallback((id: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as TilesetData[];
    if (items.length <= 1) return;
    const newData = data.filter((item) => !item || item.id !== id);
    onChange(newData);
    if (id === selectedId) {
      const remaining = newData.filter(Boolean) as TilesetData[];
      if (remaining.length > 0) setSelectedId(remaining[0].id);
    }
  }, [data, onChange, selectedId]);

  const handleDuplicate = useCallback((id: number) => {
    if (!data) return;
    const source = data.find((item) => item && item.id === id);
    if (!source) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newId = maxId + 1;
    const newData = [...data, { ...source, id: newId, tilesetNames: [...source.tilesetNames], flags: [...source.flags] }];
    onChange(newData);
    setSelectedId(newId);
  }, [data, onChange]);

  const handleReorder = useCallback((fromId: number, toId: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as TilesetData[];
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
        onAdd={handleAddNew}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onReorder={handleReorder}
      />
      <div className="db-form">
        {selectedItem && (
          <>
            <label>
              {t('common.name')}
              <input
                type="text"
                value={selectedItem.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
              />
            </label>
            <label>
              {t('menu.mode')}
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

            <div className="db-form-section">{t('fields.tilesetImages')}</div>
            {TILESET_LABELS.map((label, i) => (
              <label key={i}>
                {label}
                <ImagePicker
                  type="tilesets"
                  value={(selectedItem.tilesetNames || [])[i] || ''}
                  onChange={(name) => handleTilesetNameChange(i, name)}
                />
              </label>
            ))}

            <TileFlagsEditor
              flags={selectedItem.flags || []}
              tilesetNames={selectedItem.tilesetNames || Array(9).fill('')}
              onChange={(flags) => handleFieldChange('flags', flags)}
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
