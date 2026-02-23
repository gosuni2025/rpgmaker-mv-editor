import React, { useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { TileChange } from '../../store/useEditorStore';
import { useShallow } from 'zustand/react/shallow';
import { posToTile, TILE_SIZE_PX, isAutotile, getAutotileKindExported, makeAutotileId, TILE_ID_B, TILE_ID_C, TILE_ID_D, TILE_ID_E, TILE_ID_A5, TILE_ID_A1, isGroundDecorationTile, isUpperLayerTile } from '../../utils/tileHelper';
import { placeAutotileAtPure, floodFillRegion, floodFillTile, batchPlaceWithAutotilePure, getRectanglePositions, getEllipsePositions, resolveUpperLayerPlacement, resolveUpperLayerErase } from './mapToolAlgorithms';
import { useDrawingOverlay } from './useDrawingOverlay';
import type { DrawingOverlayRefs } from './useDrawingOverlay';
import { computePlacementChanges, computePlacementChangesWithData } from './mapToolHelpers';

// Runtime globals (loaded via index.html script tags)
declare const ConfigManager: any;
declare const Mode3D: any;

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

export interface MapToolsResult {
  canvasToTile: (e: React.MouseEvent<HTMLElement>, unclamped?: boolean) => { x: number; y: number } | null;
  canvasToSubTile: (e: React.MouseEvent<HTMLElement>) => { x: number; y: number; subX: number; subY: number } | null;
  eyedropTile: (tileX: number, tileY: number) => void;
  placeAutotileAt: (x: number, y: number, z: number, tileId: number, data: number[], width: number, height: number, changes: TileChange[], updates: { x: number; y: number; z: number; tileId: number }[]) => void;
  placeTileWithUndo: (tilePos: { x: number; y: number } | null) => void;
  floodFill: (startX: number, startY: number) => void;
  applyShadow: (tileX: number, tileY: number, subX: number, subY: number, isFirst: boolean) => void;
  batchPlaceWithAutotile: (positions: { x: number; y: number }[], tileId: number) => void;
  drawRectangle: (start: { x: number; y: number }, end: { x: number; y: number }) => void;
  drawEllipse: (start: { x: number; y: number }, end: { x: number; y: number }) => void;
  drawOverlayPreview: (start: { x: number; y: number }, end: { x: number; y: number }) => void;
  clearOverlay: () => void;
  detectEdge: (e: React.MouseEvent<HTMLElement>) => ResizeEdge;
  edgeToCursor: (edge: ResizeEdge) => string | null;
  getCanvasPx: (e: React.MouseEvent<HTMLElement>) => { x: number; y: number } | null;
}

const EDGE_THRESHOLD = 32;

export function useMapTools(
  webglCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  pendingChanges: React.MutableRefObject<TileChange[]>,
  shadowPaintMode: React.MutableRefObject<boolean>,
  shadowPainted: React.MutableRefObject<Set<string>>,
  toolPreviewMeshesRef: React.MutableRefObject<any[]>,
  rendererObjRef: React.MutableRefObject<any>,
  stageRef: React.MutableRefObject<any>,
  renderRequestedRef: React.MutableRefObject<boolean>,
): MapToolsResult {
  const {
    currentMap, selectedTool, drawShape, selectedTileId, currentLayer, zoomLevel, mode3d,
    updateMapTile, updateMapTiles, pushUndo, setSelectedTileId, setCurrentLayer, setPaletteTab, showToast,
  } = useEditorStore(useShallow((s) => ({
    currentMap: s.currentMap, selectedTool: s.selectedTool, drawShape: s.drawShape,
    selectedTileId: s.selectedTileId, currentLayer: s.currentLayer, zoomLevel: s.zoomLevel, mode3d: s.mode3d,
    updateMapTile: s.updateMapTile, updateMapTiles: s.updateMapTiles, pushUndo: s.pushUndo,
    setSelectedTileId: s.setSelectedTileId, setCurrentLayer: s.setCurrentLayer,
    setPaletteTab: s.setPaletteTab, showToast: s.showToast,
  })));

  // Drawing overlay (Three.js preview meshes)
  const overlayRefs: DrawingOverlayRefs = { toolPreviewMeshesRef, rendererObjRef, stageRef, renderRequestedRef };
  const { drawOverlayPreview, clearOverlay } = useDrawingOverlay(drawShape, overlayRefs);

  // =========================================================================
  // Coordinate conversion
  // =========================================================================
  const canvasToTile = useCallback((e: React.MouseEvent<HTMLElement>, unclamped = false) => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return null;
    const container = canvas.parentElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const screenX = (e.clientX - rect.left) / zoomLevel;
    const screenY = (e.clientY - rect.top) / zoomLevel;

    if (mode3d && ConfigManager.mode3d && Mode3D._perspCamera) {
      const world = Mode3D.screenToWorld(screenX, screenY);
      if (world) {
        const tileX = Math.floor(world.x / TILE_SIZE_PX);
        const tileY = Math.floor(world.y / TILE_SIZE_PX);
        if (!currentMap) return null;
        if (!unclamped && (tileX < 0 || tileX >= currentMap.width || tileY < 0 || tileY >= currentMap.height)) return null;
        return { x: tileX, y: tileY };
      }
      return null;
    }

    return posToTile(screenX, screenY);
  }, [zoomLevel, mode3d, currentMap]);

  const canvasToSubTile = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return null;
    const container = canvas.parentElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const screenX = (e.clientX - rect.left) / zoomLevel;
    const screenY = (e.clientY - rect.top) / zoomLevel;

    if (mode3d && ConfigManager.mode3d && Mode3D._perspCamera) {
      const world = Mode3D.screenToWorld(screenX, screenY);
      if (!world || !currentMap) return null;
      const tileX = Math.floor(world.x / TILE_SIZE_PX);
      const tileY = Math.floor(world.y / TILE_SIZE_PX);
      if (tileX < 0 || tileX >= currentMap.width || tileY < 0 || tileY >= currentMap.height) return null;
      const subX = world.x - tileX * TILE_SIZE_PX;
      const subY = world.y - tileY * TILE_SIZE_PX;
      return { x: tileX, y: tileY, subX, subY };
    }

    const tile = posToTile(screenX, screenY);
    if (!tile) return null;
    const subX = screenX - tile.x * TILE_SIZE_PX;
    const subY = screenY - tile.y * TILE_SIZE_PX;
    return { ...tile, subX, subY };
  }, [zoomLevel, mode3d, currentMap]);

  // =========================================================================
  // Eyedropper (스포이드)
  // =========================================================================
  const eyedropTile = useCallback((tileX: number, tileY: number) => {
    const map = useEditorStore.getState().currentMap;
    if (!map) return;

    let pickedTileId = 0;
    let pickedLayer = 0;
    for (let z = 3; z >= 0; z--) {
      const idx = (z * map.height + tileY) * map.width + tileX;
      const tid = map.data[idx];
      if (tid !== 0) {
        pickedTileId = tid;
        pickedLayer = z;
        break;
      }
    }

    let tab: 'A' | 'B' | 'C' | 'D' | 'E' = 'B';
    if (pickedTileId >= TILE_ID_A1) {
      tab = 'A';
    } else if (pickedTileId >= TILE_ID_A5) {
      tab = 'A';
    } else if (pickedTileId >= TILE_ID_E) {
      tab = 'E';
    } else if (pickedTileId >= TILE_ID_D) {
      tab = 'D';
    } else if (pickedTileId >= TILE_ID_C) {
      tab = 'C';
    } else {
      tab = 'B';
    }

    const rawTileId = pickedTileId;
    if (isAutotile(pickedTileId)) {
      const kind = getAutotileKindExported(pickedTileId);
      pickedTileId = makeAutotileId(kind, 46);
    }

    showToast(`스포이드: 탭=${tab} 타일=${rawTileId}→${pickedTileId} 레이어=${pickedLayer}`);
    setPaletteTab(tab);
    setSelectedTileId(pickedTileId);
    // A 탭: decoration 타일은 z=1, 기본 타일은 z=0
    setCurrentLayer(tab === 'A' ? (isGroundDecorationTile(pickedTileId) ? 1 : 0) : 1);
  }, [setPaletteTab, setSelectedTileId, setCurrentLayer, showToast]);

  // =========================================================================
  // Map boundary resize detection
  // =========================================================================
  const detectEdge = useCallback((e: React.MouseEvent<HTMLElement>): ResizeEdge => {
    if (!currentMap || mode3d) return null;
    const canvas = webglCanvasRef.current;
    if (!canvas) return null;
    const container = canvas.parentElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const px = (e.clientX - rect.left) / zoomLevel;
    const py = (e.clientY - rect.top) / zoomLevel;
    const mapW = currentMap.width * TILE_SIZE_PX;
    const mapH = currentMap.height * TILE_SIZE_PX;
    const t = EDGE_THRESHOLD;

    // Detect near edges including outside the map boundary (for expansion)
    const nearN = py >= -t && py <= t;
    const nearS = py >= mapH - t && py <= mapH + t;
    const nearW = px >= -t && px <= t;
    const nearE = px >= mapW - t && px <= mapW + t;

    if (nearN && nearW) return 'nw';
    if (nearN && nearE) return 'ne';
    if (nearS && nearW) return 'sw';
    if (nearS && nearE) return 'se';
    if (nearN && px > t && px < mapW - t) return 'n';
    if (nearS && px > t && px < mapW - t) return 's';
    if (nearW && py > t && py < mapH - t) return 'w';
    if (nearE && py > t && py < mapH - t) return 'e';
    return null;
  }, [currentMap, zoomLevel, mode3d]);

  const edgeToCursor = (edge: ResizeEdge): string | null => {
    switch (edge) {
      case 'n': case 's': return 'ns-resize';
      case 'e': case 'w': return 'ew-resize';
      case 'ne': case 'sw': return 'nesw-resize';
      case 'nw': case 'se': return 'nwse-resize';
      default: return null;
    }
  };

  const getCanvasPx = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return null;
    const container = canvas.parentElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoomLevel, y: (e.clientY - rect.top) / zoomLevel };
  }, [zoomLevel]);

  // =========================================================================
  // Tool wrappers (delegate to pure algorithms)
  // =========================================================================
  const placeAutotileAt = useCallback(
    (x: number, y: number, z: number, tileId: number, data: number[], width: number, height: number, changes: TileChange[], updates: { x: number; y: number; z: number; tileId: number }[]) => {
      placeAutotileAtPure(x, y, z, tileId, data, width, height, changes, updates);
    },
    []
  );

  const floodFill = useCallback(
    (startX: number, startY: number) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap) return;
      const { width, height } = latestMap;
      const z = currentLayer;
      const data = [...latestMap.data];
      const tileId = useEditorStore.getState().selectedTool === 'eraser' ? 0 : selectedTileId;

      if (z === 5) {
        const { changes, updates } = floodFillRegion(data, width, height, startX, startY, z, tileId);
        if (updates.length > 0) {
          updateMapTiles(updates);
          pushUndo(changes);
        }
        return;
      }

      const { changes, updates } = floodFillTile(data, latestMap.data, width, height, startX, startY, z, tileId);
      if (updates.length > 0) {
        updateMapTiles(updates);
        pushUndo(changes);
      }
    },
    [currentLayer, selectedTileId, updateMapTiles, pushUndo]
  );

  const applyShadow = useCallback(
    (tileX: number, tileY: number, subX: number, subY: number, isFirst: boolean) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap) return;
      const z = 4;
      const idx = (z * latestMap.height + tileY) * latestMap.width + tileX;
      const oldBits = latestMap.data[idx] || 0;
      const qx = subX < TILE_SIZE_PX / 2 ? 0 : 1;
      const qy = subY < TILE_SIZE_PX / 2 ? 0 : 1;
      const quarter = qy * 2 + qx;
      const key = `${tileX},${tileY},${quarter}`;

      if (isFirst) {
        shadowPaintMode.current = !(oldBits & (1 << quarter));
        shadowPainted.current.clear();
      }

      if (shadowPainted.current.has(key)) return;
      shadowPainted.current.add(key);

      let newBits: number;
      if (shadowPaintMode.current) {
        newBits = oldBits | (1 << quarter);
      } else {
        newBits = oldBits & ~(1 << quarter);
      }
      if (oldBits === newBits) return;
      const change: TileChange = { x: tileX, y: tileY, z, oldTileId: oldBits, newTileId: newBits };
      updateMapTile(tileX, tileY, z, newBits);
      pendingChanges.current.push(change);
    },
    [updateMapTile]
  );

  const batchPlaceWithAutotile = useCallback(
    (positions: { x: number; y: number }[], tileId: number) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap || positions.length === 0) return;
      const { width, height } = latestMap;
      const z = currentLayer;

      const { selectedTiles: sTiles, selectedTilesWidth: stW, selectedTilesHeight: stH } = useEditorStore.getState();
      const isMulti = sTiles && (stW > 1 || stH > 1);

      const getTileForPos = (x: number, y: number): number => {
        if (!isMulti) return tileId;
        const col = ((x % stW) + stW) % stW;
        const row = ((y % stH) + stH) % stH;
        return sTiles[row][col];
      };

      const data = [...latestMap.data];
      const { changes, updates } = batchPlaceWithAutotilePure(data, latestMap.data, width, height, z, positions, getTileForPos);
      if (updates.length > 0) {
        updateMapTiles(updates);
        pushUndo(changes);
      }
    },
    [currentLayer, updateMapTiles, pushUndo]
  );

  const placeTileWithUndo = useCallback(
    (tilePos: { x: number; y: number } | null) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap || !tilePos) return;
      const { x, y } = tilePos;
      if (x < 0 || x >= latestMap.width || y < 0 || y >= latestMap.height) return;

      const { selectedTiles: sTiles, selectedTilesWidth: stW, selectedTilesHeight: stH } = useEditorStore.getState();
      const isMulti = sTiles && (stW > 1 || stH > 1);

      if (currentLayer === 5) {
        if (drawShape === 'fill') {
          floodFill(x, y);
          return;
        }
        if (isMulti && selectedTool === 'pen') {
          for (let row = 0; row < stH; row++) {
            for (let col = 0; col < stW; col++) {
              const tx = x + col, ty = y + row;
              if (tx >= latestMap.width || ty >= latestMap.height) continue;
              const z = 5;
              const idx = (z * latestMap.height + ty) * latestMap.width + tx;
              const oldTileId = latestMap.data[idx];
              const newTileId = sTiles[row][col];
              if (oldTileId !== newTileId) {
                pendingChanges.current.push({ x: tx, y: ty, z, oldTileId, newTileId });
              }
            }
          }
          const updates = pendingChanges.current.filter((_, i) => i >= pendingChanges.current.length - stW * stH).map(c => ({ x: c.x, y: c.y, z: c.z, tileId: c.newTileId }));
          if (updates.length > 0) updateMapTiles(updates);
          return;
        }
        const z = 5;
        const idx = (z * latestMap.height + y) * latestMap.width + x;
        const oldTileId = latestMap.data[idx];
        const isEraser = selectedTool === 'eraser';
        const newTileId = isEraser ? 0 : selectedTileId;
        if (oldTileId === newTileId) return;
        pendingChanges.current.push({ x, y, z, oldTileId, newTileId });
        updateMapTiles([{ x, y, z, tileId: newTileId }]);
        return;
      }

      if (selectedTool === 'eraser') {
        // B/C/D/E 레이어(currentLayer=1): z=2→z=1 순서로 upper 타일 제거
        if (currentLayer === 1) {
          const placements = resolveUpperLayerErase(x, y, latestMap.data, latestMap.width, latestMap.height);
          if (placements.length > 0) {
            const { changes, updates } = computePlacementChanges(placements, latestMap.data, latestMap.width, latestMap.height);
            if (updates.length > 0) {
              pendingChanges.current.push(...changes);
              updateMapTiles(updates);
            }
          }
        } else {
          const changes: TileChange[] = [];
          const updates: { x: number; y: number; z: number; tileId: number }[] = [];
          const data = [...latestMap.data];
          placeAutotileAt(x, y, currentLayer, 0, data, latestMap.width, latestMap.height, changes, updates);
          if (updates.length > 0) {
            pendingChanges.current.push(...changes);
            updateMapTiles(updates);
          }
        }
      } else if (selectedTool === 'pen') {
        if (isMulti) {
          const changes: TileChange[] = [];
          const updates: { x: number; y: number; z: number; tileId: number }[] = [];
          const data = [...latestMap.data];
          for (let row = 0; row < stH; row++) {
            for (let col = 0; col < stW; col++) {
              const tx = x + col, ty = y + row;
              if (tx < 0 || tx >= latestMap.width || ty < 0 || ty >= latestMap.height) continue;
              const tid = sTiles[row][col];
              // B/C/D/E 타일 → 자동 레이어 관리
              if (currentLayer === 1 && isUpperLayerTile(tid)) {
                const placements = resolveUpperLayerPlacement(tx, ty, tid, data, latestMap.width, latestMap.height);
                const r = computePlacementChangesWithData(placements, data, latestMap.width, latestMap.height);
                changes.push(...r.changes);
                updates.push(...r.updates);
              } else {
                placeAutotileAt(tx, ty, currentLayer, tid, data, latestMap.width, latestMap.height, changes, updates);
              }
            }
          }
          if (updates.length > 0) {
            pendingChanges.current.push(...changes);
            updateMapTiles(updates);
          }
        } else {
          // B/C/D/E 타일 → 자동 레이어 관리
          if (currentLayer === 1 && isUpperLayerTile(selectedTileId)) {
            const placements = resolveUpperLayerPlacement(x, y, selectedTileId, latestMap.data, latestMap.width, latestMap.height);
            if (placements.length > 0) {
              const { changes, updates } = computePlacementChanges(placements, latestMap.data, latestMap.width, latestMap.height);
              if (updates.length > 0) {
                pendingChanges.current.push(...changes);
                updateMapTiles(updates);
              }
            }
          } else if (currentLayer === 1 && selectedTileId === 0) {
            // B탭 투명 타일 → z=1, z=2 클리어
            const placements = resolveUpperLayerPlacement(x, y, 0, latestMap.data, latestMap.width, latestMap.height);
            if (placements.length > 0) {
              const { changes, updates } = computePlacementChanges(placements, latestMap.data, latestMap.width, latestMap.height);
              if (updates.length > 0) {
                pendingChanges.current.push(...changes);
                updateMapTiles(updates);
              }
            }
          } else {
            const changes: TileChange[] = [];
            const updates: { x: number; y: number; z: number; tileId: number }[] = [];
            const data = [...latestMap.data];
            placeAutotileAt(x, y, currentLayer, selectedTileId, data, latestMap.width, latestMap.height, changes, updates);
            if (updates.length > 0) {
              pendingChanges.current.push(...changes);
              updateMapTiles(updates);
            }
          }
        }
      } else if (drawShape === 'fill') {
        floodFill(x, y);
      }
    },
    [selectedTool, drawShape, selectedTileId, currentLayer, updateMapTiles, placeAutotileAt]
  );

  const drawRectangle = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap) return;
      const tileId = useEditorStore.getState().selectedTool === 'eraser' ? 0 : selectedTileId;
      const positions = getRectanglePositions(start, end, latestMap.width, latestMap.height);
      batchPlaceWithAutotile(positions, tileId);
    },
    [selectedTileId, batchPlaceWithAutotile]
  );

  const drawEllipse = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap) return;
      const tileId = useEditorStore.getState().selectedTool === 'eraser' ? 0 : selectedTileId;
      const positions = getEllipsePositions(start, end, latestMap.width, latestMap.height);
      batchPlaceWithAutotile(positions, tileId);
    },
    [selectedTileId, batchPlaceWithAutotile]
  );

  return {
    canvasToTile, canvasToSubTile, eyedropTile,
    placeAutotileAt, placeTileWithUndo, floodFill,
    applyShadow, batchPlaceWithAutotile,
    drawRectangle, drawEllipse, drawOverlayPreview, clearOverlay,
    detectEdge, edgeToCursor, getCanvasPx,
  };
}
