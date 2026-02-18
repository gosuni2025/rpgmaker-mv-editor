import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useEditorStore from '../../store/useEditorStore';
import type { TileChange } from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import EventDetail from '../EventEditor/EventDetail';
import ShiftMapDialog from './ShiftMapDialog';
import SampleMapDialog from '../SampleMapDialog';
import QuickEventDialog from './QuickEventDialog';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useThreeRenderer } from './useThreeRenderer';
import { useMapTools } from './useMapTools';
import { useMouseHandlers } from './useMouseHandlers';
import { useEventSelectionOverlays, useLightSelectionOverlays, useObjectSelectionOverlays } from './useEntitySelectionOverlays';
import { useMoveRouteOverlay } from './useMoveRouteOverlay';
import { useSelectionRectOverlay, usePastePreviewOverlay } from './useSelectionOverlays';
import { useTileCursorPreview } from './useTileCursorPreview';
import { useDragPreviews, useDragPreviewMeshSync, useCameraZoneMeshCleanup, usePlayerStartDragPreview, useTestStartDragPreview, useVehicleStartDragPreview } from './useDragPreviewSync';
import TileInfoTooltip from './TileInfoTooltip';
import Camera3DGizmo from './Camera3DGizmo';
import './MapCanvas.css';

/** 컨텍스트 메뉴가 화면 밖으로 벗어나지 않도록 위치를 보정하는 ref callback */
function clampMenuRef(el: HTMLDivElement | null) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (rect.bottom > vh) {
    el.style.top = `${Math.max(0, vh - rect.height - 4)}px`;
  }
  if (rect.right > vw) {
    el.style.left = `${Math.max(0, vw - rect.width - 4)}px`;
  }
}

export default function MapCanvas() {
  const { t } = useTranslation();

  // DOM refs
  const containerRef = useRef<HTMLDivElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);

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
  const passageTool = useEditorStore((s) => s.passageTool);
  const isPassagePasting = useEditorStore((s) => s.isPassagePasting);
  const passageSelectionStart = useEditorStore((s) => s.passageSelectionStart);
  const passageSelectionEnd = useEditorStore((s) => s.passageSelectionEnd);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const setPlayerStartPosition = useEditorStore((s) => s.setPlayerStartPosition);
  const copyEvent = useEditorStore((s) => s.copyEvent);
  const cutEvent = useEditorStore((s) => s.cutEvent);
  const deleteEvent = useEditorStore((s) => s.deleteEvent);
  const setVehicleStartPosition = useEditorStore((s) => s.setVehicleStartPosition);
  const setTestStartPosition = useEditorStore((s) => s.setTestStartPosition);
  const clearTestStartPosition = useEditorStore((s) => s.clearTestStartPosition);
  const clearVehicleStartPosition = useEditorStore((s) => s.clearVehicleStartPosition);
  const systemData = useEditorStore((s) => s.systemData);
  const selectedCameraZoneId = useEditorStore((s) => s.selectedCameraZoneId);
  const selectedCameraZoneIds = useEditorStore((s) => s.selectedCameraZoneIds);
  const selectedEventIds = useEditorStore((s) => s.selectedEventIds);
  const copyEvents = useEditorStore((s) => s.copyEvents);
  const deleteEvents = useEditorStore((s) => s.deleteEvents);
  const pasteEvents = useEditorStore((s) => s.pasteEvents);
  const setShowFindDialog = useEditorStore((s) => s.setShowFindDialog);
  const showTileInfo = useEditorStore((s) => s.showTileInfo);

  // Compose hooks
  const { showGrid, showTileId, altPressed, panning } = useKeyboardShortcuts(containerRef);

  const {
    rendererObjRef, tilemapRef, stageRef, renderRequestedRef, toolPreviewMeshesRef,
    startPosMeshesRef, testStartPosMeshesRef, vehicleStartPosMeshesRef, rendererReady,
  } = useThreeRenderer(webglCanvasRef, showGrid, [], undefined, showTileId);

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
    eventCtxMenu, editingEventId, setEditingEventId,
    closeEventCtxMenu,
    isDraggingLight, isDraggingObject, draggedObjectId,
    resizeOrigSize, cameraZoneCursor,
    playerStartDragPos, testStartDragPos, vehicleStartDragPos,
  } = useMouseHandlers(webglCanvasRef, tools, pendingChanges);

  // Overlay refs shared by sub-hooks
  const overlayRefs = useMemo(() => ({ rendererObjRef, stageRef, renderRequestedRef, tilemapRef }), [rendererObjRef, stageRef, renderRequestedRef, tilemapRef]);
  const syncRefs = useMemo(() => ({ rendererObjRef, stageRef, renderRequestedRef, startPosMeshesRef, testStartPosMeshesRef, vehicleStartPosMeshesRef }), [rendererObjRef, stageRef, renderRequestedRef, startPosMeshesRef, testStartPosMeshesRef, vehicleStartPosMeshesRef]);

  // Drag previews
  const dragPreviews = useDragPreviews(
    eventMultiDragDelta, lightMultiDragDelta, objectMultiDragDelta,
    lightDragPreview, objectDragPreview,
    isDraggingLight, isDraggingObject, draggedObjectId,
  );
  useDragPreviewMeshSync(syncRefs, dragPreviews, rendererReady);
  useCameraZoneMeshCleanup(syncRefs, rendererReady);
  usePlayerStartDragPreview(syncRefs, playerStartDragPos, rendererReady);
  useTestStartDragPreview(syncRefs, testStartDragPos, rendererReady);
  useVehicleStartDragPreview(syncRefs, vehicleStartDragPos, rendererReady);

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

  // 이벤트 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!eventCtxMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.context-menu')) return;
      closeEventCtxMenu();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [eventCtxMenu, closeEventCtxMenu]);

  // 마우스 screen 좌표 (툴팁용)
  const [mouseScreenPos, setMouseScreenPos] = useState<{ x: number; y: number } | null>(null);
  const handleMouseMoveWithTooltip = useCallback((e: React.MouseEvent<HTMLElement>) => {
    handleMouseMove(e);
    if (showTileInfo && editMode === 'map') {
      setMouseScreenPos({ x: e.clientX, y: e.clientY });
    }
  }, [handleMouseMove, showTileInfo, editMode]);
  const handleMouseLeaveWithTooltip = useCallback((e: React.MouseEvent<HTMLElement>) => {
    handleMouseLeave(e);
    setMouseScreenPos(null);
  }, [handleMouseLeave]);

  // 시프트 / 샘플맵 / 이벤트 간단 작성 다이얼로그 상태
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [showSampleMapDialog, setShowSampleMapDialog] = useState(false);
  const [quickEventType, setQuickEventType] = useState<'transfer' | 'door' | 'treasure' | 'inn' | null>(null);
  const [quickEventPos, setQuickEventPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
    <div style={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Camera3DGizmo />
      <div ref={containerRef} style={containerStyle}>
      <div style={{
        position: 'relative',
        transform: `scale(${zoomLevel})`,
        transformOrigin: '0 0',
        minWidth: extendedSize.width,
        minHeight: extendedSize.height,
      }}>
        {/* Map interior checkerboard background */}
        <div style={mapBgStyle} />
        <canvas
          ref={webglCanvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMoveWithTooltip}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeaveWithTooltip}
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
              || (editMode === 'passage' && passageTool === 'select' && isPassagePasting ? 'copy'
                : editMode === 'passage' && passageTool === 'select' && passageSelectionStart && passageSelectionEnd && hoverTile
                  && hoverTile.x >= Math.min(passageSelectionStart.x, passageSelectionEnd.x)
                  && hoverTile.x <= Math.max(passageSelectionStart.x, passageSelectionEnd.x)
                  && hoverTile.y >= Math.min(passageSelectionStart.y, passageSelectionEnd.y)
                  && hoverTile.y <= Math.max(passageSelectionStart.y, passageSelectionEnd.y) ? 'move'
                : editMode === 'passage' && passageTool === 'select' ? 'crosshair'
                : selectedTool === 'select' && isPasting ? 'copy'
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

      {eventCtxMenu && (() => {
        const hasEvent = eventCtxMenu.eventId != null;
        const isMulti = hasEvent && selectedEventIds.length > 1 && selectedEventIds.includes(eventCtxMenu.eventId!);
        const hasPaste = clipboard?.type === 'event' || clipboard?.type === 'events';
        return (
          <div ref={clampMenuRef} className="context-menu" style={{ left: eventCtxMenu.x, top: eventCtxMenu.y }} onClick={e => e.stopPropagation()}>
            {hasEvent ? (
              <div className="context-menu-item" onClick={() => { setEditingEventId(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>
                {t('eventCtx.edit')}
                <span className="context-menu-shortcut">Enter</span>
              </div>
            ) : (
              <div className="context-menu-item" onClick={() => { createNewEvent(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>
                {t('eventCtx.new')}
                <span className="context-menu-shortcut">Enter</span>
              </div>
            )}
            <div className="context-menu-separator" />

            {isMulti ? (
              <>
                <div className="context-menu-item" onClick={() => { for (const id of selectedEventIds) cutEvent(id); closeEventCtxMenu(); }}>
                  {t('eventCtx.cut')} ({t('eventCtx.items', { count: selectedEventIds.length })})
                  <span className="context-menu-shortcut">⌘X</span>
                </div>
                <div className="context-menu-item" onClick={() => { copyEvents(selectedEventIds); closeEventCtxMenu(); }}>
                  {t('eventCtx.copy')} ({t('eventCtx.items', { count: selectedEventIds.length })})
                  <span className="context-menu-shortcut">⌘C</span>
                </div>
              </>
            ) : (
              <>
                <div className={`context-menu-item${hasEvent ? '' : ' disabled'}`} onClick={() => { if (hasEvent) { cutEvent(eventCtxMenu.eventId!); closeEventCtxMenu(); } }}>
                  {t('eventCtx.cut')}
                  <span className="context-menu-shortcut">⌘X</span>
                </div>
                <div className={`context-menu-item${hasEvent ? '' : ' disabled'}`} onClick={() => { if (hasEvent) { copyEvent(eventCtxMenu.eventId!); closeEventCtxMenu(); } }}>
                  {t('eventCtx.copy')}
                  <span className="context-menu-shortcut">⌘C</span>
                </div>
              </>
            )}
            <div className={`context-menu-item${hasPaste ? '' : ' disabled'}`} onClick={() => { if (hasPaste) { pasteEvents(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); } }}>
              {t('eventCtx.paste')}
              <span className="context-menu-shortcut">⌘V</span>
            </div>
            {isMulti ? (
              <div className="context-menu-item" onClick={() => { deleteEvents(selectedEventIds); closeEventCtxMenu(); }}>
                {t('eventCtx.delete')} ({t('eventCtx.items', { count: selectedEventIds.length })})
                <span className="context-menu-shortcut">⌫</span>
              </div>
            ) : (
              <div className={`context-menu-item${hasEvent ? '' : ' disabled'}`} onClick={() => { if (hasEvent) { deleteEvent(eventCtxMenu.eventId!); closeEventCtxMenu(); } }}>
                {t('eventCtx.delete')}
                <span className="context-menu-shortcut">⌫</span>
              </div>
            )}
            <div className="context-menu-separator" />

            <div className="context-menu-item" onClick={() => { closeEventCtxMenu(); setShowFindDialog(true); }}>
              {t('eventCtx.find')}
              <span className="context-menu-shortcut">⌘F</span>
            </div>
            <div className="context-menu-item" onClick={() => { closeEventCtxMenu(); setShowFindDialog(true); }}>
              {t('eventCtx.findNext')}
              <span className="context-menu-shortcut">⌘G</span>
            </div>
            <div className="context-menu-item" onClick={() => { closeEventCtxMenu(); setShowFindDialog(true); }}>
              {t('eventCtx.findPrev')}
              <span className="context-menu-shortcut">⌥⌘G</span>
            </div>
            <div className="context-menu-separator" />

            <div className="context-menu-item has-submenu">
              {t('eventCtx.quickEvent')}
              <div className="context-submenu">
                <div className="context-menu-item" onClick={() => { setQuickEventPos({ x: eventCtxMenu.tileX, y: eventCtxMenu.tileY }); setQuickEventType('transfer'); closeEventCtxMenu(); }}>
                  {t('eventCtx.quickTransfer')}
                  <span className="context-menu-shortcut">⌘1</span>
                </div>
                <div className="context-menu-item" onClick={() => { setQuickEventPos({ x: eventCtxMenu.tileX, y: eventCtxMenu.tileY }); setQuickEventType('door'); closeEventCtxMenu(); }}>
                  {t('eventCtx.quickDoor')}
                  <span className="context-menu-shortcut">⌘2</span>
                </div>
                <div className="context-menu-item" onClick={() => { setQuickEventPos({ x: eventCtxMenu.tileX, y: eventCtxMenu.tileY }); setQuickEventType('treasure'); closeEventCtxMenu(); }}>
                  {t('eventCtx.quickTreasure')}
                  <span className="context-menu-shortcut">⌘3</span>
                </div>
                <div className="context-menu-item" onClick={() => { setQuickEventPos({ x: eventCtxMenu.tileX, y: eventCtxMenu.tileY }); setQuickEventType('inn'); closeEventCtxMenu(); }}>
                  {t('eventCtx.quickInn')}
                  <span className="context-menu-shortcut">⌘4</span>
                </div>
              </div>
            </div>

            <div className="context-menu-item has-submenu">
              {t('eventCtx.startPosition')}
              <div className="context-submenu">
                <div className="context-menu-item" onClick={() => { if (currentMapId) setPlayerStartPosition(currentMapId, eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>
                  {t('eventCtx.player')}
                </div>
                <div className="context-menu-item" onClick={() => { if (currentMapId) setVehicleStartPosition('boat', currentMapId, eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>
                  {t('eventCtx.boat')}
                </div>
                <div className="context-menu-item" onClick={() => { if (currentMapId) setVehicleStartPosition('ship', currentMapId, eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>
                  {t('eventCtx.ship')}
                </div>
                <div className="context-menu-item" onClick={() => { if (currentMapId) setVehicleStartPosition('airship', currentMapId, eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>
                  {t('eventCtx.airship')}
                </div>
              </div>
            </div>

            <div className="context-menu-item" onClick={() => { setTestStartPosition(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>
              {t('eventCtx.testStartPosition')}
              <span className="context-menu-ext-badge">EXT</span>
            </div>
            {currentMap?.testStartPosition && (
              <div className="context-menu-item" onClick={() => { clearTestStartPosition(); closeEventCtxMenu(); }}>
                {t('eventCtx.clearTestStartPosition')}
                <span className="context-menu-ext-badge">EXT</span>
              </div>
            )}

            {systemData && (systemData.boat?.startMapId === currentMapId || systemData.ship?.startMapId === currentMapId || systemData.airship?.startMapId === currentMapId) && (
              <div className="context-menu-item has-submenu">
                {t('eventCtx.clearStartPosition')}
                <div className="context-submenu">
                  {systemData.boat?.startMapId === currentMapId && (
                    <div className="context-menu-item" onClick={() => { clearVehicleStartPosition('boat'); closeEventCtxMenu(); }}>
                      {t('eventCtx.boat')}
                    </div>
                  )}
                  {systemData.ship?.startMapId === currentMapId && (
                    <div className="context-menu-item" onClick={() => { clearVehicleStartPosition('ship'); closeEventCtxMenu(); }}>
                      {t('eventCtx.ship')}
                    </div>
                  )}
                  {systemData.airship?.startMapId === currentMapId && (
                    <div className="context-menu-item" onClick={() => { clearVehicleStartPosition('airship'); closeEventCtxMenu(); }}>
                      {t('eventCtx.airship')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {editingEventId != null && (
        <EventDetail eventId={editingEventId} onClose={() => setEditingEventId(null)} />
      )}

      {showShiftDialog && (
        <ShiftMapDialog onClose={() => setShowShiftDialog(false)} />
      )}

      {showSampleMapDialog && (
        <SampleMapDialog onClose={() => setShowSampleMapDialog(false)} />
      )}

      {quickEventType && (
        <QuickEventDialog
          type={quickEventType}
          tileX={quickEventPos.x}
          tileY={quickEventPos.y}
          onClose={() => setQuickEventType(null)}
        />
      )}

      {showTileInfo && editMode === 'map' && hoverTile && mouseScreenPos && (
        <TileInfoTooltip
          tileX={hoverTile.x}
          tileY={hoverTile.y}
          mouseX={mouseScreenPos.x}
          mouseY={mouseScreenPos.y}
        />
      )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  canvas: {
    display: 'block',
    imageRendering: 'pixelated',
  },
};
