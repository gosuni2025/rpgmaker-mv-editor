import React, { useState } from 'react';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import { useDbNamesWithIcons, getLabel } from './actionEditorUtils';
import { DataListPicker } from './dataListPicker';

const ENEMY_OPTIONS = [
  { value: -1, label: '전체 적 군단' },
  { value: 0, label: '#1?' },
  { value: 1, label: '#2?' },
  { value: 2, label: '#3?' },
  { value: 3, label: '#4?' },
  { value: 4, label: '#5?' },
  { value: 5, label: '#6?' },
  { value: 6, label: '#7?' },
  { value: 7, label: '#8?' },
];

/**
 * 적 HP/MP/TP 변경 공용 에디터
 * HP(331): params: [enemyIndex, operation, operandType, operand, allowKnockout]
 * MP(332)/TP(342): params: [enemyIndex, operation, operandType, operand]
 */
function EnemyStatChangeEditor({ p, onOk, onCancel, radioPrefix, showAllowKnockout }: {
  p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void;
  radioPrefix: string; showAllowKnockout?: boolean;
}) {
  const [enemyIndex, setEnemyIndex] = useState<number>((p[0] as number) ?? -1);
  const [operation, setOperation] = useState<number>((p[1] as number) || 0);
  const [operandType, setOperandType] = useState<number>((p[2] as number) || 0);
  const [operand, setOperand] = useState<number>((p[3] as number) || 1);
  const [allowKnockout, setAllowKnockout] = useState<boolean>((p[4] as boolean) ?? false);

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      {/* 적 캐릭터 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#ddd', whiteSpace: 'nowrap' }}>적 캐릭터:</span>
        <select value={enemyIndex} onChange={e => setEnemyIndex(Number(e.target.value))}
          style={{ ...selectStyle, flex: 1 }}>
          {ENEMY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

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

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => {
          const params: unknown[] = [enemyIndex, operation, operandType, operand];
          if (showAllowKnockout) params.push(allowKnockout);
          onOk(params);
        }}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

/** 적 HP 변경 (코드 331) */
export function ChangeEnemyHPEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <EnemyStatChangeEditor p={p} onOk={onOk} onCancel={onCancel} radioPrefix="enemy-hp" showAllowKnockout />;
}

/** 적 MP 변경 (코드 332) */
export function ChangeEnemyMPEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <EnemyStatChangeEditor p={p} onOk={onOk} onCancel={onCancel} radioPrefix="enemy-mp" />;
}

/** 적 TP 변경 (코드 342) */
export function ChangeEnemyTPEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  return <EnemyStatChangeEditor p={p} onOk={onOk} onCancel={onCancel} radioPrefix="enemy-tp" />;
}

/**
 * 적 캐릭터의 완전 회복 에디터 (코드 334)
 * params: [enemyIndex]
 */
export function EnemyRecoverAllEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [enemyIndex, setEnemyIndex] = useState<number>((p[0] as number) ?? -1);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#ddd', whiteSpace: 'nowrap' }}>적 캐릭터:</span>
        <select value={enemyIndex} onChange={e => setEnemyIndex(Number(e.target.value))}
          style={{ ...selectStyle, flex: 1 }}>
          {ENEMY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([enemyIndex])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

/**
 * 적 스테이트 변경 에디터 (코드 333)
 * params: [enemyIndex, operation(0=추가/1=해제), stateId]
 */
export function ChangeEnemyStateEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [enemyIndex, setEnemyIndex] = useState<number>((p[0] as number) ?? -1);
  const [operation, setOperation] = useState<number>((p[1] as number) || 0);
  const [stateId, setStateId] = useState<number>((p[2] as number) || 1);
  const [showStatePicker, setShowStatePicker] = useState(false);

  const { names: stateNames, iconIndices: stateIcons } = useDbNamesWithIcons('states');

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  return (
    <>
      {/* 적 캐릭터 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#ddd', whiteSpace: 'nowrap' }}>적 캐릭터:</span>
        <select value={enemyIndex} onChange={e => setEnemyIndex(Number(e.target.value))}
          style={{ ...selectStyle, flex: 1 }}>
          {ENEMY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {/* 조작 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={radioStyle}>
            <input type="radio" name="enemy-state-op" checked={operation === 0} onChange={() => setOperation(0)} />
            추가
          </label>
          <label style={radioStyle}>
            <input type="radio" name="enemy-state-op" checked={operation === 1} onChange={() => setOperation(1)} />
            해제
          </label>
        </div>
      </fieldset>

      {/* 스테이트 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#ddd', whiteSpace: 'nowrap' }}>스테이트:</span>
        <button className="db-btn" style={{ flex: 1, textAlign: 'left' }}
          onClick={() => setShowStatePicker(true)}>
          {getLabel(stateId, stateNames)}
        </button>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([enemyIndex, operation, stateId])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showStatePicker && (
        <DataListPicker items={stateNames} value={stateId} onChange={setStateId}
          onClose={() => setShowStatePicker(false)} title="스테이트" iconIndices={stateIcons} />
      )}
    </>
  );
}
