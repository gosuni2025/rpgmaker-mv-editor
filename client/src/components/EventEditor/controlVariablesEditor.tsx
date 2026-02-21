import React, { useState } from 'react';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';

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
      {gdType <= 2 && (
        <div style={rowStyle}>
          <span style={{ minWidth: 30 }}>ID:</span>
          <input type="number" value={gdParam1} onChange={e => setGdParam1(Math.max(1, Number(e.target.value)))}
            min={1} style={{ ...selectStyle, width: 100 }} />
        </div>
      )}
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
      {gdType === 6 && (
        <div style={rowStyle}>
          <span style={{ minWidth: 60 }}>순번:</span>
          <input type="number" value={gdParam1} onChange={e => setGdParam1(Math.max(0, Number(e.target.value)))}
            min={0} style={{ ...selectStyle, width: 80 }} />
          <span style={{ fontSize: 11, color: '#888' }}>(0부터 시작)</span>
        </div>
      )}
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

export function ControlVariablesEditor({ p, onOk, onCancel }: { p: unknown[]; onOk: (params: unknown[]) => void; onCancel: () => void }) {
  const initStart = (p[0] as number) || 1;
  const initEnd = (p[1] as number) || 1;
  const [varMode, setVarMode] = useState<'single' | 'range'>(initStart === initEnd ? 'single' : 'range');
  const [singleId, setSingleId] = useState<number>(initStart);
  const [rangeStart, setRangeStart] = useState<number>(initStart);
  const [rangeEnd, setRangeEnd] = useState<number>(initEnd);
  const [opType, setOpType] = useState<number>((p[2] as number) || 0);
  const [operandType, setOperandType] = useState<number>((p[3] as number) || 0);
  const [constValue, setConstValue] = useState<number>(operandType === 0 ? ((p[4] as number) || 0) : 0);
  const [varId, setVarId] = useState<number>(operandType === 1 ? ((p[4] as number) || 1) : 1);
  const [randMin, setRandMin] = useState<number>(operandType === 2 ? ((p[4] as number) || 0) : 0);
  const [randMax, setRandMax] = useState<number>(operandType === 2 ? ((p[5] as number) || 0) : 0);
  const [gdType, setGdType] = useState<number>(operandType === 3 ? ((p[4] as number) || 0) : 0);
  const [gdParam1, setGdParam1] = useState<number>(operandType === 3 ? ((p[5] as number) || 1) : 1);
  const [gdParam2, setGdParam2] = useState<number>(operandType === 3 ? ((p[6] as number) || 0) : 0);
  const [scriptText, setScriptText] = useState<string>(operandType === 4 ? ((p[4] as string) || '') : '');

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
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>변수</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ ...radioStyle, whiteSpace: 'nowrap' }}>
              <input type="radio" name="cv-var-mode" checked={varMode === 'single'} onChange={() => setVarMode('single')} />
              단독
            </label>
            <VariableSwitchPicker type="variable" value={singleId} onChange={setSingleId} disabled={varMode !== 'single'} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ ...radioStyle, whiteSpace: 'nowrap' }}>
              <input type="radio" name="cv-var-mode" checked={varMode === 'range'} onChange={() => setVarMode('range')} />
              범위
            </label>
            <VariableSwitchPicker type="variable" value={rangeStart} onChange={setRangeStart} disabled={varMode !== 'range'} style={{ flex: 1 }} />
            <span style={{ color: '#aaa', fontSize: 13 }}>~</span>
            <VariableSwitchPicker type="variable" value={rangeEnd} onChange={setRangeEnd} disabled={varMode !== 'range'} style={{ flex: 1 }} />
          </div>
        </div>
      </fieldset>

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

      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>피연산자</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="cv-operand" checked={operandType === 0} onChange={() => setOperandType(0)} />
              상수
            </label>
            <input type="number" value={constValue} onChange={e => setConstValue(Number(e.target.value))}
              disabled={operandType !== 0} style={{ ...selectStyle, width: 120, opacity: operandType === 0 ? 1 : 0.5 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="cv-operand" checked={operandType === 1} onChange={() => setOperandType(1)} />
              변수
            </label>
            <VariableSwitchPicker type="variable" value={varId} onChange={setVarId} disabled={operandType !== 1} style={{ flex: 1 }} />
          </div>
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
    </>
  );
}
