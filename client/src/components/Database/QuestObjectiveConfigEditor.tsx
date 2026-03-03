import React, { useState, useCallback } from 'react';
import type { QuestObjectiveType, QuestObjectiveConfig, QuestVariableOperator } from '../../types/rpgMakerMV';
import { selectStyle } from '../../styles/editorStyles';
import { DataListPicker } from '../EventEditor/dataListPicker';
import { EnemyPreview } from '../common/EnemyPreview';
import { ItemPreview } from '../common/ItemPreview';
import { ItemPickerButton, EnemyPickerButton } from '../common/DbPickerButton';
import type { RefData } from './questsTabTypes';

export interface ObjectiveConfigEditorProps {
  type: QuestObjectiveType;
  config: QuestObjectiveConfig;
  onChange: (config: QuestObjectiveConfig) => void;
  refData: RefData;
}

export function ObjectiveConfigEditor({ type, config, onChange, refData }: ObjectiveConfigEditorProps) {
  const [pickerOpen, setPickerOpen] = useState<'enemy' | 'item' | null>(null);

  const set = useCallback(<K extends keyof QuestObjectiveConfig>(key: K, val: QuestObjectiveConfig[K]) => {
    onChange({ ...config, [key]: val });
  }, [config, onChange]);

  const numInput = (label: string, key: keyof QuestObjectiveConfig, defaultVal = 0, onPicker?: () => void) => (
    <label className="qs-cfg-field">
      {label}
      <div className="qs-input-row">
        <input
          type="number"
          value={(config[key] as number) ?? defaultVal}
          min={0}
          onChange={(e) => set(key, Number(e.target.value) as QuestObjectiveConfig[typeof key])}
        />
        {onPicker && (
          <button className="qs-picker-btn" onClick={onPicker} title="목록에서 선택">...</button>
        )}
      </div>
    </label>
  );

  const collectItemType = config.itemType || 'item';
  const collectNames = collectItemType === 'weapon' ? refData.weaponNames
    : collectItemType === 'armor' ? refData.armorNames : refData.itemNames;
  const collectIcons = collectItemType === 'weapon' ? refData.weaponIcons
    : collectItemType === 'armor' ? refData.armorIcons : refData.itemIcons;

  if (type === 'kill') {
    return (
      <div className="qs-cfg-row">
        <label className="qs-cfg-field">
          적
          <EnemyPickerButton id={config.enemyId ?? 1} onClick={() => setPickerOpen('enemy')} />
        </label>
        {numInput('마리 수', 'count', 1)}
        {pickerOpen === 'enemy' && refData.enemyNames.length > 0 && (
          <DataListPicker
            title="적(몬스터) 선택"
            items={refData.enemyNames}
            value={config.enemyId ?? 1}
            onChange={(id) => set('enemyId', id)}
            onClose={() => setPickerOpen(null)}
            renderPreview={(id) => <EnemyPreview id={id} />}
          />
        )}
      </div>
    );
  }
  if (type === 'collect') {
    return (
      <div className="qs-cfg-row">
        <label className="qs-cfg-field">
          종류
          <select
            value={collectItemType}
            onChange={(e) => set('itemType', e.target.value as 'item' | 'weapon' | 'armor')}
            style={selectStyle}
          >
            <option value="item">아이템</option>
            <option value="weapon">무기</option>
            <option value="armor">방어구</option>
          </select>
        </label>
        <label className="qs-cfg-field">
          아이템
          <ItemPickerButton id={config.itemId ?? 1} type={collectItemType as 'item' | 'weapon' | 'armor'} onClick={() => setPickerOpen('item')} />
        </label>
        {numInput('개수', 'count', 1)}
        {pickerOpen === 'item' && collectNames.length > 0 && (
          <DataListPicker
            title={collectItemType === 'weapon' ? '무기 선택' : collectItemType === 'armor' ? '방어구 선택' : '아이템 선택'}
            items={collectNames}
            value={config.itemId ?? 1}
            iconIndices={collectIcons}
            onChange={(id) => set('itemId', id)}
            onClose={() => setPickerOpen(null)}
            renderPreview={(id) => <ItemPreview id={id} type={collectItemType as 'item' | 'weapon' | 'armor'} />}
          />
        )}
      </div>
    );
  }
  if (type === 'gold') {
    return (
      <div className="qs-cfg-row">
        {numInput('최소 골드', 'amount', 100)}
      </div>
    );
  }
  if (type === 'variable') {
    return (
      <div className="qs-cfg-row">
        {numInput('변수 ID', 'variableId', 1)}
        <label className="qs-cfg-field">
          조건
          <select
            value={config.operator || '>='}
            onChange={(e) => set('operator', e.target.value as QuestVariableOperator)}
            style={selectStyle}
          >
            {(['>=', '==', '<=', '>', '<', '!='] as QuestVariableOperator[]).map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        </label>
        {numInput('값', 'value', 1)}
      </div>
    );
  }
  if (type === 'switch') {
    return (
      <div className="qs-cfg-row">
        {numInput('스위치 ID', 'switchId', 1)}
        <label className="qs-cfg-field">
          조건
          <select
            value={config.switchValue === false ? 'false' : 'true'}
            onChange={(e) => set('switchValue', e.target.value === 'true')}
            style={selectStyle}
          >
            <option value="true">ON</option>
            <option value="false">OFF</option>
          </select>
        </label>
      </div>
    );
  }
  if (type === 'reach') {
    return (
      <div className="qs-cfg-row">
        {numInput('맵 ID', 'mapId', 1)}
        {numInput('X', 'x', 0)}
        {numInput('Y', 'y', 0)}
        {numInput('반경(타일)', 'radius', 2)}
      </div>
    );
  }
  if (type === 'talk') {
    return (
      <div className="qs-cfg-row">
        {numInput('맵 ID', 'mapId', 1)}
        {numInput('이벤트 ID', 'eventId', 1)}
      </div>
    );
  }
  return <div className="qs-cfg-row qs-cfg-manual">플러그인 커맨드 <code>QuestSystem completeObjective &lt;questId&gt; &lt;objId&gt;</code> 로 완료 처리</div>;
}
