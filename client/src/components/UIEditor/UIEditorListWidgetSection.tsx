import React, { useState } from 'react';
import type {
  CustomCommandDef, CustomCommandHandler, CommandActionType, WidgetDef,
  WidgetDef_List, WidgetDef_TextList,
} from '../../store/uiEditorTypes';
import { inputStyle, smallBtnStyle, deleteBtnStyle, labelStyle, rowStyle } from './UIEditorSceneStyles';
import HelpButton from '../common/HelpButton';
import { checkboxLabelStyle, accentCheckboxStyle, ScriptPreviewField } from './UIEditorInspectorHelpers';
import { ActionHandlerEditor } from './UIEditorActionHandlerEditor';
import useEditorStore from '../../store/useEditorStore';
import UIEditorScenePickerDialog from './UIEditorScenePickerDialog';

// ── ListCommonSection — list / textList 공통 추가 프로퍼티 ─────────────────────

export function ListCommonSection({ widget, update }: {
  widget: WidgetDef_List | WidgetDef_TextList; update: (u: Partial<WidgetDef>) => void;
}) {
  const [showScenePicker, setShowScenePicker] = useState(false);
  const customScenes = useEditorStore(s => s.customScenes);
  const customSceneEntries = Object.values(customScenes.scenes).map(s => ({
    id: s.id, displayName: s.displayName, category: s.category,
  }));

  return (
    <div>
      {/* dataScript */}
      <ScriptPreviewField
        label="dataScript"
        helpText={'행 배열을 반환하는 JS 식.\n예: $gameParty.items().map(i => ({name:i.name, iconIndex:i.iconIndex}))\n설정하면 items 목록 대신 동적으로 행을 생성합니다.'}
        value={widget.dataScript || ''}
        onChange={(v) => update({ dataScript: v || undefined } as any)}
      />

      {/* onCursor */}
      <ScriptPreviewField
        label="onCursor"
        helpText={'커서가 이동할 때 실행되는 JS 코드.\n예: $ctx.item = this._window.item();'}
        value={widget.onCursor?.code || ''}
        onChange={(v) => update({ onCursor: v ? { code: v } : undefined } as any)}
      />

      {/* itemScene (list 전용) */}
      {widget.type === 'list' && (
        <div style={{ ...rowStyle, marginTop: 6 }}>
          <span style={{ fontSize: 11, color: '#888', width: 80, flexShrink: 0 }}>
            행 씬 ID
            <HelpButton text={'각 행을 렌더링할 UIScene ID.\n설정하면 각 행에 해당 씬을 임베드합니다.'} />
          </span>
          <span style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11,
            display: 'inline-flex', alignItems: 'center', minHeight: 22, padding: '2px 4px',
            color: (widget as WidgetDef_List).itemScene ? '#4af' : '#555',
          }}>
            {(widget as WidgetDef_List).itemScene || '(없음)'}
          </span>
          <button style={{ ...smallBtnStyle, marginLeft: 4, flexShrink: 0 }}
            onClick={() => setShowScenePicker(true)}
            title="행 씬 선택">선택</button>
          {(widget as WidgetDef_List).itemScene && (
            <button style={{ ...deleteBtnStyle, marginLeft: 2, flexShrink: 0 }}
              onClick={() => update({ itemScene: undefined } as any)}
              title="씬 제거">×</button>
          )}
          {showScenePicker && (
            <UIEditorScenePickerDialog
              currentScene={'Scene_CS_' + ((widget as WidgetDef_List).itemScene || '')}
              availableScenes={[]}
              customScenes={customSceneEntries}
              onSelect={(scene) => {
                const id = scene.replace(/^Scene_CS_/, '');
                update({ itemScene: id || undefined } as any);
              }}
              onClose={() => setShowScenePicker(false)}
            />
          )}
        </div>
      )}

      <label style={{ ...checkboxLabelStyle, padding: '4px 0 2px' }}>
        <input type="checkbox" checked={widget.autoRefresh !== false}
          onChange={(e) => update({ autoRefresh: e.target.checked ? undefined : false } as any)}
          style={accentCheckboxStyle} />
        자동 새로고침 (6프레임마다 rebuild)
        <HelpButton text={'true (기본): dataScript를 6프레임마다 재실행하여 목록을 갱신합니다.\nfalse: 자동 갱신 비활성화 (수동으로 refresh 호출 시에만 갱신).'} />
      </label>

    </div>
  );
}

// ── ListWidgetInspector ────────────────────────────────────

export function ListWidgetInspector({ sceneId: _sceneId, widget, update }: {
  sceneId: string; widget: WidgetDef_List | WidgetDef_TextList; update: (u: Partial<WidgetDef>) => void;
}) {
  const items = widget.items || [];
  const handlers = widget.handlers || {};

  const addItem = () => {
    const newItems = [...items, { name: `항목${items.length + 1}`, symbol: `cmd${Date.now()}`, enabled: true }];
    update({ items: newItems } as any);
  };

  const updateItem = (idx: number, updates: Partial<CustomCommandDef>) => {
    const newItems = items.map((c, i) => i === idx ? { ...c, ...updates } : c);
    update({ items: newItems } as any);
  };

  const removeItem = (idx: number) => {
    const newItems = items.filter((_, i) => i !== idx);
    update({ items: newItems } as any);
  };

  const updateHandler = (symbol: string, updates: Partial<CustomCommandHandler>) => {
    const newHandlers = { ...handlers, [symbol]: { ...(handlers[symbol] || { action: 'popScene' as CommandActionType }), ...updates } };
    update({ handlers: newHandlers } as any);
  };

  return (
    <div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 50 }}>열 수</span>
        <input style={{ ...inputStyle, width: 55 }} type="number" value={widget.maxCols || 1}
          onChange={(e) => update({ maxCols: parseInt(e.target.value) || 1 } as any)} />
      </div>
      <label style={{ ...labelStyle, marginTop: 6 }}>커맨드 목록</label>
      {items.map((item, idx) => (
        <div key={idx} style={{ marginBottom: 8, padding: 6, background: '#2a2a2a', borderRadius: 3 }}>
          <div style={rowStyle}>
            <input style={{ ...inputStyle, flex: 1 }} value={item.name} placeholder="표시 이름"
              onChange={(e) => updateItem(idx, { name: e.target.value })} />
            <input style={{ ...inputStyle, flex: 1 }} value={item.symbol} placeholder="심볼"
              onChange={(e) => updateItem(idx, { symbol: e.target.value })} />
            {!item.enabledCondition && (
              <label style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={item.enabled !== false}
                  onChange={(e) => updateItem(idx, { enabled: e.target.checked })} /> 활성
              </label>
            )}
            <button style={deleteBtnStyle} onClick={() => removeItem(idx)}>×</button>
          </div>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>활성 조건:</span>
            <input style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 10 }}
              placeholder="JS 식 (비워두면 enabled 체크박스 사용)"
              value={item.enabledCondition || ''}
              onChange={(e) => updateItem(idx, { enabledCondition: e.target.value || undefined })} />
          </div>
          <ActionHandlerEditor
            handler={handlers[item.symbol] || { action: 'popScene' }}
            onChange={(updates) => updateHandler(item.symbol, updates)}
          />
        </div>
      ))}
      <button style={{ ...smallBtnStyle, width: '100%', marginTop: 4 }} onClick={addItem}>+ 항목</button>

      {/* 공통 추가 프로퍼티 섹션 */}
      <ListCommonSection widget={widget} update={update} />
    </div>
  );
}
