import React, { useRef, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { TileChange } from '../../store/useEditorStore';
import { placeAutotileAtPure } from './mapToolAlgorithms';
import type { MapToolsResult } from './useMapTools';
import { useResizeHandlers } from './useResizeHandlers';
import { useCameraZoneHandlers } from './useCameraZoneHandlers';
import { useLightHandlers } from './useLightHandlers';
import { useObjectHandlers } from './useObjectHandlers';
import { useEventDragHandlers } from './useEventDragHandlers';
import { useSelectionHandlers } from './useSelectionHandlers';

export type { EventContextMenu } from './useEventDragHandlers';

export interface MouseHandlersResult {
  handleMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
  handleMouseMove: (e: React.MouseEvent<HTMLElement>) => void;
  handleMouseUp: (e: React.MouseEvent<HTMLElement>) => void;
  handleMouseLeave: (e: React.MouseEvent<HTMLElement>) => void;
  handleDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
  handleContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
  createNewEvent: (x: number, y: number) => void;
  resizePreview: { dLeft: number; dTop: number; dRight: number; dBottom: number } | null;
  resizeCursor: string | null;
  dragPreview: { x: number; y: number } | null;
  eventMultiDragDelta: { dx: number; dy: number } | null;
  lightMultiDragDelta: { dx: number; dy: number } | null;
  objectMultiDragDelta: { dx: number; dy: number } | null;
  lightDragPreview: { x: number; y: number } | null;
  objectDragPreview: { x: number; y: number } | null;
  cameraZoneDragPreview: { x: number; y: number; width: number; height: number } | null;
  cameraZoneMultiDragDelta: { dx: number; dy: number } | null;
  hoverTile: { x: number; y: number } | null;
  eventCtxMenu: { x: number; y: number; tileX: number; tileY: number; eventId: number | null } | null;
  editingEventId: number | null;
  setEditingEventId: (id: number | null) => void;
  closeEventCtxMenu: () => void;
  isDraggingEvent: React.MutableRefObject<boolean>;
  isDraggingLight: React.MutableRefObject<boolean>;
  isDraggingObject: React.MutableRefObject<boolean>;
  draggedObjectId: React.MutableRefObject<number | null>;
  isResizing: React.MutableRefObject<boolean>;
  resizeOrigSize: React.MutableRefObject<{ w: number; h: number }>;
  isSelectingEvents: React.MutableRefObject<boolean>;
  isSelectingLights: React.MutableRefObject<boolean>;
  isSelectingObjects: React.MutableRefObject<boolean>;
  isDraggingCameraZone: React.MutableRefObject<boolean>;
  isCreatingCameraZone: React.MutableRefObject<boolean>;
  isResizingCameraZone: React.MutableRefObject<boolean>;
  cameraZoneCursor: string | null;
  playerStartDragPos: { x: number; y: number } | null;
}

export function useMouseHandlers(
  webglCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  tools: MapToolsResult,
  pendingChanges: React.MutableRefObject<TileChange[]>,
): MouseHandlersResult {
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const currentLayer = useEditorStore((s) => s.currentLayer);
  const editMode = useEditorStore((s) => s.editMode);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const mode3d = useEditorStore((s) => s.mode3d);
  const updateMapTiles = useEditorStore((s) => s.updateMapTiles);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const setCursorTile = useEditorStore((s) => s.setCursorTile);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const lightEditMode = useEditorStore((s) => s.lightEditMode);
  const selectedLightType = useEditorStore((s) => s.selectedLightType);
  const resizeMap = useEditorStore((s) => s.resizeMap);

  // Sub-hooks
  const cameraZone = useCameraZoneHandlers(webglCanvasRef);
  const light = useLightHandlers();
  const object = useObjectHandlers();
  const event = useEventDragHandlers();
  const selection = useSelectionHandlers();

  // Drawing state refs
  const isDrawing = useRef(false);
  const isRightErasing = useRef(false);
  const lastTile = useRef<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // Map boundary resize hook
  const { isResizing, resizeOrigSize, resizePreview, resizeCursor, setResizeCursor, startResize } = useResizeHandlers(webglCanvasRef, zoomLevel, resizeMap);

  // Hover tile (for cursor preview)
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);

  const { canvasToTile, canvasToSubTile, placeTileWithUndo, applyShadow, eyedropTile,
    drawOverlayPreview, drawRectangle, drawEllipse, clearOverlay,
    detectEdge, edgeToCursor, getCanvasPx } = tools;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if ((window as any)._probeDebugActive) return;

      // Map boundary resize: start resize if on edge
      if (e.button === 0 && editMode === 'map' && !mode3d) {
        const edge = detectEdge(e);
        if (edge) {
          const px = getCanvasPx(e);
          if (px && currentMap) {
            startResize(edge, px, { w: currentMap.width, h: currentMap.height });
            e.preventDefault();
            return;
          }
        }
      }

      const tile = canvasToTile(e);

      // 카메라 존 모드 (좌클릭만)
      if (e.button === 0 && editMode === 'cameraZone') {
        const unclampedTile = canvasToTile(e, true) ?? tile;
        if (unclampedTile) {
          cameraZone.handleCameraZoneMouseDown(tile, unclampedTile, e);
          return;
        }
      }
      if (!tile) return;

      // Alt+Click: 스포이드
      if (e.altKey && e.button === 0 && editMode === 'map') {
        eyedropTile(tile.x, tile.y);
        e.preventDefault();
        return;
      }

      // Select tool: right-click clears selection
      if (e.button === 2 && editMode === 'map' && selectedTool === 'select') {
        clearSelection();
        return;
      }

      if (e.button === 2 && editMode === 'map') {
        const latestMap = useEditorStore.getState().currentMap;
        if (!latestMap) return;
        isRightErasing.current = true;
        lastTile.current = tile;
        pendingChanges.current = [];
        if (selectedTool === 'shadow') {
          const z = 4;
          const idx = (z * latestMap.height + tile.y) * latestMap.width + tile.x;
          const oldBits = latestMap.data[idx];
          if (oldBits !== 0) {
            pendingChanges.current.push({ x: tile.x, y: tile.y, z, oldTileId: oldBits, newTileId: 0 });
            updateMapTiles([{ x: tile.x, y: tile.y, z, tileId: 0 }]);
          }
        } else {
          const z = currentLayer;
          const data = [...latestMap.data];
          const changes: TileChange[] = [];
          const updates: { x: number; y: number; z: number; tileId: number }[] = [];
          placeAutotileAtPure(tile.x, tile.y, z, 0, data, latestMap.width, latestMap.height, changes, updates);
          if (updates.length > 0) {
            pendingChanges.current.push(...changes);
            updateMapTiles(updates);
          }
        }
        return;
      }


      if (e.button !== 0) return;

      // Selection tool
      if (selectedTool === 'select' && editMode === 'map') {
        selection.handleSelectionMouseDown(tile);
        return;
      }

      // Light edit mode
      if (lightEditMode && selectedLightType === 'point') {
        light.handleLightMouseDown(tile, e);
        return;
      }

      // Object mode
      if (editMode === 'object') {
        object.handleObjectMouseDown(tile, e);
        return;
      }

      // Event mode
      if (editMode === 'event') {
        event.handleEventMouseDown(tile, e);
        return;
      }

      // Drawing
      isDrawing.current = true;
      lastTile.current = tile;
      pendingChanges.current = [];

      if (selectedTool === 'shadow') {
        const sub = canvasToSubTile(e);
        if (sub) {
          applyShadow(sub.x, sub.y, sub.subX, sub.subY, true);
        }
      } else if (selectedTool === 'rectangle' || selectedTool === 'ellipse') {
        dragStart.current = tile;
      } else {
        placeTileWithUndo(tile);
      }
    },
    [canvasToTile, canvasToSubTile, placeTileWithUndo, applyShadow, selectedTool, editMode, currentMap, currentLayer, pushUndo, updateMapTiles, lightEditMode, selectedLightType, mode3d, detectEdge, getCanvasPx, startResize, eyedropTile, clearSelection, selection, light, object, event, cameraZone]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if ((window as any)._probeDebugActive) {
        if ((window as any)._probeDebugHover) {
          (window as any)._probeDebugHover(e.clientX, e.clientY, e.target);
        }
        return;
      }
      if (isResizing.current) return;


      if (editMode === 'map' && !mode3d && !isDrawing.current && !event.isDraggingEvent.current && !light.isDraggingLight.current) {
        const edge = detectEdge(e);
        setResizeCursor(edgeToCursor(edge));
      }

      const tile = canvasToTile(e);
      if (tile) {
        setCursorTile(tile.x, tile.y);
        setHoverTile(prev => (!prev || prev.x !== tile.x || prev.y !== tile.y) ? tile : prev);
      } else {
        setHoverTile(prev => prev ? null : prev);
      }

      // Selection tool
      if (selectedTool === 'select' && editMode === 'map') {
        if (selection.handleSelectionMouseMove(tile)) return;
      }

      // Light handlers
      if (light.handleLightMouseMove(tile)) return;

      // Light pasting preview
      if (lightEditMode && tile && light.handleLightPastePreview(tile)) return;

      // Object handlers
      if (object.handleObjectMouseMove(tile)) return;

      // Object pasting preview
      if (editMode === 'object' && tile && object.handleObjectPastePreview(tile)) return;

      // Camera zone mode
      if (editMode === 'cameraZone') {
        if (cameraZone.handleCameraZoneMouseMove(tile, e, canvasToTile)) return;
      }

      // Player start position drag
      if (tile && event.handlePlayerStartDragMove(tile)) return;

      // Event handlers
      if (event.handleEventMouseMove(tile)) return;

      // Event pasting preview
      if (editMode === 'event' && tile && event.handleEventPastePreview(tile)) return;

      // 우클릭 드래그 지우기
      if (isRightErasing.current && tile) {
        if (lastTile.current && tile.x === lastTile.current.x && tile.y === lastTile.current.y) return;
        lastTile.current = tile;
        const latestMap = useEditorStore.getState().currentMap;
        if (!latestMap) return;
        if (selectedTool === 'shadow') {
          const z = 4;
          const idx = (z * latestMap.height + tile.y) * latestMap.width + tile.x;
          const oldBits = latestMap.data[idx];
          if (oldBits !== 0) {
            pendingChanges.current.push({ x: tile.x, y: tile.y, z, oldTileId: oldBits, newTileId: 0 });
            updateMapTiles([{ x: tile.x, y: tile.y, z, tileId: 0 }]);
          }
        } else {
          const z = currentLayer;
          const data = [...latestMap.data];
          const changes: TileChange[] = [];
          const updates: { x: number; y: number; z: number; tileId: number }[] = [];
          placeAutotileAtPure(tile.x, tile.y, z, 0, data, latestMap.width, latestMap.height, changes, updates);
          if (updates.length > 0) {
            pendingChanges.current.push(...changes);
            updateMapTiles(updates);
          }
        }
        return;
      }

      if (!isDrawing.current || !tile) return;

      if (selectedTool === 'rectangle' || selectedTool === 'ellipse') {
        if (dragStart.current) {
          drawOverlayPreview(dragStart.current, tile);
        }
        return;
      }

      if (selectedTool === 'shadow') {
        const sub = canvasToSubTile(e);
        if (sub) {
          applyShadow(sub.x, sub.y, sub.subX, sub.subY, false);
        }
        return;
      }

      if (lastTile.current && tile.x === lastTile.current.x && tile.y === lastTile.current.y) return;
      lastTile.current = tile;
      if (selectedTool === 'pen' || selectedTool === 'eraser') {
        placeTileWithUndo(tile);
      }
    },
    [canvasToTile, canvasToSubTile, placeTileWithUndo, applyShadow, selectedTool, setCursorTile, drawOverlayPreview, detectEdge, editMode, mode3d, currentLayer, updateMapTiles, selection, light, object, event, cameraZone, lightEditMode, edgeToCursor, setResizeCursor, getCanvasPx]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if ((window as any)._probeDebugActive) return;
      if (isResizing.current) return;

      // 우클릭 드래그 지우기 종료
      if (isRightErasing.current) {
        isRightErasing.current = false;
        if (pendingChanges.current.length > 0) {
          pushUndo(pendingChanges.current);
          pendingChanges.current = [];
        }
        return;
      }

      const tile = canvasToTile(e);

      // Selection tool
      if (selectedTool === 'select' && editMode === 'map') {
        if (selection.handleSelectionMouseUp(tile, e, canvasToTile)) return;
      }

      // Light handlers
      if (light.handleLightMouseUp(tile, e)) return;

      // Camera zone handlers
      if (cameraZone.handleCameraZoneMouseUp(e)) return;

      // Object handlers
      if (object.handleObjectMouseUp(tile, e)) return;

      // Player start position drag
      if (event.handlePlayerStartDragUp()) return;

      // Event handlers
      if (event.handleEventMouseUp(tile, e)) return;

      // Drawing
      if (isDrawing.current) {
        if (selectedTool === 'rectangle' && dragStart.current) {
          if (tile) drawRectangle(dragStart.current, tile);
          clearOverlay();
        } else if (selectedTool === 'ellipse' && dragStart.current) {
          if (tile) drawEllipse(dragStart.current, tile);
          clearOverlay();
        } else if (pendingChanges.current.length > 0) {
          pushUndo(pendingChanges.current);
        }
      }
      isDrawing.current = false;
      lastTile.current = null;
      dragStart.current = null;
      pendingChanges.current = [];
    },
    [selectedTool, canvasToTile, drawRectangle, drawEllipse, clearOverlay, pushUndo, editMode, selection, light, object, event, cameraZone]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      event.handleDoubleClick(e, canvasToTile);
    },
    [event, canvasToTile]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      event.handleContextMenu(e, canvasToTile);
    },
    [event, canvasToTile]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if ((window as any)._probeDebugActive && (window as any)._probeDebugLeave) {
        (window as any)._probeDebugLeave();
      }
      setHoverTile(null);
      if (isResizing.current) return;

      // Delegate to sub-handlers
      event.handleEventMouseLeave();
      event.handlePlayerStartDragLeave();
      light.handleLightMouseLeave();
      object.handleObjectMouseLeave();

      // Camera zone: don't cancel on mouse leave
      if (cameraZone.handleCameraZoneMouseLeave()) return;

      // Selection handlers
      if (selection.handleSelectionMouseLeave()) return;

      handleMouseUp(e);
    },
    [handleMouseUp, event, light, object, cameraZone, selection]
  );

  return {
    handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave,
    handleDoubleClick, handleContextMenu,
    createNewEvent: event.createNewEvent,
    resizePreview, resizeCursor,
    dragPreview: event.dragPreview,
    eventMultiDragDelta: event.eventMultiDragDelta,
    lightMultiDragDelta: light.lightMultiDragDelta,
    objectMultiDragDelta: object.objectMultiDragDelta,
    lightDragPreview: light.lightDragPreview,
    objectDragPreview: object.objectDragPreview,
    hoverTile,
    eventCtxMenu: event.eventCtxMenu,
    editingEventId: event.editingEventId,
    setEditingEventId: event.setEditingEventId,
    closeEventCtxMenu: event.closeEventCtxMenu,
    isDraggingEvent: event.isDraggingEvent,
    isDraggingLight: light.isDraggingLight,
    isDraggingObject: object.isDraggingObject,
    draggedObjectId: object.draggedObjectId,
    isResizing, resizeOrigSize,
    isSelectingEvents: event.isSelectingEvents,
    isSelectingLights: light.isSelectingLights,
    isSelectingObjects: object.isSelectingObjects,
    isDraggingCameraZone: cameraZone.isDraggingCameraZone,
    isCreatingCameraZone: cameraZone.isCreatingCameraZone,
    isResizingCameraZone: cameraZone.isResizingCameraZone,
    cameraZoneDragPreview: cameraZone.cameraZoneDragPreview,
    cameraZoneMultiDragDelta: cameraZone.cameraZoneMultiDragDelta,
    cameraZoneCursor: cameraZone.cameraZoneCursor,
    playerStartDragPos: event.playerStartDragPos,
  };
}
