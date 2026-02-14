import React from 'react';
import { selectStyle } from './messageEditors';
import { DataListPicker } from './dataListPicker';
import { radioStyle, rowStyle, disabledOpacity, getLabel, useDbNamesWithIcons } from './condBranchHelpers';

interface Props {
  condType: number;
  onCondTypeChange: (t: number) => void;
  enemyIndex: number; setEnemyIndex: (v: number) => void;
  enemySubType: number; setEnemySubType: (v: number) => void;
  enemyStateId: number; setEnemyStateId: (v: number) => void;
  charId: number; setCharId: (v: number) => void;
  charDir: number; setCharDir: (v: number) => void;
  vehicleId: number; setVehicleId: (v: number) => void;
}

export function CondBranchTab3({
  condType, onCondTypeChange,
  enemyIndex, setEnemyIndex, enemySubType, setEnemySubType, enemyStateId, setEnemyStateId,
  charId, setCharId, charDir, setCharDir,
  vehicleId, setVehicleId,
}: Props) {
  const { names: states, iconIndices: stateIcons } = useDbNamesWithIcons('states');
  const [showPicker, setShowPicker] = React.useState<string | null>(null);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 적 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={rowStyle}>
            <label style={radioStyle}>
              <input type="radio" name="cb-type3" checked={condType === 5} onChange={() => onCondTypeChange(5)} />
              적
            </label>
            <select value={enemyIndex}
              onChange={e => setEnemyIndex(Number(e.target.value))}
              disabled={condType !== 5}
              style={{ ...selectStyle, width: 160, ...disabledOpacity(condType === 5) }}>
              {Array.from({ length: 8 }, (_, i) => (
                <option key={i} value={i}>#{i + 1} ?</option>
              ))}
            </select>
          </div>
          <div style={{ marginLeft: 100, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ ...radioStyle, ...disabledOpacity(condType === 5) }}>
              <input type="radio" name="cb-enemy-sub" checked={enemySubType === 0}
                onChange={() => setEnemySubType(0)} disabled={condType !== 5} />
              나타남
            </label>
            <div style={rowStyle}>
              <label style={{ ...radioStyle, ...disabledOpacity(condType === 5) }}>
                <input type="radio" name="cb-enemy-sub" checked={enemySubType === 1}
                  onChange={() => setEnemySubType(1)} disabled={condType !== 5} />
                스탯
              </label>
              <input type="text" readOnly value={getLabel(enemyStateId, states)}
                style={{ ...selectStyle, flex: 1, cursor: 'pointer', ...disabledOpacity(condType === 5 && enemySubType === 1) }}
                onClick={() => condType === 5 && enemySubType === 1 && setShowPicker('enemy-state')} />
              <button className="db-btn" style={{ padding: '4px 8px', ...disabledOpacity(condType === 5 && enemySubType === 1) }}
                disabled={condType !== 5 || enemySubType !== 1} onClick={() => setShowPicker('enemy-state')}>...</button>
            </div>
          </div>
        </div>

        {/* 캐릭터 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={rowStyle}>
            <label style={radioStyle}>
              <input type="radio" name="cb-type3" checked={condType === 6} onChange={() => onCondTypeChange(6)} />
              캐릭터
            </label>
            <select value={charId} onChange={e => setCharId(Number(e.target.value))}
              disabled={condType !== 6} style={{ ...selectStyle, width: 160, ...disabledOpacity(condType === 6) }}>
              <option value={-1}>플레이어</option>
              <option value={0}>이 이벤트</option>
            </select>
          </div>
          <div style={{ marginLeft: 100, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#ddd', fontSize: 13, ...disabledOpacity(condType === 6) }}>마주하고 있음</span>
            <select value={charDir} onChange={e => setCharDir(Number(e.target.value))}
              disabled={condType !== 6} style={{ ...selectStyle, width: 80, ...disabledOpacity(condType === 6) }}>
              <option value={2}>아래</option>
              <option value={4}>왼쪽</option>
              <option value={6}>오른쪽</option>
              <option value={8}>위</option>
            </select>
          </div>
        </div>

        {/* 차량 */}
        <div style={rowStyle}>
          <label style={radioStyle}>
            <input type="radio" name="cb-type3" checked={condType === 13} onChange={() => onCondTypeChange(13)} />
            차량
          </label>
          <select value={vehicleId} onChange={e => setVehicleId(Number(e.target.value))}
            disabled={condType !== 13} style={{ ...selectStyle, width: 120, ...disabledOpacity(condType === 13) }}>
            <option value={0}>보트</option>
            <option value={1}>대형선</option>
            <option value={2}>비행선</option>
          </select>
          <span style={{ color: '#ddd', fontSize: 13, ...disabledOpacity(condType === 13) }}>운행되었습니다</span>
        </div>
      </div>

      {showPicker === 'enemy-state' && (
        <DataListPicker items={states} value={enemyStateId} onChange={setEnemyStateId}
          onClose={() => setShowPicker(null)} title="스테이트 선택" iconIndices={stateIcons} />
      )}
    </>
  );
}
