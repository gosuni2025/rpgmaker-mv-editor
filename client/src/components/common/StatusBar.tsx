import React from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';

export default function StatusBar() {
  const { t } = useTranslation();
  const projectPath = useEditorStore((s) => s.projectPath);
  const currentMap = useEditorStore((s) => s.currentMap);
  const editMode = useEditorStore((s) => s.editMode);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const cursorTileX = useEditorStore((s) => s.cursorTileX);
  const cursorTileY = useEditorStore((s) => s.cursorTileY);

  return (
    <div className="statusbar">
      <span className="statusbar-item">
        {projectPath || t('statusBar.noProject')}
      </span>
      {currentMap && (
        <span className="statusbar-item">
          {t('statusBar.map')}: {currentMap.displayName || currentMap.name || `Map`} ({currentMap.width}x{currentMap.height})
        </span>
      )}
      <span className="statusbar-item">
        {t('statusBar.mode')}: {editMode === 'map' ? t('statusBar.modeMap') : t('statusBar.modeEvent')}
      </span>
      <span className="statusbar-item">
        {t('statusBar.coord')}: ({cursorTileX}, {cursorTileY})
      </span>
      <span className="statusbar-item">
        {t('statusBar.zoom')}: {Math.round(zoomLevel * 100)}%
      </span>
    </div>
  );
}
