import React, { useState, useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import '../MapEditor/DrawToolbar.css';
import './UIEditor.css';

function SkinLabelHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="ui-help-overlay" onClick={onClose}>
      <div className="ui-help-popup" onClick={(e) => e.stopPropagation()}>
        <div className="ui-help-header">
          영역 라벨 표시란?
          <button className="ui-help-close" onClick={onClose}>×</button>
        </div>
        <div className="ui-help-body">
          <p>
            RPG Maker MV의 내장 <strong>Window.png</strong>는 192×192 이미지로,
            엔진 내부에 4개 사분면 구조가 하드코딩되어 있습니다.
          </p>
          <div className="ui-help-grid">
            <div className="ui-help-cell" style={{ background: 'rgba(80,200,100,0.25)' }}>배경<br /><small>좌상 96×96</small></div>
            <div className="ui-help-cell" style={{ background: 'rgba(38,117,191,0.25)' }}>프레임 (9-slice)<br /><small>우상 96×96</small></div>
            <div className="ui-help-cell" style={{ background: 'rgba(50,160,80,0.2)' }}>배경 반복<br /><small>좌하 96×96</small></div>
            <div className="ui-help-cell" style={{ background: 'rgba(200,120,0,0.2)' }}>커서/화살표<br /><small>우하 96×96</small></div>
          </div>
          <p style={{ marginTop: 10, color: '#aaa', fontSize: 12 }}>
            이 영역 구분은 <strong>RPG Maker MV 내장 Window를 사용하는 경우에만</strong> 의미가 있습니다.<br />
            커스텀 프레임 이미지만 사용한다면 이 라벨은 필요 없습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UIEditorToolbar() {
  const uiEditorDirty = useEditorStore((s) => s.uiEditorDirty);
  const uiEditorScene = useEditorStore((s) => s.uiEditorScene);
  const uiEditSubMode = useEditorStore((s) => s.uiEditSubMode);
  const uiEditorWindows = useEditorStore((s) => s.uiEditorWindows);
  const uiShowSkinLabels = useEditorStore((s) => s.uiShowSkinLabels);
  const uiShowCheckerboard = useEditorStore((s) => s.uiShowCheckerboard);
  const uiShowRegionOverlay = useEditorStore((s) => s.uiShowRegionOverlay);
  const uiNavVisual = useEditorStore((s) => s.uiNavVisual);
  const projectPath = useEditorStore((s) => s.projectPath);
  const setUiEditSubMode = useEditorStore((s) => s.setUiEditSubMode);
  const setUiShowSkinLabels = useEditorStore((s) => s.setUiShowSkinLabels);
  const setUiShowCheckerboard = useEditorStore((s) => s.setUiShowCheckerboard);
  const setUiShowRegionOverlay = useEditorStore((s) => s.setUiShowRegionOverlay);
  const setUiNavVisual = useEditorStore((s) => s.setUiNavVisual);

  const uiEditorSelectedWindowId = useEditorStore((s) => s.uiEditorSelectedWindowId);
  const [showHelp, setShowHelp] = useState(false);
  const [forceShowSelected, setForceShowSelected] = useState(true);
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  const sendViewSettings = (windowId: string | null, force: boolean, exclusive: boolean) => {
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage(
      { type: 'applyViewSettings', windowId, forceShowSelected: force, showOnlySelected: exclusive },
      '*'
    );
  };

  useEffect(() => {
    sendViewSettings(uiEditorSelectedWindowId, forceShowSelected, showOnlySelected);
  }, [uiEditorSelectedWindowId, forceShowSelected, showOnlySelected]);

  const handleFontSave = async () => {
    if (!projectPath) return;
    const s = useEditorStore.getState();
    try {
      await fetch('/api/ui-editor/fonts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultFontFace: s.uiFontDefaultFace }),
      });
      s.setUiEditorDirty(false);
      s.showToast('폰트 설정 저장 완료');
      // iframe에 갱신된 폰트 설정 전달 후 씬 재로드
      const fontsRes = await fetch('/api/ui-editor/fonts');
      if (fontsRes.ok) {
        const fontsData = await fontsRes.json();
        const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
        iframe?.contentWindow?.postMessage(
          { type: 'updateFontsConfig', config: { defaultFontFace: fontsData.defaultFontFace, sceneFonts: fontsData.sceneFonts } },
          '*'
        );
      }
    } catch {
      s.showToast('저장 실패', true);
    }
  };

  const handleSave = async () => {
    if (!projectPath) return;
    try {
      const s = useEditorStore.getState();
      await fetch('/api/ui-editor/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: s.uiEditorOverrides, sceneRedirects: s.sceneRedirects }),
      });
      // 커스텀 씬도 함께 저장
      if (s.customSceneDirty) {
        await s.saveCustomScenes();
      }
      s.setUiEditorDirty(false);
      s.showToast('UI 테마 저장 완료');
    } catch {
      useEditorStore.getState().showToast('저장 실패', true);
    }
  };

  const handleResetScene = async () => {
    const s = useEditorStore.getState();
    // 현재 씬 창들의 오버라이드 삭제 → UITheme.js가 RMMV 기본값 사용
    const classNames = [...new Set(uiEditorWindows.map((w) => w.className))];
    classNames.forEach((cls) => s.resetUiEditorOverride(cls));
    // 서버에 저장
    const s2 = useEditorStore.getState();
    await fetch('/api/ui-editor/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides: s2.uiEditorOverrides, sceneRedirects: s2.sceneRedirects }),
    });
    s.setUiEditorDirty(false);
    // iframe의 _ov에서 해당 클래스 삭제 후 씬 재로드
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    classNames.forEach((cls) => {
      iframe?.contentWindow?.postMessage({ type: 'clearRuntimeOverride', className: cls }, '*');
    });
    iframe?.contentWindow?.postMessage({ type: 'refreshScene' }, '*');
    s.showToast('RMMV 기본값으로 리셋');
  };

  const handlePlaytest = async () => {
    if (!projectPath) return;
    const s = useEditorStore.getState();
    const mapId = s.currentMapId || 1;
    const testPos = s.currentMap?.testStartPosition;
    const centerX = Math.floor((s.currentMap?.width || 1) / 2);
    const centerY = Math.floor((s.currentMap?.height || 1) / 2);
    const startX = testPos ? testPos.x : centerX;
    const startY = testPos ? testPos.y : centerY;
    // UI 설정(sceneRedirects, overrides, customScenes) 먼저 저장
    await fetch('/api/ui-editor/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides: s.uiEditorOverrides, sceneRedirects: s.sceneRedirects }),
    });
    if (s.customSceneDirty) await s.saveCustomScenes();
    s.setUiEditorDirty(false);
    if (s.demoMode) {
      fetch('/api/playtestSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId, mapData: s.currentMap }),
      }).then(r => r.json()).then(({ sessionToken }) => {
        window.open(`/game/index.html?dev=true&startMapId=${mapId}&startX=${startX}&startY=${startY}&session=${sessionToken}`, '_blank');
      });
    } else {
      await s.saveCurrentMap();
      window.open(`/game/index.html?dev=true&startMapId=${mapId}&startX=${startX}&startY=${startY}`, '_blank');
    }
  };

  const handleUITest = async () => {
    if (!projectPath) return;
    const s = useEditorStore.getState();
    // UI 설정 먼저 저장
    await fetch('/api/ui-editor/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides: s.uiEditorOverrides, sceneRedirects: s.sceneRedirects }),
    });
    if (s.customSceneDirty) await s.saveCustomScenes();
    s.setUiEditorDirty(false);
    const scene = uiEditSubMode === 'frame' ? 'Scene_Options' : uiEditorScene;
    // 커스텀 씬(Scene_CS_*)은 실제 게임 런타임으로 열어 키보드 입력이 정상 동작하도록 함
    if (scene.startsWith('Scene_CS_')) {
      window.open(`/game/index_3d.html?uiTestScene=${encodeURIComponent(scene)}`, '_blank');
    } else {
      window.open(`/api/ui-editor/preview?scene=${encodeURIComponent(scene)}`, '_blank');
    }
  };

  return (
    <>
      <div className="draw-toolbar">
        {/* 서브모드 토글 — 왼쪽 */}
        <div className="draw-toolbar-group">
          <button
            className={`draw-toolbar-btn${uiEditSubMode === 'window' ? ' active' : ''}`}
            onClick={() => setUiEditSubMode('window')}
          >
            창 편집
          </button>
          <button
            className={`draw-toolbar-btn${uiEditSubMode === 'frame' ? ' active' : ''}`}
            onClick={() => setUiEditSubMode('frame')}
          >
            프레임 편집
          </button>
          <button
            className={`draw-toolbar-btn${uiEditSubMode === 'cursor' ? ' active' : ''}`}
            onClick={() => setUiEditSubMode('cursor')}
          >
            커서 편집
          </button>
          <button
            className={`draw-toolbar-btn${uiEditSubMode === 'gauge' ? ' active' : ''}`}
            onClick={() => setUiEditSubMode('gauge')}
          >
            게이지 편집
          </button>
          <button
            className={`draw-toolbar-btn${uiEditSubMode === 'font' ? ' active' : ''}`}
            onClick={() => setUiEditSubMode('font')}
          >
            폰트 설정
          </button>
        </div>

        {/* 창 편집 전용 옵션 */}
        {uiEditSubMode === 'window' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* 커스텀 씬일 때만 네비게이션 시각화 표시 */}
            {uiEditorScene.startsWith('Scene_CS_') && (
              <label
                className="draw-toolbar-checkbox-label"
                title="위젯 간 방향키 네비게이션 연결선을 시각적으로 표시 (Unity 스타일)"
              >
                <input
                  type="checkbox"
                  checked={uiNavVisual}
                  onChange={(e) => setUiNavVisual(e.target.checked)}
                />
                🔗 Nav Visual
              </label>
            )}
            <label
              className="draw-toolbar-checkbox-label"
              title="선택된 창이 숨겨진 상태여도 강제로 보여줌"
            >
              <input
                type="checkbox"
                checked={forceShowSelected}
                onChange={(e) => setForceShowSelected(e.target.checked)}
              />
              선택 창 강제 표시
            </label>
            <label
              className="draw-toolbar-checkbox-label"
              title="선택된 창만 표시하고 나머지 창은 숨김"
            >
              <input
                type="checkbox"
                checked={showOnlySelected}
                onChange={(e) => setShowOnlySelected(e.target.checked)}
              />
              선택 창만 보기
            </label>
            <button
              className="ui-canvas-toolbar-btn"
              style={{ fontSize: 11, padding: '2px 8px', color: '#f88' }}
              disabled={!projectPath || uiEditorWindows.length === 0}
              onClick={handleResetScene}
              title="현재 씬 모든 창의 오버라이드를 삭제하고 RMMV 기본값으로 복원"
            >
              씬 레이아웃 초기화
            </button>
          </div>
        )}

        {/* 프레임/커서/게이지 편집 공통 옵션 */}
        {(uiEditSubMode === 'frame' || uiEditSubMode === 'cursor' || uiEditSubMode === 'gauge') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label className="draw-toolbar-checkbox-label" title="투명 영역을 체크무늬로 표시">
              <input
                type="checkbox"
                checked={uiShowCheckerboard}
                onChange={(e) => setUiShowCheckerboard(e.target.checked)}
              />
              체커보드
            </label>
            <label className="draw-toolbar-checkbox-label" title="영역별 컬러 오버레이 표시 (배경/프레임/커서)">
              <input
                type="checkbox"
                checked={uiShowRegionOverlay}
                onChange={(e) => setUiShowRegionOverlay(e.target.checked)}
              />
              영역 오버레이
            </label>
            <label className="draw-toolbar-checkbox-label">
              <input
                type="checkbox"
                checked={uiShowSkinLabels}
                onChange={(e) => setUiShowSkinLabels(e.target.checked)}
              />
              영역 라벨 표시
            </label>
            <button
              className="ui-help-trigger"
              onClick={() => setShowHelp(true)}
              title="영역 라벨이란?"
            >?</button>
          </div>
        )}

        <div className="draw-toolbar-spacer" />

        {/* 저장 / 플레이테스트 — 오른쪽 */}
        <button
          className={`draw-toolbar-save-btn${uiEditorDirty ? ' dirty' : ''}`}
          onClick={uiEditSubMode === 'font' ? handleFontSave : handleSave}
          disabled={!projectPath}
          title="저장 (Ctrl+S)"
        >
          저장{uiEditorDirty ? ' *' : ''}
        </button>

        <button
          className="draw-toolbar-play-btn"
          onClick={handlePlaytest}
          disabled={!projectPath}
          title="현재 맵에서 테스트 (Ctrl+R)"
        >
          ▶ 현재 맵에서 테스트
        </button>

        <button
          className="draw-toolbar-play-btn"
          onClick={handleUITest}
          disabled={!projectPath}
          title={`현재 UI 씬(${uiEditorScene}) 테스트`}
        >
          ▶ 현재 UI를 테스트
        </button>
      </div>

      {showHelp && <SkinLabelHelp onClose={() => setShowHelp(false)} />}
    </>
  );
}
