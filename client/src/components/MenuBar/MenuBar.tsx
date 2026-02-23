import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import useEditorStore from '../../store/useEditorStore';
import apiClient, { ApiError } from '../../api/client';
import { getRecentProjects, removeRecentProject } from '../OpenProjectDialog';
import { useMenuBarKeyboard } from './useMenuBarKeyboard';
import './MenuBar.css';
import '../UIEditor/UIEditor.css';

interface MenuItem {
  label?: string;
  action?: string;
  shortcut?: string;
  type?: string;
  checked?: () => boolean;
  disabled?: () => boolean;
  children?: MenuItem[];
}

interface Menu {
  label: string;
  items: MenuItem[];
}

export default function MenuBar() {
  const { t } = useTranslation();
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const projectPath = useEditorStore((s) => s.projectPath);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const editMode = useEditorStore((s) => s.editMode);
  const editorMode = useEditorStore((s) => s.editorMode);
  const setEditorMode = useEditorStore((s) => s.setEditorMode);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const drawShape = useEditorStore((s) => s.drawShape);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);

  const setShowOpenProjectDialog = useEditorStore((s) => s.setShowOpenProjectDialog);
  const setShowNewProjectDialog = useEditorStore((s) => s.setShowNewProjectDialog);
  const saveCurrentMap = useEditorStore((s) => s.saveCurrentMap);
  const closeProject = useEditorStore((s) => s.closeProject);
  const demoMode = useEditorStore((s) => s.demoMode);
  const setShowDatabaseDialog = useEditorStore((s) => s.setShowDatabaseDialog);
  const setShowDeployDialog = useEditorStore((s) => s.setShowDeployDialog);
  const setShowFindDialog = useEditorStore((s) => s.setShowFindDialog);
  const setShowPluginManagerDialog = useEditorStore((s) => s.setShowPluginManagerDialog);
  const setShowSoundTestDialog = useEditorStore((s) => s.setShowSoundTestDialog);
  const setShowEventSearchDialog = useEditorStore((s) => s.setShowEventSearchDialog);
  const setShowResourceManagerDialog = useEditorStore((s) => s.setShowResourceManagerDialog);
  const setShowCharacterGeneratorDialog = useEditorStore((s) => s.setShowCharacterGeneratorDialog);
  const setShowOptionsDialog = useEditorStore((s) => s.setShowOptionsDialog);
  const setShowLocalizationDialog = useEditorStore((s) => s.setShowLocalizationDialog);
  const setShowUpdateCheckDialog = useEditorStore((s) => s.setShowUpdateCheckDialog);
  const setShowMCPStatusDialog = useEditorStore((s) => s.setShowMCPStatusDialog);
  const setShowWebpConvertDialog = useEditorStore((s) => s.setShowWebpConvertDialog);
  const useWebp = useEditorStore((s) => s.useWebp);

  const setEditMode = useEditorStore((s) => s.setEditMode);
  const setSelectedTool = useEditorStore((s) => s.setSelectedTool);
  const setDrawShape = useEditorStore((s) => s.setDrawShape);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const zoomActualSize = useEditorStore((s) => s.zoomActualSize);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const hasProject = !!projectPath;
  const openProject = useEditorStore((s) => s.openProject);
  const setUninitializedProjectPath = useEditorStore((s) => s.setUninitializedProjectPath);
  const [showTileIdOverlay, setShowTileIdOverlay] = useState(false);

  const recentProjects = getRecentProjects().slice(0, 10);
  const recentItems: MenuItem[] = recentProjects.length > 0
    ? recentProjects.map((p) => ({
        label: `${p.name || p.path.split('/').pop()} — ${p.path}`,
        action: `recent:${p.path}`,
      }))
    : [{ label: t('menu.noRecentProjects'), disabled: () => true }];

  const menus: Menu[] = [
    {
      label: t('menu.file'),
      items: [
        { label: t('menu.newProject'), action: 'newProject', disabled: () => demoMode },
        { label: t('menu.openProject'), action: 'openProject', disabled: () => demoMode },
        { label: t('menu.closeProject'), action: 'closeProject', disabled: () => !hasProject || demoMode },
        { type: 'separator' },
        { label: t('menu.recentProjects'), children: recentItems },
        { type: 'separator' },
        { label: t('common.save'), action: 'save', shortcut: 'Ctrl+S', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('menu.deploy'), action: 'deploy', disabled: () => !hasProject },
        { label: t('menu.migrate'), action: 'migrate', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('menu.openEditorFolder'), action: 'openEditorFolder', disabled: () => demoMode },
        { label: t('menu.openEditorFolderTerminal'), action: 'openEditorFolderTerminal', disabled: () => demoMode },
        { label: t('menu.openVscode'), action: 'openVscode', disabled: () => !hasProject || demoMode },
        { type: 'separator' },
        { label: t('menu.projectSettings'), action: 'pluginManager', disabled: () => !hasProject },
        { label: t('menu.options'), action: 'options' },
      ],
    },
    {
      label: t('menu.edit'),
      items: [
        { label: t('common.undo'), action: 'undo', shortcut: 'Ctrl+Z', disabled: () => undoStack.length === 0 },
        { label: t('common.redo'), action: 'redo', shortcut: 'Ctrl+Y', disabled: () => redoStack.length === 0 },
        { type: 'separator' },
        { label: t('common.cut'), action: 'cut', shortcut: 'Ctrl+X', disabled: () => !hasProject },
        { label: t('common.copy'), action: 'copy', shortcut: 'Ctrl+C', disabled: () => !hasProject },
        { label: t('common.paste'), action: 'paste', shortcut: 'Ctrl+V', disabled: () => !hasProject },
        { label: t('common.delete'), action: 'delete', shortcut: 'Del', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('common.selectAll', '전체 선택'), action: 'selectAll', shortcut: 'Ctrl+A', disabled: () => !hasProject },
        { label: t('common.deselect', '선택 해제'), action: 'deselect', shortcut: 'Ctrl+D', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('menu.find'), action: 'find', shortcut: 'Ctrl+F', disabled: () => !hasProject },
      ],
    },
    {
      label: t('menu.mode'),
      items: [
        { label: t('menu.map'), action: 'modeMap', shortcut: 'F5', checked: () => editMode === 'map' },
        { label: t('menu.event'), action: 'modeEvent', shortcut: 'F6', checked: () => editMode === 'event' },
        { label: t('menu.light', '조명'), action: 'modeLight', shortcut: 'F7', checked: () => editMode === 'light' },
        { label: t('menu.object'), action: 'modeObject', shortcut: 'F8', checked: () => editMode === 'object' },
        { label: t('menu.cameraZone', '카메라 영역'), action: 'modeCameraZone', shortcut: 'F9', checked: () => editMode === 'cameraZone' },
        { label: t('menu.passage', '통행'), action: 'modePassage', shortcut: 'F11', checked: () => editMode === 'passage' },
      ],
    },
    {
      label: t('menu.draw'),
      items: [
        { label: t('menu.pencil'), action: 'toolPen', checked: () => selectedTool === 'pen' },
        { label: t('menu.eraser'), action: 'toolEraser', checked: () => selectedTool === 'eraser' },
        { label: t('menu.shadow'), action: 'toolShadow', checked: () => selectedTool === 'shadow' },
        { type: 'separator' } as any,
        { label: t('menu.rectangle'), action: 'toolRectangle', checked: () => drawShape === 'rectangle' },
        { label: t('menu.ellipse'), action: 'toolEllipse', checked: () => drawShape === 'ellipse' },
        { label: t('menu.fill'), action: 'toolFill', checked: () => drawShape === 'fill' },
      ],
    },
    {
      label: t('menu.scale'),
      items: [
        { label: t('menu.zoomIn'), action: 'zoomIn', shortcut: 'Ctrl+=' },
        { label: t('menu.zoomOut'), action: 'zoomOut', shortcut: 'Ctrl+-' },
        { label: t('menu.actualSize'), action: 'zoomActual', shortcut: 'Ctrl+0' },
      ],
    },
    {
      label: t('menu.tools'),
      items: [
        { label: t('menu.database'), action: 'database', shortcut: 'F10', disabled: () => !hasProject },
        { label: t('menu.pluginManager'), action: 'pluginManager', disabled: () => !hasProject },
        { label: t('menu.soundTest'), action: 'soundTest', disabled: () => !hasProject },
        { label: t('menu.eventSearch'), action: 'eventSearch', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('menu.characterGenerator'), action: 'characterGenerator', disabled: () => !hasProject },
        { label: t('menu.resourceManager'), action: 'resourceManager', disabled: () => !hasProject },
        { type: 'separator' },
        { label: useWebp ? t('menu.convertToWebpDone') : t('menu.convertToWebp'), action: 'convertToWebp', disabled: () => !hasProject || useWebp },
        { type: 'separator' },
        { label: t('menu.localization'), action: 'localization', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('menu.autotileDebug'), action: 'autotileDebug', disabled: () => !hasProject },
        { label: t('menu.tileIdDebug'), action: 'tileIdDebug', checked: () => showTileIdOverlay, disabled: () => !hasProject },
        { type: 'separator' },
        { label: 'Fog of War 테스트', action: 'fogOfWarTest' },
        { label: 'Fog Volume 3D 테스트', action: 'fogVolume3dTest' },
        { label: 'OcclusionSilhouette 테스트', action: 'silhouetteTest' },
      ],
    },
    {
      label: t('menu.game'),
      items: [
        { label: t('menu.playtestTitle'), action: 'playtestTitle', shortcut: 'Ctrl+Shift+R', disabled: () => !hasProject },
        { label: t('menu.playtestCurrentMap'), action: 'playtestCurrentMap', shortcut: 'Ctrl+R', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('menu.openProjectFolder'), action: 'openFolder', disabled: () => !hasProject || demoMode },
        { label: t('menu.openProjectFolderTerminal'), action: 'openProjectFolderTerminal', disabled: () => !hasProject || demoMode },
        { type: 'separator' },
        { label: t('menu.copyPath'), action: 'copyPath', disabled: () => !hasProject },
      ],
    },
    {
      label: 'MCP',
      items: [
        { label: 'MCP 상태 팝업', action: 'mcpStatus' },
        { type: 'separator' },
        { label: 'MCP 설정 매뉴얼', action: 'mcpManual' },
      ],
    },
    {
      label: t('menu.help'),
      items: [
        { label: t('menu.checkUpdate', '업데이트 확인...'), action: 'checkUpdate' },
        { type: 'separator' },
        { label: t('menu.homepage'), action: 'homepage' },
        { label: t('menu.reportIssue'), action: 'reportIssue' },
        { type: 'separator' },
        { label: t('menu.twitter'), action: 'twitter' },
        { label: t('menu.youtube'), action: 'youtube' },
      ],
    },
  ];

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
          alert(t('menu.projectNotFound'));
        }
      }).catch(() => {});
      return;
    }
    switch (action) {
      case 'newProject': setShowNewProjectDialog(true); break;
      case 'openProject': setShowOpenProjectDialog(true); break;
      case 'closeProject': closeProject(); break;
      case 'save': saveCurrentMap(); break;
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
      case 'playtestTitle': saveCurrentMap().then(() => window.open('/game/index.html?dev=true', '_blank')); break;
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
      case 'fogOfWarTest': window.open('/fogofwar', '_blank'); break;
      case 'fogVolume3dTest': window.open('/fogvolume3d', '_blank'); break;
      case 'silhouetteTest': window.open('/silhouette', '_blank'); break;

      case 'options': setShowOptionsDialog(true); break;
      case 'localization': setShowLocalizationDialog(true); break;
      case 'checkUpdate': setShowUpdateCheckDialog(true); break;
      case 'homepage': window.open('https://github.com/gosuni2025/rpgmaker-mv-editor', '_blank'); break;
      case 'reportIssue': window.open('https://github.com/gosuni2025/rpgmaker-mv-editor/issues', '_blank'); break;
      case 'twitter': window.open('https://x.com/gosuni2025', '_blank'); break;
      case 'youtube': window.open('https://www.youtube.com/@gosuni2025', '_blank'); break;
      case 'mcpStatus': setShowMCPStatusDialog(true); break;
      case 'mcpManual': window.open('https://github.com/gosuni2025/rpgmaker-mv-editor/blob/main/docs/mcp-setup.md', '_blank'); break;
    }
  }, [setShowOpenProjectDialog, setShowNewProjectDialog, saveCurrentMap, closeProject,
      setShowDatabaseDialog, setShowDeployDialog, setShowFindDialog, setShowPluginManagerDialog,
      setShowSoundTestDialog, setShowEventSearchDialog, setShowResourceManagerDialog,
      setShowCharacterGeneratorDialog, setShowOptionsDialog, setShowLocalizationDialog,
      setShowUpdateCheckDialog, setShowMCPStatusDialog, setEditMode, setSelectedTool, setDrawShape, zoomIn, zoomOut,
      zoomActualSize, undo, redo, openProject, projectPath, t, showTileIdOverlay]);

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

  const renderMenuItems = (items: MenuItem[]) =>
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
  );
}
