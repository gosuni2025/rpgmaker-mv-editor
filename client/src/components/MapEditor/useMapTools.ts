import React, { useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { TileChange } from '../../store/useEditorStore';
import { posToTile, TILE_SIZE_PX, isAutotile, isTileA5, getAutotileKindExported, makeAutotileId, computeAutoShapeForPosition, TILE_ID_B, TILE_ID_C, TILE_ID_D, TILE_ID_E, TILE_ID_A5, TILE_ID_A1 } from '../../utils/tileHelper';

// Runtime globals (loaded via index.html script tags)
declare const ConfigManager: any;
declare const Mode3D: any;

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

export interface MapToolsResult {
  canvasToTile: (e: React.MouseEvent<HTMLElement>) => { x: number; y: number } | null;
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

const EDGE_THRESHOLD = 16;

export function useMapTools(
  webglCanvasRef: React.RefObject<HTMLCanvasElement>,
  overlayRef: React.RefObject<HTMLCanvasElement>,
  pendingChanges: React.MutableRefObject<TileChange[]>,
  shadowPaintMode: React.MutableRefObject<boolean>,
  shadowPainted: React.MutableRefObject<Set<string>>,
): MapToolsResult {
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const selectedTileId = useEditorStore((s) => s.selectedTileId);
  const currentLayer = useEditorStore((s) => s.currentLayer);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const mode3d = useEditorStore((s) => s.mode3d);
  const updateMapTile = useEditorStore((s) => s.updateMapTile);
  const updateMapTiles = useEditorStore((s) => s.updateMapTiles);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const setSelectedTileId = useEditorStore((s) => s.setSelectedTileId);
  const setCurrentLayer = useEditorStore((s) => s.setCurrentLayer);
  const setPaletteTab = useEditorStore((s) => s.setPaletteTab);
  const showToast = useEditorStore((s) => s.showToast);

  // =========================================================================
  // Coordinate conversion
  // =========================================================================
  const canvasToTile = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return null;
    const container = canvas.parentElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const screenX = (e.clientX - rect.left) / zoomLevel;
    const screenY = (e.clientY - rect.top) / zoomLevel;

    // 3D mode: use Mode3D.screenToWorld for perspective-correct tile coordinates
    if (mode3d && ConfigManager.mode3d && Mode3D._perspCamera) {
      const world = Mode3D.screenToWorld(screenX, screenY);
      if (world) {
        const tileX = Math.floor(world.x / TILE_SIZE_PX);
        const tileY = Math.floor(world.y / TILE_SIZE_PX);
        if (!currentMap) return null;
        if (tileX < 0 || tileX >= currentMap.width || tileY < 0 || tileY >= currentMap.height) return null;
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
  // Eyedropper (스포이드) - Alt+Click으로 맵 타일 픽업
  // =========================================================================
  const eyedropTile = useCallback((tileX: number, tileY: number) => {
    const map = useEditorStore.getState().currentMap;
    if (!map) return;

    // 레이어 위에서부터 확인 (z=3→0), 비어있지 않은 첫 레이어의 타일을 선택
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

    // 타일 ID로부터 팔레트 탭 결정
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
    // 오토타일의 경우 대표 타일 ID(shape=46)로 변환
    if (isAutotile(pickedTileId)) {
      const kind = getAutotileKindExported(pickedTileId);
      pickedTileId = makeAutotileId(kind, 46);
    }

    showToast(`스포이드: 탭=${tab} 타일=${rawTileId}→${pickedTileId} 레이어=${pickedLayer}`);
    setPaletteTab(tab);
    setSelectedTileId(pickedTileId);
    setCurrentLayer(tab === 'A' ? 0 : 1);
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

    const nearN = py >= 0 && py <= t;
    const nearS = py >= mapH - t && py <= mapH;
    const nearW = px >= 0 && px <= t;
    const nearE = px >= mapW - t && px <= mapW;

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
  // Tool logic
  // =========================================================================
  const placeAutotileAt = useCallback(
    (x: number, y: number, z: number, tileId: number, data: number[], width: number, height: number, changes: TileChange[], updates: { x: number; y: number; z: number; tileId: number }[]) => {
      const idx = (z * height + y) * width + x;
      const oldId = data[idx];
      data[idx] = tileId;

      if (isAutotile(tileId) && !isTileA5(tileId)) {
        const kind = getAutotileKindExported(tileId);
        const shape = computeAutoShapeForPosition(data, width, height, x, y, z, tileId);
        const correctId = makeAutotileId(kind, shape);
        data[idx] = correctId;
        if (correctId !== oldId) {
          changes.push({ x, y, z, oldTileId: oldId, newTileId: correctId });
          updates.push({ x, y, z, tileId: correctId });
        }
      } else {
        if (tileId !== oldId) {
          changes.push({ x, y, z, oldTileId: oldId, newTileId: tileId });
          updates.push({ x, y, z, tileId });
        }
      }

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = (z * height + ny) * width + nx;
          const nTileId = data[nIdx];
          if (!isAutotile(nTileId) || isTileA5(nTileId)) continue;
          const nKind = getAutotileKindExported(nTileId);
          const nShape = computeAutoShapeForPosition(data, width, height, nx, ny, z, nTileId);
          const nCorrectId = makeAutotileId(nKind, nShape);
          if (nCorrectId !== nTileId) {
            const nOldId = nTileId;
            data[nIdx] = nCorrectId;
            changes.push({ x: nx, y: ny, z, oldTileId: nOldId, newTileId: nCorrectId });
            updates.push({ x: nx, y: ny, z, tileId: nCorrectId });
          }
        }
      }
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
      const targetId = data[(z * height + startY) * width + startX];

      if (z === 5) {
        if (targetId === selectedTileId) return;
        const visited = new Set<string>();
        const queue = [{ x: startX, y: startY }];
        const changes: TileChange[] = [];
        const updates: { x: number; y: number; z: number; tileId: number }[] = [];
        while (queue.length > 0) {
          const { x, y } = queue.shift()!;
          const key = `${x},${y}`;
          if (visited.has(key)) continue;
          if (x < 0 || x >= width || y < 0 || y >= height) continue;
          const idx = (z * height + y) * width + x;
          if (data[idx] !== targetId) continue;
          visited.add(key);
          changes.push({ x, y, z, oldTileId: targetId, newTileId: selectedTileId });
          updates.push({ x, y, z, tileId: selectedTileId });
          data[idx] = selectedTileId;
          queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
        }
        if (updates.length > 0) {
          updateMapTiles(updates);
          pushUndo(changes);
        }
        return;
      }

      const targetIsAutotile = isAutotile(targetId) && !isTileA5(targetId);
      const targetKind = targetIsAutotile ? getAutotileKindExported(targetId) : -1;
      const newIsAutotile = isAutotile(selectedTileId) && !isTileA5(selectedTileId);
      const newKind = newIsAutotile ? getAutotileKindExported(selectedTileId) : -1;
      if (targetIsAutotile && newIsAutotile && targetKind === newKind) return;
      if (!targetIsAutotile && !newIsAutotile && targetId === selectedTileId) return;

      const visited = new Set<string>();
      const queue = [{ x: startX, y: startY }];
      const filledPositions: { x: number; y: number }[] = [];

      while (queue.length > 0) {
        const { x, y } = queue.shift()!;
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        const idx = (z * height + y) * width + x;
        const curId = data[idx];
        const curIsAuto = isAutotile(curId) && !isTileA5(curId);
        const match = targetIsAutotile
          ? (curIsAuto && getAutotileKindExported(curId) === targetKind)
          : (curId === targetId);
        if (!match) continue;
        visited.add(key);
        filledPositions.push({ x, y });
        queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
      }

      if (filledPositions.length === 0) return;

      const changes: TileChange[] = [];
      const updates: { x: number; y: number; z: number; tileId: number }[] = [];

      for (const { x, y } of filledPositions) {
        const idx = (z * height + y) * width + x;
        data[idx] = selectedTileId;
      }

      const toRecalc = new Set<string>();
      for (const { x, y } of filledPositions) {
        toRecalc.add(`${x},${y}`);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              toRecalc.add(`${nx},${ny}`);
            }
          }
        }
      }

      const oldData = latestMap.data;
      for (const posKey of toRecalc) {
        const [px, py] = posKey.split(',').map(Number);
        const idx = (z * height + py) * width + px;
        const tileId = data[idx];
        if (isAutotile(tileId) && !isTileA5(tileId)) {
          const kind = getAutotileKindExported(tileId);
          const shape = computeAutoShapeForPosition(data, width, height, px, py, z, tileId);
          const correctId = makeAutotileId(kind, shape);
          data[idx] = correctId;
        }
        if (data[idx] !== oldData[idx]) {
          changes.push({ x: px, y: py, z, oldTileId: oldData[idx], newTileId: data[idx] });
          updates.push({ x: px, y: py, z, tileId: data[idx] });
        }
      }

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

      if (z === 5) {
        const changes: TileChange[] = [];
        const updates: { x: number; y: number; z: number; tileId: number }[] = [];
        for (const { x, y } of positions) {
          const idx = (z * height + y) * width + x;
          const oldId = latestMap.data[idx];
          const newId = getTileForPos(x, y);
          if (oldId !== newId) {
            changes.push({ x, y, z, oldTileId: oldId, newTileId: newId });
            updates.push({ x, y, z, tileId: newId });
          }
        }
        if (updates.length > 0) {
          updateMapTiles(updates);
          pushUndo(changes);
        }
        return;
      }

      const data = [...latestMap.data];
      const oldData = latestMap.data;

      for (const { x, y } of positions) {
        const idx = (z * height + y) * width + x;
        data[idx] = getTileForPos(x, y);
      }

      const toRecalc = new Set<string>();
      for (const { x, y } of positions) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              toRecalc.add(`${nx},${ny}`);
            }
          }
        }
      }

      for (const posKey of toRecalc) {
        const [px, py] = posKey.split(',').map(Number);
        const idx = (z * height + py) * width + px;
        const tid = data[idx];
        if (isAutotile(tid) && !isTileA5(tid)) {
          const kind = getAutotileKindExported(tid);
          const shape = computeAutoShapeForPosition(data, width, height, px, py, z, tid);
          data[idx] = makeAutotileId(kind, shape);
        }
      }

      const changes: TileChange[] = [];
      const updates: { x: number; y: number; z: number; tileId: number }[] = [];
      for (const posKey of toRecalc) {
        const [px, py] = posKey.split(',').map(Number);
        const idx = (z * height + py) * width + px;
        if (data[idx] !== oldData[idx]) {
          changes.push({ x: px, y: py, z, oldTileId: oldData[idx], newTileId: data[idx] });
          updates.push({ x: px, y: py, z, tileId: data[idx] });
        }
      }

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
        if (selectedTool === 'fill') {
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
        const newTileId = selectedTool === 'eraser' ? 0 : selectedTileId;
        if (oldTileId === newTileId) return;
        pendingChanges.current.push({ x, y, z, oldTileId, newTileId });
        updateMapTiles([{ x, y, z, tileId: newTileId }]);
        return;
      }

      if (selectedTool === 'eraser') {
        const changes: TileChange[] = [];
        const updates: { x: number; y: number; z: number; tileId: number }[] = [];
        const data = [...latestMap.data];
        placeAutotileAt(x, y, currentLayer, 0, data, latestMap.width, latestMap.height, changes, updates);
        if (updates.length > 0) {
          pendingChanges.current.push(...changes);
          updateMapTiles(updates);
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
              placeAutotileAt(tx, ty, currentLayer, sTiles[row][col], data, latestMap.width, latestMap.height, changes, updates);
            }
          }
          if (updates.length > 0) {
            pendingChanges.current.push(...changes);
            updateMapTiles(updates);
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
      } else if (selectedTool === 'fill') {
        floodFill(x, y);
      }
    },
    [selectedTool, selectedTileId, currentLayer, updateMapTiles, placeAutotileAt]
  );

  const drawRectangle = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap) return;
      const minX = Math.max(0, Math.min(start.x, end.x));
      const maxX = Math.min(latestMap.width - 1, Math.max(start.x, end.x));
      const minY = Math.max(0, Math.min(start.y, end.y));
      const maxY = Math.min(latestMap.height - 1, Math.max(start.y, end.y));

      const positions: { x: number; y: number }[] = [];
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          positions.push({ x, y });
        }
      }
      batchPlaceWithAutotile(positions, selectedTileId);
    },
    [selectedTileId, batchPlaceWithAutotile]
  );

  const drawEllipse = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap) return;
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const rx = (maxX - minX) / 2;
      const ry = (maxY - minY) / 2;

      const positions: { x: number; y: number }[] = [];
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (x < 0 || x >= latestMap.width || y < 0 || y >= latestMap.height) continue;
          const dx = (x - cx) / (rx || 0.5);
          const dy = (y - cy) / (ry || 0.5);
          if (dx * dx + dy * dy <= 1) {
            positions.push({ x, y });
          }
        }
      }
      batchPlaceWithAutotile(positions, selectedTileId);
    },
    [selectedTileId, batchPlaceWithAutotile]
  );

  const drawOverlayPreview = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, overlay.width, overlay.height);

      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);

      if (selectedTool === 'rectangle') {
        ctx.fillStyle = 'rgba(0,120,212,0.3)';
        ctx.strokeStyle = '#0078d4';
        ctx.lineWidth = 2;
        const rx = minX * TILE_SIZE_PX;
        const ry = minY * TILE_SIZE_PX;
        const rw = (maxX - minX + 1) * TILE_SIZE_PX;
        const rh = (maxY - minY + 1) * TILE_SIZE_PX;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
      } else if (selectedTool === 'ellipse') {
        const ecx = ((minX + maxX + 1) / 2) * TILE_SIZE_PX;
        const ecy = ((minY + maxY + 1) / 2) * TILE_SIZE_PX;
        const erx = ((maxX - minX + 1) / 2) * TILE_SIZE_PX;
        const ery = ((maxY - minY + 1) / 2) * TILE_SIZE_PX;
        ctx.fillStyle = 'rgba(0,120,212,0.3)';
        ctx.strokeStyle = '#0078d4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(ecx, ecy, erx, ery, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    },
    [selectedTool]
  );

  const clearOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
  }, []);

  return {
    canvasToTile, canvasToSubTile, eyedropTile,
    placeAutotileAt, placeTileWithUndo, floodFill,
    applyShadow, batchPlaceWithAutotile,
    drawRectangle, drawEllipse, drawOverlayPreview, clearOverlay,
    detectEdge, edgeToCursor, getCanvasPx,
  };
}
