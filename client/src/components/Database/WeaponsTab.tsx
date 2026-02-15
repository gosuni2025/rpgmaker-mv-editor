import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Weapon, Trait } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import TraitsEditor from '../common/TraitsEditor';
import TranslateButton from '../common/TranslateButton';
import AnimationPickerDialog from '../EventEditor/AnimationPickerDialog';
import DatabaseList from './DatabaseList';
import apiClient from '../../api/client';

interface WeaponsTabProps {
  data: (Weapon | null)[] | undefined;
  onChange: (data: (Weapon | null)[]) => void;
}

export default function WeaponsTab({ data, onChange }: WeaponsTabProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);
  const [weaponTypes, setWeaponTypes] = useState<string[]>([]);
  const [equipTypes, setEquipTypes] = useState<string[]>([]);
  const [animations, setAnimations] = useState<{ id: number; name: string }[]>([]);
  const [showAnimPicker, setShowAnimPicker] = useState(false);

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

  const handleAddNew = useCallback(() => {
    if (!data) return;
    const existingItems = data.filter(Boolean) as Weapon[];
    const maxId = existingItems.length > 0 ? Math.max(...existingItems.map((i) => i.id)) : 0;
    const newId = maxId + 1;
    const newWeapon: Weapon = {
      id: newId, name: '', iconIndex: 0, description: '',
      wtypeId: 0, etypeId: 1, params: [0, 0, 0, 0, 0, 0, 0, 0],
      price: 0, animationId: 0, traits: [], note: '',
    };
    onChange([...data, newWeapon]);
    setSelectedId(newId);
  }, [data, onChange]);

  const handleDelete = useCallback((id: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as Weapon[];
    if (items.length <= 1) return;
    const newData = data.filter((item) => !item || item.id !== id);
    onChange(newData);
    if (id === selectedId) {
      const remaining = newData.filter(Boolean) as Weapon[];
      if (remaining.length > 0) setSelectedId(remaining[0].id);
    }
  }, [data, onChange, selectedId]);

  const handleDuplicate = useCallback((id: number) => {
    if (!data) return;
    const source = data.find((item) => item && item.id === id);
    if (!source) return;
    const existingItems = data.filter(Boolean) as Weapon[];
    const maxId = existingItems.length > 0 ? Math.max(...existingItems.map((i) => i.id)) : 0;
    const newId = maxId + 1;
    onChange([...data, { ...source, id: newId, params: [...source.params], traits: source.traits.map(t => ({ ...t })) }]);
    setSelectedId(newId);
  }, [data, onChange]);

  const handleReorder = useCallback((fromId: number, toId: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as Weapon[];
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
        title={t('database.tabs.weapons')}
      />

      {/* 중앙 + 우측: 2컬럼 폼 */}
      {selectedItem && (
        <div className="db-form-columns">
          {/* 중앙 컬럼: 일반 설정 + 능력치 변화량 */}
          <div className="db-form-col">
            <div className="db-form-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
              {t('skills.generalSettings')}
            </div>

            {/* 이름 + 아이콘 */}
            <div className="db-form-row">
              <label style={{ flex: 2 }}>
                {t('common.name')}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={selectedItem.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <TranslateButton csvPath="database/weapons.csv" entryKey={`${selectedItem.id}.name`} sourceText={selectedItem.name || ''} />
                </div>
              </label>
              <div className="db-form-field-label" style={{ flex: 0, minWidth: 'fit-content' }}>
                {t('common.icon')}
                <IconPicker
                  value={selectedItem.iconIndex || 0}
                  onChange={(v) => handleFieldChange('iconIndex', v)}
                />
              </div>
            </div>

            {/* 설명 */}
            <label>
              {t('common.description')}
              <div style={{ display: 'flex', gap: 4, alignItems: 'start' }}>
                <textarea
                  value={selectedItem.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  rows={2}
                  style={{ flex: 1 }}
                />
                <TranslateButton csvPath="database/weapons.csv" entryKey={`${selectedItem.id}.description`} sourceText={selectedItem.description || ''} />
              </div>
            </label>

            {/* 무기 유형 / 가격 */}
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
                <input
                  type="number"
                  value={selectedItem.price || 0}
                  onChange={(e) => handleFieldChange('price', Number(e.target.value))}
                  min={0}
                />
              </label>
            </div>

            {/* 애니메이션 */}
            <label>
              {t('common.animation')}
              <button className="db-picker-btn" onClick={() => setShowAnimPicker(true)}>
                {selectedItem.animationId === -1 ? t('common.normalAttack') :
                 selectedItem.animationId === 0 || selectedItem.animationId == null ? t('common.none') :
                 `${String(selectedItem.animationId).padStart(4, '0')}: ${animations.find(a => a.id === selectedItem.animationId)?.name || ''}`}
              </button>
            </label>

            {/* 능력치 변화량 */}
            <div className="db-form-section">{t('fields.parameters')}</div>

            <div className="db-form-row">
              <label>{PARAM_NAMES[0]}<input type="number" value={selectedItem.params?.[0] ?? 0} onChange={(e) => handleParamChange(0, Number(e.target.value))} /></label>
              <label>{PARAM_NAMES[2]}<input type="number" value={selectedItem.params?.[2] ?? 0} onChange={(e) => handleParamChange(2, Number(e.target.value))} /></label>
              <label>{PARAM_NAMES[4]}<input type="number" value={selectedItem.params?.[4] ?? 0} onChange={(e) => handleParamChange(4, Number(e.target.value))} /></label>
              <label>{PARAM_NAMES[6]}<input type="number" value={selectedItem.params?.[6] ?? 0} onChange={(e) => handleParamChange(6, Number(e.target.value))} /></label>
            </div>
            <div className="db-form-row">
              <label>{PARAM_NAMES[1]}<input type="number" value={selectedItem.params?.[1] ?? 0} onChange={(e) => handleParamChange(1, Number(e.target.value))} /></label>
              <label>{PARAM_NAMES[3]}<input type="number" value={selectedItem.params?.[3] ?? 0} onChange={(e) => handleParamChange(3, Number(e.target.value))} /></label>
              <label>{PARAM_NAMES[5]}<input type="number" value={selectedItem.params?.[5] ?? 0} onChange={(e) => handleParamChange(5, Number(e.target.value))} /></label>
              <label>{PARAM_NAMES[7]}<input type="number" value={selectedItem.params?.[7] ?? 0} onChange={(e) => handleParamChange(7, Number(e.target.value))} /></label>
            </div>
          </div>

          {/* 우측 컬럼: 특성 + 메모 */}
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
              value={selectedItem.note || ''}
              onChange={(e) => handleFieldChange('note', e.target.value)}
              rows={5}
              style={{
                background: '#2b2b2b', border: '1px solid #555', borderRadius: 3,
                padding: '4px 8px', color: '#ddd', fontSize: 13, fontFamily: 'inherit',
                outline: 'none', resize: 'vertical', flex: 1, minHeight: 60,
              }}
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
