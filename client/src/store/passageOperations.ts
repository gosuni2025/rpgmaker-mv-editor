import type { EditorState, PassageChange, PassageHistoryEntry } from './types';

type SetFn = (partial: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) => void;
type GetFn = () => EditorState;

export function copyPassageOp(get: GetFn, set: SetFn, x1: number, y1: number, x2: number, y2: number) {
  const map = get().currentMap;
  if (!map) return;
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  const cp = map.customPassage;
  const passage: { x: number; y: number; value: number }[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const val = cp ? (cp[y * map.width + x] || 0) : 0;
      passage.push({ x: x - minX, y: y - minY, value: val });
    }
  }
  set({ clipboard: { type: 'passage', passage, width: maxX - minX + 1, height: maxY - minY + 1 } });
}

export function cutPassageOp(get: GetFn, set: SetFn, x1: number, y1: number, x2: number, y2: number) {
  copyPassageOp(get, set, x1, y1, x2, y2);
  deletePassageOp(get, set, x1, y1, x2, y2);
}

export function pastePassageOp(get: GetFn, set: SetFn, x: number, y: number) {
  const { clipboard, currentMap, currentMapId, undoStack } = get();
  if (!currentMap || !currentMapId || !clipboard || clipboard.type !== 'passage' || !clipboard.passage) return;
  const w = currentMap.width;
  const h = currentMap.height;
  const cp = currentMap.customPassage ? [...currentMap.customPassage] : new Array(w * h).fill(0);
  const changes: PassageChange[] = [];
  for (const p of clipboard.passage) {
    const tx = x + p.x, ty = y + p.y;
    if (tx < 0 || tx >= w || ty < 0 || ty >= h) continue;
    const idx = ty * w + tx;
    const oldValue = cp[idx] || 0;
    if (oldValue === p.value) continue;
    changes.push({ x: tx, y: ty, oldValue, newValue: p.value });
    cp[idx] = p.value;
  }
  if (changes.length === 0) return;
  const entry: PassageHistoryEntry = { mapId: currentMapId, type: 'passage', changes };
  const newStack = [...undoStack, entry];
  if (newStack.length > get().maxUndo) newStack.shift();
  set({ currentMap: { ...currentMap, customPassage: cp }, undoStack: newStack, redoStack: [] });
}

export function deletePassageOp(get: GetFn, set: SetFn, x1: number, y1: number, x2: number, y2: number) {
  const { currentMap, currentMapId, undoStack } = get();
  if (!currentMap || !currentMapId) return;
  const w = currentMap.width;
  const h = currentMap.height;
  const cp = currentMap.customPassage ? [...currentMap.customPassage] : new Array(w * h).fill(0);
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  const changes: PassageChange[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const idx = y * w + x;
      const oldValue = cp[idx] || 0;
      if (oldValue === 0) continue;
      changes.push({ x, y, oldValue, newValue: 0 });
      cp[idx] = 0;
    }
  }
  if (changes.length === 0) return;
  const entry: PassageHistoryEntry = { mapId: currentMapId, type: 'passage', changes };
  const newStack = [...undoStack, entry];
  if (newStack.length > get().maxUndo) newStack.shift();
  set({ currentMap: { ...currentMap, customPassage: cp }, undoStack: newStack, redoStack: [] });
}

export function movePassageOp(get: GetFn, set: SetFn, srcX1: number, srcY1: number, srcX2: number, srcY2: number, destX: number, destY: number) {
  const { currentMap, currentMapId, undoStack } = get();
  if (!currentMap || !currentMapId) return;
  const w = currentMap.width;
  const h = currentMap.height;
  const cp = currentMap.customPassage ? [...currentMap.customPassage] : new Array(w * h).fill(0);
  const minX = Math.min(srcX1, srcX2), maxX = Math.max(srcX1, srcX2);
  const minY = Math.min(srcY1, srcY2), maxY = Math.max(srcY1, srcY2);
  const allChanges: PassageChange[] = [];
  const srcData: { dx: number; dy: number; value: number }[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const idx = y * w + x;
      const val = cp[idx] || 0;
      srcData.push({ dx: x - minX, dy: y - minY, value: val });
      if (val !== 0) {
        allChanges.push({ x, y, oldValue: val, newValue: 0 });
        cp[idx] = 0;
      }
    }
  }
  for (const d of srcData) {
    const tx = destX + d.dx, ty = destY + d.dy;
    if (tx < 0 || tx >= w || ty < 0 || ty >= h) continue;
    const idx = ty * w + tx;
    const oldValue = cp[idx] || 0;
    if (oldValue === d.value) continue;
    allChanges.push({ x: tx, y: ty, oldValue, newValue: d.value });
    cp[idx] = d.value;
  }
  if (allChanges.length === 0) return;
  const entry: PassageHistoryEntry = { mapId: currentMapId, type: 'passage', changes: allChanges };
  const newStack = [...undoStack, entry];
  if (newStack.length > get().maxUndo) newStack.shift();
  set({ currentMap: { ...currentMap, customPassage: cp }, undoStack: newStack, redoStack: [] });
}

export function updateCustomPassageOp(get: GetFn, set: SetFn, changes: PassageChange[]) {
  const { currentMap, currentMapId, undoStack } = get();
  if (!currentMap || !currentMapId || changes.length === 0) return;
  const w = currentMap.width;
  const h = currentMap.height;
  const cp = currentMap.customPassage ? [...currentMap.customPassage] : new Array(w * h).fill(0);
  const merged = new Map<string, PassageChange>();
  for (const c of changes) {
    const key = `${c.x},${c.y}`;
    const existing = merged.get(key);
    if (existing) {
      existing.newValue = c.newValue;
    } else {
      merged.set(key, { ...c });
    }
  }
  const mergedChanges = [...merged.values()].filter(c => c.oldValue !== c.newValue);
  if (mergedChanges.length === 0) return;
  for (const c of mergedChanges) {
    cp[c.y * w + c.x] = c.newValue;
  }
  const entry: PassageHistoryEntry = { mapId: currentMapId, type: 'passage', changes: mergedChanges };
  const newStack = [...undoStack, entry];
  if (newStack.length > get().maxUndo) newStack.shift();
  set({
    currentMap: { ...currentMap, customPassage: cp },
    undoStack: newStack,
    redoStack: [],
  });
}
