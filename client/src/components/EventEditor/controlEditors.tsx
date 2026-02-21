import React, { useState } from 'react';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';

export { DataListPicker, CharacterSprite, IconSprite, type CharacterInfo } from './dataListPicker';
<<<<<<< HEAD
=======
export { ControlVariablesEditor } from './controlVariablesEditor';
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f

export function ControlSwitchesEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const initStart = (p[0] as number) || 1;
  const initEnd = (p[1] as number) || 1;
  const [mode, setMode] = useState<'single' | 'range'>(initStart === initEnd ? 'single' : 'range');
  const [singleId, setSingleId] = useState<number>(initStart);
  const [rangeStart, setRangeStart] = useState<number>(initStart);
  const [rangeEnd, setRangeEnd] = useState<number>(initEnd);
  const [value, setValue] = useState<number>((p[2] as number) || 0);

  const handleOk = () => {
    if (mode === 'single') {
      onOk([singleId, singleId, value]);
    } else {
      const s = Math.min(rangeStart, rangeEnd);
      const e = Math.max(rangeStart, rangeEnd);
      onOk([s, e, value]);
    }
  };

  return (
    <>
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>스위치</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#ddd', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="radio" checked={mode === 'single'} onChange={() => setMode('single')} />
            단독
          </label>
          <VariableSwitchPicker type="switch" value={singleId} onChange={setSingleId} disabled={mode !== 'single'} style={{ flex: 1 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#ddd', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="radio" checked={mode === 'range'} onChange={() => setMode('range')} />
            범위
          </label>
          <VariableSwitchPicker type="switch" value={rangeStart} onChange={setRangeStart} disabled={mode !== 'range'} style={{ flex: 1 }} />
          <span style={{ color: '#aaa', fontSize: 13 }}>~</span>
          <VariableSwitchPicker type="switch" value={rangeEnd} onChange={setRangeEnd} disabled={mode !== 'range'} style={{ flex: 1 }} />
        </div>
      </fieldset>

      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#ddd', cursor: 'pointer' }}>
            <input type="radio" checked={value === 0} onChange={() => setValue(0)} />
            ON
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#ddd', cursor: 'pointer' }}>
            <input type="radio" checked={value === 1} onChange={() => setValue(1)} />
            OFF
          </label>
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={handleOk}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

export function ControlSelfSwitchEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [switchCh, setSwitchCh] = useState<string>((p[0] as string) || 'A');
  const [value, setValue] = useState<number>((p[1] as number) || 0);
  return (
    <>
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>셀프 스위치</legend>
        <select value={switchCh} onChange={e => setSwitchCh(e.target.value)} style={selectStyle}>
          {['A', 'B', 'C', 'D'].map(ch => <option key={ch} value={ch}>{ch}</option>)}
        </select>
      </fieldset>
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="radio" name="self-switch-op" checked={value === 0} onChange={() => setValue(0)} /> ON
          </label>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="radio" name="self-switch-op" checked={value === 1} onChange={() => setValue(1)} /> OFF
          </label>
        </div>
      </fieldset>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([switchCh, value])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

export function ControlTimerEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [operation, setOperation] = useState<number>((p[0] as number) || 0);
  const totalSec = (p[1] as number) || 60;
  const [minutes, setMinutes] = useState<number>(Math.floor(totalSec / 60));
  const [seconds, setSeconds] = useState<number>(totalSec % 60);

  const handleOk = () => {
    const total = minutes * 60 + seconds;
    onOk(operation === 0 ? [operation, total] : [operation, 0]);
  };

  return (
    <>
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="radio" name="timer-op" checked={operation === 0} onChange={() => setOperation(0)} /> 시작
          </label>
          <label style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="radio" name="timer-op" checked={operation === 1} onChange={() => setOperation(1)} /> 정지
          </label>
        </div>
      </fieldset>
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0, opacity: operation === 0 ? 1 : 0.5 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>시간</legend>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="number" value={minutes} onChange={e => setMinutes(Math.max(0, Math.min(99, Number(e.target.value))))}
            min={0} max={99} disabled={operation === 1} style={{ ...selectStyle, width: 70 }} />
          <span style={{ fontSize: 13, color: '#ddd' }}>분</span>
          <input type="number" value={seconds} onChange={e => setSeconds(Math.max(0, Math.min(59, Number(e.target.value))))}
            min={0} max={59} disabled={operation === 1} style={{ ...selectStyle, width: 70 }} />
          <span style={{ fontSize: 13, color: '#ddd' }}>초</span>
        </div>
      </fieldset>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={handleOk}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}
