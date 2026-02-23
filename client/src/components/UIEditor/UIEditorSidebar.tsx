import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import './UIEditor.css';

const AVAILABLE_SCENES = [
  { value: 'Scene_Options', label: '옵션 (Scene_Options)' },
  { value: 'Scene_Menu', label: '메뉴 (Scene_Menu)' },
  { value: 'Scene_Status', label: '스테이터스 (Scene_Status)' },
  { value: 'Scene_Item', label: '아이템 (Scene_Item)' },
  { value: 'Scene_Skill', label: '스킬 (Scene_Skill)' },
  { value: 'Scene_Equip', label: '장비 (Scene_Equip)' },
  { value: 'Scene_Save', label: '저장 (Scene_Save)' },
  { value: 'Scene_Load', label: '불러오기 (Scene_Load)' },
  { value: 'Scene_GameEnd', label: '게임 종료 (Scene_GameEnd)' },
  { value: 'Scene_Shop', label: '상점 (Scene_Shop)' },
  { value: 'Scene_Battle', label: '배틀 (Scene_Battle)' },
];

export default function UIEditorSidebar() {
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);
  const uiEditorWindows = useEditorStore((s) => s.uiEditorWindows);
  const uiEditorSelectedWindowId = useEditorStore((s) => s.uiEditorSelectedWindowId);
  const uiEditorOverrides = useEditorStore((s) => s.uiEditorOverrides);
  const setUiEditorScene = useEditorStore((s) => s.setUiEditorScene);
  const setUiEditorSelectedWindowId = useEditorStore((s) => s.setUiEditorSelectedWindowId);
  const uiEditorIframeReady = useEditorStore((s) => s.uiEditorIframeReady);

  return (
    <div className="ui-editor-sidebar">
      <div className="ui-editor-sidebar-section">
        <label>씬 선택</label>
        <select
          className="ui-editor-scene-select"
          value={uiEditorScene}
          onChange={(e) => setUiEditorScene(e.target.value)}
        >
          {AVAILABLE_SCENES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="ui-editor-sidebar-section" style={{ borderBottom: 'none', padding: '6px 8px 4px' }}>
        <label>창 목록{!uiEditorIframeReady ? ' (로딩 중...)' : ''}</label>
      </div>

      <div className="ui-editor-window-list">
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
    </div>
  );
}
