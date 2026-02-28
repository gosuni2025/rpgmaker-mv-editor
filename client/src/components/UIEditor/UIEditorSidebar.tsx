import React, { useEffect, useState, useCallback, useRef } from 'react';
import apiClient from '../../api/client';
import useEditorStore from '../../store/useEditorStore';
import ImagePicker from '../common/ImagePicker';
import UIEditorNewSceneDialog from './UIEditorNewSceneDialog';
import UIEditorCustomScenePanel from './UIEditorCustomScenePanel';
import UIEditorScenePickerDialog from './UIEditorScenePickerDialog';
import './UIEditor.css';

interface SkinEntry { name: string; label?: string; file?: string; cornerSize: number; frameX?: number; frameY?: number; frameW?: number; frameH?: number; fillX?: number; fillY?: number; fillW?: number; fillH?: number; useCenterFill?: boolean; cursorX?: number; cursorY?: number; cursorW?: number; cursorH?: number; cursorCornerSize?: number; cursorRenderMode?: 'nineSlice' | 'stretch' | 'tile'; cursorBlendMode?: 'normal' | 'add' | 'multiply' | 'screen'; cursorOpacity?: number; cursorBlink?: boolean; cursorPadding?: number; cursorToneR?: number; cursorToneG?: number; cursorToneB?: number; gaugeFile?: string; gaugeBgX?: number; gaugeBgY?: number; gaugeBgW?: number; gaugeBgH?: number; gaugeFillX?: number; gaugeFillY?: number; gaugeFillW?: number; gaugeFillH?: number; gaugeFillDir?: 'horizontal' | 'vertical'; }

const AVAILABLE_SCENES = [
  // 오리지널 메인 씬
  { value: 'Scene_Title', label: '타이틀 (Scene_Title)', category: 'original' as const },
  { value: 'Scene_Map', label: '맵 (Scene_Map)', category: 'original' as const },
  { value: 'Scene_Battle', label: '배틀 (Scene_Battle)', category: 'original' as const },
  // 서브씬 (메뉴/배틀에서 파생)
  { value: 'Scene_Menu', label: '메뉴 (Scene_Menu)', category: 'sub' as const },
  { value: 'Scene_Options', label: '옵션 (Scene_Options)', category: 'sub' as const },
  { value: 'Scene_Status', label: '스테이터스 (Scene_Status)', category: 'sub' as const },
  { value: 'Scene_Item', label: '아이템 (Scene_Item)', category: 'sub' as const },
  { value: 'Scene_Skill', label: '스킬 (Scene_Skill)', category: 'sub' as const },
  { value: 'Scene_Equip', label: '장비 (Scene_Equip)', category: 'sub' as const },
  { value: 'Scene_Save', label: '저장 (Scene_Save)', category: 'sub' as const },
  { value: 'Scene_Load', label: '불러오기 (Scene_Load)', category: 'sub' as const },
  { value: 'Scene_GameEnd', label: '게임 종료 (Scene_GameEnd)', category: 'sub' as const },
  { value: 'Scene_Shop', label: '상점 (Scene_Shop)', category: 'sub' as const },
];

function WindowList() {
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
        <UIEditorCustomScenePanel sceneId={customSceneId ?? redirectedCustomSceneId!} />
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

function SkinList() {
  const projectPath = useEditorStore((s) => s.projectPath);
  const uiSelectedSkin = useEditorStore((s) => s.uiSelectedSkin);
  const uiSkinsReloadToken = useEditorStore((s) => s.uiSkinsReloadToken);
  const setUiSelectedSkin = useEditorStore((s) => s.setUiSelectedSkin);
  const setUiSelectedSkinFile = useEditorStore((s) => s.setUiSelectedSkinFile);
  const setUiSkinCornerSize = useEditorStore((s) => s.setUiSkinCornerSize);
  const setUiSkinFrame = useEditorStore((s) => s.setUiSkinFrame);
  const setUiSkinFill = useEditorStore((s) => s.setUiSkinFill);
  const setUiSkinUseCenterFill = useEditorStore((s) => s.setUiSkinUseCenterFill);
  const setUiSkinCursor = useEditorStore((s) => s.setUiSkinCursor);
  const setUiSkinCursorCornerSize = useEditorStore((s) => s.setUiSkinCursorCornerSize);
  const setUiSkinCursorRenderMode = useEditorStore((s) => s.setUiSkinCursorRenderMode);
  const setUiSkinCursorBlendMode = useEditorStore((s) => s.setUiSkinCursorBlendMode);
  const setUiSkinCursorOpacity = useEditorStore((s) => s.setUiSkinCursorOpacity);
  const setUiSkinCursorBlink = useEditorStore((s) => s.setUiSkinCursorBlink);
  const setUiSkinCursorPadding = useEditorStore((s) => s.setUiSkinCursorPadding);
  const setUiSkinCursorTone = useEditorStore((s) => s.setUiSkinCursorTone);
  const setUiSkinGaugeFile = useEditorStore((s) => s.setUiSkinGaugeFile);
  const setUiSkinGaugeBg = useEditorStore((s) => s.setUiSkinGaugeBg);
  const setUiSkinGaugeFill = useEditorStore((s) => s.setUiSkinGaugeFill);
  const setUiSkinGaugeFillDir = useEditorStore((s) => s.setUiSkinGaugeFillDir);
  const [skins, setSkins] = useState<SkinEntry[]>([]);
  const [defaultSkin, setDefaultSkin] = useState<string>('');
  const [defaultFrameSkin, setDefaultFrameSkin] = useState<string>('');
  const [defaultCursorSkin, setDefaultCursorSkin] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // 인라인 라벨 편집 상태
  const [editingLabelFor, setEditingLabelFor] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const applySkin = useCallback((skin: SkinEntry) => {
    setUiSelectedSkin(skin.name);
    setUiSelectedSkinFile(skin.file || skin.name);
    setUiSkinCornerSize(skin.cornerSize);
    setUiSkinFrame(skin.frameX ?? 96, skin.frameY ?? 0, skin.frameW ?? 96, skin.frameH ?? 96);
    setUiSkinUseCenterFill(skin.useCenterFill ?? true);
    if (!(skin.useCenterFill ?? true)) {
      setUiSkinFill(skin.fillX ?? 0, skin.fillY ?? 0, skin.fillW ?? 96, skin.fillH ?? 96);
    }
    setUiSkinCursor(skin.cursorX ?? 96, skin.cursorY ?? 96, skin.cursorW ?? 48, skin.cursorH ?? 48);
    setUiSkinCursorCornerSize(skin.cursorCornerSize ?? 4);
    setUiSkinCursorRenderMode(skin.cursorRenderMode ?? 'nineSlice');
    setUiSkinCursorBlendMode(skin.cursorBlendMode ?? 'normal');
    setUiSkinCursorOpacity(skin.cursorOpacity ?? 192);
    setUiSkinCursorBlink(skin.cursorBlink ?? true);
    setUiSkinCursorPadding(skin.cursorPadding ?? 2);
    setUiSkinCursorTone(skin.cursorToneR ?? 0, skin.cursorToneG ?? 0, skin.cursorToneB ?? 0);
    setUiSkinGaugeFile(skin.gaugeFile ?? '');
    // 게이지 기본값: RPG Maker MV 표준 Window.png 색상 팔레트 위치
    //   textColor(19) = gaugeBackColor  → block (132, 168, 12, 12)
    //   textColor(20-21) = hpGaugeColor → block (144, 168, 24, 12)
    setUiSkinGaugeBg(skin.gaugeBgX ?? 132, skin.gaugeBgY ?? 168, skin.gaugeBgW ?? 12, skin.gaugeBgH ?? 12);
    setUiSkinGaugeFill(skin.gaugeFillX ?? 144, skin.gaugeFillY ?? 168, skin.gaugeFillW ?? 24, skin.gaugeFillH ?? 12);
    setUiSkinGaugeFillDir(skin.gaugeFillDir ?? 'horizontal');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSkins = useCallback(() => {
    if (!projectPath) return;
    setLoading(true);
    apiClient.get<{ skins: SkinEntry[]; defaultSkin: string; defaultFrameSkin: string; defaultCursorSkin: string }>('/ui-editor/skins')
      .then((skinsData) => {
        const list: SkinEntry[] = skinsData.skins ?? [];
        setSkins(list);
        setDefaultSkin(skinsData.defaultSkin ?? '');
        setDefaultFrameSkin(skinsData.defaultFrameSkin ?? '');
        setDefaultCursorSkin(skinsData.defaultCursorSkin ?? '');
        // 복원된 선택 스킨의 모든 값을 초기화 (cornerSize뿐 아니라 게이지 등 전체)
        const current = list.find((s) => s.name === uiSelectedSkin);
        if (current) applySkin(current);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectPath, applySkin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadSkins(); }, [loadSkins, uiSkinsReloadToken]);

  // 편집 input이 열리면 포커스
  useEffect(() => {
    if (editingLabelFor !== null) {
      setTimeout(() => editInputRef.current?.focus(), 0);
    }
  }, [editingLabelFor]);

  const handleSelect = (skin: SkinEntry) => {
    applySkin(skin);
  };

  const handleDelete = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/ui-editor/skins/${encodeURIComponent(name)}`, { method: 'DELETE' });
    loadSkins();
  };

  const handlePick = async (pickedFile: string) => {
    setPickerOpen(false);
    if (!pickedFile) return;

    // 라벨 입력 프롬프트
    const labelInput = window.prompt(
      `스킨 표시 이름 입력\n(파일: img/system/${pickedFile}.png)\n비워두면 파일명 사용`,
      pickedFile,
    );
    if (labelInput === null) return; // 취소

    // name(ID) 생성: 사용자 입력 이름 기반, 중복 시 #1, #2 등 suffix
    const baseName = labelInput.trim() || pickedFile;
    let name = baseName;
    if (skins.find((s) => s.name === name)) {
      let i = 1;
      while (skins.find((s) => s.name === `${baseName}#${i}`)) i++;
      name = `${baseName}#${i}`;
    }

    try {
      const res = await fetch('/api/ui-editor/skins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, file: pickedFile !== name ? pickedFile : undefined, cornerSize: 24 }),
      });
      if (res.ok || res.status === 409) {
        loadSkins();
        if (res.ok) useEditorStore.getState().showToast(`스킨 등록: ${labelInput || name}`);
      }
    } catch {
      useEditorStore.getState().showToast('등록 실패', true);
    }
  };

  const handleLabelDoubleClick = (skin: SkinEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLabelFor(skin.name);
    setEditLabelValue(skin.label || skin.name);
  };

  const handleLabelSave = async (skinName: string) => {
    setEditingLabelFor(null);
    const newLabel = editLabelValue.trim();
    try {
      await fetch(`/api/ui-editor/skins/${encodeURIComponent(skinName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel || undefined }),
      });
      loadSkins();
    } catch {
      useEditorStore.getState().showToast('라벨 저장 실패', true);
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
                src={/\.(png|webp)$/i.test(skin.file || skin.name) ? `/img/system/${skin.file || skin.name}` : `/img/system/${skin.file || skin.name}.png`}
                alt={skin.label || skin.name}
                className="ui-skin-thumb"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {editingLabelFor === skin.name ? (
                    <input
                      ref={editInputRef}
                      className="ui-skin-label-input"
                      value={editLabelValue}
                      onChange={(e) => setEditLabelValue(e.target.value)}
                      onBlur={() => handleLabelSave(skin.name)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleLabelSave(skin.name);
                        else if (e.key === 'Escape') setEditingLabelFor(null);
                        e.stopPropagation();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '1px 4px', background: '#1a1a2e', color: '#ddd', border: '1px solid #4af', borderRadius: 2, outline: 'none' }}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => handleLabelDoubleClick(skin, e)}
                      title="더블클릭으로 이름 편집"
                      style={{ cursor: 'text' }}
                    >
                      {skin.label || skin.name}
                    </span>
                  )}
                  {defaultSkin === skin.name && !defaultFrameSkin && !defaultCursorSkin && (
                    <span className="ui-skin-default-badge">기본</span>
                  )}
                  {defaultFrameSkin === skin.name && (
                    <span className="ui-skin-default-badge" style={{ background: '#2675bf' }}>프레임</span>
                  )}
                  {defaultCursorSkin === skin.name && (
                    <span className="ui-skin-default-badge" style={{ background: '#b06020' }}>커서</span>
                  )}
                </div>
                <div className="window-class">
                  ID: {skin.name}{skin.file && skin.file !== skin.name ? ` · 파일: ${skin.file}` : ''} · 코너: {skin.cornerSize}px
                </div>
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

const SYSTEM_FONTS = [
  { family: 'GameFont', label: 'GameFont (기본)' },
  { family: 'sans-serif', label: 'sans-serif' },
  { family: 'serif', label: 'serif' },
  { family: 'monospace', label: 'monospace' },
  { family: 'Dotum, AppleGothic, sans-serif', label: 'Dotum (한국어)' },
  { family: 'SimHei, Heiti TC, sans-serif', label: 'SimHei (중국어)' },
  { family: 'Arial, sans-serif', label: 'Arial' },
  { family: 'Georgia, serif', label: 'Georgia' },
];

function FontList() {
  const fontList = useEditorStore((s) => s.uiFontList);
  const selectedFamily = useEditorStore((s) => s.uiFontSelectedFamily);
  const defaultFontFace = useEditorStore((s) => s.uiFontDefaultFace);
  const setUiFontSelectedFamily = useEditorStore((s) => s.setUiFontSelectedFamily);

  return (
    <>
      {fontList.length > 0 && (
        <>
          <div className="ui-editor-sidebar-section" style={{ borderBottom: 'none', padding: '6px 8px 4px' }}>
            <label>프로젝트 폰트</label>
          </div>
          <div className="ui-editor-window-list" style={{ flex: 'none', maxHeight: 180 }}>
            {fontList.map((f) => (
              <div
                key={f.family + f.file}
                className={`ui-editor-window-item${selectedFamily === f.family ? ' selected' : ''}`}
                onClick={() => setUiFontSelectedFamily(f.family)}
              >
                <div>
                  <div>{f.family}</div>
                  <div className="window-class">{f.file}</div>
                </div>
                {defaultFontFace === f.family && <span className="ui-skin-default-badge" style={{ marginLeft: 'auto' }}>기본</span>}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="ui-editor-sidebar-section" style={{ borderBottom: 'none', padding: '6px 8px 4px' }}>
        <label>시스템 폰트</label>
      </div>
      <div className="ui-font-tag-grid" style={{ padding: '4px 0', flex: 1, overflowY: 'auto' }}>
        {SYSTEM_FONTS.map((f) => (
          <label
            key={f.family}
            className={`ui-radio-label ui-font-tag${selectedFamily === f.family ? ' active' : ''}`}
          >
            <input
              type="radio"
              name="font-family"
              value={f.family}
              checked={selectedFamily === f.family}
              onChange={() => setUiFontSelectedFamily(f.family)}
            />
            {f.label}
            {defaultFontFace === f.family && (
              <span className="ui-skin-default-badge" style={{ marginLeft: 'auto' }}>기본</span>
            )}
          </label>
        ))}
      </div>
    </>
  );
}

export default function UIEditorSidebar() {
  const uiEditSubMode = useEditorStore((s) => s.uiEditSubMode);
  return (
    <div className="ui-editor-sidebar">
      {uiEditSubMode === 'window' ? <WindowList /> : uiEditSubMode === 'font' ? <FontList /> : <SkinList />}
    </div>
  );
}

