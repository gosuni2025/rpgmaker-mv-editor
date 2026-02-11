import React from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';

interface Tool {
  id: string;
  labelKey: string;
}

const tools: Tool[] = [
  { id: 'select', labelKey: 'toolbar.select' },
  { id: 'pen', labelKey: 'toolbar.pencil' },
  { id: 'rectangle', labelKey: 'toolbar.rectangle' },
  { id: 'ellipse', labelKey: 'toolbar.ellipse' },
  { id: 'fill', labelKey: 'toolbar.fill' },
  { id: 'eraser', labelKey: 'toolbar.eraser' },
  { id: 'shadow', labelKey: 'toolbar.shadow' },
];

const layers = [0, 1, 2, 3];

export default function DrawToolbar() {
  const { t } = useTranslation();
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const currentLayer = useEditorStore((s) => s.currentLayer);
  const editMode = useEditorStore((s) => s.editMode);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const setSelectedTool = useEditorStore((s) => s.setSelectedTool);
  const setCurrentLayer = useEditorStore((s) => s.setCurrentLayer);
  const setEditMode = useEditorStore((s) => s.setEditMode);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const saveCurrentMap = useEditorStore((s) => s.saveCurrentMap);
  const mode3d = useEditorStore((s) => s.mode3d);
  const shadowLight = useEditorStore((s) => s.shadowLight);
  const setMode3d = useEditorStore((s) => s.setMode3d);
  const setShadowLight = useEditorStore((s) => s.setShadowLight);
  const [showGrid, setShowGrid] = React.useState(true);

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
              ...(selectedTool === tool.id ? styles.btnActive : {}),
              ...(editMode !== 'map' ? { opacity: 0.5, pointerEvents: 'none' as const } : {}),
            }}
          >
            {t(tool.labelKey)}
          </button>
        ))}
      </div>

      <div style={styles.separator} />

      {/* Layer selector */}
      <div style={styles.group}>
        <span style={styles.label}>{t('toolbar.layer')}:</span>
        <select
          value={currentLayer}
          onChange={(e) => setCurrentLayer(Number(e.target.value))}
          style={styles.select}
        >
          {layers.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.separator} />

      {/* Grid toggle */}
      <button
        onClick={() => {
          setShowGrid(!showGrid);
          window.dispatchEvent(
            new CustomEvent('editor-toggle-grid', { detail: !showGrid })
          );
        }}
        style={{ ...styles.btn, ...(showGrid ? styles.btnActive : {}) }}
      >
        {t('toolbar.grid')}
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
      </div>

      <div style={styles.separator} />

      {/* Zoom controls */}
      <div style={styles.group}>
        <button onClick={zoomOut} style={styles.btn}>{t('toolbar.zoomOut')}</button>
        <span style={styles.zoomLabel}>{Math.round(zoomLevel * 100)}%</span>
        <button onClick={zoomIn} style={styles.btn}>{t('toolbar.zoomIn')}</button>
      </div>

      <div style={{ flex: 1 }} />

      <button onClick={saveCurrentMap} style={styles.saveBtn}>
        {t('toolbar.save')}
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
  separator: {
    width: 1,
    height: 20,
    background: '#555',
    margin: '0 6px',
  },
  label: {
    color: '#aaa',
    fontSize: 12,
    marginRight: 4,
  },
  select: {
    background: '#3a3a3a',
    color: '#ccc',
    border: '1px solid #555',
    borderRadius: 3,
    padding: '2px 4px',
    fontSize: 12,
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
