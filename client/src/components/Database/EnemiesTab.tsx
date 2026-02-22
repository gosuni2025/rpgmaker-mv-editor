import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Enemy, DropItem, EnemyAction } from '../../types/rpgMakerMV';
import ImagePicker from '../common/ImagePicker';
import TraitsEditor from '../common/TraitsEditor';
import TranslateButton from '../common/TranslateButton';
import { DataListPicker, IconSprite } from '../EventEditor/dataListPicker';
import DatabaseList from './DatabaseList';
import { useEnemyRefData } from './useEnemyRefData';
import EnemyDropDialog from './EnemyDropDialog';
import { useDatabaseTab } from './useDatabaseTab';
import './EnemiesTab.css';

interface EnemiesTabProps {
  data: (Enemy | null)[] | undefined;
  onChange: (data: (Enemy | null)[]) => void;
}

function createNewEnemy(id: number): Enemy {
  return {
    id, name: '', battlerName: '', battlerHue: 0,
    params: [100, 0, 10, 10, 10, 10, 10, 10], exp: 0, gold: 0,
    dropItems: [{ kind: 0, dataId: 1, denominator: 1 }, { kind: 0, dataId: 1, denominator: 1 }, { kind: 0, dataId: 1, denominator: 1 }],
    actions: [{ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1 }],
    traits: [], note: '',
  };
}

function deepCopyEnemy(source: Enemy): Partial<Enemy> {
  return {
    params: [...source.params],
    dropItems: source.dropItems.map((d: DropItem) => ({ ...d })),
    actions: source.actions.map((a: EnemyAction) => ({ ...a })),
    traits: source.traits.map((t) => ({ ...t })),
  };
}

export default function EnemiesTab({ data, onChange }: EnemiesTabProps) {
  const { t } = useTranslation();
  const { selectedId, setSelectedId, selectedItem, handleFieldChange, handleAdd, handleDelete, handleDuplicate, handleReorder } =
    useDatabaseTab(data, onChange, createNewEnemy, deepCopyEnemy);
  const { skills, items, weapons, armors, skillNames, skillIcons, itemNames, weaponNames, armorNames } = useEnemyRefData();
  const [selectedActionIndex, setSelectedActionIndex] = useState<number>(-1);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [dropItemPickerIndex, setDropItemPickerIndex] = useState<number | null>(null);

  const DROP_KIND_LABELS: Record<number, string> = { 0: t('dropKind.none'), 1: t('dropKind.item'), 2: t('dropKind.weapon'), 3: t('dropKind.armor') };
  const CONDITION_TYPE_LABELS: Record<number, string> = {
    0: t('conditionType.always'), 1: t('conditionType.turn'), 2: t('conditionType.hp'),
    3: t('conditionType.mp'), 4: t('conditionType.state'), 5: t('conditionType.partyLevel'), 6: t('conditionType.switch'),
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
    const actions = [...(selectedItem?.actions || []), { conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1 }];
    handleFieldChange('actions', actions);
    setSelectedActionIndex(actions.length - 1);
  };

  const removeAction = (index: number) => {
    const actions = (selectedItem?.actions || []).filter((_: unknown, i: number) => i !== index);
    handleFieldChange('actions', actions);
    if (selectedActionIndex >= actions.length) setSelectedActionIndex(actions.length - 1);
  };

  const getDropItemLabel = (drop: DropItem): string => {
    if (drop.kind === 0) return t('common.none');
    const list = drop.kind === 1 ? items : drop.kind === 2 ? weapons : armors;
    const found = list.find(it => it.id === drop.dataId);
    return found ? found.name : t('common.none');
  };

  const currentAction = selectedItem && selectedActionIndex >= 0 && selectedActionIndex < (selectedItem.actions || []).length
    ? (selectedItem.actions || [])[selectedActionIndex] : null;

  const PARAM_DEFS = [
    { key: 'maxHP', max: 999999, min: 1 }, { key: 'maxMP', max: 9999, min: 0 },
    { key: 'attack', max: 999, min: 1 }, { key: 'defense', max: 999, min: 1 },
    { key: 'mAttack', max: 999, min: 1 }, { key: 'mDefense', max: 999, min: 1 },
    { key: 'agility', max: 999, min: 1 }, { key: 'luck', max: 999, min: 1 },
  ];

  return (
    <div className="db-tab-layout">
      <DatabaseList items={data} selectedId={selectedId} onSelect={setSelectedId}
        onAdd={handleAdd} onDelete={handleDelete} onDuplicate={handleDuplicate} onReorder={handleReorder} />

      {selectedItem && (
        <div className="enemies-main">
          <div className="enemies-center">
            <div className="enemies-section-title">{t('fields.generalSettings') || '일반 설정'}</div>
            <div className="enemies-general-layout">
              <div className="enemies-general-left">
                <label className="enemies-label">
                  {t('common.name')}:
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input type="text" value={selectedItem.name || ''} onChange={e => handleFieldChange('name', e.target.value)}
                      className="enemies-input" style={{ flex: 1 }} />
                    <TranslateButton csvPath="database/enemies.csv" entryKey={`${selectedItem.id}.name`} sourceText={selectedItem.name || ''} />
                  </div>
                </label>
                <div className="enemies-label">{t('fields.battlerImage') || '이미지'}:</div>
                <ImagePicker type="enemies" value={selectedItem.battlerName || ''} onChange={name => handleFieldChange('battlerName', name)} />
              </div>
              <div className="enemies-general-right">
                <div className="enemies-params-grid">
                  {PARAM_DEFS.map((p, i) => (
                    <label key={p.key} className="enemies-param-label">
                      <span>{t(`params.${p.key}`)}:</span>
                      <input type="number" value={selectedItem.params?.[i] ?? 0} min={p.min} max={p.max}
                        onChange={e => handleParamChange(i, Number(e.target.value))} className="enemies-input enemies-input-num" />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="enemies-reward-drop-row">
              <div className="enemies-reward-section">
                <div className="enemies-section-title">{t('fields.rewards') || '보상'}</div>
                <label className="enemies-param-label">
                  <span>EXP:</span>
                  <input type="number" value={selectedItem.exp || 0} min={0} max={9999999}
                    onChange={e => handleFieldChange('exp', Number(e.target.value))} className="enemies-input enemies-input-num" />
                </label>
                <label className="enemies-param-label">
                  <span>{t('fields.gold') || 'Gold'}:</span>
                  <input type="number" value={selectedItem.gold || 0} min={0} max={9999999}
                    onChange={e => handleFieldChange('gold', Number(e.target.value))} className="enemies-input enemies-input-num" />
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
                    <>{[0, 1, 2].map(i => <div key={i} className="enemies-drop-row enemies-drop-empty" />)}</>
                  )}
                </div>
              </div>
            </div>

            <div className="enemies-section-title">
              {t('fields.actionPatterns') || '행동 패턴'}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
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
                  return (
                    <div key={i} className={`enemies-action-row${i === selectedActionIndex ? ' selected' : ''}`} onClick={() => setSelectedActionIndex(i)}>
                      <span className="enemies-action-col-skill">
                        {sk?.iconIndex != null && sk.iconIndex > 0 && <IconSprite iconIndex={sk.iconIndex} />}
                        {sk ? sk.name : String(action.skillId)}
                      </span>
                      <span className="enemies-action-col-cond">{CONDITION_TYPE_LABELS[action.conditionType] || ''}</span>
                      <span className="enemies-action-col-rating">{action.rating}</span>
                    </div>
                  );
                })}
              </div>
            </div>

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
                  <label className="enemies-label" style={{ flex: 1 }}>
                    {t('fields.condition') || '조건'}:
                    <select value={currentAction.conditionType} onChange={e => handleActionChange(selectedActionIndex, 'conditionType', Number(e.target.value))} className="enemies-select">
                      {Object.entries(CONDITION_TYPE_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                    </select>
                  </label>
                  <label className="enemies-label" style={{ flex: 1 }}>
                    {t('fields.rating') || '레이팅'}:
                    <input type="number" value={currentAction.rating} min={1} max={9}
                      onChange={e => handleActionChange(selectedActionIndex, 'rating', Number(e.target.value))} className="enemies-input enemies-input-num" />
                  </label>
                </div>
                {currentAction.conditionType !== 0 && (
                  <div className="enemies-action-edit-row">
                    <label className="enemies-label" style={{ flex: 1 }}>
                      {currentAction.conditionType === 1 ? 'A:' : currentAction.conditionType <= 3 ? '%:' : ''}
                      <input type="number" value={currentAction.conditionParam1}
                        onChange={e => handleActionChange(selectedActionIndex, 'conditionParam1', Number(e.target.value))} className="enemies-input enemies-input-num" />
                    </label>
                    {(currentAction.conditionType >= 1 && currentAction.conditionType <= 3) && (
                      <label className="enemies-label" style={{ flex: 1 }}>
                        {currentAction.conditionType === 1 ? 'B:' : '~'}
                        <input type="number" value={currentAction.conditionParam2}
                          onChange={e => handleActionChange(selectedActionIndex, 'conditionParam2', Number(e.target.value))} className="enemies-input enemies-input-num" />
                      </label>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="enemies-right">
            <div className="enemies-section-title">{t('fields.traits') || '특성'}</div>
            <TraitsEditor traits={selectedItem.traits || []} onChange={traits => handleFieldChange('traits', traits)} />
            <div className="enemies-section-title">{t('common.note') || '메모'}</div>
            <textarea value={selectedItem.note || ''} onChange={e => handleFieldChange('note', e.target.value)} className="enemies-note" />
          </div>
        </div>
      )}

      {skillPickerOpen && selectedItem && currentAction && (
        <DataListPicker items={skillNames} value={currentAction.skillId}
          onChange={id => handleActionChange(selectedActionIndex, 'skillId', id)}
          onClose={() => setSkillPickerOpen(false)} title={t('fields.skill') + ' 선택'} iconIndices={skillIcons} />
      )}

      {dropItemPickerIndex !== null && selectedItem && (() => {
        const drop = (selectedItem.dropItems || [])[dropItemPickerIndex];
        if (!drop) return null;
        return (
          <EnemyDropDialog drop={drop} items={items} weapons={weapons} armors={armors}
            itemNames={itemNames} weaponNames={weaponNames} armorNames={armorNames}
            onDropChange={(field, value) => handleDropItemChange(dropItemPickerIndex, field, value)}
            onClose={() => setDropItemPickerIndex(null)} />
        );
      })()}
    </div>
  );
}
