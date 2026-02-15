import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Enemy, DropItem, EnemyAction } from '../../types/rpgMakerMV';
import ImagePicker from '../common/ImagePicker';
import TraitsEditor from '../common/TraitsEditor';
import TranslateButton from '../common/TranslateButton';
import { DataListPicker, IconSprite } from '../EventEditor/dataListPicker';
import apiClient from '../../api/client';

interface EnemiesTabProps {
  data: (Enemy | null)[] | undefined;
  onChange: (data: (Enemy | null)[]) => void;
}

interface RefItem { id: number; name: string; iconIndex?: number }
const selectStyle: React.CSSProperties = { background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13, width: '100%' };

export default function EnemiesTab({ data, onChange }: EnemiesTabProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);
  const [skills, setSkills] = useState<RefItem[]>([]);
  const [items, setItems] = useState<RefItem[]>([]);
  const [weapons, setWeapons] = useState<RefItem[]>([]);
  const [armors, setArmors] = useState<RefItem[]>([]);

  const PARAM_NAMES = [t('params.maxHP'), t('params.maxMP'), t('params.attack'), t('params.defense'), t('params.mAttack'), t('params.mDefense'), t('params.agility'), t('params.luck')];

  const skillNames = useMemo(() => {
    const arr: string[] = [];
    for (const s of skills) arr[s.id] = s.name;
    return arr;
  }, [skills]);

  const skillIcons = useMemo(() => {
    const arr: (number | undefined)[] = [];
    for (const s of skills) arr[s.id] = s.iconIndex;
    return arr;
  }, [skills]);

  const DROP_KIND_LABELS: Record<number, string> = { 0: t('dropKind.none'), 1: t('dropKind.item'), 2: t('dropKind.weapon'), 3: t('dropKind.armor') };

  const CONDITION_TYPE_LABELS: Record<number, string> = {
    0: t('conditionType.always'),
    1: t('conditionType.turn'),
    2: t('conditionType.hp'),
    3: t('conditionType.mp'),
    4: t('conditionType.state'),
    5: t('conditionType.partyLevel'),
    6: t('conditionType.switch'),
  };

  const [skillPickerIndex, setSkillPickerIndex] = useState<number | null>(null);

  useEffect(() => {
    apiClient.get<({ id: number; name: string; iconIndex?: number } | null)[]>('/database/skills').then(d => {
      setSkills(d.filter(Boolean).map(s => ({ id: s!.id, name: s!.name, iconIndex: s!.iconIndex })) as RefItem[]);
    }).catch(() => {});
    apiClient.get<(RefItem | null)[]>('/database/items').then(d => setItems(d.filter(Boolean) as RefItem[])).catch(() => {});
    apiClient.get<(RefItem | null)[]>('/database/weapons').then(d => setWeapons(d.filter(Boolean) as RefItem[])).catch(() => {});
    apiClient.get<(RefItem | null)[]>('/database/armors').then(d => setArmors(d.filter(Boolean) as RefItem[])).catch(() => {});
  }, []);

  const handleFieldChange = (field: keyof Enemy, value: unknown) => {
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

  const handleDropItemChange = (index: number, field: keyof DropItem, value: number) => {
    const dropItems = [...(selectedItem?.dropItems || [])];
    dropItems[index] = { ...dropItems[index], [field]: value };
    handleFieldChange('dropItems', dropItems);
  };

  const addDropItem = () => {
    const dropItems = [...(selectedItem?.dropItems || []), { kind: 0, dataId: 1, denominator: 1 }];
    handleFieldChange('dropItems', dropItems);
  };

  const removeDropItem = (index: number) => {
    const dropItems = (selectedItem?.dropItems || []).filter((_: unknown, i: number) => i !== index);
    handleFieldChange('dropItems', dropItems);
  };

  const handleActionChange = (index: number, field: keyof EnemyAction, value: number) => {
    const actions = [...(selectedItem?.actions || [])];
    actions[index] = { ...actions[index], [field]: value };
    handleFieldChange('actions', actions);
  };

  const addAction = () => {
    const actions = [...(selectedItem?.actions || []), {
      conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1,
    }];
    handleFieldChange('actions', actions);
  };

  const removeAction = (index: number) => {
    const actions = (selectedItem?.actions || []).filter((_: unknown, i: number) => i !== index);
    handleFieldChange('actions', actions);
  };

  const addNewEnemy = () => {
    if (!data) return;
    const existing = data.filter(Boolean) as Enemy[];
    const maxId = existing.length > 0 ? Math.max(...existing.map(e => e.id)) : 0;
    const newEnemy: Enemy = {
      id: maxId + 1,
      name: '',
      battlerName: '',
      battlerHue: 0,
      params: [100, 0, 10, 10, 10, 10, 10, 10],
      exp: 0,
      gold: 0,
      dropItems: [
        { kind: 0, dataId: 1, denominator: 1 },
        { kind: 0, dataId: 1, denominator: 1 },
        { kind: 0, dataId: 1, denominator: 1 },
      ],
      actions: [{ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1 }],
      traits: [],
      note: '',
    };
    const newData = [...data, newEnemy];
    onChange(newData);
    setSelectedId(newEnemy.id);
  };

  return (
    <div className="db-tab-layout">
      <div className="db-list">
        <div className="db-list-header">
          <button className="db-btn-small" onClick={addNewEnemy}>+</button>
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
                <TranslateButton csvPath="database/enemies.csv" entryKey={`${selectedItem.id}.name`} sourceText={selectedItem.name || ''} />
              </div>
            </label>

            <div className="db-form-section">{t('fields.battlerImage')}</div>
            <ImagePicker
              type="enemies"
              value={selectedItem.battlerName || ''}
              onChange={(name) => handleFieldChange('battlerName', name)}
            />
            <label>
              {t('fields.battlerHue')}
              <input
                type="number"
                min={0}
                max={360}
                value={selectedItem.battlerHue || 0}
                onChange={(e) => handleFieldChange('battlerHue', Number(e.target.value))}
              />
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

            <label>
              {t('fields.exp')}
              <input
                type="number"
                value={selectedItem.exp || 0}
                onChange={(e) => handleFieldChange('exp', Number(e.target.value))}
              />
            </label>
            <label>
              {t('fields.gold')}
              <input
                type="number"
                value={selectedItem.gold || 0}
                onChange={(e) => handleFieldChange('gold', Number(e.target.value))}
              />
            </label>

            <div className="db-form-section">
              {t('fields.dropItems')}
              <button className="db-btn-small" onClick={addDropItem}>+</button>
            </div>
            {(selectedItem.dropItems || []).map((drop: DropItem, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ flex: 1 }}>
                  {t('fields.kind')}
                  <select
                    value={drop.kind}
                    onChange={(e) => handleDropItemChange(i, 'kind', Number(e.target.value))}
                    style={{ background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13, width: '100%' }}
                  >
                    {Object.entries(DROP_KIND_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ flex: 1 }}>
                  {t('fields.item')}
                  <select value={drop.dataId} onChange={(e) => handleDropItemChange(i, 'dataId', Number(e.target.value))} style={selectStyle}>
                    <option value={0}>{t('common.none')}</option>
                    {(drop.kind === 1 ? items : drop.kind === 2 ? weapons : drop.kind === 3 ? armors : []).map(it =>
                      <option key={it.id} value={it.id}>{it.name}</option>
                    )}
                  </select>
                </label>
                <label style={{ flex: 1 }}>
                  {t('fields.probability')}
                  <input type="number" value={drop.denominator} min={1} onChange={(e) => handleDropItemChange(i, 'denominator', Number(e.target.value))} />
                </label>
                <button className="db-btn-small" onClick={() => removeDropItem(i)}>-</button>
              </div>
            ))}

            <div className="db-form-section">
              {t('fields.actionPatterns')}
              <button className="db-btn-small" onClick={addAction}>+</button>
            </div>
            {(selectedItem.actions || []).map((action: EnemyAction, i: number) => {
              const actionSkill = skills.find(s => s.id === action.skillId);
              const actionSkillLabel = actionSkill ? `${String(action.skillId).padStart(4, '0')}: ${actionSkill.name}` : action.skillId === 0 ? t('common.none') : String(action.skillId);
              return (
              <div key={i} style={{ border: '1px solid #444', borderRadius: 4, padding: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ flex: 2 }}>
                    {t('fields.skill')}
                    <button className="db-picker-btn" onClick={() => setSkillPickerIndex(i)}>
                      {actionSkill?.iconIndex != null && actionSkill.iconIndex > 0 && <IconSprite iconIndex={actionSkill.iconIndex} />}
                      <span>{actionSkillLabel}</span>
                    </button>
                  </label>
                  <label style={{ flex: 1 }}>
                    {t('fields.rating')}
                    <input type="number" value={action.rating} min={1} max={9} onChange={(e) => handleActionChange(i, 'rating', Number(e.target.value))} />
                  </label>
                  <button className="db-btn-small" onClick={() => removeAction(i)}>-</button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ flex: 1 }}>
                    {t('fields.condition')}
                    <select
                      value={action.conditionType}
                      onChange={(e) => handleActionChange(i, 'conditionType', Number(e.target.value))}
                      style={{ background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13, width: '100%' }}
                    >
                      {Object.entries(CONDITION_TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ flex: 1 }}>
                    {t('fields.param1')}
                    <input type="number" value={action.conditionParam1} onChange={(e) => handleActionChange(i, 'conditionParam1', Number(e.target.value))} />
                  </label>
                  <label style={{ flex: 1 }}>
                    {t('fields.param2')}
                    <input type="number" value={action.conditionParam2} onChange={(e) => handleActionChange(i, 'conditionParam2', Number(e.target.value))} />
                  </label>
                </div>
              </div>
              );
            })}

            <div className="db-form-section">{t('fields.traits')}</div>
            <TraitsEditor
              traits={selectedItem.traits || []}
              onChange={(traits) => handleFieldChange('traits', traits)}
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

      {skillPickerIndex !== null && selectedItem && (
        <DataListPicker
          items={skillNames}
          value={(selectedItem.actions || [])[skillPickerIndex]?.skillId ?? 0}
          onChange={(id) => {
            handleActionChange(skillPickerIndex, 'skillId', id);
          }}
          onClose={() => setSkillPickerIndex(null)}
          title={t('fields.skill') + ' 선택'}
          iconIndices={skillIcons}
        />
      )}
    </div>
  );
}
