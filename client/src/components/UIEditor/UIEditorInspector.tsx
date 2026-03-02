import React, { useState } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { WindowInspector } from './UIEditorWindowInspector';
import { ElementInspector } from './UIEditorElementInspector';
import { useFontEditorData } from './UIEditorFontEditor';
import { WidgetInspector } from './UIEditorCustomScenePanel';
import UIEditorScenePickerDialog from './UIEditorScenePickerDialog';
import type { WidgetDef, CustomSceneDefV2 } from '../../store/uiEditorTypes';
import './UIEditor.css';

const AVAILABLE_SCENES = [
  { value: 'Scene_Title', label: '타이틀 (Scene_Title)' },
  { value: 'Scene_Map', label: '맵 (Scene_Map)' },
  { value: 'Scene_Battle', label: '배틀 (Scene_Battle)' },
  { value: 'Scene_Menu', label: '메뉴 (Scene_Menu)' },
  { value: 'Scene_Options', label: '옵션 (Scene_Options)' },
  { value: 'Scene_Status', label: '스테이터스 (Scene_Status)' },
  { value: 'Scene_Item', label: '아이템 (Scene_Item)' },
  { value: 'Scene_Skill', label: '스킬 (Scene_Skill)' },
  { value: 'Scene_Equip', label: '장비 (Scene_Equip)' },
  { value: 'Scene_Save', label: '저장 (Scene_Save)' },
  { value: 'Scene_Load', label: '불러오기 (Scene_Load)' },
  { value: 'Scene_GameEnd', label: '게임 종료 (Scene_GameEnd)' },
  { value: 'Scene_Shop', label: '상점 (Scene_Shop)' },
];

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
  const setUiEditorScene = useEditorStore((s) => s.setUiEditorScene);
  const [showPicker, setShowPicker] = useState(false);

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
    // reloadCustomScenes를 먼저 보내서 씬 클래스를 등록한 뒤,
    // updateSceneRedirects로 올바른 redirects를 설치 (순서 중요 — 역순이면 파일 기준으로 덮어써짐)
    if (target?.startsWith('Scene_CS_')) {
      iframe?.contentWindow?.postMessage({ type: 'reloadCustomScenes' }, '*');
    }
    iframe?.contentWindow?.postMessage({ type: 'updateSceneRedirects', redirects: next }, '*');
    iframe?.contentWindow?.postMessage({ type: 'loadScene', sceneName: scene }, '*');
  };

  const currentRedirectLabel = (() => {
    if (!currentRedirect) return '';
    const csId = currentRedirect.replace('Scene_CS_', '');
    const cs = customScenes.scenes[csId];
    return cs ? `${cs.displayName} (${currentRedirect})` : currentRedirect;
  })();

  const customSceneEntries = customSceneList.map((s) => ({ id: s.id, displayName: s.displayName, category: s.category }));

  return (
    <>
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
              onChange={() => customSceneList.length > 0 && setShowPicker(true)}
            />
            커스텀 씬으로 교체
          </label>
          {currentRedirect && (
            <button
              className="ui-editor-scene-select-btn"
              style={{ width: '100%', marginBottom: 4 }}
              onClick={() => setShowPicker(true)}
            >
              <span className="ui-editor-scene-select-label">{currentRedirectLabel}</span>
              <span className="ui-editor-scene-select-arrow">▾</span>
            </button>
          )}
          {customSceneList.length === 0 && (
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
              커스텀 씬이 없습니다. 사이드바에서 새 씬을 만드세요.
            </div>
          )}
          {currentRedirect && (
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
              게임에서 <strong style={{ color: '#ddd' }}>{scene}</strong>을 열면<br />
              <strong style={{ color: '#2675bf' }}>{currentRedirect}</strong>으로 대체됩니다.
            </div>
          )}
          {currentRedirect && (
            <button
              className="ui-canvas-toolbar-btn"
              style={{ width: '100%', marginTop: 6 }}
              onClick={() => setUiEditorScene(currentRedirect)}
            >
              설정된 커스텀 씬 열기 →
            </button>
          )}
        </div>
      </div>

      {showPicker && (
        <UIEditorScenePickerDialog
          currentScene={currentRedirect || ''}
          availableScenes={AVAILABLE_SCENES}
          customScenes={customSceneEntries}
          sceneRedirects={sceneRedirects}
          initialTopTab="custom"
          onSelect={(selected) => { if (selected.startsWith('Scene_CS_')) handleChange(selected); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
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
  const updateCustomScene = useEditorStore((s) => s.updateCustomScene);
  const setUiEditorScene = useEditorStore((s) => s.setUiEditorScene);

  const isCustomScene = uiEditorScene.startsWith('Scene_CS_');
  const customSceneId = isCustomScene ? uiEditorScene.replace('Scene_CS_', '') : null;
  const customScene = customSceneId ? customScenes.scenes[customSceneId] : null;
  const isOverlay = !!(customScene as CustomSceneDefV2 | null)?.overlay;

  const handleDeleteCustomScene = async () => {
    if (!customSceneId || !customScene) return;
    if (!confirm(`커스텀 씬 "${customScene.displayName}"을 삭제하시겠습니까?`)) return;
    removeCustomScene(customSceneId);
    await saveCustomScenes();
    setUiEditorScene('Scene_Menu');
  };

  const handleToggleOverlay = async () => {
    if (!customSceneId) return;
    updateCustomScene(customSceneId, { overlay: !isOverlay } as any);
    await saveCustomScenes();
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({ type: 'reloadCustomScenes' }, '*');
    useEditorStore.getState().showToast(isOverlay ? '오버레이 모드 해제' : '오버레이 모드 활성화');
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
            <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#ccc', padding: '4px 0' }}>
                <input
                  type="checkbox"
                  checked={isOverlay}
                  onChange={handleToggleOverlay}
                  style={{ accentColor: '#2675bf' }}
                />
                <span>오버레이 모드</span>
                {isOverlay && <span style={{ fontSize: 10, background: '#2675bf', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>OVERLAY</span>}
              </label>
              {isOverlay && (
                <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5, paddingLeft: 22 }}>
                  씬 전환 없이 인게임 위에 표시됩니다.<br />
                  플러그인 커맨드: <code style={{ color: '#adf' }}>OVERLAY SHOW {customSceneId}</code>
                </div>
              )}
              <button
                className="ui-canvas-toolbar-btn"
                style={{ width: '100%', fontSize: 11, color: '#f88', marginTop: 4 }}
                onClick={handleDeleteCustomScene}
              >
                이 커스텀 씬 삭제
              </button>
            </div>
          )}
        </div>

        {!isCustomScene && <SceneRedirectSection scene={uiEditorScene} />}

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
  for (const c of (root.children ?? [])) {
    const found = findWidgetById(c, id);
    if (found) return found;
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
