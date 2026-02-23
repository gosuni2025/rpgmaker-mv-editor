import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import './UIEditor.css';

export default function UIEditorToolbar() {
  const uiEditorDirty = useEditorStore((s) => s.uiEditorDirty);
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);
  const projectPath = useEditorStore((s) => s.projectPath);

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
    // 저장된 config가 있으면 적용된 상태로 새 탭에서 열림
    window.open(`/api/ui-editor/preview?scene=${encodeURIComponent(uiEditorScene)}`, '_blank');
  };

  return (
    <div className="ui-editor-toolbar">
      <button
        className={`ui-toolbar-btn${uiEditorDirty ? ' dirty' : ''}`}
        onClick={handleSave}
        disabled={!projectPath}
        title="UI 테마 저장 (Ctrl+S)"
      >
        저장{uiEditorDirty ? ' *' : ''}
      </button>

      <div className="ui-toolbar-sep" />

      <button
        className="ui-toolbar-btn ui-toolbar-btn-play"
        onClick={handlePlaytest}
        disabled={!projectPath}
        title={`현재 씬(${uiEditorScene}) 플레이테스트`}
      >
        ▶ UI 플레이테스트
      </button>
    </div>
  );
}
