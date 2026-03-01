import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { TileChange } from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import EventDetail from '../EventEditor/EventDetail';
import ShiftMapDialog from './ShiftMapDialog';
import SampleMapDialog from '../SampleMapDialog';
import MapCanvasContextMenu from './MapCanvasContextMenu';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useThreeRenderer } from './useThreeRenderer';
import { useMapTools } from './useMapTools';
import { useMouseHandlers } from './useMouseHandlers';
import { useEventSelectionOverlays, useLightSelectionOverlays, useObjectSelectionOverlays } from './useEntitySelectionOverlays';
import { useMoveRouteOverlay } from './useMoveRouteOverlay';
import { useWaypointMode } from './useWaypointMode';
import { useSelectionRectOverlay, usePastePreviewOverlay } from './useSelectionOverlays';
import { useCameraZoneOverlay } from './overlays';
import { useTileCursorPreview } from './useTileCursorPreview';
import { useDragPreviews, useDragPreviewMeshSync, useCameraZoneMeshCleanup, usePlayerStartDragPreview, useTestStartDragPreview, useVehicleStartDragPreview } from './useDragPreviewSync';
import { useMapScrollPersistence } from './useMapScrollPersistence';
import TileInfoTooltip from './TileInfoTooltip';
import Camera3DGizmo from './Camera3DGizmo';
import './MapCanvas.css';


export default function MapCanvas() {
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
  const selectionStart = useEditorStore((s) => s.selectionStart);
  const selectionEnd = useEditorStore((s) => s.selectionEnd);
  const isPasting = useEditorStore((s) => s.isPasting);
  const isEventPasting = useEditorStore((s) => s.isEventPasting);
  const isLightPasting = useEditorStore((s) => s.isLightPasting);
  const isObjectPasting = useEditorStore((s) => s.isObjectPasting);
  const passageTool = useEditorStore((s) => s.passageTool);
  const isPassagePasting = useEditorStore((s) => s.isPassagePasting);
  const passageSelectionStart = useEditorStore((s) => s.passageSelectionStart);
  const passageSelectionEnd = useEditorStore((s) => s.passageSelectionEnd);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const selectedCameraZoneIds = useEditorStore((s) => s.selectedCameraZoneIds);
  const showTileInfo = useEditorStore((s) => s.showTileInfo);
  const mode3d = useEditorStore((s) => s.mode3d);
  const objectBrushTiles = useEditorStore((s) => s.objectBrushTiles);

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
    pendingNewEvent, setPendingNewEvent,
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
  useCameraZoneOverlay(overlayRefs, rendererReady, cameraZoneMultiDragDelta, cameraZoneDragPreview);
  useWaypointMode(webglCanvasRef);

  // 맵 캔버스 외부 클릭 시 시작 위치 선택 해제
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const sel = useEditorStore.getState().selectedStartPosition;
        if (sel != null) {
          useEditorStore.getState().setSelectedStartPosition(null);
        }
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useMapScrollPersistence(containerRef, currentMapId, zoomLevel);

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
    if ((showTileInfo && editMode === 'map') || objectBrushTiles) {
      setMouseScreenPos({ x: e.clientX, y: e.clientY });
    }
  }, [handleMouseMove, showTileInfo, editMode, objectBrushTiles]);
  const handleMouseLeaveWithTooltip = useCallback((e: React.MouseEvent<HTMLElement>) => {
    handleMouseLeave(e);
    setMouseScreenPos(null);
  }, [handleMouseLeave]);

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

  // Parallax background overlay style
  const parallaxBgStyle = useMemo(() => {
    const name = currentMap?.parallaxName;
    const show = currentMap?.parallaxShow;
    if (!name || !show) return null;
    const loopX = currentMap?.parallaxLoopX;
    const loopY = currentMap?.parallaxLoopY;
    const url = `/img/parallaxes/${encodeURIComponent(name)}.png`;
    let repeat: string;
    if (loopX && loopY) repeat = 'repeat';
    else if (loopX) repeat = 'repeat-x';
    else if (loopY) repeat = 'repeat-y';
    else repeat = 'no-repeat';
    return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: mapPxW,
      height: mapPxH,
      backgroundImage: `url("${url}")`,
      backgroundRepeat: repeat,
      backgroundSize: (!loopX && !loopY) ? 'cover' : 'auto',
      backgroundPosition: '0 0',
      zIndex: 0,
      pointerEvents: 'none' as const,
    };
  }, [currentMap?.parallaxName, currentMap?.parallaxShow, currentMap?.parallaxLoopX, currentMap?.parallaxLoopY, mapPxW, mapPxH]);

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
        {/* Parallax background overlay (에디터 표시용) */}
        {parallaxBgStyle && <div style={parallaxBgStyle} />}
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
                : isEventPasting || isLightPasting || isObjectPasting ? 'copy'
                : editMode === 'event' ? 'pointer'
                : 'crosshair'),
          }}
        />
        {/* Camera Zone HTML overlays (2D 모드에서만 표시 — 3D 모드는 Three.js 메쉬로 처리) */}
        {!mode3d && editMode === 'cameraZone' && currentMap?.cameraZones && currentMap.cameraZones.map((zone) => {
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
        {/* Camera Zone drag/creation preview (2D 모드에서만 표시) */}
        {!mode3d && editMode === 'cameraZone' && cameraZoneDragPreview && (
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

      {eventCtxMenu && (
        <MapCanvasContextMenu
          eventCtxMenu={eventCtxMenu}
          closeEventCtxMenu={closeEventCtxMenu}
          setEditingEventId={setEditingEventId}
          createNewEvent={createNewEvent}
        />
      )}

      {editingEventId != null && (
        <EventDetail eventId={editingEventId} onClose={() => setEditingEventId(null)} />
      )}

      {pendingNewEvent != null && (
        <EventDetail pendingEvent={pendingNewEvent} onClose={() => setPendingNewEvent(null)} />
      )}

      {showShiftDialog && (
        <ShiftMapDialog onClose={() => setShowShiftDialog(false)} />
      )}

      {showSampleMapDialog && (
        <SampleMapDialog onClose={() => setShowSampleMapDialog(false)} />
      )}

      {showTileInfo && editMode === 'map' && hoverTile && mouseScreenPos && (
        <TileInfoTooltip
          tileX={hoverTile.x}
          tileY={hoverTile.y}
          mouseX={mouseScreenPos.x}
          mouseY={mouseScreenPos.y}
        />
      )}
      {objectBrushTiles && mouseScreenPos && (
        <div style={{
          position: 'fixed',
          left: mouseScreenPos.x + 14,
          top: mouseScreenPos.y + 20,
          background: 'rgba(0,0,0,0.75)',
          color: '#ccc',
          fontSize: 11,
          padding: '3px 8px',
          borderRadius: 3,
          pointerEvents: 'none',
          zIndex: 9999,
          whiteSpace: 'nowrap',
          border: '1px solid #555',
        }}>
          클릭으로 배치 · <span style={{ color: '#f88' }}>ESC</span> 취소
        </div>
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
