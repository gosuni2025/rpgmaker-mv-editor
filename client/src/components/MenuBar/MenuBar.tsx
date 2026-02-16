import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import useEditorStore from '../../store/useEditorStore';
import apiClient from '../../api/client';
import { getRecentProjects, removeRecentProject } from '../OpenProjectDialog';
import './MenuBar.css';

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
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const drawShape = useEditorStore((s) => s.drawShape);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);

  const setShowOpenProjectDialog = useEditorStore((s) => s.setShowOpenProjectDialog);
  const setShowNewProjectDialog = useEditorStore((s) => s.setShowNewProjectDialog);
  const saveCurrentMap = useEditorStore((s) => s.saveCurrentMap);
  const closeProject = useEditorStore((s) => s.closeProject);
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
  const setShowProjectSettingsDialog = useEditorStore((s) => s.setShowProjectSettingsDialog);
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
        { label: t('menu.newProject'), action: 'newProject' },
        { label: t('menu.openProject'), action: 'openProject' },
        { label: t('menu.closeProject'), action: 'closeProject', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('menu.recentProjects'), children: recentItems },
        { type: 'separator' },
        { label: t('common.save'), action: 'save', shortcut: 'Ctrl+S', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('menu.deploy'), action: 'deploy', disabled: () => !hasProject },
        { label: t('menu.migrate'), action: 'migrate', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('menu.openEditorFolder'), action: 'openEditorFolder' },
        { label: t('menu.copyPath'), action: 'copyPath', disabled: () => !hasProject },
        { label: t('menu.openVscode'), action: 'openVscode', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('menu.projectSettings'), action: 'projectSettings', disabled: () => !hasProject },
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
        { label: t('menu.localization'), action: 'localization', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('menu.autotileDebug'), action: 'autotileDebug', disabled: () => !hasProject },
        { label: t('menu.tileIdDebug'), action: 'tileIdDebug', checked: () => showTileIdOverlay, disabled: () => !hasProject },
      ],
    },
    {
      label: t('menu.game'),
      items: [
        { label: t('menu.playtestTitle'), action: 'playtestTitle', shortcut: 'Ctrl+Shift+R', disabled: () => !hasProject },
        { label: t('menu.playtestCurrentMap'), action: 'playtestCurrentMap', shortcut: 'Ctrl+R', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('menu.openFolder'), action: 'openFolder', disabled: () => !hasProject },
      ],
    },
  ];

  const handleAction = useCallback((action: string) => {
    setOpenMenu(null);
    if (action.startsWith('recent:')) {
      const recentPath = action.slice(7);
      apiClient.get<{ exists: boolean }>(`/project/check-path?path=${encodeURIComponent(recentPath)}`).then(res => {
        if (res.exists) {
          openProject(recentPath);
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
      case 'playtestTitle': saveCurrentMap().then(() => window.open('/game/index.html?dev=true', '_blank')); break;
      case 'playtestCurrentMap': saveCurrentMap().then(() => {
        const mapId = currentMapId || 1;
        const state = useEditorStore.getState();
        const testPos = state.currentMap?.testStartPosition;
        if (testPos) {
          window.open(`/game/index.html?dev=true&startMapId=${mapId}&startX=${testPos.x}&startY=${testPos.y}`, '_blank');
        } else {
          const centerX = Math.floor((state.currentMap?.width || 1) / 2);
          const centerY = Math.floor((state.currentMap?.height || 1) / 2);
          window.open(`/game/index.html?dev=true&startMapId=${mapId}&startX=${centerX}&startY=${centerY}`, '_blank');
        }
      }); break;
      case 'openFolder': fetch('/api/project/open-folder', { method: 'POST' }); break;
      case 'openEditorFolder': fetch('/api/project/open-editor-folder', { method: 'POST' }); break;
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
      case 'projectSettings': setShowProjectSettingsDialog(true); break;
      case 'options': setShowOptionsDialog(true); break;
      case 'localization': setShowLocalizationDialog(true); break;
    }
  }, [setShowOpenProjectDialog, setShowNewProjectDialog, saveCurrentMap, closeProject,
      setShowDatabaseDialog, setShowDeployDialog, setShowFindDialog, setShowPluginManagerDialog,
      setShowSoundTestDialog, setShowEventSearchDialog, setShowResourceManagerDialog,
      setShowCharacterGeneratorDialog, setShowOptionsDialog, setShowLocalizationDialog, setShowProjectSettingsDialog, setEditMode, setSelectedTool, setDrawShape, zoomIn, zoomOut,
      zoomActualSize, undo, redo, openProject, projectPath, t]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 다이얼로그/모달이 열려있으면 맵 편집 단축키를 차단
      const target = e.target as HTMLElement;
      const inDialog = target.closest('.db-dialog-overlay, .modal-overlay, .vs-selector-overlay, .move-route-overlay, .move-route-param-overlay, .l10n-popup-overlay')
        || document.querySelector('.db-dialog-overlay, .modal-overlay, .vs-selector-overlay, .move-route-overlay, .move-route-param-overlay, .l10n-popup-overlay');
      const ctrl = e.ctrlKey || e.metaKey;
      // IME 입력 중에는 텍스트 입력 필드의 단축키만 무시 (한글 등)
      // e.code 기반 단축키(M/P/E/B)는 IME 상태와 무관하게 동작해야 함
      const ime = e.isComposing || e.key === 'Process';
      // 전역 단축키 (다이얼로그 안에서도 동작)
      if (ctrl && (e.key === 's' || e.code === 'KeyS')) { e.preventDefault(); handleAction('save'); }
      else if (e.key === 'F5' || e.code === 'F5') { e.preventDefault(); handleAction('modeMap'); }
      else if (e.key === 'F6' || e.code === 'F6') { e.preventDefault(); handleAction('modeEvent'); }
      else if (e.key === 'F7' || e.code === 'F7') { e.preventDefault(); handleAction('modeLight'); }
      else if (e.key === 'F8' || e.code === 'F8') { e.preventDefault(); handleAction('modeObject'); }
      else if (e.key === 'F9' || e.code === 'F9') { e.preventDefault(); handleAction('modeCameraZone'); }
      else if (e.key === 'F10' || e.code === 'F10') { e.preventDefault(); handleAction('database'); }
      else if (ctrl && e.shiftKey && (e.key.toLowerCase() === 'r' || e.code === 'KeyR')) { e.preventDefault(); handleAction('playtestTitle'); }
      else if (ctrl && (e.key === 'r' || e.code === 'KeyR')) { e.preventDefault(); handleAction('playtestCurrentMap'); }
      // 다이얼로그 내부에서는 편집 단축키를 맵에 전파하지 않음
      else if (inDialog) return;
      // IME 입력 중이면 Ctrl 조합 등 텍스트 편집 단축키 무시
      else if (ime) return;
      else if (ctrl && e.key === 'z') { e.preventDefault(); handleAction('undo'); }
      else if (ctrl && e.key === 'y') { e.preventDefault(); handleAction('redo'); }
      else if (ctrl && e.key === 'x') { e.preventDefault(); handleAction('cut'); }
      else if (ctrl && e.key === 'c') { e.preventDefault(); handleAction('copy'); }
      else if (ctrl && e.key === 'v') { e.preventDefault(); handleAction('paste'); }
      else if (ctrl && e.key === 'f') { e.preventDefault(); handleAction('find'); }
      else if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); handleAction('zoomIn'); }
      else if (ctrl && e.key === '-') { e.preventDefault(); handleAction('zoomOut'); }
      else if (ctrl && e.key === '0') { e.preventDefault(); handleAction('zoomActual'); }
      else if (ctrl && e.key === 'a') { e.preventDefault(); handleAction('selectAll'); }
      else if (ctrl && e.key === 'd') { e.preventDefault(); handleAction('deselect'); }
      else if (e.key === 'Delete') { handleAction('delete'); }
      else if (e.key === 'Escape') { window.dispatchEvent(new CustomEvent('editor-escape')); }
      // 도구 단축키 — e.code 사용으로 IME 상태와 무관하게 동작
      else if (!ctrl && !e.shiftKey && !e.altKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if ((e.target as HTMLElement).isContentEditable) return;
        switch (e.code) {
          case 'KeyE': e.preventDefault(); handleAction('toolEraser'); break;
          case 'KeyP': e.preventDefault(); handleAction('toolPen'); break;
          case 'KeyB': e.preventDefault(); handleAction('toolFill'); break;
          case 'KeyM': e.preventDefault(); handleAction('toolSelect'); break;
          case 'KeyS': e.preventDefault(); handleAction('toolShadow'); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAction]);

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
    </div>
  );
}
