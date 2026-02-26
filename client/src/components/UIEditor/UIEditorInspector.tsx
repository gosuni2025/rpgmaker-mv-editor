import React, { useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { WindowInspector } from './UIEditorWindowInspector';
import { ElementInspector } from './UIEditorElementInspector';
import { useFontEditorData } from './UIEditorFontEditor';
import { WidgetInspector } from './UIEditorCustomScenePanel';
import type { WidgetDef, WidgetDef_Panel, WidgetDef_Button } from '../../store/uiEditorTypes';
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

function SceneRedirectSection({ scene }: { scene: string }) {
  const sceneRedirects = useEditorStore((s) => s.sceneRedirects);
  const setSceneRedirects = useEditorStore((s) => s.setSceneRedirects);
  const customScenes = useEditorStore((s) => s.customScenes);
  const setUiEditorDirty = useEditorStore((s) => s.setUiEditorDirty);

  const currentRedirect = sceneRedirects[scene] ?? '';
  const customSceneList = Object.values(customScenes.scenes);

  const handleChange = async (target: string) => {
    const next = { ...sceneRedirects };
    if (target) {
      next[scene] = target;
    } else {
      delete next[scene];
    }
    setSceneRedirects(next);
    setUiEditorDirty(true);
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({ type: 'updateSceneRedirects', redirects: next }, '*');
    // 현재 프리뷰 씬이 교체 대상이면 씬 재로드 (리다이렉트 즉시 반영)
    if (target?.startsWith('Scene_CS_')) {
      iframe?.contentWindow?.postMessage({ type: 'reloadCustomScenes' }, '*');
    }
    iframe?.contentWindow?.postMessage({ type: 'loadScene', sceneName: scene }, '*');
  };

  return (
    <div className="ui-inspector-section">
      <div className="ui-inspector-section-title">씬 교체</div>
      <div style={{ padding: '4px 12px 8px' }}>
        <label className="ui-radio-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <input
            type="radio"
            name={`redirect-${scene}`}
            checked={!currentRedirect}
            onChange={() => handleChange('')}
          />
          인 게임 기본 씬 사용
        </label>
        <label className="ui-radio-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, opacity: customSceneList.length === 0 ? 0.5 : 1 }}>
          <input
            type="radio"
            name={`redirect-${scene}`}
            checked={!!currentRedirect}
            disabled={customSceneList.length === 0}
            onChange={() => customSceneList.length > 0 && handleChange(`Scene_CS_${customSceneList[0].id}`)}
          />
          커스텀 씬으로 교체
        </label>
        {currentRedirect && (
          <select
            style={{ width: '100%', background: '#3c3c3c', border: '1px solid #555', color: '#ddd', padding: '4px 6px', borderRadius: 2, fontSize: 12, marginTop: 2 }}
            value={currentRedirect}
            onChange={(e) => handleChange(e.target.value)}
          >
            {customSceneList.map((s) => (
              <option key={s.id} value={`Scene_CS_${s.id}`}>
                {s.displayName} (Scene_CS_{s.id})
              </option>
            ))}
          </select>
        )}
        {customSceneList.length === 0 && (
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
            커스텀 씬이 없습니다. 사이드바에서 새 씬을 만드세요.
          </div>
        )}
        {currentRedirect && (
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
            게임에서 <strong style={{ color: '#ddd' }}>{scene}</strong>을 열면<br />
            <strong style={{ color: '#2675bf' }}>{currentRedirect}</strong>으로 대체됩니다.
          </div>
        )}
      </div>
    </div>
  );
}

function SceneInspector() {
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);
  const uiFontSceneFonts = useEditorStore((s) => s.uiFontSceneFonts);
  const uiFontDefaultFace = useEditorStore((s) => s.uiFontDefaultFace);
  const uiFontList = useEditorStore((s) => s.uiFontList);
  const setUiFontSceneFonts = useEditorStore((s) => s.setUiFontSceneFonts);
  const setUiEditorDirty = useEditorStore((s) => s.setUiEditorDirty);
  const projectPath = useEditorStore((s) => s.projectPath);
  const reloadFonts = useFontEditorData();
  const customScenes = useEditorStore((s) => s.customScenes);
  const removeCustomScene = useEditorStore((s) => s.removeCustomScene);
  const saveCustomScenes = useEditorStore((s) => s.saveCustomScenes);
  const setUiEditorScene = useEditorStore((s) => s.setUiEditorScene);

  const isCustomScene = uiEditorScene.startsWith('Scene_CS_');
  const customSceneId = isCustomScene ? uiEditorScene.replace('Scene_CS_', '') : null;
  const customScene = customSceneId ? customScenes.scenes[customSceneId] : null;

  const handleDeleteCustomScene = async () => {
    if (!customSceneId || !customScene) return;
    if (!confirm(`커스텀 씬 "${customScene.displayName}"을 삭제하시겠습니까?`)) return;
    removeCustomScene(customSceneId);
    await saveCustomScenes();
    setUiEditorScene('Scene_Menu');
  };

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
    // iframe에 갱신된 폰트 설정 전달 후 씬 재로드 (_fonts가 스탈이 되지 않도록)
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    const fontsRes = await fetch('/api/ui-editor/fonts');
    const fontsData = fontsRes.ok ? await fontsRes.json() : null;
    iframe?.contentWindow?.postMessage(
      { type: 'updateFontsConfig', config: fontsData ? { defaultFontFace: fontsData.defaultFontFace, sceneFonts: fontsData.sceneFonts } : { sceneFonts: next } },
      '*'
    );
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
          {isCustomScene && (
            <div style={{ padding: '0 12px 8px' }}>
              <button
                className="ui-canvas-toolbar-btn"
                style={{ width: '100%', fontSize: 11, color: '#f88' }}
                onClick={handleDeleteCustomScene}
              >
                이 커스텀 씬 삭제
              </button>
            </div>
          )}
        </div>

        <SceneRedirectSection scene={uiEditorScene} />

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

function findWidgetById(root: WidgetDef, id: string): WidgetDef | null {
  if (root.id === id) return root;
  if (root.type === 'panel') {
    for (const c of (root as WidgetDef_Panel).children || []) {
      const found = findWidgetById(c, id);
      if (found) return found;
    }
  }
  if (root.type === 'button') {
    for (const c of (root as WidgetDef_Button).children || []) {
      const found = findWidgetById(c, id);
      if (found) return found;
    }
  }
  return null;
}

export default function UIEditorInspector() {
  const uiEditorWindows = useEditorStore((s) => s.uiEditorWindows);
  const uiEditorSelectedWindowId = useEditorStore((s) => s.uiEditorSelectedWindowId);
  const uiEditorOverrides = useEditorStore((s) => s.uiEditorOverrides);
  const uiEditorSelectedElementType = useEditorStore((s) => s.uiEditorSelectedElementType);
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);
  const customScenes = useEditorStore((s) => s.customScenes);
  const customSceneSelectedWidget = useEditorStore((s) => s.customSceneSelectedWidget);

  // 커스텀씬에서 위젯이 선택된 경우 WidgetInspector 표시
  const isCustomScene = uiEditorScene.startsWith('Scene_CS_');
  const customSceneId = isCustomScene ? uiEditorScene.replace('Scene_CS_', '') : null;
  const customScene = customSceneId ? customScenes.scenes[customSceneId] : null;
  const selectedWidget = (customScene && customSceneSelectedWidget && (customScene as any).root)
    ? findWidgetById((customScene as any).root, customSceneSelectedWidget)
    : null;

  if (isCustomScene && selectedWidget) {
    return (
      <div className="ui-editor-inspector">
        <div className="ui-editor-inspector-header">위젯 설정</div>
        <div className="ui-editor-inspector-body" style={{ overflowY: 'auto' }}>
          <WidgetInspector sceneId={customSceneId!} widget={selectedWidget} />
        </div>
      </div>
    );
  }

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
