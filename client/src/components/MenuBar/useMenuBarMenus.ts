import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getRecentProjects } from '../OpenProjectDialog';

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

interface MenuBarState {
  hasProject: boolean;
  demoMode: boolean;
  editMode: string;
  selectedTool: string;
  drawShape: string;
  undoStack: unknown[];
  redoStack: unknown[];
  showTileIdOverlay: boolean;
}

export function useMenuBarMenus(state: MenuBarState): Menu[] {
  const { t } = useTranslation();

  const recentProjects = getRecentProjects().slice(0, 10);
  const recentItems: MenuItem[] = recentProjects.length > 0
    ? recentProjects.map((p) => ({
        label: `${p.name || p.path.split('/').pop()} — ${p.path}`,
        action: `recent:${p.path}`,
      }))
    : [{ label: t('menu.noRecentProjects'), disabled: () => true }];

  return useMemo(() => [
    {
      label: t('menu.file'),
      items: [
        { label: t('menu.newProject'), action: 'newProject', disabled: () => state.demoMode },
        { label: t('menu.openProject'), action: 'openProject', disabled: () => state.demoMode },
        { label: t('menu.closeProject'), action: 'closeProject', disabled: () => !state.hasProject || state.demoMode },
        { type: 'separator' },
        { label: t('menu.recentProjects'), children: recentItems },
        { type: 'separator' },
        { label: t('common.save'), action: 'save', shortcut: 'Ctrl+S', disabled: () => !state.hasProject },
        { type: 'separator' },
        { label: t('menu.deploy'), action: 'deploy', disabled: () => !state.hasProject },
        { label: t('menu.migrate'), action: 'migrate', disabled: () => !state.hasProject },
        { type: 'separator' },
        { label: t('menu.openEditorFolder'), action: 'openEditorFolder', disabled: () => state.demoMode },
        { label: t('menu.openEditorFolderTerminal'), action: 'openEditorFolderTerminal', disabled: () => state.demoMode },
        { label: t('menu.openVscode'), action: 'openVscode', disabled: () => !state.hasProject || state.demoMode },
        { type: 'separator' },
        { label: t('menu.projectSettings'), action: 'pluginManager', disabled: () => !state.hasProject },
        { label: t('menu.options'), action: 'options' },
      ],
    },
    {
      label: t('menu.edit'),
      items: [
        { label: t('common.undo'), action: 'undo', shortcut: 'Ctrl+Z', disabled: () => state.undoStack.length === 0 },
        { label: t('common.redo'), action: 'redo', shortcut: 'Ctrl+Y', disabled: () => state.redoStack.length === 0 },
        { type: 'separator' },
        { label: t('common.cut'), action: 'cut', shortcut: 'Ctrl+X', disabled: () => !state.hasProject },
        { label: t('common.copy'), action: 'copy', shortcut: 'Ctrl+C', disabled: () => !state.hasProject },
        { label: t('common.paste'), action: 'paste', shortcut: 'Ctrl+V', disabled: () => !state.hasProject },
        { label: t('common.delete'), action: 'delete', shortcut: 'Del', disabled: () => !state.hasProject },
        { type: 'separator' },
        { label: t('common.selectAll', '전체 선택'), action: 'selectAll', shortcut: 'Ctrl+A', disabled: () => !state.hasProject },
        { label: t('common.deselect', '선택 해제'), action: 'deselect', shortcut: 'Ctrl+D', disabled: () => !state.hasProject },
        { type: 'separator' },
        { label: t('menu.find'), action: 'find', shortcut: 'Ctrl+F', disabled: () => !state.hasProject },
      ],
    },
    {
      label: t('menu.mode'),
      items: [
        { label: t('menu.map'), action: 'modeMap', shortcut: 'F5', checked: () => state.editMode === 'map' },
        { label: t('menu.event'), action: 'modeEvent', shortcut: 'F6', checked: () => state.editMode === 'event' },
        { label: t('menu.light', '조명'), action: 'modeLight', shortcut: 'F7', checked: () => state.editMode === 'light' },
        { label: t('menu.object'), action: 'modeObject', shortcut: 'F8', checked: () => state.editMode === 'object' },
        { label: t('menu.cameraZone', '카메라 영역'), action: 'modeCameraZone', shortcut: 'F9', checked: () => state.editMode === 'cameraZone' },
        { label: t('menu.passage', '통행'), action: 'modePassage', shortcut: 'F11', checked: () => state.editMode === 'passage' },
      ],
    },
    {
      label: t('menu.draw'),
      items: [
        { label: t('menu.pencil'), action: 'toolPen', checked: () => state.selectedTool === 'pen' },
        { label: t('menu.eraser'), action: 'toolEraser', checked: () => state.selectedTool === 'eraser' },
        { label: t('menu.shadow'), action: 'toolShadow', checked: () => state.selectedTool === 'shadow' },
        { type: 'separator' } as any,
        { label: t('menu.rectangle'), action: 'toolRectangle', checked: () => state.drawShape === 'rectangle' },
        { label: t('menu.ellipse'), action: 'toolEllipse', checked: () => state.drawShape === 'ellipse' },
        { label: t('menu.fill'), action: 'toolFill', checked: () => state.drawShape === 'fill' },
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
        { label: t('menu.database'), action: 'database', shortcut: 'F10', disabled: () => !state.hasProject },
        { label: t('menu.pluginManager'), action: 'pluginManager', disabled: () => !state.hasProject },
        { label: t('menu.soundTest'), action: 'soundTest', disabled: () => !state.hasProject },
        { label: t('menu.eventSearch'), action: 'eventSearch', disabled: () => !state.hasProject },
        { type: 'separator' },
        { label: t('menu.characterGenerator'), action: 'characterGenerator', disabled: () => !state.hasProject },
        { label: t('menu.resourceManager'), action: 'resourceManager', disabled: () => !state.hasProject },
        { type: 'separator' },
        { label: t('menu.convertToWebp'), action: 'convertToWebp', disabled: () => !state.hasProject },
        { label: t('menu.convertToPng'), action: 'convertToPng', disabled: () => !state.hasProject },
        { type: 'separator' },
        { label: t('menu.localization'), action: 'localization', disabled: () => !state.hasProject },
        { type: 'separator' },
        { label: t('menu.migrateEvents', '이벤트 외부 파일로 분리'), action: 'migrateEvents', disabled: () => !state.hasProject },
        { label: t('menu.unmigrateEvents', '이벤트 인라인으로 복구'), action: 'unmigrateEvents', disabled: () => !state.hasProject },
        { type: 'separator' },
        { label: t('menu.autotileDebug'), action: 'autotileDebug', disabled: () => !state.hasProject },
        { label: t('menu.tileIdDebug'), action: 'tileIdDebug', checked: () => state.showTileIdOverlay, disabled: () => !state.hasProject },
        { type: 'separator' },
        { label: 'Fog of War 테스트', action: 'fogOfWarTest' },
        { label: 'Fog Volume 3D 테스트', action: 'fogVolume3dTest' },
        { label: 'OcclusionSilhouette 테스트', action: 'silhouetteTest' },
        { label: 'Parallax UV 테스트', action: 'parallaxUVTest' },
      ],
    },
    {
      label: t('menu.game'),
      items: [
        { label: t('menu.playtestTitle'), action: 'playtestTitle', shortcut: 'Ctrl+Shift+R', disabled: () => !state.hasProject },
        { label: t('menu.playtestCurrentMap'), action: 'playtestCurrentMap', shortcut: 'Ctrl+R', disabled: () => !state.hasProject },
        { type: 'separator' },
        { label: t('menu.playtestTitlePixi'), action: 'playtestTitlePixi', disabled: () => !state.hasProject },
        { label: t('menu.playtestCurrentMapPixi'), action: 'playtestCurrentMapPixi', disabled: () => !state.hasProject },
        { type: 'separator' },
        { label: t('menu.openProjectFolder'), action: 'openFolder', disabled: () => !state.hasProject || state.demoMode },
        { label: t('menu.openProjectFolderTerminal'), action: 'openProjectFolderTerminal', disabled: () => !state.hasProject || state.demoMode },
        { type: 'separator' },
        { label: t('menu.copyPath'), action: 'copyPath', disabled: () => !state.hasProject },
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
        { type: 'separator' },
        { label: t('menu.credits', '크레딧...'), action: 'credits' },
      ],
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, state.hasProject, state.demoMode, state.editMode, state.selectedTool, state.drawShape,
      state.undoStack.length, state.redoStack.length, state.showTileIdOverlay]);
}
