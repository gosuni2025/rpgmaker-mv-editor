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
  const [loading, setLoading] = useState(false);
  // 스킨 추가 UI 상태
  const [showAdd, setShowAdd] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [selectedAdd, setSelectedAdd] = useState('');

  const loadSkins = useCallback(() => {
    if (!projectPath) return;
    setLoading(true);
    fetch('/api/ui-editor/skins')
      .then((r) => r.json())
      .then((data) => {
        const list: SkinEntry[] = data.skins ?? [];
        setSkins(list);
        // 현재 선택된 스킨의 cornerSize를 스토어에 동기화
        const current = list.find((s) => s.name === uiSelectedSkin);
        if (current) setUiSkinCornerSize(current.cornerSize);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectPath]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadSkins(); }, [loadSkins]);

  // 업로드 후 목록 갱신
  useEffect(() => {
    window.addEventListener('ui-skin-uploaded', loadSkins);
    return () => window.removeEventListener('ui-skin-uploaded', loadSkins);
  }, [loadSkins]);

  // 스킨 선택
  const handleSelect = (skin: SkinEntry) => {
    setUiSelectedSkin(skin.name);
    setUiSkinCornerSize(skin.cornerSize);
  };

  // 스킨 삭제
  const handleDelete = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/ui-editor/skins/${encodeURIComponent(name)}`, { method: 'DELETE' });
    loadSkins();
  };

  // "스킨 추가" 버튼 → img/system/의 미등록 파일 목록 로드
  const handleShowAdd = () => {
    fetch('/api/resources/system')
      .then((r) => r.json())
      .then((files: string[]) => {
        const registered = new Set(skins.map((s) => s.name));
        const unregistered = [...new Set(
          files.map((f) => f.replace(/\.(png|webp)$/i, ''))
        )].filter((n) => !registered.has(n)).sort();
        setAvailableFiles(unregistered);
        setSelectedAdd(unregistered[0] ?? '');
        setShowAdd(true);
      })
      .catch(() => { setAvailableFiles([]); setShowAdd(true); });
  };

  // 스킨 등록 확정
  const handleAdd = async () => {
    if (!selectedAdd) return;
    await fetch('/api/ui-editor/skins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: selectedAdd, cornerSize: 24 }),
    });
    setShowAdd(false);
    loadSkins();
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
                <div>{skin.name}</div>
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

      {/* 스킨 추가 영역 */}
      <div className="ui-editor-sidebar-section" style={{ padding: '6px 8px' }}>
        {showAdd ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {availableFiles.length > 0 ? (
              <select
                value={selectedAdd}
                onChange={(e) => setSelectedAdd(e.target.value)}
                style={{ flex: 1, fontSize: 12, background: '#3a3a3a', color: '#ddd', border: '1px solid #555', borderRadius: 3, padding: '2px 4px' }}
              >
                {availableFiles.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            ) : (
              <span style={{ flex: 1, fontSize: 11, color: '#777' }}>미등록 파일 없음</span>
            )}
            {availableFiles.length > 0 && (
              <button className="ui-canvas-toolbar-btn" onClick={handleAdd}>추가</button>
            )}
            <button className="ui-canvas-toolbar-btn" onClick={() => setShowAdd(false)}>취소</button>
          </div>
        ) : (
          <button
            className="ui-canvas-toolbar-btn"
            style={{ width: '100%' }}
            disabled={!projectPath}
            onClick={handleShowAdd}
          >
            + 스킨 등록
          </button>
        )}
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
