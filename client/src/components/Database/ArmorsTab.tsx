import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Armor, Trait } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import TraitsEditor from '../common/TraitsEditor';
import TranslateButton from '../common/TranslateButton';
import DatabaseList from './DatabaseList';
import DbParamsGrid from './DbParamsGrid';
import apiClient from '../../api/client';
import { useDatabaseTab } from './useDatabaseTab';

function createNewArmor(id: number): Armor {
  return {
    id, name: '', iconIndex: 0, description: '',
    atypeId: 0, etypeId: 2, params: [0, 0, 0, 0, 0, 0, 0, 0],
    price: 0, traits: [], note: '',
  };
}

function deepCopyArmor(source: Armor): Partial<Armor> {
  return {
    params: [...source.params],
    traits: source.traits.map((t: Trait) => ({ ...t })),
  };
}

interface ArmorsTabProps {
  data: (Armor | null)[] | undefined;
  onChange: (data: (Armor | null)[]) => void;
}

export default function ArmorsTab({ data, onChange }: ArmorsTabProps) {
  const { t } = useTranslation();
  const { selectedId, setSelectedId, selectedItem, handleFieldChange, handleAdd, handleDelete, handleDuplicate, handleReorder } =
    useDatabaseTab(data, onChange, createNewArmor, deepCopyArmor);
  const [armorTypes, setArmorTypes] = useState<string[]>([]);
  const [equipTypes, setEquipTypes] = useState<string[]>([]);

  useEffect(() => {
    apiClient.get<{ armorTypes?: string[]; equipTypes?: string[] }>('/database/system').then(sys => {
      if (sys.armorTypes) setArmorTypes(sys.armorTypes);
      if (sys.equipTypes) setEquipTypes(sys.equipTypes);
    }).catch(() => {});
  }, []);

  const handleParamChange = (index: number, value: number) => {
    const params = [...(selectedItem?.params || [0, 0, 0, 0, 0, 0, 0, 0])];
    params[index] = value;
    handleFieldChange('params', params);
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
        title={t('database.tabs.armors')}
      />

      {selectedItem && (
        <div className="db-form-columns">
          <div className="db-form-col">
            <div className="db-form-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
              {t('skills.generalSettings')}
            </div>

            <div className="db-form-row">
              <label style={{ flex: 2 }}>
                {t('common.name')}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="text" value={selectedItem.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} style={{ flex: 1 }} />
                  <TranslateButton csvPath="database/armors.csv" entryKey={`${selectedItem.id}.name`} sourceText={selectedItem.name || ''} />
                </div>
              </label>
              <div className="db-form-field-label" style={{ flex: 0, minWidth: 'fit-content' }}>
                {t('common.icon')}
                <IconPicker value={selectedItem.iconIndex || 0} onChange={(v) => handleFieldChange('iconIndex', v)} />
              </div>
            </div>

            <label>
              {t('common.description')}
              <div style={{ display: 'flex', gap: 4, alignItems: 'start' }}>
                <textarea value={selectedItem.description || ''} onChange={(e) => handleFieldChange('description', e.target.value)} rows={2} style={{ flex: 1 }} />
                <TranslateButton csvPath="database/armors.csv" entryKey={`${selectedItem.id}.description`} sourceText={selectedItem.description || ''} />
              </div>
            </label>

            <div className="db-form-row">
              <label>
                {t('fields.armorType')}
                <select value={selectedItem.atypeId || 0} onChange={(e) => handleFieldChange('atypeId', Number(e.target.value))}>
                  {armorTypes.map((name, i) => name ? <option key={i} value={i}>{String(i).padStart(2, '0')}: {name}</option> : null)}
                  {armorTypes.length === 0 && <option value={selectedItem.atypeId || 0}>{selectedItem.atypeId}</option>}
                </select>
              </label>
              <label>
                {t('common.price')}
                <input type="number" value={selectedItem.price || 0} onChange={(e) => handleFieldChange('price', Number(e.target.value))} min={0} />
              </label>
            </div>

            <label>
              {t('fields.equipType')}
              <select value={selectedItem.etypeId || 0} onChange={(e) => handleFieldChange('etypeId', Number(e.target.value))}>
                {equipTypes.map((name, i) => name ? <option key={i} value={i}>{String(i).padStart(2, '0')}: {name}</option> : null)}
                {equipTypes.length === 0 && <option value={selectedItem.etypeId || 0}>{selectedItem.etypeId}</option>}
              </select>
            </label>

            <div className="db-form-section">{t('fields.parameters')}</div>

            <DbParamsGrid params={selectedItem.params || [0, 0, 0, 0, 0, 0, 0, 0]} onChange={handleParamChange} />
          </div>

          <div className="db-form-col">
            <div className="db-form-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
              {t('fields.traits')}
            </div>

            <TraitsEditor
              traits={selectedItem.traits || []}
              onChange={(traits: Trait[]) => handleFieldChange('traits', traits)}
            />

            <div className="db-form-section">{t('common.note')}</div>

            <textarea
              className="db-note-textarea"
              value={selectedItem.note || ''}
              onChange={(e) => handleFieldChange('note', e.target.value)}
              rows={5}
            />
          </div>
        </div>
      )}
    </div>
  );
}
