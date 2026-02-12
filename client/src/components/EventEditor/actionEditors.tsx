import React, { useState, useEffect } from 'react';
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
        <div style={{ display: 'flex', gap: 4 }}>
          <input type="text" readOnly value={itemLabel}
            style={{ ...selectStyle, flex: 1, cursor: 'pointer' }}
            onClick={() => setShowPicker(true)} />
          <button className="db-btn" onClick={() => setShowPicker(true)} style={{ padding: '2px 8px' }}>...</button>
        </div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>액터:</span>
        <input type="text" readOnly value={getLabel(actorId, actors)}
          style={{ ...selectStyle, flex: 1, cursor: 'pointer' }}
          onClick={() => setShowPicker(true)} />
        <button className="db-btn" style={{ padding: '4px 8px' }}
          onClick={() => setShowPicker(true)}>...</button>
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
 * HP 증감 (Change HP, code 311)
 * params: [actorType, actorId, operation, operandType, operand, allowKnockout]
 */
export function ChangeHPEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
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
              <input type="radio" name="hp-actor" checked={actorType === 0} onChange={() => setActorType(0)} />
              고정
            </label>
            <div style={{ display: 'flex', gap: 4, flex: 1, opacity: actorType === 0 ? 1 : 0.5 }}>
              <input type="text" readOnly value={getLabel(actorId, actorNames)}
                style={{ ...selectStyle, flex: 1, cursor: actorType === 0 ? 'pointer' : 'default' }}
                onClick={() => actorType === 0 && setShowActorPicker(true)} />
              <button className="db-btn" onClick={() => actorType === 0 && setShowActorPicker(true)}
                disabled={actorType !== 0} style={{ padding: '2px 8px' }}>...</button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="hp-actor" checked={actorType === 1} onChange={() => setActorType(1)} />
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
            <input type="radio" name="hp-op" checked={operation === 0} onChange={() => setOperation(0)} />
            증가
          </label>
          <label style={radioStyle}>
            <input type="radio" name="hp-op" checked={operation === 1} onChange={() => setOperation(1)} />
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
              <input type="radio" name="hp-operand" checked={operandType === 0} onChange={() => setOperandType(0)} />
              상수
            </label>
            <input type="number" value={operandType === 0 ? operand : 0} onChange={e => setOperand(Number(e.target.value))}
              min={1} disabled={operandType !== 0} style={{ ...selectStyle, width: 120, opacity: operandType === 0 ? 1 : 0.5 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="hp-operand" checked={operandType === 1} onChange={() => setOperandType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={operandType === 1 ? (operand || 1) : 1}
              onChange={setOperand} disabled={operandType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

      {/* 전투 불능 상태를 허용 */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ddd', cursor: 'pointer' }}>
        <input type="checkbox" checked={allowKnockout} onChange={e => setAllowKnockout(e.target.checked)} />
        전투 불능 상태를 허용
      </label>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorType, actorId, operation, operandType, operand, allowKnockout])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showActorPicker && (
        <DataListPicker items={actorNames} value={actorId} onChange={setActorId}
          onClose={() => setShowActorPicker(false)} title="액터 선택" />
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>액터:</span>
        <input type="text" readOnly value={getLabel(actorId, actors)}
          style={{ ...selectStyle, flex: 1, cursor: 'pointer' }}
          onClick={() => setShowPicker(true)} />
        <button className="db-btn" style={{ padding: '4px 8px' }}
          onClick={() => setShowPicker(true)}>...</button>
      </div>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        {label}
        <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ ...selectStyle, width: '100%' }} />
      </label>
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
