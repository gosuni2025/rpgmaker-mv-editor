import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Weapon, Trait } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import TraitsEditor from '../common/TraitsEditor';
import TranslateButton from '../common/TranslateButton';
import AnimationPickerDialog from '../EventEditor/AnimationPickerDialog';
import DatabaseList from './DatabaseList';
import DbParamsGrid from './DbParamsGrid';
import apiClient from '../../api/client';
import { useDatabaseTab } from './useDatabaseTab';
import { useDbRef } from './useDbRef';

function createNewWeapon(id: number): Weapon {
  return {
    id, name: '', iconIndex: 0, description: '',
    wtypeId: 0, etypeId: 1, params: [0, 0, 0, 0, 0, 0, 0, 0],
    price: 0, animationId: 0, traits: [], note: '',
  };
}

function deepCopyWeapon(source: Weapon): Partial<Weapon> {
  return {
    params: [...source.params],
    traits: source.traits.map((t: Trait) => ({ ...t })),
  };
}

interface WeaponsTabProps {
  data: (Weapon | null)[] | undefined;
  onChange: (data: (Weapon | null)[]) => void;
}

export default function WeaponsTab({ data, onChange }: WeaponsTabProps) {
  const { t } = useTranslation();
  const { selectedId, setSelectedId, selectedItem, handleFieldChange, handleAdd, handleDelete, handleDuplicate, handleReorder } =
    useDatabaseTab(data, onChange, createNewWeapon, deepCopyWeapon);
  const [weaponTypes, setWeaponTypes] = useState<string[]>([]);
  const animations = useDbRef('/database/animations');
  const [showAnimPicker, setShowAnimPicker] = useState(false);

  useEffect(() => {
    apiClient.get<{ weaponTypes?: string[] }>('/database/system').then(sys => {
      if (sys.weaponTypes) setWeaponTypes(sys.weaponTypes);
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
        title={t('database.tabs.weapons')}
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
                  <TranslateButton csvPath="database/weapons.csv" entryKey={`${selectedItem.id}.name`} sourceText={selectedItem.name || ''} />
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
                <TranslateButton csvPath="database/weapons.csv" entryKey={`${selectedItem.id}.description`} sourceText={selectedItem.description || ''} />
              </div>
            </label>

            <div className="db-form-row">
              <label>
                {t('fields.weaponType')}
                <select value={selectedItem.wtypeId || 0} onChange={(e) => handleFieldChange('wtypeId', Number(e.target.value))}>
                  {weaponTypes.map((name, i) => name ? <option key={i} value={i}>{String(i).padStart(2, '0')}: {name}</option> : null)}
                  {weaponTypes.length === 0 && <option value={selectedItem.wtypeId || 0}>{selectedItem.wtypeId}</option>}
                </select>
              </label>
              <label>
                {t('common.price')}
                <input type="number" value={selectedItem.price || 0} onChange={(e) => handleFieldChange('price', Number(e.target.value))} min={0} />
              </label>
            </div>

            <label>
              {t('common.animation')}
              <button className="db-picker-btn" onClick={() => setShowAnimPicker(true)}>
                {selectedItem.animationId === -1 ? t('common.normalAttack') :
                 selectedItem.animationId === 0 || selectedItem.animationId == null ? t('common.none') :
                 `${String(selectedItem.animationId).padStart(4, '0')}: ${animations.find(a => a.id === selectedItem.animationId)?.name || ''}`}
              </button>
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

      {showAnimPicker && selectedItem && (
        <AnimationPickerDialog
          value={selectedItem.animationId ?? 0}
          onChange={(id) => handleFieldChange('animationId', id)}
          onClose={() => setShowAnimPicker(false)}
        />
      )}
    </div>
  );
}
