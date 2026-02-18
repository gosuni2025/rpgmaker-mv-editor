import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';

interface ToolItem {
  id: string;
  labelKey: string;
  shortcut?: string;
}

// 모드: 서로 배타적인 그리기 모드
const drawModes: ToolItem[] = [
  { id: 'select', labelKey: 'toolbar.select', shortcut: 'M' },
  { id: 'pen', labelKey: 'toolbar.pencil', shortcut: 'P' },
  { id: 'eraser', labelKey: 'toolbar.eraser', shortcut: 'E' },
  { id: 'shadow', labelKey: 'toolbar.shadow', shortcut: 'S' },
];

// 형태: pen/eraser 모드에서 사용하는 그리기 형태
const drawShapes: ToolItem[] = [
  { id: 'freehand', labelKey: 'toolbar.freehand' },
  { id: 'rectangle', labelKey: 'toolbar.rectangle' },
  { id: 'ellipse', labelKey: 'toolbar.ellipse' },
  { id: 'fill', labelKey: 'toolbar.fill' },
];

export default function DrawToolbar() {
  const { t } = useTranslation();
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const drawShape = useEditorStore((s) => s.drawShape);
  const editMode = useEditorStore((s) => s.editMode);
  const currentLayer = useEditorStore((s) => s.currentLayer);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const setSelectedTool = useEditorStore((s) => s.setSelectedTool);
  const setDrawShape = useEditorStore((s) => s.setDrawShape);
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
  const showGrid = useEditorStore((s) => s.showGrid);
  const setShowGrid = useEditorStore((s) => s.setShowGrid);
  const showPassability = useEditorStore((s) => s.showPassability);
  const setShowPassability = useEditorStore((s) => s.setShowPassability);
  const objectSubMode = useEditorStore((s) => s.objectSubMode);
  const setObjectSubMode = useEditorStore((s) => s.setObjectSubMode);
  const passageTool = useEditorStore((s) => s.passageTool);
  const passageShape = useEditorStore((s) => s.passageShape);
  const setPassageTool = useEditorStore((s) => s.setPassageTool);
  const setPassageShape = useEditorStore((s) => s.setPassageShape);

  const showMapTools = editMode === 'map';
  const showObjectTools = editMode === 'object';
  const showPassageTools = editMode === 'passage';

  // Region 모드: R 탭(currentLayer===5)일 때 shadow 툴과 shape 버튼 비활성화
  const isRegionMode = editMode === 'map' && currentLayer === 5;

  // Region 모드 진입 시 shadow 툴이 선택돼 있으면 pen으로 전환
  useEffect(() => {
    if (isRegionMode && selectedTool === 'shadow') {
      setSelectedTool('pen');
    }
  }, [isRegionMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
            ...styles.btnExt,
            ...(editMode === 'light' ? styles.btnExtActive : {}),
          }}
          title="F7"
        >
          {t('toolbar.light')} <span style={styles.shortcut}>F7</span>
        </button>
        <button
          onClick={() => setEditMode('object')}
          style={{
            ...styles.btn,
            ...styles.btnExt,
            ...(editMode === 'object' ? styles.btnExtActive : {}),
          }}
          title="F8"
        >
          {t('toolbar.object')} <span style={styles.shortcut}>F8</span>
        </button>
        <button
          onClick={() => setEditMode('cameraZone')}
          style={{
            ...styles.btn,
            ...styles.btnExt,
            ...(editMode === 'cameraZone' ? styles.btnExtActive : {}),
          }}
          title="F9"
        >
          {t('toolbar.cameraZone')} <span style={styles.shortcut}>F9</span>
        </button>
        <button
          onClick={() => setEditMode('passage')}
          style={{
            ...styles.btn,
            ...styles.btnExt,
            ...(editMode === 'passage' ? styles.btnExtActive : {}),
          }}
          title="F11"
        >
          {t('toolbar.passage', '통행')} <span style={styles.shortcut}>F11</span>
        </button>
      </div>

      <div style={styles.separator} />

      {/* Map mode: Drawing modes */}
      {showMapTools && (
        <>
          <div style={styles.group}>
            {drawModes
              .filter((mode) => !(isRegionMode && mode.id === 'shadow'))
              .map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setSelectedTool(mode.id)}
                  style={{
                    ...styles.btn,
                    ...(selectedTool === mode.id ? (mode.id === 'eraser' ? styles.btnEraserActive : styles.btnActive) : {}),
                  }}
                  title={mode.shortcut || undefined}
                >
                  {t(mode.labelKey)}{mode.shortcut && <span style={styles.shortcut}>{mode.shortcut}</span>}
                </button>
              ))}
          </div>

          <div style={styles.separator} />

          {/* Draw shapes */}
          <div style={styles.group}>
            {drawShapes.map((shape) => (
              <button
                key={shape.id}
                onClick={() => setDrawShape(shape.id)}
                style={{
                  ...styles.btn,
                  ...(drawShape === shape.id ? styles.btnActive : {}),
                  ...(selectedTool === 'select' || selectedTool === 'shadow'
                    ? { opacity: 0.5, pointerEvents: 'none' as const } : {}),
                }}
                title={shape.shortcut || undefined}
              >
                {t(shape.labelKey)}{shape.shortcut && <span style={styles.shortcut}>{shape.shortcut}</span>}
              </button>
            ))}
          </div>

          <div style={styles.separator} />
        </>
      )}

      {/* Passage mode: select / pen / eraser + shapes */}
      {showPassageTools && (
        <>
          <div style={styles.group}>
            <button
              onClick={() => setPassageTool('select')}
              style={{
                ...styles.btn,
                ...(passageTool === 'select' ? styles.btnActive : {}),
              }}
            >
              {t('toolbar.select')}
            </button>
            <button
              onClick={() => setPassageTool('pen')}
              style={{
                ...styles.btn,
                ...(passageTool === 'pen' ? styles.btnActive : {}),
              }}
            >
              {t('toolbar.pencil')}
            </button>
            <button
              onClick={() => setPassageTool('eraser')}
              style={{
                ...styles.btn,
                ...(passageTool === 'eraser' ? styles.btnEraserActive : {}),
              }}
            >
              {t('toolbar.eraser')}
            </button>
          </div>

          {passageTool !== 'select' && (
            <>
              <div style={styles.separator} />

              <div style={styles.group}>
                {drawShapes.map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => setPassageShape(shape.id as any)}
                    style={{
                      ...styles.btn,
                      ...(passageShape === shape.id ? styles.btnActive : {}),
                    }}
                  >
                    {t(shape.labelKey)}
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={styles.separator} />
        </>
      )}

      {/* Object mode: select / create */}
      {showObjectTools && (
        <>
          <div style={styles.group}>
            <button
              onClick={() => setObjectSubMode('select')}
              style={{
                ...styles.btn,
                ...(objectSubMode === 'select' ? styles.btnActive : {}),
              }}
            >
              {t('toolbar.select')}
            </button>
            <button
              onClick={() => setObjectSubMode('create')}
              style={{
                ...styles.btn,
                ...(objectSubMode === 'create' ? styles.btnActive : {}),
              }}
            >
              {t('toolbar.create')}
            </button>
          </div>

          <div style={styles.separator} />
        </>
      )}

      {/* Grid toggle */}
      <button
        onClick={() => {
          const next = !showGrid;
          setShowGrid(next);
          showToast(`격자 ${next ? 'ON' : 'OFF'}`);
        }}
        style={{ ...styles.btn, ...(showGrid ? styles.btnActive : {}) }}
      >
        {t('toolbar.grid')}
      </button>

      {/* Passability toggle (object mode) */}
      {showObjectTools && (
        <button
          onClick={() => {
            const next = !showPassability;
            setShowPassability(next);
            showToast(`통행 표시 ${next ? 'ON' : 'OFF'}`);
          }}
          style={{ ...styles.btn, ...(showPassability ? styles.btnActive : {}) }}
        >
          통행
        </button>
      )}

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
          saveCurrentMap().then(() => {
            const state = useEditorStore.getState();
            const mapId = state.currentMapId || 1;
            const testPos = state.currentMap?.testStartPosition;
            if (testPos) {
              window.open(`/game/index.html?dev=true&startMapId=${mapId}&startX=${testPos.x}&startY=${testPos.y}`, '_blank');
            } else {
              const centerX = Math.floor((state.currentMap?.width || 1) / 2);
              const centerY = Math.floor((state.currentMap?.height || 1) / 2);
              window.open(`/game/index.html?dev=true&startMapId=${mapId}&startX=${centerX}&startY=${centerY}`, '_blank');
            }
          });
        }}
        style={styles.playBtn}
        title="Ctrl+R"
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
  btnExt: {
    background: '#352f4a',
    borderColor: '#5a4f7a',
  },
  btnExtActive: {
    background: '#5a3fb5',
    color: '#fff',
    borderColor: '#5a3fb5',
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
