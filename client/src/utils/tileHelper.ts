// RPG Maker MV tile constants
export const TILE_SIZE_PX = 48;
const HALF = TILE_SIZE_PX / 2; // 24px quarter-tile

// Tile ID ranges (from rpg_core.js Tilemap)
const TILE_ID_B = 0;
const TILE_ID_C = 256;
const TILE_ID_D = 512;
const TILE_ID_E = 768;
const TILE_ID_A5 = 1536;
const TILE_ID_A1 = 2048;
const TILE_ID_A2 = 2816;
const TILE_ID_A3 = 4352;
const TILE_ID_A4 = 5888;
const TILE_ID_MAX = 8192;

export function isAutotile(tileId: number): boolean {
  return tileId >= TILE_ID_A1;
}

export function isTileA1(tileId: number): boolean {
  return tileId >= TILE_ID_A1 && tileId < TILE_ID_A2;
}
export function isTileA2(tileId: number): boolean {
  return tileId >= TILE_ID_A2 && tileId < TILE_ID_A3;
}
export function isTileA3(tileId: number): boolean {
  return tileId >= TILE_ID_A3 && tileId < TILE_ID_A4;
}
export function isTileA4(tileId: number): boolean {
  return tileId >= TILE_ID_A4 && tileId < TILE_ID_MAX;
}
export function isTileA5(tileId: number): boolean {
  return tileId >= TILE_ID_A5 && tileId < TILE_ID_A1;
}

function getAutotileKind(tileId: number): number {
  return Math.floor((tileId - TILE_ID_A1) / 48);
}

function getAutotileShape(tileId: number): number {
  return (tileId - TILE_ID_A1) % 48;
}

export function isWaterfallTile(tileId: number): boolean {
  if (tileId >= TILE_ID_A1 + 192 && tileId < TILE_ID_A2) {
    return getAutotileKind(tileId) % 2 === 1;
  }
  return false;
}

// Autotile tables from rpg_core.js
// Each shape is an array of 4 quarter-tiles: [topLeft, topRight, bottomLeft, bottomRight]
// Each quarter-tile is [qsx, qsy] - half-tile coordinates within the autotile block
const FLOOR_AUTOTILE_TABLE: [number, number][][] = [
  [[2,4],[1,4],[2,3],[1,3]],[[2,0],[1,4],[2,3],[1,3]],
  [[2,4],[3,0],[2,3],[1,3]],[[2,0],[3,0],[2,3],[1,3]],
  [[2,4],[1,4],[2,3],[3,1]],[[2,0],[1,4],[2,3],[3,1]],
  [[2,4],[3,0],[2,3],[3,1]],[[2,0],[3,0],[2,3],[3,1]],
  [[2,4],[1,4],[2,1],[1,3]],[[2,0],[1,4],[2,1],[1,3]],
  [[2,4],[3,0],[2,1],[1,3]],[[2,0],[3,0],[2,1],[1,3]],
  [[2,4],[1,4],[2,1],[3,1]],[[2,0],[1,4],[2,1],[3,1]],
  [[2,4],[3,0],[2,1],[3,1]],[[2,0],[3,0],[2,1],[3,1]],
  [[0,4],[1,4],[0,3],[1,3]],[[0,4],[3,0],[0,3],[1,3]],
  [[0,4],[1,4],[0,3],[3,1]],[[0,4],[3,0],[0,3],[3,1]],
  [[2,2],[1,2],[2,3],[1,3]],[[2,2],[1,2],[2,3],[3,1]],
  [[2,2],[1,2],[2,1],[1,3]],[[2,2],[1,2],[2,1],[3,1]],
  [[2,4],[3,4],[2,3],[3,3]],[[2,4],[3,4],[2,1],[3,3]],
  [[2,0],[3,4],[2,3],[3,3]],[[2,0],[3,4],[2,1],[3,3]],
  [[2,4],[1,4],[2,5],[1,5]],[[2,0],[1,4],[2,5],[1,5]],
  [[2,4],[3,0],[2,5],[1,5]],[[2,0],[3,0],[2,5],[1,5]],
  [[0,4],[3,4],[0,3],[3,3]],[[2,2],[1,2],[2,5],[1,5]],
  [[0,2],[1,2],[0,3],[1,3]],[[0,2],[1,2],[0,3],[3,1]],
  [[2,2],[3,2],[2,3],[3,3]],[[2,2],[3,2],[2,1],[3,3]],
  [[2,4],[3,4],[2,5],[3,5]],[[2,0],[3,4],[2,5],[3,5]],
  [[0,4],[1,4],[0,5],[1,5]],[[0,4],[3,0],[0,5],[1,5]],
  [[0,2],[3,2],[0,3],[3,3]],[[0,2],[1,2],[0,5],[1,5]],
  [[0,4],[3,4],[0,5],[3,5]],[[2,2],[3,2],[2,5],[3,5]],
  [[0,2],[3,2],[0,5],[3,5]],[[0,0],[1,0],[0,1],[1,1]]
];

const WALL_AUTOTILE_TABLE: [number, number][][] = [
  [[2,2],[1,2],[2,1],[1,1]],[[0,2],[1,2],[0,1],[1,1]],
  [[2,0],[1,0],[2,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],
  [[2,2],[3,2],[2,1],[3,1]],[[0,2],[3,2],[0,1],[3,1]],
  [[2,0],[3,0],[2,1],[3,1]],[[0,0],[3,0],[0,1],[3,1]],
  [[2,2],[1,2],[2,3],[1,3]],[[0,2],[1,2],[0,3],[1,3]],
  [[2,0],[1,0],[2,3],[1,3]],[[0,0],[1,0],[0,3],[1,3]],
  [[2,2],[3,2],[2,3],[3,3]],[[0,2],[3,2],[0,3],[3,3]],
  [[2,0],[3,0],[2,3],[3,3]],[[0,0],[3,0],[0,3],[3,3]]
];

const WATERFALL_AUTOTILE_TABLE: [number, number][][] = [
  [[2,0],[1,0],[2,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],
  [[2,0],[3,0],[2,1],[3,1]],[[0,0],[3,0],[0,1],[3,1]]
];

export interface QuarterTile {
  sheet: number;
  sx: number;
  sy: number;
}

export interface NormalTileInfo {
  type: 'normal';
  sheet: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface AutotileInfo {
  type: 'autotile';
  quarters: [QuarterTile, QuarterTile, QuarterTile, QuarterTile];
}

export type TileRenderInfo = NormalTileInfo | AutotileInfo | null;

// Get render info for a normal (non-autotile) tile
function getNormalTileInfo(tileId: number): NormalTileInfo | null {
  let setNumber: number;

  if (isTileA5(tileId)) {
    setNumber = 4;
  } else if (tileId >= TILE_ID_B && tileId < TILE_ID_A5) {
    setNumber = 5 + Math.floor(tileId / 256);
  } else {
    return null;
  }

  const w = TILE_SIZE_PX;
  const h = TILE_SIZE_PX;
  const sx = (Math.floor(tileId / 128) % 2 * 8 + tileId % 8) * w;
  const sy = (Math.floor(tileId % 256 / 8) % 16) * h;

  return { type: 'normal', sheet: setNumber, sx, sy, sw: w, sh: h };
}

// Get render info for an autotile
function getAutotileInfo(tileId: number): AutotileInfo | null {
  const kind = getAutotileKind(tileId);
  const shape = getAutotileShape(tileId);
  const tx = kind % 8;
  const ty = Math.floor(kind / 8);
  let bx = 0;
  let by = 0;
  let setNumber = 0;
  let autotileTable: [number, number][][];

  if (isTileA1(tileId)) {
    setNumber = 0;
    if (kind === 0) {
      bx = 0; // waterSurfaceIndex * 2, use frame 0 for editor
      by = 0;
    } else if (kind === 1) {
      bx = 0;
      by = 3;
    } else if (kind === 2) {
      bx = 6;
      by = 0;
    } else if (kind === 3) {
      bx = 6;
      by = 3;
    } else {
      bx = Math.floor(tx / 4) * 8;
      by = ty * 6 + Math.floor(tx / 2) % 2 * 3;
      if (kind % 2 === 0) {
        bx += 0; // waterSurfaceIndex * 2, use frame 0
      } else {
        bx += 6;
        autotileTable = WATERFALL_AUTOTILE_TABLE;
        const table = autotileTable[Math.min(shape, autotileTable.length - 1)];
        if (!table) return null;
        return buildQuarters(setNumber, bx, by, table);
      }
    }
    autotileTable = FLOOR_AUTOTILE_TABLE;
  } else if (isTileA2(tileId)) {
    setNumber = 1;
    bx = tx * 2;
    by = (ty - 2) * 3;
    autotileTable = FLOOR_AUTOTILE_TABLE;
  } else if (isTileA3(tileId)) {
    setNumber = 2;
    bx = tx * 2;
    by = (ty - 6) * 2;
    autotileTable = WALL_AUTOTILE_TABLE;
  } else if (isTileA4(tileId)) {
    setNumber = 3;
    bx = tx * 2;
    by = Math.floor((ty - 10) * 2.5 + (ty % 2 === 1 ? 0.5 : 0));
    if (ty % 2 === 1) {
      autotileTable = WALL_AUTOTILE_TABLE;
    } else {
      autotileTable = FLOOR_AUTOTILE_TABLE;
    }
  } else {
    return null;
  }

  const table = autotileTable![Math.min(shape, autotileTable!.length - 1)];
  if (!table) return null;

  return buildQuarters(setNumber, bx, by, table);
}

function buildQuarters(
  setNumber: number,
  bx: number,
  by: number,
  table: [number, number][]
): AutotileInfo {
  const quarters = table.map(([qsx, qsy]) => ({
    sheet: setNumber,
    sx: (bx * 2 + qsx) * HALF,
    sy: (by * 2 + qsy) * HALF,
  })) as [QuarterTile, QuarterTile, QuarterTile, QuarterTile];

  return { type: 'autotile', quarters };
}

// Main function: get render info for any tile ID
export function getTileRenderInfo(tileId: number): TileRenderInfo {
  if (tileId <= 0 || tileId >= TILE_ID_MAX) return null;

  if (isAutotile(tileId)) {
    return getAutotileInfo(tileId);
  } else {
    return getNormalTileInfo(tileId);
  }
}

// Legacy compatibility
export interface TilePos {
  x: number;
  y: number;
}

export function posToTile(canvasX: number, canvasY: number): TilePos {
  return {
    x: Math.floor(canvasX / TILE_SIZE_PX),
    y: Math.floor(canvasY / TILE_SIZE_PX),
  };
}

// For the palette: get the base tile ID for an autotile kind
export function getAutotileBaseTileId(kind: number): number {
  // Shape 46 = fully surrounded center pattern
  return TILE_ID_A1 + kind * 48 + 46;
}

// --- Autotile shape calculation for placement ---

export function getAutotileKindExported(tileId: number): number {
  return getAutotileKind(tileId);
}

export function makeAutotileId(kind: number, shape: number): number {
  return TILE_ID_A1 + kind * 48 + shape;
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
function findFloorShape(
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

function findWallShape(top: boolean, right: boolean, bottom: boolean, left: boolean): number {
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

// Get autotile source block info (sheet, bx, by, table type) for debug/visualization
export interface AutotileBlockInfo {
  setNumber: number;
  bx: number;
  by: number;
  tableType: 'floor' | 'wall' | 'waterfall';
  kind: number;
}

export function getAutotileBlockInfo(tileId: number): AutotileBlockInfo | null {
  if (!isAutotile(tileId) || isTileA5(tileId)) return null;
  const kind = getAutotileKind(tileId);
  const tx = kind % 8;
  const ty = Math.floor(kind / 8);
  let bx = 0;
  let by = 0;
  let setNumber = 0;
  let tableType: 'floor' | 'wall' | 'waterfall' = 'floor';

  if (isTileA1(tileId)) {
    setNumber = 0;
    if (kind === 0) { bx = 0; by = 0; }
    else if (kind === 1) { bx = 0; by = 3; }
    else if (kind === 2) { bx = 6; by = 0; }
    else if (kind === 3) { bx = 6; by = 3; }
    else {
      bx = Math.floor(tx / 4) * 8;
      by = ty * 6 + Math.floor(tx / 2) % 2 * 3;
      if (kind % 2 === 0) {
        bx += 0;
      } else {
        bx += 6;
        tableType = 'waterfall';
      }
    }
  } else if (isTileA2(tileId)) {
    setNumber = 1;
    bx = tx * 2;
    by = (ty - 2) * 3;
  } else if (isTileA3(tileId)) {
    setNumber = 2;
    bx = tx * 2;
    by = (ty - 6) * 2;
    tableType = 'wall';
  } else if (isTileA4(tileId)) {
    setNumber = 3;
    bx = tx * 2;
    by = Math.floor((ty - 10) * 2.5 + (ty % 2 === 1 ? 0.5 : 0));
    if (ty % 2 === 1) {
      tableType = 'wall';
    }
  } else {
    return null;
  }

  return { setNumber, bx, by, tableType, kind };
}

// Debug: detailed autotile info for a position
export function debugAutotileAt(
  data: number[], width: number, height: number,
  x: number, y: number, z: number
): {
  tileId: number; kind: number; shape: number;
  isAuto: boolean; isA5: boolean;
  neighbors: Record<string, { tileId: number; kind: number; sameKind: boolean }>;
  computedShape: number;
} | null {
  const idx = (z * height + y) * width + x;
  const tileId = data[idx];
  if (!tileId) return null;
  const isAuto = isAutotile(tileId);
  const a5 = isTileA5(tileId);
  const kind = isAuto && !a5 ? getAutotileKind(tileId) : -1;
  const shape = isAuto && !a5 ? getAutotileShape(tileId) : -1;

  const dirs: [string, number, number][] = [
    ['topLeft', -1, -1], ['top', 0, -1], ['topRight', 1, -1],
    ['left', -1, 0], ['right', 1, 0],
    ['bottomLeft', -1, 1], ['bottom', 0, 1], ['bottomRight', 1, 1],
  ];

  const neighbors: Record<string, { tileId: number; kind: number; sameKind: boolean }> = {};
  for (const [name, dx, dy] of dirs) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
      neighbors[name] = { tileId: -1, kind: -1, sameKind: true }; // out of bounds = same
    } else {
      const nIdx = (z * height + ny) * width + nx;
      const nId = data[nIdx];
      const nAuto = isAutotile(nId) && !isTileA5(nId);
      const nKind = nAuto ? getAutotileKind(nId) : -1;
      neighbors[name] = { tileId: nId, kind: nKind, sameKind: nAuto && nKind === kind };
    }
  }

  const computedShape = isAuto && !a5 ? computeAutoShapeForPosition(data, width, height, x, y, z, tileId) : -1;

  return { tileId, kind, shape, isAuto, isA5: a5, neighbors, computedShape };
}

// Debug: expose tileHelper for console testing
(window as unknown as Record<string, unknown>).__tileHelper = {
  computeAutoShapeForPosition, isAutotile, isTileA5, getAutotileKindExported, makeAutotileId,
  TILE_ID_A1, TILE_ID_A2, TILE_ID_A3, TILE_ID_A4, TILE_ID_A5, debugAutotileAt, getTileRenderInfo,
};

/**
 * A1 kind 번호 → 한국어 이름 매핑
 * A1 타일셋: kind 0~15
 * kind 0,1: 바다/물 (애니메이션)
 * kind 2,3: 장식 오토타일 (정적, 애니메이션 없음)
 * kind 4+짝수: 물 (애니메이션)
 * kind 4+홀수: 폭포 (애니메이션)
 */
const A1_KIND_NAMES: Record<number, string> = {
  0: '바다 1',
  1: '바다 2',
  2: '장식 1',
  3: '장식 2',
  4: '물 1',
  5: '폭포 1',
  6: '물 2',
  7: '폭포 2',
  8: '물 3',
  9: '폭포 3',
  10: '물 4',
  11: '폭포 4',
  12: '물 5',
  13: '폭포 5',
  14: '물 6',
  15: '폭포 6',
};

/**
 * A1 kind의 기본 타입 ('water' | 'static' | 'waterfall')
 * kind 2,3: 정적 오토타일 (RPG Maker MV 원본에서도 animX/animY 없음)
 */
export function getA1KindType(kind: number): 'water' | 'static' | 'waterfall' {
  if (kind === 2 || kind === 3) return 'static';
  if (kind >= 4 && kind % 2 === 1) return 'waterfall';
  return 'water';
}

export function getA1KindName(kind: number): string {
  return A1_KIND_NAMES[kind] || `A1 타일 ${kind}`;
}

/**
 * 맵 데이터에서 사용 중인 A1 kind 목록 추출
 */
export function getUsedA1Kinds(data: number[], width: number, height: number): number[] {
  const kindSet = new Set<number>();
  const layer0Size = width * height;
  // z=0, z=1 레이어만 확인 (A1은 주로 레이어 0에 배치)
  for (let z = 0; z < 2; z++) {
    const offset = z * layer0Size;
    for (let i = 0; i < layer0Size; i++) {
      const tileId = data[offset + i];
      if (tileId >= TILE_ID_A1 && tileId < TILE_ID_A2) {
        const kind = Math.floor((tileId - TILE_ID_A1) / 48);
        kindSet.add(kind);
      }
    }
  }
  return Array.from(kindSet).sort((a, b) => a - b);
}

/**
 * A1 타일 중 "장식(decoration)" 타일인지 판별.
 * RPG Maker MV A1 블록 구조:
 *   kind 0: Block A (바다) — 기본 바닥
 *   kind 1: Block B (깊은 바다) — Block A 위에 겹침
 *   kind 2: Block C-1 (장식1) — Block A 위에 겹침
 *   kind 3: Block C-2 (장식2) — Block A 위에 겹침
 *   kind 4+짝수: Block D (물) — 기본 바닥
 *   kind 4+홀수: Block E (폭포) — 기본 바닥
 *
 * kind 1, 2, 3은 z=0의 바닥 타일 위에 z=1로 배치되어야 한다.
 */
export function isA1DecorationTile(tileId: number): boolean {
  if (!isTileA1(tileId)) return false;
  const kind = getAutotileKind(tileId);
  return kind === 1 || kind === 2 || kind === 3;
}

/**
 * A2 타일 중 "장식(decoration)" 타일인지 판별.
 * RPG Maker MV 도움말 (01_07_01.html):
 *   A2의 왼쪽 4개(열 0~3) = Base
 *   A2의 오른쪽 4개(열 4~7) = Decoration
 * Decoration은 Base 위(z=1)에 배치된다.
 */
export function isA2DecorationTile(tileId: number): boolean {
  if (!isTileA2(tileId)) return false;
  const kind = getAutotileKind(tileId);
  const col = kind % 8; // 0~7 (A2는 8열)
  return col >= 4;
}

/**
 * A 탭 타일 중 z=1(decoration 레이어)에 배치해야 하는 타일인지 판별.
 */
export function isGroundDecorationTile(tileId: number): boolean {
  return isA1DecorationTile(tileId) || isA2DecorationTile(tileId);
}

/**
 * A1 decoration 타일이 z=0에 자동으로 깔아야 하는 바닥 타일의 kind를 반환.
 * RPG Maker MV 도움말: Block B(kind 1), C(kind 2,3)의 투명 부분은
 * Block A(kind 0)가 자동으로 채운다.
 * 해당하지 않으면 -1 반환.
 */
export function getAutoBaseKind(tileId: number): number {
  if (!isTileA1(tileId)) return -1;
  const kind = getAutotileKind(tileId);
  if (kind === 1 || kind === 2 || kind === 3) return 0; // kind 0 = Water A
  return -1;
}

// Exports for tile ID constants
export { TILE_ID_B, TILE_ID_C, TILE_ID_D, TILE_ID_E, TILE_ID_A5, TILE_ID_A1, TILE_ID_A2, TILE_ID_A3, TILE_ID_A4, TILE_ID_MAX };
