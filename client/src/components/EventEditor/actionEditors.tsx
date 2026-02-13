import React, { useState, useEffect, useMemo } from 'react';
import type { AudioFile } from '../../types/rpgMakerMV';
import AudioPicker from '../common/AudioPicker';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import { DataListPicker } from './controlEditors';
import apiClient from '../../api/client';

interface NamedItem { id: number; name: string }

function useDbNames(endpoint: string): string[] {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    apiClient.get<(NamedItem | null)[]>(`/database/${endpoint}`).then(data => {
      const arr: string[] = [];
      for (const item of data) {
        if (item) arr[item.id] = item.name || '';
      }
      setItems(arr);
    }).catch(() => {});
  }, [endpoint]);
  return items;
}

export const DEFAULT_AUDIO: AudioFile = { name: '', pan: 0, pitch: 100, volume: 90 };

export function ChangeGoldEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [operation, setOperation] = useState<number>((p[0] as number) || 0);
  const [operandType, setOperandType] = useState<number>((p[1] as number) || 0);
  const [operand, setOperand] = useState<number>((p[2] as number) || 0);

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name="gold-op" checked={operation === 0} onChange={() => setOperation(0)} />
            증가
          </label>
          <label style={radioStyle}>
            <input type="radio" name="gold-op" checked={operation === 1} onChange={() => setOperation(1)} />
            감소
          </label>
        </div>
      </fieldset>

      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>피연산자</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="gold-operand" checked={operandType === 0} onChange={() => setOperandType(0)} />
              상수
            </label>
            <input type="number" value={operandType === 0 ? operand : 0} onChange={e => setOperand(Number(e.target.value))}
              min={0} disabled={operandType !== 0} style={{ ...selectStyle, width: 120, opacity: operandType === 0 ? 1 : 0.5 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="gold-operand" checked={operandType === 1} onChange={() => setOperandType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={operandType === 1 ? (operand || 1) : 1} onChange={setOperand} disabled={operandType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([operation, operandType, operand])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

const ITEM_ENDPOINTS: Record<string, { endpoint: string; title: string; fieldLabel: string }> = {
  'Item': { endpoint: 'items', title: '아이템 선택', fieldLabel: '아이템:' },
  'Weapon': { endpoint: 'weapons', title: '무기 선택', fieldLabel: '무기:' },
  'Armor': { endpoint: 'armors', title: '방어구 선택', fieldLabel: '방어구:' },
};

export function ChangeItemEditor({ p, onOk, onCancel, label, showIncludeEquip }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; label: string; showIncludeEquip?: boolean }) {
  const [itemId, setItemId] = useState<number>((p[0] as number) || 1);
  const [operation, setOperation] = useState<number>((p[1] as number) || 0);
  const [operandType, setOperandType] = useState<number>((p[2] as number) || 0);
  const [operand, setOperand] = useState<number>((p[3] as number) || 1);
  const [includeEquip, setIncludeEquip] = useState<boolean>((p[4] as boolean) ?? false);
  const [showPicker, setShowPicker] = useState(false);

  const { endpoint, title, fieldLabel } = ITEM_ENDPOINTS[label] || ITEM_ENDPOINTS['Item'];
  const dbNames = useDbNames(endpoint);

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
  const radioName = `change-${label.toLowerCase()}`;

  const itemLabel = itemId > 0 && dbNames[itemId]
    ? `${String(itemId).padStart(4, '0')} ${dbNames[itemId]}`
    : `${String(itemId).padStart(4, '0')}`;

  return (
    <>
      {/* 아이템 선택 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>{fieldLabel}</span>
        <button className="db-btn" onClick={() => setShowPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{itemLabel}</button>
      </div>

      {/* 조작 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name={`${radioName}-op`} checked={operation === 0} onChange={() => setOperation(0)} />
            증가
          </label>
          <label style={radioStyle}>
            <input type="radio" name={`${radioName}-op`} checked={operation === 1} onChange={() => setOperation(1)} />
            감소
          </label>
        </div>
      </fieldset>

      {/* 피연산자 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>피연산자</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name={`${radioName}-operand`} checked={operandType === 0} onChange={() => setOperandType(0)} />
              상수
            </label>
            <input type="number" value={operandType === 0 ? operand : 0} onChange={e => setOperand(Number(e.target.value))}
              min={1} disabled={operandType !== 0} style={{ ...selectStyle, width: 120, opacity: operandType === 0 ? 1 : 0.5 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name={`${radioName}-operand`} checked={operandType === 1} onChange={() => setOperandType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={operandType === 1 ? (operand || 1) : 1} onChange={setOperand} disabled={operandType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      {showIncludeEquip && (
        <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={includeEquip} onChange={e => setIncludeEquip(e.target.checked)} />
          장비 포함
        </label>
      )}

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => {
          const params: unknown[] = [itemId, operation, operandType, operand];
          if (showIncludeEquip) params.push(includeEquip);
          onOk(params);
        }}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showPicker && (
        <DataListPicker items={dbNames} value={itemId} onChange={setItemId}
          onClose={() => setShowPicker(false)} title={title} />
      )}
    </>
  );
}

export function TransferPlayerEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [designationType, setDesignationType] = useState<number>((p[0] as number) || 0);
  const [mapId, setMapId] = useState<number>((p[1] as number) || 1);
  const [x, setX] = useState<number>((p[2] as number) || 0);
  const [y, setY] = useState<number>((p[3] as number) || 0);
  const [direction, setDirection] = useState<number>((p[4] as number) || 0);
  const [fadeType, setFadeType] = useState<number>((p[5] as number) || 0);
  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Designation
        <select value={designationType} onChange={e => setDesignationType(Number(e.target.value))} style={selectStyle}>
          <option value={0}>Direct</option>
          <option value={1}>Variable</option>
        </select>
      </label>
      {designationType === 0 ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ fontSize: 12, color: '#aaa' }}>
            Map ID
            <input type="number" value={mapId} onChange={e => setMapId(Number(e.target.value))} min={1} style={{ ...selectStyle, width: 80 }} />
          </label>
          <label style={{ fontSize: 12, color: '#aaa' }}>
            X
            <input type="number" value={x} onChange={e => setX(Number(e.target.value))} style={{ ...selectStyle, width: 60 }} />
          </label>
          <label style={{ fontSize: 12, color: '#aaa' }}>
            Y
            <input type="number" value={y} onChange={e => setY(Number(e.target.value))} style={{ ...selectStyle, width: 60 }} />
          </label>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#aaa' }}>
            <span style={{ minWidth: 60 }}>Map Var</span>
            <VariableSwitchPicker type="variable" value={mapId} onChange={setMapId} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#aaa' }}>
            <span style={{ minWidth: 60 }}>X Var</span>
            <VariableSwitchPicker type="variable" value={x} onChange={setX} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#aaa' }}>
            <span style={{ minWidth: 60 }}>Y Var</span>
            <VariableSwitchPicker type="variable" value={y} onChange={setY} style={{ flex: 1 }} />
          </div>
        </div>
      )}
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Direction
        <select value={direction} onChange={e => setDirection(Number(e.target.value))} style={selectStyle}>
          <option value={0}>Retain</option>
          <option value={2}>Down</option>
          <option value={4}>Left</option>
          <option value={6}>Right</option>
          <option value={8}>Up</option>
        </select>
      </label>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Fade Type
        <select value={fadeType} onChange={e => setFadeType(Number(e.target.value))} style={selectStyle}>
          <option value={0}>Black</option>
          <option value={1}>White</option>
          <option value={2}>None</option>
        </select>
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([designationType, mapId, x, y, direction, fadeType])}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

export function AudioEditor({ p, onOk, onCancel, type }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; type: 'bgm' | 'bgs' | 'me' | 'se' }) {
  const audioParam = (p[0] as AudioFile) || { ...DEFAULT_AUDIO };
  const [audio, setAudio] = useState<AudioFile>(audioParam);
  return (
    <>
      <AudioPicker type={type} value={audio} onChange={setAudio} />
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([audio])}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

function getLabel(id: number, list: string[]) {
  const name = list[id] || '';
  return `${String(id).padStart(4, '0')} ${name}`;
}

export function ChangePartyMemberEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [operation, setOperation] = useState<number>((p[1] as number) || 0);
  const [initialize, setInitialize] = useState<boolean>((p[2] as boolean) ?? true);
  const actors = useDbNames('actors');
  const [showPicker, setShowPicker] = useState(false);

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <button className="db-btn" onClick={() => setShowPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(actorId, actors)}</button>
      </div>

      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name="party-op" checked={operation === 0} onChange={() => setOperation(0)} />
            추가
          </label>
          <label style={radioStyle}>
            <input type="radio" name="party-op" checked={operation === 1} onChange={() => setOperation(1)} />
            삭제
          </label>
        </div>
      </fieldset>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ddd', cursor: 'pointer' }}>
        <input type="checkbox" checked={initialize} onChange={e => setInitialize(e.target.checked)}
          disabled={operation !== 0} />
        <span style={{ opacity: operation === 0 ? 1 : 0.5 }}>초기화</span>
      </label>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk(operation === 0 ? [actorId, operation, initialize] : [actorId, operation])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowPicker(false)} title="대상 선택" />
      )}
    </>
  );
}

/**
 * HP/MP/TP 증감 공용 에디터
 * HP(311): params: [actorType, actorId, operation, operandType, operand, allowKnockout]
 * MP(312)/TP(326): params: [actorType, actorId, operation, operandType, operand]
 */
function ActorStatChangeEditor({ p, onOk, onCancel, radioPrefix, showAllowKnockout, showLevelUp }: {
  p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void;
  radioPrefix: string; showAllowKnockout?: boolean; showLevelUp?: boolean;
}) {
  const [actorType, setActorType] = useState<number>((p[0] as number) || 0);
  const [actorId, setActorId] = useState<number>((p[1] as number) || 1);
  const [operation, setOperation] = useState<number>((p[2] as number) || 0);
  const [operandType, setOperandType] = useState<number>((p[3] as number) || 0);
  const [operand, setOperand] = useState<number>((p[4] as number) || 1);
  const [allowKnockout, setAllowKnockout] = useState<boolean>((p[5] as boolean) ?? false);
  const [showActorPicker, setShowActorPicker] = useState(false);

  const actorNames = useDbNames('actors');

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      {/* 액터 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>액터</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name={`${radioPrefix}-actor`} checked={actorType === 0} onChange={() => setActorType(0)} />
              고정
            </label>
            <button className="db-btn" onClick={() => actorType === 0 && setShowActorPicker(true)}
              disabled={actorType !== 0}
              style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 13, opacity: actorType === 0 ? 1 : 0.5 }}>{getLabel(actorId, actorNames)}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name={`${radioPrefix}-actor`} checked={actorType === 1} onChange={() => setActorType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={actorType === 1 ? (actorId || 1) : 1}
              onChange={v => setActorId(v)} disabled={actorType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      {/* 조작 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name={`${radioPrefix}-op`} checked={operation === 0} onChange={() => setOperation(0)} />
            증가
          </label>
          <label style={radioStyle}>
            <input type="radio" name={`${radioPrefix}-op`} checked={operation === 1} onChange={() => setOperation(1)} />
            감소
          </label>
        </div>
      </fieldset>

      {/* 피연산자 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>피연산자</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name={`${radioPrefix}-operand`} checked={operandType === 0} onChange={() => setOperandType(0)} />
              상수
            </label>
            <input type="number" value={operandType === 0 ? operand : 0} onChange={e => setOperand(Number(e.target.value))}
              min={1} disabled={operandType !== 0} style={{ ...selectStyle, width: 120, opacity: operandType === 0 ? 1 : 0.5 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name={`${radioPrefix}-operand`} checked={operandType === 1} onChange={() => setOperandType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={operandType === 1 ? (operand || 1) : 1}
              onChange={setOperand} disabled={operandType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      {showAllowKnockout && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ddd', cursor: 'pointer' }}>
          <input type="checkbox" checked={allowKnockout} onChange={e => setAllowKnockout(e.target.checked)} />
          전투 불능 상태를 허용
        </label>
      )}

      {showLevelUp && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ddd', cursor: 'pointer' }}>
          <input type="checkbox" checked={allowKnockout} onChange={e => setAllowKnockout(e.target.checked)} />
          레벨업 보여주기
        </label>
      )}

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => {
          const params: unknown[] = [actorType, actorId, operation, operandType, operand];
          if (showAllowKnockout || showLevelUp) params.push(allowKnockout);
          onOk(params);
        }}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPicker items={actorNames} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" />
      )}
    </>
  );
}

export function ChangeHPEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ActorStatChangeEditor p={p} onOk={onOk} onCancel={onCancel} radioPrefix="hp" showAllowKnockout />;
}

export function ChangeMPEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ActorStatChangeEditor p={p} onOk={onOk} onCancel={onCancel} radioPrefix="mp" />;
}

export function ChangeTPEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ActorStatChangeEditor p={p} onOk={onOk} onCancel={onCancel} radioPrefix="tp" />;
}

export function ChangeEXPEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ActorStatChangeEditor p={p} onOk={onOk} onCancel={onCancel} radioPrefix="exp" showLevelUp />;
}

export function ChangeLevelEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <ActorStatChangeEditor p={p} onOk={onOk} onCancel={onCancel} radioPrefix="level" showLevelUp />;
}

/**
 * 능력치 증감 에디터 (코드 317)
 * params: [actorType, actorId, paramId, operation, operandType, operand]
 */
const PARAM_NAMES = ['최대 HP', '최대 MP', '공격', '방어', '마법 공격', '마법 방어', '민첩성', '운'];

export function ChangeParameterEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorType, setActorType] = useState<number>((p[0] as number) || 0);
  const [actorId, setActorId] = useState<number>((p[1] as number) || 1);
  const [paramId, setParamId] = useState<number>((p[2] as number) || 0);
  const [operation, setOperation] = useState<number>((p[3] as number) || 0);
  const [operandType, setOperandType] = useState<number>((p[4] as number) || 0);
  const [operand, setOperand] = useState<number>((p[5] as number) || 1);
  const [showActorPicker, setShowActorPicker] = useState(false);

  const actorNames = useDbNames('actors');

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      {/* 액터 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>액터</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="param-actor" checked={actorType === 0} onChange={() => setActorType(0)} />
              고정
            </label>
            <button className="db-btn" onClick={() => actorType === 0 && setShowActorPicker(true)}
              disabled={actorType !== 0}
              style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 13, opacity: actorType === 0 ? 1 : 0.5 }}>{getLabel(actorId, actorNames)}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="param-actor" checked={actorType === 1} onChange={() => setActorType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={actorType === 1 ? (actorId || 1) : 1}
              onChange={v => setActorId(v)} disabled={actorType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      {/* 능력치 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#ddd' }}>능력치:</span>
        <select value={paramId} onChange={e => setParamId(Number(e.target.value))}
          style={{ ...selectStyle, flex: 1 }}>
          {PARAM_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
        </select>
      </div>

      {/* 조작 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name="param-op" checked={operation === 0} onChange={() => setOperation(0)} />
            증가
          </label>
          <label style={radioStyle}>
            <input type="radio" name="param-op" checked={operation === 1} onChange={() => setOperation(1)} />
            감소
          </label>
        </div>
      </fieldset>

      {/* 피연산자 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>피연산자</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="param-operand" checked={operandType === 0} onChange={() => setOperandType(0)} />
              상수
            </label>
            <input type="number" value={operandType === 0 ? operand : 0} onChange={e => setOperand(Number(e.target.value))}
              min={1} disabled={operandType !== 0} style={{ ...selectStyle, width: 120, opacity: operandType === 0 ? 1 : 0.5 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="param-operand" checked={operandType === 1} onChange={() => setOperandType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={operandType === 1 ? (operand || 1) : 1}
              onChange={setOperand} disabled={operandType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorType, actorId, paramId, operation, operandType, operand])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPicker items={actorNames} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" />
      )}
    </>
  );
}

/**
 * 스테이트 변경 에디터 (코드 313)
 * params: [actorType, actorId, operation, stateId]
 */
export function ChangeStateEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorType, setActorType] = useState<number>((p[0] as number) || 0);
  const [actorId, setActorId] = useState<number>((p[1] as number) || 1);
  const [operation, setOperation] = useState<number>((p[2] as number) || 0);
  const [stateId, setStateId] = useState<number>((p[3] as number) || 1);
  const [showActorPicker, setShowActorPicker] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);

  const actorNames = useDbNames('actors');
  const stateNames = useDbNames('states');

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      {/* 액터 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>액터</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="state-actor" checked={actorType === 0} onChange={() => setActorType(0)} />
              고정
            </label>
            <button className="db-btn" onClick={() => actorType === 0 && setShowActorPicker(true)}
              disabled={actorType !== 0}
              style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 13, opacity: actorType === 0 ? 1 : 0.5 }}>{getLabel(actorId, actorNames)}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="state-actor" checked={actorType === 1} onChange={() => setActorType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={actorType === 1 ? (actorId || 1) : 1}
              onChange={v => setActorId(v)} disabled={actorType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      {/* 조작 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name="state-op" checked={operation === 0} onChange={() => setOperation(0)} />
            추가
          </label>
          <label style={radioStyle}>
            <input type="radio" name="state-op" checked={operation === 1} onChange={() => setOperation(1)} />
            해제
          </label>
        </div>
      </fieldset>

      {/* 스탯 선택 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>스탯:</span>
        <button className="db-btn" onClick={() => setShowStatePicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(stateId, stateNames)}</button>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorType, actorId, operation, stateId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPicker items={actorNames} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" />
      )}
      {showStatePicker && (
        <DataListPicker items={stateNames} value={stateId} onChange={setStateId}
          onClose={() => setShowStatePicker(false)} title="대상 선택" />
      )}
    </>
  );
}

/**
 * 스킬 증감 에디터 (코드 318)
 * params: [actorType, actorId, operation, skillId]
 */
export function ChangeSkillEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorType, setActorType] = useState<number>((p[0] as number) || 0);
  const [actorId, setActorId] = useState<number>((p[1] as number) || 1);
  const [operation, setOperation] = useState<number>((p[2] as number) || 0);
  const [skillId, setSkillId] = useState<number>((p[3] as number) || 1);
  const [showActorPicker, setShowActorPicker] = useState(false);
  const [showSkillPicker, setShowSkillPicker] = useState(false);

  const actorNames = useDbNames('actors');
  const skillNames = useDbNames('skills');

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      {/* 액터 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>액터</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="skill-actor" checked={actorType === 0} onChange={() => setActorType(0)} />
              고정
            </label>
            <button className="db-btn" onClick={() => actorType === 0 && setShowActorPicker(true)}
              disabled={actorType !== 0}
              style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 13, opacity: actorType === 0 ? 1 : 0.5 }}>{getLabel(actorId, actorNames)}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="skill-actor" checked={actorType === 1} onChange={() => setActorType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={actorType === 1 ? (actorId || 1) : 1}
              onChange={v => setActorId(v)} disabled={actorType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      {/* 조작 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name="skill-op" checked={operation === 0} onChange={() => setOperation(0)} />
            배우다
          </label>
          <label style={radioStyle}>
            <input type="radio" name="skill-op" checked={operation === 1} onChange={() => setOperation(1)} />
            까먹다
          </label>
        </div>
      </fieldset>

      {/* 스킬 선택 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>스킬:</span>
        <button className="db-btn" onClick={() => setShowSkillPicker(true)}
          style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13 }}>{getLabel(skillId, skillNames)}</button>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorType, actorId, operation, skillId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPicker items={actorNames} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" />
      )}
      {showSkillPicker && (
        <DataListPicker items={skillNames} value={skillId} onChange={setSkillId}
          onClose={() => setShowSkillPicker(false)} title="대상 선택" />
      )}
    </>
  );
}

/**
 * 모두 회복 에디터 (코드 314)
 * params: [actorType, actorId]
 * actorType: 0=고정, 1=변수
 * actorId: 고정 시 0=전체 파티, 1~N=특정 액터 / 변수 시 변수 ID
 */
export function RecoverAllEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorType, setActorType] = useState<number>((p[0] as number) || 0);
  const [actorId, setActorId] = useState<number>((p[1] as number) || 0);
  const [showActorPicker, setShowActorPicker] = useState(false);

  const actorNames = useDbNames('actors');

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  const actorLabel = actorId === 0
    ? '0000 전체 파티'
    : getLabel(actorId, actorNames);

  // "전체 파티"를 인덱스 0에 포함하는 목록 생성
  const actorListWithAll = useMemo(() => {
    const list = ['전체 파티', ...actorNames.slice(1)];
    return list;
  }, [actorNames]);

  return (
    <>
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>액터</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="recover-actor" checked={actorType === 0} onChange={() => setActorType(0)} />
              고정
            </label>
            <button className="db-btn" onClick={() => actorType === 0 && setShowActorPicker(true)}
              disabled={actorType !== 0}
              style={{ flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 13, opacity: actorType === 0 ? 1 : 0.5 }}>{actorLabel}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="recover-actor" checked={actorType === 1} onChange={() => setActorType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={actorType === 1 ? (actorId || 1) : 1}
              onChange={v => setActorId(v)} disabled={actorType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorType, actorId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPickerWithZero items={actorListWithAll} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" />
      )}
    </>
  );
}

/** 인덱스 0부터 시작하는 DataListPicker (전체 파티 등 0번 항목 포함) */
function DataListPickerWithZero({ items, value, onChange, onClose, title }: {
  items: string[]; value: number; onChange: (id: number) => void; onClose: () => void; title?: string;
}) {
  const GROUP_SIZE = 20;
  const totalCount = items.length;
  const groups = useMemo(() => {
    const result: { label: string; startId: number; endId: number }[] = [];
    for (let start = 0; start < totalCount; start += GROUP_SIZE) {
      const end = Math.min(start + GROUP_SIZE - 1, totalCount - 1);
      result.push({
        label: `[ ${String(start).padStart(4, '0')} - ${String(end).padStart(4, '0')} ]`,
        startId: start,
        endId: end,
      });
    }
    return result;
  }, [totalCount]);

  const initGroupIdx = Math.max(0, Math.floor(value / GROUP_SIZE));
  const [selectedGroup, setSelectedGroup] = useState(initGroupIdx);
  const [selected, setSelected] = useState(value);

  const currentGroup = groups[selectedGroup];
  const groupItems = useMemo(() => {
    if (!currentGroup) return [];
    const result: { id: number; label: string }[] = [];
    for (let i = currentGroup.startId; i <= currentGroup.endId; i++) {
      result.push({ id: i, label: `${String(i).padStart(4, '0')} ${items[i] || ''}` });
    }
    return result;
  }, [currentGroup, items]);

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="image-picker-dialog" style={{ width: 500, maxHeight: '70vh' }}>
        <div className="image-picker-header">{title || '대상 선택'}</div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 300 }}>
          <div style={{ width: 170, borderRight: '1px solid #444', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {groups.map((g, idx) => (
              <div key={g.startId} style={{
                padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#ccc',
                background: idx === selectedGroup ? '#2675bf' : 'transparent',
              }} onClick={() => setSelectedGroup(idx)}>{g.label}</div>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {groupItems.map(item => (
              <div key={item.id} style={{
                padding: '3px 8px', cursor: 'pointer', fontSize: 12, color: '#ddd',
                background: item.id === selected ? '#2675bf' : 'transparent',
              }} onClick={() => setSelected(item.id)} onDoubleClick={() => { onChange(item.id); onClose(); }}>{item.label}</div>
            ))}
          </div>
        </div>
        <div className="image-picker-footer">
          <button className="db-btn" onClick={() => { onChange(selected); onClose(); }}>OK</button>
          <button className="db-btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}

/**
 * 직업 변경 에디터 (코드 321)
 * params: [actorId, classId, keepLevel]
 */
export function ChangeClassEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [classId, setClassId] = useState<number>((p[1] as number) || 1);
  const [keepLevel, setKeepLevel] = useState<boolean>((p[2] as boolean) || false);
  const actors = useDbNames('actors');
  const classes = useDbNames('classes');
  const [showActorPicker, setShowActorPicker] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <input type="text" readOnly value={getLabel(actorId, actors)}
            style={{ ...selectStyle, flex: 1 }} />
          <button className="db-btn" onClick={() => setShowActorPicker(true)}
            style={{ padding: '4px 8px', fontSize: 13, minWidth: 32 }}>...</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>직업:</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <input type="text" readOnly value={getLabel(classId, classes)}
            style={{ ...selectStyle, flex: 1 }} />
          <button className="db-btn" onClick={() => setShowClassPicker(true)}
            style={{ padding: '4px 8px', fontSize: 13, minWidth: 32 }}>...</button>
        </div>
      </div>
      <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input type="checkbox" checked={keepLevel} onChange={e => setKeepLevel(e.target.checked)} />
        레벨 저장
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, classId, keepLevel])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
      {showActorPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="대상 선택" />
      )}
      {showClassPicker && (
        <DataListPicker items={classes} value={classId} onChange={setClassId}
          onClose={() => setShowClassPicker(false)} title="대상 선택" />
      )}
    </>
  );
}

/**
 * 장비 변경 에디터 (코드 319)
 * params: [actorId, etypeId, itemId]
 * etypeId: 1=무기, 2=방패, 3=머리, 4=몸, 5=액세서리
 * itemId: 0=없음, etypeId===1이면 무기ID, 그 외 방어구ID
 */
export function ChangeEquipmentEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [etypeId, setEtypeId] = useState<number>((p[1] as number) || 1);
  const [itemId, setItemId] = useState<number>((p[2] as number) || 0);
  const [showActorPicker, setShowActorPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);

  const actors = useDbNames('actors');
  const weapons = useDbNames('weapons');
  const armors = useDbNames('armors');

  const EQUIP_TYPES = [
    { id: 1, label: '무기' },
    { id: 2, label: '방패' },
    { id: 3, label: '머리' },
    { id: 4, label: '몸' },
    { id: 5, label: '액세서리' },
  ];

  const isWeapon = etypeId === 1;

  // 장비 아이템 목록 (0번 = 없음)
  const filteredItems = useMemo(() => {
    const list: string[] = ['없음'];
    if (isWeapon) {
      for (let i = 1; i < weapons.length; i++) {
        list[i] = weapons[i] || '';
      }
    } else {
      for (let i = 1; i < armors.length; i++) {
        list[i] = armors[i] || '';
      }
    }
    return list;
  }, [isWeapon, weapons, armors]);

  const itemLabel = itemId === 0
    ? '없음'
    : getLabel(itemId, isWeapon ? weapons : armors);

  const handleEtypeChange = (newEtype: number) => {
    setEtypeId(newEtype);
    setItemId(0);
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <input type="text" readOnly value={getLabel(actorId, actors)}
            style={{ ...selectStyle, flex: 1 }} />
          <button className="db-btn" onClick={() => setShowActorPicker(true)}
            style={{ padding: '4px 8px', fontSize: 13, minWidth: 32 }}>...</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>장비 유형:</span>
        <select value={etypeId} onChange={e => handleEtypeChange(Number(e.target.value))} style={selectStyle}>
          {EQUIP_TYPES.map(et => (
            <option key={et.id} value={et.id}>{et.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>장비 아이템:</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <input type="text" readOnly value={itemLabel}
            style={{ ...selectStyle, flex: 1 }} />
          <button className="db-btn" onClick={() => setShowItemPicker(true)}
            style={{ padding: '4px 8px', fontSize: 13, minWidth: 32 }}>...</button>
        </div>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, etypeId, itemId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" />
      )}
      {showItemPicker && (
        <DataListPickerWithZero items={filteredItems} value={itemId} onChange={setItemId}
          onClose={() => setShowItemPicker(false)} title="장비 아이템 선택" />
      )}
    </>
  );
}

export function ChangeNameEditor({ p, onOk, onCancel, label }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; label: string }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [name, setName] = useState<string>((p[1] as string) || '');
  const actors = useDbNames('actors');
  const [showPicker, setShowPicker] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <input type="text" readOnly value={getLabel(actorId, actors)}
            style={{ ...selectStyle, flex: 1 }} />
          <button className="db-btn" onClick={() => setShowPicker(true)}
            style={{ padding: '4px 8px', fontSize: 13, minWidth: 32 }}>...</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>{label}</span>
        <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ ...selectStyle, width: '100%' }} />
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, name])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
      {showPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowPicker(false)} title="대상 선택" />
      )}
    </>
  );
}

/**
 * 이름 입력 처리 에디터 (코드 303)
 * params: [actorId, maxCharacters]
 */
export function NameInputEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [maxChars, setMaxChars] = useState<number>((p[1] as number) || 8);
  const actors = useDbNames('actors');
  const [showPicker, setShowPicker] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <input type="text" readOnly value={getLabel(actorId, actors)}
            style={{ ...selectStyle, flex: 1 }} />
          <button className="db-btn" onClick={() => setShowPicker(true)}
            style={{ padding: '4px 8px', fontSize: 13, minWidth: 32 }}>...</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>최대 문자 수:</span>
        <input type="number" value={maxChars} onChange={e => setMaxChars(Math.max(1, Math.min(16, Number(e.target.value))))}
          min={1} max={16} style={{ ...selectStyle, width: 120 }} />
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, maxChars])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
      {showPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowPicker(false)} title="대상 선택" />
      )}
    </>
  );
}

export function ChangeProfileEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [profile, setProfile] = useState<string>((p[1] as string) || '');
  const actors = useDbNames('actors');
  const [showPicker, setShowPicker] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>액터:</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <input type="text" readOnly value={getLabel(actorId, actors)}
            style={{ ...selectStyle, flex: 1 }} />
          <button className="db-btn" onClick={() => setShowPicker(true)}
            style={{ padding: '4px 8px', fontSize: 13, minWidth: 32 }}>...</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>프로필:</span>
        <textarea value={profile} onChange={e => setProfile(e.target.value)}
          rows={4}
          style={{ ...selectStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.4' }} />
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, profile])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
      {showPicker && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowPicker(false)} title="대상 선택" />
      )}
    </>
  );
}
