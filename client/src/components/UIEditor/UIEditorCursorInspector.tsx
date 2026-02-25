import React, { useCallback } from 'react';
import apiClient from '../../api/client';
import useEditorStore from '../../store/useEditorStore';
import DragLabel from '../common/DragLabel';
import './UIEditor.css';

export default function UIEditorCursorInspector() {
  const projectPath = useEditorStore((s) => s.projectPath);
  const uiSelectedSkin = useEditorStore((s) => s.uiSelectedSkin);
  const triggerSkinsReload = useEditorStore((s) => s.triggerSkinsReload);
  const uiSkinCursorX = useEditorStore((s) => s.uiSkinCursorX);
  const uiSkinCursorY = useEditorStore((s) => s.uiSkinCursorY);
  const uiSkinCursorW = useEditorStore((s) => s.uiSkinCursorW);
  const uiSkinCursorH = useEditorStore((s) => s.uiSkinCursorH);
  const uiSkinCursorCornerSize = useEditorStore((s) => s.uiSkinCursorCornerSize);
  const uiSkinCursorRenderMode = useEditorStore((s) => s.uiSkinCursorRenderMode);
  const uiSkinCursorBlendMode = useEditorStore((s) => s.uiSkinCursorBlendMode);
  const uiSkinCursorOpacity = useEditorStore((s) => s.uiSkinCursorOpacity);
  const uiSkinCursorBlink = useEditorStore((s) => s.uiSkinCursorBlink);
  const uiSkinCursorPadding = useEditorStore((s) => s.uiSkinCursorPadding);
  const uiSkinCursorToneR = useEditorStore((s) => s.uiSkinCursorToneR);
  const uiSkinCursorToneG = useEditorStore((s) => s.uiSkinCursorToneG);
  const uiSkinCursorToneB = useEditorStore((s) => s.uiSkinCursorToneB);
  const setUiSkinCursor = useEditorStore((s) => s.setUiSkinCursor);
  const setUiSkinCursorCornerSize = useEditorStore((s) => s.setUiSkinCursorCornerSize);
  const setUiSkinCursorRenderMode = useEditorStore((s) => s.setUiSkinCursorRenderMode);
  const setUiSkinCursorBlendMode = useEditorStore((s) => s.setUiSkinCursorBlendMode);
  const setUiSkinCursorOpacity = useEditorStore((s) => s.setUiSkinCursorOpacity);
  const setUiSkinCursorBlink = useEditorStore((s) => s.setUiSkinCursorBlink);
  const setUiSkinCursorPadding = useEditorStore((s) => s.setUiSkinCursorPadding);
  const setUiSkinCursorTone = useEditorStore((s) => s.setUiSkinCursorTone);

  const saveSkin = useCallback(async (fields: Record<string, number | boolean | string | undefined>) => {
    if (!projectPath || !uiSelectedSkin) return;
    await fetch(`/api/ui-editor/skins/${encodeURIComponent(uiSelectedSkin)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  }, [projectPath, uiSelectedSkin]);

  const handleResetDefaults = async () => {
    const s = useEditorStore.getState();
    s.setUiSkinCursor(96, 96, 48, 48);
    s.setUiSkinCursorCornerSize(4);
    s.setUiSkinCursorRenderMode('nineSlice');
    s.setUiSkinCursorBlendMode('normal');
    s.setUiSkinCursorOpacity(192);
    s.setUiSkinCursorBlink(true);
    s.setUiSkinCursorPadding(2);
    s.setUiSkinCursorTone(0, 0, 0);
    await saveSkin({
      cursorX: 96, cursorY: 96, cursorW: 48, cursorH: 48,
      cursorCornerSize: 4, cursorRenderMode: 'nineSlice',
      cursorBlendMode: 'normal', cursorOpacity: 192,
      cursorBlink: true, cursorPadding: 2,
      cursorToneR: 0, cursorToneG: 0, cursorToneB: 0,
    });
    s.showToast('RPG Maker MV 커서 기본값으로 설정됨');
  };

  const handleSetDefault = async () => {
    if (!projectPath || !uiSelectedSkin) return;
    try {
      await apiClient.put('/ui-editor/skins/default', { defaultCursorSkin: uiSelectedSkin });
      triggerSkinsReload();
      useEditorStore.getState().showToast(`커서 기본 스킨: ${uiSelectedSkin} 설정됨`);
    } catch {
      useEditorStore.getState().showToast('설정 실패', true);
    }
  };

  return (
    <div className="ui-editor-inspector">
      <div className="ui-editor-inspector-header">커서 인스펙터</div>
      <div className="ui-editor-inspector-body">

        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">커서 영역</div>
          <div className="ui-inspector-row">
            <DragLabel label="X" value={uiSkinCursorX} min={0} onChange={(v) => { setUiSkinCursor(Math.round(v), uiSkinCursorY, uiSkinCursorW, uiSkinCursorH); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="Y" value={uiSkinCursorY} min={0} onChange={(v) => { setUiSkinCursor(uiSkinCursorX, Math.round(v), uiSkinCursorW, uiSkinCursorH); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="너비" value={uiSkinCursorW} min={4} onChange={(v) => { setUiSkinCursor(uiSkinCursorX, uiSkinCursorY, Math.round(v), uiSkinCursorH); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="높이" value={uiSkinCursorH} min={4} onChange={(v) => { setUiSkinCursor(uiSkinCursorX, uiSkinCursorY, uiSkinCursorW, Math.round(v)); }} />
          </div>
          <div style={{ padding: '2px 12px 4px', fontSize: 11, color: '#777' }}>
            캔버스에서 주황 영역 드래그로 이동/리사이즈 가능
          </div>
        </div>

        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">렌더링</div>
          <div className="ui-inspector-row" style={{ flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#888', paddingLeft: 2 }}>렌더링 모드</span>
            <select
              value={uiSkinCursorRenderMode}
              onChange={(e) => setUiSkinCursorRenderMode(e.target.value as 'nineSlice' | 'stretch' | 'tile')}
              style={{ fontSize: 12, padding: '2px 4px', background: '#1a1a2e', color: '#ddd', border: '1px solid #555', borderRadius: 2, width: '100%' }}
            >
              <option value="nineSlice">9-Slice (코너 유지)</option>
              <option value="stretch">Stretch (늘리기)</option>
              <option value="tile">Tile (반복)</option>
            </select>
          </div>
          <div className="ui-inspector-row" style={uiSkinCursorRenderMode !== 'nineSlice' ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <DragLabel
              label="코너 크기"
              value={uiSkinCursorCornerSize}
              min={1}
              onChange={(v) => { setUiSkinCursorCornerSize(Math.round(v)); }}
            />
          </div>
          <div className="ui-inspector-row" style={{ flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#888', paddingLeft: 2 }}>Blend Mode</span>
            <select
              value={uiSkinCursorBlendMode}
              onChange={(e) => setUiSkinCursorBlendMode(e.target.value as 'normal' | 'add' | 'multiply' | 'screen')}
              style={{ fontSize: 12, padding: '2px 4px', background: '#1a1a2e', color: '#ddd', border: '1px solid #555', borderRadius: 2, width: '100%' }}
            >
              <option value="normal">Normal</option>
              <option value="add">Add (발광)</option>
              <option value="multiply">Multiply</option>
              <option value="screen">Screen</option>
            </select>
          </div>
          <div className="ui-inspector-row">
            <DragLabel
              label="불투명도"
              value={uiSkinCursorOpacity}
              min={0}
              max={255}
              onChange={(v) => { setUiSkinCursorOpacity(Math.round(Math.min(255, Math.max(0, v)))); }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 12px 4px', fontSize: 11, color: '#bbb', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={uiSkinCursorBlink}
              onChange={(e) => setUiSkinCursorBlink(e.target.checked)}
              style={{ accentColor: '#4af', cursor: 'pointer' }}
            />
            깜박임 (Blink)
          </label>
          <div className="ui-inspector-row">
            <DragLabel
              label="패딩"
              value={uiSkinCursorPadding}
              min={-20}
              onChange={(v) => { setUiSkinCursorPadding(Math.round(v)); }}
            />
          </div>
        </div>

        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">색조 (Tone)</div>
          <div className="ui-inspector-row">
            <div style={{ display: 'flex', gap: 4, width: '100%' }}>
              <DragLabel label="R" value={uiSkinCursorToneR} min={-255} max={255}
                onChange={(v) => setUiSkinCursorTone(Math.round(Math.min(255, Math.max(-255, v))), uiSkinCursorToneG, uiSkinCursorToneB)}
              />
              <DragLabel label="G" value={uiSkinCursorToneG} min={-255} max={255}
                onChange={(v) => setUiSkinCursorTone(uiSkinCursorToneR, Math.round(Math.min(255, Math.max(-255, v))), uiSkinCursorToneB)}
              />
              <DragLabel label="B" value={uiSkinCursorToneB} min={-255} max={255}
                onChange={(v) => setUiSkinCursorTone(uiSkinCursorToneR, uiSkinCursorToneG, Math.round(Math.min(255, Math.max(-255, v))))}
              />
            </div>
          </div>
        </div>

      </div>

        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">기본값</div>
          <div className="ui-inspector-row">
            <button
              className="ui-canvas-toolbar-btn"
              style={{ flex: 1, fontSize: 11 }}
              disabled={!projectPath || !uiSelectedSkin}
              onClick={handleResetDefaults}
            >
              RPG Maker MV 기본값으로 설정
            </button>
          </div>
          <div className="ui-inspector-row">
            <button
              className="ui-canvas-toolbar-btn"
              style={{ flex: 1 }}
              disabled={!projectPath || !uiSelectedSkin}
              onClick={handleSetDefault}
            >
              기본 스킨으로 설정
            </button>
          </div>
          <div style={{ padding: '2px 12px 6px', fontSize: 11, color: '#777' }}>
            UIEditorSkins.json에 defaultCursorSkin 저장
          </div>
        </div>

    </div>
  );
}
