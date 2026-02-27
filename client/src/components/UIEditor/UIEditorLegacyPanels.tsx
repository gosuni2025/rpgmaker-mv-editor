import React, { useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type {
  CustomCommandDef, CustomCommandHandler, CustomElementDef, CustomWindowDef,
  CommandActionType,
} from '../../store/uiEditorTypes';
import { inputStyle, selectStyle, smallBtnStyle, deleteBtnStyle, sectionStyle, labelStyle, rowStyle } from './UIEditorSceneStyles';

// ── CommandEditor ────────────────────────────────────────────

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

// ── ElementEditor ────────────────────────────────────────────

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

// ── WindowDetail ──────────────────────────────────────────────

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

// ── LegacyScenePanel ──────────────────────────────────────────

export function LegacyScenePanel({ sceneId, onConvert }: { sceneId: string; onConvert: () => void }) {
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
