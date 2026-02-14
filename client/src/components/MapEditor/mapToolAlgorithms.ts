/**
 * 맵 도구의 순수 알고리즘 함수들
 * React 의존성 없이 데이터 배열만으로 동작
 */
import type { TileChange } from '../../store/types';
import { isAutotile, isTileA5, isTileA1, getAutotileKindExported, makeAutotileId, computeAutoShapeForPosition, getAutoBaseKind } from '../../utils/tileHelper';

/**
 * A1 decoration 타일(kind 1,2,3)을 z=1에 배치할 때,
 * z=0에 비어있으면 자동으로 kind 0(Water A) 바닥을 깔아주는 헬퍼.
 */
function ensureAutoBase(
  x: number, y: number, tileId: number,
  data: number[], width: number, height: number,
  changes: TileChange[], updates: { x: number; y: number; z: number; tileId: number }[],
): void {
  const baseKind = getAutoBaseKind(tileId);
  if (baseKind < 0) return;
  const z0 = 0;
  const idx0 = (z0 * height + y) * width + x;
  const existingZ0 = data[idx0];
  // z=0에 이미 같은 계열의 A1 물 타일이 있으면 건너뛰기
  if (isAutotile(existingZ0) && !isTileA5(existingZ0) && isTileA1(existingZ0)) {
    const existingKind = getAutotileKindExported(existingZ0);
    if (existingKind === baseKind) return; // 이미 올바른 바닥 존재
  }
  // z=0에 바닥 타일 배치
  const baseTileId = makeAutotileId(baseKind, 46); // 임시 shape, 아래에서 재계산
  placeAutotileAtPure(x, y, z0, baseTileId, data, width, height, changes, updates);
}

/**
 * 단일 오토타일 배치 + 주변 오토타일 재계산
 */
export function placeAutotileAtPure(
  x: number, y: number, z: number, tileId: number,
  data: number[], width: number, height: number,
  changes: TileChange[], updates: { x: number; y: number; z: number; tileId: number }[],
): void {
  // A1 decoration 타일을 z=1에 배치할 때 z=0에 자동 바닥
  if (z === 1 && tileId !== 0) {
    ensureAutoBase(x, y, tileId, data, width, height, changes, updates);
  }

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
}

/**
 * batch/flood-fill에서 A1 decoration 타일을 z=1에 일괄 배치할 때
 * z=0에 자동 바닥(kind 0)을 깔아주는 헬퍼.
 */
function ensureAutoBaseBatch(
  data: number[], oldData: number[], width: number, height: number, z: number,
  positions: { x: number; y: number }[],
): { changes: TileChange[]; updates: { x: number; y: number; z: number; tileId: number }[] } {
  if (z !== 1) return { changes: [], updates: [] };
  const basePositions: { x: number; y: number }[] = [];
  for (const { x, y } of positions) {
    const idx1 = (z * height + y) * width + x;
    const tid = data[idx1];
    const baseKind = getAutoBaseKind(tid);
    if (baseKind < 0) continue;
    const idx0 = (0 * height + y) * width + x;
    const existingZ0 = data[idx0];
    if (isAutotile(existingZ0) && !isTileA5(existingZ0) && isTileA1(existingZ0)) {
      if (getAutotileKindExported(existingZ0) === baseKind) continue;
    }
    data[idx0] = makeAutotileId(baseKind, 46);
    basePositions.push({ x, y });
  }
  if (basePositions.length === 0) return { changes: [], updates: [] };
  return recalcAutotilesAround(data, oldData, width, height, 0, basePositions);
}

/**
 * 주변 오토타일만 일괄 재계산 (positions + 인접 타일)
 * floodFill, batchPlace에서 공통 사용
 */
function recalcAutotilesAround(
  data: number[], oldData: number[], width: number, height: number, z: number,
  positions: { x: number; y: number }[],
): { changes: TileChange[]; updates: { x: number; y: number; z: number; tileId: number }[] } {
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

  const changes: TileChange[] = [];
  const updates: { x: number; y: number; z: number; tileId: number }[] = [];

  for (const posKey of toRecalc) {
    const [px, py] = posKey.split(',').map(Number);
    const idx = (z * height + py) * width + px;
    const tid = data[idx];
    if (isAutotile(tid) && !isTileA5(tid)) {
      const kind = getAutotileKindExported(tid);
      const shape = computeAutoShapeForPosition(data, width, height, px, py, z, tid);
      data[idx] = makeAutotileId(kind, shape);
    }
    if (data[idx] !== oldData[idx]) {
      changes.push({ x: px, y: py, z, oldTileId: oldData[idx], newTileId: data[idx] });
      updates.push({ x: px, y: py, z, tileId: data[idx] });
    }
  }

  return { changes, updates };
}

/**
 * Flood Fill (BFS) - 리전 레이어(z=5) 용
 */
export function floodFillRegion(
  data: number[], width: number, height: number,
  startX: number, startY: number, z: number, selectedTileId: number,
): { changes: TileChange[]; updates: { x: number; y: number; z: number; tileId: number }[] } {
  const targetId = data[(z * height + startY) * width + startX];
  if (targetId === selectedTileId) return { changes: [], updates: [] };

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

  return { changes, updates };
}

/**
 * Flood Fill (BFS) - 일반 타일 레이어용 (오토타일 지원)
 */
export function floodFillTile(
  data: number[], oldData: number[], width: number, height: number,
  startX: number, startY: number, z: number, selectedTileId: number,
): { changes: TileChange[]; updates: { x: number; y: number; z: number; tileId: number }[] } {
  const targetId = oldData[(z * height + startY) * width + startX];
  const targetIsAutotile = isAutotile(targetId) && !isTileA5(targetId);
  const targetKind = targetIsAutotile ? getAutotileKindExported(targetId) : -1;
  const newIsAutotile = isAutotile(selectedTileId) && !isTileA5(selectedTileId);
  const newKind = newIsAutotile ? getAutotileKindExported(selectedTileId) : -1;

  if (targetIsAutotile && newIsAutotile && targetKind === newKind) return { changes: [], updates: [] };
  if (!targetIsAutotile && !newIsAutotile && targetId === selectedTileId) return { changes: [], updates: [] };

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

  if (filledPositions.length === 0) return { changes: [], updates: [] };

  for (const { x, y } of filledPositions) {
    const idx = (z * height + y) * width + x;
    data[idx] = selectedTileId;
  }

  // A1 decoration 타일이면 z=0에 자동 바닥 깔기
  const baseResult = ensureAutoBaseBatch(data, oldData, width, height, z, filledPositions);
  const result = recalcAutotilesAround(data, oldData, width, height, z, filledPositions);
  result.changes.push(...baseResult.changes);
  result.updates.push(...baseResult.updates);
  return result;
}

/**
 * 배치 타일 배치 + 오토타일 재계산
 */
export function batchPlaceWithAutotilePure(
  data: number[], oldData: number[], width: number, height: number, z: number,
  positions: { x: number; y: number }[],
  getTileForPos: (x: number, y: number) => number,
): { changes: TileChange[]; updates: { x: number; y: number; z: number; tileId: number }[] } {
  // 리전 레이어 (z=5) - 오토타일 계산 불필요
  if (z === 5) {
    const changes: TileChange[] = [];
    const updates: { x: number; y: number; z: number; tileId: number }[] = [];
    for (const { x, y } of positions) {
      const idx = (z * height + y) * width + x;
      const oldId = oldData[idx];
      const newId = getTileForPos(x, y);
      if (oldId !== newId) {
        changes.push({ x, y, z, oldTileId: oldId, newTileId: newId });
        updates.push({ x, y, z, tileId: newId });
      }
    }
    return { changes, updates };
  }

  // 일반 레이어 - 오토타일 재계산 포함
  for (const { x, y } of positions) {
    const idx = (z * height + y) * width + x;
    data[idx] = getTileForPos(x, y);
  }

  // A1 decoration 타일이면 z=0에 자동 바닥 깔기
  const baseResult = ensureAutoBaseBatch(data, oldData, width, height, z, positions);
  const result = recalcAutotilesAround(data, oldData, width, height, z, positions);
  result.changes.push(...baseResult.changes);
  result.updates.push(...baseResult.updates);
  return result;
}

/**
 * 사각형 영역 좌표 생성
 */
export function getRectanglePositions(
  start: { x: number; y: number }, end: { x: number; y: number },
  mapWidth: number, mapHeight: number,
): { x: number; y: number }[] {
  const minX = Math.max(0, Math.min(start.x, end.x));
  const maxX = Math.min(mapWidth - 1, Math.max(start.x, end.x));
  const minY = Math.max(0, Math.min(start.y, end.y));
  const maxY = Math.min(mapHeight - 1, Math.max(start.y, end.y));

  const positions: { x: number; y: number }[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      positions.push({ x, y });
    }
  }
  return positions;
}

/**
 * 타원 영역 좌표 생성
 */
export function getEllipsePositions(
  start: { x: number; y: number }, end: { x: number; y: number },
  mapWidth: number, mapHeight: number,
): { x: number; y: number }[] {
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
      if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) continue;
      const dx = (x - cx) / (rx || 0.5);
      const dy = (y - cy) / (ry || 0.5);
      if (dx * dx + dy * dy <= 1) {
        positions.push({ x, y });
      }
    }
  }
  return positions;
}
