import React, { useState } from 'react';
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
  const uiEditSubMode = useEditorStore((s) => s.uiEditSubMode);
  const uiEditorWindows = useEditorStore((s) => s.uiEditorWindows);
  const uiShowSkinLabels = useEditorStore((s) => s.uiShowSkinLabels);
  const uiShowCheckerboard = useEditorStore((s) => s.uiShowCheckerboard);
  const uiShowRegionOverlay = useEditorStore((s) => s.uiShowRegionOverlay);
  const projectPath = useEditorStore((s) => s.projectPath);
  const setUiEditSubMode = useEditorStore((s) => s.setUiEditSubMode);
  const setUiShowSkinLabels = useEditorStore((s) => s.setUiShowSkinLabels);
  const setUiShowCheckerboard = useEditorStore((s) => s.setUiShowCheckerboard);
  const setUiShowRegionOverlay = useEditorStore((s) => s.setUiShowRegionOverlay);

  const [showHelp, setShowHelp] = useState(false);

  const handleSave = async () => {
    if (!projectPath) return;
    try {
      const config = useEditorStore.getState().uiEditorOverrides;
      await fetch('/api/ui-editor/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: config }),
      });
      useEditorStore.getState().setUiEditorDirty(false);
      useEditorStore.getState().showToast('UI 테마 저장 완료');
    } catch {
      useEditorStore.getState().showToast('저장 실패', true);
    }
  };

  const handleResetScene = async () => {
    const s = useEditorStore.getState();
    // 현재 씬의 모든 창 오버라이드 제거
    uiEditorWindows.forEach((win) => s.resetUiEditorOverride(win.className));
    // 서버에 저장 (비어있는 overrides)
    const overrides = useEditorStore.getState().uiEditorOverrides;
    await fetch('/api/ui-editor/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides }),
    });
    s.setUiEditorDirty(false);
    // iframe 씬 재로드
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({ type: 'loadScene', sceneName: useEditorStore.getState().uiEditorScene }, '*');
    s.showToast('씬 초기화 완료 (원본으로 복원)');
  };

  const handlePlaytest = () => {
    if (!projectPath) return;
    const s = useEditorStore.getState();
    const mapId = s.currentMapId || 1;
    const testPos = s.currentMap?.testStartPosition;
    const centerX = Math.floor((s.currentMap?.width || 1) / 2);
    const centerY = Math.floor((s.currentMap?.height || 1) / 2);
    const startX = testPos ? testPos.x : centerX;
    const startY = testPos ? testPos.y : centerY;
    if (s.demoMode) {
      fetch('/api/playtestSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId, mapData: s.currentMap }),
      }).then(r => r.json()).then(({ sessionToken }) => {
        window.open(`/game/index.html?dev=true&startMapId=${mapId}&startX=${startX}&startY=${startY}&session=${sessionToken}`, '_blank');
      });
    } else {
      s.saveCurrentMap().then(() => {
        window.open(`/game/index.html?dev=true&startMapId=${mapId}&startX=${startX}&startY=${startY}`, '_blank');
      });
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
        </div>

        {/* 창 편집 전용 옵션 */}
        {uiEditSubMode === 'window' && (
          <button
            className="ui-canvas-toolbar-btn"
            style={{ fontSize: 11, padding: '2px 8px', color: '#f88' }}
            disabled={!projectPath || uiEditorWindows.length === 0}
            onClick={handleResetScene}
            title="현재 씬의 모든 창 수정을 원본으로 초기화"
          >
            씬 초기화
          </button>
        )}

        {/* 프레임 편집 전용 옵션 */}
        {uiEditSubMode === 'frame' && (
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
          onClick={handleSave}
          disabled={!projectPath}
          title="UI 테마 저장 (Ctrl+S)"
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
      </div>

      {showHelp && <SkinLabelHelp onClose={() => setShowHelp(false)} />}
    </>
  );
}
