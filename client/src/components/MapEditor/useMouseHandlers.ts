import React, { useRef, useState, useCallback, useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { TileChange } from '../../store/useEditorStore';
import type { RPGEvent, EventPage, MapData } from '../../types/rpgMakerMV';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import { placeAutotileAtPure } from './mapToolAlgorithms';
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
  eventMultiDragDelta: { dx: number; dy: number } | null;
  lightMultiDragDelta: { dx: number; dy: number } | null;
  objectMultiDragDelta: { dx: number; dy: number } | null;
  lightDragPreview: { x: number; y: number } | null;
  objectDragPreview: { x: number; y: number } | null;
  cameraZoneDragPreview: { x: number; y: number; width: number; height: number } | null;
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
  const selectedEventIds = useEditorStore((s) => s.selectedEventIds);
  const setSelectedEventIds = useEditorStore((s) => s.setSelectedEventIds);
  const setEventSelectionStart = useEditorStore((s) => s.setEventSelectionStart);
  const setEventSelectionEnd = useEditorStore((s) => s.setEventSelectionEnd);
  const moveEvents = useEditorStore((s) => s.moveEvents);
  const clearEventSelection = useEditorStore((s) => s.clearEventSelection);
  const isEventPasting = useEditorStore((s) => s.isEventPasting);
  const setIsEventPasting = useEditorStore((s) => s.setIsEventPasting);
  const setEventPastePreviewPos = useEditorStore((s) => s.setEventPastePreviewPos);
  const pasteEvents = useEditorStore((s) => s.pasteEvents);
  const selectedLightIds = useEditorStore((s) => s.selectedLightIds);
  const setSelectedLightIds = useEditorStore((s) => s.setSelectedLightIds);
  const setLightSelectionStart = useEditorStore((s) => s.setLightSelectionStart);
  const setLightSelectionEnd = useEditorStore((s) => s.setLightSelectionEnd);
  const moveLights = useEditorStore((s) => s.moveLights);
  const isLightPasting = useEditorStore((s) => s.isLightPasting);
  const setIsLightPasting = useEditorStore((s) => s.setIsLightPasting);
  const setLightPastePreviewPos = useEditorStore((s) => s.setLightPastePreviewPos);
  const pasteLights = useEditorStore((s) => s.pasteLights);
  const clearLightSelection = useEditorStore((s) => s.clearLightSelection);

  const selectedObjectIds = useEditorStore((s) => s.selectedObjectIds);
  const setSelectedObjectIds = useEditorStore((s) => s.setSelectedObjectIds);
  const setObjectSelectionStart = useEditorStore((s) => s.setObjectSelectionStart);
  const setObjectSelectionEnd = useEditorStore((s) => s.setObjectSelectionEnd);
  const moveObjects = useEditorStore((s) => s.moveObjects);
  const isObjectPasting = useEditorStore((s) => s.isObjectPasting);
  const setIsObjectPasting = useEditorStore((s) => s.setIsObjectPasting);
  const setObjectPastePreviewPos = useEditorStore((s) => s.setObjectPastePreviewPos);
  const pasteObjects = useEditorStore((s) => s.pasteObjects);
  const clearObjectSelection = useEditorStore((s) => s.clearObjectSelection);

  const setSelectedCameraZoneId = useEditorStore((s) => s.setSelectedCameraZoneId);
  const addCameraZone = useEditorStore((s) => s.addCameraZone);
  const updateCameraZone = useEditorStore((s) => s.updateCameraZone);
  const systemData = useEditorStore((s) => s.systemData);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const setPlayerStartPosition = useEditorStore((s) => s.setPlayerStartPosition);

  // Drawing state refs
  const isDrawing = useRef(false);
  const isRightErasing = useRef(false);
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

  // Event multi-select drag state
  const isSelectingEvents = useRef(false);
  const eventSelDragStart = useRef<{ x: number; y: number } | null>(null);
  // Event multi-drag state (moving multiple selected events)
  const isDraggingMultiEvents = useRef(false);
  const multiEventDragOrigin = useRef<{ x: number; y: number } | null>(null);
  const [eventMultiDragDelta, setEventMultiDragDelta] = useState<{ dx: number; dy: number } | null>(null);

  // Light multi-select drag state
  const isSelectingLights = useRef(false);
  const lightSelDragStart = useRef<{ x: number; y: number } | null>(null);
  // Light multi-drag state
  const isDraggingMultiLights = useRef(false);
  const multiLightDragOrigin = useRef<{ x: number; y: number } | null>(null);
  const [lightMultiDragDelta, setLightMultiDragDelta] = useState<{ dx: number; dy: number } | null>(null);

  // Object drag state
  const isDraggingObject = useRef(false);
  const draggedObjectId = useRef<number | null>(null);
  const dragObjectOrigin = useRef<{ x: number; y: number } | null>(null);
  const [objectDragPreview, setObjectDragPreview] = useState<{ x: number; y: number } | null>(null);

  // Object multi-select drag state
  const isSelectingObjects = useRef(false);
  const objectSelDragStart = useRef<{ x: number; y: number } | null>(null);
  // Object multi-drag state
  const isDraggingMultiObjects = useRef(false);
  const multiObjectDragOrigin = useRef<{ x: number; y: number } | null>(null);
  const [objectMultiDragDelta, setObjectMultiDragDelta] = useState<{ dx: number; dy: number } | null>(null);

  // Player start position drag state
  const isDraggingPlayerStart = useRef(false);
  const playerStartDragPosRef = useRef<{ x: number; y: number } | null>(null);
  const [playerStartDragPos, setPlayerStartDragPos] = useState<{ x: number; y: number } | null>(null);

  // Camera zone drag state
  const isDraggingCameraZone = useRef(false);
  const draggedCameraZoneId = useRef<number | null>(null);
  const dragCameraZoneOrigin = useRef<{ x: number; y: number } | null>(null);
  const isCreatingCameraZone = useRef(false);
  const createZoneStart = useRef<{ x: number; y: number } | null>(null);
  const [cameraZoneDragPreview, _setCameraZoneDragPreview] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const cameraZoneDragPreviewRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const setCameraZoneDragPreview = useCallback((v: { x: number; y: number; width: number; height: number } | null) => {
    cameraZoneDragPreviewRef.current = v;
    _setCameraZoneDragPreview(v);
  }, []);
  // Camera zone resize state
  const isResizingCameraZone = useRef(false);
  const resizeCameraZoneId = useRef<number | null>(null);
  const resizeCameraZoneEdge = useRef<string | null>(null); // 'n','s','e','w','ne','nw','se','sw'
  const resizeCameraZoneOriginal = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const resizeCameraZoneStart = useRef<{ x: number; y: number } | null>(null);
  const [cameraZoneCursor, setCameraZoneCursor] = useState<string | null>(null);
  // Track active camera zone drag for window-level pointer capture
  const [cameraZoneDragActive, setCameraZoneDragActive] = useState(false);

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

  // Camera zone edge detection helper
  const detectCameraZoneEdge = useCallback((tile: { x: number; y: number }, zone: { x: number; y: number; width: number; height: number }): string | null => {
    const { x, y, width, height } = zone;
    const onLeft = tile.x === x;
    const onRight = tile.x === x + width - 1;
    const onTop = tile.y === y;
    const onBottom = tile.y === y + height - 1;
    const inHorizontal = tile.x >= x && tile.x < x + width;
    const inVertical = tile.y >= y && tile.y < y + height;

    if (onTop && onLeft) return 'nw';
    if (onTop && onRight) return 'ne';
    if (onBottom && onLeft) return 'sw';
    if (onBottom && onRight) return 'se';
    if (onTop && inHorizontal) return 'n';
    if (onBottom && inHorizontal) return 's';
    if (onLeft && inVertical) return 'w';
    if (onRight && inVertical) return 'e';
    return null;
  }, []);

  const edgeToCursorStyle = useCallback((edge: string): string => {
    const map: Record<string, string> = {
      n: 'ns-resize', s: 'ns-resize',
      e: 'ew-resize', w: 'ew-resize',
      nw: 'nwse-resize', se: 'nwse-resize',
      ne: 'nesw-resize', sw: 'nesw-resize',
    };
    return map[edge] || 'default';
  }, []);

  // Convert clientX/clientY to tile coordinates (unclamped, for camera zone drag outside canvas)
  const clientToTileUnclamped = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return null;
    const container = canvas.parentElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const zl = useEditorStore.getState().zoomLevel;
    const screenX = (clientX - rect.left) / zl;
    const screenY = (clientY - rect.top) / zl;
    const m3d = useEditorStore.getState().mode3d;
    const w = (window as any);
    if (m3d && w.ConfigManager?.mode3d && w.Mode3D?._perspCamera) {
      const world = w.Mode3D.screenToWorld(screenX, screenY);
      if (world) return { x: Math.floor(world.x / TILE_SIZE_PX), y: Math.floor(world.y / TILE_SIZE_PX) };
      return null;
    }
    return { x: Math.floor(screenX / TILE_SIZE_PX), y: Math.floor(screenY / TILE_SIZE_PX) };
  }, [webglCanvasRef]);

  // Window-level pointer events for camera zone drag/resize/create (allows dragging beyond canvas bounds)
  useEffect(() => {
    if (!cameraZoneDragActive) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const tile = clientToTileUnclamped(e.clientX, e.clientY);
      if (!tile) return;

      // Camera zone resize
      if (isResizingCameraZone.current && resizeCameraZoneOriginal.current && resizeCameraZoneStart.current) {
        const orig = resizeCameraZoneOriginal.current;
        const edge = resizeCameraZoneEdge.current!;
        const dx = tile.x - resizeCameraZoneStart.current.x;
        const dy = tile.y - resizeCameraZoneStart.current.y;
        let nx = orig.x, ny = orig.y, nw = orig.width, nh = orig.height;
        if (edge.includes('w')) { nx = orig.x + dx; nw = orig.width - dx; }
        if (edge.includes('e')) { nw = orig.width + dx; }
        if (edge.includes('n')) { ny = orig.y + dy; nh = orig.height - dy; }
        if (edge.includes('s')) { nh = orig.height + dy; }
        if (nw < 1) { nx = nx + nw - 1; nw = 1; }
        if (nh < 1) { ny = ny + nh - 1; nh = 1; }
        setCameraZoneDragPreview({ x: nx, y: ny, width: nw, height: nh });
        return;
      }

      // Camera zone dragging
      if (isDraggingCameraZone.current && dragCameraZoneOrigin.current) {
        const map = useEditorStore.getState().currentMap;
        const zone = map?.cameraZones?.find(z => z.id === draggedCameraZoneId.current);
        if (zone) {
          const dx = tile.x - dragCameraZoneOrigin.current.x;
          const dy = tile.y - dragCameraZoneOrigin.current.y;
          if (dx !== 0 || dy !== 0) {
            setCameraZoneDragPreview({ x: zone.x + dx, y: zone.y + dy, width: zone.width, height: zone.height });
          } else {
            setCameraZoneDragPreview(null);
          }
        }
        return;
      }

      // Camera zone creation drag
      if (isCreatingCameraZone.current && createZoneStart.current) {
        const sx = createZoneStart.current.x;
        const sy = createZoneStart.current.y;
        const minX = Math.min(sx, tile.x);
        const minY = Math.min(sy, tile.y);
        const maxX = Math.max(sx, tile.x);
        const maxY = Math.max(sy, tile.y);
        setCameraZoneDragPreview({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 });
        return;
      }
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      const tile = clientToTileUnclamped(e.clientX, e.clientY);

      // Camera zone resize commit
      if (isResizingCameraZone.current && resizeCameraZoneId.current != null) {
        const preview = cameraZoneDragPreviewRef.current;
        if (preview) {
          updateCameraZone(resizeCameraZoneId.current, {
            x: preview.x, y: preview.y,
            width: preview.width, height: preview.height,
          });
        }
        isResizingCameraZone.current = false;
        resizeCameraZoneId.current = null;
        resizeCameraZoneEdge.current = null;
        resizeCameraZoneOriginal.current = null;
        resizeCameraZoneStart.current = null;
        setCameraZoneDragPreview(null);
        setCameraZoneDragActive(false);
        return;
      }

      // Camera zone drag commit
      if (isDraggingCameraZone.current && draggedCameraZoneId.current != null) {
        const preview = cameraZoneDragPreviewRef.current;
        if (preview) {
          updateCameraZone(draggedCameraZoneId.current, { x: preview.x, y: preview.y });
        }
        isDraggingCameraZone.current = false;
        draggedCameraZoneId.current = null;
        dragCameraZoneOrigin.current = null;
        setCameraZoneDragPreview(null);
        setCameraZoneDragActive(false);
        return;
      }

      // Camera zone creation commit
      if (isCreatingCameraZone.current && createZoneStart.current) {
        if (tile) {
          const sx = createZoneStart.current.x;
          const sy = createZoneStart.current.y;
          const minX = Math.min(sx, tile.x);
          const minY = Math.min(sy, tile.y);
          const w = Math.abs(tile.x - sx) + 1;
          const h = Math.abs(tile.y - sy) + 1;
          if (w >= 2 && h >= 2) {
            addCameraZone(minX, minY, w, h);
          }
        }
        isCreatingCameraZone.current = false;
        createZoneStart.current = null;
        setCameraZoneDragPreview(null);
        setCameraZoneDragActive(false);
        return;
      }

      setCameraZoneDragActive(false);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [cameraZoneDragActive, clientToTileUnclamped, setCameraZoneDragPreview, updateCameraZone, addCameraZone]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      // 프록시 박스 디버그 시각화 활성화 시 에디터 입력 차단
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
        const state = useEditorStore.getState();

        // 붙여넣기 모드
        if (state.isLightPasting) {
          pasteLights(tile.x, tile.y);
          setIsLightPasting(false);
          setLightPastePreviewPos(null);
          return;
        }

        const lights = currentMap?.editorLights?.points || [];
        const hitLight = lights.find(l => {
          if (l.x === tile.x && l.y === tile.y) return true;
          const zOffset = (l.z ?? 0) * 0.5;
          const visualY = l.y * TILE_SIZE_PX + TILE_SIZE_PX / 2 - zOffset;
          const visualTileY = Math.floor(visualY / TILE_SIZE_PX);
          return l.x === tile.x && visualTileY === tile.y;
        });
        if (hitLight) {
          const curIds = state.selectedLightIds;
          if (e.shiftKey) {
            // Shift+클릭: 토글 선택
            if (curIds.includes(hitLight.id)) {
              const newIds = curIds.filter(id => id !== hitLight.id);
              setSelectedLightIds(newIds);
              setSelectedLightId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
            } else {
              const newIds = [...curIds, hitLight.id];
              setSelectedLightIds(newIds);
              setSelectedLightId(hitLight.id);
            }
          } else if (curIds.includes(hitLight.id)) {
            // 이미 선택된 라이트 클릭: 멀티 드래그 시작
            isDraggingMultiLights.current = true;
            multiLightDragOrigin.current = { x: tile.x, y: tile.y };
            setLightMultiDragDelta(null);
          } else {
            // 미선택 라이트 클릭: 단일 선택 + 드래그 준비
            setSelectedLightIds([hitLight.id]);
            setSelectedLightId(hitLight.id);
            isDraggingLight.current = true;
            draggedLightId.current = hitLight.id;
            dragLightOrigin.current = { x: tile.x, y: tile.y };
            setLightDragPreview(null);
          }
        } else {
          // 빈 공간: Shift 없으면 선택 해제, 영역 선택 시작
          if (!e.shiftKey) {
            setSelectedLightIds([]);
            setSelectedLightId(null);
          }
          isSelectingLights.current = true;
          lightSelDragStart.current = tile;
          setLightSelectionStart(tile);
          setLightSelectionEnd(tile);
        }
        return;
      }

      if (editMode === 'cameraZone') {
        const zones = currentMap?.cameraZones || [];
        // 가장자리 리사이즈 감지 (선택된 존에 대해)
        const selectedZoneId = useEditorStore.getState().selectedCameraZoneId;
        const selectedZone = selectedZoneId != null ? zones.find(z => z.id === selectedZoneId) : null;
        if (selectedZone) {
          const edge = detectCameraZoneEdge(tile, selectedZone);
          if (edge) {
            isResizingCameraZone.current = true;
            resizeCameraZoneId.current = selectedZone.id;
            resizeCameraZoneEdge.current = edge;
            resizeCameraZoneOriginal.current = { x: selectedZone.x, y: selectedZone.y, width: selectedZone.width, height: selectedZone.height };
            resizeCameraZoneStart.current = { x: tile.x, y: tile.y };
            setCameraZoneDragPreview({ x: selectedZone.x, y: selectedZone.y, width: selectedZone.width, height: selectedZone.height });
            setCameraZoneDragActive(true);
            return;
          }
        }
        const hitZone = zones.find(z =>
          tile.x >= z.x && tile.x < z.x + z.width &&
          tile.y >= z.y && tile.y < z.y + z.height
        );
        if (hitZone) {
          setSelectedCameraZoneId(hitZone.id);
          isDraggingCameraZone.current = true;
          draggedCameraZoneId.current = hitZone.id;
          dragCameraZoneOrigin.current = { x: tile.x, y: tile.y };
          setCameraZoneDragPreview(null);
          setCameraZoneDragActive(true);
        } else {
          // 빈 영역: 새 존 생성 드래그 시작
          setSelectedCameraZoneId(null);
          isCreatingCameraZone.current = true;
          createZoneStart.current = tile;
          setCameraZoneDragPreview({ x: tile.x, y: tile.y, width: 1, height: 1 });
          setCameraZoneDragActive(true);
        }
        return;
      }

      if (editMode === 'object') {
        const state = useEditorStore.getState();

        // 붙여넣기 모드
        if (state.isObjectPasting) {
          pasteObjects(tile.x, tile.y);
          setIsObjectPasting(false);
          setObjectPastePreviewPos(null);
          return;
        }

        const objects = currentMap?.objects || [];
        const hitObj = objects.find(o =>
          tile.x >= o.x && tile.x < o.x + o.width &&
          tile.y >= o.y - o.height + 1 && tile.y <= o.y
        );
        if (hitObj) {
          const curIds = state.selectedObjectIds;
          if (e.shiftKey) {
            // Shift+클릭: 토글 선택
            if (curIds.includes(hitObj.id)) {
              const newIds = curIds.filter(id => id !== hitObj.id);
              setSelectedObjectIds(newIds);
              setSelectedObjectId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
            } else {
              const newIds = [...curIds, hitObj.id];
              setSelectedObjectIds(newIds);
              setSelectedObjectId(hitObj.id);
            }
          } else if (curIds.includes(hitObj.id)) {
            // 이미 선택된 오브젝트 클릭: 멀티 드래그 시작
            isDraggingMultiObjects.current = true;
            multiObjectDragOrigin.current = { x: tile.x, y: tile.y };
            setObjectMultiDragDelta(null);
          } else {
            // 미선택 오브젝트 클릭: 단일 선택 + 드래그 준비
            setSelectedObjectIds([hitObj.id]);
            setSelectedObjectId(hitObj.id);
            isDraggingObject.current = true;
            draggedObjectId.current = hitObj.id;
            dragObjectOrigin.current = { x: tile.x, y: tile.y };
            setObjectDragPreview(null);
          }
        } else {
          // 빈 공간
          if (!e.shiftKey) {
            setSelectedObjectIds([]);
            setSelectedObjectId(null);
          }
          isSelectingObjects.current = true;
          objectSelDragStart.current = tile;
          setObjectSelectionStart(tile);
          setObjectSelectionEnd(tile);
        }
        return;
      }

      if (editMode === 'event') {
        const state = useEditorStore.getState();

        // 붙여넣기 모드: 클릭으로 배치
        if (state.isEventPasting) {
          pasteEvents(tile.x, tile.y);
          setIsEventPasting(false);
          setEventPastePreviewPos(null);
          return;
        }

        if (currentMap && currentMap.events) {
          const ev = currentMap.events.find(
            (ev) => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y
          );

          if (ev) {
            const curIds = state.selectedEventIds;
            if (e.shiftKey) {
              // Shift+클릭: 토글 선택
              if (curIds.includes(ev.id)) {
                const newIds = curIds.filter(id => id !== ev.id);
                setSelectedEventIds(newIds);
                setSelectedEventId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
              } else {
                const newIds = [...curIds, ev.id];
                setSelectedEventIds(newIds);
                setSelectedEventId(ev.id);
              }
            } else if (curIds.includes(ev.id)) {
              // 이미 선택된 이벤트 클릭: 멀티 드래그 시작
              isDraggingMultiEvents.current = true;
              multiEventDragOrigin.current = { x: tile.x, y: tile.y };
              setEventMultiDragDelta(null);
            } else {
              // 미선택 이벤트 클릭: 단일 선택 + 드래그 준비
              setSelectedEventIds([ev.id]);
              setSelectedEventId(ev.id);
              isDraggingEvent.current = true;
              draggedEventId.current = ev.id;
              dragEventOrigin.current = { x: tile.x, y: tile.y };
              setDragPreview(null);
            }
          } else {
            // 시작 위치 드래그 확인
            const isPlayerStart = systemData && currentMapId === systemData.startMapId
              && tile.x === systemData.startX && tile.y === systemData.startY;
            if (isPlayerStart && !e.shiftKey) {
              isDraggingPlayerStart.current = true;
              playerStartDragPosRef.current = { x: tile.x, y: tile.y };
              setPlayerStartDragPos({ x: tile.x, y: tile.y });
              setSelectedEventIds([]);
              setSelectedEventId(null);
              return;
            }
            // 빈 타일 클릭: 영역 선택 시작
            if (!e.shiftKey) {
              setSelectedEventIds([]);
              setSelectedEventId(null);
            }
            isSelectingEvents.current = true;
            eventSelDragStart.current = tile;
            setEventSelectionStart(tile);
            setEventSelectionEnd(tile);
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
      if ((window as any)._probeDebugActive) {
        if ((window as any)._probeDebugHover) {
          (window as any)._probeDebugHover(e.clientX, e.clientY, e.target);
        }
        return;
      }
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

      // Light multi-drag
      if (isDraggingMultiLights.current && tile && multiLightDragOrigin.current) {
        const dx = tile.x - multiLightDragOrigin.current.x;
        const dy = tile.y - multiLightDragOrigin.current.y;
        if (dx !== 0 || dy !== 0) {
          setLightMultiDragDelta({ dx, dy });
        } else {
          setLightMultiDragDelta(null);
        }
        return;
      }

      // Light single dragging → convert to multi-drag
      if (isDraggingLight.current && tile && dragLightOrigin.current) {
        if (tile.x !== dragLightOrigin.current.x || tile.y !== dragLightOrigin.current.y) {
          // 단일 라이트 드래그를 멀티 드래그로 전환
          isDraggingLight.current = false;
          isDraggingMultiLights.current = true;
          multiLightDragOrigin.current = dragLightOrigin.current;
          dragLightOrigin.current = null;
          const dx = tile.x - multiLightDragOrigin.current!.x;
          const dy = tile.y - multiLightDragOrigin.current!.y;
          setLightMultiDragDelta({ dx, dy });
          setLightDragPreview(null);
        }
        return;
      }

      // Light area selection drag
      if (isSelectingLights.current && tile && lightSelDragStart.current) {
        setLightSelectionEnd(tile);
        return;
      }

      // Light pasting preview
      if (lightEditMode) {
        const state = useEditorStore.getState();
        if (state.isLightPasting && tile) {
          setLightPastePreviewPos(tile);
          return;
        }
      }

      // Object multi-drag
      if (isDraggingMultiObjects.current && tile && multiObjectDragOrigin.current) {
        const dx = tile.x - multiObjectDragOrigin.current.x;
        const dy = tile.y - multiObjectDragOrigin.current.y;
        if (dx !== 0 || dy !== 0) {
          setObjectMultiDragDelta({ dx, dy });
        } else {
          setObjectMultiDragDelta(null);
        }
        return;
      }

      // Object single dragging → convert to multi-drag
      if (isDraggingObject.current && tile && dragObjectOrigin.current) {
        if (tile.x !== dragObjectOrigin.current.x || tile.y !== dragObjectOrigin.current.y) {
          isDraggingObject.current = false;
          isDraggingMultiObjects.current = true;
          multiObjectDragOrigin.current = dragObjectOrigin.current;
          dragObjectOrigin.current = null;
          const dx = tile.x - multiObjectDragOrigin.current!.x;
          const dy = tile.y - multiObjectDragOrigin.current!.y;
          setObjectMultiDragDelta({ dx, dy });
          setObjectDragPreview(null);
        }
        return;
      }

      // Object area selection drag
      if (isSelectingObjects.current && tile && objectSelDragStart.current) {
        setObjectSelectionEnd(tile);
        return;
      }

      // Object pasting preview
      if (editMode === 'object') {
        const state = useEditorStore.getState();
        if (state.isObjectPasting && tile) {
          setObjectPastePreviewPos(tile);
          return;
        }
      }

      // Camera zone resize/drag/create: use unclamped tile to allow extending beyond map bounds
      const unclampedTile = (isResizingCameraZone.current || isDraggingCameraZone.current || isCreatingCameraZone.current) ? (canvasToTile(e, true) ?? tile) : null;

      // Camera zone resize
      if (isResizingCameraZone.current && unclampedTile && resizeCameraZoneOriginal.current && resizeCameraZoneStart.current) {
        const orig = resizeCameraZoneOriginal.current;
        const edge = resizeCameraZoneEdge.current!;
        const dx = unclampedTile.x - resizeCameraZoneStart.current.x;
        const dy = unclampedTile.y - resizeCameraZoneStart.current.y;
        let nx = orig.x, ny = orig.y, nw = orig.width, nh = orig.height;
        if (edge.includes('w')) { nx = orig.x + dx; nw = orig.width - dx; }
        if (edge.includes('e')) { nw = orig.width + dx; }
        if (edge.includes('n')) { ny = orig.y + dy; nh = orig.height - dy; }
        if (edge.includes('s')) { nh = orig.height + dy; }
        if (nw < 1) { nx = nx + nw - 1; nw = 1; }
        if (nh < 1) { ny = ny + nh - 1; nh = 1; }
        setCameraZoneDragPreview({ x: nx, y: ny, width: nw, height: nh });
        return;
      }

      // Camera zone dragging
      if (isDraggingCameraZone.current && unclampedTile && dragCameraZoneOrigin.current) {
        const zone = currentMap?.cameraZones?.find(z => z.id === draggedCameraZoneId.current);
        if (zone) {
          const dx = unclampedTile.x - dragCameraZoneOrigin.current.x;
          const dy = unclampedTile.y - dragCameraZoneOrigin.current.y;
          if (dx !== 0 || dy !== 0) {
            setCameraZoneDragPreview({ x: zone.x + dx, y: zone.y + dy, width: zone.width, height: zone.height });
          } else {
            setCameraZoneDragPreview(null);
          }
        }
        return;
      }

      // Camera zone creation drag
      if (isCreatingCameraZone.current && unclampedTile && createZoneStart.current) {
        const sx = createZoneStart.current.x;
        const sy = createZoneStart.current.y;
        const minX = Math.min(sx, unclampedTile.x);
        const minY = Math.min(sy, unclampedTile.y);
        const maxX = Math.max(sx, unclampedTile.x);
        const maxY = Math.max(sy, unclampedTile.y);
        setCameraZoneDragPreview({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 });
        return;
      }

      // Camera zone hover cursor
      if (editMode === 'cameraZone' && tile && !isDraggingCameraZone.current && !isCreatingCameraZone.current) {
        const selectedZoneId = useEditorStore.getState().selectedCameraZoneId;
        const zones = currentMap?.cameraZones || [];
        const selectedZone = selectedZoneId != null ? zones.find(z => z.id === selectedZoneId) : null;
        if (selectedZone) {
          const edge = detectCameraZoneEdge(tile, selectedZone);
          setCameraZoneCursor(edge ? edgeToCursorStyle(edge) : null);
        } else {
          setCameraZoneCursor(null);
        }
      }

      // Player start position drag
      if (isDraggingPlayerStart.current && tile) {
        playerStartDragPosRef.current = { x: tile.x, y: tile.y };
        setPlayerStartDragPos({ x: tile.x, y: tile.y });
        return;
      }

      // Event multi-drag (moving multiple selected events)
      if (isDraggingMultiEvents.current && tile && multiEventDragOrigin.current) {
        const dx = tile.x - multiEventDragOrigin.current.x;
        const dy = tile.y - multiEventDragOrigin.current.y;
        if (dx !== 0 || dy !== 0) {
          setEventMultiDragDelta({ dx, dy });
        } else {
          setEventMultiDragDelta(null);
        }
        return;
      }

      // Event area selection drag
      if (isSelectingEvents.current && tile && eventSelDragStart.current) {
        setEventSelectionEnd(tile);
        return;
      }

      // Event pasting preview
      if (editMode === 'event') {
        const state = useEditorStore.getState();
        if (state.isEventPasting && tile) {
          setEventPastePreviewPos(tile);
          return;
        }
      }

      if (isDraggingEvent.current && tile && dragEventOrigin.current) {
        if (tile.x !== dragEventOrigin.current.x || tile.y !== dragEventOrigin.current.y) {
          // 단일 이벤트 드래그가 시작되면 이것을 멀티드래그로 전환
          isDraggingEvent.current = false;
          isDraggingMultiEvents.current = true;
          multiEventDragOrigin.current = dragEventOrigin.current;
          dragEventOrigin.current = null;
          const dx = tile.x - multiEventDragOrigin.current!.x;
          const dy = tile.y - multiEventDragOrigin.current!.y;
          setEventMultiDragDelta({ dx, dy });
          setDragPreview(null);
        }
        return;
      }

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
    [canvasToTile, canvasToSubTile, placeTileWithUndo, applyShadow, selectedTool, setCursorTile, drawOverlayPreview, getCanvasPx, detectEdge, editMode, mode3d, setSelection, setPastePreviewPos, currentLayer, updateMapTiles]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if ((window as any)._probeDebugActive) return;
      if (isOrbiting.current) {
        isOrbiting.current = false;
        orbitStart.current = null;
        return;
      }
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

      // Light multi-drag commit
      if (isDraggingMultiLights.current) {
        const tile = canvasToTile(e);
        if (tile && multiLightDragOrigin.current) {
          const dx = tile.x - multiLightDragOrigin.current.x;
          const dy = tile.y - multiLightDragOrigin.current.y;
          const state = useEditorStore.getState();
          if (dx !== 0 || dy !== 0) {
            moveLights(state.selectedLightIds, dx, dy);
          }
        }
        isDraggingMultiLights.current = false;
        multiLightDragOrigin.current = null;
        setLightMultiDragDelta(null);
        return;
      }

      // Light single drag (mouseUp without move)
      if (isDraggingLight.current && draggedLightId.current != null) {
        isDraggingLight.current = false;
        draggedLightId.current = null;
        dragLightOrigin.current = null;
        setLightDragPreview(null);
        return;
      }

      // Light area selection commit
      if (isSelectingLights.current) {
        isSelectingLights.current = false;
        const start = lightSelDragStart.current;
        const tile = canvasToTile(e);
        lightSelDragStart.current = null;

        if (start && tile && start.x === tile.x && start.y === tile.y) {
          // 단일 클릭: 빈 공간이면 새 라이트 추가
          if (lightEditMode && selectedLightType === 'point') {
            addPointLight(tile.x, tile.y);
          }
          setLightSelectionStart(null);
          setLightSelectionEnd(null);
        } else if (start && tile && currentMap?.editorLights?.points) {
          const minX = Math.min(start.x, tile.x);
          const maxX = Math.max(start.x, tile.x);
          const minY = Math.min(start.y, tile.y);
          const maxY = Math.max(start.y, tile.y);
          const lightsInArea = currentMap.editorLights.points
            .filter(l => l.x >= minX && l.x <= maxX && l.y >= minY && l.y <= maxY)
            .map(l => l.id);
          if (e.shiftKey) {
            const curIds = useEditorStore.getState().selectedLightIds;
            const merged = [...new Set([...curIds, ...lightsInArea])];
            setSelectedLightIds(merged);
            if (merged.length > 0) setSelectedLightId(merged[merged.length - 1]);
          } else {
            setSelectedLightIds(lightsInArea);
            if (lightsInArea.length > 0) setSelectedLightId(lightsInArea[0]);
            else setSelectedLightId(null);
          }
          setLightSelectionStart(null);
          setLightSelectionEnd(null);
        }
        return;
      }

      // Camera zone resize commit
      if (isResizingCameraZone.current && resizeCameraZoneId.current != null) {
        const preview = cameraZoneDragPreviewRef.current;
        if (preview) {
          updateCameraZone(resizeCameraZoneId.current, {
            x: preview.x, y: preview.y,
            width: preview.width, height: preview.height,
          });
        }
        isResizingCameraZone.current = false;
        resizeCameraZoneId.current = null;
        resizeCameraZoneEdge.current = null;
        resizeCameraZoneOriginal.current = null;
        resizeCameraZoneStart.current = null;
        setCameraZoneDragPreview(null);
        setCameraZoneDragActive(false);
        return;
      }

      // Camera zone drag commit
      if (isDraggingCameraZone.current && draggedCameraZoneId.current != null) {
        const preview = cameraZoneDragPreviewRef.current;
        if (preview) {
          updateCameraZone(draggedCameraZoneId.current, { x: preview.x, y: preview.y });
        }
        isDraggingCameraZone.current = false;
        draggedCameraZoneId.current = null;
        dragCameraZoneOrigin.current = null;
        setCameraZoneDragPreview(null);
        setCameraZoneDragActive(false);
        return;
      }

      // Camera zone creation commit
      if (isCreatingCameraZone.current && createZoneStart.current) {
        const unclTile = clientToTileUnclamped(e.clientX, e.clientY);
        if (unclTile) {
          const sx = createZoneStart.current.x;
          const sy = createZoneStart.current.y;
          const minX = Math.min(sx, unclTile.x);
          const minY = Math.min(sy, unclTile.y);
          const w = Math.abs(unclTile.x - sx) + 1;
          const h = Math.abs(unclTile.y - sy) + 1;
          if (w >= 2 && h >= 2) {
            addCameraZone(minX, minY, w, h);
          }
        }
        isCreatingCameraZone.current = false;
        createZoneStart.current = null;
        setCameraZoneDragPreview(null);
        setCameraZoneDragActive(false);
        return;
      }

      // Object multi-drag commit
      if (isDraggingMultiObjects.current) {
        const tile = canvasToTile(e);
        if (tile && multiObjectDragOrigin.current) {
          const dx = tile.x - multiObjectDragOrigin.current.x;
          const dy = tile.y - multiObjectDragOrigin.current.y;
          const state = useEditorStore.getState();
          if (dx !== 0 || dy !== 0) {
            moveObjects(state.selectedObjectIds, dx, dy);
          }
        }
        isDraggingMultiObjects.current = false;
        multiObjectDragOrigin.current = null;
        setObjectMultiDragDelta(null);
        return;
      }

      // Object single drag (mouseUp without move)
      if (isDraggingObject.current && draggedObjectId.current != null) {
        isDraggingObject.current = false;
        draggedObjectId.current = null;
        dragObjectOrigin.current = null;
        setObjectDragPreview(null);
        return;
      }

      // Object area selection commit
      if (isSelectingObjects.current) {
        isSelectingObjects.current = false;
        const start = objectSelDragStart.current;
        const tile = canvasToTile(e);
        objectSelDragStart.current = null;

        if (start && tile && start.x === tile.x && start.y === tile.y) {
          // 단일 클릭: 빈 공간이면 새 오브젝트 추가
          addObject(tile.x, tile.y);
          setObjectSelectionStart(null);
          setObjectSelectionEnd(null);
        } else if (start && tile && currentMap?.objects) {
          const minX = Math.min(start.x, tile.x);
          const maxX = Math.max(start.x, tile.x);
          const minY = Math.min(start.y, tile.y);
          const maxY = Math.max(start.y, tile.y);
          const objectsInArea = currentMap.objects
            .filter(o => {
              // 오브젝트의 바운딩 박스와 선택 영역이 겹치는지
              const oMinX = o.x;
              const oMaxX = o.x + o.width - 1;
              const oMinY = o.y - o.height + 1;
              const oMaxY = o.y;
              return oMinX <= maxX && oMaxX >= minX && oMinY <= maxY && oMaxY >= minY;
            })
            .map(o => o.id);
          if (e.shiftKey) {
            const curIds = useEditorStore.getState().selectedObjectIds;
            const merged = [...new Set([...curIds, ...objectsInArea])];
            setSelectedObjectIds(merged);
            if (merged.length > 0) setSelectedObjectId(merged[merged.length - 1]);
          } else {
            setSelectedObjectIds(objectsInArea);
            if (objectsInArea.length > 0) setSelectedObjectId(objectsInArea[0]);
            else setSelectedObjectId(null);
          }
          setObjectSelectionStart(null);
          setObjectSelectionEnd(null);
        }
        return;
      }

      // Player start position drag commit
      if (isDraggingPlayerStart.current) {
        isDraggingPlayerStart.current = false;
        const dragPos = playerStartDragPosRef.current;
        if (dragPos && currentMapId) {
          setPlayerStartPosition(currentMapId, dragPos.x, dragPos.y).then(() => {
            playerStartDragPosRef.current = null;
            setPlayerStartDragPos(null);
          });
        } else {
          playerStartDragPosRef.current = null;
          setPlayerStartDragPos(null);
        }
        return;
      }

      // Event multi-drag commit
      if (isDraggingMultiEvents.current) {
        const tile = canvasToTile(e);
        if (tile && multiEventDragOrigin.current) {
          const dx = tile.x - multiEventDragOrigin.current.x;
          const dy = tile.y - multiEventDragOrigin.current.y;
          const state = useEditorStore.getState();
          if (dx !== 0 || dy !== 0) {
            moveEvents(state.selectedEventIds, dx, dy);
          }
        }
        isDraggingMultiEvents.current = false;
        multiEventDragOrigin.current = null;
        setEventMultiDragDelta(null);
        return;
      }

      // Event area selection commit
      if (isSelectingEvents.current) {
        isSelectingEvents.current = false;
        const start = eventSelDragStart.current;
        const tile = canvasToTile(e);
        eventSelDragStart.current = null;

        if (start && tile && start.x === tile.x && start.y === tile.y) {
          // 단일 클릭(드래그 없음) - 빈 공간이었으니 선택 해제
          setEventSelectionStart(null);
          setEventSelectionEnd(null);
        } else if (start && tile && currentMap?.events) {
          // 드래그 영역 내의 이벤트들 선택
          const minX = Math.min(start.x, tile.x);
          const maxX = Math.max(start.x, tile.x);
          const minY = Math.min(start.y, tile.y);
          const maxY = Math.max(start.y, tile.y);
          const eventsInArea = currentMap.events
            .filter(ev => ev && ev.id !== 0 && ev.x >= minX && ev.x <= maxX && ev.y >= minY && ev.y <= maxY)
            .map(ev => ev!.id);
          if (e.shiftKey) {
            // Shift: 기존 선택에 추가
            const curIds = useEditorStore.getState().selectedEventIds;
            const merged = [...new Set([...curIds, ...eventsInArea])];
            setSelectedEventIds(merged);
            if (merged.length > 0) setSelectedEventId(merged[merged.length - 1]);
          } else {
            setSelectedEventIds(eventsInArea);
            if (eventsInArea.length > 0) setSelectedEventId(eventsInArea[0]);
            else setSelectedEventId(null);
          }
          setEventSelectionStart(null);
          setEventSelectionEnd(null);
        }
        return;
      }

      // Single event drag (fallback - mouseUp without move)
      if (isDraggingEvent.current && draggedEventId.current != null) {
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
        // 붙여넣기 모드 취소
        const state = useEditorStore.getState();
        if (state.isEventPasting) {
          setIsEventPasting(false);
          setEventPastePreviewPos(null);
          return;
        }
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
    [editMode, canvasToTile, currentMap, setIsEventPasting, setEventPastePreviewPos]
  );

  const createNewEvent = useCallback((x: number, y: number) => {
    if (!currentMap) return;
    const oldEvents = [...(currentMap.events || [])];
    const events = [...oldEvents];
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
    const state = useEditorStore.getState();
    const currentMapId = state.currentMapId;
    useEditorStore.setState({ currentMap: { ...currentMap, events } as MapData & { tilesetNames?: string[] } });
    // undo 기록
    if (currentMapId) {
      const undoStack = [...useEditorStore.getState().undoStack, {
        mapId: currentMapId, type: 'event' as const,
        oldEvents, newEvents: events,
        oldSelectedEventId: state.selectedEventId,
        oldSelectedEventIds: state.selectedEventIds,
      }];
      if (undoStack.length > state.maxUndo) undoStack.shift();
      useEditorStore.setState({ undoStack, redoStack: [] });
    }
    setSelectedEventId(maxId + 1);
    setEditingEventId(maxId + 1);
  }, [currentMap, setSelectedEventId]);

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if ((window as any)._probeDebugActive && (window as any)._probeDebugLeave) {
        (window as any)._probeDebugLeave();
      }
      setHoverTile(null);
      if (isOrbiting.current) {
        isOrbiting.current = false;
        orbitStart.current = null;
        return;
      }
      if (isResizing.current) return;
      if (isDraggingEvent.current) {
        isDraggingEvent.current = false;
        draggedEventId.current = null;
        dragEventOrigin.current = null;
        setDragPreview(null);
      }
      if (isDraggingPlayerStart.current) {
        isDraggingPlayerStart.current = false;
        playerStartDragPosRef.current = null;
        setPlayerStartDragPos(null);
      }
      if (isDraggingMultiEvents.current) {
        isDraggingMultiEvents.current = false;
        multiEventDragOrigin.current = null;
        setEventMultiDragDelta(null);
      }
      if (isSelectingEvents.current) {
        isSelectingEvents.current = false;
        eventSelDragStart.current = null;
        setEventSelectionStart(null);
        setEventSelectionEnd(null);
      }
      if (isDraggingMultiLights.current) {
        isDraggingMultiLights.current = false;
        multiLightDragOrigin.current = null;
        setLightMultiDragDelta(null);
      }
      if (isSelectingLights.current) {
        isSelectingLights.current = false;
        lightSelDragStart.current = null;
        setLightSelectionStart(null);
        setLightSelectionEnd(null);
      }
      if (isDraggingMultiObjects.current) {
        isDraggingMultiObjects.current = false;
        multiObjectDragOrigin.current = null;
        setObjectMultiDragDelta(null);
      }
      if (isSelectingObjects.current) {
        isSelectingObjects.current = false;
        objectSelDragStart.current = null;
        setObjectSelectionStart(null);
        setObjectSelectionEnd(null);
      }
      // Camera zone drag/resize/create: don't cancel on mouse leave, window events will handle it
      if (isResizingCameraZone.current || isDraggingCameraZone.current || isCreatingCameraZone.current) {
        return;
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
    resizePreview, resizeCursor, dragPreview, eventMultiDragDelta,
    lightMultiDragDelta, objectMultiDragDelta,
    lightDragPreview, objectDragPreview, hoverTile,
    eventCtxMenu, editingEventId, setEditingEventId,
    closeEventCtxMenu,
    isDraggingEvent, isDraggingLight, isDraggingObject, draggedObjectId,
    isResizing, resizeOrigSize, isOrbiting, isSelectingEvents,
    isSelectingLights, isSelectingObjects,
    isDraggingCameraZone, isCreatingCameraZone, cameraZoneDragPreview,
    isResizingCameraZone, cameraZoneCursor,
    playerStartDragPos,
  };
}
