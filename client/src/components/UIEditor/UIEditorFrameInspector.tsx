import React, { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../../api/client';
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
  const setUiSkinCornerSize = useEditorStore((s) => s.setUiSkinCornerSize);
  const setUiSkinFrame = useEditorStore((s) => s.setUiSkinFrame);
  const setUiSkinFill = useEditorStore((s) => s.setUiSkinFill);
  const setUiSkinUseCenterFill = useEditorStore((s) => s.setUiSkinUseCenterFill);
  const projectPath = useEditorStore((s) => s.projectPath);

  const saveSkin = useCallback(async (fields: Record<string, number | boolean | string | undefined>) => {
    if (!projectPath || !uiSelectedSkin) return;
    await fetch(`/api/ui-editor/skins/${encodeURIComponent(uiSelectedSkin)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  }, [projectPath, uiSelectedSkin]);

  useEffect(() => {
    if (!uiSelectedSkin) { setSkinLabel(''); return; }
    apiClient.get<{ skins: { name: string; label?: string }[] }>('/ui-editor/skins')
      .then((d) => {
        const entry = (d.skins ?? []).find((s) => s.name === uiSelectedSkin);
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

  const handleSetDefault = async () => {
    if (!projectPath || !uiSelectedSkin) return;
    try {
      await apiClient.put('/ui-editor/skins/default', { defaultFrameSkin: uiSelectedSkin });
      triggerSkinsReload();
      useEditorStore.getState().showToast(`프레임 기본 스킨: ${uiSelectedSkin} 설정됨`);
    } catch {
      useEditorStore.getState().showToast('설정 실패', true);
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
          <div className="ui-inspector-row" style={{ paddingTop: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 11, color: '#888' }}>ID (변경 불가)</span>
              <span style={{ fontSize: 12, color: '#aaa', fontFamily: 'monospace' }}>{uiSelectedSkin || '—'}</span>
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
            <DragLabel label="X" value={uiSkinFrameX} min={0} onChange={(v) => { setUiSkinFrame(Math.round(v), uiSkinFrameY, uiSkinFrameW, uiSkinFrameH); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="Y" value={uiSkinFrameY} min={0} onChange={(v) => { setUiSkinFrame(uiSkinFrameX, Math.round(v), uiSkinFrameW, uiSkinFrameH); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="너비" value={uiSkinFrameW} min={10} onChange={(v) => { setUiSkinFrame(uiSkinFrameX, uiSkinFrameY, Math.round(v), uiSkinFrameH); }} />
          </div>
          <div className="ui-inspector-row">
            <DragLabel label="높이" value={uiSkinFrameH} min={10} onChange={(v) => { setUiSkinFrame(uiSkinFrameX, uiSkinFrameY, uiSkinFrameW, Math.round(v)); }} />
          </div>
          <div style={{ padding: '2px 12px 4px', fontSize: 11, color: '#777' }}>
            캔버스에서 프레임 영역 드래그로 이동/리사이즈 가능
          </div>
        </div>

        {/* fill 영역 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">Fill 영역 (배경)</div>
          <div className="ui-inspector-row" style={uiSkinUseCenterFill ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <DragLabel label="X" value={uiSkinFillX} min={0} onChange={(v) => { setUiSkinFill(Math.round(v), uiSkinFillY, uiSkinFillW, uiSkinFillH); }} />
          </div>
          <div className="ui-inspector-row" style={uiSkinUseCenterFill ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <DragLabel label="Y" value={uiSkinFillY} min={0} onChange={(v) => { setUiSkinFill(uiSkinFillX, Math.round(v), uiSkinFillW, uiSkinFillH); }} />
          </div>
          <div className="ui-inspector-row" style={uiSkinUseCenterFill ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <DragLabel label="너비" value={uiSkinFillW} min={4} onChange={(v) => { setUiSkinFill(uiSkinFillX, uiSkinFillY, Math.round(v), uiSkinFillH); }} />
          </div>
          <div className="ui-inspector-row" style={uiSkinUseCenterFill ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <DragLabel label="높이" value={uiSkinFillH} min={4} onChange={(v) => { setUiSkinFill(uiSkinFillX, uiSkinFillY, uiSkinFillW, Math.round(v)); }} />
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
                useEditorStore.getState().showToast('RPG Maker MV 기본값으로 설정됨 (Cmd+S로 저장)');
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
            UIEditorSkins.json에 defaultFrameSkin 저장
          </div>
        </div>

      </div>
    </div>
  );
}
