import React, { useState, useCallback, useEffect } from 'react';
import type { EventCommand } from '../../types/rpgMakerMV';
import useEditorStore from '../../store/useEditorStore';
import apiClient from '../../api/client';
import { selectStyle } from './messageEditors';
import { DataListPicker } from './controlEditors';

interface NamedItem { id: number; name: string }

/** 데이터베이스에서 {id, name}[] 로드 */
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

const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ddd' };
const disabledOpacity = (active: boolean) => ({ opacity: active ? 1 : 0.5 });

const COMPARISON_OPS: [number, string][] = [[0, '='], [1, '≥'], [2, '≤'], [3, '>'], [4, '<'], [5, '≠']];

// 탭에서 condType 결정: 탭1=0~3, 탭2=4, 탭3=5~6+13, 탭4=7~12
function getTabForType(t: number): number {
  if (t <= 3) return 0;
  if (t === 4) return 1;
  if (t === 5 || t === 6 || t === 13) return 2;
  return 3; // 7~12
}

function getDefaultTypeForTab(tab: number): number {
  return [0, 4, 5, 7][tab];
}

export function ConditionalBranchEditor({ p, onOk, onCancel, hasElse: initHasElse }: {
  p: unknown[];
  onOk: (params: unknown[], extra?: EventCommand[]) => void;
  onCancel: () => void;
  hasElse?: boolean;
}) {
  const initType = (p[0] as number) ?? 0;
  const [tab, setTab] = useState(getTabForType(initType));
  const [condType, setCondType] = useState(initType);
  const [hasElse, setHasElse] = useState(initHasElse ?? false);

  // --- 탭1: 스위치 (type=0) ---
  const [switchId, setSwitchId] = useState(condType === 0 ? ((p[1] as number) || 1) : 1);
  const [switchValue, setSwitchValue] = useState(condType === 0 ? ((p[2] as number) || 0) : 0);
  // --- 탭1: 변수 (type=1) ---
  const [varId, setVarId] = useState(condType === 1 ? ((p[1] as number) || 1) : 1);
  const [varOperandType, setVarOperandType] = useState(condType === 1 ? ((p[2] as number) || 0) : 0);
  const [varOperand, setVarOperand] = useState(condType === 1 ? ((p[3] as number) || 0) : 0);
  const [varCompare, setVarCompare] = useState(condType === 1 ? ((p[4] as number) || 0) : 0);
  // --- 탭1: 셀프 스위치 (type=2) ---
  const [selfSwitch, setSelfSwitch] = useState(condType === 2 ? ((p[1] as string) || 'A') : 'A');
  const [selfSwitchValue, setSelfSwitchValue] = useState(condType === 2 ? ((p[2] as number) || 0) : 0);
  // --- 탭1: 타이머 (type=3) ---
  const initTimerSec = condType === 3 ? ((p[1] as number) || 0) : 0;
  const [timerMin, setTimerMin] = useState(Math.floor(initTimerSec / 60));
  const [timerSec, setTimerSec] = useState(initTimerSec % 60);
  const [timerCompare, setTimerCompare] = useState(condType === 3 ? ((p[2] as number) || 0) : 0);
  // --- 탭2: 액터 (type=4) ---
  const [actorId, setActorId] = useState(condType === 4 ? ((p[1] as number) || 1) : 1);
  const [actorSubType, setActorSubType] = useState(condType === 4 ? ((p[2] as number) || 0) : 0);
  const [actorParam, setActorParam] = useState<string | number>(condType === 4 ? ((p[3] as string | number) ?? '') : '');
  // --- 탭3: 적 (type=5) ---
  const [enemyIndex, setEnemyIndex] = useState(condType === 5 ? ((p[1] as number) || 0) : 0);
  const [enemySubType, setEnemySubType] = useState(condType === 5 ? ((p[2] as number) || 0) : 0);
  const [enemyStateId, setEnemyStateId] = useState(condType === 5 ? ((p[3] as number) || 1) : 1);
  // --- 탭3: 캐릭터 (type=6) ---
  const [charId, setCharId] = useState(condType === 6 ? ((p[1] as number) || -1) : -1);
  const [charDir, setCharDir] = useState(condType === 6 ? ((p[2] as number) || 2) : 2);
  // --- 탭3: 탈것 (type=13) ---
  const [vehicleId, setVehicleId] = useState(condType === 13 ? ((p[1] as number) || 0) : 0);
  // --- 탭4: 소지금 (type=7) ---
  const [goldAmount, setGoldAmount] = useState(condType === 7 ? ((p[1] as number) || 0) : 0);
  const [goldCompare, setGoldCompare] = useState(condType === 7 ? ((p[2] as number) || 0) : 0);
  // --- 탭4: 아이템 (type=8) ---
  const [itemId, setItemId] = useState(condType === 8 ? ((p[1] as number) || 1) : 1);
  // --- 탭4: 무기 (type=9) ---
  const [weaponId, setWeaponId] = useState(condType === 9 ? ((p[1] as number) || 1) : 1);
  const [weaponIncludeEquip, setWeaponIncludeEquip] = useState(condType === 9 ? !!(p[2]) : false);
  // --- 탭4: 방어구 (type=10) ---
  const [armorId, setArmorId] = useState(condType === 10 ? ((p[1] as number) || 1) : 1);
  const [armorIncludeEquip, setArmorIncludeEquip] = useState(condType === 10 ? !!(p[2]) : false);
  // --- 탭4: 버튼 (type=11) ---
  const [buttonName, setButtonName] = useState(condType === 11 ? ((p[1] as string) || 'ok') : 'ok');
  // --- 탭4: 스크립트 (type=12) ---
  const [scriptText, setScriptText] = useState(condType === 12 ? ((p[1] as string) || '') : '');

  // 데이터 로드
  const systemData = useEditorStore(s => s.systemData);
  const switches = systemData?.switches || [];
  const variables = systemData?.variables || [];
  const actors = useDbNames('actors');
  const classes = useDbNames('classes');
  const skills = useDbNames('skills');
  const items = useDbNames('items');
  const weapons = useDbNames('weapons');
  const armors = useDbNames('armors');
  const states = useDbNames('states');

  const [showPicker, setShowPicker] = useState<string | null>(null);

  const getLabel = useCallback((id: number, list: string[]) => {
    const name = list[id] || '';
    return `${String(id).padStart(4, '0')}${name ? ': ' + name : ''}`;
  }, []);

  const handleOk = () => {
    let params: unknown[];
    switch (condType) {
      case 0: params = [0, switchId, switchValue]; break;
      case 1: params = [1, varId, varOperandType, varOperand, varCompare]; break;
      case 2: params = [2, selfSwitch, selfSwitchValue]; break;
      case 3: params = [3, timerMin * 60 + timerSec, timerCompare]; break;
      case 4: params = [4, actorId, actorSubType, actorSubType === 0 ? 0 : actorParam]; break;
      case 5: params = enemySubType === 0 ? [5, enemyIndex, 0] : [5, enemyIndex, 1, enemyStateId]; break;
      case 6: params = [6, charId, charDir]; break;
      case 7: params = [7, goldAmount, goldCompare]; break;
      case 8: params = [8, itemId]; break;
      case 9: params = [9, weaponId, weaponIncludeEquip]; break;
      case 10: params = [10, armorId, armorIncludeEquip]; break;
      case 11: params = [11, buttonName]; break;
      case 12: params = [12, scriptText]; break;
      case 13: params = [13, vehicleId]; break;
      default: params = [condType]; break;
    }
    // hasElse 정보를 extra로 전달 - EventCommandEditor에서 처리
    const elseMarker: EventCommand[] | undefined = hasElse
      ? [{ code: 411, indent: 0, parameters: [] }]
      : undefined;
    onOk(params, elseMarker);
  };

  const switchCondType = (type: number) => {
    setCondType(type);
  };

  // --- 탭 렌더링 ---
  const renderTab1 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 스위치 */}
      <div style={rowStyle}>
        <label style={radioStyle}>
          <input type="radio" name="cb-type" checked={condType === 0} onChange={() => switchCondType(0)} />
          스위치
        </label>
        <input type="text" readOnly value={getLabel(switchId, switches)}
          style={{ ...selectStyle, flex: 1, cursor: 'pointer', ...disabledOpacity(condType === 0) }}
          onClick={() => condType === 0 && setShowPicker('switch')} />
        <button className="db-btn" style={{ padding: '4px 8px', ...disabledOpacity(condType === 0) }}
          disabled={condType !== 0} onClick={() => setShowPicker('switch')}>...</button>
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
            <input type="radio" name="cb-type" checked={condType === 1} onChange={() => switchCondType(1)} />
            변수
          </label>
          <input type="text" readOnly value={getLabel(varId, variables)}
            style={{ ...selectStyle, flex: 1, cursor: 'pointer', ...disabledOpacity(condType === 1) }}
            onClick={() => condType === 1 && setShowPicker('variable')} />
          <button className="db-btn" style={{ padding: '4px 8px', ...disabledOpacity(condType === 1) }}
            disabled={condType !== 1} onClick={() => setShowPicker('variable')}>...</button>
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
            <input type="text" readOnly value={varOperandType === 1 ? getLabel(varOperand, variables) : ''}
              style={{ ...selectStyle, flex: 1, cursor: 'pointer', ...disabledOpacity(condType === 1 && varOperandType === 1) }}
              onClick={() => condType === 1 && varOperandType === 1 && setShowPicker('var-operand')} />
            <button className="db-btn" style={{ padding: '4px 8px', ...disabledOpacity(condType === 1 && varOperandType === 1) }}
              disabled={condType !== 1 || varOperandType !== 1} onClick={() => setShowPicker('var-operand')}>...</button>
          </div>
        </div>
      </div>

      {/* 셀프 스위치 */}
      <div style={rowStyle}>
        <label style={radioStyle}>
          <input type="radio" name="cb-type" checked={condType === 2} onChange={() => switchCondType(2)} />
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
          <input type="radio" name="cb-type" checked={condType === 3} onChange={() => switchCondType(3)} />
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

  const renderTab2 = () => {
    const actorSubTypes: [number, string][] = [
      [0, '파티에 있다'], [1, '이름'], [2, '직업'],
      [3, '스킬'], [4, '무기'], [5, '방어구'], [6, '스테이트'],
    ];
    const needsParam = actorSubType >= 1;
    const getParamList = (): string[] => {
      switch (actorSubType) {
        case 2: return classes;
        case 3: return skills;
        case 4: return weapons;
        case 5: return armors;
        case 6: return states;
        default: return [];
      }
    };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={rowStyle}>
          <span style={{ color: '#aaa', fontSize: 13, minWidth: 50 }}>액터:</span>
          <input type="text" readOnly value={getLabel(actorId, actors)}
            style={{ ...selectStyle, flex: 1, cursor: 'pointer' }}
            onClick={() => setShowPicker('actor')} />
          <button className="db-btn" style={{ padding: '4px 8px' }}
            onClick={() => setShowPicker('actor')}>...</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {actorSubTypes.map(([val, label]) => (
            <div key={val} style={rowStyle}>
              <label style={radioStyle}>
                <input type="radio" name="cb-actor-sub" checked={actorSubType === val}
                  onChange={() => { setActorSubType(val); if (val === 0) setActorParam(0); }} />
                {label}
              </label>
              {val === 1 && actorSubType === 1 && (
                <input type="text" value={actorParam as string}
                  onChange={e => setActorParam(e.target.value)}
                  style={{ ...selectStyle, flex: 1 }} />
              )}
              {val >= 2 && actorSubType === val && (
                <>
                  <input type="text" readOnly value={getLabel(actorParam as number, getParamList())}
                    style={{ ...selectStyle, flex: 1, cursor: 'pointer' }}
                    onClick={() => setShowPicker('actor-param')} />
                  <button className="db-btn" style={{ padding: '4px 8px' }}
                    onClick={() => setShowPicker('actor-param')}>...</button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTab3 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 적 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={rowStyle}>
          <label style={radioStyle}>
            <input type="radio" name="cb-type3" checked={condType === 5} onChange={() => switchCondType(5)} />
            적
          </label>
          <span style={{ color: '#aaa', fontSize: 12 }}>#</span>
          <input type="number" value={enemyIndex + 1}
            onChange={e => setEnemyIndex(Math.max(0, Number(e.target.value) - 1))}
            min={1} disabled={condType !== 5}
            style={{ ...selectStyle, width: 60, ...disabledOpacity(condType === 5) }} />
        </div>
        {condType === 5 && (
          <div style={{ marginLeft: 40, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={radioStyle}>
              <input type="radio" name="cb-enemy-sub" checked={enemySubType === 0}
                onChange={() => setEnemySubType(0)} />
              출현하고 있다
            </label>
            <div style={rowStyle}>
              <label style={radioStyle}>
                <input type="radio" name="cb-enemy-sub" checked={enemySubType === 1}
                  onChange={() => setEnemySubType(1)} />
                스테이트
              </label>
              {enemySubType === 1 && (
                <>
                  <input type="text" readOnly value={getLabel(enemyStateId, states)}
                    style={{ ...selectStyle, flex: 1, cursor: 'pointer' }}
                    onClick={() => setShowPicker('enemy-state')} />
                  <button className="db-btn" style={{ padding: '4px 8px' }}
                    onClick={() => setShowPicker('enemy-state')}>...</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 캐릭터 */}
      <div style={rowStyle}>
        <label style={radioStyle}>
          <input type="radio" name="cb-type3" checked={condType === 6} onChange={() => switchCondType(6)} />
          캐릭터
        </label>
        <select value={charId} onChange={e => setCharId(Number(e.target.value))}
          disabled={condType !== 6} style={{ ...selectStyle, width: 130, ...disabledOpacity(condType === 6) }}>
          <option value={-1}>플레이어</option>
          <option value={0}>이 이벤트</option>
        </select>
        <span style={{ color: '#aaa', fontSize: 13 }}>방향:</span>
        <select value={charDir} onChange={e => setCharDir(Number(e.target.value))}
          disabled={condType !== 6} style={{ ...selectStyle, width: 80, ...disabledOpacity(condType === 6) }}>
          <option value={2}>하</option>
          <option value={4}>좌</option>
          <option value={6}>우</option>
          <option value={8}>상</option>
        </select>
      </div>

      {/* 탈것 */}
      <div style={rowStyle}>
        <label style={radioStyle}>
          <input type="radio" name="cb-type3" checked={condType === 13} onChange={() => switchCondType(13)} />
          탈것
        </label>
        <select value={vehicleId} onChange={e => setVehicleId(Number(e.target.value))}
          disabled={condType !== 13} style={{ ...selectStyle, width: 120, ...disabledOpacity(condType === 13) }}>
          <option value={0}>소형선</option>
          <option value={1}>대형선</option>
          <option value={2}>비행선</option>
        </select>
      </div>
    </div>
  );

  const renderTab4 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 소지금 */}
      <div style={rowStyle}>
        <label style={radioStyle}>
          <input type="radio" name="cb-type4" checked={condType === 7} onChange={() => switchCondType(7)} />
          소지금
        </label>
        <select value={goldCompare} onChange={e => setGoldCompare(Number(e.target.value))}
          disabled={condType !== 7} style={{ ...selectStyle, width: 60, ...disabledOpacity(condType === 7) }}>
          <option value={0}>≥</option>
          <option value={1}>≤</option>
          <option value={2}>&lt;</option>
        </select>
        <input type="number" value={goldAmount} onChange={e => setGoldAmount(Number(e.target.value))}
          min={0} disabled={condType !== 7} style={{ ...selectStyle, width: 100, ...disabledOpacity(condType === 7) }} />
      </div>

      {/* 아이템 */}
      <div style={rowStyle}>
        <label style={radioStyle}>
          <input type="radio" name="cb-type4" checked={condType === 8} onChange={() => switchCondType(8)} />
          아이템
        </label>
        <input type="text" readOnly value={getLabel(itemId, items)}
          style={{ ...selectStyle, flex: 1, cursor: 'pointer', ...disabledOpacity(condType === 8) }}
          onClick={() => condType === 8 && setShowPicker('item')} />
        <button className="db-btn" style={{ padding: '4px 8px', ...disabledOpacity(condType === 8) }}
          disabled={condType !== 8} onClick={() => setShowPicker('item')}>...</button>
      </div>

      {/* 무기 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={rowStyle}>
          <label style={radioStyle}>
            <input type="radio" name="cb-type4" checked={condType === 9} onChange={() => switchCondType(9)} />
            무기
          </label>
          <input type="text" readOnly value={getLabel(weaponId, weapons)}
            style={{ ...selectStyle, flex: 1, cursor: 'pointer', ...disabledOpacity(condType === 9) }}
            onClick={() => condType === 9 && setShowPicker('weapon')} />
          <button className="db-btn" style={{ padding: '4px 8px', ...disabledOpacity(condType === 9) }}
            disabled={condType !== 9} onClick={() => setShowPicker('weapon')}>...</button>
        </div>
        {condType === 9 && (
          <label className="db-checkbox-label" style={{ ...radioStyle, marginLeft: 40 }}>
            <input type="checkbox" checked={weaponIncludeEquip} onChange={e => setWeaponIncludeEquip(e.target.checked)} />
            장비 포함
          </label>
        )}
      </div>

      {/* 방어구 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={rowStyle}>
          <label style={radioStyle}>
            <input type="radio" name="cb-type4" checked={condType === 10} onChange={() => switchCondType(10)} />
            방어구
          </label>
          <input type="text" readOnly value={getLabel(armorId, armors)}
            style={{ ...selectStyle, flex: 1, cursor: 'pointer', ...disabledOpacity(condType === 10) }}
            onClick={() => condType === 10 && setShowPicker('armor')} />
          <button className="db-btn" style={{ padding: '4px 8px', ...disabledOpacity(condType === 10) }}
            disabled={condType !== 10} onClick={() => setShowPicker('armor')}>...</button>
        </div>
        {condType === 10 && (
          <label className="db-checkbox-label" style={{ ...radioStyle, marginLeft: 40 }}>
            <input type="checkbox" checked={armorIncludeEquip} onChange={e => setArmorIncludeEquip(e.target.checked)} />
            장비 포함
          </label>
        )}
      </div>

      {/* 버튼 */}
      <div style={rowStyle}>
        <label style={radioStyle}>
          <input type="radio" name="cb-type4" checked={condType === 11} onChange={() => switchCondType(11)} />
          버튼
        </label>
        <select value={buttonName} onChange={e => setButtonName(e.target.value)}
          disabled={condType !== 11} style={{ ...selectStyle, width: 140, ...disabledOpacity(condType === 11) }}>
          {['ok', 'cancel', 'shift', 'down', 'left', 'right', 'up', 'pageup', 'pagedown'].map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {/* 스크립트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={radioStyle}>
          <input type="radio" name="cb-type4" checked={condType === 12} onChange={() => switchCondType(12)} />
          스크립트
        </label>
        {condType === 12 && (
          <input type="text" value={scriptText} onChange={e => setScriptText(e.target.value)}
            placeholder="JavaScript 식" style={{ ...selectStyle, width: '100%', marginLeft: 20, boxSizing: 'border-box' }} />
        )}
      </div>
    </div>
  );

  // 탭 전환 시 condType 동기화
  const handleTabChange = (newTab: number) => {
    setTab(newTab);
    // 현재 condType이 해당 탭에 속하지 않으면 기본값으로 변경
    if (getTabForType(condType) !== newTab) {
      setCondType(getDefaultTypeForTab(newTab));
    }
  };

  // 액터 파라미터 목록 (피커용)
  const getActorParamList = (): string[] => {
    switch (actorSubType) {
      case 2: return classes;
      case 3: return skills;
      case 4: return weapons;
      case 5: return armors;
      case 6: return states;
      default: return [];
    }
  };
  const getActorParamTitle = (): string => {
    switch (actorSubType) {
      case 2: return '직업 선택';
      case 3: return '스킬 선택';
      case 4: return '무기 선택';
      case 5: return '방어구 선택';
      case 6: return '스테이트 선택';
      default: return '선택';
    }
  };

  return (
    <>
      {/* 탭 버튼 */}
      <div className="cond-branch-tabs">
        {[1, 2, 3, 4].map(t => (
          <button key={t} className={`cond-branch-tab${tab === t - 1 ? ' active' : ''}`}
            onClick={() => handleTabChange(t - 1)}>{t}</button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div style={{ minHeight: 180 }}>
        {tab === 0 && renderTab1()}
        {tab === 1 && renderTab2()}
        {tab === 2 && renderTab3()}
        {tab === 3 && renderTab4()}
      </div>

      {/* 그 밖의 경우 */}
      <label className="db-checkbox-label" style={{ ...radioStyle, marginTop: 8, borderTop: '1px solid #444', paddingTop: 8 }}>
        <input type="checkbox" checked={hasElse} onChange={e => setHasElse(e.target.checked)} />
        그 밖의 경우에 대한 지점 작성
      </label>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={handleOk}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {/* 피커들 */}
      {showPicker === 'switch' && (
        <DataListPicker items={switches} value={switchId} onChange={setSwitchId}
          onClose={() => setShowPicker(null)} title="스위치 선택" />
      )}
      {showPicker === 'variable' && (
        <DataListPicker items={variables} value={varId} onChange={setVarId}
          onClose={() => setShowPicker(null)} title="변수 선택" />
      )}
      {showPicker === 'var-operand' && (
        <DataListPicker items={variables} value={varOperand} onChange={v => setVarOperand(v)}
          onClose={() => setShowPicker(null)} title="변수 선택" />
      )}
      {showPicker === 'actor' && (
        <DataListPicker items={actors} value={actorId} onChange={setActorId}
          onClose={() => setShowPicker(null)} title="액터 선택" />
      )}
      {showPicker === 'actor-param' && (
        <DataListPicker items={getActorParamList()} value={actorParam as number}
          onChange={v => setActorParam(v)}
          onClose={() => setShowPicker(null)} title={getActorParamTitle()} />
      )}
      {showPicker === 'enemy-state' && (
        <DataListPicker items={states} value={enemyStateId} onChange={setEnemyStateId}
          onClose={() => setShowPicker(null)} title="스테이트 선택" />
      )}
      {showPicker === 'item' && (
        <DataListPicker items={items} value={itemId} onChange={setItemId}
          onClose={() => setShowPicker(null)} title="아이템 선택" />
      )}
      {showPicker === 'weapon' && (
        <DataListPicker items={weapons} value={weaponId} onChange={setWeaponId}
          onClose={() => setShowPicker(null)} title="무기 선택" />
      )}
      {showPicker === 'armor' && (
        <DataListPicker items={armors} value={armorId} onChange={setArmorId}
          onClose={() => setShowPicker(null)} title="방어구 선택" />
      )}
    </>
  );
}
