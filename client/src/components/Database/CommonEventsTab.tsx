import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommonEvent, EventCommand } from '../../types/rpgMakerMV';
import EventCommandEditor from '../EventEditor/EventCommandEditor';
import DatabaseList from './DatabaseList';

interface CommonEventsTabProps {
  data: (CommonEvent | null)[] | undefined;
  onChange: (data: (CommonEvent | null)[]) => void;
}

export default function CommonEventsTab({ data, onChange }: CommonEventsTabProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(1);
  const TRIGGER_OPTIONS = [t('triggerOptions.none'), t('triggerOptions.autorun'), t('triggerOptions.parallel')];
  const selectedItem = data?.find((item) => item && item.id === selectedId);

  const handleFieldChange = (field: keyof CommonEvent, value: unknown) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange(newData);
  };

  const handleCommandsChange = (commands: EventCommand[]) => {
    handleFieldChange('list', commands);
  };

  const handleAddNew = useCallback(() => {
    if (!data) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newId = maxId + 1;
    const newItem: CommonEvent = {
      id: newId,
      name: '',
      trigger: 0,
      switchId: 1,
      list: [{ code: 0, indent: 0, parameters: [] }],
    };
    const newData = [...data, newItem];
    onChange(newData);
    setSelectedId(newId);
  }, [data, onChange]);

  const handleDelete = useCallback((id: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as CommonEvent[];
    if (items.length <= 1) return;
    const newData = data.filter((item) => !item || item.id !== id);
    onChange(newData);
    if (id === selectedId) {
      const remaining = newData.filter(Boolean) as CommonEvent[];
      if (remaining.length > 0) setSelectedId(remaining[0].id);
    }
  }, [data, onChange, selectedId]);

  const handleDuplicate = useCallback((id: number) => {
    if (!data) return;
    const source = data.find((item) => item && item.id === id);
    if (!source) return;
    const maxId = data.reduce((max, item) => (item && item.id > max ? item.id : max), 0);
    const newId = maxId + 1;
    const newData = [...data, { ...source, id: newId, list: source.list.map(c => ({ ...c, parameters: [...c.parameters] })) }];
    onChange(newData);
    setSelectedId(newId);
  }, [data, onChange]);

  const handleReorder = useCallback((fromId: number, toId: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as CommonEvent[];
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
              {t('fields.trigger')}
              <select
                value={selectedItem.trigger || 0}
                onChange={(e) => handleFieldChange('trigger', Number(e.target.value))}
                style={{ background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13 }}
              >
                {TRIGGER_OPTIONS.map((label, i) => (
                  <option key={i} value={i}>{label}</option>
                ))}
              </select>
            </label>
            {(selectedItem.trigger === 1 || selectedItem.trigger === 2) && (
              <label>
                {t('fields.switchId')}
                <input
                  type="number"
                  min={1}
                  value={selectedItem.switchId || 1}
                  onChange={(e) => handleFieldChange('switchId', Number(e.target.value))}
                />
              </label>
            )}

            <EventCommandEditor
              commands={selectedItem.list || [{ code: 0, indent: 0, parameters: [] }]}
              onChange={handleCommandsChange}
              context={{ isCommonEvent: true, commonEventId: selectedItem.id }}
            />
          </>
        )}
      </div>
    </div>
  );
}
