import React from 'react';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import { radioStyle, rowStyle, disabledOpacity, COMPARISON_OPS } from './condBranchHelpers';

interface Props {
  condType: number;
  onCondTypeChange: (t: number) => void;
  switchId: number; setSwitchId: (v: number) => void;
  switchValue: number; setSwitchValue: (v: number) => void;
  varId: number; setVarId: (v: number) => void;
  varOperandType: number; setVarOperandType: (v: number) => void;
  varOperand: number; setVarOperand: (v: number) => void;
  varCompare: number; setVarCompare: (v: number) => void;
  selfSwitch: string; setSelfSwitch: (v: string) => void;
  selfSwitchValue: number; setSelfSwitchValue: (v: number) => void;
  timerMin: number; setTimerMin: (v: number) => void;
  timerSec: number; setTimerSec: (v: number) => void;
  timerCompare: number; setTimerCompare: (v: number) => void;
}

export function CondBranchTab1({
  condType, onCondTypeChange,
  switchId, setSwitchId, switchValue, setSwitchValue,
  varId, setVarId, varOperandType, setVarOperandType, varOperand, setVarOperand, varCompare, setVarCompare,
  selfSwitch, setSelfSwitch, selfSwitchValue, setSelfSwitchValue,
  timerMin, setTimerMin, timerSec, setTimerSec, timerCompare, setTimerCompare,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 스위치 */}
      <div style={rowStyle}>
        <label style={radioStyle}>
          <input type="radio" name="cb-type" checked={condType === 0} onChange={() => onCondTypeChange(0)} />
          스위치
        </label>
        <VariableSwitchPicker type="switch" value={switchId} onChange={setSwitchId} disabled={condType !== 0} style={{ flex: 1 }} />
        <span style={{ color: '#aaa', fontSize: 13 }}>(은)는</span>
        <select value={switchValue} onChange={e => setSwitchValue(Number(e.target.value))}
          disabled={condType !== 0} style={{ ...selectStyle, ...disabledOpacity(condType === 0) }}>
          <option value={0}>ON</option>
          <option value={1}>OFF</option>
        </select>
      </div>

      {/* 변수 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={rowStyle}>
          <label style={radioStyle}>
            <input type="radio" name="cb-type" checked={condType === 1} onChange={() => onCondTypeChange(1)} />
            변수
          </label>
          <VariableSwitchPicker type="variable" value={varId} onChange={setVarId} disabled={condType !== 1} style={{ flex: 1 }} />
          <select value={varCompare} onChange={e => setVarCompare(Number(e.target.value))}
            disabled={condType !== 1} style={{ ...selectStyle, width: 60, ...disabledOpacity(condType === 1) }}>
            {COMPARISON_OPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div style={{ marginLeft: 40, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={rowStyle}>
            <label style={{ ...radioStyle, ...disabledOpacity(condType === 1) }}>
              <input type="radio" name="cb-var-operand" checked={varOperandType === 0}
                onChange={() => setVarOperandType(0)} disabled={condType !== 1} />
              정수
            </label>
            <input type="number" value={varOperandType === 0 ? varOperand : 0}
              onChange={e => setVarOperand(Number(e.target.value))}
              disabled={condType !== 1 || varOperandType !== 0}
              style={{ ...selectStyle, width: 100, ...disabledOpacity(condType === 1 && varOperandType === 0) }} />
          </div>
          <div style={rowStyle}>
            <label style={{ ...radioStyle, ...disabledOpacity(condType === 1) }}>
              <input type="radio" name="cb-var-operand" checked={varOperandType === 1}
                onChange={() => setVarOperandType(1)} disabled={condType !== 1} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={varOperand} onChange={setVarOperand}
              disabled={condType !== 1 || varOperandType !== 1} style={{ flex: 1 }} />
          </div>
        </div>
      </div>

      {/* 셀프 스위치 */}
      <div style={rowStyle}>
        <label style={radioStyle}>
          <input type="radio" name="cb-type" checked={condType === 2} onChange={() => onCondTypeChange(2)} />
          셀프스위치
        </label>
        <select value={selfSwitch} onChange={e => setSelfSwitch(e.target.value)}
          disabled={condType !== 2} style={{ ...selectStyle, width: 60, ...disabledOpacity(condType === 2) }}>
          {['A', 'B', 'C', 'D'].map(ch => <option key={ch} value={ch}>{ch}</option>)}
        </select>
        <span style={{ color: '#aaa', fontSize: 13 }}>(은)는</span>
        <select value={selfSwitchValue} onChange={e => setSelfSwitchValue(Number(e.target.value))}
          disabled={condType !== 2} style={{ ...selectStyle, ...disabledOpacity(condType === 2) }}>
          <option value={0}>ON</option>
          <option value={1}>OFF</option>
        </select>
      </div>

      {/* 타이머 */}
      <div style={rowStyle}>
        <label style={radioStyle}>
          <input type="radio" name="cb-type" checked={condType === 3} onChange={() => onCondTypeChange(3)} />
          타이머
        </label>
        <select value={timerCompare} onChange={e => setTimerCompare(Number(e.target.value))}
          disabled={condType !== 3} style={{ ...selectStyle, width: 60, ...disabledOpacity(condType === 3) }}>
          <option value={0}>≥</option>
          <option value={1}>≤</option>
        </select>
        <input type="number" value={timerMin} onChange={e => setTimerMin(Math.max(0, Math.min(99, Number(e.target.value))))}
          min={0} max={99} disabled={condType !== 3} style={{ ...selectStyle, width: 60, ...disabledOpacity(condType === 3) }} />
        <span style={{ color: '#ddd' }}>분</span>
        <input type="number" value={timerSec} onChange={e => setTimerSec(Math.max(0, Math.min(59, Number(e.target.value))))}
          min={0} max={59} disabled={condType !== 3} style={{ ...selectStyle, width: 60, ...disabledOpacity(condType === 3) }} />
        <span style={{ color: '#ddd' }}>초</span>
      </div>
    </div>
  );
}
