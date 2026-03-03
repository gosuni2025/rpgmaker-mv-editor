import React from 'react';
import type { CustomCommandHandler, CommandActionType } from '../../store/uiEditorTypes';
import { inputStyle, selectStyle, rowStyle, labelStyle } from './UIEditorSceneStyles';
import { inlineLabelStyle, ScriptPreviewField } from './UIEditorInspectorHelpers';

// ── ActionHandlerEditor ────────────────────────────────────

export function ActionHandlerEditor({ handler, onChange }: {
  handler: CustomCommandHandler;
  onChange: (updates: Partial<CustomCommandHandler>) => void;
}) {
  const action = handler.action || 'popScene';
  return (
    <div>
      <div style={rowStyle}>
        <span style={inlineLabelStyle}>동작:</span>
        <select style={{ ...selectStyle, flex: 1 }} value={action}
          onChange={(e) => onChange({ action: e.target.value as CommandActionType })}>
          <option value="popScene">씬 닫기</option>
          <option value="gotoScene">씬 이동</option>
          <option value="customScene">커스텀 씬 이동</option>
          <option value="callCommonEvent">커먼 이벤트 호출</option>
          <option value="focusWidget">위젯 포커스</option>
          <option value="refreshWidgets">위젯 갱신</option>
          <option value="selectActor">액터 선택 → 씬 이동</option>
          <option value="formation">대형 (파티 순서 교체)</option>
          <option value="toggleConfig">설정 토글 (bool)</option>
          <option value="incrementConfig">설정 증가 (볼륨)</option>
          <option value="decrementConfig">설정 감소 (볼륨)</option>
          <option value="saveConfig">설정 저장</option>
          <option value="script">JS 스크립트 실행</option>
        </select>
      </div>
      {(action === 'gotoScene' || action === 'customScene' || action === 'focusWidget') && (
        <div style={rowStyle}>
          <span style={inlineLabelStyle}>대상:</span>
          <input style={{ ...inputStyle, flex: 1 }}
            placeholder={action === 'focusWidget' ? '위젯 ID' : '씬 이름'}
            value={handler.target || ''}
            onChange={(e) => onChange({ target: e.target.value })} />
        </div>
      )}
      {(action === 'selectActor' || action === 'formation') && (
        <div style={rowStyle}>
          <span style={inlineLabelStyle}>위젯 ID:</span>
          <input style={{ ...inputStyle, flex: 1 }}
            placeholder="actor_select"
            value={handler.widget || ''}
            onChange={(e) => onChange({ widget: e.target.value })} />
        </div>
      )}
      {action === 'selectActor' && (
        <div>
          <label style={{ ...labelStyle, marginTop: 4 }}>액터 선택 후 이동할 씬</label>
          <div style={rowStyle}>
            <span style={inlineLabelStyle}>씬:</span>
            <input style={{ ...inputStyle, flex: 1 }}
              placeholder="Scene_Skill"
              value={handler.thenAction?.target || ''}
              onChange={(e) => onChange({ thenAction: { action: 'gotoScene', target: e.target.value } })} />
          </div>
        </div>
      )}
      {(action === 'toggleConfig' || action === 'incrementConfig' || action === 'decrementConfig') && (
        <div>
          <div style={rowStyle}>
            <span style={inlineLabelStyle}>configKey:</span>
            <input style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11 }}
              placeholder="alwaysDash / bgmVolume …"
              value={handler.configKey || ''}
              onChange={(e) => onChange({ configKey: e.target.value })} />
          </div>
          {(action === 'incrementConfig' || action === 'decrementConfig') && (
            <div style={rowStyle}>
              <span style={inlineLabelStyle}>step:</span>
              <input style={{ ...inputStyle, width: 60 }} type="number"
                placeholder="20"
                value={handler.step ?? ''}
                onChange={(e) => onChange({ step: parseInt(e.target.value) || undefined })} />
            </div>
          )}
        </div>
      )}
      {action === 'callCommonEvent' && (
        <div style={rowStyle}>
          <span style={inlineLabelStyle}>이벤트 ID:</span>
          <input style={{ ...inputStyle, width: 60 }} type="number"
            value={handler.eventId || ''}
            onChange={(e) => onChange({ eventId: parseInt(e.target.value) || 0 })} />
        </div>
      )}
      {action === 'script' && (
        <ScriptPreviewField
          label="JS 코드"
          helpText="버튼 동작 시 실행할 JavaScript 코드.\n$ctx, $scene, $gameVariables 등 사용 가능."
          value={handler.code || ''}
          onChange={(v) => onChange({ code: v || undefined })}
          initialSampleTab="UI"
        />
      )}
    </div>
  );
}
