import React, { useState, useEffect, useRef, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';

interface MenuItem {
  label?: string;
  action?: string;
  shortcut?: string;
  type?: string;
  checked?: () => boolean;
  disabled?: () => boolean;
}

interface Menu {
  label: string;
  items: MenuItem[];
}

export default function MenuBar() {
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
      label: '파일',
      items: [
        { label: '새 프로젝트...', action: 'newProject' },
        { label: '프로젝트 열기...', action: 'openProject' },
        { label: '프로젝트 닫기', action: 'closeProject', disabled: () => !hasProject },
        { type: 'separator' },
        { label: '저장', action: 'save', shortcut: 'Ctrl+S', disabled: () => !hasProject },
        { type: 'separator' },
        { label: '배포...', action: 'deploy', disabled: () => !hasProject },
      ],
    },
    {
      label: '편집',
      items: [
        { label: '실행 취소', action: 'undo', shortcut: 'Ctrl+Z', disabled: () => undoStack.length === 0 },
        { label: '다시 실행', action: 'redo', shortcut: 'Ctrl+Y', disabled: () => redoStack.length === 0 },
        { type: 'separator' },
        { label: '잘라내기', action: 'cut', shortcut: 'Ctrl+X', disabled: () => !hasProject },
        { label: '복사', action: 'copy', shortcut: 'Ctrl+C', disabled: () => !hasProject },
        { label: '붙여넣기', action: 'paste', shortcut: 'Ctrl+V', disabled: () => !hasProject },
        { label: '삭제', action: 'delete', shortcut: 'Del', disabled: () => !hasProject },
        { type: 'separator' },
        { label: '찾기...', action: 'find', shortcut: 'Ctrl+F', disabled: () => !hasProject },
      ],
    },
    {
      label: '모드',
      items: [
        { label: '지도', action: 'modeMap', shortcut: 'F5', checked: () => editMode === 'map' },
        { label: '이벤트', action: 'modeEvent', shortcut: 'F6', checked: () => editMode === 'event' },
        { label: '오브젝트', action: 'modeObject', shortcut: 'F7', checked: () => editMode === 'object' },
      ],
    },
    {
      label: '그리기',
      items: [
        { label: '연필', action: 'toolPen', checked: () => selectedTool === 'pen' },
        { label: '직사각형', action: 'toolRectangle', checked: () => selectedTool === 'rectangle' },
        { label: '타원', action: 'toolEllipse', checked: () => selectedTool === 'ellipse' },
        { label: '채우기', action: 'toolFill', checked: () => selectedTool === 'fill' },
        { label: '그림자', action: 'toolShadow', checked: () => selectedTool === 'shadow' },
      ],
    },
    {
      label: '배율',
      items: [
        { label: '확대', action: 'zoomIn', shortcut: 'Ctrl+=' },
        { label: '축소', action: 'zoomOut', shortcut: 'Ctrl+-' },
        { label: '실제 크기', action: 'zoomActual', shortcut: 'Ctrl+0' },
      ],
    },
    {
      label: '도구',
      items: [
        { label: '데이터베이스...', action: 'database', shortcut: 'F9', disabled: () => !hasProject },
        { label: '플러그인 관리...', action: 'pluginManager', disabled: () => !hasProject },
        { label: '사운드 테스트...', action: 'soundTest', disabled: () => !hasProject },
        { label: '이벤트 검색...', action: 'eventSearch', disabled: () => !hasProject },
        { type: 'separator' },
        { label: '캐릭터 생성...', action: 'characterGenerator', disabled: () => !hasProject },
        { label: '자원 관리...', action: 'resourceManager', disabled: () => !hasProject },
        { type: 'separator' },
        { label: '오토타일 디버그...', action: 'autotileDebug', disabled: () => !hasProject },
      ],
    },
    {
      label: '게임',
      items: [
        { label: '타이틀부터 테스트', action: 'playtestTitle', shortcut: 'Ctrl+R', disabled: () => !hasProject },
        { label: '현재 맵에서 테스트', action: 'playtestCurrentMap', shortcut: 'Ctrl+Shift+R', disabled: () => !hasProject },
        { type: 'separator' },
        { label: '폴더 열기', action: 'openFolder', disabled: () => !hasProject },
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
      case 'autotileDebug': window.dispatchEvent(new CustomEvent('editor-autotile-debug')); break;
    }
  }, [setShowOpenProjectDialog, setShowNewProjectDialog, saveCurrentMap, closeProject,
      setShowDatabaseDialog, setShowDeployDialog, setShowFindDialog, setShowPluginManagerDialog,
      setShowSoundTestDialog, setShowEventSearchDialog, setShowResourceManagerDialog,
      setShowCharacterGeneratorDialog, setEditMode, setSelectedTool, zoomIn, zoomOut,
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
      else if (e.key === 'Delete') { handleAction('delete'); }
      else if (e.key === 'Escape') { window.dispatchEvent(new CustomEvent('editor-escape')); }
      else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'r') { e.preventDefault(); handleAction('playtestCurrentMap'); }
      else if (ctrl && e.key === 'r') { e.preventDefault(); handleAction('playtestTitle'); }
      else if (e.key === 'F5') { e.preventDefault(); handleAction('modeMap'); }
      else if (e.key === 'F6') { e.preventDefault(); handleAction('modeEvent'); }
      else if (e.key === 'F7') { e.preventDefault(); handleAction('modeObject'); }
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
              {menu.items.map((item, j) =>
                item.type === 'separator' ? (
                  <div key={j} className="menubar-separator" />
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
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
