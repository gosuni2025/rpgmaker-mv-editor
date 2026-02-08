import React from 'react';
import useEditorStore from '../../store/useEditorStore';

interface Tool {
  id: string;
  label: string;
  icon: string;
}

const tools: Tool[] = [
  { id: 'pen', label: 'Pen', icon: '✏' },
  { id: 'rectangle', label: 'Rect', icon: '▭' },
  { id: 'ellipse', label: 'Ellipse', icon: '⬭' },
  { id: 'fill', label: 'Fill', icon: '⬛' },
  { id: 'eraser', label: 'Eraser', icon: '◻' },
  { id: 'shadow', label: 'Shadow', icon: '◧' },
];

const layers = [0, 1, 2, 3];

export default function DrawToolbar() {
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
          title="Map mode"
        >
          Map
        </button>
        <button
          onClick={() => setEditMode('event')}
          style={{
            ...styles.btn,
            ...(editMode === 'event' ? styles.btnActive : {}),
          }}
          title="Event mode"
        >
          Event
        </button>
      </div>

      <div style={styles.separator} />

      {/* Drawing tools */}
      <div style={styles.group}>
        {tools.map((t) => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => setSelectedTool(t.id)}
            style={{
              ...styles.btn,
              ...(selectedTool === t.id ? styles.btnActive : {}),
              ...(editMode === 'event' ? { opacity: 0.5, pointerEvents: 'none' as const } : {}),
            }}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div style={styles.separator} />

      {/* Layer selector */}
      <div style={styles.group}>
        <span style={styles.label}>Layer:</span>
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
        title="Toggle Grid"
      >
        #
      </button>

      <div style={styles.separator} />

      {/* Zoom controls */}
      <div style={styles.group}>
        <button onClick={zoomOut} style={styles.btn} title="Zoom Out">-</button>
        <span style={styles.zoomLabel}>{Math.round(zoomLevel * 100)}%</span>
        <button onClick={zoomIn} style={styles.btn} title="Zoom In">+</button>
      </div>

      <div style={{ flex: 1 }} />

      <button onClick={saveCurrentMap} style={styles.saveBtn}>
        Save
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
    fontSize: 14,
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
