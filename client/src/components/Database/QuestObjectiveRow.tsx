import React from 'react';
import type { QuestObjective, QuestObjectiveType } from '../../types/rpgMakerMV';
import { selectStyle } from '../../styles/editorStyles';
import type { RefData } from './questsTabTypes';
import { OBJECTIVE_TYPE_LABELS } from './questsTabTypes';
import { ObjectiveConfigEditor } from './QuestObjectiveConfigEditor';

export interface ObjectiveRowProps {
  obj: QuestObjective;
  onChange: (obj: QuestObjective) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  refData: RefData;
}

export function ObjectiveRow({ obj, onChange, onDelete, onMoveUp, onMoveDown, refData }: ObjectiveRowProps) {
  const set = <K extends keyof QuestObjective>(k: K, v: QuestObjective[K]) =>
    onChange({ ...obj, [k]: v });

  return (
    <div className="qs-obj-row">
      <div className="qs-obj-header">
        <span className="qs-obj-id">#{obj.id}</span>
        <input
          className="qs-obj-text"
          type="text"
          value={obj.text}
          onChange={(e) => set('text', e.target.value)}
          placeholder="목표 텍스트"
        />
        <select
          value={obj.type}
          onChange={(e) => onChange({ ...obj, type: e.target.value as QuestObjectiveType, config: {} })}
          style={{ ...selectStyle, fontSize: 12 }}
        >
          {(Object.entries(OBJECTIVE_TYPE_LABELS) as [QuestObjectiveType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <label className="qs-obj-check">
          <input type="checkbox" checked={!!obj.optional} onChange={(e) => set('optional', e.target.checked)} />
          선택
        </label>
        <label className="qs-obj-check">
          <input type="checkbox" checked={!!obj.hidden} onChange={(e) => set('hidden', e.target.checked)} />
          숨김
        </label>
        <div className="qs-obj-btns">
          <button onClick={onMoveUp} title="위로">↑</button>
          <button onClick={onMoveDown} title="아래로">↓</button>
          <button onClick={onDelete} title="삭제" className="qs-btn-danger">×</button>
        </div>
      </div>
      {obj.type !== 'manual' && (
        <ObjectiveConfigEditor
          type={obj.type}
          config={obj.config}
          onChange={(cfg) => set('config', cfg)}
          refData={refData}
        />
      )}
    </div>
  );
}
