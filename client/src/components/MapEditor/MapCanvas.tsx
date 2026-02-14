import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import type { TileChange } from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import apiClient from '../../api/client';
import EventDetail from '../EventEditor/EventDetail';
import ShiftMapDialog from './ShiftMapDialog';
import SampleMapDialog from '../SampleMapDialog';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useThreeRenderer } from './useThreeRenderer';
import { useMapTools } from './useMapTools';
import { useMouseHandlers } from './useMouseHandlers';
import { useEventSelectionOverlays, useLightSelectionOverlays, useObjectSelectionOverlays } from './useEntitySelectionOverlays';
import { useMoveRouteOverlay } from './useMoveRouteOverlay';
import { useSelectionRectOverlay, usePastePreviewOverlay } from './useSelectionOverlays';
import { useTileCursorPreview } from './useTileCursorPreview';
import { useDragPreviews, useDragPreviewMeshSync, useCameraZoneMeshCleanup, usePlayerStartDragPreview } from './useDragPreviewSync';
import './MapCanvas.css';


export default function MapCanvas() {
  const { t } = useTranslation();

  // DOM refs
  const containerRef = useRef<HTMLDivElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const parallaxDivRef = useRef<HTMLDivElement>(null);

  // Shared refs for drawing state
  const pendingChanges = useRef<TileChange[]>([]);
  const shadowPaintMode = useRef<boolean>(true);
  const shadowPainted = useRef<Set<string>>(new Set());

  // Store subscriptions (only what JSX needs directly)
  const currentMap = useEditorStore((s) => s.currentMap);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const editMode = useEditorStore((s) => s.editMode);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const clipboard = useEditorStore((s) => s.clipboard);
  const selectionStart = useEditorStore((s) => s.selectionStart);
  const selectionEnd = useEditorStore((s) => s.selectionEnd);
  const isPasting = useEditorStore((s) => s.isPasting);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const setPlayerStartPosition = useEditorStore((s) => s.setPlayerStartPosition);
  const copyEvent = useEditorStore((s) => s.copyEvent);
  const deleteEvent = useEditorStore((s) => s.deleteEvent);
  const selectedCameraZoneId = useEditorStore((s) => s.selectedCameraZoneId);
  const selectedCameraZoneIds = useEditorStore((s) => s.selectedCameraZoneIds);
  const selectedEventIds = useEditorStore((s) => s.selectedEventIds);
  const copyEvents = useEditorStore((s) => s.copyEvents);
  const deleteEvents = useEditorStore((s) => s.deleteEvents);
  const pasteEvents = useEditorStore((s) => s.pasteEvents);
  const setEditMode = useEditorStore((s) => s.setEditMode);
  const setShowFindDialog = useEditorStore((s) => s.setShowFindDialog);
  const copyTiles = useEditorStore((s) => s.copyTiles);
  const pasteTiles = useEditorStore((s) => s.pasteTiles);
  const deleteTiles = useEditorStore((s) => s.deleteTiles);
  const showToast = useEditorStore((s) => s.showToast);

  // Compose hooks
  const { showGrid, altPressed, panning } = useKeyboardShortcuts(containerRef);

  const {
    rendererObjRef, tilemapRef, stageRef, renderRequestedRef, toolPreviewMeshesRef,
    startPosMeshesRef, rendererReady,
  } = useThreeRenderer(webglCanvasRef, showGrid, []);

  const tools = useMapTools(
    webglCanvasRef, pendingChanges, shadowPaintMode, shadowPainted,
    toolPreviewMeshesRef, rendererObjRef, stageRef, renderRequestedRef,
  );

  const {
    handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave,
    handleDoubleClick, handleContextMenu, createNewEvent,
    resizePreview, resizeCursor, eventMultiDragDelta,
    lightMultiDragDelta, objectMultiDragDelta,
    lightDragPreview, objectDragPreview, cameraZoneDragPreview, cameraZoneMultiDragDelta, hoverTile,
    eventCtxMenu, mapCtxMenu, editingEventId, setEditingEventId,
    closeEventCtxMenu, closeMapCtxMenu,
    isDraggingLight, isDraggingObject, draggedObjectId,
    resizeOrigSize, cameraZoneCursor,
    playerStartDragPos,
  } = useMouseHandlers(webglCanvasRef, tools, pendingChanges);

  // Overlay refs shared by sub-hooks
  const overlayRefs = useMemo(() => ({ rendererObjRef, stageRef, renderRequestedRef, tilemapRef }), [rendererObjRef, stageRef, renderRequestedRef, tilemapRef]);
  const syncRefs = useMemo(() => ({ rendererObjRef, stageRef, renderRequestedRef, startPosMeshesRef }), [rendererObjRef, stageRef, renderRequestedRef, startPosMeshesRef]);

  // Drag previews
  const dragPreviews = useDragPreviews(
    eventMultiDragDelta, lightMultiDragDelta, objectMultiDragDelta,
    lightDragPreview, objectDragPreview,
    isDraggingLight, isDraggingObject, draggedObjectId,
  );
  useDragPreviewMeshSync(syncRefs, dragPreviews, rendererReady);
  useCameraZoneMeshCleanup(syncRefs, rendererReady);
  usePlayerStartDragPreview(syncRefs, playerStartDragPos, rendererReady);

  // Selection overlays
  useSelectionRectOverlay(overlayRefs, rendererReady);
  usePastePreviewOverlay(overlayRefs, rendererReady);

  // Entity selection overlays
  useEventSelectionOverlays(overlayRefs, rendererReady);
  useLightSelectionOverlays(overlayRefs, rendererReady);
  useObjectSelectionOverlays(overlayRefs, rendererReady);
  useMoveRouteOverlay(overlayRefs, hoverTile, rendererReady);

  // Tile cursor preview
  useTileCursorPreview(overlayRefs, hoverTile, rendererReady);

  // 이미지로 저장
  const handleSaveAsImage = useCallback(() => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const mapName = currentMapId ? `Map${String(currentMapId).padStart(3, '0')}` : 'map';
      link.download = `${mapName}.png`;
      link.href = dataUrl;
      link.click();
      showToast(t('mapCtx.imageSaved'));
    } catch {
      showToast(t('mapCtx.imageSaveFailed'));
    }
  }, [currentMapId, showToast, t]);

  // 시프트 / 샘플맵 다이얼로그 상태
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [showSampleMapDialog, setShowSampleMapDialog] = useState(false);

  useEffect(() => {
    const onShift = () => setShowShiftDialog(true);
    const onLoadSample = () => setShowSampleMapDialog(true);
    window.addEventListener('editor-shift-map', onShift);
    window.addEventListener('editor-load-sample-map', onLoadSample);
    return () => {
      window.removeEventListener('editor-shift-map', onShift);
      window.removeEventListener('editor-load-sample-map', onLoadSample);
    };
  }, []);

  // =========================================================================
  // Render
  // =========================================================================
  const parallaxName = currentMap?.parallaxName || '';
  const parallaxShow = currentMap?.parallaxShow ?? false;
  const mapPxW = (currentMap?.width || 0) * TILE_SIZE_PX;
  const mapPxH = (currentMap?.height || 0) * TILE_SIZE_PX;
  const MAP_PADDING = TILE_SIZE_PX * 2; // 2 tiles padding around map for resize handles

  const extendedSize = useMemo(() => {
    if (editMode !== 'cameraZone') return { width: mapPxW + MAP_PADDING, height: mapPxH + MAP_PADDING };
    let maxRight = mapPxW;
    let maxBottom = mapPxH;
    const zones = currentMap?.cameraZones;
    if (zones) {
      for (const z of zones) {
        const r = (z.x + z.width) * TILE_SIZE_PX;
        const b = (z.y + z.height) * TILE_SIZE_PX;
        if (r > maxRight) maxRight = r;
        if (b > maxBottom) maxBottom = b;
      }
    }
    if (cameraZoneDragPreview) {
      const r = (cameraZoneDragPreview.x + cameraZoneDragPreview.width) * TILE_SIZE_PX;
      const b = (cameraZoneDragPreview.y + cameraZoneDragPreview.height) * TILE_SIZE_PX;
      if (r > maxRight) maxRight = r;
      if (b > maxBottom) maxBottom = b;
    }
    return { width: maxRight + MAP_PADDING, height: maxBottom + MAP_PADDING };
  }, [editMode, currentMap?.cameraZones, cameraZoneDragPreview, mapPxW, mapPxH]);

  const eyedropperCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M20.71 5.63l-2.34-2.34a1 1 0 00-1.41 0l-3.54 3.54 1.41 1.41L16.25 6.8l.88.88-5.66 5.66-1.41-1.41-2.12 2.12a3 3 0 000 4.24l.71.71a3 3 0 004.24 0l2.12-2.12-1.41-1.41 5.66-5.66.88.88 1.41-1.41-3.54-3.54a1 1 0 000-1.41z' fill='white' stroke='black' stroke-width='0.5'/%3E%3C/svg%3E") 2 22, crosshair`;

  const transparentColor = useEditorStore((s) => s.transparentColor);
  const containerStyle = useMemo(() => ({
    flex: 1 as const,
    overflow: 'auto' as const,
    backgroundColor: '#1a1a1a',
    border: '1px solid #555',
    cursor: panning ? 'grabbing' : undefined,
  }), [panning]);

  const mapBgStyle = useMemo(() => {
    const { r, g, b } = transparentColor;
    const c1 = `rgb(${r}, ${g}, ${b})`;
    const dr = Math.max(0, r - 48), dg = Math.max(0, g - 48), db = Math.max(0, b - 48);
    const c2 = `rgb(${dr}, ${dg}, ${db})`;
    return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: mapPxW,
      height: mapPxH,
      backgroundColor: c1,
      backgroundImage: `
        linear-gradient(45deg, ${c2} 25%, transparent 25%),
        linear-gradient(-45deg, ${c2} 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, ${c2} 75%),
        linear-gradient(-45deg, transparent 75%, ${c2} 75%)
      `,
      backgroundSize: '16px 16px',
      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
      zIndex: 0,
    };
  }, [transparentColor, mapPxW, mapPxH]);

  return (
    <>
    {(editMode === 'map' || editMode === 'event') && (
      <div className="map-panel-header">
        <span className="map-panel-header-title">
          {currentMapId ? `Map${String(currentMapId).padStart(3, '0')}` : ''}
        </span>
        <div
          className="map-panel-header-folder-btn"
          title={t('menu.openFolder')}
          onClick={() => apiClient.post('/project/open-folder', { subfolder: 'data' }).catch(() => {})}
        >
          📂
        </div>
      </div>
    )}
    <div ref={containerRef} style={containerStyle} onClick={() => { closeEventCtxMenu(); closeMapCtxMenu(); }}>
      <div style={{
        position: 'relative',
        transform: `scale(${zoomLevel})`,
        transformOrigin: '0 0',
        minWidth: extendedSize.width,
        minHeight: extendedSize.height,
      }}>
        {/* Map interior checkerboard background */}
        <div style={mapBgStyle} />
        {parallaxName && parallaxShow && (
          <div
            ref={parallaxDivRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: mapPxW,
              height: mapPxH,
              backgroundImage: `url(/api/resources/parallaxes/${parallaxName}.png)`,
              backgroundRepeat: 'repeat',
              backgroundSize: 'auto',
              zIndex: 0,
            }}
          />
        )}
        <canvas
          ref={webglCanvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          style={{
            ...styles.canvas,
            position: 'relative',
            zIndex: 1,
            cursor: panning ? 'grabbing'
              : altPressed && editMode === 'map' ? eyedropperCursor
              : cameraZoneCursor
              || resizeCursor
              || (selectedTool === 'select' && isPasting ? 'copy'
                : selectedTool === 'select' && selectionStart && selectionEnd && hoverTile
                  && hoverTile.x >= Math.min(selectionStart.x, selectionEnd.x)
                  && hoverTile.x <= Math.max(selectionStart.x, selectionEnd.x)
                  && hoverTile.y >= Math.min(selectionStart.y, selectionEnd.y)
                  && hoverTile.y <= Math.max(selectionStart.y, selectionEnd.y) ? 'move'
                : selectedTool === 'select' ? 'crosshair'
                : editMode === 'event' ? 'pointer'
                : 'crosshair'),
          }}
        />
        {/* Camera Zone HTML overlays */}
        {editMode === 'cameraZone' && currentMap?.cameraZones && currentMap.cameraZones.map((zone) => {
          const isSelected = selectedCameraZoneIds.includes(zone.id);
          const isDragged = isSelected && cameraZoneMultiDragDelta;
          const zx = (zone.x + (isDragged ? cameraZoneMultiDragDelta.dx : 0)) * TILE_SIZE_PX;
          const zy = (zone.y + (isDragged ? cameraZoneMultiDragDelta.dy : 0)) * TILE_SIZE_PX;
          const zw = zone.width * TILE_SIZE_PX;
          const zh = zone.height * TILE_SIZE_PX;
          return (
            <React.Fragment key={zone.id}>
              <div style={{
                position: 'absolute', left: zx, top: zy, width: zw, height: zh,
                background: isSelected ? 'rgba(255,136,0,0.25)' : 'rgba(34,136,255,0.15)',
                border: `2px dashed ${isSelected ? '#ffaa44' : '#44aaff'}`,
                boxSizing: 'border-box',
                pointerEvents: 'none',
                zIndex: 2,
              }} />
              {zone.name && (
                <div style={{
                  position: 'absolute',
                  left: zx + 4,
                  top: zy + 4,
                  background: 'rgba(0,0,0,0.6)',
                  color: isSelected ? '#ffaa44' : '#88ccff',
                  fontSize: 14,
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  pointerEvents: 'none',
                  zIndex: 2,
                  whiteSpace: 'nowrap',
                }}>
                  {zone.name}
                </div>
              )}
            </React.Fragment>
          );
        })}
        {/* Camera Zone drag/creation preview */}
        {editMode === 'cameraZone' && cameraZoneDragPreview && (
          <div style={{
            position: 'absolute',
            left: cameraZoneDragPreview.x * TILE_SIZE_PX,
            top: cameraZoneDragPreview.y * TILE_SIZE_PX,
            width: cameraZoneDragPreview.width * TILE_SIZE_PX,
            height: cameraZoneDragPreview.height * TILE_SIZE_PX,
            background: 'rgba(68,255,136,0.2)',
            border: '2px dashed #44ff88',
            boxSizing: 'border-box',
            pointerEvents: 'none',
            zIndex: 2,
          }} />
        )}
        {/* Resize preview overlay */}
        {resizePreview && currentMap && (() => {
          const { dLeft, dTop, dRight, dBottom } = resizePreview;
          const origW = resizeOrigSize.current.w;
          const origH = resizeOrigSize.current.h;
          const newW = origW + dRight - dLeft;
          const newH = origH + dBottom - dTop;
          const previewLeft = dLeft * TILE_SIZE_PX;
          const previewTop = dTop * TILE_SIZE_PX;
          const previewW = newW * TILE_SIZE_PX;
          const previewH = newH * TILE_SIZE_PX;
          return (
            <>
              <div style={{
                position: 'absolute',
                left: previewLeft,
                top: previewTop,
                width: previewW,
                height: previewH,
                border: '2px dashed #4af',
                pointerEvents: 'none',
                zIndex: 3,
                boxSizing: 'border-box',
              }} />
              <div style={{
                position: 'absolute',
                left: previewLeft + previewW / 2,
                top: previewTop - 20,
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.7)',
                color: '#4af',
                padding: '2px 8px',
                borderRadius: 3,
                fontSize: 12,
                fontWeight: 'bold',
                pointerEvents: 'none',
                zIndex: 4,
                whiteSpace: 'nowrap',
              }}>
                {origW}x{origH} → {newW}x{newH}
              </div>
            </>
          );
        })()}
      </div>

      {mapCtxMenu && (
        <div className="context-menu" style={{ left: mapCtxMenu.x, top: mapCtxMenu.y }} onClick={e => e.stopPropagation()}>
          <div className="context-menu-item" onClick={() => { closeMapCtxMenu(); setEditMode('event'); }}>
            {t('mapCtx.editMode')}
            <span className="context-menu-shortcut">{t('mapCtx.space')}</span>
          </div>
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={() => { closeMapCtxMenu(); createNewEvent(mapCtxMenu.tileX, mapCtxMenu.tileY); setEditMode('event'); }}>
            {t('mapCtx.newEvent')}
          </div>
          <div className="context-menu-item" onClick={() => { closeMapCtxMenu(); window.dispatchEvent(new CustomEvent('editor-load-sample-map')); }}>
            {t('mapCtx.loadSampleMap')}
          </div>
          <div className="context-menu-separator" />
          {selectionStart && selectionEnd ? (
            <>
              <div className="context-menu-item" onClick={() => {
                copyTiles(Math.min(selectionStart.x, selectionEnd.x), Math.min(selectionStart.y, selectionEnd.y),
                  Math.max(selectionStart.x, selectionEnd.x), Math.max(selectionStart.y, selectionEnd.y));
                closeMapCtxMenu();
              }}>
                {t('mapCtx.copy')}
                <span className="context-menu-shortcut">⌘C</span>
              </div>
              <div className={`context-menu-item${!clipboard || clipboard.type !== 'tiles' ? ' disabled' : ''}`} onClick={() => {
                if (clipboard?.type === 'tiles') {
                  pasteTiles(Math.min(selectionStart.x, selectionEnd.x), Math.min(selectionStart.y, selectionEnd.y));
                }
                closeMapCtxMenu();
              }}>
                {t('mapCtx.paste')}
                <span className="context-menu-shortcut">⌘V</span>
              </div>
              <div className="context-menu-item" onClick={() => {
                deleteTiles(Math.min(selectionStart.x, selectionEnd.x), Math.min(selectionStart.y, selectionEnd.y),
                  Math.max(selectionStart.x, selectionEnd.x), Math.max(selectionStart.y, selectionEnd.y));
                closeMapCtxMenu();
              }}>
                {t('mapCtx.delete')}
                <span className="context-menu-shortcut">⌫</span>
              </div>
            </>
          ) : (
            <>
              <div className="context-menu-item disabled">
                {t('mapCtx.copy')}
                <span className="context-menu-shortcut">⌘C</span>
              </div>
              <div className="context-menu-item disabled">
                {t('mapCtx.paste')}
                <span className="context-menu-shortcut">⌘V</span>
              </div>
              <div className="context-menu-item disabled">
                {t('mapCtx.delete')}
                <span className="context-menu-shortcut">⌫</span>
              </div>
            </>
          )}
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={() => { closeMapCtxMenu(); setShowFindDialog(true); }}>
            {t('mapCtx.find')}
            <span className="context-menu-shortcut">⌘F</span>
          </div>
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={() => { closeMapCtxMenu(); window.dispatchEvent(new CustomEvent('editor-shift-map')); }}>
            {t('mapCtx.shift')}
            <span className="context-menu-shortcut">⌘T</span>
          </div>
          <div className="context-menu-item" onClick={() => { closeMapCtxMenu(); handleSaveAsImage(); }}>
            {t('mapCtx.saveAsImage')}
          </div>
        </div>
      )}

      {eventCtxMenu && (
        <div className="context-menu" style={{ left: eventCtxMenu.x, top: eventCtxMenu.y }} onClick={e => e.stopPropagation()}>
          {eventCtxMenu.eventId == null && (
            <div className="context-menu-item" onClick={() => { createNewEvent(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>새 이벤트...</div>
          )}
          {eventCtxMenu.eventId != null && selectedEventIds.length > 1 && selectedEventIds.includes(eventCtxMenu.eventId) && (
            <>
              <div className="context-menu-item" onClick={() => { copyEvents(selectedEventIds); closeEventCtxMenu(); }}>복사 ({selectedEventIds.length}개)</div>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={() => { deleteEvents(selectedEventIds); closeEventCtxMenu(); }}>삭제 ({selectedEventIds.length}개)</div>
            </>
          )}
          {eventCtxMenu.eventId != null && !(selectedEventIds.length > 1 && selectedEventIds.includes(eventCtxMenu.eventId)) && (
            <>
              <div className="context-menu-item" onClick={() => { setEditingEventId(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>편집...</div>
              <div className="context-menu-item" onClick={() => { copyEvent(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>복사</div>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={() => { deleteEvent(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>삭제</div>
            </>
          )}
          {(clipboard?.type === 'event' || clipboard?.type === 'events') && (
            <>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={() => { pasteEvents(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>붙여넣기</div>
            </>
          )}
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={() => { if (currentMapId) setPlayerStartPosition(currentMapId, eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>시작 위치 설정</div>
        </div>
      )}

      {editingEventId != null && (
        <EventDetail eventId={editingEventId} onClose={() => setEditingEventId(null)} />
      )}

      {showShiftDialog && (
        <ShiftMapDialog onClose={() => setShowShiftDialog(false)} />
      )}

      {showSampleMapDialog && (
        <SampleMapDialog onClose={() => setShowSampleMapDialog(false)} />
      )}
    </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  canvas: {
    display: 'block',
    imageRendering: 'pixelated',
  },
};
