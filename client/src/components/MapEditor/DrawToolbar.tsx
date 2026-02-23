import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import useEditorStore from '../../store/useEditorStore';
import './DrawToolbar.css';

interface ToolItem {
  id: string;
  labelKey: string;
  shortcut?: string;
}

const drawModes: ToolItem[] = [
  { id: 'select', labelKey: 'toolbar.select', shortcut: 'M' },
  { id: 'pen', labelKey: 'toolbar.pencil', shortcut: 'P' },
  { id: 'eraser', labelKey: 'toolbar.eraser', shortcut: 'E' },
  { id: 'shadow', labelKey: 'toolbar.shadow', shortcut: 'S' },
];

const drawShapes: ToolItem[] = [
  { id: 'freehand', labelKey: 'toolbar.freehand' },
  { id: 'rectangle', labelKey: 'toolbar.rectangle' },
  { id: 'ellipse', labelKey: 'toolbar.ellipse' },
  { id: 'fill', labelKey: 'toolbar.fill' },
];

export default function DrawToolbar() {
  const { t } = useTranslation();
  const {
    selectedTool, drawShape, editMode, currentLayer, zoomLevel,
    setSelectedTool, setDrawShape, setEditMode, zoomIn, zoomOut, saveCurrentMap,
    demoMode, mode3d, shadowLight, disableFow, setMode3d, setShadowLight, setDisableFow,
    showToast, setShowDatabaseDialog, setShowPluginManagerDialog, setShowSoundTestDialog,
    setShowEventSearchDialog, setShowResourceManagerDialog,
    showGrid, setShowGrid, showRegion, setShowRegion,
    showPassability, setShowPassability,
    objectSubMode, setObjectSubMode,
    passageTool, passageShape, setPassageTool, setPassageShape,
  } = useEditorStore(useShallow((s) => ({
    selectedTool: s.selectedTool, drawShape: s.drawShape,
    editMode: s.editMode, currentLayer: s.currentLayer, zoomLevel: s.zoomLevel,
    setSelectedTool: s.setSelectedTool, setDrawShape: s.setDrawShape, setEditMode: s.setEditMode,
    zoomIn: s.zoomIn, zoomOut: s.zoomOut, saveCurrentMap: s.saveCurrentMap,
    demoMode: s.demoMode, mode3d: s.mode3d, shadowLight: s.shadowLight, disableFow: s.disableFow,
    setMode3d: s.setMode3d, setShadowLight: s.setShadowLight, setDisableFow: s.setDisableFow,
    showToast: s.showToast,
    setShowDatabaseDialog: s.setShowDatabaseDialog,
    setShowPluginManagerDialog: s.setShowPluginManagerDialog,
    setShowSoundTestDialog: s.setShowSoundTestDialog,
    setShowEventSearchDialog: s.setShowEventSearchDialog,
    setShowResourceManagerDialog: s.setShowResourceManagerDialog,
    showGrid: s.showGrid, setShowGrid: s.setShowGrid,
    showRegion: s.showRegion, setShowRegion: s.setShowRegion,
    showPassability: s.showPassability, setShowPassability: s.setShowPassability,
    objectSubMode: s.objectSubMode, setObjectSubMode: s.setObjectSubMode,
    passageTool: s.passageTool, passageShape: s.passageShape,
    setPassageTool: s.setPassageTool, setPassageShape: s.setPassageShape,
  })));

  const showMapTools = editMode === 'map';
  const showObjectTools = editMode === 'object';
  const showPassageTools = editMode === 'passage';
  const isRegionMode = editMode === 'map' && currentLayer === 5;

  useEffect(() => {
    if (isRegionMode && selectedTool === 'shadow') {
      setSelectedTool('pen');
    }
  }, [isRegionMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const btn = (active: boolean, ext = false, eraser = false) =>
    ['draw-toolbar-btn', active ? (eraser ? 'eraser-active' : 'active') : '', ext ? 'ext' : ''].filter(Boolean).join(' ');

  return (
    <div className="draw-toolbar">
      {/* Mode toggles */}
      <div className="draw-toolbar-group">
        {[
          { id: 'map', label: t('toolbar.map'), key: 'F5' },
          { id: 'event', label: t('toolbar.event'), key: 'F6' },
          { id: 'light', label: t('toolbar.light'), key: 'F7', ext: true },
          { id: 'object', label: t('toolbar.object'), key: 'F8', ext: true },
          { id: 'cameraZone', label: t('toolbar.cameraZone'), key: 'F9', ext: true },
          { id: 'passage', label: t('toolbar.passage', '통행'), key: 'F11', ext: true },
        ].map(({ id, label, key, ext }) => (
          <button
            key={id}
            onClick={() => setEditMode(id)}
            className={btn(editMode === id, ext)}
            title={key}
          >
            {label} <span className="draw-toolbar-shortcut">{key}</span>
          </button>
        ))}
      </div>

      <div className="draw-toolbar-sep" />

      {/* Map mode: Drawing modes + shapes */}
      {showMapTools && (
        <>
          <div className="draw-toolbar-group">
            {drawModes
              .filter((mode) => !(isRegionMode && mode.id === 'shadow'))
              .map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setSelectedTool(mode.id)}
                  className={btn(selectedTool === mode.id, false, mode.id === 'eraser')}
                  title={mode.shortcut}
                >
                  {t(mode.labelKey)}{mode.shortcut && <span className="draw-toolbar-shortcut">{mode.shortcut}</span>}
                </button>
              ))}
          </div>

          <div className="draw-toolbar-sep" />

          <div className="draw-toolbar-group">
            {drawShapes.map((shape) => (
              <button
                key={shape.id}
                onClick={() => setDrawShape(shape.id)}
                className={[btn(drawShape === shape.id), selectedTool === 'select' || selectedTool === 'shadow' ? 'disabled' : ''].filter(Boolean).join(' ')}
              >
                {t(shape.labelKey)}
              </button>
            ))}
          </div>

          <div className="draw-toolbar-sep" />
        </>
      )}

      {/* Passage mode */}
      {showPassageTools && (
        <>
          <div className="draw-toolbar-group">
            {[
              { id: 'select', label: t('toolbar.select') },
              { id: 'pen', label: t('toolbar.pencil') },
              { id: 'eraser', label: t('toolbar.eraser'), eraser: true },
            ].map(({ id, label, eraser }) => (
              <button
                key={id}
                onClick={() => setPassageTool(id)}
                className={btn(passageTool === id, false, !!eraser)}
              >
                {label}
              </button>
            ))}
          </div>

          {passageTool !== 'select' && (
            <>
              <div className="draw-toolbar-sep" />
              <div className="draw-toolbar-group">
                {drawShapes.map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => setPassageShape(shape.id as any)}
                    className={btn(passageShape === shape.id)}
                  >
                    {t(shape.labelKey)}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="draw-toolbar-sep" />
        </>
      )}

      {/* Object mode */}
      {showObjectTools && (
        <>
          <div className="draw-toolbar-group">
            {[
              { id: 'select', label: t('toolbar.select') },
              { id: 'create', label: t('toolbar.create') },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => setObjectSubMode(id)} className={btn(objectSubMode === id)}>
                {label}
              </button>
            ))}
          </div>
          <div className="draw-toolbar-sep" />
        </>
      )}

      {/* Overlay toggles */}
      <button className={btn(showGrid)} onClick={() => { const n = !showGrid; setShowGrid(n); showToast(`격자 ${n ? 'ON' : 'OFF'}`); }}>
        {t('toolbar.grid')}
      </button>
      <button className={btn(showRegion)} onClick={() => { const n = !showRegion; setShowRegion(n); showToast(`영역 ${n ? 'ON' : 'OFF'}`); }}>
        영역
      </button>
      {showObjectTools && (
        <button className={btn(showPassability)} onClick={() => { const n = !showPassability; setShowPassability(n); showToast(`통행 표시 ${n ? 'ON' : 'OFF'}`); }}>
          통행
        </button>
      )}

      <div className="draw-toolbar-sep" />

      {/* 3D / Lighting toggles */}
      <div className="draw-toolbar-group">
        <button className={btn(mode3d)} onClick={() => setMode3d(!mode3d)}>3D</button>
        <button className={btn(shadowLight)} onClick={() => setShadowLight(!shadowLight)}>{t('toolbar.lighting')}</button>
        <button className={btn(!disableFow)} onClick={() => setDisableFow(!disableFow)}>FOW</button>
      </div>

      <div className="draw-toolbar-sep" />

      {/* Zoom */}
      <div className="draw-toolbar-group">
        <button className="draw-toolbar-btn" onClick={zoomOut}>{t('toolbar.zoomOut')}</button>
        <span className="draw-toolbar-zoom-label">{Math.round(zoomLevel * 100)}%</span>
        <button className="draw-toolbar-btn" onClick={zoomIn}>{t('toolbar.zoomIn')}</button>
      </div>

      <div className="draw-toolbar-sep" />

      {/* Dialog shortcuts */}
      <div className="draw-toolbar-group">
        <button className="draw-toolbar-btn" onClick={() => setShowDatabaseDialog(true)}>{t('menu.database').replace('...', '')}</button>
        <button className="draw-toolbar-btn" onClick={() => setShowPluginManagerDialog(true)}>{t('menu.pluginManager').replace('...', '')}</button>
        <button className="draw-toolbar-btn" onClick={() => setShowSoundTestDialog(true)}>{t('menu.soundTest').replace('...', '')}</button>
        <button className="draw-toolbar-btn" onClick={() => setShowEventSearchDialog(true)}>{t('menu.eventSearch').replace('...', '')}</button>
        <button className="draw-toolbar-btn" onClick={() => setShowResourceManagerDialog(true)}>{t('menu.resourceManager').replace('...', '')}</button>
      </div>

      <div className="draw-toolbar-spacer" />

      {!demoMode && (
        <button className="draw-toolbar-save-btn" onClick={saveCurrentMap}>{t('toolbar.save')}</button>
      )}

      <button
        className="draw-toolbar-play-btn"
        title="Ctrl+R"
        onClick={() => {
          const state = useEditorStore.getState();
          const mapId = state.currentMapId || 1;
          const testPos = state.currentMap?.testStartPosition;
          const centerX = Math.floor((state.currentMap?.width || 1) / 2);
          const centerY = Math.floor((state.currentMap?.height || 1) / 2);
          const startX = testPos ? testPos.x : centerX;
          const startY = testPos ? testPos.y : centerY;
          if (demoMode) {
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
        }}
      >
        ▶ {t('menu.playtestCurrentMap')}
      </button>
    </div>
  );
}
