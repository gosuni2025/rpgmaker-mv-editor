import type { EditorState, TileChange } from './types';
import { recalcAutotiles } from './editingHelpers';

type SetFn = (partial: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) => void;
type GetFn = () => EditorState;

export function updateMapTileOp(get: GetFn, set: SetFn, x: number, y: number, z: number, tileId: number) {
  const map = get().currentMap;
  if (!map) return;
  const newData = [...map.data];
  newData[(z * map.height + y) * map.width + x] = tileId;
  set({ currentMap: { ...map, data: newData } });
}

export function updateMapTilesOp(get: GetFn, set: SetFn, changes: { x: number; y: number; z: number; tileId: number }[]) {
  const map = get().currentMap;
  if (!map) return;
  const newData = [...map.data];
  for (const c of changes) {
    newData[(c.z * map.height + c.y) * map.width + c.x] = c.tileId;
  }
  set({ currentMap: { ...map, data: newData } });
}

export function pushUndoOp(get: GetFn, set: SetFn, changes: TileChange[]) {
  const { currentMapId, undoStack } = get();
  if (!currentMapId || changes.length === 0) return;
  const merged = new Map<string, TileChange>();
  for (const c of changes) {
    const key = `${c.x},${c.y},${c.z}`;
    const existing = merged.get(key);
    if (existing) {
      existing.newTileId = c.newTileId;
    } else {
      merged.set(key, { ...c });
    }
  }
  const mergedChanges = [...merged.values()].filter(c => c.oldTileId !== c.newTileId);
  if (mergedChanges.length === 0) return;
  const newStack = [...undoStack, { mapId: currentMapId, changes: mergedChanges } as any];
  if (newStack.length > get().maxUndo) newStack.shift();
  set({ undoStack: newStack, redoStack: [] });
}

export function copyTilesOp(get: GetFn, set: SetFn, x1: number, y1: number, x2: number, y2: number) {
  const map = get().currentMap;
  if (!map) return;
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  const tiles: { x: number; y: number; z: number; tileId: number }[] = [];
  for (let z = 0; z < 5; z++) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tileId = map.data[(z * map.height + y) * map.width + x];
        tiles.push({ x: x - minX, y: y - minY, z, tileId });
      }
    }
  }
  set({ clipboard: { type: 'tiles', tiles, width: maxX - minX + 1, height: maxY - minY + 1 } });
}

export function cutTilesOp(get: GetFn, set: SetFn, x1: number, y1: number, x2: number, y2: number) {
  copyTilesOp(get, set, x1, y1, x2, y2);
  deleteTilesOp(get, set, x1, y1, x2, y2);
}

export function pasteTilesOp(get: GetFn, set: SetFn, x: number, y: number) {
  const { clipboard, currentMap } = get();
  if (!clipboard || clipboard.type !== 'tiles' || !clipboard.tiles || !currentMap) return;
  const changes: TileChange[] = [];
  const newData = [...currentMap.data];
  const affected: { x: number; y: number; z: number }[] = [];
  for (const t of clipboard.tiles) {
    const tx = x + t.x, ty = y + t.y;
    if (tx < 0 || tx >= currentMap.width || ty < 0 || ty >= currentMap.height) continue;
    const idx = (t.z * currentMap.height + ty) * currentMap.width + tx;
    if (newData[idx] === t.tileId) continue;
    changes.push({ x: tx, y: ty, z: t.z, oldTileId: newData[idx], newTileId: t.tileId });
    newData[idx] = t.tileId;
    affected.push({ x: tx, y: ty, z: t.z });
  }
  recalcAutotiles(newData, currentMap.width, currentMap.height, affected, changes);
  set({ currentMap: { ...currentMap, data: newData } });
  pushUndoOp(get, set, changes);
}

export function deleteTilesOp(get: GetFn, set: SetFn, x1: number, y1: number, x2: number, y2: number) {
  const map = get().currentMap;
  if (!map) return;
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  const changes: TileChange[] = [];
  const newData = [...map.data];
  const affected: { x: number; y: number; z: number }[] = [];
  for (let z = 0; z < 5; z++) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = (z * map.height + y) * map.width + x;
        if (newData[idx] !== 0) {
          changes.push({ x, y, z, oldTileId: newData[idx], newTileId: 0 });
          newData[idx] = 0;
          affected.push({ x, y, z });
        }
      }
    }
  }
  recalcAutotiles(newData, map.width, map.height, affected, changes);
  set({ currentMap: { ...map, data: newData } });
  pushUndoOp(get, set, changes);
}

export function moveTilesOp(get: GetFn, set: SetFn, srcX1: number, srcY1: number, srcX2: number, srcY2: number, destX: number, destY: number) {
  const { clipboard, currentMap } = get();
  if (!currentMap || !clipboard || clipboard.type !== 'tiles' || !clipboard.tiles) return;
  const minX = Math.min(srcX1, srcX2), maxX = Math.max(srcX1, srcX2);
  const minY = Math.min(srcY1, srcY2), maxY = Math.max(srcY1, srcY2);
  const allChanges: TileChange[] = [];
  const newData = [...currentMap.data];

  const origTileMap = new Map<string, number>();
  for (const t of clipboard.tiles) {
    const ox = minX + t.x, oy = minY + t.y;
    origTileMap.set(`${ox},${oy},${t.z}`, t.tileId);
  }

  for (let z = 0; z < 5; z++) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const origTileId = origTileMap.get(`${x},${y},${z}`) ?? 0;
        if (origTileId !== 0) {
          allChanges.push({ x, y, z, oldTileId: origTileId, newTileId: 0 });
        }
        const idx = (z * currentMap.height + y) * currentMap.width + x;
        newData[idx] = 0;
      }
    }
  }
  const affected: { x: number; y: number; z: number }[] = [];
  for (const t of clipboard.tiles) {
    const tx = destX + t.x, ty = destY + t.y;
    if (tx < 0 || tx >= currentMap.width || ty < 0 || ty >= currentMap.height) continue;
    const idx = (t.z * currentMap.height + ty) * currentMap.width + tx;
    allChanges.push({ x: tx, y: ty, z: t.z, oldTileId: newData[idx], newTileId: t.tileId });
    newData[idx] = t.tileId;
    affected.push({ x: tx, y: ty, z: t.z });
  }
  for (let z = 0; z < 5; z++) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        affected.push({ x, y, z });
      }
    }
  }
  recalcAutotiles(newData, currentMap.width, currentMap.height, affected, allChanges);
  set({ currentMap: { ...currentMap, data: newData } });
  pushUndoOp(get, set, allChanges);
}
