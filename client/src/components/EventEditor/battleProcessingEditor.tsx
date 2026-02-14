import React, { useState } from 'react';
import { selectStyle } from './messageEditors';
import { VariableSwitchPicker } from './VariableSwitchSelector';
import { DataListPicker } from './dataListPicker';
import { useDbNames, getLabel } from './actionEditorUtils';
import type { EventCommand } from '../../types/rpgMakerMV';

/**
 * 전투 처리 (Battle Processing) 에디터 - code 301
 *
 * parameters 구조:
 *   params[0]: 지정 방식 (0=직접 지정, 1=변수로 지정, 2=랜덤 대결과 동일)
 *   params[1]: 적 군단 ID (직접 지정 시) 또는 변수 ID (변수 지정 시)
 *   params[2]: 도망 가능 (boolean)
 *   params[3]: 패배 가능 (boolean)
 */
export function BattleProcessingEditor({ p, onOk, onCancel }: {
  p: unknown[];
  onOk: (params: unknown[], extraCommands?: EventCommand[]) => void;
  onCancel: () => void;
}) {
  const [designationType, setDesignationType] = useState<number>((p[0] as number) || 0);
  const [troopId, setTroopId] = useState<number>(
    designationType === 0 ? ((p[1] as number) || 1) : 1
  );
  const [variableId, setVariableId] = useState<number>(
    designationType === 1 ? ((p[1] as number) || 1) : 1
  );
  const [canEscape, setCanEscape] = useState<boolean>((p[2] as boolean) ?? false);
  const [canLose, setCanLose] = useState<boolean>((p[3] as boolean) ?? false);
  const [showTroopPicker, setShowTroopPicker] = useState(false);

  const troopNames = useDbNames('troops');

  const radioStyle: React.CSSProperties = { fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' };

  const handleOk = () => {
    const operandId = designationType === 0 ? troopId : designationType === 1 ? variableId : 0;
    const params = [designationType, operandId, canEscape, canLose];

    // 블록 구조 생성: 승리(601) + 도망(602, canEscape일 때) + 패배(603, canLose일 때) + 종료(604)
    const extra: EventCommand[] = [];

    // 승리 분기
    extra.push({ code: 601, indent: 0, parameters: [] });
    extra.push({ code: 0, indent: 1, parameters: [] });

    // 도망 분기
    if (canEscape) {
      extra.push({ code: 602, indent: 0, parameters: [] });
      extra.push({ code: 0, indent: 1, parameters: [] });
    }

    // 패배 분기
    if (canLose) {
      extra.push({ code: 603, indent: 0, parameters: [] });
      extra.push({ code: 0, indent: 1, parameters: [] });
    }

    // 종료 마커
    extra.push({ code: 604, indent: 0, parameters: [] });

    onOk(params, extra);
  };

  return (
    <>
      <fieldset style={{ border: '1px solid #555', borderRadius: 4, padding: '8px 12px', margin: 0 }}>
        <legend style={{ fontSize: 12, color: '#aaa', padding: '0 4px' }}>적 군단</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 직접 지정 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="battle-designation" checked={designationType === 0} onChange={() => setDesignationType(0)} />
              직접 지정
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 24 }}>
            <button className="db-btn" onClick={() => setShowTroopPicker(true)}
              disabled={designationType !== 0}
              style={{ textAlign: 'left', padding: '4px 8px', fontSize: 13, flex: 1, opacity: designationType === 0 ? 1 : 0.5 }}>
              {getLabel(troopId, troopNames)}
            </button>
          </div>

          {/* 변수로 지정 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="battle-designation" checked={designationType === 1} onChange={() => setDesignationType(1)} />
              변수로 지정
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 24 }}>
            <VariableSwitchPicker type="variable" value={variableId} onChange={setVariableId}
              disabled={designationType !== 1} style={{ flex: 1 }} />
          </div>

          {/* 랜덤 대결과 동일 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={radioStyle}>
              <input type="radio" name="battle-designation" checked={designationType === 2} onChange={() => setDesignationType(2)} />
              랜덤 대결과 동일
            </label>
          </div>
        </div>
      </fieldset>

      {/* 옵션 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={radioStyle}>
          <input type="checkbox" checked={canEscape} onChange={e => setCanEscape(e.target.checked)} />
          도망 가능
        </label>
        <label style={radioStyle}>
          <input type="checkbox" checked={canLose} onChange={e => setCanLose(e.target.checked)} />
          패배 가능
        </label>
      </div>

      <div className="image-picker-footer">
        <button className="db-btn" onClick={handleOk}>OK</button>
        <button className="db-btn" onClick={onCancel}>취소</button>
      </div>

      {showTroopPicker && (
        <DataListPicker items={troopNames} value={troopId} onChange={setTroopId}
          onClose={() => setShowTroopPicker(false)} title="대상 선택" />
      )}
    </>
  );
}
