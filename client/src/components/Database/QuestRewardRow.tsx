import React, { useState } from 'react';
import type { QuestReward, QuestRewardType } from '../../types/rpgMakerMV';
import { selectStyle } from '../../styles/editorStyles';
import { DataListPicker } from '../EventEditor/dataListPicker';
import { ItemPreview } from '../common/ItemPreview';
import { ItemPickerButton } from '../common/DbPickerButton';
import type { RefData } from './questsTabTypes';
import { REWARD_TYPE_LABELS } from './questsTabTypes';

export interface RewardRowProps {
  reward: QuestReward;
  onChange: (r: QuestReward) => void;
  onDelete: () => void;
  refData: RefData;
}

export function RewardRow({ reward, onChange, onDelete, refData }: RewardRowProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const set = <K extends keyof QuestReward>(k: K, v: QuestReward[K]) =>
    onChange({ ...reward, [k]: v });

  const showAmount = reward.type === 'gold' || reward.type === 'exp';
  const showItem   = reward.type === 'item' || reward.type === 'weapon' || reward.type === 'armor';

  const rewardItemNames = reward.type === 'weapon' ? refData.weaponNames
    : reward.type === 'armor' ? refData.armorNames : refData.itemNames;
  const rewardItemIcons = reward.type === 'weapon' ? refData.weaponIcons
    : reward.type === 'armor' ? refData.armorIcons : refData.itemIcons;
  const rewardPickerTitle = reward.type === 'weapon' ? '무기 선택'
    : reward.type === 'armor' ? '방어구 선택' : '아이템 선택';

  return (
    <div className="qs-reward-row">
      <select
        value={reward.type}
        onChange={(e) => onChange({ type: e.target.value as QuestRewardType })}
        style={{ ...selectStyle, fontSize: 12, width: 80 }}
      >
        {(Object.entries(REWARD_TYPE_LABELS) as [QuestRewardType, string][]).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      {showAmount && (
        <input
          type="number"
          value={reward.amount ?? 0}
          min={0}
          onChange={(e) => set('amount', Number(e.target.value))}
          placeholder="수량"
          style={{ width: 80 }}
        />
      )}
      {showItem && (
        <>
          <ItemPickerButton
            id={reward.itemId ?? 1}
            type={reward.type as 'item' | 'weapon' | 'armor'}
            onClick={() => setPickerOpen(true)}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            value={reward.count ?? 1}
            min={1}
            onChange={(e) => set('count', Number(e.target.value))}
            placeholder="개수"
            style={{ width: 60 }}
          />
        </>
      )}
      <button onClick={onDelete} className="qs-btn-danger qs-reward-del" title="삭제">×</button>
      {pickerOpen && rewardItemNames.length > 0 && (
        <DataListPicker
          title={rewardPickerTitle}
          items={rewardItemNames}
          value={reward.itemId ?? 1}
          iconIndices={rewardItemIcons}
          onChange={(id) => set('itemId', id)}
          onClose={() => setPickerOpen(false)}
          renderPreview={(id) => <ItemPreview id={id} type={reward.type as 'item' | 'weapon' | 'armor'} />}
        />
      )}
    </div>
  );
}
