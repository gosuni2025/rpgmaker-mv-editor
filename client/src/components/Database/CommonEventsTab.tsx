import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommonEvent, EventCommand } from '../../types/rpgMakerMV';
import EventCommandEditor from '../EventEditor/EventCommandEditor';

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

  const handleAddNew = () => {
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
        <button className="db-btn-small" style={{ margin: '4px 8px', width: 'calc(100% - 16px)' }} onClick={handleAddNew}>+ {t('common.add')}</button>
      </div>
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
            />
          </>
        )}
      </div>
    </div>
  );
}
