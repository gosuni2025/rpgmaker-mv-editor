import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import '../MapEditor/DrawToolbar.css';
import './UIEditor.css';

export default function UIEditorToolbar() {
  const uiEditorDirty = useEditorStore((s) => s.uiEditorDirty);
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);
  const uiEditSubMode = useEditorStore((s) => s.uiEditSubMode);
  const projectPath = useEditorStore((s) => s.projectPath);
  const setUiEditSubMode = useEditorStore((s) => s.setUiEditSubMode);

  const handleSave = async () => {
    if (!projectPath) return;
    try {
      const config = useEditorStore.getState().uiEditorOverrides;
      await fetch('/api/ui-editor/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: config }),
      });
      await fetch('/api/ui-editor/generate-plugin', { method: 'POST' });
      useEditorStore.getState().setUiEditorDirty(false);
      useEditorStore.getState().showToast('UI 테마 저장 완료');
    } catch {
      useEditorStore.getState().showToast('저장 실패', true);
    }
  };

  const handlePlaytest = () => {
    if (!projectPath) return;
    const scene = uiEditSubMode === 'frame' ? 'Scene_Options' : uiEditorScene;
    window.open(`/api/ui-editor/preview?scene=${encodeURIComponent(scene)}`, '_blank');
  };

  return (
    <div className="draw-toolbar">
      {/* 서브모드 토글 — 왼쪽 */}
      <div className="draw-toolbar-group">
        <button
          className={`draw-toolbar-btn${uiEditSubMode === 'window' ? ' active' : ''}`}
          onClick={() => setUiEditSubMode('window')}
        >
          창 편집
        </button>
        <button
          className={`draw-toolbar-btn${uiEditSubMode === 'frame' ? ' active' : ''}`}
          onClick={() => setUiEditSubMode('frame')}
        >
          프레임 편집
        </button>
      </div>

      <div className="draw-toolbar-spacer" />

      {/* 저장 / 플레이테스트 — 오른쪽 */}
      <button
        className={`draw-toolbar-save-btn${uiEditorDirty ? ' dirty' : ''}`}
        onClick={handleSave}
        disabled={!projectPath}
        title="UI 테마 저장 (Ctrl+S)"
      >
        저장{uiEditorDirty ? ' *' : ''}
      </button>

      <button
        className="draw-toolbar-play-btn"
        onClick={handlePlaytest}
        disabled={!projectPath}
        title={`현재 씬(${uiEditorScene}) 플레이테스트`}
      >
        ▶ UI 플레이테스트
      </button>
    </div>
  );
}
