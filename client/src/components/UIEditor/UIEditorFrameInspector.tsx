import React, { useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import DragLabel from '../common/DragLabel';
import './UIEditor.css';

export default function UIEditorFrameInspector() {
  const uiSelectedSkin = useEditorStore((s) => s.uiSelectedSkin);
  const uiSelectedSkinFile = useEditorStore((s) => s.uiSelectedSkinFile);
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
  const uiEditorDirty = useEditorStore((s) => s.uiEditorDirty);
  const setUiSkinCornerSize = useEditorStore((s) => s.setUiSkinCornerSize);
  const setUiSkinFrame = useEditorStore((s) => s.setUiSkinFrame);
  const setUiSkinFill = useEditorStore((s) => s.setUiSkinFill);
  const setUiSkinUseCenterFill = useEditorStore((s) => s.setUiSkinUseCenterFill);
  const setUiEditorDirty = useEditorStore((s) => s.setUiEditorDirty);
  const triggerSkinsReload = useEditorStore((s) => s.triggerSkinsReload);
  const projectPath = useEditorStore((s) => s.projectPath);

  const saveSkin = useCallback(async (fields: Record<string, number | boolean>) => {
    if (!projectPath || !uiSelectedSkin) return;
    await fetch(`/api/ui-editor/skins/${encodeURIComponent(uiSelectedSkin)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  }, [projectPath, uiSelectedSkin]);

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
      await saveSkin({ cornerSize: uiSkinCornerSize, frameX: uiSkinFrameX, frameY: uiSkinFrameY, frameW: uiSkinFrameW, frameH: uiSkinFrameH, fillX: uiSkinFillX, fillY: uiSkinFillY, fillW: uiSkinFillW, fillH: uiSkinFillH, useCenterFill: uiSkinUseCenterFill });
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
          <div className="ui-inspector-row">
            <div className="ui-inspector-label" style={{ fontSize: 13, color: '#ddd' }}>
              {uiSelectedSkin || '—'}
            </div>
          </div>
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
