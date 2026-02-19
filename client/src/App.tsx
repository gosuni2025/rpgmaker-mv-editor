import React, { useEffect, useState, useRef, useCallback } from 'react';
import './App.css';
import './components/ParseErrorsDialog.css';
import './components/common/Toast.css';
import useEditorStore from './store/useEditorStore';
import apiClient, { ApiError } from './api/client';
import MenuBar from './components/MenuBar/MenuBar';
import MapTree from './components/Sidebar/MapTree';
import TilesetPalette from './components/Sidebar/TilesetPalette';
import ResizablePanel from './components/common/ResizablePanel';
import StatusBar from './components/common/StatusBar';
import DatabaseDialog from './components/Database/DatabaseDialog';
import OpenProjectDialog from './components/OpenProjectDialog';
import { addRecentProject } from './components/OpenProjectDialog';
import MapCanvas from './components/MapEditor/MapCanvas';
import DrawToolbar from './components/MapEditor/DrawToolbar';
import NewProjectDialog from './components/NewProjectDialog';
import MigrationDialog from './components/MigrationDialog';
import DeployDialog from './components/DeployDialog';
import FindDialog from './components/FindDialog';
import PluginManagerDialog from './components/PluginManagerDialog';
import SoundTestDialog from './components/SoundTestDialog';
import EventSearchDialog from './components/EventSearchDialog';
import ResourceManagerDialog from './components/ResourceManagerDialog';
import CharacterGeneratorDialog from './components/CharacterGenerator/CharacterGeneratorDialog';
import OptionsDialog from './components/OptionsDialog';
import LocalizationDialog from './components/LocalizationDialog';

import AutotileDebugDialog from './components/AutotileDebugDialog';
import LightInspector from './components/Sidebar/LightInspector';
import ObjectInspector from './components/Sidebar/ObjectInspector';
import CameraZoneInspector from './components/Sidebar/CameraZoneInspector';
import CameraZoneListPanel from './components/Sidebar/CameraZoneListPanel';
import ObjectListPanel from './components/Sidebar/ObjectListPanel';
import MapInspector from './components/Sidebar/MapInspector';
import EventInspector from './components/Sidebar/EventInspector';
import PassageInspector from './components/Sidebar/PassageInspector';
import useFileWatcher from './hooks/useFileWatcher';
import useAutoSave from './hooks/useAutoSave';
import i18n from './i18n';

function SidebarSplit({ editMode }: { editMode: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const dragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = (ev.clientY - rect.top) / rect.height;
      setSplitRatio(Math.max(0.15, Math.min(0.85, ratio)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const showTileset = editMode === 'map' || editMode === 'light';
  const showCameraZoneList = editMode === 'cameraZone';
  const showObjectList = editMode === 'object';
  const showTopPanel = showTileset || showCameraZoneList || showObjectList;

  const topContent = showCameraZoneList
    ? <CameraZoneListPanel />
    : showObjectList
    ? <ObjectListPanel />
    : <TilesetPalette />;

  const bottomContent = showObjectList
    ? <TilesetPalette />
    : <MapTree />;

  return (
    <div className="sidebar-split" ref={containerRef}>
      {showTopPanel && (
        <div className="sidebar-top" style={{ flex: `0 0 ${splitRatio * 100}%` }}>
          {topContent}
        </div>
      )}
      {showTopPanel && (
        <div className="sidebar-split-handle" onMouseDown={handleMouseDown} />
      )}
      <div className="sidebar-bottom" style={showTopPanel ? { flex: `0 0 ${(1 - splitRatio) * 100}%` } : { flex: 1 }}>
        {bottomContent}
      </div>
    </div>
  );
}

export default function App() {
  const projectPath = useEditorStore((s) => s.projectPath);
  const currentMap = useEditorStore((s) => s.currentMap);
  const editMode = useEditorStore((s) => s.editMode);
  const showDatabaseDialog = useEditorStore((s) => s.showDatabaseDialog);
  const showOpenProjectDialog = useEditorStore((s) => s.showOpenProjectDialog);
  const showNewProjectDialog = useEditorStore((s) => s.showNewProjectDialog);
  const showDeployDialog = useEditorStore((s) => s.showDeployDialog);
  const showFindDialog = useEditorStore((s) => s.showFindDialog);
  const showPluginManagerDialog = useEditorStore((s) => s.showPluginManagerDialog);
  const showSoundTestDialog = useEditorStore((s) => s.showSoundTestDialog);
  const showEventSearchDialog = useEditorStore((s) => s.showEventSearchDialog);
  const showResourceManagerDialog = useEditorStore((s) => s.showResourceManagerDialog);
  const showCharacterGeneratorDialog = useEditorStore((s) => s.showCharacterGeneratorDialog);
  const showOptionsDialog = useEditorStore((s) => s.showOptionsDialog);
  const showLocalizationDialog = useEditorStore((s) => s.showLocalizationDialog);

  const toastQueue = useEditorStore((s) => s.toastQueue);
  const dismissToast = useEditorStore((s) => s.dismissToast);
  const parseErrors = useEditorStore((s) => s.parseErrors);
  const rendererInitError = useEditorStore((s) => s.rendererInitError);
  const lightEditMode = useEditorStore((s) => s.lightEditMode);
  const [showAutotileDebug, setShowAutotileDebug] = useState(false);
  useFileWatcher();
  useAutoSave();
  const setShowOpenProjectDialog = useEditorStore((s) => s.setShowOpenProjectDialog);
  const openProject = useEditorStore((s) => s.openProject);
  const restoreLastProject = useEditorStore((s) => s.restoreLastProject);

  useEffect(() => {
    restoreLastProject();
  }, [restoreLastProject]);

  // 서버에서 에디터 설정 로드
  useEffect(() => {
    apiClient.get<{
      language: string;
      transparentColor: { r: number; g: number; b: number };
      maxUndo: number;
      zoomStep: number;
    }>('/settings').then((data) => {
      const store = useEditorStore.getState();
      if (data.transparentColor) store.setTransparentColor(data.transparentColor);
      if (data.maxUndo) store.setMaxUndo(data.maxUndo);
      if (data.zoomStep) store.setZoomStep(data.zoomStep);
      if (data.language && data.language !== i18n.language) {
        i18n.changeLanguage(data.language);
      }
    }).catch(() => {});
  }, []);

  // 브라우저 기본 컨텍스트 메뉴 차단
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  // 다이얼로그 오버레이 내부 키 이벤트가 뒤쪽 맵 에디터(window 레벨 리스너)로 전파되지 않도록 차단
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.db-dialog-overlay')) return;
      // Ctrl/Meta 조합, F1~F12 등 전역 단축키는 MenuBar에서 처리하므로 통과
      if (e.ctrlKey || e.metaKey || e.key.startsWith('F') && e.key.length <= 3) return;
      e.stopPropagation();
    };
    // document bubble phase: window 리스너(MenuBar, useKeyboardShortcuts)보다 먼저 실행됨
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = () => setShowAutotileDebug(true);
    window.addEventListener('editor-autotile-debug', handler);
    return () => window.removeEventListener('editor-autotile-debug', handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      const pp = useEditorStore.getState().projectPath;
      if (pp) setMigrationPath(pp);
    };
    window.addEventListener('editor-migrate', handler);
    return () => window.removeEventListener('editor-migrate', handler);
  }, []);

  const [migrationPath, setMigrationPath] = useState<string | null>(null);
  const [uninitializedProject, setUninitializedProject] = useState<string | null>(null);

  const handleOpenProject = async (projectPath: string) => {
    setShowOpenProjectDialog(false);

    const doOpen = async () => {
      try {
        const res = await apiClient.get<{ needsMigration: boolean }>(
          `/project/migration-check?path=${encodeURIComponent(projectPath)}`
        );
        if (res.needsMigration) {
          // Open the project first (so migrate API works), then show dialog
          await openProject(projectPath);
          const name = useEditorStore.getState().projectName;
          addRecentProject(projectPath, name || '');
          setMigrationPath(projectPath);
          return;
        }
      } catch (err) {
        if (err instanceof ApiError && (err.body as Record<string, unknown>)?.errorCode === 'NOT_INITIALIZED') {
          throw err;
        }
        // If migration check fails for other reasons, just open normally
      }
      await openProject(projectPath);
      const name = useEditorStore.getState().projectName;
      addRecentProject(projectPath, name || '');
    };

    try {
      await doOpen();
    } catch (err) {
      if (err instanceof ApiError && (err.body as Record<string, unknown>)?.errorCode === 'NOT_INITIALIZED') {
        setUninitializedProject(projectPath);
      }
    }
  };

  return (
    <div className={`app-layout${currentMap ? ' with-inspector' : ''}`}>
      <MenuBar />

      <div className="sidebar">
        <ResizablePanel defaultWidth={260} minWidth={150} maxWidth={500}>
          <SidebarSplit editMode={editMode} />
        </ResizablePanel>
      </div>

      {currentMap && (
        <div className="toolbar-area">
          <DrawToolbar />
        </div>
      )}

      <div className="main-area">
        {!projectPath ? (
          <div className="main-placeholder">
            <h2>RPG Maker MV Editor</h2>
            <p>파일 &gt; 프로젝트 열기로 프로젝트를 열어주세요</p>
          </div>
        ) : !currentMap ? (
          <div className="main-placeholder">
            <p>맵을 선택해주세요</p>
          </div>
        ) : (
          <MapCanvas />
        )}
      </div>

      {currentMap && (
        <div className="inspector-area">
          <ResizablePanel defaultWidth={280} minWidth={200} maxWidth={500} side="left">
            {editMode === 'event' ? <EventInspector />
              : editMode === 'object' ? <ObjectInspector />
              : editMode === 'cameraZone' ? <CameraZoneInspector />
              : editMode === 'passage' ? <PassageInspector />
              : lightEditMode ? <LightInspector />
              : <MapInspector />}
          </ResizablePanel>
        </div>
      )}

      <StatusBar />

      {showOpenProjectDialog && (
        <OpenProjectDialog
          onOpen={handleOpenProject}
          onClose={() => setShowOpenProjectDialog(false)}
        />
      )}
      {showNewProjectDialog && <NewProjectDialog />}
      {migrationPath && (
        <MigrationDialog
          projectPath={migrationPath}
          onComplete={() => setMigrationPath(null)}
          onSkip={() => setMigrationPath(null)}
        />
      )}
      {uninitializedProject && (
        <div className="db-dialog-overlay">
          <div className="db-dialog" style={{ maxWidth: 480 }}>
            <div className="db-dialog-header">프로젝트를 열 수 없습니다</div>
            <div className="db-dialog-body" style={{ padding: '20px 24px', lineHeight: 1.7 }}>
              <p>이 프로젝트는 <strong>RPG Maker MV에서 한번도 실행되지 않은</strong> 프로젝트입니다.</p>
              <p style={{ marginTop: 12 }}>
                RPG Maker MV 에디터에서 해당 프로젝트를 열고<br />
                플레이테스트 (<strong>Ctrl+P</strong> 또는 게임 메뉴 &gt; 플레이테스트)를<br />
                <strong>1회 실행</strong>한 후 다시 시도해주세요.
              </p>
              <p style={{ marginTop: 12, color: '#aaa', fontSize: '0.85em' }}>
                경로: {uninitializedProject}
              </p>
            </div>
            <div className="db-dialog-footer">
              <button className="db-btn" onClick={() => setUninitializedProject(null)}>확인</button>
            </div>
          </div>
        </div>
      )}
      {showDatabaseDialog && <DatabaseDialog />}
      {showDeployDialog && <DeployDialog />}
      {showFindDialog && <FindDialog />}
      {showPluginManagerDialog && <PluginManagerDialog />}
      {showSoundTestDialog && <SoundTestDialog />}
      {showEventSearchDialog && <EventSearchDialog />}
      {showResourceManagerDialog && <ResourceManagerDialog />}
      {showCharacterGeneratorDialog && <CharacterGeneratorDialog />}
      {showOptionsDialog && <OptionsDialog />}
      {showLocalizationDialog && <LocalizationDialog />}

      <AutotileDebugDialog open={showAutotileDebug} onClose={() => setShowAutotileDebug(false)} />
      {parseErrors && parseErrors.length > 0 && (
        <div className="db-dialog-overlay">
          <div className="db-dialog parse-errors-dialog">
            <div className="db-dialog-header">
              <span>데이터 파싱 오류</span>
              <button className="db-dialog-close" onClick={() => useEditorStore.setState({ parseErrors: null })}>×</button>
            </div>
            <div className="parse-errors-body">
              <p className="parse-errors-summary">프로젝트 데이터 파일 {parseErrors.length}개에서 JSON 파싱 오류가 발견되었습니다.</p>
              <div className="parse-errors-list">
                {parseErrors.map((err, i) => (
                  <div key={i} className="parse-error-item">
                    <span className="parse-error-file">{err.file}</span>
                    <span className="parse-error-msg">{err.error}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {rendererInitError && (
        <div className="db-dialog-overlay">
          <div className="db-dialog renderer-error-dialog">
            <div className="db-dialog-header">
              <span>⚠ {rendererInitError.title}</span>
              <button className="db-dialog-close" onClick={() => useEditorStore.setState({ rendererInitError: null })}>×</button>
            </div>
            <div className="renderer-error-body">
              <div className="renderer-error-section">
                <div className="renderer-error-label">오류 내용</div>
                <pre className="renderer-error-details">{rendererInitError.details}</pre>
              </div>
              <div className="renderer-error-section">
                <div className="renderer-error-label">WebGL 지원 상태</div>
                <code className="renderer-error-code">{rendererInitError.webglSupport}</code>
              </div>
              <div className="renderer-error-section">
                <div className="renderer-error-label">브라우저 정보</div>
                <code className="renderer-error-code">{rendererInitError.browserInfo}</code>
              </div>
              {rendererInitError.originalError && (
                <div className="renderer-error-section">
                  <div className="renderer-error-label">원본 에러</div>
                  <pre className="renderer-error-stack">{rendererInitError.originalError}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {toastQueue.length > 0 && (
        <div className="toast-container">
          {toastQueue.map((toast, index) => (
            <div
              key={toast.id}
              className={`toast ${toast.persistent ? 'toast-persistent' : ''}`}
              style={{ bottom: `${40 + index * 44}px` }}
              onAnimationEnd={(e) => {
                if (e.animationName === 'toast-fade') {
                  dismissToast(toast.id);
                }
              }}
            >
              {toast.message}
              {toast.persistent && (
                <button className="toast-close" onClick={() => dismissToast(toast.id)}>&times;</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
