import React, { useState, useEffect } from 'react';
import type { Quest, QuestCategory, QuestObjective, QuestReward } from '../../types/rpgMakerMV';
import { selectStyleFull } from '../../styles/editorStyles';
import apiClient from '../../api/client';
import type { RefData } from './questsTabTypes';
import { EMPTY_REF } from './questsTabTypes';
import { newObjective, newReward } from './questsTabHelpers';
import { ObjectiveRow } from './QuestObjectiveRow';
import { RewardRow } from './QuestRewardRow';

export interface QuestEditorProps {
  quest: Quest;
  categories: QuestCategory[];
  onChange: (q: Quest) => void;
}

export function QuestEditor({ quest, categories, onChange }: QuestEditorProps) {
  const set = <K extends keyof Quest>(k: K, v: Quest[K]) =>
    onChange({ ...quest, [k]: v });

  const [refData, setRefData] = useState<RefData>(EMPTY_REF);
  useEffect(() => {
    type RefItem = { id: number; name: string; iconIndex?: number } | null;
    const buildNamesIcons = (arr: RefItem[]) => {
      const names: string[] = [];
      const icons: (number | undefined)[] = [];
      for (const item of arr) {
        if (item) { names[item.id] = item.name; icons[item.id] = item.iconIndex; }
      }
      return { names, icons };
    };
    Promise.all([
      apiClient.get<RefItem[]>('/database/enemies'),
      apiClient.get<RefItem[]>('/database/items'),
      apiClient.get<RefItem[]>('/database/weapons'),
      apiClient.get<RefItem[]>('/database/armors'),
    ]).then(([enemies, items, weapons, armors]) => {
      const en = buildNamesIcons(enemies);
      const it = buildNamesIcons(items);
      const wp = buildNamesIcons(weapons);
      const ar = buildNamesIcons(armors);
      setRefData({
        enemyNames: en.names, itemNames: it.names, itemIcons: it.icons,
        weaponNames: wp.names, weaponIcons: wp.icons, armorNames: ar.names, armorIcons: ar.icons,
      });
    }).catch(() => {});
  }, []);

  const nextObjId = quest.objectives.length > 0
    ? Math.max(...quest.objectives.map((o) => o.id)) + 1
    : 1;

  const updateObj = (idx: number, obj: QuestObjective) => {
    const objs = [...quest.objectives];
    objs[idx] = obj;
    set('objectives', objs);
  };

  const deleteObj = (idx: number) => {
    set('objectives', quest.objectives.filter((_, i) => i !== idx));
  };

  const moveObj = (idx: number, dir: -1 | 1) => {
    const objs = [...quest.objectives];
    const target = idx + dir;
    if (target < 0 || target >= objs.length) return;
    [objs[idx], objs[target]] = [objs[target], objs[idx]];
    set('objectives', objs);
  };

  const addReward = () => set('rewards', [...quest.rewards, newReward()]);

  const updateReward = (idx: number, r: QuestReward) => {
    const rewards = [...quest.rewards];
    rewards[idx] = r;
    set('rewards', rewards);
  };

  const deleteReward = (idx: number) => {
    set('rewards', quest.rewards.filter((_, i) => i !== idx));
  };

  return (
    <div className="qs-editor">
      {/* 기본 정보 */}
      <div className="qs-section">
        <div className="qs-section-title">기본 정보</div>
        <div className="qs-form-row">
          <label className="qs-form-field" style={{ flex: 2 }}>
            <span>ID</span>
            <input
              type="text"
              value={quest.id}
              onChange={(e) => set('id', e.target.value)}
              style={{ fontFamily: 'monospace' }}
            />
          </label>
          <label className="qs-form-field" style={{ flex: 3 }}>
            <span>제목</span>
            <input type="text" value={quest.title} onChange={(e) => set('title', e.target.value)} />
          </label>
          <label className="qs-form-field" style={{ flex: 2 }}>
            <span>카테고리</span>
            <select value={quest.category} onChange={(e) => set('category', e.target.value)} style={selectStyleFull}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <div className="qs-form-row">
          <label className="qs-form-field" style={{ flex: 1 }}>
            <span>난이도</span>
            <input type="text" value={quest.difficulty || ''} onChange={(e) => set('difficulty', e.target.value)} placeholder="E / D / C / B / A / S" />
          </label>
          <label className="qs-form-field" style={{ flex: 2 }}>
            <span>의뢰인</span>
            <input type="text" value={quest.requester || ''} onChange={(e) => set('requester', e.target.value)} />
          </label>
          <label className="qs-form-field" style={{ flex: 2 }}>
            <span>장소</span>
            <input type="text" value={quest.location || ''} onChange={(e) => set('location', e.target.value)} />
          </label>
        </div>
        <label className="qs-form-field">
          <span>설명</span>
          <textarea
            value={quest.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
          />
        </label>
        <label className="qs-form-field">
          <span>메모 (에디터 전용)</span>
          <textarea
            value={quest.note || ''}
            onChange={(e) => set('note', e.target.value)}
            rows={2}
          />
        </label>
      </div>

      {/* 목표 */}
      <div className="qs-section">
        <div className="qs-section-header">
          <div className="qs-section-title">목표 (Objectives)</div>
          <button
            className="qs-btn-add"
            onClick={() => set('objectives', [...quest.objectives, newObjective(nextObjId)])}
          >
            + 목표 추가
          </button>
        </div>
        {quest.objectives.length === 0 && (
          <div className="qs-empty">목표가 없습니다.</div>
        )}
        {quest.objectives.map((obj, idx) => (
          <ObjectiveRow
            key={obj.id}
            obj={obj}
            onChange={(o) => updateObj(idx, o)}
            onDelete={() => deleteObj(idx)}
            onMoveUp={() => moveObj(idx, -1)}
            onMoveDown={() => moveObj(idx, 1)}
            refData={refData}
          />
        ))}
      </div>

      {/* 보상 */}
      <div className="qs-section">
        <div className="qs-section-header">
          <div className="qs-section-title">보상 (Rewards)</div>
          <button className="qs-btn-add" onClick={addReward}>+ 보상 추가</button>
        </div>
        {quest.rewards.length === 0 && (
          <div className="qs-empty">보상이 없습니다.</div>
        )}
        {quest.rewards.map((r, idx) => (
          <RewardRow
            key={idx}
            reward={r}
            onChange={(nr) => updateReward(idx, nr)}
            onDelete={() => deleteReward(idx)}
            refData={refData}
          />
        ))}
      </div>
    </div>
  );
}
