import React, { useRef } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { TileChange } from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import EventDetail from '../EventEditor/EventDetail';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useThreeRenderer } from './useThreeRenderer';
import { useOverlayRenderer } from './useOverlayRenderer';
import { useMapTools } from './useMapTools';
import { useMouseHandlers } from './useMouseHandlers';

console.log('[MapCanvas] MODULE LOADED', Date.now());

export default function MapCanvas() {
  // DOM refs
  const containerRef = useRef<HTMLDivElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const parallaxDivRef = useRef<HTMLDivElement>(null);

  // Shared refs for drawing state
  const pendingChanges = useRef<TileChange[]>([]);
  const shadowPaintMode = useRef<boolean>(true);
  const shadowPainted = useRef<Set<string>>(new Set());

  // Store subscriptions (only what JSX needs directly)
  const currentMap = useEditorStore((s) => s.currentMap);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const editMode = useEditorStore((s) => s.editMode);
  const mode3d = useEditorStore((s) => s.mode3d);
  const clipboard = useEditorStore((s) => s.clipboard);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const setPlayerStartPosition = useEditorStore((s) => s.setPlayerStartPosition);
  const copyEvent = useEditorStore((s) => s.copyEvent);
  const deleteEvent = useEditorStore((s) => s.deleteEvent);
  const pasteEvent = useEditorStore((s) => s.pasteEvent);

  // Compose hooks
  const { showGrid, altPressed, panning } = useKeyboardShortcuts(containerRef);

  useThreeRenderer(webglCanvasRef, showGrid);

  const tools = useMapTools(webglCanvasRef, overlayRef, pendingChanges, shadowPaintMode, shadowPainted);

  const {
    handleMouseDown, handleMouseMove, handleMouseUp,
    handleDoubleClick, handleContextMenu, createNewEvent,
    resizePreview, resizeCursor, dragPreview,
    lightDragPreview, objectDragPreview,
    eventCtxMenu, editingEventId, setEditingEventId,
    closeEventCtxMenu,
    isDraggingEvent, isDraggingLight, isDraggingObject, draggedObjectId,
    isResizing, resizeOrigSize,
  } = useMouseHandlers(webglCanvasRef, tools, pendingChanges);

  useOverlayRenderer(
    overlayRef, showGrid,
    dragPreview, isDraggingEvent,
    lightDragPreview, isDraggingLight,
    objectDragPreview, isDraggingObject, draggedObjectId,
  );

  // =========================================================================
  // Render
  // =========================================================================
  const parallaxName = currentMap?.parallaxName || '';
  const parallaxShow = currentMap?.parallaxShow ?? false;
  const mapPxW = (currentMap?.width || 0) * TILE_SIZE_PX;
  const mapPxH = (currentMap?.height || 0) * TILE_SIZE_PX;

  const eyedropperCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M20.71 5.63l-2.34-2.34a1 1 0 00-1.41 0l-3.54 3.54 1.41 1.41L16.25 6.8l.88.88-5.66 5.66-1.41-1.41-2.12 2.12a3 3 0 000 4.24l.71.71a3 3 0 004.24 0l2.12-2.12-1.41-1.41 5.66-5.66.88.88 1.41-1.41-3.54-3.54a1 1 0 000-1.41z' fill='white' stroke='black' stroke-width='0.5'/%3E%3C/svg%3E") 2 22, crosshair`;

  return (
    <div ref={containerRef} style={{ ...styles.container, cursor: panning ? 'grabbing' : undefined }} onClick={closeEventCtxMenu}>
      <div style={{
        position: 'relative',
        transform: `scale(${zoomLevel})`,
        transformOrigin: '0 0',
      }}>
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
          onMouseDown={mode3d ? handleMouseDown : undefined}
          onMouseMove={mode3d ? handleMouseMove : undefined}
          onMouseUp={mode3d ? handleMouseUp : undefined}
          onMouseLeave={mode3d ? (e) => {
            if (isDraggingEvent.current) {
              isDraggingEvent.current = false;
              setEditingEventId(null);
            }
            handleMouseUp(e);
          } : undefined}
          onDoubleClick={mode3d ? handleDoubleClick : undefined}
          onContextMenu={mode3d ? handleContextMenu : undefined}
          style={{
            ...styles.canvas,
            position: 'relative',
            zIndex: 1,
            cursor: panning ? 'grabbing' : altPressed && editMode === 'map' ? eyedropperCursor : mode3d ? (editMode === 'event' ? 'pointer' : 'crosshair') : undefined,
          }}
        />
        <canvas
          ref={overlayRef}
          onMouseDown={mode3d ? undefined : handleMouseDown}
          onMouseMove={mode3d ? undefined : handleMouseMove}
          onMouseUp={mode3d ? undefined : handleMouseUp}
          onMouseLeave={mode3d ? undefined : (e) => {
            if (isResizing.current) return;
            if (isDraggingEvent.current) {
              isDraggingEvent.current = false;
            }
            handleMouseUp(e);
          }}
          onDoubleClick={mode3d ? undefined : handleDoubleClick}
          onContextMenu={mode3d ? undefined : handleContextMenu}
          style={{
            ...styles.canvas,
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: mode3d ? -1 : 2,
            cursor: panning ? 'grabbing' : altPressed && editMode === 'map' ? eyedropperCursor : resizeCursor || (editMode === 'event' ? 'pointer' : 'crosshair'),
            pointerEvents: mode3d ? 'none' : 'auto',
            display: mode3d ? 'none' : 'block',
          }}
        />
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
        <div className="context-menu" style={{ left: eventCtxMenu.x, top: eventCtxMenu.y }} onClick={e => e.stopPropagation()}>
          {eventCtxMenu.eventId == null && (
            <div className="context-menu-item" onClick={() => { createNewEvent(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>New Event...</div>
          )}
          {eventCtxMenu.eventId != null && (
            <>
              <div className="context-menu-item" onClick={() => { setEditingEventId(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>Edit...</div>
              <div className="context-menu-item" onClick={() => { copyEvent(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>Copy</div>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={() => { deleteEvent(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>Delete</div>
            </>
          )}
          {clipboard?.type === 'event' && (
            <>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={() => { pasteEvent(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>Paste</div>
            </>
          )}
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={() => { if (currentMapId) setPlayerStartPosition(currentMapId, eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>시작 위치 설정</div>
        </div>
      )}

      {editingEventId != null && (
        <EventDetail eventId={editingEventId} onClose={() => setEditingEventId(null)} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflow: 'auto',
    background: '#1a1a1a',
    border: '1px solid #555',
  },
  canvas: {
    display: 'block',
    imageRendering: 'pixelated',
  },
};
