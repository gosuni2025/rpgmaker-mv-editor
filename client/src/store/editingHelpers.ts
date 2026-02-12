import type { EditorState, TileChange, ObjectHistoryEntry, EventHistoryEntry } from './types';
import { isAutotile, isTileA5, getAutotileKindExported, makeAutotileId, computeAutoShapeForPosition } from '../utils/tileHelper';

type SetFn = (partial: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) => void;
type GetFn = () => EditorState;

/** 오브젝트 변경에 대한 undo 항목 push (헬퍼) */
export function pushObjectUndoEntry(
  get: GetFn,
  set: SetFn,
  oldObjects: any[],
  newObjects: any[],
) {
  const { currentMapId, undoStack, selectedObjectId, selectedObjectIds, maxUndo } = get();
  if (!currentMapId) return;
  const entry: ObjectHistoryEntry = {
    mapId: currentMapId,
    type: 'object',
    oldObjects: oldObjects as any,
    newObjects: newObjects as any,
    oldSelectedObjectId: selectedObjectId,
    oldSelectedObjectIds: selectedObjectIds,
  };
  const newStack = [...undoStack, entry];
  if (newStack.length > maxUndo) newStack.shift();
  set({ undoStack: newStack, redoStack: [] });
}

/** 이벤트 변경에 대한 undo 항목 push (헬퍼) */
export function pushEventUndoEntry(
  get: GetFn,
  set: SetFn,
  oldEvents: (any | null)[],
  newEvents: (any | null)[],
) {
  const { currentMapId, undoStack, selectedEventId, selectedEventIds, maxUndo } = get();
  if (!currentMapId) return;
  const entry: EventHistoryEntry = {
    mapId: currentMapId,
    type: 'event',
    oldEvents: oldEvents as any,
    newEvents: newEvents as any,
    oldSelectedEventId: selectedEventId,
    oldSelectedEventIds: selectedEventIds,
  };
  const newStack = [...undoStack, entry];
  if (newStack.length > maxUndo) newStack.shift();
  set({ undoStack: newStack, redoStack: [] });
}

/** 이벤트 이름의 숫자 포스트픽스를 증가시킨 새 이름 반환 */
export function incrementName(name: string, events: (any | null)[]): string {
  const match = name.match(/^(.*?)(\d+)$/);
  if (!match) return name;
  const prefix = match[1];
  const numStr = match[2];
  const padLen = numStr.length;
  const existingNames = new Set(events.filter(e => e).map(e => e.name as string));
  let num = parseInt(numStr, 10);
  let newName: string;
  do {
    num++;
    newName = prefix + String(num).padStart(padLen, '0');
  } while (existingNames.has(newName));
  return newName;
}

/**
 * 변경된 타일 위치 + 인접 타일의 오토타일 shape를 재계산.
 * data 배열을 직접 수정하고, 추가 변경사항을 changes에 추가.
 */
export function recalcAutotiles(
  data: number[], width: number, height: number,
  affectedPositions: { x: number; y: number; z: number }[],
  changes: TileChange[],
) {
  // 재계산 대상 수집 (변경 위치 + 인접 타일)
  const toRecalc = new Set<string>();
  for (const { x, y, z } of affectedPositions) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          toRecalc.add(`${nx},${ny},${z}`);
        }
      }
    }
  }

  for (const key of toRecalc) {
    const [px, py, pz] = key.split(',').map(Number);
    const idx = (pz * height + py) * width + px;
    const tid = data[idx];
    if (!isAutotile(tid) || isTileA5(tid)) continue;
    const kind = getAutotileKindExported(tid);
    const shape = computeAutoShapeForPosition(data, width, height, px, py, pz, tid);
    const correctId = makeAutotileId(kind, shape);
    if (correctId !== tid) {
      changes.push({ x: px, y: py, z: pz, oldTileId: tid, newTileId: correctId });
      data[idx] = correctId;
    }
  }
}
