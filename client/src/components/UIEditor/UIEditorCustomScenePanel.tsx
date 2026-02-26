import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import useEditorStore from '../../store/useEditorStore';
import type {
  CustomCommandDef, CustomCommandHandler, CustomElementDef, CustomWindowDef,
  CommandActionType, WidgetDef, WidgetType, WidgetDef_Panel, WidgetDef_Label,
  WidgetDef_Image, WidgetDef_ActorFace, WidgetDef_Gauge, WidgetDef_Button,
  WidgetDef_List, WidgetDef_ActorList, WidgetDef_Options, OptionItemDef,
  WidgetDef_ConfigValue, NavigationConfig, CustomSceneDef, CustomSceneDefV2
} from '../../store/uiEditorTypes';
import './UIEditor.css';

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#3c3c3c', border: '1px solid #555', color: '#ddd',
  padding: '4px 6px', borderRadius: 2, boxSizing: 'border-box', fontSize: 12,
};
const selectStyle: React.CSSProperties = { ...inputStyle };
const smallBtnStyle: React.CSSProperties = {
  padding: '2px 8px', background: '#555', border: 'none', color: '#ddd',
  borderRadius: 2, cursor: 'pointer', fontSize: 11,
};
const deleteBtnStyle: React.CSSProperties = {
  ...smallBtnStyle, background: '#733', color: '#faa', padding: '2px 6px',
};
const sectionStyle: React.CSSProperties = {
  padding: '8px 10px', borderBottom: '1px solid #444',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#aaa', marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: '0.5px',
};
const rowStyle: React.CSSProperties = {
  display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6,
};

// ── V2 포맷 감지 / 변환 ──────────────────────────────────

function isV2Scene(scene: any): boolean {
  return !!(scene.root || (scene.formatVersion && scene.formatVersion >= 2));
}

function convertLegacyToV2(scene: CustomSceneDef): Partial<CustomSceneDefV2> {
  const children: WidgetDef[] = (scene.windows || []).map((win) => {
    if (win.windowType === 'command') {
      return {
        id: win.id, type: 'list' as const,
        x: win.x, y: win.y,
        width: win.width, height: win.height || undefined,
        maxCols: win.maxCols,
        items: win.commands || [],
        handlers: win.handlers || {},
      } as WidgetDef_List;
    } else {
      return {
        id: win.id, type: 'panel' as const,
        x: win.x, y: win.y,
        width: win.width, height: win.height || undefined,
        windowed: true,
        children: [],
      } as WidgetDef_Panel;
    }
  });

  const root: WidgetDef_Panel = {
    id: 'root', type: 'panel',
    x: 0, y: 0, width: 816, height: 624,
    windowed: false,
    children,
  };

  return { root, formatVersion: 2, navigation: { defaultFocus: children[0]?.id } };
}

// ── 레거시 컴포넌트 (CommandEditor, ElementEditor, WindowDetail) ──

function CommandEditor({ sceneId, win }: { sceneId: string; win: CustomWindowDef }) {
  const updateCustomWindow = useEditorStore((s) => s.updateCustomWindow);

  const addCommand = () => {
    const cmds = [...(win.commands || []), { name: `항목${(win.commands?.length || 0) + 1}`, symbol: `cmd${Date.now()}`, enabled: true }];
    updateCustomWindow(sceneId, win.id, { commands: cmds });
  };

  const updateCommand = (idx: number, updates: Partial<CustomCommandDef>) => {
    const cmds = (win.commands || []).map((c, i) => i === idx ? { ...c, ...updates } : c);
    updateCustomWindow(sceneId, win.id, { commands: cmds });
  };

  const removeCommand = (idx: number) => {
    const cmds = (win.commands || []).filter((_, i) => i !== idx);
    updateCustomWindow(sceneId, win.id, { commands: cmds });
  };

  const updateHandler = (symbol: string, updates: Partial<CustomCommandHandler>) => {
    const handlers = { ...(win.handlers || {}), [symbol]: { ...(win.handlers?.[symbol] || { action: 'popScene' as CommandActionType }), ...updates } };
    updateCustomWindow(sceneId, win.id, { handlers });
  };

  return (
    <div>
      <label style={labelStyle}>커맨드 목록</label>
      {(win.commands || []).map((cmd, idx) => (
        <div key={idx} style={{ marginBottom: 8, padding: 6, background: '#2a2a2a', borderRadius: 3 }}>
          <div style={rowStyle}>
            <input style={{ ...inputStyle, flex: 1 }} value={cmd.name} placeholder="표시 이름"
              onChange={(e) => updateCommand(idx, { name: e.target.value })} />
            <input style={{ ...inputStyle, flex: 1 }} value={cmd.symbol} placeholder="심볼"
              onChange={(e) => updateCommand(idx, { symbol: e.target.value })} />
            <label style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={cmd.enabled}
                onChange={(e) => updateCommand(idx, { enabled: e.target.checked })} /> 활성
            </label>
            <button style={deleteBtnStyle} onClick={() => removeCommand(idx)}>×</button>
          </div>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>동작:</span>
            <select style={{ ...selectStyle, flex: 1 }}
              value={win.handlers?.[cmd.symbol]?.action || 'popScene'}
              onChange={(e) => updateHandler(cmd.symbol, { action: e.target.value as CommandActionType })}>
              <option value="popScene">씬 닫기</option>
              <option value="gotoScene">씬 이동</option>
              <option value="customScene">커스텀 씬 이동</option>
              <option value="callCommonEvent">커먼 이벤트 호출</option>
              <option value="activateWindow">Window 활성화</option>
              <option value="script">JS 스크립트 실행</option>
            </select>
            {(win.handlers?.[cmd.symbol]?.action === 'gotoScene' || win.handlers?.[cmd.symbol]?.action === 'customScene' || win.handlers?.[cmd.symbol]?.action === 'activateWindow') && (
              <input style={{ ...inputStyle, flex: 1 }} placeholder="대상"
                value={win.handlers?.[cmd.symbol]?.target || ''}
                onChange={(e) => updateHandler(cmd.symbol, { target: e.target.value })} />
            )}
            {win.handlers?.[cmd.symbol]?.action === 'callCommonEvent' && (
              <input style={{ ...inputStyle, width: 60 }} type="number" placeholder="ID"
                value={win.handlers?.[cmd.symbol]?.eventId || ''}
                onChange={(e) => updateHandler(cmd.symbol, { eventId: parseInt(e.target.value) || 0 })} />
            )}
          </div>
          {win.handlers?.[cmd.symbol]?.action === 'script' && (
            <div style={{ marginTop: 4 }}>
              <textarea
                style={{ ...inputStyle, height: 60, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
                placeholder="// JS 코드 (ConfigManager, $gameVariables 등 사용 가능)&#10;// 실행 후 display 창 자동 갱신됨"
                value={win.handlers?.[cmd.symbol]?.code || ''}
                onChange={(e) => updateHandler(cmd.symbol, { code: e.target.value })}
              />
            </div>
          )}
        </div>
      ))}
      <button style={{ ...smallBtnStyle, width: '100%', marginTop: 4 }} onClick={addCommand}>+ 커맨드</button>
    </div>
  );
}

function ElementEditor({ sceneId, win }: { sceneId: string; win: CustomWindowDef }) {
  const updateCustomWindow = useEditorStore((s) => s.updateCustomWindow);

  const addElement = (type: string) => {
    const elems = [...(win.elements || []), { type, x: 0, y: 0, width: 200, height: 36, content: '' }];
    updateCustomWindow(sceneId, win.id, { elements: elems });
  };

  const updateElement = (idx: number, updates: Partial<CustomElementDef>) => {
    const elems = (win.elements || []).map((e, i) => i === idx ? { ...e, ...updates } : e);
    updateCustomWindow(sceneId, win.id, { elements: elems });
  };

  const removeElement = (idx: number) => {
    const elems = (win.elements || []).filter((_, i) => i !== idx);
    updateCustomWindow(sceneId, win.id, { elements: elems });
  };

  return (
    <div>
      <label style={labelStyle}>표시 요소</label>
      {(win.elements || []).map((elem, idx) => (
        <div key={idx} style={{ marginBottom: 6, padding: 6, background: '#2a2a2a', borderRadius: 3 }}>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888' }}>{elem.type}</span>
            <button style={deleteBtnStyle} onClick={() => removeElement(idx)}>×</button>
          </div>
          <div style={{ ...rowStyle, flexWrap: 'wrap' }}>
            <input style={{ ...inputStyle, width: 50 }} type="number" placeholder="x" value={elem.x}
              onChange={(e) => updateElement(idx, { x: parseInt(e.target.value) || 0 })} />
            <input style={{ ...inputStyle, width: 50 }} type="number" placeholder="y" value={elem.y}
              onChange={(e) => updateElement(idx, { y: parseInt(e.target.value) || 0 })} />
            <input style={{ ...inputStyle, width: 50 }} type="number" placeholder="w" value={elem.width}
              onChange={(e) => updateElement(idx, { width: parseInt(e.target.value) || 0 })} />
            <input style={{ ...inputStyle, width: 50 }} type="number" placeholder="h" value={elem.height}
              onChange={(e) => updateElement(idx, { height: parseInt(e.target.value) || 0 })} />
          </div>
          {elem.content !== undefined && (
            <input style={inputStyle} value={elem.content || ''} placeholder="내용"
              onChange={(e) => updateElement(idx, { content: e.target.value })} />
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <button style={{ ...smallBtnStyle, flex: 1 }} onClick={() => addElement('text')}>+ 텍스트</button>
        <button style={{ ...smallBtnStyle, flex: 1 }} onClick={() => addElement('image')}>+ 이미지</button>
        <button style={{ ...smallBtnStyle, flex: 1 }} onClick={() => addElement('gauge')}>+ 게이지</button>
      </div>
    </div>
  );
}

function WindowDetail({ sceneId, win }: { sceneId: string; win: CustomWindowDef }) {
  const updateCustomWindow = useEditorStore((s) => s.updateCustomWindow);

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={sectionStyle}>
        <label style={labelStyle}>Window 속성</label>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 60 }}>이름</span>
          <input style={{ ...inputStyle, flex: 1 }} value={win.displayName}
            onChange={(e) => updateCustomWindow(sceneId, win.id, { displayName: e.target.value })} />
        </div>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 60 }}>타입</span>
          <select style={{ ...selectStyle, flex: 1 }} value={win.windowType}
            onChange={(e) => updateCustomWindow(sceneId, win.id, { windowType: e.target.value as 'command' | 'display' })}>
            <option value="command">command</option>
            <option value="display">display</option>
          </select>
        </div>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 60 }}>위치</span>
          <input style={{ ...inputStyle, width: 60 }} type="number" value={win.x}
            onChange={(e) => updateCustomWindow(sceneId, win.id, { x: parseInt(e.target.value) || 0 })} />
          <input style={{ ...inputStyle, width: 60 }} type="number" value={win.y}
            onChange={(e) => updateCustomWindow(sceneId, win.id, { y: parseInt(e.target.value) || 0 })} />
          <span style={{ fontSize: 11, color: '#888', width: 60 }}>크기</span>
          <input style={{ ...inputStyle, width: 60 }} type="number" value={win.width}
            onChange={(e) => updateCustomWindow(sceneId, win.id, { width: parseInt(e.target.value) || 0 })} />
          <input style={{ ...inputStyle, width: 60 }} type="number" value={win.height ?? ''}
            placeholder="auto"
            onChange={(e) => {
              const v = e.target.value.trim();
              updateCustomWindow(sceneId, win.id, { height: v === '' ? null : (parseInt(v) || 0) });
            }} />
        </div>
        {win.windowType === 'command' && (
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 60 }}>열 수</span>
            <input style={{ ...inputStyle, width: 60 }} type="number" value={win.maxCols ?? 1}
              onChange={(e) => updateCustomWindow(sceneId, win.id, { maxCols: parseInt(e.target.value) || 1 })} />
          </div>
        )}
      </div>

      <div style={sectionStyle}>
        {win.windowType === 'command' ? (
          <CommandEditor sceneId={sceneId} win={win} />
        ) : (
          <ElementEditor sceneId={sceneId} win={win} />
        )}
      </div>
    </div>
  );
}

// ── V2: NavigationConfigSection ──────────────────────────

function NavigationConfigSection({ sceneId, nav }: { sceneId: string; nav: NavigationConfig }) {
  const updateNavigation = useEditorStore((s) => s.updateNavigation);
  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>네비게이션 설정</label>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 70 }}>기본 포커스</span>
        <input style={{ ...inputStyle, flex: 1 }} value={nav.defaultFocus || ''}
          placeholder="widget id"
          onChange={(e) => updateNavigation(sceneId, { defaultFocus: e.target.value || undefined })} />
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 70 }}>취소 위젯</span>
        <input style={{ ...inputStyle, flex: 1 }} value={nav.cancelWidget || ''}
          placeholder="widget id"
          onChange={(e) => updateNavigation(sceneId, { cancelWidget: e.target.value || undefined })} />
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 70 }}>포커스 순서</span>
        <input style={{ ...inputStyle, flex: 1 }}
          placeholder="쉼표로 구분 (id1, id2, ...)"
          value={(nav.focusOrder || []).join(', ')}
          onChange={(e) => {
            const order = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
            updateNavigation(sceneId, { focusOrder: order.length > 0 ? order : undefined });
          }} />
      </div>
    </div>
  );
}

// ── V2: WidgetHierarchy (트리 뷰) ────────────────────────

const WIDGET_TYPE_COLORS: Record<WidgetType, string> = {
  panel: '#4a6fa5', label: '#5a8a5a', image: '#8a5a8a',
  actorFace: '#8a7a3a', gauge: '#8a4a3a', separator: '#555',
  button: '#2675bf', list: '#2a7a3a', actorList: '#7a3a7a', options: '#7a5a2a', configValue: '#4a7a8a',
};

const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
  panel: 'PANEL', label: 'LABEL', image: 'IMG',
  actorFace: 'FACE', gauge: 'GAUGE', separator: 'SEP',
  button: 'BTN', list: 'LIST', actorList: 'ACTORS', options: 'OPTS', configValue: 'CFG',
};

function WidgetTreeNode({
  widget, depth, sceneId, selectedId, onSelect, onRemove
}: {
  widget: WidgetDef; depth: number; sceneId: string;
  selectedId: string | null; onSelect: (id: string) => void; onRemove: (id: string) => void;
}) {
  const isSelected = widget.id === selectedId;
  const children: WidgetDef[] =
    widget.type === 'panel' ? ((widget as WidgetDef_Panel).children || []) :
    widget.type === 'button' ? ((widget as WidgetDef_Button).children || []) :
    [];
  const hasChildren = children.length > 0;
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          paddingLeft: depth * 12 + 4, paddingRight: 4,
          paddingTop: 3, paddingBottom: 3,
          background: isSelected ? '#2675bf33' : 'transparent',
          cursor: 'pointer', borderRadius: 2,
        }}
        onClick={() => onSelect(widget.id)}
      >
        {hasChildren ? (
          <span
            style={{ fontSize: 10, color: '#888', cursor: 'pointer', width: 12, textAlign: 'center' }}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? '\u25BE' : '\u25B8'}
          </span>
        ) : (
          <span style={{ width: 12 }} />
        )}
        <span style={{
          fontSize: 9, padding: '1px 3px', borderRadius: 2,
          background: WIDGET_TYPE_COLORS[widget.type] || '#555', color: '#fff',
          flexShrink: 0,
        }}>
          {WIDGET_TYPE_LABELS[widget.type]}
        </span>
        <span style={{ flex: 1, fontSize: 12, color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {widget.id}
          {'text' in widget && (widget as any).text ? (
            <span style={{ color: '#888', fontSize: 10, marginLeft: 4 }}>"{(widget as any).text.slice(0, 15)}"</span>
          ) : null}
        </span>
        {widget.id !== 'root' && (
          <button style={{ ...deleteBtnStyle, fontSize: 9, padding: '1px 4px' }}
            onClick={(e) => { e.stopPropagation(); onRemove(widget.id); }}>
            ×
          </button>
        )}
      </div>
      {hasChildren && expanded && children.map((child) => (
        <WidgetTreeNode
          key={child.id} widget={child} depth={depth + 1}
          sceneId={sceneId} selectedId={selectedId}
          onSelect={onSelect} onRemove={onRemove}
        />
      ))}
    </div>
  );
}

// ── V2: AddWidgetMenu ────────────────────────────────────

function AddWidgetMenu({ sceneId, parentId, onClose }: { sceneId: string; parentId: string; onClose: () => void }) {
  const addWidget = useEditorStore((s) => s.addWidget);
  const setCustomSceneSelectedWidget = useEditorStore((s) => s.setCustomSceneSelectedWidget);

  const handleAdd = (type: WidgetType) => {
    const id = `${type}_${Date.now()}`;
    let def: WidgetDef;
    switch (type) {
      case 'panel': def = { id, type, x: 0, y: 0, width: 300, height: 200, windowed: true, children: [] }; break;
      case 'label': def = { id, type, x: 0, y: 0, width: 200, height: 36, text: '텍스트' }; break;
      case 'image': def = { id, type, x: 0, y: 0, width: 100, height: 100, imageName: '' }; break;
      case 'actorFace': def = { id, type, x: 0, y: 0, width: 144, height: 144, actorIndex: 0 }; break;
      case 'gauge': def = { id, type, x: 0, y: 0, width: 200, height: 36, gaugeType: 'hp', actorIndex: 0 }; break;
      case 'separator': def = { id, type, x: 0, y: 0, width: 200, height: 4 }; break;
      case 'button': def = { id, type, x: 0, y: 0, width: 200, height: 52, label: '버튼', action: { action: 'popScene' } }; break;
      case 'configValue': def = { id, type, x: 0, y: 0, width: 150, height: 36, configKey: '', align: 'right' } as WidgetDef_ConfigValue; break;
      case 'list': def = { id, type, x: 0, y: 0, width: 200, items: [], handlers: {} }; break;
      case 'actorList': def = { id, type, x: 0, y: 0, width: 576, height: 624, numVisibleRows: 4 }; break;
      case 'options': def = { id, type, x: 0, y: 0, width: 400, options: [
        { name: '항상 대시', symbol: 'alwaysDash' },
        { name: '커맨드 기억', symbol: 'commandRemember' },
        { name: 'BGM 볼륨', symbol: 'bgmVolume' },
        { name: 'BGS 볼륨', symbol: 'bgsVolume' },
        { name: 'ME 볼륨', symbol: 'meVolume' },
        { name: 'SE 볼륨', symbol: 'seVolume' },
      ] }; break;
      default: return;
    }
    addWidget(sceneId, parentId, def);
    setCustomSceneSelectedWidget(id);
    onClose();
  };

  const types: WidgetType[] = ['panel', 'label', 'image', 'actorFace', 'gauge', 'separator', 'button', 'list', 'actorList', 'options', 'configValue'];
  const typeLabels: Record<WidgetType, string> = {
    panel: '패널', label: '레이블', image: '이미지',
    actorFace: '액터 얼굴', gauge: '게이지', separator: '구분선',
    button: '버튼', list: '리스트', actorList: '파티 멤버 목록',
    options: '옵션(블랙박스)', configValue: '설정값 표시',
  };

  return (
    <div style={{
      position: 'absolute', background: '#2a2a2a', border: '1px solid #555',
      borderRadius: 4, padding: 4, zIndex: 100, minWidth: 120,
    }}>
      {types.map((t) => (
        <div key={t} style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#ddd', borderRadius: 2 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#3a3a3a')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          onClick={() => handleAdd(t)}>
          <span style={{
            fontSize: 9, padding: '1px 3px', borderRadius: 2, marginRight: 6,
            background: WIDGET_TYPE_COLORS[t] || '#555', color: '#fff',
          }}>{WIDGET_TYPE_LABELS[t]}</span>
          {typeLabels[t]}
        </div>
      ))}
    </div>
  );
}

// ── V2: ActionHandlerEditor (핸들러 동작 편집) ────────────

function ActionHandlerEditor({ handler, onChange }: {
  handler: CustomCommandHandler;
  onChange: (updates: Partial<CustomCommandHandler>) => void;
}) {
  const action = handler.action || 'popScene';
  return (
    <div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>동작:</span>
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
          <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>대상:</span>
          <input style={{ ...inputStyle, flex: 1 }}
            placeholder={action === 'focusWidget' ? '위젯 ID' : '씬 이름'}
            value={handler.target || ''}
            onChange={(e) => onChange({ target: e.target.value })} />
        </div>
      )}
      {(action === 'selectActor' || action === 'formation') && (
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>actorList ID:</span>
          <input style={{ ...inputStyle, flex: 1 }}
            placeholder="actor_list"
            value={handler.widget || ''}
            onChange={(e) => onChange({ widget: e.target.value })} />
        </div>
      )}
      {action === 'selectActor' && (
        <div>
          <label style={{ ...labelStyle, marginTop: 4 }}>액터 선택 후 이동할 씬</label>
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>씬:</span>
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
            <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>configKey:</span>
            <input style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11 }}
              placeholder="alwaysDash / bgmVolume …"
              value={handler.configKey || ''}
              onChange={(e) => onChange({ configKey: e.target.value })} />
          </div>
          {(action === 'incrementConfig' || action === 'decrementConfig') && (
            <div style={rowStyle}>
              <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>step:</span>
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
          <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>이벤트 ID:</span>
          <input style={{ ...inputStyle, width: 60 }} type="number"
            value={handler.eventId || ''}
            onChange={(e) => onChange({ eventId: parseInt(e.target.value) || 0 })} />
        </div>
      )}
      {action === 'script' && (
        <textarea
          style={{ ...inputStyle, height: 60, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
          placeholder="// JS 코드"
          value={handler.code || ''}
          onChange={(e) => onChange({ code: e.target.value })}
        />
      )}
    </div>
  );
}

// ── V2: OptionsWidgetInspector ─────────────────────────────

function OptionsWidgetInspector({ widget, update }: {
  widget: WidgetDef_Options; update: (u: Partial<WidgetDef>) => void;
}) {
  const opts = widget.options || [];

  const updateOpt = (i: number, field: keyof OptionItemDef, value: string) => {
    const next = opts.map((o, idx) => idx === i ? { ...o, [field]: value } : o);
    update({ options: next } as any);
  };

  const addOpt = () => {
    update({ options: [...opts, { name: '항목', symbol: 'newOption' }] } as any);
  };

  const removeOpt = (i: number) => {
    update({ options: opts.filter((_, idx) => idx !== i) } as any);
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
        옵션 항목 (ConfigManager 키와 일치해야 함)<br />
        <span style={{ color: '#666' }}>bool 키: ON/OFF 토글, 숫자 키: 볼륨(0~100)</span>
      </div>
      {opts.map((opt, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <input
            style={{ ...inputStyle, flex: 2 }}
            placeholder="표시 이름"
            value={opt.name}
            onChange={(e) => updateOpt(i, 'name', e.target.value)}
          />
          <input
            style={{ ...inputStyle, flex: 3, fontFamily: 'monospace', fontSize: 11 }}
            placeholder="symbol (예: bgmVolume)"
            value={opt.symbol}
            onChange={(e) => updateOpt(i, 'symbol', e.target.value)}
          />
          <button style={deleteBtnStyle} onClick={() => removeOpt(i)}>×</button>
        </div>
      ))}
      <button
        className="ui-canvas-toolbar-btn"
        style={{ fontSize: 11, marginTop: 2 }}
        onClick={addOpt}
      >
        + 항목 추가
      </button>
    </div>
  );
}

// ── V2: ButtonWidgetInspector ──────────────────────────────

function ButtonWidgetInspector({ sceneId, widget, update }: {
  sceneId: string; widget: WidgetDef_Button; update: (u: Partial<WidgetDef>) => void;
}) {
  const currentAction = widget.action || { action: 'popScene' as CommandActionType };
  const hasChildren = !!(widget.children && widget.children.length > 0);
  return (
    <div>
      {!hasChildren && (
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 50 }}>레이블</span>
          <input style={{ ...inputStyle, flex: 1 }}
            value={widget.label}
            onChange={(e) => update({ label: e.target.value } as any)} />
        </div>
      )}
      {hasChildren && (
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
          자식 위젯이 있어 레이블 불사용 (커서 행 모드)
        </div>
      )}
      <label style={{ ...labelStyle, marginTop: 6 }}>OK 동작</label>
      <ActionHandlerEditor handler={currentAction}
        onChange={(updates) => update({ action: { ...currentAction, ...updates } } as any)} />
      <label style={{ ...labelStyle, marginTop: 6 }}>◀ 동작 (좌 키, 볼륨 감소 등)</label>
      <ActionHandlerEditor handler={widget.leftAction || { action: 'popScene' as CommandActionType }}
        onChange={(updates) => update({ leftAction: { ...(widget.leftAction || { action: 'popScene' as CommandActionType }), ...updates } } as any)} />
      {widget.leftAction && (
        <button className="ui-canvas-toolbar-btn" style={{ fontSize: 11, color: '#f88', marginTop: 2 }}
          onClick={() => update({ leftAction: undefined } as any)}>
          ◀ 동작 제거
        </button>
      )}
      <label style={{ ...labelStyle, marginTop: 6 }}>▶ 동작 (우 키, 볼륨 증가 등)</label>
      <ActionHandlerEditor handler={widget.rightAction || { action: 'popScene' as CommandActionType }}
        onChange={(updates) => update({ rightAction: { ...(widget.rightAction || { action: 'popScene' as CommandActionType }), ...updates } } as any)} />
      {widget.rightAction && (
        <button className="ui-canvas-toolbar-btn" style={{ fontSize: 11, color: '#f88', marginTop: 2 }}
          onClick={() => update({ rightAction: undefined } as any)}>
          ▶ 동작 제거
        </button>
      )}
    </div>
  );
}

// ── V2: ConfigValueWidgetInspector ─────────────────────────

function ConfigValueWidgetInspector({ widget, update }: {
  widget: WidgetDef_ConfigValue; update: (u: Partial<WidgetDef>) => void;
}) {
  return (
    <div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 70 }}>configKey</span>
        <input style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11 }}
          placeholder="alwaysDash / bgmVolume …"
          value={widget.configKey}
          onChange={(e) => update({ configKey: e.target.value } as any)} />
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 70 }}>타입</span>
        <select style={{ ...selectStyle, flex: 1 }}
          value={widget.configType || 'auto'}
          onChange={(e) => update({ configType: e.target.value as any } as any)}>
          <option value="auto">자동 감지</option>
          <option value="bool">bool (ON/OFF)</option>
          <option value="volume">volume (NNN%)</option>
        </select>
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 11, color: '#888', width: 70 }}>정렬</span>
        <select style={{ ...selectStyle, flex: 1 }}
          value={widget.align || 'right'}
          onChange={(e) => update({ align: e.target.value as any } as any)}>
          <option value="left">왼쪽</option>
          <option value="center">가운데</option>
          <option value="right">오른쪽</option>
        </select>
      </div>
    </div>
  );
}

// ── V2: ListWidgetInspector ────────────────────────────────

function ListWidgetInspector({ sceneId, widget, update }: {
  sceneId: string; widget: WidgetDef_List; update: (u: Partial<WidgetDef>) => void;
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
    </div>
  );
}

// ── V2: WidgetInspector (타입별 속성 편집) ───────────────

const SCENE_W = 816, SCENE_H = 624;

function WidgetInspector({ sceneId, widget }: { sceneId: string; widget: WidgetDef }) {
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const moveWidgetWithChildren = useEditorStore((s) => s.moveWidgetWithChildren);
  const update = (updates: Partial<WidgetDef>) => updateWidget(sceneId, widget.id, updates);

  const w = widget.width;
  const h = widget.height ?? 0;
  const alignButtons = [
    { label: '가로 중앙', action: () => moveWidgetWithChildren(sceneId, widget.id, Math.round((SCENE_W - w) / 2), widget.y) },
    { label: '세로 중앙', action: () => moveWidgetWithChildren(sceneId, widget.id, widget.x, Math.round((SCENE_H - h) / 2)) },
    { label: '정중앙',    action: () => moveWidgetWithChildren(sceneId, widget.id, Math.round((SCENE_W - w) / 2), Math.round((SCENE_H - h) / 2)) },
  ];

  return (
    <div>
      {/* 공통 속성 */}
      <div style={sectionStyle}>
        <label style={labelStyle}>공통 속성</label>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 50 }}>ID</span>
          <input style={{ ...inputStyle, flex: 1 }} value={widget.id}
            onChange={(e) => update({ id: e.target.value } as any)} />
        </div>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 50 }}>X</span>
          <input style={{ ...inputStyle, width: 60 }} type="number" value={widget.x}
            onChange={(e) => update({ x: parseInt(e.target.value) || 0 } as any)} />
          <span style={{ fontSize: 11, color: '#888', width: 20 }}>Y</span>
          <input style={{ ...inputStyle, width: 60 }} type="number" value={widget.y}
            onChange={(e) => update({ y: parseInt(e.target.value) || 0 } as any)} />
        </div>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 50 }}>W</span>
          <input style={{ ...inputStyle, width: 60 }} type="number" value={widget.width}
            onChange={(e) => update({ width: parseInt(e.target.value) || 0 } as any)} />
          <span style={{ fontSize: 11, color: '#888', width: 20 }}>H</span>
          <input style={{ ...inputStyle, width: 60 }} type="number" value={widget.height ?? ''}
            placeholder="auto"
            onChange={(e) => {
              const v = e.target.value.trim();
              update({ height: v === '' ? undefined : (parseInt(v) || 0) } as any);
            }} />
        </div>
        <div style={{ ...rowStyle, flexWrap: 'wrap', gap: 4 }}>
          {alignButtons.map(({ label, action }) => (
            <button key={label} style={smallBtnStyle} onClick={action}>{label}</button>
          ))}
        </div>
        <div style={rowStyle}>
          <label style={{ fontSize: 11, color: '#aaa' }}>
            <input type="checkbox" checked={widget.visible !== false}
              onChange={(e) => update({ visible: e.target.checked } as any)} /> 표시
          </label>
        </div>
      </div>

      {/* 타입별 속성 */}
      <div style={sectionStyle}>
        <label style={labelStyle}>타입 속성 ({widget.type})</label>
        {widget.type === 'panel' && (
          <div>
            <div style={rowStyle}>
              <label style={{ fontSize: 11, color: '#aaa' }}>
                <input type="checkbox" checked={(widget as WidgetDef_Panel).windowed !== false}
                  onChange={(e) => update({ windowed: e.target.checked } as any)} /> 창 배경
              </label>
            </div>
            <div style={rowStyle}>
              <span style={{ fontSize: 11, color: '#888', width: 70 }}>패딩</span>
              <input style={{ ...inputStyle, width: 60 }} type="number"
                value={(widget as WidgetDef_Panel).padding ?? ''}
                placeholder="기본"
                onChange={(e) => {
                  const v = e.target.value.trim();
                  update({ padding: v === '' ? undefined : (parseInt(v) || 0) } as any);
                }} />
            </div>
          </div>
        )}
        {widget.type === 'label' && (
          <div>
            <div style={rowStyle}>
              <span style={{ fontSize: 11, color: '#888', width: 50 }}>텍스트</span>
            </div>
            <textarea
              style={{ ...inputStyle, height: 60, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
              value={(widget as WidgetDef_Label).text}
              placeholder="{actor[0].name}, {gold}, {var:1} 사용 가능"
              onChange={(e) => update({ text: e.target.value } as any)}
            />
            <div style={rowStyle}>
              <span style={{ fontSize: 11, color: '#888', width: 50 }}>정렬</span>
              <select style={{ ...selectStyle, flex: 1 }}
                value={(widget as WidgetDef_Label).align || 'left'}
                onChange={(e) => update({ align: e.target.value as any } as any)}>
                <option value="left">왼쪽</option>
                <option value="center">가운데</option>
                <option value="right">오른쪽</option>
              </select>
            </div>
          </div>
        )}
        {widget.type === 'actorFace' && (
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 70 }}>액터 인덱스</span>
            <input style={{ ...inputStyle, width: 60 }} type="number"
              value={(widget as WidgetDef_ActorFace).actorIndex}
              onChange={(e) => update({ actorIndex: parseInt(e.target.value) || 0 } as any)} />
          </div>
        )}
        {widget.type === 'gauge' && (
          <div>
            <div style={rowStyle}>
              <span style={{ fontSize: 11, color: '#888', width: 70 }}>게이지 타입</span>
              <select style={{ ...selectStyle, flex: 1 }}
                value={(widget as WidgetDef_Gauge).gaugeType}
                onChange={(e) => update({ gaugeType: e.target.value as any } as any)}>
                <option value="hp">HP</option>
                <option value="mp">MP</option>
                <option value="tp">TP</option>
              </select>
            </div>
            <div style={rowStyle}>
              <span style={{ fontSize: 11, color: '#888', width: 70 }}>액터 인덱스</span>
              <input style={{ ...inputStyle, width: 60 }} type="number"
                value={(widget as WidgetDef_Gauge).actorIndex}
                onChange={(e) => update({ actorIndex: parseInt(e.target.value) || 0 } as any)} />
            </div>
          </div>
        )}
        {widget.type === 'image' && (
          <div>
            <div style={rowStyle}>
              <span style={{ fontSize: 11, color: '#888', width: 70 }}>이미지</span>
              <input style={{ ...inputStyle, flex: 1 }}
                value={(widget as WidgetDef_Image).imageName}
                onChange={(e) => update({ imageName: e.target.value } as any)} />
            </div>
            <div style={rowStyle}>
              <span style={{ fontSize: 11, color: '#888', width: 70 }}>폴더</span>
              <input style={{ ...inputStyle, flex: 1 }}
                value={(widget as WidgetDef_Image).imageFolder || 'img/system/'}
                onChange={(e) => update({ imageFolder: e.target.value } as any)} />
            </div>
          </div>
        )}
        {widget.type === 'button' && <ButtonWidgetInspector sceneId={sceneId} widget={widget as WidgetDef_Button} update={update} />}
        {widget.type === 'list' && <ListWidgetInspector sceneId={sceneId} widget={widget as WidgetDef_List} update={update} />}
        {widget.type === 'actorList' && (
          <div style={rowStyle}>
            <span style={{ fontSize: 11, color: '#888', width: 80 }}>표시 행 수</span>
            <input style={{ ...inputStyle, width: 60 }} type="number"
              value={(widget as WidgetDef_ActorList).numVisibleRows ?? 4}
              onChange={(e) => update({ numVisibleRows: parseInt(e.target.value) || 4 } as any)} />
          </div>
        )}
        {widget.type === 'options' && <OptionsWidgetInspector widget={widget as WidgetDef_Options} update={update} />}
        {widget.type === 'configValue' && <ConfigValueWidgetInspector widget={widget as WidgetDef_ConfigValue} update={update} />}
      </div>
    </div>
  );
}

// ── V2: V2ScenePanel (위젯 트리 메인 패널) ──────────────

function V2ScenePanel({ sceneId, scene }: { sceneId: string; scene: CustomSceneDefV2 }) {
  const selectedId = useEditorStore((s) => s.customSceneSelectedWidget);
  const setSelectedId = useEditorStore((s) => s.setCustomSceneSelectedWidget);
  const removeWidget = useEditorStore((s) => s.removeWidget);
  const updateCustomScene = useEditorStore((s) => s.updateCustomScene);
  const removeCustomScene = useEditorStore((s) => s.removeCustomScene);
  const saveCustomScenes = useEditorStore((s) => s.saveCustomScenes);
  const setUiEditorScene = useEditorStore((s) => s.setUiEditorScene);
  const [addMenuParent, setAddMenuParent] = React.useState<string | null>(null);
  const [addMenuBtnRect, setAddMenuBtnRect] = React.useState<DOMRect | null>(null);
  const addBtnRef = React.useRef<HTMLButtonElement>(null);

  const selectedWidget = React.useMemo(() => {
    if (!selectedId || !scene.root) return null;
    function find(w: WidgetDef): WidgetDef | null {
      if (w.id === selectedId) return w;
      if (w.type === 'panel') {
        for (const c of (w as WidgetDef_Panel).children || []) {
          const found = find(c);
          if (found) return found;
        }
      }
      return null;
    }
    return find(scene.root);
  }, [selectedId, scene.root]);

  const handleDeleteScene = async () => {
    if (!confirm(`씬 "${scene.displayName}"을 삭제하시겠습니까?`)) return;
    removeCustomScene(sceneId);
    await saveCustomScenes();
    setUiEditorScene('Scene_Menu');
  };

  const addableParentId = selectedId && scene.root
    ? (() => {
        function find(w: WidgetDef): WidgetDef | null {
          if (w.id === selectedId) return w;
          if (w.type === 'panel') {
            for (const c of (w as WidgetDef_Panel).children || []) {
              const found = find(c);
              if (found) return found;
            }
          }
          return null;
        }
        const sel = find(scene.root!);
        return sel?.type === 'panel' ? selectedId : (scene.root?.id || 'root');
      })()
    : (scene.root?.id || 'root');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* 씬 속성 */}
      <div style={sectionStyle}>
        <label style={labelStyle}>씬 속성</label>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 50 }}>ID</span>
          <span style={{ fontSize: 12, color: '#ddd', flex: 1, fontFamily: 'monospace' }}>Scene_CS_{scene.id}</span>
          <button
            style={{ ...smallBtnStyle, padding: '2px 6px' }}
            title="클립보드에 복사"
            onClick={() => navigator.clipboard.writeText(`Scene_CS_${scene.id}`)}
          >복사</button>
        </div>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 50 }}>이름</span>
          <input style={{ ...inputStyle, flex: 1 }} value={scene.displayName}
            onChange={(e) => updateCustomScene(sceneId, { displayName: e.target.value })} />
        </div>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 50 }}>기반</span>
          <select style={{ ...selectStyle, flex: 1 }} value={scene.baseScene}
            onChange={(e) => updateCustomScene(sceneId, { baseScene: e.target.value as 'Base' | 'MenuBase' })}>
            <option value="MenuBase">MenuBase</option>
            <option value="Base">Base</option>
          </select>
        </div>
        <button style={{ ...deleteBtnStyle, width: '100%', marginTop: 4 }} onClick={handleDeleteScene}>
          씬 삭제
        </button>
      </div>

      {/* 네비게이션 설정 */}
      <NavigationConfigSection sceneId={sceneId} nav={scene.navigation || {}} />

      {/* 위젯 계층 */}
      <div style={{ ...sectionStyle, flex: '0 0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ ...labelStyle, marginBottom: 0, flex: 1 }}>위젯 계층</label>
          <div>
            <button
              ref={addBtnRef}
              style={{ ...smallBtnStyle, background: '#2675bf' }}
              onClick={() => {
                if (addMenuParent) {
                  setAddMenuParent(null);
                  setAddMenuBtnRect(null);
                } else {
                  const rect = addBtnRef.current?.getBoundingClientRect() ?? null;
                  setAddMenuBtnRect(rect);
                  setAddMenuParent(addableParentId);
                }
              }}
            >
              + 위젯
            </button>
          </div>
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto', background: '#222', borderRadius: 3, padding: 4 }}>
          {scene.root ? (
            <WidgetTreeNode
              widget={scene.root} depth={0} sceneId={sceneId}
              selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setAddMenuParent(null); }}
              onRemove={(id) => removeWidget(sceneId, id)}
            />
          ) : (
            <div style={{ padding: 8, color: '#888', fontSize: 12 }}>위젯 없음</div>
          )}
        </div>
      </div>

      {/* 위젯 인스펙터 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {selectedWidget ? (
          <WidgetInspector sceneId={sceneId} widget={selectedWidget} />
        ) : (
          <div style={{ padding: 12, color: '#888', fontSize: 12 }}>위젯을 선택하세요</div>
        )}
      </div>

      {/* +위젯 팝업 (portal) */}
      {addMenuParent && addMenuBtnRect && ReactDOM.createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
            onClick={() => { setAddMenuParent(null); setAddMenuBtnRect(null); }}
          />
          <div
            style={{ position: 'fixed', left: addMenuBtnRect.left, top: addMenuBtnRect.bottom + 2, zIndex: 10000 }}
            onClick={(e) => e.stopPropagation()}
          >
            <AddWidgetMenu
              sceneId={sceneId}
              parentId={addMenuParent}
              onClose={() => { setAddMenuParent(null); setAddMenuBtnRect(null); }}
            />
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ── LegacyScenePanel (기존 windows[] 기반 UI) ───────────

function LegacyScenePanel({ sceneId, onConvert }: { sceneId: string; onConvert: () => void }) {
  const customScenes = useEditorStore((s) => s.customScenes);
  const updateCustomScene = useEditorStore((s) => s.updateCustomScene);
  const removeCustomScene = useEditorStore((s) => s.removeCustomScene);
  const addCustomWindow = useEditorStore((s) => s.addCustomWindow);
  const removeCustomWindow = useEditorStore((s) => s.removeCustomWindow);
  const saveCustomScenes = useEditorStore((s) => s.saveCustomScenes);
  const setUiEditorScene = useEditorStore((s) => s.setUiEditorScene);

  const [selectedWinId, setSelectedWinId] = useState<string | null>(null);

  const scene = customScenes.scenes[sceneId];
  if (!scene) return <div style={{ padding: 12, color: '#888' }}>씬을 찾을 수 없습니다</div>;

  const selectedWin = scene.windows.find((w) => w.id === selectedWinId) || null;

  const handleAddWindow = (type: 'command' | 'display') => {
    const id = `win_${Date.now()}`;
    const def: CustomWindowDef = {
      id,
      displayName: type === 'command' ? '커맨드' : '표시',
      windowType: type,
      x: 0, y: 0, width: 300, height: type === 'command' ? null : 200,
      ...(type === 'command' ? { commands: [], handlers: {}, maxCols: 1 } : { elements: [] }),
    };
    addCustomWindow(sceneId, def);
    setSelectedWinId(id);
  };

  const handleDeleteScene = async () => {
    if (!confirm(`씬 "${scene.displayName}"을 삭제하시겠습니까?`)) return;
    removeCustomScene(sceneId);
    await saveCustomScenes();
    setUiEditorScene('Scene_Menu');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 씬 속성 */}
      <div style={sectionStyle}>
        <label style={labelStyle}>커스텀 씬 속성</label>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 60 }}>ID</span>
          <span style={{ fontSize: 12, color: '#ddd' }}>Scene_CS_{scene.id}</span>
        </div>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 60 }}>이름</span>
          <input style={{ ...inputStyle, flex: 1 }} value={scene.displayName}
            onChange={(e) => updateCustomScene(sceneId, { displayName: e.target.value })} />
        </div>
        <div style={rowStyle}>
          <span style={{ fontSize: 11, color: '#888', width: 60 }}>기반</span>
          <select style={{ ...selectStyle, flex: 1 }} value={scene.baseScene}
            onChange={(e) => updateCustomScene(sceneId, { baseScene: e.target.value as 'Base' | 'MenuBase' })}>
            <option value="MenuBase">MenuBase</option>
            <option value="Base">Base</option>
          </select>
        </div>
        <button style={{ ...deleteBtnStyle, width: '100%', marginTop: 4 }} onClick={handleDeleteScene}>
          씬 삭제
        </button>
        <button style={{ ...smallBtnStyle, width: '100%', marginTop: 4, background: '#665500' }}
          onClick={onConvert}>
          위젯 트리 포맷으로 변환 (v2)
        </button>
      </div>

      {/* Window 목록 */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Window 목록</label>
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {scene.windows.map((win) => (
            <div
              key={win.id}
              style={{
                padding: '5px 8px', cursor: 'pointer', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 6,
                background: selectedWinId === win.id ? '#2675bf33' : 'transparent',
                borderRadius: 2,
              }}
              onClick={() => setSelectedWinId(selectedWinId === win.id ? null : win.id)}
            >
              <span style={{
                fontSize: 10, padding: '1px 4px', borderRadius: 2,
                background: win.windowType === 'command' ? '#2675bf' : '#2a7a3a',
                color: '#fff',
              }}>
                {win.windowType === 'command' ? 'CMD' : 'DSP'}
              </span>
              <span style={{ flex: 1, color: '#ddd' }}>{win.displayName}</span>
              <button style={{ ...deleteBtnStyle, fontSize: 10 }}
                onClick={(e) => { e.stopPropagation(); removeCustomWindow(sceneId, win.id); }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <button style={{ ...smallBtnStyle, flex: 1, background: '#2675bf' }} onClick={() => handleAddWindow('command')}>+ 커맨드 Window</button>
          <button style={{ ...smallBtnStyle, flex: 1, background: '#2a7a3a' }} onClick={() => handleAddWindow('display')}>+ 표시 Window</button>
        </div>
      </div>

      {/* Window 상세 편집 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {selectedWin ? (
          <WindowDetail sceneId={sceneId} win={selectedWin} />
        ) : (
          <div style={{ padding: 12, color: '#888', fontSize: 12 }}>Window를 선택하세요</div>
        )}
      </div>
    </div>
  );
}

// ── 메인 export ──────────────────────────────────────────

export default function UIEditorCustomScenePanel({ sceneId }: { sceneId: string }) {
  const customScenes = useEditorStore((s) => s.customScenes);
  const updateSceneRoot = useEditorStore((s) => s.updateSceneRoot);
  const updateNavigation = useEditorStore((s) => s.updateNavigation);
  const saveCustomScenes = useEditorStore((s) => s.saveCustomScenes);

  const scene = customScenes.scenes[sceneId] as CustomSceneDefV2 | undefined;
  if (!scene) return <div style={{ padding: 12, color: '#888' }}>씬을 찾을 수 없습니다</div>;

  if (isV2Scene(scene)) {
    return <V2ScenePanel sceneId={sceneId} scene={scene} />;
  }

  return (
    <LegacyScenePanel sceneId={sceneId} onConvert={() => {
      const v2Data = convertLegacyToV2(scene as CustomSceneDef);
      updateSceneRoot(sceneId, v2Data.root!);
      if (v2Data.navigation) {
        updateNavigation(sceneId, v2Data.navigation);
      }
      saveCustomScenes();
    }} />
  );
}
