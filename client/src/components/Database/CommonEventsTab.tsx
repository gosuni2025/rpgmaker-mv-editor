import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CommonEvent, EventCommand } from '../../types/rpgMakerMV';
import EventCommandEditor from '../EventEditor/EventCommandEditor';
import DatabaseList from './DatabaseList';
import { useDatabaseTab } from './useDatabaseTab';

interface CommonEventsTabProps {
  data: (CommonEvent | null)[] | undefined;
  onChange: (data: (CommonEvent | null)[]) => void;
}

function createNewCommonEvent(id: number): CommonEvent {
  return {
    id,
    name: '',
    trigger: 0,
    switchId: 1,
    list: [{ code: 0, indent: 0, parameters: [] }],
  };
}

function deepCopyCommonEvent(source: CommonEvent): Partial<CommonEvent> {
  return { list: source.list.map(c => ({ ...c, parameters: [...c.parameters] })) };
}

export default function CommonEventsTab({ data, onChange }: CommonEventsTabProps) {
  const { t } = useTranslation();
  const TRIGGER_OPTIONS = [t('triggerOptions.none'), t('triggerOptions.autorun'), t('triggerOptions.parallel')];

  const {
    selectedId, setSelectedId, selectedItem,
    handleFieldChange, handleAdd, handleDelete, handleDuplicate, handleReorder,
  } = useDatabaseTab(data, onChange, createNewCommonEvent, deepCopyCommonEvent);

  const handleCommandsChange = (commands: EventCommand[]) => {
    handleFieldChange('list', commands);
  };

  return (
    <div className="db-tab-layout">
      <DatabaseList
        items={data}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={handleAdd}
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
