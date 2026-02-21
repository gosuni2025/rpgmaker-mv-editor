import type { MapObject } from '../types/rpgMakerMV';
import type { EditorState } from './types';
import { pushObjectUndoEntry } from './editingHelpers';

type SetFn = (partial: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) => void;
type GetFn = () => EditorState;

/**
 * 칠한 타일(외곽선)을 기반으로 내부를 채운 타일 영역을 계산.
 * 바운딩 박스+1 패딩 영역에서 외부를 flood fill하고,
 * flood fill에 닿지 않은 비-외곽선 타일을 내부로 판정.
 */
function fillInterior(paintedTiles: Set<string>, minX: number, minY: number, w: number, h: number): Set<string> {
  // 패딩 1칸 추가 (외부 flood fill 시작점 확보)
  const pw = w + 2, ph = h + 2;
  // grid: 0=빈칸, 1=외곽선(칠한 타일)
  const grid = new Uint8Array(pw * ph);
  for (const key of paintedTiles) {
    const [sx, sy] = key.split(',');
    const lx = parseInt(sx) - minX + 1; // +1 for padding
    const ly = parseInt(sy) - minY + 1;
    grid[ly * pw + lx] = 1;
  }

  // 외부 flood fill (0,0에서 시작, 외곽선=벽)
  const visited = new Uint8Array(pw * ph);
  const stack: number[] = [0]; // index into grid
  visited[0] = 1;
  while (stack.length > 0) {
    const idx = stack.pop()!;
    const cx = idx % pw, cy = (idx - cx) / pw;
    const neighbors = [
      cy > 0 ? idx - pw : -1,
      cy < ph - 1 ? idx + pw : -1,
      cx > 0 ? idx - 1 : -1,
      cx < pw - 1 ? idx + 1 : -1,
    ];
    for (const ni of neighbors) {
      if (ni >= 0 && !visited[ni] && grid[ni] === 0) {
        visited[ni] = 1;
        stack.push(ni);
      }
    }
  }

  // 외곽선 + 내부(flood fill에 닿지 않은 빈칸) = 최종 타일 영역
  const filled = new Set(paintedTiles);
  for (let ly = 1; ly <= h; ly++) {
    for (let lx = 1; lx <= w; lx++) {
      const gi = ly * pw + lx;
      if (grid[gi] === 0 && !visited[gi]) {
        filled.add(`${minX + lx - 1},${minY + ly - 1}`);
      }
    }
  }
  return filled;
}

/** 맵에서 모든 레이어의 타일 ID 읽기 (z=0~3) */
function readMapTileLayers(data: number[], mapW: number, mapH: number, tx: number, ty: number): number[] {
  const layers: number[] = [];
  for (let z = 0; z < 4; z++) {
    layers.push(data[(z * mapH + ty) * mapW + tx]);
  }
  return layers;
}

/** 타일 레이어 배열이 비어있는지 확인 (모두 0) */
function isEmptyTileLayers(layers: number[]): boolean {
  return layers.every(t => t === 0);
}

export function addObjectFromTilesOp(get: GetFn, set: SetFn, paintedTiles: Set<string>) {
  const { currentMap, currentMapId } = get();
  if (!currentMap || !currentMapId || paintedTiles.size === 0) return;
  const oldObjects = currentMap.objects || [];

  // 바운딩 박스 계산
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const key of paintedTiles) {
    const [sx, sy] = key.split(',');
    const tx = parseInt(sx), ty = parseInt(sy);
    if (tx < minX) minX = tx;
    if (ty < minY) minY = ty;
    if (tx > maxX) maxX = tx;
    if (ty > maxY) maxY = ty;
  }

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const mapW = currentMap.width;
  const mapH = currentMap.height;
  const data = currentMap.data;

  // 외곽선(칠한 타일) + 내부 채우기
  const filledTiles = fillInterior(paintedTiles, minX, minY, w, h);

  // tileIds[row][col][layer] 배열 생성 (row 0 = 상단, layer 0~3)
  const tileIds: number[][][] = [];
  for (let row = 0; row < h; row++) {
    const rowArr: number[][] = [];
    for (let col = 0; col < w; col++) {
      const tx = minX + col;
      const ty = minY + row;
      if (filledTiles.has(`${tx},${ty}`)) {
        rowArr.push(readMapTileLayers(data, mapW, mapH, tx, ty));
      } else {
        rowArr.push([0, 0, 0, 0]);
      }
    }
    tileIds.push(rowArr);
  }

  // passability 배열 생성 (하단 행만 불통, 나머지 통행)
  const passability: boolean[][] = [];
  for (let row = 0; row < h; row++) {
    passability.push(Array(w).fill(row < h - 1));
  }

  const objects = [...oldObjects];
  const newId = objects.length > 0 ? Math.max(...objects.map(o => o.id)) + 1 : 1;
  // y = maxY (하단 기준점)
  const newObj: MapObject = {
    id: newId,
    name: `OBJ${newId}`,
    x: minX,
    y: maxY,
    tileIds,
    width: w,
    height: h,
    zHeight: 0,
    passability,
  };
  objects.push(newObj);
  set({ currentMap: { ...currentMap, objects }, selectedObjectId: newId, selectedObjectIds: [newId] });
  pushObjectUndoEntry(get, set, oldObjects, objects);
}

/**
 * 선택된 오브젝트에 타일 영역 추가 (확장).
 * paintedTiles: 칠한 타일 좌표 Set ("x,y")
 */
export function expandObjectTilesOp(get: GetFn, set: SetFn, objectId: number, paintedTiles: Set<string>) {
  const { currentMap, currentMapId } = get();
  if (!currentMap || !currentMapId || !currentMap.objects || paintedTiles.size === 0) return;
  const obj = currentMap.objects.find(o => o.id === objectId);
  if (!obj) return;

  const mapW = currentMap.width, mapH = currentMap.height, data = currentMap.data;
  const oldObjects = currentMap.objects;

  // 기존 오브젝트의 타일 좌표를 Set으로 구성
  const existingTiles = new Set<string>();
  const objTopY = obj.y - obj.height + 1;
  for (let row = 0; row < obj.height; row++) {
    for (let col = 0; col < obj.width; col++) {
      const cell = obj.tileIds[row]?.[col];
      const hasContent = Array.isArray(cell) ? !isEmptyTileLayers(cell) : (cell !== 0 && cell != null);
      if (hasContent) {
        existingTiles.add(`${obj.x + col},${objTopY + row}`);
      }
    }
  }

  // paintedTiles에 flood fill 적용 후 기존 타일과 합치기
  let allPMinX = Infinity, allPMinY = Infinity, allPMaxX = -Infinity, allPMaxY = -Infinity;
  for (const key of paintedTiles) {
    const [sx, sy] = key.split(',');
    const tx = parseInt(sx), ty = parseInt(sy);
    if (tx < allPMinX) allPMinX = tx;
    if (ty < allPMinY) allPMinY = ty;
    if (tx > allPMaxX) allPMaxX = tx;
    if (ty > allPMaxY) allPMaxY = ty;
  }
  const pw = allPMaxX - allPMinX + 1, ph = allPMaxY - allPMinY + 1;
  const filledPaint = fillInterior(paintedTiles, allPMinX, allPMinY, pw, ph);

  // 기존 + 새 타일 합치기
  const merged = new Set(existingTiles);
  for (const key of filledPaint) merged.add(key);

  // 새 바운딩 박스 계산
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const key of merged) {
    const [sx, sy] = key.split(',');
    const tx = parseInt(sx), ty = parseInt(sy);
    if (tx < minX) minX = tx;
    if (ty < minY) minY = ty;
    if (tx > maxX) maxX = tx;
    if (ty > maxY) maxY = ty;
  }
  const w = maxX - minX + 1, h = maxY - minY + 1;

  // 새 tileIds 생성
  const tileIds: number[][][] = [];
  for (let row = 0; row < h; row++) {
    const rowArr: number[][] = [];
    for (let col = 0; col < w; col++) {
      const tx = minX + col, ty = minY + row;
      const key = `${tx},${ty}`;
      if (merged.has(key)) {
        if (existingTiles.has(key)) {
          const oldRow = ty - objTopY, oldCol = tx - obj.x;
          const cell = obj.tileIds[oldRow]?.[oldCol];
          rowArr.push(Array.isArray(cell) ? [...cell] : [cell ?? 0, 0, 0, 0]);
        } else {
          rowArr.push(readMapTileLayers(data, mapW, mapH, tx, ty));
        }
      } else {
        rowArr.push([0, 0, 0, 0]);
      }
    }
    tileIds.push(rowArr);
  }

  const passability: boolean[][] = [];
  for (let row = 0; row < h; row++) {
    passability.push(Array(w).fill(row < h - 1));
  }

  const updated: MapObject = { ...obj, x: minX, y: maxY, width: w, height: h, tileIds, passability };
  const objects = oldObjects.map(o => o.id === objectId ? updated : o);
  set({ currentMap: { ...currentMap, objects } });
  pushObjectUndoEntry(get, set, oldObjects, objects);
}

/**
 * 선택된 오브젝트에서 타일 영역 제거 (축소).
 * removeTiles: 제거할 타일 좌표 Set ("x,y")
 */
export function shrinkObjectTilesOp(get: GetFn, set: SetFn, objectId: number, removeTiles: Set<string>) {
  const { currentMap, currentMapId } = get();
  if (!currentMap || !currentMapId || !currentMap.objects || removeTiles.size === 0) return;
  const obj = currentMap.objects.find(o => o.id === objectId);
  if (!obj) return;

  const oldObjects = currentMap.objects;
  const objTopY = obj.y - obj.height + 1;

  // 기존 타일에서 removeTiles 제거
  const remaining = new Set<string>();
  for (let row = 0; row < obj.height; row++) {
    for (let col = 0; col < obj.width; col++) {
      const cell = obj.tileIds[row]?.[col];
      const hasContent = Array.isArray(cell) ? !isEmptyTileLayers(cell) : (cell !== 0 && cell != null);
      if (hasContent) {
        const key = `${obj.x + col},${objTopY + row}`;
        if (!removeTiles.has(key)) remaining.add(key);
      }
    }
  }

  // 타일이 모두 제거되면 오브젝트 삭제
  if (remaining.size === 0) {
    const objects = oldObjects.filter(o => o.id !== objectId);
    set({
      currentMap: { ...currentMap, objects },
      selectedObjectId: null,
      selectedObjectIds: [],
    });
    pushObjectUndoEntry(get, set, oldObjects, objects);
    return;
  }

  // 새 바운딩 박스
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const key of remaining) {
    const [sx, sy] = key.split(',');
    const tx = parseInt(sx), ty = parseInt(sy);
    if (tx < minX) minX = tx;
    if (ty < minY) minY = ty;
    if (tx > maxX) maxX = tx;
    if (ty > maxY) maxY = ty;
  }
  const w = maxX - minX + 1, h = maxY - minY + 1;

  // 새 tileIds 생성 (기존 tileId 유지, number[][][])
  const tileIds: number[][][] = [];
  for (let row = 0; row < h; row++) {
    const rowArr: number[][] = [];
    for (let col = 0; col < w; col++) {
      const tx = minX + col, ty = minY + row;
      if (remaining.has(`${tx},${ty}`)) {
        const oldRow = ty - objTopY, oldCol = tx - obj.x;
        const cell = obj.tileIds[oldRow]?.[oldCol];
        rowArr.push(Array.isArray(cell) ? [...cell] : [cell ?? 0, 0, 0, 0]);
      } else {
        rowArr.push([0, 0, 0, 0]);
      }
    }
    tileIds.push(rowArr);
  }

  const passability: boolean[][] = [];
  for (let row = 0; row < h; row++) {
    passability.push(Array(w).fill(row < h - 1));
  }

  const updated: MapObject = { ...obj, x: minX, y: maxY, width: w, height: h, tileIds, passability };
  const objects = oldObjects.map(o => o.id === objectId ? updated : o);
  set({ currentMap: { ...currentMap, objects } });
  pushObjectUndoEntry(get, set, oldObjects, objects);
}
