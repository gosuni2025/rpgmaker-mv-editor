import React from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';

interface Tool {
  id: string;
  labelKey: string;
  shortcut?: string;
}

const tools: Tool[] = [
  { id: 'select', labelKey: 'toolbar.select', shortcut: 'M' },
  { id: 'pen', labelKey: 'toolbar.pencil', shortcut: 'P' },
  { id: 'rectangle', labelKey: 'toolbar.rectangle' },
  { id: 'ellipse', labelKey: 'toolbar.ellipse' },
  { id: 'fill', labelKey: 'toolbar.fill', shortcut: 'B' },
  { id: 'shadow', labelKey: 'toolbar.shadow' },
];

export default function DrawToolbar() {
  const { t } = useTranslation();
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const eraserMode = useEditorStore((s) => s.eraserMode);
  const editMode = useEditorStore((s) => s.editMode);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const setSelectedTool = useEditorStore((s) => s.setSelectedTool);
  const setEraserMode = useEditorStore((s) => s.setEraserMode);
  const setEditMode = useEditorStore((s) => s.setEditMode);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const saveCurrentMap = useEditorStore((s) => s.saveCurrentMap);
  const mode3d = useEditorStore((s) => s.mode3d);
  const shadowLight = useEditorStore((s) => s.shadowLight);
  const disableFow = useEditorStore((s) => s.disableFow);
  const setMode3d = useEditorStore((s) => s.setMode3d);
  const setShadowLight = useEditorStore((s) => s.setShadowLight);
  const setDisableFow = useEditorStore((s) => s.setDisableFow);
  const showToast = useEditorStore((s) => s.showToast);
  const setShowDatabaseDialog = useEditorStore((s) => s.setShowDatabaseDialog);
  const setShowPluginManagerDialog = useEditorStore((s) => s.setShowPluginManagerDialog);
  const setShowSoundTestDialog = useEditorStore((s) => s.setShowSoundTestDialog);
  const setShowEventSearchDialog = useEditorStore((s) => s.setShowEventSearchDialog);
  const setShowResourceManagerDialog = useEditorStore((s) => s.setShowResourceManagerDialog);
  const [showGrid, setShowGrid] = React.useState(true);
  const [showTileId, setShowTileId] = React.useState(false);

  return (
    <div style={styles.toolbar}>
      {/* Mode toggles */}
      <div style={styles.group}>
        <button
          onClick={() => setEditMode('map')}
          style={{
            ...styles.btn,
            ...(editMode === 'map' ? styles.btnActive : {}),
          }}
          title="F5"
        >
          {t('toolbar.map')} <span style={styles.shortcut}>F5</span>
        </button>
        <button
          onClick={() => setEditMode('event')}
          style={{
            ...styles.btn,
            ...(editMode === 'event' ? styles.btnActive : {}),
          }}
          title="F6"
        >
          {t('toolbar.event')} <span style={styles.shortcut}>F6</span>
        </button>
        <button
          onClick={() => setEditMode('light')}
          style={{
            ...styles.btn,
            ...(editMode === 'light' ? styles.btnActive : {}),
          }}
          title="F7"
        >
          {t('toolbar.light')} <span style={styles.shortcut}>F7</span>
        </button>
        <button
          onClick={() => setEditMode('object')}
          style={{
            ...styles.btn,
            ...(editMode === 'object' ? styles.btnActive : {}),
          }}
          title="F8"
        >
          {t('toolbar.object')} <span style={styles.shortcut}>F8</span>
        </button>
        <button
          onClick={() => setEditMode('cameraZone')}
          style={{
            ...styles.btn,
            ...(editMode === 'cameraZone' ? styles.btnActive : {}),
          }}
          title="F9"
        >
          {t('toolbar.cameraZone')} <span style={styles.shortcut}>F9</span>
        </button>
      </div>

      <div style={styles.separator} />

      {/* Drawing tools */}
      <div style={styles.group}>
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setSelectedTool(tool.id)}
            style={{
              ...styles.btn,
              ...(selectedTool === tool.id && !eraserMode ? styles.btnActive : {}),
              ...(editMode !== 'map' ? { opacity: 0.5, pointerEvents: 'none' as const } : {}),
            }}
            title={tool.shortcut || undefined}
          >
            {t(tool.labelKey)}{tool.shortcut && <span style={styles.shortcut}>{tool.shortcut}</span>}
          </button>
        ))}
      </div>

      <div style={styles.separator} />

      {/* Eraser toggle */}
      <button
        onClick={() => setEraserMode(!eraserMode)}
        style={{
          ...styles.btn,
          ...(eraserMode ? styles.btnEraserActive : {}),
          ...(editMode !== 'map' ? { opacity: 0.5, pointerEvents: 'none' as const } : {}),
        }}
        title="E"
      >
        {t('toolbar.eraser')}<span style={styles.shortcut}>E</span>
      </button>

      <div style={styles.separator} />

      {/* Grid toggle */}
      <button
        onClick={() => {
          const next = !showGrid;
          setShowGrid(next);
          window.dispatchEvent(
            new CustomEvent('editor-toggle-grid', { detail: next })
          );
          showToast(`격자 ${next ? 'ON' : 'OFF'}`);
        }}
        style={{ ...styles.btn, ...(showGrid ? styles.btnActive : {}) }}
      >
        {t('toolbar.grid')}
      </button>

      {/* Tile ID debug toggle */}
      <button
        onClick={() => {
          const next = !showTileId;
          setShowTileId(next);
          window.dispatchEvent(
            new CustomEvent('editor-toggle-tileid', { detail: next })
          );
          showToast(`타일 ID ${next ? 'ON' : 'OFF'}`);
        }}
        style={{ ...styles.btn, ...(showTileId ? styles.btnActive : {}) }}
        title={t('toolbar.tileIdDebug')}
      >
        {t('toolbar.tileIdDebug')}
      </button>

      <div style={styles.separator} />

      {/* 3D / Lighting toggles */}
      <div style={styles.group}>
        <button
          onClick={() => setMode3d(!mode3d)}
          style={{ ...styles.btn, ...(mode3d ? styles.btnActive : {}) }}
        >
          3D
        </button>
        <button
          onClick={() => setShadowLight(!shadowLight)}
          style={{ ...styles.btn, ...(shadowLight ? styles.btnActive : {}) }}
        >
          {t('toolbar.lighting')}
        </button>
        <button
          onClick={() => setDisableFow(!disableFow)}
          style={{ ...styles.btn, ...(!disableFow ? styles.btnActive : {}) }}
        >
          FOW
        </button>
      </div>

      <div style={styles.separator} />

      {/* Zoom controls */}
      <div style={styles.group}>
        <button onClick={zoomOut} style={styles.btn}>{t('toolbar.zoomOut')}</button>
        <span style={styles.zoomLabel}>{Math.round(zoomLevel * 100)}%</span>
        <button onClick={zoomIn} style={styles.btn}>{t('toolbar.zoomIn')}</button>
      </div>

      <div style={styles.separator} />

      {/* Tool shortcuts */}
      <div style={styles.group}>
        <button onClick={() => setShowDatabaseDialog(true)} style={styles.btn}>
          {t('menu.database').replace('...', '')}
        </button>
        <button onClick={() => setShowPluginManagerDialog(true)} style={styles.btn}>
          {t('menu.pluginManager').replace('...', '')}
        </button>
        <button onClick={() => setShowSoundTestDialog(true)} style={styles.btn}>
          {t('menu.soundTest').replace('...', '')}
        </button>
        <button onClick={() => setShowEventSearchDialog(true)} style={styles.btn}>
          {t('menu.eventSearch').replace('...', '')}
        </button>
        <button onClick={() => setShowResourceManagerDialog(true)} style={styles.btn}>
          {t('menu.resourceManager').replace('...', '')}
        </button>
      </div>

      <div style={{ flex: 1 }} />

      <button onClick={saveCurrentMap} style={styles.saveBtn}>
        {t('toolbar.save')}
      </button>

      <button
        onClick={() => {
          const mapId = useEditorStore.getState().currentMapId || 1;
          saveCurrentMap().then(() => {
            window.open(`/game/index.html?dev=true&startMapId=${mapId}`, '_blank');
          });
        }}
        style={styles.playBtn}
        title="Ctrl+Shift+R"
      >
        ▶ {t('menu.playtestCurrentMap')}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    background: '#2a2a2a',
    borderBottom: '1px solid #444',
    height: 36,
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  btn: {
    background: '#3a3a3a',
    color: '#ccc',
    border: '1px solid #555',
    borderRadius: 3,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 12,
  },
  btnActive: {
    background: '#0078d4',
    color: '#fff',
    borderColor: '#0078d4',
  },
  btnEraserActive: {
    background: '#d43a0e',
    color: '#fff',
    borderColor: '#d43a0e',
  },
  separator: {
    width: 1,
    height: 20,
    background: '#555',
    margin: '0 6px',
  },
  shortcut: {
    color: '#888',
    fontSize: 10,
    marginLeft: 2,
  },
  zoomLabel: {
    color: '#ccc',
    fontSize: 12,
    minWidth: 40,
    textAlign: 'center' as const,
  },
  playBtn: {
    background: '#2ea043',
    color: '#fff',
    border: 'none',
    borderRadius: 3,
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: 12,
    marginLeft: 4,
  },
  saveBtn: {
    background: '#0078d4',
    color: '#fff',
    border: 'none',
    borderRadius: 3,
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: 12,
  },
};
