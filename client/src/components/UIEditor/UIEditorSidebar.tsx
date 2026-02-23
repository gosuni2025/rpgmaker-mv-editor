import React, { useEffect, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import ImagePicker from '../common/ImagePicker';
import './UIEditor.css';

interface SkinEntry { name: string; cornerSize: number; frameX?: number; frameY?: number; frameW?: number; frameH?: number; fillX?: number; fillY?: number; fillW?: number; fillH?: number; useCenterFill?: boolean; }

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
  const uiSkinsReloadToken = useEditorStore((s) => s.uiSkinsReloadToken);
  const setUiSelectedSkin = useEditorStore((s) => s.setUiSelectedSkin);
  const setUiSkinCornerSize = useEditorStore((s) => s.setUiSkinCornerSize);
  const setUiSkinFrame = useEditorStore((s) => s.setUiSkinFrame);
  const setUiSkinFill = useEditorStore((s) => s.setUiSkinFill);
  const setUiSkinUseCenterFill = useEditorStore((s) => s.setUiSkinUseCenterFill);
  const [skins, setSkins] = useState<SkinEntry[]>([]);
  const [defaultSkin, setDefaultSkin] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const loadSkins = useCallback(() => {
    if (!projectPath) return;
    setLoading(true);
    fetch('/api/ui-editor/skins').then((r) => r.json())
      .then((skinsData) => {
        const list: SkinEntry[] = skinsData.skins ?? [];
        setSkins(list);
        setDefaultSkin(skinsData.defaultSkin ?? '');
        const current = list.find((s) => s.name === uiSelectedSkin);
        if (current) setUiSkinCornerSize(current.cornerSize);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectPath]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadSkins(); }, [loadSkins, uiSkinsReloadToken]);

  const handleSelect = (skin: SkinEntry) => {
    setUiSelectedSkin(skin.name);
    setUiSkinCornerSize(skin.cornerSize);
    setUiSkinFrame(skin.frameX ?? 96, skin.frameY ?? 0, skin.frameW ?? 96, skin.frameH ?? 96);
    setUiSkinUseCenterFill(skin.useCenterFill ?? true);
    if (!(skin.useCenterFill ?? true)) {
      setUiSkinFill(skin.fillX ?? 0, skin.fillY ?? 0, skin.fillW ?? 96, skin.fillH ?? 96);
    }
  };

  const handleDelete = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/ui-editor/skins/${encodeURIComponent(name)}`, { method: 'DELETE' });
    loadSkins();
  };

  const handlePick = async (name: string) => {
    setPickerOpen(false);
    if (!name) return;
    try {
      const res = await fetch('/api/ui-editor/skins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, cornerSize: 24 }),
      });
      // 409 = 이미 등록된 스킨 (무시)
      if (res.ok || res.status === 409) {
        loadSkins();
        if (res.ok) useEditorStore.getState().showToast(`스킨 등록: ${name}`);
      }
    } catch {
      useEditorStore.getState().showToast('등록 실패', true);
    }
  };

  return (
    <>
      <ImagePicker type="system" value="" open={pickerOpen} onClose={() => setPickerOpen(false)} onChange={handlePick} />

      <div className="ui-editor-sidebar-section" style={{ borderBottom: 'none', padding: '6px 8px 4px' }}>
        <label>9-Slice 스킨 목록{loading ? ' (로딩...)' : ''}</label>
      </div>

      <div className="ui-editor-window-list">
        {skins.length === 0 ? (
          <div className="ui-editor-no-windows">
            {loading ? '불러오는 중...' : '등록된 스킨 없음'}
          </div>
        ) : (
          skins.map((skin) => (
            <div
              key={skin.name}
              className={`ui-editor-window-item${uiSelectedSkin === skin.name ? ' selected' : ''}`}
              onClick={() => handleSelect(skin)}
            >
              <img
                src={`/img/system/${skin.name}.png`}
                alt={skin.name}
                className="ui-skin-thumb"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {skin.name}
                  {defaultSkin === skin.name && (
                    <span className="ui-skin-default-badge">기본</span>
                  )}
                </div>
                <div className="window-class">코너: {skin.cornerSize}px</div>
              </div>
              <button
                className="ui-skin-delete-btn"
                onClick={(e) => handleDelete(skin.name, e)}
                title="목록에서 제거"
              >×</button>
            </div>
          ))
        )}
      </div>

      <div className="ui-editor-sidebar-section" style={{ padding: '6px 8px' }}>
        <button
          className="ui-canvas-toolbar-btn"
          style={{ width: '100%' }}
          disabled={!projectPath}
          onClick={() => setPickerOpen(true)}
        >
          + 스킨 등록…
        </button>
      </div>
    </>
  );
}

export default function UIEditorSidebar() {
  const uiEditSubMode = useEditorStore((s) => s.uiEditSubMode);
  return (
    <div className="ui-editor-sidebar">
      {uiEditSubMode === 'window' ? <WindowList /> : <SkinList />}
    </div>
  );
}
