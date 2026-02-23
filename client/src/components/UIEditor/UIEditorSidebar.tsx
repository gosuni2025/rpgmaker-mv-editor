import React, { useEffect, useState, useCallback } from 'react';
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

function WindowList() {
  const uiEditorWindows = useEditorStore((s) => s.uiEditorWindows);
  const uiEditorSelectedWindowId = useEditorStore((s) => s.uiEditorSelectedWindowId);
  const uiEditorOverrides = useEditorStore((s) => s.uiEditorOverrides);
  const uiEditorIframeReady = useEditorStore((s) => s.uiEditorIframeReady);
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);
  const setUiEditorScene = useEditorStore((s) => s.setUiEditorScene);
  const setUiEditorSelectedWindowId = useEditorStore((s) => s.setUiEditorSelectedWindowId);

  return (
    <>
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
    </>
  );
}

function SkinList() {
  const projectPath = useEditorStore((s) => s.projectPath);
  const uiSelectedSkin = useEditorStore((s) => s.uiSelectedSkin);
  const setUiSelectedSkin = useEditorStore((s) => s.setUiSelectedSkin);
  const [skins, setSkins] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSkins = useCallback(() => {
    if (!projectPath) return;
    setLoading(true);
    fetch('/api/ui-editor/skins')
      .then((r) => r.json())
      .then((data) => setSkins(data.skins ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectPath]);

  useEffect(() => { loadSkins(); }, [loadSkins]);

  // 업로드 후 자동 갱신
  useEffect(() => {
    window.addEventListener('ui-skin-uploaded', loadSkins);
    return () => window.removeEventListener('ui-skin-uploaded', loadSkins);
  }, [loadSkins]);

  return (
    <>
      <div className="ui-editor-sidebar-section" style={{ borderBottom: 'none', padding: '6px 8px 4px' }}>
        <label>스킨 목록{loading ? ' (로딩...)' : ''}</label>
      </div>
      <div className="ui-editor-window-list">
        {skins.length === 0 ? (
          <div className="ui-editor-no-windows">
            {loading ? '불러오는 중...' : 'img/system/ 에 PNG 없음'}
          </div>
        ) : (
          skins.map((skin) => (
            <div
              key={skin}
              className={`ui-editor-window-item${uiSelectedSkin === skin ? ' selected' : ''}`}
              onClick={() => setUiSelectedSkin(skin)}
            >
              <img
                src={`/img/system/${skin}.png`}
                alt={skin}
                className="ui-skin-thumb"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <div>{skin}</div>
                <div className="window-class">img/system/{skin}.png</div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default function UIEditorSidebar() {
  const uiEditSubMode = useEditorStore((s) => s.uiEditSubMode);
  const setUiEditSubMode = useEditorStore((s) => s.setUiEditSubMode);

  return (
    <div className="ui-editor-sidebar">
      {/* 서브모드 탭 */}
      <div className="ui-sidebar-tabs">
        <button
          className={`ui-sidebar-tab${uiEditSubMode === 'window' ? ' active' : ''}`}
          onClick={() => setUiEditSubMode('window')}
        >
          창 편집
        </button>
        <button
          className={`ui-sidebar-tab${uiEditSubMode === 'frame' ? ' active' : ''}`}
          onClick={() => setUiEditSubMode('frame')}
        >
          프레임
        </button>
      </div>

      {uiEditSubMode === 'window' ? <WindowList /> : <SkinList />}
    </div>
  );
}
