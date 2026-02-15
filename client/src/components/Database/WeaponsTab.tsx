import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Weapon, Trait } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import TraitsEditor from '../common/TraitsEditor';
import TranslateButton from '../common/TranslateButton';
import apiClient from '../../api/client';

interface WeaponsTabProps {
  data: (Weapon | null)[] | undefined;
  onChange: (data: (Weapon | null)[]) => void;
}

const selectStyle: React.CSSProperties = { background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13, width: '100%' };

export default function WeaponsTab({ data, onChange }: WeaponsTabProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);
  const [weaponTypes, setWeaponTypes] = useState<string[]>([]);
  const [equipTypes, setEquipTypes] = useState<string[]>([]);
  const [animations, setAnimations] = useState<{ id: number; name: string }[]>([]);

  const PARAM_NAMES = [t('params.maxHP'), t('params.maxMP'), t('params.attack'), t('params.defense'), t('params.mAttack'), t('params.mDefense'), t('params.agility'), t('params.luck')];

  useEffect(() => {
    apiClient.get<{ weaponTypes?: string[]; equipTypes?: string[] }>('/database/system').then(sys => {
      if (sys.weaponTypes) setWeaponTypes(sys.weaponTypes);
      if (sys.equipTypes) setEquipTypes(sys.equipTypes);
    }).catch(() => {});
    apiClient.get<({ id: number; name: string } | null)[]>('/database/animations').then(d => {
      setAnimations((d.filter(Boolean) as { id: number; name: string }[]));
    }).catch(() => {});
  }, []);

  const handleFieldChange = (field: keyof Weapon, value: unknown) => {
    if (!data) return;
    const newData = data.map((item) => {
      if (item && item.id === selectedId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange(newData);
  };

  const handleParamChange = (index: number, value: number) => {
    const params = [...(selectedItem?.params || [0, 0, 0, 0, 0, 0, 0, 0])];
    params[index] = value;
    handleFieldChange('params', params);
  };

  const handleAddNew = () => {
    if (!data) return;
    const existingItems = data.filter(Boolean) as Weapon[];
    const maxId = existingItems.length > 0 ? Math.max(...existingItems.map((i) => i.id)) : 0;
    const newId = maxId + 1;
    const newWeapon: Weapon = {
      id: newId,
      name: '',
      iconIndex: 0,
      description: '',
      wtypeId: 0,
      etypeId: 1,
      params: [0, 0, 0, 0, 0, 0, 0, 0],
      price: 0,
      animationId: 0,
      traits: [],
      note: '',
    };
    onChange([...data, newWeapon]);
    setSelectedId(newId);
  };

  return (
    <div className="db-tab-layout">
      <div className="db-list">
        <div className="db-list-header">
          <span>{t('database.tabs.weapons')}</span>
          <button className="db-btn-small" onClick={handleAddNew}>+</button>
        </div>
        {data?.filter(Boolean).map((item) => (
          <div
            key={item!.id}
            className={`db-list-item${item!.id === selectedId ? ' selected' : ''}`}
            onClick={() => setSelectedId(item!.id)}
          >
            {String(item!.id).padStart(4, '0')}: {item!.name}
          </div>
        ))}
      </div>
      <div className="db-form">
        {selectedItem && (
          <>
            <label>
              {t('common.name')}
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <input
                  type="text"
                  value={selectedItem.name || ''}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  style={{flex:1}}
                />
                <TranslateButton csvPath="database/weapons.csv" entryKey={`${selectedItem.id}.name`} sourceText={selectedItem.name || ''} />
              </div>
            </label>

            <div className="db-form-row">
              <span className="db-form-label">{t('common.icon')}</span>
              <IconPicker
                value={selectedItem.iconIndex || 0}
                onChange={(v) => handleFieldChange('iconIndex', v)}
              />
            </div>

            <label>
              {t('common.description')}
              <div style={{display:'flex',gap:4,alignItems:'start'}}>
                <textarea
                  value={selectedItem.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  rows={2}
                  style={{flex:1}}
                />
                <TranslateButton csvPath="database/weapons.csv" entryKey={`${selectedItem.id}.description`} sourceText={selectedItem.description || ''} />
              </div>
            </label>
            <label>
              {t('fields.weaponType')}
              <select value={selectedItem.wtypeId || 0} onChange={(e) => handleFieldChange('wtypeId', Number(e.target.value))} style={selectStyle}>
                {weaponTypes.map((name, i) => name ? <option key={i} value={i}>{String(i).padStart(2, '0')}: {name}</option> : null)}
                {weaponTypes.length === 0 && <option value={selectedItem.wtypeId || 0}>{selectedItem.wtypeId}</option>}
              </select>
            </label>
            <label>
              {t('fields.equipType')}
              <select value={selectedItem.etypeId || 0} onChange={(e) => handleFieldChange('etypeId', Number(e.target.value))} style={selectStyle}>
                {equipTypes.map((name, i) => name ? <option key={i} value={i}>{String(i).padStart(2, '0')}: {name}</option> : null)}
                {equipTypes.length === 0 && <option value={selectedItem.etypeId || 0}>{selectedItem.etypeId}</option>}
              </select>
            </label>
            <label>
              {t('common.price')}
              <input
                type="number"
                value={selectedItem.price || 0}
                onChange={(e) => handleFieldChange('price', Number(e.target.value))}
              />
            </label>
            <label>
              {t('common.animation')}
              <select value={selectedItem.animationId ?? 0} onChange={(e) => handleFieldChange('animationId', Number(e.target.value))} style={selectStyle}>
                <option value={-1}>{t('common.normalAttack')}</option>
                <option value={0}>{t('common.none')}</option>
                {animations.map(a => <option key={a.id} value={a.id}>{String(a.id).padStart(4, '0')}: {a.name}</option>)}
              </select>
            </label>

            <div className="db-form-section">{t('fields.parameters')}</div>
            {PARAM_NAMES.map((name, i) => (
              <label key={i}>
                {name}
                <input
                  type="number"
                  value={selectedItem.params?.[i] ?? 0}
                  onChange={(e) => handleParamChange(i, Number(e.target.value))}
                />
              </label>
            ))}

            <TraitsEditor
              traits={selectedItem.traits || []}
              onChange={(traits: Trait[]) => handleFieldChange('traits', traits)}
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
