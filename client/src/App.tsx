import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import './components/ParseErrorsDialog.css';
import './components/common/Toast.css';
import useEditorStore from './store/useEditorStore';
import apiClient, { ApiError } from './api/client';
import { ToastItem } from './components/common/ToastItem';
import { useAutoUpdateCheck } from './hooks/useAutoUpdateCheck';
import MenuBar from './components/MenuBar/MenuBar';
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
import UpdateCheckDialog from './components/UpdateCheckDialog';
import MCPStatusDialog from './components/MCPStatusDialog';
import WebpConvertDialog from './components/WebpConvertDialog';
import PngConvertDialog from './components/PngConvertDialog';

import AutotileDebugDialog from './components/AutotileDebugDialog';
import SidebarSplit from './components/SidebarSplit';
import LightInspector from './components/Sidebar/LightInspector';
import ObjectInspector from './components/Sidebar/ObjectInspector';
import CameraZoneInspector from './components/Sidebar/CameraZoneInspector';
import MapInspector from './components/Sidebar/MapInspector';
import EventInspector from './components/Sidebar/EventInspector';
import PassageInspector from './components/Sidebar/PassageInspector';
import useFileWatcher from './hooks/useFileWatcher';
import useAutoSave from './hooks/useAutoSave';
import useDialogDrag from './hooks/useDialogDrag';
import i18n from './i18n';
import UIEditorCanvas from './components/UIEditor/UIEditorCanvas';
import UIEditorSidebar from './components/UIEditor/UIEditorSidebar';
import UIEditorInspector from './components/UIEditor/UIEditorInspector';
import UIEditorToolbar from './components/UIEditor/UIEditorToolbar';
import UIEditorFrameCanvas from './components/UIEditor/UIEditorFrameCanvas';
import UIEditorFrameInspector from './components/UIEditor/UIEditorFrameInspector';
import UIEditorCursorInspector from './components/UIEditor/UIEditorCursorInspector';
import UIEditorSkinPreview from './components/UIEditor/UIEditorSkinPreview';
import UIEditorFontEditor from './components/UIEditor/UIEditorFontEditor';
import UIEditorFontInspector from './components/UIEditor/UIEditorFontInspector';

export default function App() {
  const projectPath = useEditorStore((s) => s.projectPath);
  const currentMap = useEditorStore((s) => s.currentMap);
  const editMode = useEditorStore((s) => s.editMode);
  const editorMode = useEditorStore((s) => s.editorMode);
  const uiEditSubMode = useEditorStore((s) => s.uiEditSubMode);
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
  const showUpdateCheckDialog = useEditorStore((s) => s.showUpdateCheckDialog);
  const setShowUpdateCheckDialog = useEditorStore((s) => s.setShowUpdateCheckDialog);
  const showMCPStatusDialog = useEditorStore((s) => s.showMCPStatusDialog);
  const setShowMCPStatusDialog = useEditorStore((s) => s.setShowMCPStatusDialog);
  const showWebpConvertDialog = useEditorStore((s) => s.showWebpConvertDialog);
  const showPngConvertDialog = useEditorStore((s) => s.showPngConvertDialog);

  const toastQueue = useEditorStore((s) => s.toastQueue);
  const dismissToast = useEditorStore((s) => s.dismissToast);
  const dismissAllToasts = useEditorStore((s) => s.dismissAllToasts);
  const parseErrors = useEditorStore((s) => s.parseErrors);
  const rendererInitError = useEditorStore((s) => s.rendererInitError);
  const uninitializedProjectPath = useEditorStore((s) => s.uninitializedProjectPath);
  const setUninitializedProjectPath = useEditorStore((s) => s.setUninitializedProjectPath);
  const lightEditMode = useEditorStore((s) => s.lightEditMode);
  const [showAutotileDebug, setShowAutotileDebug] = useState(false);
  useFileWatcher();
  useAutoSave();
  useDialogDrag();
  const setShowOpenProjectDialog = useEditorStore((s) => s.setShowOpenProjectDialog);
  const openProject = useEditorStore((s) => s.openProject);
  const restoreLastProject = useEditorStore((s) => s.restoreLastProject);

  useEffect(() => {
    restoreLastProject();
  }, [restoreLastProject]);

  // 앱 시작 시 자동 업데이트 체크 (하루 한 번)
  useAutoUpdateCheck(useCallback(() => setShowUpdateCheckDialog(true), [setShowUpdateCheckDialog]));

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

  const handleOpenProject = async (projectPath: string) => {
    setShowOpenProjectDialog(false);

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
        setUninitializedProjectPath(projectPath);
        return;
      }
      // migration check 실패는 무시하고 계속
    }

    try {
      await openProject(projectPath);
      const name = useEditorStore.getState().projectName;
      addRecentProject(projectPath, name || '');
    } catch (err) {
      if (err instanceof ApiError && (err.body as Record<string, unknown>)?.errorCode === 'NOT_INITIALIZED') {
        setUninitializedProjectPath(projectPath);
      }
    }
  };

  return (
    <div className={`app-layout${editorMode === 'map' && currentMap ? ' with-inspector' : ''}${editorMode === 'ui' ? ' with-inspector' : ''}`}>
      <MenuBar />

      {editorMode === 'ui' ? (
        <>
          <div className="sidebar">
            <ResizablePanel defaultWidth={220} minWidth={150} maxWidth={400}>
              <UIEditorSidebar />
            </ResizablePanel>
          </div>
          <div className="toolbar-area">
            <UIEditorToolbar />
          </div>
          <div className="main-area" style={(uiEditSubMode === 'frame' || uiEditSubMode === 'cursor' || uiEditSubMode === 'font') ? { flexDirection: 'row' } : undefined}>
            {(uiEditSubMode === 'frame' || uiEditSubMode === 'cursor') ? (
              <>
                <UIEditorFrameCanvas />
                <ResizablePanel defaultWidth={240} minWidth={160} maxWidth={420} side="left">
                  <UIEditorSkinPreview />
                </ResizablePanel>
              </>
            ) : uiEditSubMode === 'font' ? (
              <UIEditorFontEditor />
            ) : <UIEditorCanvas />}
          </div>
          <div className="inspector-area">
            <ResizablePanel defaultWidth={280} minWidth={200} maxWidth={500} side="left">
              {uiEditSubMode === 'frame' ? <UIEditorFrameInspector /> :
               uiEditSubMode === 'cursor' ? <UIEditorCursorInspector /> :
               uiEditSubMode === 'font' ? <UIEditorFontInspector /> :
               <UIEditorInspector />}
            </ResizablePanel>
          </div>
        </>
      ) : (
        <>
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
        </>
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
      {uninitializedProjectPath && (
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
                경로: {uninitializedProjectPath}
              </p>
            </div>
            <div className="db-dialog-footer">
              <button className="db-btn" onClick={() => setUninitializedProjectPath(null)}>확인</button>
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
      {showWebpConvertDialog && <WebpConvertDialog />}
      {showPngConvertDialog && <PngConvertDialog />}
      {showOptionsDialog && <OptionsDialog />}
      {showLocalizationDialog && <LocalizationDialog />}
      {showUpdateCheckDialog && <UpdateCheckDialog onClose={() => setShowUpdateCheckDialog(false)} />}
      {showMCPStatusDialog && <MCPStatusDialog onClose={() => setShowMCPStatusDialog(false)} />}

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
            <ToastItem
              key={toast.createdAt}
              toast={toast}
              index={index}
              onDismiss={dismissToast}
            />
          ))}
          {toastQueue.length >= 2 && (
            <button
              className="toast-dismiss-all"
              style={{ bottom: `${40}px` }}
              onClick={dismissAllToasts}
            >
              모두 읽음
            </button>
          )}
        </div>
      )}
    </div>
  );
}
