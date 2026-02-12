import React, { useState, useMemo, useCallback } from 'react';
import type { EventCommand, AudioFile } from '../../types/rpgMakerMV';
import AudioPicker from '../common/AudioPicker';
import ImagePicker from '../common/ImagePicker';
import useEditorStore from '../../store/useEditorStore';

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

/** 스위치/변수 목록에서 선택하는 팝업 */
export function DataListPicker({ items, value, onChange, onClose, title }: {
  items: string[]; value: number; onChange: (id: number) => void; onClose: () => void; title?: string;
}) {
  const [selected, setSelected] = useState(value);
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    const result: { id: number; name: string }[] = [];
    for (let i = 1; i < items.length; i++) {
      const label = `${String(i).padStart(4, '0')}: ${items[i] || ''}`;
      if (!filter || label.toLowerCase().includes(filter.toLowerCase())) {
        result.push({ id: i, name: label });
      }
    }
    return result;
  }, [items, filter]);
  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={onClose}>
      <div className="image-picker-dialog" onClick={e => e.stopPropagation()} style={{ width: 320, maxHeight: '60vh' }}>
        <div className="image-picker-header">{title || '선택'}</div>
        <div style={{ padding: '8px 12px' }}>
          <input
            type="text" placeholder="검색..." value={filter} onChange={e => setFilter(e.target.value)}
            style={{ ...selectStyle, width: '100%', boxSizing: 'border-box' }} autoFocus
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: 300, padding: '0 12px' }}>
          {filtered.map(item => (
            <div
              key={item.id}
              style={{ padding: '3px 6px', cursor: 'pointer', fontSize: 13, color: '#ddd',
                background: item.id === selected ? '#2675bf' : 'transparent', borderRadius: 2 }}
              onClick={() => setSelected(item.id)}
              onDoubleClick={() => { onChange(item.id); onClose(); }}
            >{item.name}</div>
          ))}
        </div>
        <div className="image-picker-footer">
          <button className="db-btn" onClick={() => { onChange(selected); onClose(); }}>OK</button>
          <button className="db-btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}

export function ControlSwitchesEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const initStart = (p[0] as number) || 1;
  const initEnd = (p[1] as number) || 1;
  const [mode, setMode] = useState<'single' | 'range'>(initStart === initEnd ? 'single' : 'range');
  const [singleId, setSingleId] = useState<number>(initStart);
  const [rangeStart, setRangeStart] = useState<number>(initStart);
  const [rangeEnd, setRangeEnd] = useState<number>(initEnd);
  const [value, setValue] = useState<number>((p[2] as number) || 0);
  const [showPicker, setShowPicker] = useState(false);
  const systemData = useEditorStore(s => s.systemData);
  const switches = systemData?.switches || [];

  const getSwitchLabel = useCallback((id: number) => {
    const name = switches[id] || '';
    return `${String(id).padStart(4, '0')}${name ? ': ' + name : ''}`;
  }, [switches]);

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
          <input
            type="text" readOnly value={getSwitchLabel(singleId)}
            style={{ ...selectStyle, flex: 1, cursor: 'pointer', opacity: mode === 'single' ? 1 : 0.5 }}
            onClick={() => mode === 'single' && setShowPicker(true)}
          />
          <button className="db-btn" style={{ padding: '4px 8px', opacity: mode === 'single' ? 1 : 0.5 }}
            disabled={mode !== 'single'} onClick={() => setShowPicker(true)}>...</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#ddd', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="radio" checked={mode === 'range'} onChange={() => setMode('range')} />
            범위
          </label>
          <input type="number" value={rangeStart} onChange={e => setRangeStart(Math.max(1, Number(e.target.value)))} min={1}
            disabled={mode !== 'range'} style={{ ...selectStyle, width: 70, opacity: mode === 'range' ? 1 : 0.5 }} />
          <span style={{ color: '#aaa', fontSize: 13 }}>~</span>
          <input type="number" value={rangeEnd} onChange={e => setRangeEnd(Math.max(1, Number(e.target.value)))} min={1}
            disabled={mode !== 'range'} style={{ ...selectStyle, width: 70, opacity: mode === 'range' ? 1 : 0.5 }} />
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

      {showPicker && (
        <DataListPicker
          items={switches}
          value={singleId}
          onChange={setSingleId}
          onClose={() => setShowPicker(false)}
          title="스위치 선택"
        />
      )}
    </>
  );
}

export function ControlVariablesEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const initStart = (p[0] as number) || 1;
  const initEnd = (p[1] as number) || 1;
  const [varMode, setVarMode] = useState<'single' | 'range'>(initStart === initEnd ? 'single' : 'range');
  const [singleId, setSingleId] = useState<number>(initStart);
  const [rangeStart, setRangeStart] = useState<number>(initStart);
  const [rangeEnd, setRangeEnd] = useState<number>(initEnd);
  const [opType, setOpType] = useState<number>((p[2] as number) || 0);
  const [operandType, setOperandType] = useState<number>((p[3] as number) || 0);
  // 상수
  const [constValue, setConstValue] = useState<number>(operandType === 0 ? ((p[4] as number) || 0) : 0);
  // 변수
  const [varId, setVarId] = useState<number>(operandType === 1 ? ((p[4] as number) || 1) : 1);
  // 랜덤
  const [randMin, setRandMin] = useState<number>(operandType === 2 ? ((p[4] as number) || 0) : 0);
  const [randMax, setRandMax] = useState<number>(operandType === 2 ? ((p[5] as number) || 0) : 0);
  // 게임 데이터: p[4]=gameDataType, p[5]=param1, p[6]=param2
  const [gdType, setGdType] = useState<number>(operandType === 3 ? ((p[4] as number) || 0) : 0);
  const [gdParam1, setGdParam1] = useState<number>(operandType === 3 ? ((p[5] as number) || 1) : 1);
  const [gdParam2, setGdParam2] = useState<number>(operandType === 3 ? ((p[6] as number) || 0) : 0);
  // 스크립트
  const [scriptText, setScriptText] = useState<string>(operandType === 4 ? ((p[4] as string) || '') : '');
  // 변수 피커
  const [showVarPicker, setShowVarPicker] = useState<'single' | 'operand' | null>(null);
  const systemData = useEditorStore(s => s.systemData);
  const variables = systemData?.variables || [];

  const getVarLabel = useCallback((id: number) => {
    const name = variables[id] || '';
    return `${String(id).padStart(4, '0')}${name ? ': ' + name : ''}`;
  }, [variables]);

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  const handleOk = () => {
    const startId = varMode === 'single' ? singleId : rangeStart;
    const endId = varMode === 'single' ? singleId : rangeEnd;
    switch (operandType) {
      case 0: onOk([startId, endId, opType, 0, constValue]); break;
      case 1: onOk([startId, endId, opType, 1, varId]); break;
      case 2: onOk([startId, endId, opType, 2, randMin, randMax]); break;
      case 3: onOk([startId, endId, opType, 3, gdType, gdParam1, gdParam2]); break;
      case 4: onOk([startId, endId, opType, 4, scriptText]); break;
    }
  };

  return (
    <>
      {/* 변수 섹션 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>변수</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ ...radioStyle, whiteSpace: 'nowrap' }}>
              <input type="radio" name="cv-var-mode" checked={varMode === 'single'} onChange={() => setVarMode('single')} />
              단독
            </label>
            <input type="text" readOnly value={getVarLabel(singleId)}
              style={{ ...selectStyle, flex: 1, cursor: 'pointer', opacity: varMode === 'single' ? 1 : 0.5 }}
              onClick={() => varMode === 'single' && setShowVarPicker('single')} />
            <button className="db-btn" style={{ padding: '4px 8px', opacity: varMode === 'single' ? 1 : 0.5 }}
              disabled={varMode !== 'single'} onClick={() => setShowVarPicker('single')}>...</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ ...radioStyle, whiteSpace: 'nowrap' }}>
              <input type="radio" name="cv-var-mode" checked={varMode === 'range'} onChange={() => setVarMode('range')} />
              범위
            </label>
            <input type="number" value={rangeStart} onChange={e => setRangeStart(Math.max(1, Number(e.target.value)))}
              min={1} disabled={varMode !== 'range'} style={{ ...selectStyle, width: 80, opacity: varMode === 'range' ? 1 : 0.5 }} />
            <span style={{ color: '#aaa', fontSize: 13 }}>~</span>
            <input type="number" value={rangeEnd} onChange={e => setRangeEnd(Math.max(1, Number(e.target.value)))}
              min={1} disabled={varMode !== 'range'} style={{ ...selectStyle, width: 80, opacity: varMode === 'range' ? 1 : 0.5 }} />
          </div>
        </div>
      </fieldset>

      {/* 조작 섹션 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>조작</legend>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {([[0, '대입'], [1, '더하기'], [2, '빼기'], [3, '곱하기'], [4, '나누기'], [5, '나머지']] as const).map(([val, label]) => (
            <label key={val} style={radioStyle}>
              <input type="radio" name="cv-op" checked={opType === val} onChange={() => setOpType(val)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* 피연산자 섹션 */}
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>피연산자</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* 상수 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="cv-operand" checked={operandType === 0} onChange={() => setOperandType(0)} />
              상수
            </label>
            <input type="number" value={constValue} onChange={e => setConstValue(Number(e.target.value))}
              disabled={operandType !== 0} style={{ ...selectStyle, width: 120, opacity: operandType === 0 ? 1 : 0.5 }} />
          </div>
          {/* 변수 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="cv-operand" checked={operandType === 1} onChange={() => setOperandType(1)} />
              변수
            </label>
            <input type="text" readOnly value={getVarLabel(varId)}
              style={{ ...selectStyle, flex: 1, cursor: 'pointer', opacity: operandType === 1 ? 1 : 0.5 }}
              onClick={() => operandType === 1 && setShowVarPicker('operand')} />
            <button className="db-btn" style={{ padding: '4px 8px', opacity: operandType === 1 ? 1 : 0.5 }}
              disabled={operandType !== 1} onClick={() => setShowVarPicker('operand')}>...</button>
          </div>
          {/* 랜덤 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="cv-operand" checked={operandType === 2} onChange={() => setOperandType(2)} />
              랜덤
            </label>
            <input type="number" value={randMin} onChange={e => setRandMin(Number(e.target.value))}
              disabled={operandType !== 2} style={{ ...selectStyle, width: 80, opacity: operandType === 2 ? 1 : 0.5 }} />
            <span style={{ color: '#aaa', fontSize: 13 }}>~</span>
            <input type="number" value={randMax} onChange={e => setRandMax(Number(e.target.value))}
              disabled={operandType !== 2} style={{ ...selectStyle, width: 80, opacity: operandType === 2 ? 1 : 0.5 }} />
          </div>
          {/* 게임 데이터 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="cv-operand" checked={operandType === 3} onChange={() => setOperandType(3)} />
              게임 데이터
            </label>
          </div>
          {operandType === 3 && (
            <GameDataOperand gdType={gdType} setGdType={setGdType}
              gdParam1={gdParam1} setGdParam1={setGdParam1}
              gdParam2={gdParam2} setGdParam2={setGdParam2} />
          )}
          {/* 스크립트 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="cv-operand" checked={operandType === 4} onChange={() => setOperandType(4)} />
              스크립트
            </label>
          </div>
          {operandType === 4 && (
            <input type="text" value={scriptText} onChange={e => setScriptText(e.target.value)}
              placeholder="JavaScript 식" style={{ ...selectStyle, width: '100%', marginLeft: 20, boxSizing: 'border-box' }} />
          )}
        </div>
      </fieldset>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={handleOk}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showVarPicker && (
        <DataListPicker
          items={variables}
          value={showVarPicker === 'single' ? singleId : varId}
          onChange={id => { if (showVarPicker === 'single') setSingleId(id); else setVarId(id); }}
          onClose={() => setShowVarPicker(null)}
          title="변수 선택"
        />
      )}
    </>
  );
}

/** 게임 데이터 피연산자 서브 컴포넌트 */
function GameDataOperand({ gdType, setGdType, gdParam1, setGdParam1, gdParam2, setGdParam2 }: {
  gdType: number; setGdType: (v: number) => void;
  gdParam1: number; setGdParam1: (v: number) => void;
  gdParam2: number; setGdParam2: (v: number) => void;
}) {
  const indent: React.CSSProperties = { marginLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 };
  const rowStyle: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#ddd' };

  const actorParams: [number, string][] = [
    [0, '레벨'], [1, '경험치'], [2, 'HP'], [3, 'MP'],
    [4, '최대 HP'], [5, '최대 MP'], [6, '공격력'], [7, '방어력'],
    [8, '마법 공격력'], [9, '마법 방어력'], [10, '민첩성'], [11, '운'],
  ];

  const enemyParams: [number, string][] = [
    [0, 'HP'], [1, 'MP'],
    [2, '최대 HP'], [3, '최대 MP'], [4, '공격력'], [5, '방어력'],
    [6, '마법 공격력'], [7, '마법 방어력'], [8, '민첩성'], [9, '운'],
  ];

  const charParams: [number, string][] = [
    [0, '맵 X'], [1, '맵 Y'], [2, '방향'], [3, '화면 X'], [4, '화면 Y'],
  ];

  const otherParams: [number, string][] = [
    [0, '맵 ID'], [1, '파티 인원수'], [2, '소지금'], [3, '걸음 수'],
    [4, '플레이 시간'], [5, '타이머'], [6, '세이브 횟수'], [7, '전투 횟수'],
    [8, '승리 횟수'], [9, '도주 횟수'],
  ];

  return (
    <div style={indent}>
      <div style={rowStyle}>
        <select value={gdType} onChange={e => { setGdType(Number(e.target.value)); setGdParam1(Number(e.target.value) <= 2 ? 1 : 0); setGdParam2(0); }} style={{ ...selectStyle, width: 130 }}>
          <option value={0}>아이템</option>
          <option value={1}>무기</option>
          <option value={2}>방어구</option>
          <option value={3}>액터</option>
          <option value={4}>적</option>
          <option value={5}>캐릭터</option>
          <option value={6}>파티</option>
          <option value={7}>기타</option>
        </select>
      </div>
      {/* 아이템/무기/방어구: param1=ID */}
      {gdType <= 2 && (
        <div style={rowStyle}>
          <span style={{ minWidth: 30 }}>ID:</span>
          <input type="number" value={gdParam1} onChange={e => setGdParam1(Math.max(1, Number(e.target.value)))}
            min={1} style={{ ...selectStyle, width: 100 }} />
        </div>
      )}
      {/* 액터: param1=actorId, param2=능력치 */}
      {gdType === 3 && (
        <>
          <div style={rowStyle}>
            <span style={{ minWidth: 60 }}>액터 ID:</span>
            <input type="number" value={gdParam1} onChange={e => setGdParam1(Math.max(1, Number(e.target.value)))}
              min={1} style={{ ...selectStyle, width: 80 }} />
          </div>
          <div style={rowStyle}>
            <select value={gdParam2} onChange={e => setGdParam2(Number(e.target.value))} style={{ ...selectStyle, width: 140 }}>
              {actorParams.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </>
      )}
      {/* 적: param1=enemyIndex, param2=능력치 */}
      {gdType === 4 && (
        <>
          <div style={rowStyle}>
            <span style={{ minWidth: 60 }}>적 인덱스:</span>
            <input type="number" value={gdParam1} onChange={e => setGdParam1(Math.max(0, Number(e.target.value)))}
              min={0} style={{ ...selectStyle, width: 80 }} />
          </div>
          <div style={rowStyle}>
            <select value={gdParam2} onChange={e => setGdParam2(Number(e.target.value))} style={{ ...selectStyle, width: 140 }}>
              {enemyParams.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </>
      )}
      {/* 캐릭터: param1=characterId(-1=플레이어, 0=현재이벤트, 1+=이벤트ID), param2=속성 */}
      {gdType === 5 && (
        <>
          <div style={rowStyle}>
            <span style={{ minWidth: 80 }}>캐릭터 ID:</span>
            <input type="number" value={gdParam1} onChange={e => setGdParam1(Number(e.target.value))}
              min={-1} style={{ ...selectStyle, width: 80 }} />
            <span style={{ fontSize: 11, color: '#888' }}>(-1:플레이어, 0:이 이벤트)</span>
          </div>
          <div style={rowStyle}>
            <select value={gdParam2} onChange={e => setGdParam2(Number(e.target.value))} style={{ ...selectStyle, width: 140 }}>
              {charParams.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </>
      )}
      {/* 파티: param1=파티 내 순번 (0-based) */}
      {gdType === 6 && (
        <div style={rowStyle}>
          <span style={{ minWidth: 60 }}>순번:</span>
          <input type="number" value={gdParam1} onChange={e => setGdParam1(Math.max(0, Number(e.target.value)))}
            min={0} style={{ ...selectStyle, width: 80 }} />
          <span style={{ fontSize: 11, color: '#888' }}>(0부터 시작)</span>
        </div>
      )}
      {/* 기타: param1=항목 */}
      {gdType === 7 && (
        <div style={rowStyle}>
          <select value={gdParam1} onChange={e => setGdParam1(Number(e.target.value))} style={{ ...selectStyle, width: 160 }}>
            {otherParams.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      )}
    </div>
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
 * Input Number Editor (Command 103)
 * RPG Maker MV 파라미터: [variableId, maxDigits]
 * - variableId: 결과를 저장할 변수 ID
 * - maxDigits: 최대 자릿수 (1~8)
 */
export function InputNumberEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [variableId, setVariableId] = useState<number>((p[0] as number) || 1);
  const [maxDigits, setMaxDigits] = useState<number>((p[1] as number) || 1);
  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        변수:
        <input type="number" value={variableId} onChange={e => setVariableId(Math.max(1, Number(e.target.value)))} min={1} style={{ ...selectStyle, width: 120 }} />
      </label>
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
 * - variableId: 선택된 아이템 ID를 저장할 변수 ID
 * - itemType: 아이템 유형 (1: 상비 아이템, 2: 핵심 아이템, 3: 숨겨진 아이템 A, 4: 숨겨진 아이템 B)
 */
export function SelectItemEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const [variableId, setVariableId] = useState<number>((p[0] as number) || 1);
  const [itemType, setItemType] = useState<number>((p[1] as number) || 1);
  return (
    <>
      <label style={{ fontSize: 12, color: '#aaa' }}>
        변수:
        <input type="number" value={variableId} onChange={e => setVariableId(Math.max(1, Number(e.target.value)))} min={1} style={{ ...selectStyle, width: 120 }} />
      </label>
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
