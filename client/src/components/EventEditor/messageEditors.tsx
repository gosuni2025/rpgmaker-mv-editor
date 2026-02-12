import React, { useState, useMemo } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import ImagePicker from '../common/ImagePicker';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import './ShowChoicesEditor.css';

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

export function TextEditor({ p, onOk, onCancel, followCode, label, existingLines }: {
  p: unknown[]; onOk: (params: unknown[], extra?: EventCommand[]) => void; onCancel: () => void;
  followCode: number; label: string; existingLines?: string[];
}) {
  const [text, setText] = useState<string>(() => {
    if (existingLines && existingLines.length > 0) {
      if (p[0]) return [p[0] as string, ...existingLines].join('\n');
      return existingLines.join('\n');
    }
    return (p[0] as string) || '';
  });

  const handleOk = () => {
    const lines = text.split('\n');
    const firstLine = lines[0] || '';
    const extra: EventCommand[] = lines.slice(1).map(line => ({ code: followCode, indent: 0, parameters: [line] }));
    onOk([firstLine], extra);
  };

  return (
    <>
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

/**
 * Show Scrolling Text Editor (Command 105)
 * RPG Maker MV 파라미터: [speed, noFastForward]
 * - speed: 스크롤 속도 (1~8, 기본 2)
 * - noFastForward: 빨리 돌리기 없음 (boolean)
 * 후속 커맨드 405: 텍스트 라인들
 */
export function ScrollingTextEditor({ p, onOk, onCancel, existingLines }: {
  p: unknown[]; onOk: (params: unknown[], extra?: EventCommand[]) => void; onCancel: () => void;
  existingLines?: string[];
}) {
  const [speed, setSpeed] = useState<number>((p[0] as number) || 2);
  const [noFastForward, setNoFastForward] = useState<boolean>((p[1] as boolean) || false);
  const [text, setText] = useState<string>(existingLines?.join('\n') || '');

  const handleOk = () => {
    const lines = text.split('\n');
    const extra: EventCommand[] = lines.map(line => ({ code: 405, indent: 0, parameters: [line] }));
    onOk([speed, noFastForward], extra);
  };

  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        텍스트:
        <textarea value={text} onChange={e => setText(e.target.value)} rows={8}
          style={{ ...selectStyle, width: '100%', resize: 'vertical', fontFamily: 'monospace' }} />
      </label>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: '#aaa', display: 'flex', alignItems: 'center', gap: 4 }}>
          속도:
          <input type="number" value={speed} onChange={e => setSpeed(Math.max(1, Math.min(8, Number(e.target.value))))} min={1} max={8} style={{ ...selectStyle, width: 60 }} />
        </label>
        <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={noFastForward} onChange={e => setNoFastForward(e.target.checked)} />
          빨리 돌리기 없음
        </label>
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={handleOk}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
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

/**
 * Input Number Editor (Command 103)
 * RPG Maker MV 파라미터: [variableId, maxDigits]
 */
export function InputNumberEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [variableId, setVariableId] = useState<number>((p[0] as number) || 1);
  const [maxDigits, setMaxDigits] = useState<number>((p[1] as number) || 1);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#aaa' }}>
        <span>변수:</span>
        <VariableSwitchPicker type="variable" value={variableId} onChange={setVariableId} style={{ flex: 1 }} />
      </div>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        자리수:
        <input type="number" value={maxDigits} onChange={e => setMaxDigits(Math.max(1, Math.min(8, Number(e.target.value))))} min={1} max={8} style={{ ...selectStyle, width: 80 }} />
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([variableId, maxDigits])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

/**
 * Select Item Editor (Command 104)
 * RPG Maker MV 파라미터: [variableId, itemType]
 */
export function SelectItemEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [variableId, setVariableId] = useState<number>((p[0] as number) || 1);
  const [itemType, setItemType] = useState<number>((p[1] as number) || 1);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#aaa' }}>
        <span>변수:</span>
        <VariableSwitchPicker type="variable" value={variableId} onChange={setVariableId} style={{ flex: 1 }} />
      </div>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        아이템 유형:
        <select value={itemType} onChange={e => setItemType(Number(e.target.value))} style={{ ...selectStyle, width: 180 }}>
          <option value={1}>상비 아이템</option>
          <option value={2}>핵심 아이템</option>
          <option value={3}>숨겨진 아이템 A</option>
          <option value={4}>숨겨진 아이템 B</option>
        </select>
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([variableId, itemType])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

/**
 * Show Choices Editor (Command 102)
 * RPG Maker MV 파라미터: [choices[], cancelType, defaultType, positionType, background]
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
