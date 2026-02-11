import React, { useRef, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { TileChange } from '../../store/useEditorStore';
import type { RPGEvent, EventPage, MapData } from '../../types/rpgMakerMV';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import type { MapToolsResult } from './useMapTools';
import { useResizeHandlers } from './useResizeHandlers';

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
  handleMouseLeave: (e: React.MouseEvent<HTMLElement>) => void;
  handleDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
  handleContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
  createNewEvent: (x: number, y: number) => void;
  resizePreview: { dLeft: number; dTop: number; dRight: number; dBottom: number } | null;
  resizeCursor: string | null;
  dragPreview: { x: number; y: number } | null;
  lightDragPreview: { x: number; y: number } | null;
  objectDragPreview: { x: number; y: number } | null;
  hoverTile: { x: number; y: number } | null;
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
  isOrbiting: React.MutableRefObject<boolean>;
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
  const setSelection = useEditorStore((s) => s.setSelection);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const copyTiles = useEditorStore((s) => s.copyTiles);
  const pasteTiles = useEditorStore((s) => s.pasteTiles);
  const deleteTiles = useEditorStore((s) => s.deleteTiles);
  const moveTiles = useEditorStore((s) => s.moveTiles);
  const setIsPasting = useEditorStore((s) => s.setIsPasting);
  const setPastePreviewPos = useEditorStore((s) => s.setPastePreviewPos);
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

  // Camera orbit state (middle mouse drag in 3D mode)
  const isOrbiting = useRef(false);
  const orbitStart = useRef<{ x: number; y: number } | null>(null);
  const orbitStartTilt = useRef(0);
  const orbitStartYaw = useRef(0);

  // Map boundary resize hook
  const { isResizing, resizeOrigSize, resizePreview, resizeCursor, setResizeCursor, startResize } = useResizeHandlers(webglCanvasRef, zoomLevel, resizeMap);

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

  // Selection tool state
  const isSelecting = useRef(false);
  const selectionDragStart = useRef<{ x: number; y: number } | null>(null);
  const isMovingSelection = useRef(false);
  const moveOriginRef = useRef<{ x: number; y: number } | null>(null);
  const originalSelectionBounds = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);

  // Hover tile (for cursor preview)
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);

  // Context menu & event editing state
  const [eventCtxMenu, setEventCtxMenu] = useState<EventContextMenu | null>(null);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);

  const { canvasToTile, canvasToSubTile, placeTileWithUndo, applyShadow, eyedropTile,
    drawOverlayPreview, drawRectangle, drawEllipse, clearOverlay,
    detectEdge, edgeToCursor, getCanvasPx } = tools;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
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
      if (!tile) return;

      // Alt+Click: 스포이드 (eyedropper)
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

      // Middle mouse button: camera orbit in 3D mode
      if (e.button === 1 && mode3d) {
        e.preventDefault();
        const Mode3D = (window as any).Mode3D;
        isOrbiting.current = true;
        orbitStart.current = { x: e.clientX, y: e.clientY };
        orbitStartTilt.current = Mode3D?._tiltDeg ?? 60;
        orbitStartYaw.current = Mode3D?._yawDeg ?? 0;
        return;
      }

      if (e.button !== 0) return;

      // Selection tool
      if (selectedTool === 'select' && editMode === 'map') {
        const state = useEditorStore.getState();

        // 붙여넣기 모드: 클릭으로 배치
        if (state.isPasting) {
          pasteTiles(tile.x, tile.y);
          setIsPasting(false);
          setPastePreviewPos(null);
          // 붙여넣기 위치에 선택 영역 설정
          const cb = state.clipboard;
          if (cb?.type === 'tiles' && cb.width && cb.height) {
            setSelection({ x: tile.x, y: tile.y }, { x: tile.x + cb.width - 1, y: tile.y + cb.height - 1 });
          }
          return;
        }

        // 기존 선택 영역 내부 클릭: 이동 시작
        if (state.selectionStart && state.selectionEnd) {
          const minX = Math.min(state.selectionStart.x, state.selectionEnd.x);
          const maxX = Math.max(state.selectionStart.x, state.selectionEnd.x);
          const minY = Math.min(state.selectionStart.y, state.selectionEnd.y);
          const maxY = Math.max(state.selectionStart.y, state.selectionEnd.y);

          if (tile.x >= minX && tile.x <= maxX && tile.y >= minY && tile.y <= maxY) {
            isMovingSelection.current = true;
            moveOriginRef.current = { x: tile.x, y: tile.y };
            originalSelectionBounds.current = { minX, minY, maxX, maxY };
            copyTiles(minX, minY, maxX, maxY);
            // 원래 위치 타일 시각적으로만 삭제 (undo 없이) + 프리뷰 표시
            const latestMap = useEditorStore.getState().currentMap;
            if (latestMap) {
              const clearChanges: { x: number; y: number; z: number; tileId: number }[] = [];
              for (let z = 0; z < 4; z++) {
                for (let y = minY; y <= maxY; y++) {
                  for (let x = minX; x <= maxX; x++) {
                    const idx = (z * latestMap.height + y) * latestMap.width + x;
                    if (latestMap.data[idx] !== 0) {
                      clearChanges.push({ x, y, z, tileId: 0 });
                    }
                  }
                }
              }
              if (clearChanges.length > 0) updateMapTiles(clearChanges);
            }
            setIsPasting(true);
            setPastePreviewPos({ x: minX, y: minY });
            return;
          }
        }

        // 새 선택 영역 시작
        clearSelection();
        isSelecting.current = true;
        selectionDragStart.current = tile;
        setSelection(tile, tile);
        return;
      }

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
    [canvasToTile, canvasToSubTile, placeTileWithUndo, applyShadow, selectedTool, editMode, currentMap, setSelectedEventId, currentLayer, pushUndo, updateMapTiles, lightEditMode, selectedLightType, setSelectedLightId, addPointLight, mode3d, detectEdge, getCanvasPx, startResize, eyedropTile, clearSelection, setSelection, copyTiles, pasteTiles, setIsPasting, setPastePreviewPos]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (isResizing.current) return;

      // Camera orbit drag
      if (isOrbiting.current && orbitStart.current) {
        const dx = e.clientX - orbitStart.current.x;
        const dy = e.clientY - orbitStart.current.y;
        const Mode3D = (window as any).Mode3D;
        if (Mode3D) {
          // 상하 드래그: tilt 변경 (20~85도 범위)
          const newTilt = Math.max(20, Math.min(85, orbitStartTilt.current + dy * 0.3));
          Mode3D._tiltDeg = newTilt;
          Mode3D._tiltRad = newTilt * Math.PI / 180;
          // 좌우 드래그: yaw 변경
          const newYaw = orbitStartYaw.current - dx * 0.3;
          Mode3D._yawDeg = newYaw;
          Mode3D._yawRad = newYaw * Math.PI / 180;
        }
        return;
      }

      if (editMode === 'map' && !mode3d && !isDrawing.current && !isDraggingEvent.current && !isDraggingLight.current) {
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

      // Selection tool: drag to select or move
      if (selectedTool === 'select' && editMode === 'map') {
        const state = useEditorStore.getState();

        // 선택 영역 이동 (isPasting보다 먼저 체크해야 프리뷰 위치가 올바름)
        if (isMovingSelection.current && tile && moveOriginRef.current && originalSelectionBounds.current) {
          const dx = tile.x - moveOriginRef.current.x;
          const dy = tile.y - moveOriginRef.current.y;
          const ob = originalSelectionBounds.current;
          setSelection(
            { x: ob.minX + dx, y: ob.minY + dy },
            { x: ob.maxX + dx, y: ob.maxY + dy }
          );
          setPastePreviewPos({ x: ob.minX + dx, y: ob.minY + dy });
          return;
        }

        // 붙여넣기 프리뷰 이동
        if (state.isPasting && tile) {
          setPastePreviewPos(tile);
          return;
        }

        // 선택 영역 드래그
        if (isSelecting.current && tile && selectionDragStart.current) {
          setSelection(selectionDragStart.current, tile);
          return;
        }
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
    [canvasToTile, canvasToSubTile, placeTileWithUndo, applyShadow, selectedTool, setCursorTile, drawOverlayPreview, getCanvasPx, detectEdge, editMode, mode3d, setSelection, setPastePreviewPos]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (isOrbiting.current) {
        isOrbiting.current = false;
        orbitStart.current = null;
        return;
      }
      if (isResizing.current) return;

      // Selection tool: finish select or move
      if (selectedTool === 'select' && editMode === 'map') {
        if (isSelecting.current) {
          isSelecting.current = false;
          const start = selectionDragStart.current;
          const tile = canvasToTile(e);
          selectionDragStart.current = null;
          // 단일 클릭(드래그 없음)이면 선택 해제
          if (start && tile && start.x === tile.x && start.y === tile.y) {
            clearSelection();
          }
          return;
        }

        if (isMovingSelection.current) {
          const tile = canvasToTile(e);
          const ob = originalSelectionBounds.current;
          if (tile && ob && moveOriginRef.current) {
            const dx = tile.x - moveOriginRef.current.x;
            const dy = tile.y - moveOriginRef.current.y;
            // moveTiles로 원자적 이동 (하나의 undo 항목)
            moveTiles(ob.minX, ob.minY, ob.maxX, ob.maxY, ob.minX + dx, ob.minY + dy);
            setSelection(
              { x: ob.minX + dx, y: ob.minY + dy },
              { x: ob.maxX + dx, y: ob.maxY + dy }
            );
          }
          setIsPasting(false);
          setPastePreviewPos(null);
          isMovingSelection.current = false;
          moveOriginRef.current = null;
          originalSelectionBounds.current = null;
          return;
        }
      }

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
    [selectedTool, canvasToTile, drawRectangle, drawEllipse, clearOverlay, pushUndo, updatePointLight, editMode, clearSelection, deleteTiles, pasteTiles, moveTiles, setSelection, setIsPasting, setPastePreviewPos]
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

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      setHoverTile(null);
      if (isOrbiting.current) {
        isOrbiting.current = false;
        orbitStart.current = null;
        return;
      }
      if (isResizing.current) return;
      if (isDraggingEvent.current) {
        isDraggingEvent.current = false;
        setEditingEventId(null);
      }
      // 선택 드래그 중이면 취소
      if (isSelecting.current) {
        isSelecting.current = false;
        selectionDragStart.current = null;
        return;
      }
      if (isMovingSelection.current) {
        // 이동 취소: 원래 위치에 타일 복원 (undo 없이)
        const ob = originalSelectionBounds.current;
        const cb = useEditorStore.getState().clipboard;
        if (ob && cb?.type === 'tiles' && cb.tiles) {
          const restoreChanges: { x: number; y: number; z: number; tileId: number }[] = [];
          for (const t of cb.tiles) {
            const tx = ob.minX + t.x, ty = ob.minY + t.y;
            restoreChanges.push({ x: tx, y: ty, z: t.z, tileId: t.tileId });
          }
          updateMapTiles(restoreChanges);
          setSelection({ x: ob.minX, y: ob.minY }, { x: ob.maxX, y: ob.maxY });
        }
        setIsPasting(false);
        setPastePreviewPos(null);
        isMovingSelection.current = false;
        moveOriginRef.current = null;
        originalSelectionBounds.current = null;
        return;
      }
      handleMouseUp(e);
    },
    [handleMouseUp, updateMapTiles, setIsPasting, setPastePreviewPos, setSelection]
  );

  const closeEventCtxMenu = useCallback(() => setEventCtxMenu(null), []);

  return {
    handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave,
    handleDoubleClick, handleContextMenu, createNewEvent,
    resizePreview, resizeCursor, dragPreview,
    lightDragPreview, objectDragPreview, hoverTile,
    eventCtxMenu, editingEventId, setEditingEventId,
    closeEventCtxMenu,
    isDraggingEvent, isDraggingLight, isDraggingObject, draggedObjectId,
    isResizing, resizeOrigSize, isOrbiting,
  };
}
