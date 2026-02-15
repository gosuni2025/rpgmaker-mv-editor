import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Armor, Trait } from '../../types/rpgMakerMV';
import IconPicker from '../common/IconPicker';
import TraitsEditor from '../common/TraitsEditor';
import TranslateButton from '../common/TranslateButton';
import apiClient from '../../api/client';

interface ArmorsTabProps {
  data: (Armor | null)[] | undefined;
  onChange: (data: (Armor | null)[]) => void;
}

export default function ArmorsTab({ data, onChange }: ArmorsTabProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);
  const [armorTypes, setArmorTypes] = useState<string[]>([]);
  const [equipTypes, setEquipTypes] = useState<string[]>([]);

  const PARAM_NAMES = [t('params.maxHP'), t('params.maxMP'), t('params.attack'), t('params.defense'), t('params.mAttack'), t('params.mDefense'), t('params.agility'), t('params.luck')];

  useEffect(() => {
    apiClient.get<{ armorTypes?: string[]; equipTypes?: string[] }>('/database/system').then(sys => {
      if (sys.armorTypes) setArmorTypes(sys.armorTypes);
      if (sys.equipTypes) setEquipTypes(sys.equipTypes);
    }).catch(() => {});
  }, []);

  const handleFieldChange = (field: keyof Armor, value: unknown) => {
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
    const existingItems = data.filter(Boolean) as Armor[];
    const maxId = existingItems.length > 0 ? Math.max(...existingItems.map((i) => i.id)) : 0;
    const newId = maxId + 1;
    const newArmor: Armor = {
      id: newId, name: '', iconIndex: 0, description: '',
      atypeId: 0, etypeId: 2, params: [0, 0, 0, 0, 0, 0, 0, 0],
      price: 0, traits: [], note: '',
    };
    onChange([...data, newArmor]);
    setSelectedId(newId);
  };

  return (
    <div className="db-tab-layout">
      {/* 좌측: 방어구 목록 */}
      <div className="db-list">
        <div className="db-list-header">
          <span>{t('database.tabs.armors')}</span>
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
                  <TranslateButton csvPath="database/armors.csv" entryKey={`${selectedItem.id}.name`} sourceText={selectedItem.name || ''} />
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
                <TranslateButton csvPath="database/armors.csv" entryKey={`${selectedItem.id}.description`} sourceText={selectedItem.description || ''} />
              </div>
            </label>

            {/* 방어구 유형 / 가격 */}
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
                <input
                  type="number"
                  value={selectedItem.price || 0}
                  onChange={(e) => handleFieldChange('price', Number(e.target.value))}
                  min={0}
                />
              </label>
            </div>

            {/* 장비 유형 */}
            <label>
              {t('fields.equipType')}
              <select value={selectedItem.etypeId || 0} onChange={(e) => handleFieldChange('etypeId', Number(e.target.value))}>
                {equipTypes.map((name, i) => name ? <option key={i} value={i}>{String(i).padStart(2, '0')}: {name}</option> : null)}
                {equipTypes.length === 0 && <option value={selectedItem.etypeId || 0}>{selectedItem.etypeId}</option>}
              </select>
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
    </div>
  );
}
