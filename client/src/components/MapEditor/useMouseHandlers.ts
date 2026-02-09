import React, { useRef, useState, useCallback, useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { TileChange } from '../../store/useEditorStore';
import type { RPGEvent, EventPage, MapData } from '../../types/rpgMakerMV';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import type { MapToolsResult, ResizeEdge } from './useMapTools';

export interface EventContextMenu {
  x: number;
  y: number;
  tileX: number;
  tileY: number;
  eventId: number | null;
}

export interface MouseHandlersResult {
  handleMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
  handleMouseMove: (e: React.MouseEvent<HTMLElement>) => void;
  handleMouseUp: (e: React.MouseEvent<HTMLElement>) => void;
  handleDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
  handleContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
  createNewEvent: (x: number, y: number) => void;
  resizePreview: { dLeft: number; dTop: number; dRight: number; dBottom: number } | null;
  resizeCursor: string | null;
  dragPreview: { x: number; y: number } | null;
  lightDragPreview: { x: number; y: number } | null;
  objectDragPreview: { x: number; y: number } | null;
  eventCtxMenu: EventContextMenu | null;
  editingEventId: number | null;
  setEditingEventId: (id: number | null) => void;
  closeEventCtxMenu: () => void;
  isDraggingEvent: React.MutableRefObject<boolean>;
  isDraggingLight: React.MutableRefObject<boolean>;
  isDraggingObject: React.MutableRefObject<boolean>;
  draggedObjectId: React.MutableRefObject<number | null>;
  isResizing: React.MutableRefObject<boolean>;
  resizeOrigSize: React.MutableRefObject<{ w: number; h: number }>;
}

export function useMouseHandlers(
  webglCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  tools: MapToolsResult,
  pendingChanges: React.MutableRefObject<TileChange[]>,
): MouseHandlersResult {
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const selectedTileId = useEditorStore((s) => s.selectedTileId);
  const currentLayer = useEditorStore((s) => s.currentLayer);
  const editMode = useEditorStore((s) => s.editMode);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const mode3d = useEditorStore((s) => s.mode3d);
  const updateMapTiles = useEditorStore((s) => s.updateMapTiles);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const setCursorTile = useEditorStore((s) => s.setCursorTile);
  const setSelectedEventId = useEditorStore((s) => s.setSelectedEventId);
  const lightEditMode = useEditorStore((s) => s.lightEditMode);
  const selectedLightType = useEditorStore((s) => s.selectedLightType);
  const setSelectedLightId = useEditorStore((s) => s.setSelectedLightId);
  const addPointLight = useEditorStore((s) => s.addPointLight);
  const updatePointLight = useEditorStore((s) => s.updatePointLight);
  const resizeMap = useEditorStore((s) => s.resizeMap);
  const setSelectedObjectId = useEditorStore((s) => s.setSelectedObjectId);
  const addObject = useEditorStore((s) => s.addObject);
  const updateObject = useEditorStore((s) => s.updateObject);

  // Drawing state refs
  const isDrawing = useRef(false);
  const lastTile = useRef<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // Map boundary resize state
  const isResizing = useRef(false);
  const resizeEdge = useRef<ResizeEdge>(null);
  const resizeStartPx = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const resizeOrigSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const [resizePreview, setResizePreview] = useState<{ dLeft: number; dTop: number; dRight: number; dBottom: number } | null>(null);
  const resizePreviewRef = useRef<{ dLeft: number; dTop: number; dRight: number; dBottom: number } | null>(null);
  const updateResizePreview = useCallback((val: { dLeft: number; dTop: number; dRight: number; dBottom: number } | null) => {
    resizePreviewRef.current = val;
    setResizePreview(val);
  }, []);
  const [resizeCursor, setResizeCursor] = useState<string | null>(null);

  // Light drag state
  const isDraggingLight = useRef(false);
  const draggedLightId = useRef<number | null>(null);
  const dragLightOrigin = useRef<{ x: number; y: number } | null>(null);
  const [lightDragPreview, setLightDragPreview] = useState<{ x: number; y: number } | null>(null);

  // Event drag state
  const isDraggingEvent = useRef(false);
  const draggedEventId = useRef<number | null>(null);
  const dragEventOrigin = useRef<{ x: number; y: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);

  // Object drag state
  const isDraggingObject = useRef(false);
  const draggedObjectId = useRef<number | null>(null);
  const dragObjectOrigin = useRef<{ x: number; y: number } | null>(null);
  const [objectDragPreview, setObjectDragPreview] = useState<{ x: number; y: number } | null>(null);

  // Context menu & event editing state
  const [eventCtxMenu, setEventCtxMenu] = useState<EventContextMenu | null>(null);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);

  const { canvasToTile, canvasToSubTile, placeTileWithUndo, applyShadow, eyedropTile,
    drawOverlayPreview, drawRectangle, drawEllipse, clearOverlay,
    detectEdge, edgeToCursor, getCanvasPx } = tools;

  // Resize drag uses window-level listeners so dragging outside canvas still works
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !resizeEdge.current) return;
    const canvas = webglCanvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const px = (e.clientX - rect.left) / zoomLevel;
    const py = (e.clientY - rect.top) / zoomLevel;
    const dx = px - resizeStartPx.current.x;
    const dy = py - resizeStartPx.current.y;
    const edge = resizeEdge.current;
    const dtX = Math.round(dx / TILE_SIZE_PX);
    const dtY = Math.round(dy / TILE_SIZE_PX);
    let dLeft = 0, dTop = 0, dRight = 0, dBottom = 0;
    if (edge.includes('e')) dRight = dtX;
    if (edge.includes('w')) dLeft = dtX;
    if (edge.includes('s')) dBottom = dtY;
    if (edge.includes('n')) dTop = dtY;
    const origW = resizeOrigSize.current.w;
    const origH = resizeOrigSize.current.h;
    const newW = origW + dRight - dLeft;
    const newH = origH + dBottom - dTop;
    if (newW < 1) { if (dRight !== 0) dRight = 1 - origW + dLeft; else dLeft = origW + dRight - 1; }
    if (newH < 1) { if (dBottom !== 0) dBottom = 1 - origH + dTop; else dTop = origH + dBottom - 1; }
    if (newW > 256) { if (dRight !== 0) dRight = 256 - origW + dLeft; else dLeft = origW + dRight - 256; }
    if (newH > 256) { if (dBottom !== 0) dBottom = 256 - origH + dTop; else dTop = origH + dBottom - 256; }
    updateResizePreview({ dLeft, dTop, dRight, dBottom });
  }, [zoomLevel, updateResizePreview]);

  const handleResizeUp = useCallback(() => {
    if (!isResizing.current) return;
    isResizing.current = false;
    resizeEdge.current = null;
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeUp);
    const preview = resizePreviewRef.current;
    if (preview) {
      const { dLeft, dTop, dRight, dBottom } = preview;
      if (dLeft !== 0 || dTop !== 0 || dRight !== 0 || dBottom !== 0) {
        const origW = resizeOrigSize.current.w;
        const origH = resizeOrigSize.current.h;
        const newW = origW + dRight - dLeft;
        const newH = origH + dBottom - dTop;
        resizeMap(newW, newH, -dLeft, -dTop);
      }
    }
    updateResizePreview(null);
  }, [handleResizeMove, resizeMap, updateResizePreview]);

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeUp);
    };
  }, [handleResizeMove, handleResizeUp]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      // Map boundary resize: start resize if on edge
      if (e.button === 0 && editMode === 'map' && !mode3d) {
        const edge = detectEdge(e);
        if (edge) {
          const px = getCanvasPx(e);
          if (px && currentMap) {
            isResizing.current = true;
            resizeEdge.current = edge;
            resizeStartPx.current = px;
            resizeOrigSize.current = { w: currentMap.width, h: currentMap.height };
            updateResizePreview({ dLeft: 0, dTop: 0, dRight: 0, dBottom: 0 });
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeUp);
            e.preventDefault();
            return;
          }
        }
      }

      const tile = canvasToTile(e);
      if (!tile) return;

      // Alt+Click: 스포이드 (eyedropper)
      if (e.altKey && e.button === 0 && editMode === 'map') {
        eyedropTile(tile.x, tile.y);
        e.preventDefault();
        return;
      }

      if (e.button === 2 && editMode === 'map') {
        const latestMap = useEditorStore.getState().currentMap;
        if (!latestMap) return;
        if (selectedTool === 'shadow') {
          const z = 4;
          const idx = (z * latestMap.height + tile.y) * latestMap.width + tile.x;
          const oldBits = latestMap.data[idx];
          if (oldBits !== 0) {
            pushUndo([{ x: tile.x, y: tile.y, z, oldTileId: oldBits, newTileId: 0 }]);
            updateMapTiles([{ x: tile.x, y: tile.y, z, tileId: 0 }]);
          }
        } else {
          const z = currentLayer;
          const idx = (z * latestMap.height + tile.y) * latestMap.width + tile.x;
          const oldTileId = latestMap.data[idx];
          if (oldTileId !== 0) {
            pushUndo([{ x: tile.x, y: tile.y, z, oldTileId, newTileId: 0 }]);
            updateMapTiles([{ x: tile.x, y: tile.y, z, tileId: 0 }]);
          }
        }
        return;
      }

      if (e.button !== 0) return;

      // Light edit mode: place or select lights
      if (lightEditMode && selectedLightType === 'point') {
        const lights = currentMap?.editorLights?.points || [];
        const hitLight = lights.find(l => {
          if (l.x === tile.x && l.y === tile.y) return true;
          const zOffset = (l.z ?? 0) * 0.5;
          const visualY = l.y * TILE_SIZE_PX + TILE_SIZE_PX / 2 - zOffset;
          const visualTileY = Math.floor(visualY / TILE_SIZE_PX);
          return l.x === tile.x && visualTileY === tile.y;
        });
        if (hitLight) {
          setSelectedLightId(hitLight.id);
          isDraggingLight.current = true;
          draggedLightId.current = hitLight.id;
          dragLightOrigin.current = { x: tile.x, y: tile.y };
          setLightDragPreview(null);
        } else {
          addPointLight(tile.x, tile.y);
        }
        return;
      }

      if (editMode === 'object') {
        const objects = currentMap?.objects || [];
        const hitObj = objects.find(o =>
          tile.x >= o.x && tile.x < o.x + o.width &&
          tile.y >= o.y - o.height + 1 && tile.y <= o.y
        );
        if (hitObj) {
          setSelectedObjectId(hitObj.id);
          isDraggingObject.current = true;
          draggedObjectId.current = hitObj.id;
          dragObjectOrigin.current = { x: tile.x, y: tile.y };
          setObjectDragPreview(null);
        } else {
          addObject(tile.x, tile.y);
        }
        return;
      }

      if (editMode === 'event') {
        if (currentMap && currentMap.events) {
          const ev = currentMap.events.find(
            (ev) => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y
          );
          setSelectedEventId(ev ? ev.id : null);
          if (ev) {
            isDraggingEvent.current = true;
            draggedEventId.current = ev.id;
            dragEventOrigin.current = { x: tile.x, y: tile.y };
            setDragPreview(null);
          }
        }
        return;
      }

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
    [canvasToTile, canvasToSubTile, placeTileWithUndo, applyShadow, selectedTool, editMode, currentMap, setSelectedEventId, currentLayer, pushUndo, updateMapTiles, lightEditMode, selectedLightType, setSelectedLightId, addPointLight, mode3d, detectEdge, getCanvasPx, handleResizeMove, handleResizeUp, updateResizePreview, eyedropTile]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (isResizing.current) return;

      if (editMode === 'map' && !mode3d && !isDrawing.current && !isDraggingEvent.current && !isDraggingLight.current) {
        const edge = detectEdge(e);
        setResizeCursor(edgeToCursor(edge));
      }

      const tile = canvasToTile(e);
      if (tile) {
        setCursorTile(tile.x, tile.y);
      }

      // Light dragging
      if (isDraggingLight.current && tile && dragLightOrigin.current) {
        if (tile.x !== dragLightOrigin.current.x || tile.y !== dragLightOrigin.current.y) {
          setLightDragPreview({ x: tile.x, y: tile.y });
        } else {
          setLightDragPreview(null);
        }
        return;
      }

      // Object dragging
      if (isDraggingObject.current && tile && dragObjectOrigin.current) {
        if (tile.x !== dragObjectOrigin.current.x || tile.y !== dragObjectOrigin.current.y) {
          const obj = currentMap?.objects?.find(o => o.id === draggedObjectId.current);
          if (obj) {
            const dx = tile.x - dragObjectOrigin.current.x;
            const dy = tile.y - dragObjectOrigin.current.y;
            setObjectDragPreview({ x: obj.x + dx, y: obj.y + dy });
          }
        } else {
          setObjectDragPreview(null);
        }
        return;
      }

      if (isDraggingEvent.current && tile && dragEventOrigin.current) {
        if (tile.x !== dragEventOrigin.current.x || tile.y !== dragEventOrigin.current.y) {
          setDragPreview({ x: tile.x, y: tile.y });
        } else {
          setDragPreview(null);
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
    [canvasToTile, canvasToSubTile, placeTileWithUndo, applyShadow, selectedTool, setCursorTile, drawOverlayPreview, getCanvasPx, detectEdge, editMode, mode3d]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (isResizing.current) return;

      // Light drag commit
      if (isDraggingLight.current && draggedLightId.current != null) {
        const tile = canvasToTile(e);
        const origin = dragLightOrigin.current;
        if (tile && origin && (tile.x !== origin.x || tile.y !== origin.y)) {
          updatePointLight(draggedLightId.current, { x: tile.x, y: tile.y });
        }
        isDraggingLight.current = false;
        draggedLightId.current = null;
        dragLightOrigin.current = null;
        setLightDragPreview(null);
        return;
      }

      // Object drag commit
      if (isDraggingObject.current && draggedObjectId.current != null) {
        if (objectDragPreview) {
          updateObject(draggedObjectId.current, { x: objectDragPreview.x, y: objectDragPreview.y });
        }
        isDraggingObject.current = false;
        draggedObjectId.current = null;
        dragObjectOrigin.current = null;
        setObjectDragPreview(null);
        return;
      }

      if (isDraggingEvent.current && draggedEventId.current != null) {
        const tile = canvasToTile(e);
        const origin = dragEventOrigin.current;
        if (tile && origin && (tile.x !== origin.x || tile.y !== origin.y)) {
          const latestMap = useEditorStore.getState().currentMap;
          if (latestMap && latestMap.events) {
            const occupied = latestMap.events.some(ev => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y);
            if (!occupied) {
              const events = latestMap.events.map(ev => {
                if (ev && ev.id === draggedEventId.current) {
                  return { ...ev, x: tile.x, y: tile.y };
                }
                return ev;
              });
              useEditorStore.setState({ currentMap: { ...latestMap, events } as MapData & { tilesetNames?: string[] } });
            }
          }
        }
        isDraggingEvent.current = false;
        draggedEventId.current = null;
        dragEventOrigin.current = null;
        setDragPreview(null);
        return;
      }

      if (isDrawing.current) {
        if (selectedTool === 'rectangle' && dragStart.current) {
          const tile = canvasToTile(e);
          if (tile) drawRectangle(dragStart.current, tile);
          clearOverlay();
        } else if (selectedTool === 'ellipse' && dragStart.current) {
          const tile = canvasToTile(e);
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
    [selectedTool, canvasToTile, drawRectangle, drawEllipse, clearOverlay, pushUndo, updatePointLight, resizeMap, resizePreview]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (editMode !== 'event') return;
      const tile = canvasToTile(e);
      if (!tile || !currentMap || !currentMap.events) return;
      const ev = currentMap.events.find(
        (ev) => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y
      );
      if (ev) {
        setSelectedEventId(ev.id);
        setEditingEventId(ev.id);
      } else {
        createNewEvent(tile.x, tile.y);
      }
    },
    [editMode, canvasToTile, currentMap, setSelectedEventId]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      if (editMode === 'event') {
        const tile = canvasToTile(e);
        if (!tile || !currentMap) return;
        const ev = currentMap.events?.find(
          (ev) => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y
        );
        setEventCtxMenu({
          x: e.clientX,
          y: e.clientY,
          tileX: tile.x,
          tileY: tile.y,
          eventId: ev ? ev.id : null,
        });
      }
    },
    [editMode, canvasToTile, currentMap]
  );

  const createNewEvent = useCallback((x: number, y: number) => {
    if (!currentMap) return;
    const events = [...(currentMap.events || [])];
    const maxId = events.reduce((max: number, e) => (e && e.id > max ? e.id : max), 0);
    const defaultPage: EventPage = {
      conditions: {
        actorId: 1, actorValid: false, itemId: 1, itemValid: false,
        selfSwitchCh: 'A', selfSwitchValid: false,
        switch1Id: 1, switch1Valid: false, switch2Id: 1, switch2Valid: false,
        variableId: 1, variableValid: false, variableValue: 0,
      },
      directionFix: false,
      image: { characterIndex: 0, characterName: '', direction: 2, pattern: 1, tileId: 0 },
      list: [{ code: 0, indent: 0, parameters: [] }],
      moveFrequency: 3,
      moveRoute: { list: [{ code: 0 }], repeat: true, skippable: false, wait: false },
      moveSpeed: 3,
      moveType: 0,
      priorityType: 1,
      stepAnime: false,
      through: false,
      trigger: 0,
      walkAnime: true,
    };
    const newEvent: RPGEvent = {
      id: maxId + 1,
      name: `EV${String(maxId + 1).padStart(3, '0')}`,
      x, y,
      note: '',
      pages: [defaultPage],
    };
    while (events.length <= maxId + 1) events.push(null);
    events[maxId + 1] = newEvent;
    useEditorStore.setState({ currentMap: { ...currentMap, events } as MapData & { tilesetNames?: string[] } });
    setSelectedEventId(maxId + 1);
    setEditingEventId(maxId + 1);
  }, [currentMap, setSelectedEventId]);

  const closeEventCtxMenu = useCallback(() => setEventCtxMenu(null), []);

  return {
    handleMouseDown, handleMouseMove, handleMouseUp,
    handleDoubleClick, handleContextMenu, createNewEvent,
    resizePreview, resizeCursor, dragPreview,
    lightDragPreview, objectDragPreview,
    eventCtxMenu, editingEventId, setEditingEventId,
    closeEventCtxMenu,
    isDraggingEvent, isDraggingLight, isDraggingObject, draggedObjectId,
    isResizing, resizeOrigSize,
  };
}
