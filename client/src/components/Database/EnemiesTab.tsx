import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Enemy, DropItem, EnemyAction } from '../../types/rpgMakerMV';
import ImagePicker from '../common/ImagePicker';
import TraitsEditor from '../common/TraitsEditor';
import TranslateButton from '../common/TranslateButton';
import { DataListPicker, IconSprite } from '../EventEditor/dataListPicker';
import DatabaseList from './DatabaseList';
import apiClient from '../../api/client';
import './EnemiesTab.css';

interface EnemiesTabProps {
  data: (Enemy | null)[] | undefined;
  onChange: (data: (Enemy | null)[]) => void;
}

interface RefItem { id: number; name: string; iconIndex?: number }

export default function EnemiesTab({ data, onChange }: EnemiesTabProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(1);
  const selectedItem = data?.find((item) => item && item.id === selectedId);
  const [skills, setSkills] = useState<RefItem[]>([]);
  const [items, setItems] = useState<RefItem[]>([]);
  const [weapons, setWeapons] = useState<RefItem[]>([]);
  const [armors, setArmors] = useState<RefItem[]>([]);
  const [selectedActionIndex, setSelectedActionIndex] = useState<number>(-1);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [dropItemPickerIndex, setDropItemPickerIndex] = useState<number | null>(null);
  const [dropDataPickerKind, setDropDataPickerKind] = useState<number | null>(null);

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

  const itemNames = useMemo(() => {
    const arr: string[] = [];
    for (const s of items) arr[s.id] = s.name;
    return arr;
  }, [items]);

  const weaponNames = useMemo(() => {
    const arr: string[] = [];
    for (const s of weapons) arr[s.id] = s.name;
    return arr;
  }, [weapons]);

  const armorNames = useMemo(() => {
    const arr: string[] = [];
    for (const s of armors) arr[s.id] = s.name;
    return arr;
  }, [armors]);

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
    setSelectedActionIndex(actions.length - 1);
  };

  const removeAction = (index: number) => {
    const actions = (selectedItem?.actions || []).filter((_: unknown, i: number) => i !== index);
    handleFieldChange('actions', actions);
    if (selectedActionIndex >= actions.length) setSelectedActionIndex(actions.length - 1);
  };

  const addNewEnemy = useCallback(() => {
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
  }, [data, onChange]);

  const handleDeleteEnemy = useCallback((id: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as Enemy[];
    if (items.length <= 1) return;
    const newData = data.filter((item) => !item || item.id !== id);
    onChange(newData);
    if (id === selectedId) {
      const remaining = newData.filter(Boolean) as Enemy[];
      if (remaining.length > 0) setSelectedId(remaining[0].id);
    }
  }, [data, onChange, selectedId]);

  const handleDuplicate = useCallback((id: number) => {
    if (!data) return;
    const source = data.find((item) => item && item.id === id);
    if (!source) return;
    const existing = data.filter(Boolean) as Enemy[];
    const maxId = existing.length > 0 ? Math.max(...existing.map(e => e.id)) : 0;
    const newId = maxId + 1;
    const newData = [...data, {
      ...source,
      id: newId,
      params: [...source.params],
      dropItems: source.dropItems.map(d => ({ ...d })),
      actions: source.actions.map(a => ({ ...a })),
      traits: source.traits.map(t => ({ ...t })),
    }];
    onChange(newData);
    setSelectedId(newId);
  }, [data, onChange]);

  const handleReorder = useCallback((fromId: number, toId: number) => {
    if (!data) return;
    const items = data.filter(Boolean) as Enemy[];
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

  const getDropItemLabel = (drop: DropItem): string => {
    if (drop.kind === 0) return t('common.none');
    const list = drop.kind === 1 ? items : drop.kind === 2 ? weapons : armors;
    const found = list.find(it => it.id === drop.dataId);
    return found ? found.name : t('common.none');
  };

  const currentAction = selectedItem && selectedActionIndex >= 0 && selectedActionIndex < (selectedItem.actions || []).length
    ? (selectedItem.actions || [])[selectedActionIndex]
    : null;

  return (
    <div className="db-tab-layout">
      <DatabaseList
        items={data}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={addNewEnemy}
        onDelete={handleDeleteEnemy}
        onDuplicate={handleDuplicate}
        onReorder={handleReorder}
      />

      {selectedItem && (
        <div className="enemies-main">
          {/* 가운데 패널: 일반설정 + 행동패턴 (세로 쌓기) */}
          <div className="enemies-center">
            {/* 일반 설정 */}
            <div className="enemies-section-title">{t('fields.generalSettings') || '일반 설정'}</div>
            <div className="enemies-general-layout">
              {/* 왼쪽: 이름 + 이미지 */}
              <div className="enemies-general-left">
                <label className="enemies-label">
                  {t('common.name')}:
                  <div style={{display:'flex',gap:4,alignItems:'center'}}>
                    <input
                      type="text"
                      value={selectedItem.name || ''}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      className="enemies-input"
                      style={{flex:1}}
                    />
                    <TranslateButton csvPath="database/enemies.csv" entryKey={`${selectedItem.id}.name`} sourceText={selectedItem.name || ''} />
                  </div>
                </label>
                <div className="enemies-label">{t('fields.battlerImage') || '이미지'}:</div>
                <ImagePicker
                  type="enemies"
                  value={selectedItem.battlerName || ''}
                  onChange={(name) => handleFieldChange('battlerName', name)}
                />
              </div>

              {/* 오른쪽: 파라미터 2열 그리드 */}
              <div className="enemies-general-right">
                <div className="enemies-params-grid">
                  <label className="enemies-param-label">
                    <span>{t('params.maxHP')}:</span>
                    <input type="number" value={selectedItem.params?.[0] ?? 0} min={1} max={999999}
                      onChange={(e) => handleParamChange(0, Number(e.target.value))} className="enemies-input enemies-input-num" />
                  </label>
                  <label className="enemies-param-label">
                    <span>{t('params.maxMP')}:</span>
                    <input type="number" value={selectedItem.params?.[1] ?? 0} min={0} max={9999}
                      onChange={(e) => handleParamChange(1, Number(e.target.value))} className="enemies-input enemies-input-num" />
                  </label>
                  <label className="enemies-param-label">
                    <span>{t('params.attack')}:</span>
                    <input type="number" value={selectedItem.params?.[2] ?? 0} min={1} max={999}
                      onChange={(e) => handleParamChange(2, Number(e.target.value))} className="enemies-input enemies-input-num" />
                  </label>
                  <label className="enemies-param-label">
                    <span>{t('params.defense')}:</span>
                    <input type="number" value={selectedItem.params?.[3] ?? 0} min={1} max={999}
                      onChange={(e) => handleParamChange(3, Number(e.target.value))} className="enemies-input enemies-input-num" />
                  </label>
                  <label className="enemies-param-label">
                    <span>{t('params.mAttack')}:</span>
                    <input type="number" value={selectedItem.params?.[4] ?? 0} min={1} max={999}
                      onChange={(e) => handleParamChange(4, Number(e.target.value))} className="enemies-input enemies-input-num" />
                  </label>
                  <label className="enemies-param-label">
                    <span>{t('params.mDefense')}:</span>
                    <input type="number" value={selectedItem.params?.[5] ?? 0} min={1} max={999}
                      onChange={(e) => handleParamChange(5, Number(e.target.value))} className="enemies-input enemies-input-num" />
                  </label>
                  <label className="enemies-param-label">
                    <span>{t('params.agility')}:</span>
                    <input type="number" value={selectedItem.params?.[6] ?? 0} min={1} max={999}
                      onChange={(e) => handleParamChange(6, Number(e.target.value))} className="enemies-input enemies-input-num" />
                  </label>
                  <label className="enemies-param-label">
                    <span>{t('params.luck')}:</span>
                    <input type="number" value={selectedItem.params?.[7] ?? 0} min={1} max={999}
                      onChange={(e) => handleParamChange(7, Number(e.target.value))} className="enemies-input enemies-input-num" />
                  </label>
                </div>
              </div>
            </div>

            {/* 보상 + 드롭 아이템 가로 배치 */}
            <div className="enemies-reward-drop-row">
              <div className="enemies-reward-section">
                <div className="enemies-section-title">{t('fields.rewards') || '보상'}</div>
                <label className="enemies-param-label">
                  <span>EXP:</span>
                  <input type="number" value={selectedItem.exp || 0} min={0} max={9999999}
                    onChange={(e) => handleFieldChange('exp', Number(e.target.value))} className="enemies-input enemies-input-num" />
                </label>
                <label className="enemies-param-label">
                  <span>{t('fields.gold') || 'Gold'}:</span>
                  <input type="number" value={selectedItem.gold || 0} min={0} max={9999999}
                    onChange={(e) => handleFieldChange('gold', Number(e.target.value))} className="enemies-input enemies-input-num" />
                </label>
              </div>
              <div className="enemies-drop-section">
                <div className="enemies-section-title">{t('fields.dropItems') || '드롭 아이템'}</div>
                <div className="enemies-drop-table">
                  {(selectedItem.dropItems || []).map((drop: DropItem, i: number) => (
                    <div key={i} className="enemies-drop-row" onDoubleClick={() => setDropItemPickerIndex(i)}>
                      <span className="enemies-drop-kind">{DROP_KIND_LABELS[drop.kind] || ''}</span>
                      <span className="enemies-drop-name">{getDropItemLabel(drop)}</span>
                      <span className="enemies-drop-prob">1/{drop.denominator}</span>
                    </div>
                  ))}
                  {(selectedItem.dropItems || []).length === 0 && (
                    <>
                      <div className="enemies-drop-row enemies-drop-empty" />
                      <div className="enemies-drop-row enemies-drop-empty" />
                      <div className="enemies-drop-row enemies-drop-empty" />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 행동 패턴 */}
            <div className="enemies-section-title">
              {t('fields.actionPatterns') || '행동 패턴'}
              <div style={{marginLeft:'auto',display:'flex',gap:4}}>
                <button className="db-btn-small" onClick={addAction}>+</button>
                <button className="db-btn-small" onClick={() => selectedActionIndex >= 0 && removeAction(selectedActionIndex)}
                  disabled={selectedActionIndex < 0}>-</button>
              </div>
            </div>
            <div className="enemies-action-table">
              <div className="enemies-action-header">
                <span className="enemies-action-col-skill">{t('fields.skill') || '스킬'}</span>
                <span className="enemies-action-col-cond">{t('fields.condition') || '조건'}</span>
                <span className="enemies-action-col-rating">{t('fields.rating') || 'R'}</span>
              </div>
              <div className="enemies-action-body">
                {(selectedItem.actions || []).map((action: EnemyAction, i: number) => {
                  const sk = skills.find(s => s.id === action.skillId);
                  const skLabel = sk ? sk.name : String(action.skillId);
                  const condLabel = CONDITION_TYPE_LABELS[action.conditionType] || '';
                  return (
                    <div key={i}
                      className={`enemies-action-row${i === selectedActionIndex ? ' selected' : ''}`}
                      onClick={() => setSelectedActionIndex(i)}
                    >
                      <span className="enemies-action-col-skill">
                        {sk?.iconIndex != null && sk.iconIndex > 0 && <IconSprite iconIndex={sk.iconIndex} />}
                        {skLabel}
                      </span>
                      <span className="enemies-action-col-cond">{condLabel}</span>
                      <span className="enemies-action-col-rating">{action.rating}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 선택된 행동 패턴 편집 */}
            {currentAction && (
              <div className="enemies-action-edit">
                <label className="enemies-label">
                  {t('fields.skill') || '스킬'}:
                  <button className="db-picker-btn" onClick={() => setSkillPickerOpen(true)}>
                    {(() => {
                      const sk = skills.find(s => s.id === currentAction.skillId);
                      return <>
                        {sk?.iconIndex != null && sk.iconIndex > 0 && <IconSprite iconIndex={sk.iconIndex} />}
                        <span>{sk ? `${String(currentAction.skillId).padStart(4, '0')}: ${sk.name}` : String(currentAction.skillId)}</span>
                      </>;
                    })()}
                  </button>
                </label>
                <div className="enemies-action-edit-row">
                  <label className="enemies-label" style={{flex:1}}>
                    {t('fields.condition') || '조건'}:
                    <select value={currentAction.conditionType}
                      onChange={(e) => handleActionChange(selectedActionIndex, 'conditionType', Number(e.target.value))}
                      className="enemies-select">
                      {Object.entries(CONDITION_TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="enemies-label" style={{flex:1}}>
                    {t('fields.rating') || '레이팅'}:
                    <input type="number" value={currentAction.rating} min={1} max={9}
                      onChange={(e) => handleActionChange(selectedActionIndex, 'rating', Number(e.target.value))}
                      className="enemies-input enemies-input-num" />
                  </label>
                </div>
                {currentAction.conditionType !== 0 && (
                  <div className="enemies-action-edit-row">
                    <label className="enemies-label" style={{flex:1}}>
                      {currentAction.conditionType === 1 ? 'A:' : currentAction.conditionType <= 3 ? '%:' : ''}
                      <input type="number" value={currentAction.conditionParam1}
                        onChange={(e) => handleActionChange(selectedActionIndex, 'conditionParam1', Number(e.target.value))}
                        className="enemies-input enemies-input-num" />
                    </label>
                    {(currentAction.conditionType >= 1 && currentAction.conditionType <= 3) && (
                      <label className="enemies-label" style={{flex:1}}>
                        {currentAction.conditionType === 1 ? 'B:' : '~'}
                        <input type="number" value={currentAction.conditionParam2}
                          onChange={(e) => handleActionChange(selectedActionIndex, 'conditionParam2', Number(e.target.value))}
                          className="enemies-input enemies-input-num" />
                      </label>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 오른쪽 패널: 특성 + 메모 */}
          <div className="enemies-right">
            <div className="enemies-section-title">{t('fields.traits') || '특성'}</div>
            <TraitsEditor
              traits={selectedItem.traits || []}
              onChange={(traits) => handleFieldChange('traits', traits)}
            />

            <div className="enemies-section-title">{t('common.note') || '메모'}</div>
            <textarea
              value={selectedItem.note || ''}
              onChange={(e) => handleFieldChange('note', e.target.value)}
              className="enemies-note"
            />
          </div>
        </div>
      )}

      {/* 스킬 선택 피커 */}
      {skillPickerOpen && selectedItem && currentAction && (
        <DataListPicker
          items={skillNames}
          value={currentAction.skillId}
          onChange={(id) => {
            handleActionChange(selectedActionIndex, 'skillId', id);
          }}
          onClose={() => setSkillPickerOpen(false)}
          title={t('fields.skill') + ' 선택'}
          iconIndices={skillIcons}
        />
      )}

      {/* 드롭 아이템 편집 다이얼로그 */}
      {dropItemPickerIndex !== null && selectedItem && (() => {
        const drop = (selectedItem.dropItems || [])[dropItemPickerIndex];
        if (!drop) return null;
        const kindOptions: { kind: number; label: string; list: RefItem[] }[] = [
          { kind: 0, label: t('dropKind.none'), list: [] },
          { kind: 1, label: t('dropKind.item'), list: items },
          { kind: 2, label: t('dropKind.weapon'), list: weapons },
          { kind: 3, label: t('dropKind.armor'), list: armors },
        ];
        return (
          <div className="db-dialog-overlay" onClick={() => setDropItemPickerIndex(null)}>
            <div className="enemies-drop-dialog" onClick={e => e.stopPropagation()}>
              <div className="enemies-drop-dialog-title">{t('fields.dropItemDrop') || '아이템 드롭'}</div>
              <div className="enemies-drop-dialog-body">
                <div className="enemies-drop-dialog-section">{t('fields.dropItemDrop') || '아이템 드롭'}</div>
                {kindOptions.map(opt => {
                  const isSelected = drop.kind === opt.kind;
                  const selectedDataItem = isSelected ? opt.list.find(it => it.id === drop.dataId) : null;
                  const displayName = selectedDataItem ? selectedDataItem.name : '';
                  return (
                    <div key={opt.kind} className="enemies-drop-radio-row">
                      <label className="enemies-drop-radio-label">
                        <input type="radio" name="dropKind" checked={isSelected}
                          onChange={() => handleDropItemChange(dropItemPickerIndex, 'kind', opt.kind)} />
                        <span>{opt.label}</span>
                      </label>
                      {opt.kind > 0 && (
                        <button className={`enemies-drop-item-btn${!isSelected ? ' disabled' : ''}`}
                          disabled={!isSelected}
                          onClick={() => setDropDataPickerKind(opt.kind)}>
                          {isSelected ? displayName : ''}
                        </button>
                      )}
                    </div>
                  );
                })}

                <div className="enemies-drop-dialog-section">{t('fields.dropRate') || '출현율'}</div>
                <div className="enemies-drop-rate-row">
                  <span>1 /</span>
                  <input type="number" value={drop.denominator} min={1} max={1000}
                    onChange={(e) => handleDropItemChange(dropItemPickerIndex, 'denominator', Number(e.target.value))}
                    className="enemies-input" style={{width:80}} />
                </div>
              </div>
              <div className="enemies-drop-dialog-footer">
                <button className="db-btn" onClick={() => setDropItemPickerIndex(null)}>OK</button>
                <button className="db-btn" onClick={() => setDropItemPickerIndex(null)}>{t('common.cancel') || '취소'}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 드롭 아이템 데이터 선택 피커 */}
      {dropDataPickerKind !== null && dropItemPickerIndex !== null && selectedItem && (() => {
        const drop = (selectedItem.dropItems || [])[dropItemPickerIndex];
        if (!drop) return null;
        const names = dropDataPickerKind === 1 ? itemNames : dropDataPickerKind === 2 ? weaponNames : armorNames;
        const title = dropDataPickerKind === 1 ? t('dropKind.item') : dropDataPickerKind === 2 ? t('dropKind.weapon') : t('dropKind.armor');
        return (
          <DataListPicker
            items={names}
            value={drop.kind === dropDataPickerKind ? drop.dataId : 0}
            onChange={(id) => {
              handleDropItemChange(dropItemPickerIndex, 'dataId', id);
            }}
            onClose={() => setDropDataPickerKind(null)}
            title={title + ' 선택'}
          />
        );
      })()}
    </div>
  );
}
