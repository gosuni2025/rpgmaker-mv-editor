import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import './UIEditor.css';

const SYSTEM_FONTS = [
  { family: 'GameFont', label: 'GameFont' },
  { family: 'sans-serif', label: 'sans-serif' },
  { family: 'serif', label: 'serif' },
  { family: 'monospace', label: 'monospace' },
  { family: 'Dotum, AppleGothic, sans-serif', label: 'Dotum (한국어)' },
  { family: 'SimHei, Heiti TC, sans-serif', label: 'SimHei (중국어)' },
  { family: 'Arial, sans-serif', label: 'Arial' },
  { family: 'Georgia, serif', label: 'Georgia' },
];

export default function UIEditorFontInspector() {
  const projectPath = useEditorStore((s) => s.projectPath);
  const selectedFamily = useEditorStore((s) => s.uiFontSelectedFamily);
  const defaultFontFace = useEditorStore((s) => s.uiFontDefaultFace);
  const fontList = useEditorStore((s) => s.uiFontList);
  const setUiFontDefaultFace = useEditorStore((s) => s.setUiFontDefaultFace);
  const setUiEditorDirty = useEditorStore((s) => s.setUiEditorDirty);

  const isDefault = defaultFontFace === selectedFamily || (!defaultFontFace && selectedFamily === 'GameFont');
  const projectEntry = fontList.find((f) => f.family === selectedFamily);
  const systemEntry = SYSTEM_FONTS.find((f) => f.family === selectedFamily);
  const isProject = !!projectEntry;

  const handleSetDefault = async () => {
    if (!selectedFamily) return;
    await fetch('/api/ui-editor/fonts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultFontFace: selectedFamily }),
    });
    setUiFontDefaultFace(selectedFamily);
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({ type: 'setDefaultFontFace', fontFace: selectedFamily }, '*');
    setUiEditorDirty(true);
    useEditorStore.getState().showToast(`기본 폰트 설정: ${selectedFamily}`);
  };

  if (!selectedFamily) {
    return (
      <div className="ui-editor-inspector">
        <div className="ui-editor-inspector-header">폰트 정보</div>
        <div className="ui-editor-inspector-body">
          <div className="ui-editor-inspector-empty">폰트를 선택하세요</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-editor-inspector">
      <div className="ui-editor-inspector-header">폰트 정보</div>
      <div className="ui-editor-inspector-body">
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">선택된 폰트</div>

          <div className="ui-inspector-row">
            <span className="ui-inspector-label">Family</span>
            <span style={{ fontSize: 12, color: '#ddd', wordBreak: 'break-all' }}>{selectedFamily}</span>
          </div>
          {isProject && (
            <div className="ui-inspector-row">
              <span className="ui-inspector-label">파일</span>
              <span style={{ fontSize: 11, color: '#aaa' }}>fonts/{projectEntry!.file}</span>
            </div>
          )}
          <div className="ui-inspector-row">
            <span className="ui-inspector-label">종류</span>
            <span style={{ fontSize: 12, color: '#aaa' }}>{isProject ? '프로젝트 폰트' : '시스템 폰트'}</span>
          </div>

          <div style={{ margin: '10px 12px 6px' }}>
            <div className="ui-font-preview-box" style={{ fontFamily: selectedFamily, fontSize: 20 }}>
              가나다 ABC 123
            </div>
          </div>

          <div style={{ padding: '4px 12px 6px' }}>
            <button
              className="ui-canvas-toolbar-btn"
              style={{
                width: '100%',
                background: isDefault ? '#1a3a1a' : undefined,
                borderColor: isDefault ? '#3a7a3a' : undefined,
                color: isDefault ? '#6cf06c' : undefined,
              }}
              onClick={handleSetDefault}
              disabled={!projectPath || isDefault}
            >
              {isDefault ? '✓ 기본 폰트로 설정됨' : '기본 폰트로 설정'}
            </button>
          </div>
        </div>

        {defaultFontFace && !isDefault && (
          <div className="ui-inspector-section">
            <div className="ui-inspector-section-title">현재 기본 폰트</div>
            <div style={{ padding: '4px 12px', fontSize: 12, color: '#aaa' }}>{defaultFontFace}</div>
          </div>
        )}
      </div>
    </div>
  );
}
