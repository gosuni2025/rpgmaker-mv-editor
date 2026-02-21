// Autotile shape calculation logic
// This module is intentionally self-contained to avoid circular dependencies with tileHelper.ts.
// Tile classification helpers are inlined here rather than imported from tileHelper.ts.

import { WALL_AUTOTILE_TABLE } from './autotileTables';

// Tile ID constants (mirrored from tileHelper.ts)
const TILE_ID_A1 = 2048;
const TILE_ID_A2 = 2816;
const TILE_ID_A3 = 4352;
const TILE_ID_A4 = 5888;
const TILE_ID_A5 = 1536;
const TILE_ID_MAX = 8192;

// Tile classification helpers (mirrored from tileHelper.ts)
function isAutotile(tileId: number): boolean {
  return tileId >= TILE_ID_A1;
}
function isTileA1(tileId: number): boolean {
  return tileId >= TILE_ID_A1 && tileId < TILE_ID_A2;
}
function isTileA3(tileId: number): boolean {
  return tileId >= TILE_ID_A3 && tileId < TILE_ID_A4;
}
function isTileA4(tileId: number): boolean {
  return tileId >= TILE_ID_A4 && tileId < TILE_ID_MAX;
}
function isTileA5(tileId: number): boolean {
  return tileId >= TILE_ID_A5 && tileId < TILE_ID_A1;
}
function getAutotileKind(tileId: number): number {
  return Math.floor((tileId - TILE_ID_A1) / 48);
}

function isWallAutotile(tileId: number): boolean {
  if (isTileA3(tileId)) return true;
  if (isTileA4(tileId)) {
    const kind = getAutotileKind(tileId);
    return Math.floor(kind / 8) % 2 === 1;
  }
  return false;
}

function isWaterfallKind(tileId: number): boolean {
  if (!isTileA1(tileId)) return false;
  const kind = getAutotileKind(tileId);
  return kind >= 4 && kind % 2 === 1;
}

// Floor autotile shape calculation.
// Shape is determined by which cardinal neighbors are ABSENT (= edges/borders)
// and inner corner sub-index (diagonal ABSENT when both adjacent cardinals PRESENT).
//
// Shape groups by absent cardinal directions:
//   0 absent: 0-15  (inner corner combos: icTL*1 + icTR*2 + icBR*4 + icBL*8)
//   L absent: 16-19 (sub: icTR*1 + icBR*2)
//   T absent: 20-23 (sub: icBR*1 + icBL*2)
//   R absent: 24-27 (sub: icBL*1 + icTL*2)
//   B absent: 28-31 (sub: icTL*1 + icTR*2)
//   L+R: 32, T+B: 33
//   T+L: 34-35 (sub: icBR), T+R: 36-37 (sub: icBL)
//   R+B: 38-39 (sub: icTL), B+L: 40-41 (sub: icTR)
//   T+R+L: 42, T+B+L: 43, R+B+L: 44, T+R+B: 45
//   T+R+B+L: 46
export function findFloorShape(
  top: boolean, right: boolean, bottom: boolean, left: boolean,
  topLeft: boolean, topRight: boolean, bottomLeft: boolean, bottomRight: boolean
): number {
  // Inner corners: both adjacent cardinals PRESENT but diagonal ABSENT
  const icTL = top && left && !topLeft ? 1 : 0;
  const icTR = top && right && !topRight ? 1 : 0;
  const icBL = bottom && left && !bottomLeft ? 1 : 0;
  const icBR = bottom && right && !bottomRight ? 1 : 0;

  const absentT = !top, absentR = !right, absentB = !bottom, absentL = !left;
  const n = (absentT ? 1 : 0) + (absentR ? 1 : 0) + (absentB ? 1 : 0) + (absentL ? 1 : 0);

  if (n === 0) return icTL + icTR * 2 + icBR * 4 + icBL * 8;
  if (n === 1) {
    if (absentL) return 16 + icTR + icBR * 2;
    if (absentT) return 20 + icBR + icBL * 2;
    if (absentR) return 24 + icBL + icTL * 2;
    return 28 + icTL + icTR * 2; // absentB
  }
  if (n === 2) {
    if (absentL && absentR) return 32;
    if (absentT && absentB) return 33;
    if (absentT && absentL) return 34 + icBR;
    if (absentT && absentR) return 36 + icBL;
    if (absentR && absentB) return 38 + icTL;
    return 40 + icTR; // absentB && absentL
  }
  if (n === 3) {
    if (!absentB) return 42;
    if (!absentR) return 43;
    if (!absentT) return 44;
    return 45; // !absentL
  }
  return 46; // n === 4
}

// Wall shape lookup
const WALL_SHAPE_LOOKUP = new Map<string, number>();
(function() {
  for (let i = 0; i < WALL_AUTOTILE_TABLE.length; i++) {
    const t = WALL_AUTOTILE_TABLE[i];
    const key = `${t[0][0]},${t[0][1]},${t[1][0]},${t[1][1]},${t[2][0]},${t[2][1]},${t[3][0]},${t[3][1]}`;
    WALL_SHAPE_LOOKUP.set(key, i);
  }
})();

export function findWallShape(top: boolean, right: boolean, bottom: boolean, left: boolean): number {
  // Wall autotiles use a 4x4 half-tile grid (2 tile wide × 2 tile tall)
  // q0(TL): x = left?0:2, y = top?0:2
  // q1(TR): x = right?3:1, y = top?0:2
  // q2(BL): x = left?0:2, y = bottom?3:1
  // q3(BR): x = right?3:1, y = bottom?3:1
  const c0: [number, number] = [left ? 0 : 2, top ? 0 : 2];
  const c1: [number, number] = [right ? 3 : 1, top ? 0 : 2];
  const c2: [number, number] = [left ? 0 : 2, bottom ? 3 : 1];
  const c3: [number, number] = [right ? 3 : 1, bottom ? 3 : 1];
  const key = `${c0[0]},${c0[1]},${c1[0]},${c1[1]},${c2[0]},${c2[1]},${c3[0]},${c3[1]}`;
  return WALL_SHAPE_LOOKUP.get(key) ?? 0;
}

/**
 * Given map tile data and a position, compute the correct autotile shape.
 */
export function computeAutoShapeForPosition(
  data: number[], width: number, height: number,
  x: number, y: number, z: number, tileId: number
): number {
  if (!isAutotile(tileId) || isTileA5(tileId)) return 0;
  const kind = getAutotileKind(tileId);

  function sameKind(nx: number, ny: number): boolean {
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return false;
    const nId = data[(z * height + ny) * width + nx];
    if (!isAutotile(nId) || isTileA5(nId)) return false;
    return getAutotileKind(nId) === kind;
  }

  const top = sameKind(x, y - 1);
  const bottom = sameKind(x, y + 1);
  const left = sameKind(x - 1, y);
  const right = sameKind(x + 1, y);

  if (isWaterfallKind(tileId)) {
    return (left ? 0 : 1) + (right ? 0 : 2);
  } else if (isWallAutotile(tileId)) {
    return findWallShape(top, right, bottom, left);
  } else {
    const tl = sameKind(x - 1, y - 1);
    const tr = sameKind(x + 1, y - 1);
    const bl = sameKind(x - 1, y + 1);
    const br = sameKind(x + 1, y + 1);
    return findFloorShape(top, right, bottom, left, tl, tr, bl, br);
  }
}

// Reverse lookup: shape → neighbor bitmask for floor autotiles
// Bitmask bits: top=1, right=2, bottom=4, left=8, topLeft=16, topRight=32, bottomLeft=64, bottomRight=128
// Returns the canonical neighbor bitmask that produces this shape
const FLOOR_SHAPE_TO_BITMASK: number[] = [];
const WALL_SHAPE_TO_BITMASK: number[] = [];

(function buildShapeToBitmask() {
  // Floor: try all 256 combinations of 8 directions
  // Store the maximal bitmask (most neighbors set) for each shape
  const floorMap = new Map<number, number>();
  for (let mask = 255; mask >= 0; mask--) {
    const top = !!(mask & 1);
    const right = !!(mask & 2);
    const bottom = !!(mask & 4);
    const left = !!(mask & 8);
    const tl = !!(mask & 16);
    const tr = !!(mask & 32);
    const bl = !!(mask & 64);
    const br = !!(mask & 128);
    const shape = findFloorShape(top, right, bottom, left, tl, tr, bl, br);
    if (!floorMap.has(shape)) {
      floorMap.set(shape, mask);
    }
  }
  for (let s = 0; s < 48; s++) {
    FLOOR_SHAPE_TO_BITMASK[s] = floorMap.get(s) ?? 0;
  }

  // Wall: try all 16 combinations of 4 directions
  const wallMap = new Map<number, number>();
  for (let mask = 15; mask >= 0; mask--) {
    const top = !!(mask & 1);
    const right = !!(mask & 2);
    const bottom = !!(mask & 4);
    const left = !!(mask & 8);
    const shape = findWallShape(top, right, bottom, left);
    if (!wallMap.has(shape)) {
      wallMap.set(shape, mask);
    }
  }
  for (let s = 0; s < 16; s++) {
    WALL_SHAPE_TO_BITMASK[s] = wallMap.get(s) ?? 0;
  }
})();

export interface ShapeNeighborInfo {
  top: boolean; right: boolean; bottom: boolean; left: boolean;
  topLeft: boolean; topRight: boolean; bottomLeft: boolean; bottomRight: boolean;
}

export function getShapeNeighbors(shape: number, tableType: 'floor' | 'wall' | 'waterfall'): ShapeNeighborInfo {
  let mask = 0;
  if (tableType === 'floor') {
    mask = FLOOR_SHAPE_TO_BITMASK[shape] ?? 0;
  } else if (tableType === 'wall') {
    mask = WALL_SHAPE_TO_BITMASK[shape] ?? 0;
  } else {
    // waterfall: left=bit0, right=bit1
    mask = ((shape & 1) ? 0 : 8) | ((shape & 2) ? 0 : 2); // invert: shape bit means NOT connected
    return {
      top: false, right: !!(shape & 2) === false, bottom: false, left: !!(shape & 1) === false,
      topLeft: false, topRight: false, bottomLeft: false, bottomRight: false,
    };
  }
  return {
    top: !!(mask & 1), right: !!(mask & 2), bottom: !!(mask & 4), left: !!(mask & 8),
    topLeft: !!(mask & 16), topRight: !!(mask & 32), bottomLeft: !!(mask & 64), bottomRight: !!(mask & 128),
  };
}
