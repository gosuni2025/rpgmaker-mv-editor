import React, { useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { WindowInspector } from './UIEditorWindowInspector';
import { ElementInspector } from './UIEditorElementInspector';
import { useFontEditorData } from './UIEditorFontEditor';
import './UIEditor.css';

const ALL_FONTS = [
  { family: '', label: '(미설정 — 기본 폰트 사용)' },
  { family: 'GameFont', label: 'GameFont' },
  { family: 'sans-serif', label: 'sans-serif' },
  { family: 'serif', label: 'serif' },
  { family: 'monospace', label: 'monospace' },
  { family: 'Dotum, AppleGothic, sans-serif', label: 'Dotum (한국어)' },
  { family: 'SimHei, Heiti TC, sans-serif', label: 'SimHei (중국어)' },
  { family: 'Arial, sans-serif', label: 'Arial' },
  { family: 'Georgia, serif', label: 'Georgia' },
];

function SceneInspector() {
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);
  const uiFontSceneFonts = useEditorStore((s) => s.uiFontSceneFonts);
  const uiFontDefaultFace = useEditorStore((s) => s.uiFontDefaultFace);
  const uiFontList = useEditorStore((s) => s.uiFontList);
  const setUiFontSceneFonts = useEditorStore((s) => s.setUiFontSceneFonts);
  const setUiEditorDirty = useEditorStore((s) => s.setUiEditorDirty);
  const projectPath = useEditorStore((s) => s.projectPath);
  const reloadFonts = useFontEditorData();

  const [showFontPicker, setShowFontPicker] = useState(false);

  const currentSceneFont = uiFontSceneFonts[uiEditorScene] ?? '';
  const allFonts = [
    ...ALL_FONTS,
    ...uiFontList.map((f) => ({ family: f.family, label: `${f.family} (${f.file})` })),
  ];

  const handleSetSceneFont = async (fontFace: string) => {
    const next = { ...uiFontSceneFonts };
    if (fontFace) {
      next[uiEditorScene] = fontFace;
    } else {
      delete next[uiEditorScene];
    }
    await fetch('/api/ui-editor/fonts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneFonts: next }),
    });
    setUiFontSceneFonts(next);
    setUiEditorDirty(true);
    // iframe 씬 재로드로 적용
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({ type: 'refreshScene' }, '*');
    useEditorStore.getState().showToast(fontFace ? `씬 폰트 설정: ${fontFace}` : '씬 폰트 초기화');
  };

  return (
    <div className="ui-editor-inspector">
      <div className="ui-editor-inspector-header">씬 설정</div>
      <div className="ui-editor-inspector-body">
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">{uiEditorScene}</div>
          <div className="ui-editor-inspector-empty" style={{ padding: '6px 12px', fontSize: 12 }}>
            창을 선택하면 해당 창의 설정을 편집합니다
          </div>
        </div>

        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">이 씬의 기본 폰트 설정</div>

          {!showFontPicker ? (
            <div style={{ padding: '4px 12px 8px' }}>
              {currentSceneFont && (
                <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>
                  현재: <strong style={{ color: '#ddd' }}>{currentSceneFont}</strong>
                </div>
              )}
              <button
                className="ui-canvas-toolbar-btn"
                style={{ width: '100%' }}
                onClick={() => setShowFontPicker(true)}
                disabled={!projectPath}
              >
                {currentSceneFont ? '폰트 변경…' : '폰트 설정…'}
              </button>
            </div>
          ) : (
            <div style={{ padding: '4px 12px 8px' }}>
              <div className="ui-font-tag-grid" style={{ marginBottom: 6 }}>
                {allFonts.map((f) => (
                  <label
                    key={f.family || '__none__'}
                    className={`ui-radio-label ui-font-tag${currentSceneFont === f.family ? ' active' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`scene-font-${uiEditorScene}`}
                      checked={currentSceneFont === f.family}
                      onChange={() => {
                        handleSetSceneFont(f.family);
                        setShowFontPicker(false);
                      }}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
              <button
                className="ui-canvas-toolbar-btn"
                style={{ width: '100%', fontSize: 11, color: '#aaa' }}
                onClick={() => setShowFontPicker(false)}
              >
                취소
              </button>
            </div>
          )}

          {!showFontPicker && currentSceneFont && (
            <div style={{ padding: '0 12px 8px' }}>
              <button
                className="ui-canvas-toolbar-btn"
                style={{ width: '100%', fontSize: 11, color: '#f88' }}
                onClick={() => handleSetSceneFont('')}
              >
                씬 폰트 초기화
              </button>
            </div>
          )}

          <div style={{ padding: '0 12px 4px', fontSize: 11, color: '#666' }}>
            전역 기본 폰트: {uiFontDefaultFace || '(언어별 자동)'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UIEditorInspector() {
  const uiEditorWindows = useEditorStore((s) => s.uiEditorWindows);
  const uiEditorSelectedWindowId = useEditorStore((s) => s.uiEditorSelectedWindowId);
  const uiEditorOverrides = useEditorStore((s) => s.uiEditorOverrides);
  const uiEditorSelectedElementType = useEditorStore((s) => s.uiEditorSelectedElementType);

  const selectedWindow = uiEditorWindows.find((w) => w.id === uiEditorSelectedWindowId) ?? null;
  const override = selectedWindow ? (uiEditorOverrides[selectedWindow.className] ?? null) : null;
  const selectedElement = selectedWindow?.elements?.find((e) => e.type === uiEditorSelectedElementType) ?? null;

  if (!selectedWindow) {
    return <SceneInspector />;
  }

  return (
    <div className="ui-editor-inspector">
      {selectedElement ? (
        <ElementInspector selectedWindow={selectedWindow} elem={selectedElement} />
      ) : (
        <WindowInspector selectedWindow={selectedWindow} override={override} />
      )}
    </div>
  );
}
