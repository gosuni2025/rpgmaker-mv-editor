import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useEditorStore from '../../store/useEditorStore';
import apiClient, { ApiError } from '../../api/client';
import { getRecentProjects, removeRecentProject } from '../OpenProjectDialog';
import { useMenuBarKeyboard } from './useMenuBarKeyboard';
import { useMenuBarMenus } from './useMenuBarMenus';
import { CreditDialog } from './CreditDialog';
import './MenuBar.css';
import '../UIEditor/UIEditor.css';

export default function MenuBar() {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    projectPath, editMode, editorMode, selectedTool, drawShape,
    undoStack, redoStack, demoMode,
    setEditorMode, setEditMode, setSelectedTool, setDrawShape,
    zoomIn, zoomOut, zoomActualSize, undo, redo,
    saveCurrentMap, closeProject, openProject, setUninitializedProjectPath,
    setShowOpenProjectDialog, setShowNewProjectDialog, setShowDatabaseDialog,
    setShowDeployDialog, setShowFindDialog, setShowPluginManagerDialog,
    setShowSoundTestDialog, setShowEventSearchDialog, setShowResourceManagerDialog,
    setShowCharacterGeneratorDialog, setShowOptionsDialog, setShowLocalizationDialog,
    setShowUpdateCheckDialog, setShowMCPStatusDialog, setShowWebpConvertDialog, setShowPngConvertDialog,
    showToast, currentMapId, selectMap,
  } = useEditorStore(useShallow(s => ({
    projectPath: s.projectPath,
    editMode: s.editMode, editorMode: s.editorMode,
    selectedTool: s.selectedTool, drawShape: s.drawShape,
    undoStack: s.undoStack, redoStack: s.redoStack,
    demoMode: s.demoMode,
    setEditorMode: s.setEditorMode, setEditMode: s.setEditMode,
    setSelectedTool: s.setSelectedTool, setDrawShape: s.setDrawShape,
    zoomIn: s.zoomIn, zoomOut: s.zoomOut, zoomActualSize: s.zoomActualSize,
    undo: s.undo, redo: s.redo,
    saveCurrentMap: s.saveCurrentMap, closeProject: s.closeProject,
    openProject: s.openProject, setUninitializedProjectPath: s.setUninitializedProjectPath,
    setShowOpenProjectDialog: s.setShowOpenProjectDialog,
    setShowNewProjectDialog: s.setShowNewProjectDialog,
    setShowDatabaseDialog: s.setShowDatabaseDialog,
    setShowDeployDialog: s.setShowDeployDialog,
    setShowFindDialog: s.setShowFindDialog,
    setShowPluginManagerDialog: s.setShowPluginManagerDialog,
    setShowSoundTestDialog: s.setShowSoundTestDialog,
    setShowEventSearchDialog: s.setShowEventSearchDialog,
    setShowResourceManagerDialog: s.setShowResourceManagerDialog,
    setShowCharacterGeneratorDialog: s.setShowCharacterGeneratorDialog,
    setShowOptionsDialog: s.setShowOptionsDialog,
    setShowLocalizationDialog: s.setShowLocalizationDialog,
    setShowUpdateCheckDialog: s.setShowUpdateCheckDialog,
    setShowMCPStatusDialog: s.setShowMCPStatusDialog,
    setShowWebpConvertDialog: s.setShowWebpConvertDialog,
    setShowPngConvertDialog: s.setShowPngConvertDialog,
    showToast: s.showToast,
    currentMapId: s.currentMapId,
    selectMap: s.selectMap,
  })));

  const hasProject = !!projectPath;
  const [showTileIdOverlay, setShowTileIdOverlay] = useState(false);
  const [showCreditDialog, setShowCreditDialog] = useState(false);

  const menus = useMenuBarMenus({
    hasProject, demoMode, editMode, selectedTool, drawShape,
    undoStack, redoStack, showTileIdOverlay,
  });

  const handleAction = useCallback((action: string) => {
    setOpenMenu(null);
    if (action.startsWith('recent:')) {
      const recentPath = action.slice(7);
      apiClient.get<{ exists: boolean }>(`/project/check-path?path=${encodeURIComponent(recentPath)}`).then(res => {
        if (res.exists) {
          openProject(recentPath).catch((err) => {
            if (err instanceof ApiError && (err.body as Record<string, unknown>)?.errorCode === 'NOT_INITIALIZED') {
              setUninitializedProjectPath(recentPath);
            }
          });
        } else {
          removeRecentProject(recentPath);
          alert('프로젝트를 찾을 수 없습니다');
        }
      }).catch(() => {});
      return;
    }
    switch (action) {
      case 'newProject': setShowNewProjectDialog(true); break;
      case 'openProject': setShowOpenProjectDialog(true); break;
      case 'closeProject': closeProject(); break;
      case 'save':
        if (editorMode === 'ui') {
          const s = useEditorStore.getState();
          if (s.uiEditSubMode === 'frame') {
            if (!s.uiSelectedSkin) break;
            fetch(`/api/ui-editor/skins/${encodeURIComponent(s.uiSelectedSkin)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cornerSize: s.uiSkinCornerSize,
                frameX: s.uiSkinFrameX, frameY: s.uiSkinFrameY, frameW: s.uiSkinFrameW, frameH: s.uiSkinFrameH,
                fillX: s.uiSkinFillX, fillY: s.uiSkinFillY, fillW: s.uiSkinFillW, fillH: s.uiSkinFillH,
                useCenterFill: s.uiSkinUseCenterFill,
                cursorX: s.uiSkinCursorX, cursorY: s.uiSkinCursorY, cursorW: s.uiSkinCursorW, cursorH: s.uiSkinCursorH,
                cursorCornerSize: s.uiSkinCursorCornerSize,
                cursorRenderMode: s.uiSkinCursorRenderMode, cursorBlendMode: s.uiSkinCursorBlendMode,
                cursorOpacity: s.uiSkinCursorOpacity, cursorBlink: s.uiSkinCursorBlink,
                cursorPadding: s.uiSkinCursorPadding,
                cursorToneR: s.uiSkinCursorToneR, cursorToneG: s.uiSkinCursorToneG, cursorToneB: s.uiSkinCursorToneB,
              }),
            }).then(() => {
              s.setUiEditorDirty(false);
              s.triggerSkinsReload();
              s.showToast('스킨 설정 저장 완료');
            }).catch(() => s.showToast('저장 실패', true));
          } else {
            fetch('/api/ui-editor/config', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ overrides: s.uiEditorOverrides, sceneRedirects: s.sceneRedirects }),
            }).then(() => {
              s.setUiEditorDirty(false);
              s.showToast('UI 테마 저장 완료');
            }).catch(() => s.showToast('저장 실패', true));
          }
        } else {
          saveCurrentMap();
        }
        break;
      case 'deploy': setShowDeployDialog(true); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'cut': window.dispatchEvent(new CustomEvent('editor-cut')); break;
      case 'copy': window.dispatchEvent(new CustomEvent('editor-copy')); break;
      case 'paste': window.dispatchEvent(new CustomEvent('editor-paste')); break;
      case 'delete': window.dispatchEvent(new CustomEvent('editor-delete')); break;
      case 'find': setShowFindDialog(true); break;
      case 'modeMap': setEditMode('map'); break;
      case 'modeEvent': setEditMode('event'); break;
      case 'modeLight': setEditMode('light'); break;
      case 'modeObject': setEditMode('object'); break;
      case 'modeCameraZone': setEditMode('cameraZone'); break;
      case 'modePassage': setEditMode('passage'); break;
      case 'toolSelect': setSelectedTool('select'); break;
      case 'toolPen': setSelectedTool('pen'); break;
      case 'toolEraser': setSelectedTool('eraser'); break;
      case 'toolRectangle': setDrawShape('rectangle'); break;
      case 'toolEllipse': setDrawShape('ellipse'); break;
      case 'toolFill': setDrawShape('fill'); break;
      case 'toolShadow': setSelectedTool('shadow'); break;
      case 'zoomIn': zoomIn(); break;
      case 'zoomOut': zoomOut(); break;
      case 'zoomActual': zoomActualSize(); break;
      case 'database': setShowDatabaseDialog(true); break;
      case 'pluginManager': setShowPluginManagerDialog(true); break;
      case 'soundTest': setShowSoundTestDialog(true); break;
      case 'eventSearch': setShowEventSearchDialog(true); break;
      case 'characterGenerator': setShowCharacterGeneratorDialog(true); break;
      case 'resourceManager': setShowResourceManagerDialog(true); break;
      case 'convertToWebp': setShowWebpConvertDialog(true); break;
      case 'convertToPng': setShowPngConvertDialog(true); break;
      case 'playtestTitle': saveCurrentMap().then(() => window.open('/game/index.html?dev=true', '_blank')); break;
      case 'playtestTitlePixi': saveCurrentMap().then(() => window.open('/game/index_pixi.html', '_blank')); break;
      case 'playtestCurrentMapPixi': {
        const state = useEditorStore.getState();
        const mapId = state.currentMapId || 1;
        const testPos = state.currentMap?.testStartPosition;
        const centerX = Math.floor((state.currentMap?.width || 1) / 2);
        const centerY = Math.floor((state.currentMap?.height || 1) / 2);
        const startX = testPos ? testPos.x : centerX;
        const startY = testPos ? testPos.y : centerY;
        saveCurrentMap().then(() => {
          window.open(`/game/index_pixi.html?startMapId=${mapId}&startX=${startX}&startY=${startY}`, '_blank');
        });
        break;
      }
      case 'playtestCurrentMap': {
        const state = useEditorStore.getState();
        const mapId = state.currentMapId || 1;
        const testPos = state.currentMap?.testStartPosition;
        const centerX = Math.floor((state.currentMap?.width || 1) / 2);
        const centerY = Math.floor((state.currentMap?.height || 1) / 2);
        const startX = testPos ? testPos.x : centerX;
        const startY = testPos ? testPos.y : centerY;
        if (demoMode) {
          // 데모 모드: 디스크 저장 없이 인메모리 세션으로 플레이테스트
          fetch('/api/playtestSession', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mapId, mapData: state.currentMap }),
          }).then(r => r.json()).then(({ sessionToken }) => {
            window.open(`/game/index.html?dev=true&startMapId=${mapId}&startX=${startX}&startY=${startY}&session=${sessionToken}`, '_blank');
          });
        } else {
          saveCurrentMap().then(() => {
            window.open(`/game/index.html?dev=true&startMapId=${mapId}&startX=${startX}&startY=${startY}`, '_blank');
          });
        }
        break;
      }
      case 'openFolder': fetch('/api/project/open-folder', { method: 'POST' }); break;
      case 'openProjectFolderTerminal': fetch('/api/project/open-folder-terminal', { method: 'POST' }); break;
      case 'openEditorFolder': fetch('/api/project/open-editor-folder', { method: 'POST' }); break;
      case 'openEditorFolderTerminal': fetch('/api/project/open-editor-folder-terminal', { method: 'POST' }); break;
      case 'copyPath': if (projectPath) navigator.clipboard.writeText(projectPath); break;
      case 'openVscode': fetch('/api/project/open-vscode', { method: 'POST' }); break;
      case 'selectAll': window.dispatchEvent(new CustomEvent('editor-selectall')); break;
      case 'deselect': window.dispatchEvent(new CustomEvent('editor-deselect')); break;
      case 'autotileDebug': window.dispatchEvent(new CustomEvent('editor-autotile-debug')); break;
      case 'tileIdDebug': {
        const next = !showTileIdOverlay;
        setShowTileIdOverlay(next);
        window.dispatchEvent(new CustomEvent('editor-toggle-tileid', { detail: next }));
        break;
      }
      case 'migrate': window.dispatchEvent(new CustomEvent('editor-migrate')); break;
      case 'migrateEvents': {
        if (!confirm('전체 맵의 이벤트 실행 내용(commands)을 외부 파일로 분리합니다.\n이미 분리된 이벤트는 건너뜁니다.\n계속하시겠습니까?')) break;
        saveCurrentMap().then(() =>
          fetch('/api/maps/migrate-events', { method: 'POST' })
            .then(r => r.json())
            .then((result: { migratedMaps: number; migratedEvents: number }) => {
              showToast(`완료: ${result.migratedMaps}개 맵, ${result.migratedEvents}개 이벤트 외부 파일로 분리`);
              if (currentMapId) selectMap(currentMapId);
            })
        );
        break;
      }
      case 'unmigrateEvents': {
        if (!confirm('외부 파일로 분리된 이벤트를 모두 맵 파일 안으로 복구합니다.\n계속하시겠습니까?')) break;
        saveCurrentMap().then(() =>
          fetch('/api/maps/unmigrate-events', { method: 'POST' })
            .then(r => r.json())
            .then((result: { unmigratedMaps: number; unmigratedEvents: number }) => {
              showToast(`완료: ${result.unmigratedMaps}개 맵, ${result.unmigratedEvents}개 이벤트 인라인으로 복구`);
              if (currentMapId) selectMap(currentMapId);
            })
        );
        break;
      }
      case 'fogOfWarTest': window.open('/fogofwar', '_blank'); break;
      case 'fogVolume3dTest': window.open('/fogvolume3d', '_blank'); break;
      case 'silhouetteTest': window.open('/silhouette', '_blank'); break;
      case 'parallaxUVTest': window.open('/parallaxuv', '_blank'); break;
      case 'options': setShowOptionsDialog(true); break;
      case 'localization': setShowLocalizationDialog(true); break;
      case 'checkUpdate': setShowUpdateCheckDialog(true); break;
      case 'homepage': window.open('https://github.com/gosuni2025/rpgmaker-mv-editor', '_blank'); break;
      case 'reportIssue': window.open('https://github.com/gosuni2025/rpgmaker-mv-editor/issues', '_blank'); break;
      case 'twitter': window.open('https://x.com/gosuni2025', '_blank'); break;
      case 'youtube': window.open('https://www.youtube.com/@gosuni2025', '_blank'); break;
      case 'mcpStatus': setShowMCPStatusDialog(true); break;
      case 'mcpManual': window.open('https://github.com/gosuni2025/rpgmaker-mv-editor/blob/main/docs/mcp-setup.md', '_blank'); break;
      case 'credits': setShowCreditDialog(true); break;
    }
  }, [setShowOpenProjectDialog, setShowNewProjectDialog, saveCurrentMap, closeProject,
      setShowDatabaseDialog, setShowDeployDialog, setShowFindDialog, setShowPluginManagerDialog,
      setShowSoundTestDialog, setShowEventSearchDialog, setShowResourceManagerDialog,
      setShowCharacterGeneratorDialog, setShowOptionsDialog, setShowLocalizationDialog,
      setShowUpdateCheckDialog, setShowMCPStatusDialog, setEditMode, setSelectedTool, setDrawShape, zoomIn, zoomOut,
      zoomActualSize, undo, redo, openProject, projectPath, showTileIdOverlay,
      showToast, currentMapId, selectMap]);

  useMenuBarKeyboard(handleAction);

  useEffect(() => {
    if (openMenu === null) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenu]);

  const renderMenuItems = (items: ReturnType<typeof useMenuBarMenus>[0]['items']) =>
    items.map((item, j) =>
      item.type === 'separator' ? (
        <div key={j} className="menubar-separator" />
      ) : item.children ? (
        <div key={item.label} className="menubar-dropdown-item menubar-submenu">
          <span className="menubar-check" />
          <span className="menubar-item-label">{item.label}</span>
          <span className="menubar-submenu-arrow">▶</span>
          <div className="menubar-dropdown menubar-dropdown-sub">
            {renderMenuItems(item.children)}
          </div>
        </div>
      ) : (
        <div
          key={item.label}
          className={`menubar-dropdown-item${item.disabled?.() ? ' disabled' : ''}`}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (!item.disabled?.() && item.action) handleAction(item.action);
          }}
        >
          <span className="menubar-check">{item.checked?.() ? '\u2713' : ''}</span>
          <span className="menubar-item-label">{item.label}</span>
          {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
        </div>
      )
    );

  return (
    <>
    {showCreditDialog && <CreditDialog onClose={() => setShowCreditDialog(false)} />}
    <div className="menubar" ref={menuRef}>
      {menus.map((menu, i) => (
        <div
          key={menu.label}
          className="menubar-item"
          onMouseDown={() => setOpenMenu(openMenu === i ? null : i)}
          onMouseEnter={() => openMenu !== null && setOpenMenu(i)}
        >
          {menu.label}
          {openMenu === i && (
            <div className="menubar-dropdown">
              {renderMenuItems(menu.items)}
            </div>
          )}
        </div>
      ))}
      <div className="menubar-mode-toggle">
        <button
          className={`menubar-mode-btn${editorMode === 'map' ? ' active' : ''}`}
          onMouseDown={(e) => { e.stopPropagation(); setEditorMode('map'); }}
          title="맵 편집 모드"
        >
          맵
        </button>
        <button
          className={`menubar-mode-btn${editorMode === 'ui' ? ' active' : ''}`}
          onMouseDown={(e) => { e.stopPropagation(); setEditorMode('ui'); }}
          title="UI 편집 모드"
        >
          UI
        </button>
      </div>
    </div>
    </>
  );
}
