import React, { useState } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import ImagePicker from '../common/ImagePicker';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import { EnhancedTextEditor } from './EnhancedTextEditor';
<<<<<<< HEAD
import './ShowChoicesEditor.css';
=======
import { buildTextExtra } from './messageEditorUtils';

// Re-export split-out components
export { ShowTextEditorDialog } from './ShowTextEditorDialog';
export { ShowChoicesEditor } from './ShowChoicesEditorComponent';
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f

export const selectStyle = { background: '#2b2b2b', border: '1px solid #555', borderRadius: 3, padding: '4px 8px', color: '#ddd', fontSize: 13 } as const;

// ─── 기존 호환용 (인라인 embed 형태) ───
export function ShowTextEditor({ p, onOk, onCancel, existingLines }: {
  p: unknown[]; onOk: (params: unknown[], extra?: EventCommand[]) => void; onCancel: () => void; existingLines?: string[];
}) {
  const [faceName, setFaceName] = useState<string>((p[0] as string) || '');
  const [faceIndex, setFaceIndex] = useState<number>((p[1] as number) || 0);
  const [background, setBackground] = useState<number>((p[2] as number) || 0);
  const [positionType, setPositionType] = useState<number>((p[3] as number) || 2);
  const [text, setText] = useState(existingLines?.join('\n') || '');
  const [bulkInput, setBulkInput] = useState(false);

  const handleOk = () => {
<<<<<<< HEAD
    if (bulkInput) {
      const allLines = text.split('\n');
      const groups: string[][] = [];
      for (let i = 0; i < allLines.length; i += 4) {
        groups.push(allLines.slice(i, i + 4));
      }
      if (groups.length === 0) groups.push([]);
      const extra: EventCommand[] = groups[0].map(line => ({ code: 401, indent: 0, parameters: [line] }));
      for (let i = 1; i < groups.length; i++) {
        extra.push({ code: 101, indent: 0, parameters: [faceName, faceIndex, background, positionType] });
        groups[i].forEach(line => extra.push({ code: 401, indent: 0, parameters: [line] }));
      }
      onOk([faceName, faceIndex, background, positionType], extra);
    } else {
      const lines = text.split('\n').filter((_, i) => i < 4);
      const extra: EventCommand[] = lines.map(line => ({ code: 401, indent: 0, parameters: [line] }));
      onOk([faceName, faceIndex, background, positionType], extra);
    }
=======
    const params = [faceName, faceIndex, background, positionType];
    const extra = buildTextExtra(text, bulkInput, 401, params);
    onOk(params, extra);
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
  };

  const radioRowStyle: React.CSSProperties = { display: 'flex', gap: 12, marginTop: 4 };
  const radioLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: '#ddd', fontSize: 12 };

  return (
    <>
      <div style={{ fontSize: 12, color: '#aaa' }}>
        얼굴
        <ImagePicker type="faces" value={faceName} onChange={setFaceName} index={faceIndex} onIndexChange={setFaceIndex} />
      </div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>
        배경
        <div style={radioRowStyle}>
          {([{ value: 0, label: '창' }, { value: 1, label: '어둡게' }, { value: 2, label: '투명' }] as const).map(opt => (
            <label key={opt.value} style={radioLabelStyle}>
              <input type="radio" name="showtext-background" value={opt.value} checked={background === opt.value} onChange={() => setBackground(opt.value)} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>
        창의 위치
        <div style={radioRowStyle}>
          {([{ value: 0, label: '위' }, { value: 1, label: '가운데' }, { value: 2, label: '아래' }] as const).map(opt => (
            <label key={opt.value} style={radioLabelStyle}>
              <input type="radio" name="showtext-position" value={opt.value} checked={positionType === opt.value} onChange={() => setPositionType(opt.value)} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
      <label className="db-checkbox-label" style={{ fontSize: 12, color: '#aaa', flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <input type="checkbox" checked={bulkInput} onChange={e => setBulkInput(e.target.checked)} />
        일괄 입력
      </label>
      <label style={{ fontSize: 12, color: '#aaa', display: 'block' }}>
<<<<<<< HEAD
        텍스트{bulkInput ? '' : ' (최대 4줄)'}:
        <EnhancedTextEditor
          value={text}
          onChange={setText}
          rows={bulkInput ? 12 : 4}
          placeholder="텍스트를 입력하세요..."
        />
=======
        텍스트{bulkInput ? ' (4줄마다 자동 분할)' : ''}:
        <EnhancedTextEditor value={text} onChange={setText} rows={Math.max(4, text.split('\n').length)} placeholder="텍스트를 입력하세요..." />
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={handleOk}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
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
    const extra: EventCommand[] = lines.slice(1).map(line => ({ code: followCode, indent: 0, parameters: [line] }));
    onOk([lines[0] || ''], extra);
  };

  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa', display: 'block' }}>
        {label}
<<<<<<< HEAD
        <EnhancedTextEditor
          value={text}
          onChange={setText}
          rows={8}
        />
=======
        <EnhancedTextEditor value={text} onChange={setText} rows={8} />
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={handleOk}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

export function ScrollingTextEditor({ p, onOk, onCancel, existingLines }: {
  p: unknown[]; onOk: (params: unknown[], extra?: EventCommand[]) => void; onCancel: () => void; existingLines?: string[];
}) {
  const [speed, setSpeed] = useState<number>((p[0] as number) || 2);
  const [noFastForward, setNoFastForward] = useState<boolean>((p[1] as boolean) || false);
  const [text, setText] = useState<string>(existingLines?.join('\n') || '');

  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa', display: 'block' }}>
        텍스트:
<<<<<<< HEAD
        <EnhancedTextEditor
          value={text}
          onChange={setText}
          rows={8}
          placeholder="스크롤 텍스트를 입력하세요..."
        />
=======
        <EnhancedTextEditor value={text} onChange={setText} rows={8} placeholder="스크롤 텍스트를 입력하세요..." />
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
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
        <button className="db-btn" onClick={() => { const extra = text.split('\n').map(line => ({ code: 405, indent: 0, parameters: [line] })); onOk([speed, noFastForward], extra); }}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

export function SingleTextEditor({ p, onOk, onCancel, label }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; label: string }) {
  const [value, setValue] = useState<string>((p[0] as string) || '');
  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa' }}>{label}<input type="text" value={value} onChange={e => setValue(e.target.value)} style={{ ...selectStyle, width: '100%' }} /></label>
      <div className="image-picker-footer"><button className="db-btn" onClick={() => onOk([value])}>OK</button><button className="db-btn" onClick={onCancel}>Cancel</button></div>
    </>
  );
}

export function SingleNumberEditor({ p, onOk, onCancel, label, min, max }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void; label: string; min?: number; max?: number }) {
<<<<<<< HEAD
  const defaultVal = (p[0] as number) || (min != null ? min : 0);
  const [value, setValue] = useState<number>(defaultVal);
  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        {label}
        <input type="number" value={value} min={min} max={max} onChange={e => setValue(Number(e.target.value))} style={{ ...selectStyle, width: 120 }} />
      </label>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([value])}>OK</button>
        <button className="db-btn" onClick={onCancel}>Cancel</button>
      </div>
=======
  const [value, setValue] = useState<number>((p[0] as number) || (min != null ? min : 0));
  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa' }}>{label}<input type="number" value={value} min={min} max={max} onChange={e => setValue(Number(e.target.value))} style={{ ...selectStyle, width: 120 }} /></label>
      <div className="image-picker-footer"><button className="db-btn" onClick={() => onOk([value])}>OK</button><button className="db-btn" onClick={onCancel}>Cancel</button></div>
    </>
  );
}

export function WaitEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [value, setValue] = useState<number>((p[0] as number) || 60);
  return (
    <>
      <div style={{ fontSize: 12, color: '#aaa' }}>지속 시간</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <input type="number" value={value} min={1} max={999} onChange={e => setValue(Number(e.target.value))} style={{ ...selectStyle, width: 80 }} />
        <span style={{ fontSize: 12, color: '#aaa' }}>프레임 (1/60 초)</span>
      </div>
      <div className="image-picker-footer"><button className="db-btn" onClick={() => onOk([value])}>OK</button><button className="db-btn" onClick={onCancel}>취소</button></div>
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
    </>
  );
}

<<<<<<< HEAD
/**
 * Wait Editor (Command 230)
 * RPG Maker MV 파라미터: [duration(frames)]
 */
export function WaitEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [value, setValue] = useState<number>((p[0] as number) || 60);
  return (
    <>
      <div style={{ fontSize: 12, color: '#aaa' }}>지속 시간</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <input type="number" value={value} min={1} max={999} onChange={e => setValue(Number(e.target.value))} style={{ ...selectStyle, width: 80 }} />
        <span style={{ fontSize: 12, color: '#aaa' }}>프레임 (1/60 초)</span>
      </div>
      <div className="image-picker-footer">
        <button className="db-btn" onClick={() => onOk([value])}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>
    </>
  );
}

/**
 * Input Number Editor (Command 103)
 * RPG Maker MV 파라미터: [variableId, maxDigits]
 */
=======
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
export function InputNumberEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [variableId, setVariableId] = useState<number>((p[0] as number) || 1);
  const [maxDigits, setMaxDigits] = useState<number>((p[1] as number) || 1);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#aaa' }}>
        <span>변수:</span>
        <VariableSwitchPicker type="variable" value={variableId} onChange={setVariableId} style={{ flex: 1 }} />
      </div>
      <label style={{ fontSize: 12, color: '#aaa' }}>자리수:<input type="number" value={maxDigits} onChange={e => setMaxDigits(Math.max(1, Math.min(8, Number(e.target.value))))} min={1} max={8} style={{ ...selectStyle, width: 80 }} /></label>
      <div className="image-picker-footer"><button className="db-btn" onClick={() => onOk([variableId, maxDigits])}>OK</button><button className="db-btn" onClick={onCancel}>취소</button></div>
    </>
  );
}

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
          <option value={1}>상비 아이템</option><option value={2}>핵심 아이템</option><option value={3}>숨겨진 아이템 A</option><option value={4}>숨겨진 아이템 B</option>
        </select>
      </label>
      <div className="image-picker-footer"><button className="db-btn" onClick={() => onOk([variableId, itemType])}>OK</button><button className="db-btn" onClick={onCancel}>취소</button></div>
    </>
  );
}
