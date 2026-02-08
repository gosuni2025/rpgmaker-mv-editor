import React, { useRef, useEffect, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { TileChange } from '../../store/useEditorStore';
import type { RPGEvent, EventPage, MapData } from '../../types/rpgMakerMV';
import { getTileRenderInfo, posToTile, TILE_SIZE_PX, isAutotile, isTileA5, getAutotileKindExported, makeAutotileId, computeAutoShapeForPosition } from '../../utils/tileHelper';
import EventDetail from '../EventEditor/EventDetail';

interface EventContextMenu {
  x: number;
  y: number;
  tileX: number;
  tileY: number;
  eventId: number | null;
}

export default function MapCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastTile = useRef<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const pendingChanges = useRef<TileChange[]>([]);

  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const selectedTileId = useEditorStore((s) => s.selectedTileId);
  const currentLayer = useEditorStore((s) => s.currentLayer);
  const editMode = useEditorStore((s) => s.editMode);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const updateMapTile = useEditorStore((s) => s.updateMapTile);
  const updateMapTiles = useEditorStore((s) => s.updateMapTiles);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const setCursorTile = useEditorStore((s) => s.setCursorTile);
  const setSelectedEventId = useEditorStore((s) => s.setSelectedEventId);

  const [showGrid, setShowGrid] = useState(true);
  const [tilesetImages, setTilesetImages] = useState<Record<number, HTMLImageElement>>({});
  const [charImages, setCharImages] = useState<Record<string, HTMLImageElement>>({});
  const [eventCtxMenu, setEventCtxMenu] = useState<EventContextMenu | null>(null);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const copyEvent = useEditorStore((s) => s.copyEvent);
  const deleteEvent = useEditorStore((s) => s.deleteEvent);
  const pasteEvent = useEditorStore((s) => s.pasteEvent);
  const clipboard = useEditorStore((s) => s.clipboard);

  const selectedEventId = useEditorStore((s) => s.selectedEventId);

  useEffect(() => {
    const handler = (e: Event) => setShowGrid((e as CustomEvent<boolean>).detail);
    window.addEventListener('editor-toggle-grid', handler);
    return () => window.removeEventListener('editor-toggle-grid', handler);
  }, []);

  // Handle Delete key for events
  useEffect(() => {
    const handleDelete = () => {
      if (editMode === 'event' && selectedEventId != null) {
        deleteEvent(selectedEventId);
      }
    };
    window.addEventListener('editor-delete', handleDelete);
    return () => window.removeEventListener('editor-delete', handleDelete);
  }, [editMode, selectedEventId, deleteEvent]);

  // Handle Copy/Paste for events
  useEffect(() => {
    const handleCopy = () => {
      if (editMode === 'event' && selectedEventId != null) {
        copyEvent(selectedEventId);
      }
    };
    const handlePaste = () => {
      if (editMode === 'event' && clipboard?.type === 'event') {
        // Paste at cursor position or current selected event position
        const ev = currentMap?.events?.find(e => e && e.id === selectedEventId);
        if (ev) {
          pasteEvent(ev.x, ev.y + 1);
        }
      }
    };
    window.addEventListener('editor-copy', handleCopy);
    window.addEventListener('editor-paste', handlePaste);
    return () => {
      window.removeEventListener('editor-copy', handleCopy);
      window.removeEventListener('editor-paste', handlePaste);
    };
  }, [editMode, selectedEventId, copyEvent, pasteEvent, clipboard, currentMap]);

  useEffect(() => {
    if (!currentMap || !currentMap.tilesetNames) {
      setTilesetImages({});
      return;
    }

    const names = currentMap.tilesetNames;
    const loaded: Record<number, HTMLImageElement> = {};
    let cancelled = false;

    // Load ALL tileset images: A1(0), A2(1), A3(2), A4(3), A5(4), B(5), C(6), D(7), E(8)
    const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    let remaining = 0;

    indices.forEach((idx) => {
      const name = names[idx];
      if (!name) return;
      remaining++;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        loaded[idx] = img;
        remaining--;
        if (remaining <= 0) setTilesetImages({ ...loaded });
      };
      img.onerror = () => {
        if (cancelled) return;
        remaining--;
        if (remaining <= 0) setTilesetImages({ ...loaded });
      };
      img.src = `/api/resources/img_tilesets/${name}.png`;
    });

    if (remaining === 0) setTilesetImages({});

    return () => {
      cancelled = true;
    };
  }, [currentMap?.tilesetId, currentMap?.tilesetNames]);

  // Load character images used by events
  useEffect(() => {
    if (!currentMap || !currentMap.events) {
      setCharImages({});
      return;
    }
    const names = new Set<string>();
    for (const ev of currentMap.events) {
      if (!ev || !ev.pages) continue;
      for (const page of ev.pages) {
        if (page.image && page.image.characterName) {
          names.add(page.image.characterName);
        }
      }
    }
    if (names.size === 0) {
      setCharImages({});
      return;
    }
    let cancelled = false;
    const loaded: Record<string, HTMLImageElement> = {};
    let remaining = names.size;
    for (const name of names) {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        loaded[name] = img;
        remaining--;
        if (remaining <= 0) setCharImages({ ...loaded });
      };
      img.onerror = () => {
        if (cancelled) return;
        remaining--;
        if (remaining <= 0) setCharImages({ ...loaded });
      };
      img.src = `/api/resources/img_characters/${name}.png`;
    }
    return () => { cancelled = true; };
  }, [currentMap?.events]);

  // Main canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!currentMap) {
      canvas.width = 400;
      canvas.height = 300;
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No map selected', canvas.width / 2, canvas.height / 2);
      return;
    }

    const { width, height, data, events } = currentMap;
    const cw = width * TILE_SIZE_PX;
    const ch = height * TILE_SIZE_PX;
    canvas.width = cw;
    canvas.height = ch;

    // Also size the overlay
    if (overlayRef.current) {
      overlayRef.current.width = cw;
      overlayRef.current.height = ch;
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);

    const half = TILE_SIZE_PX / 2;
    for (let z = 0; z < 4; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const tileId = data[(z * height + y) * width + x];
          if (tileId === 0) continue;

          const info = getTileRenderInfo(tileId);
          if (!info) continue;

          const dx = x * TILE_SIZE_PX;
          const dy = y * TILE_SIZE_PX;

          if (info.type === 'normal') {
            const img = tilesetImages[info.sheet];
            if (!img) continue;
            ctx.drawImage(img, info.sx, info.sy, info.sw, info.sh, dx, dy, TILE_SIZE_PX, TILE_SIZE_PX);
          } else {
            // Autotile: composite 4 quarter-tiles
            const q = info.quarters;
            for (let i = 0; i < 4; i++) {
              const img = tilesetImages[q[i].sheet];
              if (!img) continue;
              const qdx = dx + (i % 2) * half;
              const qdy = dy + Math.floor(i / 2) * half;
              ctx.drawImage(img, q[i].sx, q[i].sy, half, half, qdx, qdy, half, half);
            }
          }
        }
      }
    }

    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TILE_SIZE_PX + 0.5, 0);
        ctx.lineTo(x * TILE_SIZE_PX + 0.5, ch);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TILE_SIZE_PX + 0.5);
        ctx.lineTo(cw, y * TILE_SIZE_PX + 0.5);
        ctx.stroke();
      }
    }

    if (events) {
      const showEventDetails = editMode === 'event';
      events.forEach((ev) => {
        if (!ev || ev.id === 0) return;
        const ex = ev.x * TILE_SIZE_PX;
        const ey = ev.y * TILE_SIZE_PX;

        // Draw character image from first page
        let drewImage = false;
        if (ev.pages && ev.pages.length > 0) {
          const page = ev.pages[0];
          const img = page.image;
          if (img && img.characterName && charImages[img.characterName]) {
            const charImg = charImages[img.characterName];
            const isSingle = img.characterName.startsWith('$');
            // Single character: whole sheet is 3 patterns x 4 directions
            // Normal: 4x2 grid of characters, each 3 patterns x 4 directions
            const charW = isSingle ? charImg.width / 3 : charImg.width / 12;
            const charH = isSingle ? charImg.height / 4 : charImg.height / 8;
            // Character index position in sheet
            const charCol = isSingle ? 0 : img.characterIndex % 4;
            const charRow = isSingle ? 0 : Math.floor(img.characterIndex / 4);
            // Direction: 2=down(0), 4=left(1), 6=right(2), 8=up(3)
            const dirRow = img.direction === 8 ? 3 : img.direction === 6 ? 2 : img.direction === 4 ? 1 : 0;
            const pattern = img.pattern || 1;
            const sx = charCol * charW * 3 + pattern * charW;
            const sy = charRow * charH * 4 + dirRow * charH;
            // Draw centered on tile, scaled to fit
            const scale = Math.min(TILE_SIZE_PX / charW, TILE_SIZE_PX / charH);
            const dw = charW * scale;
            const dh = charH * scale;
            const dx = ex + (TILE_SIZE_PX - dw) / 2;
            const dy = ey + (TILE_SIZE_PX - dh);
            ctx.drawImage(charImg, sx, sy, charW, charH, dx, dy, dw, dh);
            drewImage = true;
          }
        }

        // Event mode overlay
        if (showEventDetails) {
          if (!drewImage) {
            ctx.fillStyle = 'rgba(0,120,212,0.35)';
            ctx.fillRect(ex, ey, TILE_SIZE_PX, TILE_SIZE_PX);
          }
          ctx.strokeStyle = '#0078d4';
          ctx.lineWidth = 2;
          ctx.strokeRect(ex + 1, ey + 1, TILE_SIZE_PX - 2, TILE_SIZE_PX - 2);

          if (ev.name) {
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 2;
            ctx.fillText(ev.name, ex + TILE_SIZE_PX / 2, ey + 2, TILE_SIZE_PX - 4);
            ctx.restore();
          }
        } else if (!drewImage) {
          // Map mode: show subtle indicator for events without images
          ctx.fillStyle = 'rgba(0,120,212,0.25)';
          ctx.fillRect(ex, ey, TILE_SIZE_PX, TILE_SIZE_PX);
        }
      });
    }
  }, [currentMap, tilesetImages, charImages, showGrid, editMode]);

  const canvasToTile = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const container = canvas.parentElement;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / zoomLevel;
    const cy = (e.clientY - rect.top) / zoomLevel;
    return posToTile(cx, cy);
  }, [zoomLevel]);

  const getTileChange = useCallback((x: number, y: number, z: number, newTileId: number): TileChange | null => {
    const latestMap = useEditorStore.getState().currentMap;
    if (!latestMap) return null;
    const idx = (z * latestMap.height + y) * latestMap.width + x;
    const oldTileId = latestMap.data[idx];
    if (oldTileId === newTileId) return null;
    return { x, y, z, oldTileId, newTileId };
  }, []);

  // Place a tile with autotile shape calculation and neighbor updates
  const placeAutotileAt = useCallback(
    (x: number, y: number, z: number, tileId: number, data: number[], width: number, height: number, changes: TileChange[], updates: { x: number; y: number; z: number; tileId: number }[]) => {
      // Place the tile first (temporarily in data for neighbor calculation)
      const idx = (z * height + y) * width + x;
      const oldId = data[idx];
      data[idx] = tileId;

      if (isAutotile(tileId) && !isTileA5(tileId)) {
        // Compute correct shape for placed tile
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

      // Update neighbors' shapes
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

  const placeTileWithUndo = useCallback(
    (tilePos: { x: number; y: number } | null) => {
      // Always get latest state from store to avoid stale closures
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap || !tilePos) return;
      const { x, y } = tilePos;
      if (x < 0 || x >= latestMap.width || y < 0 || y >= latestMap.height) return;

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
        const changes: TileChange[] = [];
        const updates: { x: number; y: number; z: number; tileId: number }[] = [];
        const data = [...latestMap.data];
        placeAutotileAt(x, y, currentLayer, selectedTileId, data, latestMap.width, latestMap.height, changes, updates);
        if (updates.length > 0) {
          pendingChanges.current.push(...changes);
          updateMapTiles(updates);
        }
      } else if (selectedTool === 'fill') {
        floodFill(x, y);
      } else if (selectedTool === 'shadow') {
        applyShadow(x, y);
      }
    },
    [selectedTool, selectedTileId, currentLayer, updateMapTiles, placeAutotileAt]
  );

  const floodFill = useCallback(
    (startX: number, startY: number) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap) return;
      const { width, height } = latestMap;
      const z = currentLayer;
      const data = [...latestMap.data];
      const targetId = data[(z * height + startY) * width + startX];
      // For autotiles, compare by kind not exact ID
      const targetIsAutotile = isAutotile(targetId) && !isTileA5(targetId);
      const targetKind = targetIsAutotile ? getAutotileKindExported(targetId) : -1;
      const newIsAutotile = isAutotile(selectedTileId) && !isTileA5(selectedTileId);
      const newKind = newIsAutotile ? getAutotileKindExported(selectedTileId) : -1;
      if (targetIsAutotile && newIsAutotile && targetKind === newKind) return;
      if (!targetIsAutotile && !newIsAutotile && targetId === selectedTileId) return;

      const visited = new Set<string>();
      const queue = [{ x: startX, y: startY }];
      const filledPositions: { x: number; y: number }[] = [];

      // First pass: find all positions to fill
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

      // Second pass: place tiles with autotile shape calculation
      const changes: TileChange[] = [];
      const updates: { x: number; y: number; z: number; tileId: number }[] = [];

      // Set all filled positions first (raw)
      for (const { x, y } of filledPositions) {
        const idx = (z * height + y) * width + x;
        data[idx] = selectedTileId;
      }

      // Now compute correct shapes for all filled + their neighbors
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

      // Snapshot old data for undo
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
    (x: number, y: number) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap) return;
      // Shadow uses layer 3 (shadow layer) with a special tile pattern
      const z = 3;
      const idx = (z * latestMap.height + y) * latestMap.width + x;
      const oldTileId = latestMap.data[idx];
      // Toggle shadow: cycle through shadow quarter patterns (simplified: toggle between 0 and a shadow marker value)
      const newTileId = oldTileId === 0 ? 5 : 0; // Use tileId 5 as shadow marker
      const change: TileChange = { x, y, z, oldTileId, newTileId };
      updateMapTile(x, y, z, newTileId);
      pushUndo([change]);
    },
    [updateMapTile, pushUndo]
  );

  // Batch place tiles with autotile shape recalculation
  const batchPlaceWithAutotile = useCallback(
    (positions: { x: number; y: number }[], tileId: number) => {
      const latestMap = useEditorStore.getState().currentMap;
      if (!latestMap || positions.length === 0) return;
      const { width, height } = latestMap;
      const z = currentLayer;
      const data = [...latestMap.data];
      const oldData = latestMap.data;

      // Set all positions first (raw)
      for (const { x, y } of positions) {
        const idx = (z * height + y) * width + x;
        data[idx] = tileId;
      }

      // Collect all positions that need shape recalculation
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

      // Recalculate shapes
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

      // Build changes and updates
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

  // Draw preview overlay for rectangle/ellipse
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const tile = canvasToTile(e);
      if (!tile) return;

      if (editMode === 'event') {
        // In event mode, select event at this position
        if (currentMap && currentMap.events) {
          const ev = currentMap.events.find(
            (ev) => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y
          );
          setSelectedEventId(ev ? ev.id : null);
        }
        return;
      }

      isDrawing.current = true;
      lastTile.current = tile;
      pendingChanges.current = [];

      if (selectedTool === 'rectangle' || selectedTool === 'ellipse') {
        dragStart.current = tile;
      } else {
        placeTileWithUndo(tile);
      }
    },
    [canvasToTile, placeTileWithUndo, selectedTool, editMode, currentMap, setSelectedEventId]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const tile = canvasToTile(e);
      if (tile) {
        setCursorTile(tile.x, tile.y);
      }

      if (!isDrawing.current || !tile) return;

      if (selectedTool === 'rectangle' || selectedTool === 'ellipse') {
        if (dragStart.current) {
          drawOverlayPreview(dragStart.current, tile);
        }
        return;
      }

      if (lastTile.current && tile.x === lastTile.current.x && tile.y === lastTile.current.y) return;
      lastTile.current = tile;
      if (selectedTool === 'pen' || selectedTool === 'eraser') {
        placeTileWithUndo(tile);
      }
    },
    [canvasToTile, placeTileWithUndo, selectedTool, setCursorTile, drawOverlayPreview]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
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
          // Commit pen/eraser undo
          pushUndo(pendingChanges.current);
        }
      }
      isDrawing.current = false;
      lastTile.current = null;
      dragStart.current = null;
      pendingChanges.current = [];
    },
    [selectedTool, canvasToTile, drawRectangle, drawEllipse, clearOverlay, pushUndo]
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
        // Double click on empty tile in event mode → create new event
        createNewEvent(tile.x, tile.y);
      }
    },
    [editMode, canvasToTile, currentMap, setSelectedEventId]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (editMode !== 'event') return;
      e.preventDefault();
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

  return (
    <div style={styles.container} onClick={closeEventCtxMenu}>
      <div style={{
        position: 'relative',
        transform: `scale(${zoomLevel})`,
        transformOrigin: '0 0',
      }}>
        <canvas
          ref={canvasRef}
          style={styles.canvas}
        />
        <canvas
          ref={overlayRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          style={{
            ...styles.canvas,
            position: 'absolute',
            top: 0,
            left: 0,
            cursor: editMode === 'event' ? 'pointer' : 'crosshair',
          }}
        />
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
