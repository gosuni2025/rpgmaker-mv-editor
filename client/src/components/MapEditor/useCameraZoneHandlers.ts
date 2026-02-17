import React, { useRef, useState, useCallback, useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import type { MapToolsResult } from './useMapTools';

// 카메라존 최소 크기 = 화면 타일 수
const MIN_CZ_W = Math.ceil(816 / 48); // 17
const MIN_CZ_H = Math.ceil(624 / 48); // 13

export interface CameraZoneHandlersResult {
  isDraggingCameraZone: React.MutableRefObject<boolean>;
  isCreatingCameraZone: React.MutableRefObject<boolean>;
  isResizingCameraZone: React.MutableRefObject<boolean>;
  cameraZoneDragPreview: { x: number; y: number; width: number; height: number } | null;
  cameraZoneMultiDragDelta: { dx: number; dy: number } | null;
  cameraZoneCursor: string | null;
  handleCameraZoneMouseDown: (tile: { x: number; y: number } | null, unclampedTile: { x: number; y: number }, e: React.MouseEvent<HTMLElement>) => boolean;
  handleCameraZoneMouseMove: (tile: { x: number; y: number } | null, e: React.MouseEvent<HTMLElement>, canvasToTile: MapToolsResult['canvasToTile']) => boolean;
  handleCameraZoneMouseUp: (e: React.MouseEvent<HTMLElement>) => boolean;
  handleCameraZoneMouseLeave: () => boolean;
}

export function useCameraZoneHandlers(
  webglCanvasRef: React.RefObject<HTMLCanvasElement | null>,
): CameraZoneHandlersResult {
  const currentMap = useEditorStore((s) => s.currentMap);
  const setSelectedCameraZoneId = useEditorStore((s) => s.setSelectedCameraZoneId);
  const setSelectedCameraZoneIds = useEditorStore((s) => s.setSelectedCameraZoneIds);
  const addCameraZone = useEditorStore((s) => s.addCameraZone);
  const updateCameraZone = useEditorStore((s) => s.updateCameraZone);
  const moveCameraZones = useEditorStore((s) => s.moveCameraZones);

  // Camera zone drag state (single zone)
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
  const resizeCameraZoneEdge = useRef<string | null>(null);
  const resizeCameraZoneOriginal = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const resizeCameraZoneStart = useRef<{ x: number; y: number } | null>(null);
  const [cameraZoneCursor, setCameraZoneCursor] = useState<string | null>(null);

  // Multi-drag state
  const isDraggingMultiCameraZones = useRef(false);
  const multiCameraZoneDragOrigin = useRef<{ x: number; y: number } | null>(null);
  const [cameraZoneMultiDragDelta, setCameraZoneMultiDragDelta] = useState<{ dx: number; dy: number } | null>(null);

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

  // Convert clientX/clientY to tile coordinates (unclamped)
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

  // Ref to hold cleanup function for window-level camera zone drag listeners
  const cameraZoneWindowCleanup = useRef<(() => void) | null>(null);

  // Start window-level pointer capture for camera zone drag/resize/create
  const startCameraZoneWindowCapture = useCallback(() => {
    cameraZoneWindowCleanup.current?.();

    const handleWindowPointerMove = (e: PointerEvent) => {
      const tile = clientToTileUnclamped(e.clientX, e.clientY);
      if (!tile) return;

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
        if (nw < MIN_CZ_W) { if (edge.includes('w')) nx = orig.x + orig.width - MIN_CZ_W; nw = MIN_CZ_W; }
        if (nh < MIN_CZ_H) { if (edge.includes('n')) ny = orig.y + orig.height - MIN_CZ_H; nh = MIN_CZ_H; }
        setCameraZoneDragPreview({ x: nx, y: ny, width: nw, height: nh });
        return;
      }

      // Multi-drag
      if (isDraggingMultiCameraZones.current && multiCameraZoneDragOrigin.current) {
        const dx = tile.x - multiCameraZoneDragOrigin.current.x;
        const dy = tile.y - multiCameraZoneDragOrigin.current.y;
        if (dx !== 0 || dy !== 0) {
          setCameraZoneMultiDragDelta({ dx, dy });
        } else {
          setCameraZoneMultiDragDelta(null);
        }
        return;
      }

      // Single drag → convert to multi-drag
      if (isDraggingCameraZone.current && dragCameraZoneOrigin.current) {
        if (tile.x !== dragCameraZoneOrigin.current.x || tile.y !== dragCameraZoneOrigin.current.y) {
          isDraggingCameraZone.current = false;
          isDraggingMultiCameraZones.current = true;
          multiCameraZoneDragOrigin.current = dragCameraZoneOrigin.current;
          dragCameraZoneOrigin.current = null;
          const dx = tile.x - multiCameraZoneDragOrigin.current!.x;
          const dy = tile.y - multiCameraZoneDragOrigin.current!.y;
          setCameraZoneMultiDragDelta({ dx, dy });
          setCameraZoneDragPreview(null);
        }
        return;
      }

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

    const stopCapture = () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      cameraZoneWindowCleanup.current = null;
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      const tile = clientToTileUnclamped(e.clientX, e.clientY);

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
        stopCapture();
        return;
      }

      // Multi-drag commit
      if (isDraggingMultiCameraZones.current) {
        if (tile && multiCameraZoneDragOrigin.current) {
          const dx = tile.x - multiCameraZoneDragOrigin.current.x;
          const dy = tile.y - multiCameraZoneDragOrigin.current.y;
          const state = useEditorStore.getState();
          if (dx !== 0 || dy !== 0) {
            moveCameraZones(state.selectedCameraZoneIds, dx, dy);
          }
        }
        isDraggingMultiCameraZones.current = false;
        multiCameraZoneDragOrigin.current = null;
        setCameraZoneMultiDragDelta(null);
        stopCapture();
        return;
      }

      // Single drag (mouseUp without move)
      if (isDraggingCameraZone.current && draggedCameraZoneId.current != null) {
        isDraggingCameraZone.current = false;
        draggedCameraZoneId.current = null;
        dragCameraZoneOrigin.current = null;
        setCameraZoneDragPreview(null);
        stopCapture();
        return;
      }

      if (isCreatingCameraZone.current && createZoneStart.current) {
        if (tile) {
          const sx = createZoneStart.current.x;
          const sy = createZoneStart.current.y;
          const minX = Math.min(sx, tile.x);
          const minY = Math.min(sy, tile.y);
          const w = Math.abs(tile.x - sx) + 1;
          const h = Math.abs(tile.y - sy) + 1;
          if (w >= 2 || h >= 2) {
            addCameraZone(minX, minY, w, h);
          }
        }
        isCreatingCameraZone.current = false;
        createZoneStart.current = null;
        setCameraZoneDragPreview(null);
        stopCapture();
        return;
      }

      stopCapture();
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    cameraZoneWindowCleanup.current = stopCapture;
  }, [clientToTileUnclamped, setCameraZoneDragPreview, updateCameraZone, addCameraZone, moveCameraZones]);

  // Cleanup window listeners on unmount
  useEffect(() => {
    return () => { cameraZoneWindowCleanup.current?.(); };
  }, []);

  const handleCameraZoneMouseDown = useCallback((tile: { x: number; y: number } | null, unclampedTile: { x: number; y: number }, e: React.MouseEvent<HTMLElement>): boolean => {
    const zones = currentMap?.cameraZones || [];
    const state = useEditorStore.getState();
    const selectedZoneId = state.selectedCameraZoneId;
    const curIds = state.selectedCameraZoneIds;
    const selectedZone = selectedZoneId != null ? zones.find(z => z.id === selectedZoneId) : null;

    // Resize edge detection (only for single-selected zone, not during multi-select)
    if (selectedZone && curIds.length <= 1) {
      const edge = detectCameraZoneEdge(unclampedTile, selectedZone);
      if (edge) {
        isResizingCameraZone.current = true;
        resizeCameraZoneId.current = selectedZone.id;
        resizeCameraZoneEdge.current = edge;
        resizeCameraZoneOriginal.current = { x: selectedZone.x, y: selectedZone.y, width: selectedZone.width, height: selectedZone.height };
        resizeCameraZoneStart.current = { x: unclampedTile.x, y: unclampedTile.y };
        setCameraZoneDragPreview({ x: selectedZone.x, y: selectedZone.y, width: selectedZone.width, height: selectedZone.height });
        startCameraZoneWindowCapture();
        return true;
      }
    }

    const hitZone = zones.find(z =>
      unclampedTile.x >= z.x && unclampedTile.x < z.x + z.width &&
      unclampedTile.y >= z.y && unclampedTile.y < z.y + z.height
    );

    if (hitZone) {
      if (e.metaKey || e.ctrlKey) {
        // Cmd/Ctrl+click: toggle selection
        if (curIds.includes(hitZone.id)) {
          const newIds = curIds.filter(id => id !== hitZone.id);
          setSelectedCameraZoneIds(newIds);
          setSelectedCameraZoneId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
        } else {
          const newIds = [...curIds, hitZone.id];
          setSelectedCameraZoneIds(newIds);
          setSelectedCameraZoneId(hitZone.id);
        }
      } else if (curIds.includes(hitZone.id)) {
        // Already selected → prepare multi-drag
        isDraggingMultiCameraZones.current = true;
        multiCameraZoneDragOrigin.current = { x: unclampedTile.x, y: unclampedTile.y };
        setCameraZoneMultiDragDelta(null);
        startCameraZoneWindowCapture();
      } else {
        // New single selection → prepare single drag (converts to multi on move)
        setSelectedCameraZoneIds([hitZone.id]);
        setSelectedCameraZoneId(hitZone.id);
        isDraggingCameraZone.current = true;
        draggedCameraZoneId.current = hitZone.id;
        dragCameraZoneOrigin.current = { x: unclampedTile.x, y: unclampedTile.y };
        setCameraZoneDragPreview(null);
        startCameraZoneWindowCapture();
      }
    } else {
      // Click on empty space
      if (!(e.metaKey || e.ctrlKey)) {
        const hadSelection = curIds.length > 0;
        setSelectedCameraZoneIds([]);
        setSelectedCameraZoneId(null);
        // 선택된 항목이 있었으면 선택 해제만 하고 생성 진입하지 않음
        if (hadSelection) {
          return true;
        }
      }
      isCreatingCameraZone.current = true;
      createZoneStart.current = unclampedTile;
      setCameraZoneDragPreview({ x: unclampedTile.x, y: unclampedTile.y, width: 1, height: 1 });
      startCameraZoneWindowCapture();
    }
    return true;
  }, [currentMap, detectCameraZoneEdge, setCameraZoneDragPreview, startCameraZoneWindowCapture, setSelectedCameraZoneId, setSelectedCameraZoneIds]);

  const handleCameraZoneMouseMove = useCallback((tile: { x: number; y: number } | null, e: React.MouseEvent<HTMLElement>, canvasToTile: MapToolsResult['canvasToTile']): boolean => {
    const unclampedTile = (isResizingCameraZone.current || isDraggingCameraZone.current || isDraggingMultiCameraZones.current || isCreatingCameraZone.current) ? (canvasToTile(e, true) ?? tile) : null;

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
      if (nw < MIN_CZ_W) { if (edge.includes('w')) nx = orig.x + orig.width - MIN_CZ_W; nw = MIN_CZ_W; }
      if (nh < MIN_CZ_H) { if (edge.includes('n')) ny = orig.y + orig.height - MIN_CZ_H; nh = MIN_CZ_H; }
      setCameraZoneDragPreview({ x: nx, y: ny, width: nw, height: nh });
      return true;
    }

    // Multi-drag
    if (isDraggingMultiCameraZones.current && unclampedTile && multiCameraZoneDragOrigin.current) {
      const dx = unclampedTile.x - multiCameraZoneDragOrigin.current.x;
      const dy = unclampedTile.y - multiCameraZoneDragOrigin.current.y;
      if (dx !== 0 || dy !== 0) {
        setCameraZoneMultiDragDelta({ dx, dy });
      } else {
        setCameraZoneMultiDragDelta(null);
      }
      return true;
    }

    // Single drag → convert to multi-drag on move
    if (isDraggingCameraZone.current && unclampedTile && dragCameraZoneOrigin.current) {
      if (unclampedTile.x !== dragCameraZoneOrigin.current.x || unclampedTile.y !== dragCameraZoneOrigin.current.y) {
        isDraggingCameraZone.current = false;
        isDraggingMultiCameraZones.current = true;
        multiCameraZoneDragOrigin.current = dragCameraZoneOrigin.current;
        dragCameraZoneOrigin.current = null;
        const dx = unclampedTile.x - multiCameraZoneDragOrigin.current!.x;
        const dy = unclampedTile.y - multiCameraZoneDragOrigin.current!.y;
        setCameraZoneMultiDragDelta({ dx, dy });
        setCameraZoneDragPreview(null);
      }
      return true;
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
      return true;
    }

    // Camera zone hover cursor
    if (!isDraggingCameraZone.current && !isDraggingMultiCameraZones.current && !isCreatingCameraZone.current && !isResizingCameraZone.current) {
      const hoverTileUnclamped = canvasToTile(e, true) ?? tile;
      if (hoverTileUnclamped) {
        const state = useEditorStore.getState();
        const selectedZoneId = state.selectedCameraZoneId;
        const zones = currentMap?.cameraZones || [];
        const selectedZone = selectedZoneId != null ? zones.find(z => z.id === selectedZoneId) : null;
        if (selectedZone && state.selectedCameraZoneIds.length <= 1) {
          const edge = detectCameraZoneEdge(hoverTileUnclamped, selectedZone);
          setCameraZoneCursor(edge ? edgeToCursorStyle(edge) : null);
        } else {
          setCameraZoneCursor(null);
        }
      }
    }

    return false;
  }, [currentMap, detectCameraZoneEdge, edgeToCursorStyle, setCameraZoneDragPreview]);

  const handleCameraZoneMouseUp = useCallback((e: React.MouseEvent<HTMLElement>): boolean => {
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
      cameraZoneWindowCleanup.current?.();
      return true;
    }

    // Multi-drag commit
    if (isDraggingMultiCameraZones.current) {
      const tile = clientToTileUnclamped(e.clientX, e.clientY);
      if (tile && multiCameraZoneDragOrigin.current) {
        const dx = tile.x - multiCameraZoneDragOrigin.current.x;
        const dy = tile.y - multiCameraZoneDragOrigin.current.y;
        const state = useEditorStore.getState();
        if (dx !== 0 || dy !== 0) {
          moveCameraZones(state.selectedCameraZoneIds, dx, dy);
        }
      }
      isDraggingMultiCameraZones.current = false;
      multiCameraZoneDragOrigin.current = null;
      setCameraZoneMultiDragDelta(null);
      cameraZoneWindowCleanup.current?.();
      return true;
    }

    // Single drag (mouseUp without move)
    if (isDraggingCameraZone.current && draggedCameraZoneId.current != null) {
      isDraggingCameraZone.current = false;
      draggedCameraZoneId.current = null;
      dragCameraZoneOrigin.current = null;
      setCameraZoneDragPreview(null);
      cameraZoneWindowCleanup.current?.();
      return true;
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
        if (w >= 2 || h >= 2) {
          addCameraZone(minX, minY, w, h);
        }
      }
      isCreatingCameraZone.current = false;
      createZoneStart.current = null;
      setCameraZoneDragPreview(null);
      cameraZoneWindowCleanup.current?.();
      return true;
    }

    return false;
  }, [clientToTileUnclamped, updateCameraZone, addCameraZone, moveCameraZones, setCameraZoneDragPreview]);

  const handleCameraZoneMouseLeave = useCallback((): boolean => {
    // Camera zone drag/resize/create: don't cancel on mouse leave, window events will handle it
    if (isResizingCameraZone.current || isDraggingCameraZone.current || isDraggingMultiCameraZones.current || isCreatingCameraZone.current) {
      return true;
    }
    return false;
  }, []);

  return {
    isDraggingCameraZone, isCreatingCameraZone, isResizingCameraZone,
    cameraZoneDragPreview, cameraZoneMultiDragDelta, cameraZoneCursor,
    handleCameraZoneMouseDown, handleCameraZoneMouseMove,
    handleCameraZoneMouseUp, handleCameraZoneMouseLeave,
  };
}
