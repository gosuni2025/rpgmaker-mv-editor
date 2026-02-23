import React, { useEffect, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import './UIEditor.css';

interface SkinEntry { name: string; cornerSize: number; }

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
  const setUiSkinCornerSize = useEditorStore((s) => s.setUiSkinCornerSize);
  const [skins, setSkins] = useState<SkinEntry[]>([]);
  const [defaultSkin, setDefaultSkin] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadSkins = useCallback(() => {
    if (!projectPath) return;
    setLoading(true);
    Promise.all([
      fetch('/api/ui-editor/skins').then((r) => r.json()),
      fetch('/api/ui-editor/config').then((r) => r.json()),
    ])
      .then(([skinsData, configData]) => {
        const list: SkinEntry[] = skinsData.skins ?? [];
        setSkins(list);
        setDefaultSkin(configData.defaultSkin ?? '');
        const current = list.find((s) => s.name === uiSelectedSkin);
        if (current) setUiSkinCornerSize(current.cornerSize);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectPath]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadSkins(); }, [loadSkins]);

  useEffect(() => {
    window.addEventListener('ui-skin-uploaded', loadSkins);
    return () => window.removeEventListener('ui-skin-uploaded', loadSkins);
  }, [loadSkins]);

  const handleSelect = (skin: SkinEntry) => {
    setUiSelectedSkin(skin.name);
    setUiSkinCornerSize(skin.cornerSize);
  };

  const handleDelete = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/ui-editor/skins/${encodeURIComponent(name)}`, { method: 'DELETE' });
    loadSkins();
  };

  // 파일 선택 → 업로드 → 스킨 목록 자동 등록
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const nameRaw = file.name.replace(/\.(png|webp)$/i, '');
    const name = nameRaw.replace(/[^a-zA-Z0-9_\-가-힣]/g, '_') || 'CustomSkin';
    try {
      const buf = await file.arrayBuffer();
      const res = await fetch(`/api/ui-editor/upload-skin?name=${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: buf,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      loadSkins();
    } catch (err) {
      useEditorStore.getState().showToast(`업로드 실패: ${(err as Error).message}`, true);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.webp,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          className="ui-canvas-toolbar-btn"
          style={{ width: '100%' }}
          disabled={!projectPath}
          onClick={() => fileInputRef.current?.click()}
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
