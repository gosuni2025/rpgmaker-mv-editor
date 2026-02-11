import React, { useState, useMemo } from 'react';
import type { EventCommand, AudioFile } from '../../types/rpgMakerMV';
import AudioPicker from '../common/AudioPicker';
import ImagePicker from '../common/ImagePicker';

export const DEFAULT_AUDIO: AudioFile = { name: '', pan: 0, pitch: 100, volume: 90 };

export const selectStyle = { background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13 } as const;

export function ShowTextEditor({ p, onOk, onCancel, existingLines }: { p: unknown[]; onOk: (params: unknown[], extra?: EventCommand[]) => void; onCancel: () => void; existingLines?: string[] }) {
  const [faceName, setFaceName] = useState<string>((p[0] as string) || '');
  const [faceIndex, setFaceIndex] = useState<number>((p[1] as number) || 0);
  const [background, setBackground] = useState<number>((p[2] as number) || 0);
  const [positionType, setPositionType] = useState<number>((p[3] as number) || 2);
  const [text, setText] = useState(existingLines?.join('\n') || '');

  const handleOk = () => {
    const lines = text.split('\n').filter((_, i) => i < 4);
    const extra: EventCommand[] = lines.map(line => ({ code: 401, indent: 0, parameters: [line] }));
    onOk([faceName, faceIndex, background, positionType], extra);
  };

  return (
    <>
      <div style={{ fontSize: 12, color: '#aaa' }}>
        Face
        <ImagePicker type="faces" value={faceName} onChange={setFaceName} index={faceIndex} onIndexChange={setFaceIndex} />
      </div>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Background
        <select value={background} onChange={e => setBackground(Number(e.target.value))} style={selectStyle}>
          <option value={0}>Window</option>
          <option value={1}>Dim</option>
          <option value={2}>Transparent</option>
        </select>
      </label>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Position
        <select value={positionType} onChange={e => setPositionType(Number(e.target.value))} style={selectStyle}>
          <option value={0}>Top</option>
          <option value={1}>Middle</option>
          <option value={2}>Bottom</option>
        </select>
      </label>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Text (max 4 lines)
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
          style={{ ...selectStyle, width: '100%', resize: 'vertical', fontFamily: 'monospace' }} />
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={handleOk}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

export function TextEditor({ p, onOk, onCancel, followCode, label, showSpeed, existingLines }: {
  p: unknown[]; onOk: (params: unknown[], extra?: EventCommand[]) => void; onCancel: () => void;
  followCode: number; label: string; showSpeed?: boolean; existingLines?: string[];
}) {
  const [text, setText] = useState<string>(() => {
    if (existingLines && existingLines.length > 0) {
      // 첫 번째 라인은 메인 커맨드의 p[0] (showSpeed가 아닌 경우)
      if (!showSpeed && p[0]) return [p[0] as string, ...existingLines].join('\n');
      return existingLines.join('\n');
    }
    return (p[0] as string) || '';
  });
  const [speed, setSpeed] = useState<number>(showSpeed ? ((p[0] as number) || 2) : 2);

  const handleOk = () => {
    const lines = text.split('\n');
    const firstLine = lines[0] || '';
    const extra: EventCommand[] = lines.slice(1).map(line => ({ code: followCode, indent: 0, parameters: [line] }));
    if (showSpeed) {
      onOk([speed, false], [{ code: followCode === 405 ? 405 : followCode, indent: 0, parameters: [text] }, ...extra.slice(0, 0)]);
      // For scrolling text: param is [speed, noFast]
      const scrollLines = text.split('\n');
      const scrollExtra: EventCommand[] = scrollLines.map(line => ({ code: 405, indent: 0, parameters: [line] }));
      onOk([speed, false], scrollExtra);
    } else {
      onOk([firstLine], extra);
    }
  };

  return (
    <>
      {showSpeed && (
        <label style={{ fontSize: 12, color: '#aaa' }}>
          Speed
          <input type="number" value={speed} onChange={e => setSpeed(Number(e.target.value))} min={1} max={8} style={{ ...selectStyle, width: 60 }} />
        </label>
      )}
      <label style={{ fontSize: 12, color: '#aaa' }}>
        {label}
        <textarea value={text} onChange={e => setText(e.target.value)} rows={8}
          style={{ ...selectStyle, width: '100%', resize: 'vertical', fontFamily: 'monospace' }} />
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={handleOk}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

export function SingleTextEditor({ p, onOk, onCancel, label }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; label: string }) {
  const [value, setValue] = useState<string>((p[0] as string) || '');
  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        {label}
        <input type="text" value={value} onChange={e => setValue(e.target.value)} style={{ ...selectStyle, width: '100%' }} />
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([value])}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

export function SingleNumberEditor({ p, onOk, onCancel, label }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; label: string }) {
  const [value, setValue] = useState<number>((p[0] as number) || 0);
  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        {label}
        <input type="number" value={value} onChange={e => setValue(Number(e.target.value))} style={{ ...selectStyle, width: 120 }} />
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([value])}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

export function ControlSwitchesEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [startId, setStartId] = useState<number>((p[0] as number) || 1);
  const [endId, setEndId] = useState<number>((p[1] as number) || 1);
  const [value, setValue] = useState<number>((p[2] as number) || 0);
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: '#aaa' }}>
          Start ID
          <input type="number" value={startId} onChange={e => setStartId(Number(e.target.value))} min={1} style={{ ...selectStyle, width: 80 }} />
        </label>
        <label style={{ fontSize: 12, color: '#aaa' }}>
          End ID
          <input type="number" value={endId} onChange={e => setEndId(Number(e.target.value))} min={1} style={{ ...selectStyle, width: 80 }} />
        </label>
      </div>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Operation
        <select value={value} onChange={e => setValue(Number(e.target.value))} style={selectStyle}>
          <option value={0}>ON</option>
          <option value={1}>OFF</option>
        </select>
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([startId, endId, value])}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

export function ControlVariablesEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [startId, setStartId] = useState<number>((p[0] as number) || 1);
  const [endId, setEndId] = useState<number>((p[1] as number) || 1);
  const [opType, setOpType] = useState<number>((p[2] as number) || 0);
  const [operandType, setOperandType] = useState<number>((p[3] as number) || 0);
  const [operand, setOperand] = useState<number>((p[4] as number) || 0);
  const [operand2, setOperand2] = useState<number>((p[5] as number) || 0);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: '#aaa' }}>
          Start ID
          <input type="number" value={startId} onChange={e => setStartId(Number(e.target.value))} min={1} style={{ ...selectStyle, width: 80 }} />
        </label>
        <label style={{ fontSize: 12, color: '#aaa' }}>
          End ID
          <input type="number" value={endId} onChange={e => setEndId(Number(e.target.value))} min={1} style={{ ...selectStyle, width: 80 }} />
        </label>
      </div>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Operation
        <select value={opType} onChange={e => setOpType(Number(e.target.value))} style={selectStyle}>
          <option value={0}>Set</option>
          <option value={1}>Add</option>
          <option value={2}>Sub</option>
          <option value={3}>Mul</option>
          <option value={4}>Div</option>
          <option value={5}>Mod</option>
        </select>
      </label>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Operand Type
        <select value={operandType} onChange={e => setOperandType(Number(e.target.value))} style={selectStyle}>
          <option value={0}>Constant</option>
          <option value={1}>Variable</option>
          <option value={2}>Random</option>
          <option value={4}>Script</option>
        </select>
      </label>
      {operandType === 0 && (
        <label style={{ fontSize: 12, color: '#aaa' }}>
          Value
          <input type="number" value={operand} onChange={e => setOperand(Number(e.target.value))} style={{ ...selectStyle, width: 120 }} />
        </label>
      )}
      {operandType === 1 && (
        <label style={{ fontSize: 12, color: '#aaa' }}>
          Variable ID
          <input type="number" value={operand} onChange={e => setOperand(Number(e.target.value))} min={1} style={{ ...selectStyle, width: 120 }} />
        </label>
      )}
      {operandType === 2 && (
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ fontSize: 12, color: '#aaa' }}>
            Min
            <input type="number" value={operand} onChange={e => setOperand(Number(e.target.value))} style={{ ...selectStyle, width: 80 }} />
          </label>
          <label style={{ fontSize: 12, color: '#aaa' }}>
            Max
            <input type="number" value={operand2} onChange={e => setOperand2(Number(e.target.value))} style={{ ...selectStyle, width: 80 }} />
          </label>
        </div>
      )}
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => {
          if (operandType === 2) onOk([startId, endId, opType, operandType, operand, operand2]);
          else onOk([startId, endId, opType, operandType, operand]);
        }}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

export function ControlSelfSwitchEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [switchCh, setSwitchCh] = useState<string>((p[0] as string) || 'A');
  const [value, setValue] = useState<number>((p[1] as number) || 0);
  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Self Switch
        <select value={switchCh} onChange={e => setSwitchCh(e.target.value)} style={selectStyle}>
          {['A', 'B', 'C', 'D'].map(ch => <option key={ch} value={ch}>{ch}</option>)}
        </select>
      </label>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Value
        <select value={value} onChange={e => setValue(Number(e.target.value))} style={selectStyle}>
          <option value={0}>ON</option>
          <option value={1}>OFF</option>
        </select>
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([switchCh, value])}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

export function ControlTimerEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [operation, setOperation] = useState<number>((p[0] as number) || 0);
  const [seconds, setSeconds] = useState<number>((p[1] as number) || 60);
  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Operation
        <select value={operation} onChange={e => setOperation(Number(e.target.value))} style={selectStyle}>
          <option value={0}>Start</option>
          <option value={1}>Stop</option>
        </select>
      </label>
      {operation === 0 && (
        <label style={{ fontSize: 12, color: '#aaa' }}>
          Seconds
          <input type="number" value={seconds} onChange={e => setSeconds(Number(e.target.value))} min={1} style={{ ...selectStyle, width: 100 }} />
        </label>
      )}
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk(operation === 0 ? [operation, seconds] : [operation])}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

export function ChangeGoldEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [operation, setOperation] = useState<number>((p[0] as number) || 0);
  const [operandType, setOperandType] = useState<number>((p[1] as number) || 0);
  const [operand, setOperand] = useState<number>((p[2] as number) || 0);
  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Operation
        <select value={operation} onChange={e => setOperation(Number(e.target.value))} style={selectStyle}>
          <option value={0}>Increase</option>
          <option value={1}>Decrease</option>
        </select>
      </label>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Operand
        <select value={operandType} onChange={e => setOperandType(Number(e.target.value))} style={selectStyle}>
          <option value={0}>Constant</option>
          <option value={1}>Variable</option>
        </select>
      </label>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        {operandType === 0 ? 'Amount' : 'Variable ID'}
        <input type="number" value={operand} onChange={e => setOperand(Number(e.target.value))} min={operandType === 1 ? 1 : 0} style={{ ...selectStyle, width: 120 }} />
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([operation, operandType, operand])}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

export function ChangeItemEditor({ p, onOk, onCancel, label }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; label: string }) {
  const [itemId, setItemId] = useState<number>((p[0] as number) || 1);
  const [operation, setOperation] = useState<number>((p[1] as number) || 0);
  const [operandType, setOperandType] = useState<number>((p[2] as number) || 0);
  const [operand, setOperand] = useState<number>((p[3] as number) || 1);
  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        {label} ID
        <input type="number" value={itemId} onChange={e => setItemId(Number(e.target.value))} min={1} style={{ ...selectStyle, width: 100 }} />
      </label>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Operation
        <select value={operation} onChange={e => setOperation(Number(e.target.value))} style={selectStyle}>
          <option value={0}>Increase</option>
          <option value={1}>Decrease</option>
        </select>
      </label>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Operand
        <select value={operandType} onChange={e => setOperandType(Number(e.target.value))} style={selectStyle}>
          <option value={0}>Constant</option>
          <option value={1}>Variable</option>
        </select>
      </label>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        {operandType === 0 ? 'Amount' : 'Variable ID'}
        <input type="number" value={operand} onChange={e => setOperand(Number(e.target.value))} min={operandType === 1 ? 1 : 0} style={{ ...selectStyle, width: 100 }} />
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([itemId, operation, operandType, operand])}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
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
      <div style={{ display: 'flex', gap: 8 }}>
        <label style={{ fontSize: 12, color: '#aaa' }}>
          {designationType === 0 ? 'Map ID' : 'Map Var ID'}
          <input type="number" value={mapId} onChange={e => setMapId(Number(e.target.value))} min={1} style={{ ...selectStyle, width: 80 }} />
        </label>
        <label style={{ fontSize: 12, color: '#aaa' }}>
          {designationType === 0 ? 'X' : 'X Var ID'}
          <input type="number" value={x} onChange={e => setX(Number(e.target.value))} style={{ ...selectStyle, width: 60 }} />
        </label>
        <label style={{ fontSize: 12, color: '#aaa' }}>
          {designationType === 0 ? 'Y' : 'Y Var ID'}
          <input type="number" value={y} onChange={e => setY(Number(e.target.value))} style={{ ...selectStyle, width: 60 }} />
        </label>
      </div>
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

export function ChangePartyMemberEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [operation, setOperation] = useState<number>((p[1] as number) || 0);
  const [initialize, setInitialize] = useState<boolean>((p[2] as boolean) ?? true);
  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Actor ID
        <input type="number" value={actorId} onChange={e => setActorId(Number(e.target.value))} min={1} style={{ ...selectStyle, width: 100 }} />
      </label>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Operation
        <select value={operation} onChange={e => setOperation(Number(e.target.value))} style={selectStyle}>
          <option value={0}>Add</option>
          <option value={1}>Remove</option>
        </select>
      </label>
      {operation === 0 && (
        <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={initialize} onChange={e => setInitialize(e.target.checked)} />
          Initialize
        </label>
      )}
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk(operation === 0 ? [actorId, operation, initialize] : [actorId, operation])}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

export function ChangeNameEditor({ p, onOk, onCancel, label }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; label: string }) {
  const [actorId, setActorId] = useState<number>((p[0] as number) || 1);
  const [name, setName] = useState<string>((p[1] as string) || '');
  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        Actor ID
        <input type="number" value={actorId} onChange={e => setActorId(Number(e.target.value))} min={1} style={{ ...selectStyle, width: 100 }} />
      </label>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        {label}
        <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ ...selectStyle, width: '100%' }} />
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([actorId, name])}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

/**
 * Show Choices Editor (Command 102)
 * RPG Maker MV 파라미터: [choices[], cancelType, defaultType, positionType, background]
 * - choices: string[] (최대 6개)
 * - cancelType: -2(허용 안 함), -1(분기), 0~5(선택지 번호)
 * - defaultType: -1(없음), 0~5(선택지 번호)
 * - positionType: 0(왼쪽), 1(가운데), 2(오른쪽)
 * - background: 0(창), 1(어둡게), 2(투명)
 */
export function ShowChoicesEditor({ p, onOk, onCancel }: {
  p: unknown[];
  onOk: (params: unknown[], extra?: EventCommand[]) => void;
  onCancel: () => void;
}) {
  const initChoices = (p[0] as string[]) || [];
  const [choices, setChoices] = useState<string[]>(() => {
    const arr = [...initChoices];
    while (arr.length < 6) arr.push('');
    return arr.slice(0, 6);
  });
  const [cancelType, setCancelType] = useState<number>((p[1] as number) ?? -2);
  const [defaultType, setDefaultType] = useState<number>((p[2] as number) ?? 0);
  const [positionType, setPositionType] = useState<number>((p[3] as number) ?? 2);
  const [background, setBackground] = useState<number>((p[4] as number) ?? 0);

  const activeCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 6; i++) {
      if (choices[i].trim() !== '') count = i + 1;
    }
    return Math.max(count, 1);
  }, [choices]);

  const handleChoiceChange = (index: number, value: string) => {
    const newChoices = [...choices];
    newChoices[index] = value;
    setChoices(newChoices);
  };

  const handleOk = () => {
    const activeChoices = choices.slice(0, activeCount);
    const extraCommands: EventCommand[] = [];
    for (let i = 0; i < activeCount; i++) {
      extraCommands.push({ code: 402, indent: 0, parameters: [i, activeChoices[i]] });
      extraCommands.push({ code: 0, indent: 1, parameters: [] });
    }
    if (cancelType === -1) {
      extraCommands.push({ code: 403, indent: 0, parameters: [6] });
      extraCommands.push({ code: 0, indent: 1, parameters: [] });
    }
    extraCommands.push({ code: 404, indent: 0, parameters: [] });

    onOk([activeChoices, cancelType, defaultType, positionType, background], extraCommands);
  };

  // 초기값/취소 드롭다운에 사용할 활성 선택지 옵션
  const choiceOptions = useMemo(() => {
    const opts: { value: number; label: string }[] = [];
    for (let i = 0; i < activeCount; i++) {
      opts.push({ value: i, label: `선택 #${i + 1}` });
    }
    return opts;
  }, [activeCount]);

  return (
    <div className="show-choices-editor">
      <div className="show-choices-layout">
        <div className="show-choices-left">
          <div className="db-form-section">선택지</div>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="show-choices-row">
              <label className="show-choices-label">#{i + 1}:</label>
              <input
                type="text"
                value={choices[i]}
                onChange={e => handleChoiceChange(i, e.target.value)}
                style={{ ...selectStyle, flex: 1 }}
              />
            </div>
          ))}
        </div>
        <div className="show-choices-right">
          <label style={{ fontSize: 12, color: '#aaa' }}>
            배경:
            <select value={background} onChange={e => setBackground(Number(e.target.value))} style={selectStyle}>
              <option value={0}>창</option>
              <option value={1}>어둡게</option>
              <option value={2}>투명</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: '#aaa' }}>
            창의 위치:
            <select value={positionType} onChange={e => setPositionType(Number(e.target.value))} style={selectStyle}>
              <option value={0}>왼쪽</option>
              <option value={1}>가운데</option>
              <option value={2}>오른쪽</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: '#aaa' }}>
            초기값:
            <select value={defaultType} onChange={e => setDefaultType(Number(e.target.value))} style={selectStyle}>
              {choiceOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
              <option value={-1}>없음</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: '#aaa' }}>
            취소:
            <select value={cancelType} onChange={e => setCancelType(Number(e.target.value))} style={selectStyle}>
              {choiceOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
              <option value={-1}>분기</option>
              <option value={-2}>허용 안 함</option>
            </select>
          </label>
        </div>
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={handleOk}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}
