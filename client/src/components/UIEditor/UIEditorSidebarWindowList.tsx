import React, { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import useEditorStore from '../../store/useEditorStore';
import UIEditorNewSceneDialog from './UIEditorNewSceneDialog';
import UIEditorCustomScenePanel from './UIEditorCustomScenePanel';
import UIEditorScenePickerDialog from './UIEditorScenePickerDialog';

export const AVAILABLE_SCENES = [
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

export function WindowList() {
  const uiEditorWindows = useEditorStore((s) => s.uiEditorWindows);
  const uiEditorSelectedWindowId = useEditorStore((s) => s.uiEditorSelectedWindowId);
  const uiEditorOverrides = useEditorStore((s) => s.uiEditorOverrides);
  const uiEditorIframeReady = useEditorStore((s) => s.uiEditorIframeReady);
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);
  const uiFontSceneFonts = useEditorStore((s) => s.uiFontSceneFonts);
  const customScenes = useEditorStore((s) => s.customScenes);
  const loadCustomScenes = useEditorStore((s) => s.loadCustomScenes);
  const setUiEditorScene = useEditorStore((s) => s.setUiEditorScene);
  const setUiEditorSelectedWindowId = useEditorStore((s) => s.setUiEditorSelectedWindowId);
  const projectPath = useEditorStore((s) => s.projectPath);
  const [showNewSceneDialog, setShowNewSceneDialog] = useState(false);
  const [showScenePicker, setShowScenePicker] = useState(false);

  // 커스텀 씬 로드
  useEffect(() => { if (projectPath) { loadCustomScenes(); } }, [projectPath]); // eslint-disable-line react-hooks/exhaustive-deps

  const sceneRedirects = useEditorStore((s) => s.sceneRedirects);
  const isCustomScene = uiEditorScene.startsWith('Scene_CS_');
  const customSceneId = isCustomScene ? uiEditorScene.replace('Scene_CS_', '') : null;
  // 현재 씬이 커스텀 씬으로 리다이렉트된 경우, 그 커스텀 씬 패널을 표시
  const redirectedTo = !isCustomScene ? sceneRedirects[uiEditorScene] : undefined;
  const redirectedCustomSceneId = redirectedTo?.startsWith('Scene_CS_') ? redirectedTo.replace('Scene_CS_', '') : null;

  const sceneSelected = uiEditorSelectedWindowId === null;
  const hasSceneFont = !!uiFontSceneFonts[uiEditorScene];

  const customSceneEntries = Object.values(customScenes.scenes).map((s) => ({
    id: s.id,
    displayName: s.displayName,
    category: s.category,
  }));

  // 현재 씬의 표시 레이블
  const currentSceneLabel = (() => {
    const found = AVAILABLE_SCENES.find((s) => s.value === uiEditorScene);
    if (found) return found.label;
    const csId = isCustomScene ? uiEditorScene.replace('Scene_CS_', '') : null;
    if (csId) {
      const cs = customScenes.scenes[csId];
      if (cs) return `${cs.displayName} (${uiEditorScene})`;
    }
    return uiEditorScene;
  })();

  return (
    <>
      <div className="ui-editor-sidebar-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ marginBottom: 0 }}>씬 선택</label>
          <button
            className="ui-canvas-toolbar-btn"
            style={{ padding: '1px 6px', fontSize: 11 }}
            onClick={() => apiClient.post('/ui-editor/scenes/open-folder', {})}
            title="UIScenes 폴더 열기"
          >폴더</button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="ui-editor-scene-select-btn"
            onClick={() => setShowScenePicker(true)}
            title="씬 선택 (클릭으로 팝업 열기)"
          >
            <span className="ui-editor-scene-select-label">{currentSceneLabel}</span>
            <span className="ui-editor-scene-select-arrow">▾</span>
          </button>
          <button
            className="ui-canvas-toolbar-btn"
            style={{ padding: '4px 8px', fontSize: 13, whiteSpace: 'nowrap' }}
            onClick={() => setShowNewSceneDialog(true)}
            title="새 커스텀 씬 만들기"
          >+</button>
        </div>
      </div>

      {showScenePicker && (
        <UIEditorScenePickerDialog
          currentScene={uiEditorScene}
          availableScenes={AVAILABLE_SCENES}
          customScenes={customSceneEntries}
          sceneRedirects={sceneRedirects}
          onSelect={(scene) => setUiEditorScene(scene)}
          onClose={() => setShowScenePicker(false)}
        />
      )}

      {(isCustomScene && customSceneId) || redirectedCustomSceneId ? (
        <UIEditorCustomScenePanel sceneId={customSceneId ?? redirectedCustomSceneId!} readOnly={!!redirectedCustomSceneId && !isCustomScene} />
      ) : (
        <div className="ui-editor-window-list">
          {/* 씬 자체 항목 */}
          <div
            className={`ui-editor-window-item${sceneSelected ? ' selected' : ''}`}
            onClick={() => setUiEditorSelectedWindowId(null)}
          >
            <div className={`ui-editor-window-badge${hasSceneFont ? ' has-override' : ''}`} />
            <div>
              <div>{uiEditorScene.replace(/^Scene_/, '')}</div>
              <div className="window-class">{uiEditorScene}</div>
            </div>
          </div>

          <div className="ui-window-list-divider" />

          {uiEditorWindows.length === 0 ? (
            <div className="ui-editor-no-windows">
              {uiEditorIframeReady ? '창이 없습니다' : '씬 로딩 중...'}
            </div>
          ) : (
            uiEditorWindows.map((win) => {
              const hasOverride = !!uiEditorOverrides[win.className];
              const isSelected = uiEditorSelectedWindowId === win.id;
              return (
                <div
                  key={win.id}
                  className={`ui-editor-window-item${isSelected ? ' selected' : ''}`}
                  onClick={() => setUiEditorSelectedWindowId(isSelected ? null : win.id)}
                >
                  <div className={`ui-editor-window-badge${hasOverride ? ' has-override' : ''}`} />
                  <div>
                    <div>{win.className.replace(/^Window_/, '')}</div>
                    <div className="window-class">{win.className}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {showNewSceneDialog && (
        <UIEditorNewSceneDialog
          onClose={() => setShowNewSceneDialog(false)}
          onCreated={(id) => setUiEditorScene(`Scene_CS_${id}`)}
        />
      )}
    </>
  );
}
