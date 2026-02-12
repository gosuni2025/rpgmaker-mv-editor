import React, { useState, useMemo, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { selectStyle } from './messageEditors';

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
