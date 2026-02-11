import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import useEditorStore from '../../store/useEditorStore';

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
  const setEditMode = useEditorStore((s) => s.setEditMode);
  const setSelectedTool = useEditorStore((s) => s.setSelectedTool);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const zoomActualSize = useEditorStore((s) => s.zoomActualSize);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const hasProject = !!projectPath;

  const menus: Menu[] = [
    {
      label: t('menu.file'),
      items: [
        { label: t('menu.newProject'), action: 'newProject' },
        { label: t('menu.openProject'), action: 'openProject' },
        { label: t('menu.closeProject'), action: 'closeProject', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('common.save'), action: 'save', shortcut: 'Ctrl+S', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('menu.deploy'), action: 'deploy', disabled: () => !hasProject },
        { type: 'separator' },
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
      ],
    },
    {
      label: t('menu.draw'),
      items: [
        { label: t('menu.pencil'), action: 'toolPen', checked: () => selectedTool === 'pen' },
        { label: t('menu.rectangle'), action: 'toolRectangle', checked: () => selectedTool === 'rectangle' },
        { label: t('menu.ellipse'), action: 'toolEllipse', checked: () => selectedTool === 'ellipse' },
        { label: t('menu.fill'), action: 'toolFill', checked: () => selectedTool === 'fill' },
        { label: t('menu.shadow'), action: 'toolShadow', checked: () => selectedTool === 'shadow' },
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
        { label: t('menu.database'), action: 'database', shortcut: 'F9', disabled: () => !hasProject },
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
      ],
    },
    {
      label: t('menu.game'),
      items: [
        { label: t('menu.playtestTitle'), action: 'playtestTitle', shortcut: 'Ctrl+R', disabled: () => !hasProject },
        { label: t('menu.playtestCurrentMap'), action: 'playtestCurrentMap', shortcut: 'Ctrl+Shift+R', disabled: () => !hasProject },
        { type: 'separator' },
        { label: t('menu.openFolder'), action: 'openFolder', disabled: () => !hasProject },
      ],
    },
  ];

  const handleAction = useCallback((action: string) => {
    setOpenMenu(null);
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
      case 'toolPen': setSelectedTool('pen'); break;
      case 'toolRectangle': setSelectedTool('rectangle'); break;
      case 'toolEllipse': setSelectedTool('ellipse'); break;
      case 'toolFill': setSelectedTool('fill'); break;
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
        window.open(`/game/index.html?dev=true&startMapId=${mapId}`, '_blank');
      }); break;
      case 'openFolder': fetch('/api/project/open-folder', { method: 'POST' }); break;
      case 'selectAll': window.dispatchEvent(new CustomEvent('editor-selectall')); break;
      case 'deselect': window.dispatchEvent(new CustomEvent('editor-deselect')); break;
      case 'autotileDebug': window.dispatchEvent(new CustomEvent('editor-autotile-debug')); break;
      case 'options': setShowOptionsDialog(true); break;
      case 'localization': setShowLocalizationDialog(true); break;
    }
  }, [setShowOpenProjectDialog, setShowNewProjectDialog, saveCurrentMap, closeProject,
      setShowDatabaseDialog, setShowDeployDialog, setShowFindDialog, setShowPluginManagerDialog,
      setShowSoundTestDialog, setShowEventSearchDialog, setShowResourceManagerDialog,
      setShowCharacterGeneratorDialog, setShowOptionsDialog, setShowLocalizationDialog, setEditMode, setSelectedTool, zoomIn, zoomOut,
      zoomActualSize, undo, redo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 's') { e.preventDefault(); handleAction('save'); }
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
      else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'r') { e.preventDefault(); handleAction('playtestCurrentMap'); }
      else if (ctrl && e.key === 'r') { e.preventDefault(); handleAction('playtestTitle'); }
      else if (e.key === 'F5') { e.preventDefault(); handleAction('modeMap'); }
      else if (e.key === 'F6') { e.preventDefault(); handleAction('modeEvent'); }
      else if (e.key === 'F7') { e.preventDefault(); handleAction('modeLight'); }
      else if (e.key === 'F8') { e.preventDefault(); handleAction('modeObject'); }
      else if (e.key === 'F9') { e.preventDefault(); handleAction('database'); }
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
