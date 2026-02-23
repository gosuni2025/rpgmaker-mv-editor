import React, { useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import DragLabel from '../common/DragLabel';
import './UIEditor.css';

export default function UIEditorFrameInspector() {
  const uiSelectedSkin = useEditorStore((s) => s.uiSelectedSkin);
  const uiSkinCornerSize = useEditorStore((s) => s.uiSkinCornerSize);
  const uiEditorDirty = useEditorStore((s) => s.uiEditorDirty);
  const setUiSkinCornerSize = useEditorStore((s) => s.setUiSkinCornerSize);
  const setUiEditorDirty = useEditorStore((s) => s.setUiEditorDirty);
  const projectPath = useEditorStore((s) => s.projectPath);

  // cornerSize를 UIEditorSkins.json에 저장
  const saveSkinCornerSize = useCallback(async (size: number) => {
    if (!projectPath || !uiSelectedSkin) return;
    await fetch(`/api/ui-editor/skins/${encodeURIComponent(uiSelectedSkin)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cornerSize: size }),
    });
  }, [projectPath, uiSelectedSkin]);

  // 기본 스킨으로 설정 — UIEditorConfig.json의 defaultSkin 저장 + cornerSize 저장
  const handleSetDefault = async () => {
    if (!projectPath || !uiSelectedSkin) return;
    try {
      const config = useEditorStore.getState().uiEditorOverrides;
      await fetch('/api/ui-editor/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: config, defaultSkin: uiSelectedSkin }),
      });
      await saveSkinCornerSize(uiSkinCornerSize);
      useEditorStore.getState().showToast(`기본 스킨: ${uiSelectedSkin} 설정됨`);
    } catch {
      useEditorStore.getState().showToast('설정 실패', true);
    }
  };

  // 적용 — UITheme.js 생성
  const handleApply = async () => {
    if (!projectPath || !uiSelectedSkin) return;
    try {
      await saveSkinCornerSize(uiSkinCornerSize);
      await fetch('/api/ui-editor/generate-plugin', { method: 'POST' });
      setUiEditorDirty(false);
      useEditorStore.getState().showToast('UITheme.js 생성 완료');
    } catch {
      useEditorStore.getState().showToast('적용 실패', true);
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
              img/system/{uiSelectedSkin}.png
            </div>
          </div>
        </div>

        {/* 9-slice 파라미터 */}
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">9-Slice 파라미터</div>
          <div className="ui-inspector-row">
            <DragLabel
              label="코너 크기"
              value={uiSkinCornerSize}
              min={1}
              max={47}
              onChange={(v) => {
                setUiSkinCornerSize(Math.round(v));
                setUiEditorDirty(true);
              }}
              onDragEnd={() => saveSkinCornerSize(useEditorStore.getState().uiSkinCornerSize)}
            />
          </div>
          <div style={{ padding: '2px 12px 6px', fontSize: 11, color: '#777', lineHeight: 1.5 }}>
            RPG MV 기본값: 24px<br />
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
            UIEditorConfig.json에 defaultSkin 저장
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
              적용 (UITheme.js 생성)
            </button>
          </div>
          <div style={{ padding: '2px 12px 6px', fontSize: 11, color: '#777' }}>
            스킨 설정을 플러그인으로 내보내기
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
