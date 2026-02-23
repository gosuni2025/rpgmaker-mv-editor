import React, { useCallback, useEffect, useRef, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import DragLabel from '../common/DragLabel';
import './UIEditor.css';

export default function UIEditorFrameInspector() {
  const uiSelectedSkin = useEditorStore((s) => s.uiSelectedSkin);
  const uiSelectedSkinFile = useEditorStore((s) => s.uiSelectedSkinFile);
  const uiSkinsReloadToken = useEditorStore((s) => s.uiSkinsReloadToken);
  const triggerSkinsReload = useEditorStore((s) => s.triggerSkinsReload);

  // 라벨 편집 상태
  const [skinLabel, setSkinLabel] = useState('');
  const [editingLabel, setEditingLabel] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const uiSkinCornerSize = useEditorStore((s) => s.uiSkinCornerSize);
  const uiSkinFrameX = useEditorStore((s) => s.uiSkinFrameX);
  const uiSkinFrameY = useEditorStore((s) => s.uiSkinFrameY);
  const uiSkinFrameW = useEditorStore((s) => s.uiSkinFrameW);
  const uiSkinFrameH = useEditorStore((s) => s.uiSkinFrameH);
  const uiSkinFillX = useEditorStore((s) => s.uiSkinFillX);
  const uiSkinFillY = useEditorStore((s) => s.uiSkinFillY);
  const uiSkinFillW = useEditorStore((s) => s.uiSkinFillW);
  const uiSkinFillH = useEditorStore((s) => s.uiSkinFillH);
  const uiSkinUseCenterFill = useEditorStore((s) => s.uiSkinUseCenterFill);
  const uiSkinCursorX = useEditorStore((s) => s.uiSkinCursorX);
  const uiSkinCursorY = useEditorStore((s) => s.uiSkinCursorY);
  const uiSkinCursorW = useEditorStore((s) => s.uiSkinCursorW);
  const uiSkinCursorH = useEditorStore((s) => s.uiSkinCursorH);
  const uiSkinCursorCornerSize = useEditorStore((s) => s.uiSkinCursorCornerSize);
  const uiSkinCursorRenderMode = useEditorStore((s) => s.uiSkinCursorRenderMode);
  const uiSkinCursorBlendMode = useEditorStore((s) => s.uiSkinCursorBlendMode);
  const uiSkinCursorOpacity = useEditorStore((s) => s.uiSkinCursorOpacity);
  const uiSkinCursorBlink = useEditorStore((s) => s.uiSkinCursorBlink);
  const uiEditorDirty = useEditorStore((s) => s.uiEditorDirty);
  const setUiSkinCornerSize = useEditorStore((s) => s.setUiSkinCornerSize);
  const setUiSkinFrame = useEditorStore((s) => s.setUiSkinFrame);
  const setUiSkinFill = useEditorStore((s) => s.setUiSkinFill);
  const setUiSkinUseCenterFill = useEditorStore((s) => s.setUiSkinUseCenterFill);
  const setUiSkinCursor = useEditorStore((s) => s.setUiSkinCursor);
  const setUiSkinCursorCornerSize = useEditorStore((s) => s.setUiSkinCursorCornerSize);
  const setUiSkinCursorRenderMode = useEditorStore((s) => s.setUiSkinCursorRenderMode);
  const setUiSkinCursorBlendMode = useEditorStore((s) => s.setUiSkinCursorBlendMode);
  const setUiSkinCursorOpacity = useEditorStore((s) => s.setUiSkinCursorOpacity);
  const setUiSkinCursorBlink = useEditorStore((s) => s.setUiSkinCursorBlink);
  const setUiEditorDirty = useEditorStore((s) => s.setUiEditorDirty);
  const projectPath = useEditorStore((s) => s.projectPath);

  const saveSkin = useCallback(async (fields: Record<string, number | boolean | string | undefined>) => {
    if (!projectPath || !uiSelectedSkin) return;
    await fetch(`/api/ui-editor/skins/${encodeURIComponent(uiSelectedSkin)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  }, [projectPath, uiSelectedSkin]);

  // 선택 스킨 변경 시 라벨 로드
  useEffect(() => {
    if (!uiSelectedSkin) { setSkinLabel(''); return; }
    fetch('/api/ui-editor/skins')
      .then((r) => r.json())
      .then((d) => {
        const entry = (d.skins ?? []).find((s: { name: string; label?: string }) => s.name === uiSelectedSkin);
        setSkinLabel(entry?.label ?? '');
      })
      .catch(() => {});
  }, [uiSelectedSkin, uiSkinsReloadToken]);

  useEffect(() => {
    if (editingLabel) setTimeout(() => labelInputRef.current?.focus(), 0);
  }, [editingLabel]);

  const handleLabelSave = async () => {
    setEditingLabel(false);
    const trimmed = skinLabel.trim();
    await saveSkin(trimmed ? { label: trimmed } : { label: '' });
    triggerSkinsReload();
  };

  // 기본 스킨으로 설정 — UIEditorSkins.json의 defaultSkin 저장
  const handleSetDefault = async () => {
    if (!projectPath || !uiSelectedSkin) return;
    try {
      await fetch('/api/ui-editor/skins/default', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultSkin: uiSelectedSkin }),
      });
      await saveSkin({ cornerSize: uiSkinCornerSize });
      triggerSkinsReload();
      useEditorStore.getState().showToast(`기본 스킨: ${uiSelectedSkin} 설정됨`);
    } catch {
      useEditorStore.getState().showToast('설정 실패', true);
    }
  };

  // 스킨 설정 저장 (cornerSize + frame)
  const handleApply = async () => {
    if (!projectPath || !uiSelectedSkin) return;
    try {
      await saveSkin({ cornerSize: uiSkinCornerSize, frameX: uiSkinFrameX, frameY: uiSkinFrameY, frameW: uiSkinFrameW, frameH: uiSkinFrameH, fillX: uiSkinFillX, fillY: uiSkinFillY, fillW: uiSkinFillW, fillH: uiSkinFillH, useCenterFill: uiSkinUseCenterFill, cursorX: uiSkinCursorX, cursorY: uiSkinCursorY, cursorW: uiSkinCursorW, cursorH: uiSkinCursorH, cursorCornerSize: uiSkinCursorCornerSize, cursorRenderMode: uiSkinCursorRenderMode, cursorBlendMode: uiSkinCursorBlendMode, cursorOpacity: uiSkinCursorOpacity, cursorBlink: uiSkinCursorBlink });
      setUiEditorDirty(false);
      useEditorStore.getState().showToast('스킨 설정 저장 완료');
    } catch {
      useEditorStore.getState().showToast('저장 실패', true);
    }
  };

  return (
    <div className="ui-editor-inspector">
      <div className="ui-editor-inspector-header">프레임 인스펙터</div>
      <div className="ui-editor-inspector-body">

        {/* 현재 스킨 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">선택된 스킨</div>

          {/* 표시 이름 (변경 가능) */}
          <div className="ui-inspector-row">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
              <span style={{ fontSize: 11, color: '#888' }}>표시 이름 (변경 가능)</span>
              {editingLabel ? (
                <input
                  ref={labelInputRef}
                  value={skinLabel}
                  onChange={(e) => setSkinLabel(e.target.value)}
                  onBlur={handleLabelSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLabelSave();
                    else if (e.key === 'Escape') { setEditingLabel(false); }
                  }}
                  placeholder="비워두면 ID로 표시"
                  style={{ fontSize: 13, padding: '2px 6px', background: '#1a1a2e', color: '#ddd', border: '1px solid #4af', borderRadius: 2, outline: 'none' }}
                />
              ) : (
                <span
                  style={{ fontSize: 13, color: skinLabel ? '#ddd' : '#666', cursor: 'pointer', padding: '1px 0' }}
                  onClick={() => setEditingLabel(true)}
                  title="클릭하여 편집"
                >
                  {skinLabel || '(없음 — 클릭하여 편집)'}
                </span>
              )}
            </div>
          </div>

          {/* ID (변경 불가) */}
          <div className="ui-inspector-row" style={{ paddingTop: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 11, color: '#888' }}>ID (변경 불가)</span>
              <span style={{ fontSize: 12, color: '#aaa', fontFamily: 'monospace' }}>{uiSelectedSkin || '—'}</span>
            </div>
          </div>

          {/* 파일 경로 */}
          <div className="ui-inspector-row" style={{ paddingTop: 0 }}>
            <div className="ui-inspector-label" style={{ fontSize: 11, color: '#777' }}>
              img/system/{uiSelectedSkinFile || uiSelectedSkin}.png
            </div>
          </div>
        </div>

        {/* 프레임 영역 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">프레임 영역</div>
          <div className="ui-inspector-row">
            <DragLabel label="X" value={uiSkinFrameX} min={0} onChange={(v) => { setUiSkinFrame(Math.round(v), uiSkinFrameY, uiSkinFrameW, uiSkinFrameH); }} onDragEnd={() => { const s = useEditorStore.getState(); saveSkin({ frameX: s.uiSkinFrameX, frameY: s.uiSkinFrameY, frameW: s.uiSkinFrameW, frameH: s.uiSkinFrameH }); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="Y" value={uiSkinFrameY} min={0} onChange={(v) => { setUiSkinFrame(uiSkinFrameX, Math.round(v), uiSkinFrameW, uiSkinFrameH); }} onDragEnd={() => { const s = useEditorStore.getState(); saveSkin({ frameX: s.uiSkinFrameX, frameY: s.uiSkinFrameY, frameW: s.uiSkinFrameW, frameH: s.uiSkinFrameH }); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="너비" value={uiSkinFrameW} min={10} onChange={(v) => { setUiSkinFrame(uiSkinFrameX, uiSkinFrameY, Math.round(v), uiSkinFrameH); }} onDragEnd={() => { const s = useEditorStore.getState(); saveSkin({ frameX: s.uiSkinFrameX, frameY: s.uiSkinFrameY, frameW: s.uiSkinFrameW, frameH: s.uiSkinFrameH }); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="높이" value={uiSkinFrameH} min={10} onChange={(v) => { setUiSkinFrame(uiSkinFrameX, uiSkinFrameY, uiSkinFrameW, Math.round(v)); }} onDragEnd={() => { const s = useEditorStore.getState(); saveSkin({ frameX: s.uiSkinFrameX, frameY: s.uiSkinFrameY, frameW: s.uiSkinFrameW, frameH: s.uiSkinFrameH }); }} />
          </div>
          <div style={{ padding: '2px 12px 4px', fontSize: 11, color: '#777' }}>
            캔버스에서 프레임 영역 드래그로 이동/리사이즈 가능
          </div>
        </div>

        {/* fill 영역 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">Fill 영역 (배경)</div>
          <div className="ui-inspector-row" style={uiSkinUseCenterFill ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <DragLabel label="X" value={uiSkinFillX} min={0} onChange={(v) => { setUiSkinFill(Math.round(v), uiSkinFillY, uiSkinFillW, uiSkinFillH); }} onDragEnd={() => { const s = useEditorStore.getState(); saveSkin({ fillX: s.uiSkinFillX, fillY: s.uiSkinFillY, fillW: s.uiSkinFillW, fillH: s.uiSkinFillH }); }} />
          </div>
          <div className="ui-inspector-row" style={uiSkinUseCenterFill ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <DragLabel label="Y" value={uiSkinFillY} min={0} onChange={(v) => { setUiSkinFill(uiSkinFillX, Math.round(v), uiSkinFillW, uiSkinFillH); }} onDragEnd={() => { const s = useEditorStore.getState(); saveSkin({ fillX: s.uiSkinFillX, fillY: s.uiSkinFillY, fillW: s.uiSkinFillW, fillH: s.uiSkinFillH }); }} />
          </div>
          <div className="ui-inspector-row" style={uiSkinUseCenterFill ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <DragLabel label="너비" value={uiSkinFillW} min={4} onChange={(v) => { setUiSkinFill(uiSkinFillX, uiSkinFillY, Math.round(v), uiSkinFillH); }} onDragEnd={() => { const s = useEditorStore.getState(); saveSkin({ fillX: s.uiSkinFillX, fillY: s.uiSkinFillY, fillW: s.uiSkinFillW, fillH: s.uiSkinFillH }); }} />
          </div>
          <div className="ui-inspector-row" style={uiSkinUseCenterFill ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <DragLabel label="높이" value={uiSkinFillH} min={4} onChange={(v) => { setUiSkinFill(uiSkinFillX, uiSkinFillY, uiSkinFillW, Math.round(v)); }} onDragEnd={() => { const s = useEditorStore.getState(); saveSkin({ fillX: s.uiSkinFillX, fillY: s.uiSkinFillY, fillW: s.uiSkinFillW, fillH: s.uiSkinFillH }); }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px 6px', fontSize: 11, color: '#bbb', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={uiSkinUseCenterFill}
              onChange={(e) => setUiSkinUseCenterFill(e.target.checked)}
              style={{ accentColor: '#4af', cursor: 'pointer' }}
            />
            9Slice 정중앙을 Fill로 사용
          </label>
          {!uiSkinUseCenterFill && (
            <div style={{ padding: '0 12px 4px', fontSize: 11, color: '#777' }}>
              캔버스에서 초록 영역 드래그로 이동/리사이즈 가능
            </div>
          )}
          <div className="ui-inspector-row">
            <button
              className="ui-canvas-toolbar-btn"
              style={{ flex: 1, fontSize: 11 }}
              onClick={async () => {
                setUiSkinFrame(96, 0, 96, 96);
                setUiSkinUseCenterFill(false);
                setUiSkinFill(0, 0, 96, 96);
                setUiSkinCornerSize(24);
                await saveSkin({ frameX: 96, frameY: 0, frameW: 96, frameH: 96, cornerSize: 24, fillX: 0, fillY: 0, fillW: 96, fillH: 96, useCenterFill: false });
                useEditorStore.getState().showToast('RPG Maker MV 기본값으로 설정됨');
              }}
            >
              RPG Maker MV 기본값으로 설정
            </button>
          </div>
        </div>

        {/* 커서 영역 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">커서 영역</div>
          <div className="ui-inspector-row">
            <DragLabel label="X" value={uiSkinCursorX} min={0} onChange={(v) => { setUiSkinCursor(Math.round(v), uiSkinCursorY, uiSkinCursorW, uiSkinCursorH); }} onDragEnd={() => { const s = useEditorStore.getState(); saveSkin({ cursorX: s.uiSkinCursorX, cursorY: s.uiSkinCursorY, cursorW: s.uiSkinCursorW, cursorH: s.uiSkinCursorH }); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="Y" value={uiSkinCursorY} min={0} onChange={(v) => { setUiSkinCursor(uiSkinCursorX, Math.round(v), uiSkinCursorW, uiSkinCursorH); }} onDragEnd={() => { const s = useEditorStore.getState(); saveSkin({ cursorX: s.uiSkinCursorX, cursorY: s.uiSkinCursorY, cursorW: s.uiSkinCursorW, cursorH: s.uiSkinCursorH }); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="너비" value={uiSkinCursorW} min={4} onChange={(v) => { setUiSkinCursor(uiSkinCursorX, uiSkinCursorY, Math.round(v), uiSkinCursorH); }} onDragEnd={() => { const s = useEditorStore.getState(); saveSkin({ cursorX: s.uiSkinCursorX, cursorY: s.uiSkinCursorY, cursorW: s.uiSkinCursorW, cursorH: s.uiSkinCursorH }); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="높이" value={uiSkinCursorH} min={4} onChange={(v) => { setUiSkinCursor(uiSkinCursorX, uiSkinCursorY, uiSkinCursorW, Math.round(v)); }} onDragEnd={() => { const s = useEditorStore.getState(); saveSkin({ cursorX: s.uiSkinCursorX, cursorY: s.uiSkinCursorY, cursorW: s.uiSkinCursorW, cursorH: s.uiSkinCursorH }); }} />
          </div>
          <div className="ui-inspector-row" style={{ flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#888', paddingLeft: 2 }}>렌더링 모드</span>
            <select
              value={uiSkinCursorRenderMode}
              onChange={(e) => {
                const mode = e.target.value as 'nineSlice' | 'stretch' | 'tile';
                setUiSkinCursorRenderMode(mode);
                saveSkin({ cursorRenderMode: mode });
              }}
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
              onDragEnd={() => saveSkin({ cursorCornerSize: useEditorStore.getState().uiSkinCursorCornerSize })}
            />
          </div>
          <div className="ui-inspector-row" style={{ flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#888', paddingLeft: 2 }}>Blend Mode</span>
            <select
              value={uiSkinCursorBlendMode}
              onChange={(e) => {
                const mode = e.target.value as 'normal' | 'add' | 'multiply' | 'screen';
                setUiSkinCursorBlendMode(mode);
                saveSkin({ cursorBlendMode: mode });
              }}
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
              onDragEnd={() => saveSkin({ cursorOpacity: useEditorStore.getState().uiSkinCursorOpacity })}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 12px 4px', fontSize: 11, color: '#bbb', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={uiSkinCursorBlink}
              onChange={(e) => {
                setUiSkinCursorBlink(e.target.checked);
                saveSkin({ cursorBlink: e.target.checked });
              }}
              style={{ accentColor: '#4af', cursor: 'pointer' }}
            />
            깜박임 (Blink)
          </label>
          <div style={{ padding: '2px 12px 4px', fontSize: 11, color: '#777' }}>
            캔버스에서 주황 영역 드래그로 이동/리사이즈 가능
          </div>
        </div>

        {/* 9-slice 파라미터 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">9-Slice 코너</div>
          <div className="ui-inspector-row">
            <DragLabel
              label="코너 크기"
              value={uiSkinCornerSize}
              min={1}
              onChange={(v) => { setUiSkinCornerSize(Math.round(v)); }}
              onDragEnd={() => saveSkin({ cornerSize: useEditorStore.getState().uiSkinCornerSize })}
            />
          </div>
          <div style={{ padding: '2px 12px 6px', fontSize: 11, color: '#777' }}>
            캔버스의 노란 선을 드래그해도 조절 가능
          </div>
        </div>

        {/* 기본 스킨 설정 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">기본 스킨 설정</div>
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
            UIEditorSkins.json에 defaultSkin 저장
          </div>
        </div>

        {/* 적용 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">적용</div>
          <div className="ui-inspector-row">
            <button
              className="ui-inspector-save-btn"
              style={{ flex: 1 }}
              disabled={!projectPath || !uiSelectedSkin}
              onClick={handleApply}
            >
              저장
            </button>
          </div>
          <div style={{ padding: '2px 12px 6px', fontSize: 11, color: '#777' }}>
            스킨 cornerSize를 UIEditorSkins.json에 저장
          </div>
        </div>

      </div>

      <div className="ui-inspector-footer">
        <button
          className="ui-inspector-save-btn"
          disabled={!uiEditorDirty}
          onClick={handleApply}
        >
          {uiEditorDirty ? '적용 *' : '적용됨'}
        </button>
      </div>
    </div>
  );
}
