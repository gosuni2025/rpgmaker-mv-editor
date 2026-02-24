import React from 'react';
import { selectStyle } from './messageEditors';
import { DataListPicker } from './dataListPicker';
import { radioStyle, rowStyle, disabledOpacity, getLabel, useDbNamesWithIcons } from './condBranchHelpers';
import { ScriptSampleDialog } from './ScriptSampleDialog';
import { COND_BRANCH_SAMPLES } from './scriptSamples';

interface Props {
  condType: number;
  onCondTypeChange: (t: number) => void;
  goldAmount: number; setGoldAmount: (v: number) => void;
  goldCompare: number; setGoldCompare: (v: number) => void;
  itemId: number; setItemId: (v: number) => void;
  weaponId: number; setWeaponId: (v: number) => void;
  weaponIncludeEquip: boolean; setWeaponIncludeEquip: (v: boolean) => void;
  armorId: number; setArmorId: (v: number) => void;
  armorIncludeEquip: boolean; setArmorIncludeEquip: (v: boolean) => void;
  buttonName: string; setButtonName: (v: string) => void;
  scriptText: string; setScriptText: (v: string) => void;
  scriptComment: string; setScriptComment: (v: string) => void;
}

export function CondBranchTab4({
  condType, onCondTypeChange,
  goldAmount, setGoldAmount, goldCompare, setGoldCompare,
  itemId, setItemId,
  weaponId, setWeaponId, weaponIncludeEquip, setWeaponIncludeEquip,
  armorId, setArmorId, armorIncludeEquip, setArmorIncludeEquip,
  buttonName, setButtonName,
  scriptText, setScriptText,
  scriptComment, setScriptComment,
}: Props) {
  const { names: items, iconIndices: itemIcons } = useDbNamesWithIcons('items');
  const { names: weapons, iconIndices: weaponIcons } = useDbNamesWithIcons('weapons');
  const { names: armors, iconIndices: armorIcons } = useDbNamesWithIcons('armors');
  const [showPicker, setShowPicker] = React.useState<string | null>(null);
  const [showSampleDialog, setShowSampleDialog] = React.useState(false);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 소지금 */}
        <div style={rowStyle}>
          <label style={radioStyle}>
            <input type="radio" name="cb-type4" checked={condType === 7} onChange={() => onCondTypeChange(7)} />
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
            <input type="radio" name="cb-type4" checked={condType === 8} onChange={() => onCondTypeChange(8)} />
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
              <input type="radio" name="cb-type4" checked={condType === 9} onChange={() => onCondTypeChange(9)} />
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
              <input type="radio" name="cb-type4" checked={condType === 10} onChange={() => onCondTypeChange(10)} />
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
            <input type="radio" name="cb-type4" checked={condType === 11} onChange={() => onCondTypeChange(11)} />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={radioStyle}>
            <input type="radio" name="cb-type4" checked={condType === 12} onChange={() => onCondTypeChange(12)} />
            스크립트
          </label>
          {condType === 12 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 20 }}>
              {/* 주석 입력 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#777', whiteSpace: 'nowrap', width: 30 }}>메모</span>
                <input
                  type="text"
                  value={scriptComment}
                  onChange={e => setScriptComment(e.target.value)}
                  placeholder="이 조건의 의미를 간단히 메모..."
                  style={{ ...selectStyle, flex: 1, fontSize: 12, color: '#aaa', boxSizing: 'border-box' }}
                />
              </div>
              {/* 스크립트 식 입력 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#777', whiteSpace: 'nowrap', width: 30 }}>식</span>
                <input
                  type="text"
                  value={scriptText}
                  onChange={e => setScriptText(e.target.value)}
                  placeholder="JavaScript 조건식 (true/false 반환)"
                  style={{ ...selectStyle, flex: 1, fontFamily: 'monospace', boxSizing: 'border-box' }}
                />
                <button
                  className="db-btn"
                  style={{ padding: '4px 8px', flexShrink: 0 }}
                  title="샘플 코드 보기"
                  onClick={() => setShowSampleDialog(true)}
                >
                  ...
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPicker === 'item' && (
        <DataListPicker items={items} value={itemId} onChange={setItemId}
          onClose={() => setShowPicker(null)} title="아이템 선택" iconIndices={itemIcons} />
      )}
      {showPicker === 'weapon' && (
        <DataListPicker items={weapons} value={weaponId} onChange={setWeaponId}
          onClose={() => setShowPicker(null)} title="무기 선택" iconIndices={weaponIcons} />
      )}
      {showPicker === 'armor' && (
        <DataListPicker items={armors} value={armorId} onChange={setArmorId}
          onClose={() => setShowPicker(null)} title="방어구 선택" iconIndices={armorIcons} />
      )}
      {showSampleDialog && (
        <ScriptSampleDialog
          samples={COND_BRANCH_SAMPLES}
          onInsert={(code, comment) => {
            setScriptText(code);
            if (comment) setScriptComment(comment);
            setShowSampleDialog(false);
          }}
          onClose={() => setShowSampleDialog(false)}
        />
      )}
    </>
  );
}
