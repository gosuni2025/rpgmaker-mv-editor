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

// Quarter-tile source coordinate computation.
// Each quarter is determined independently by its two adjacent edges and corner.
// Verified against all 48 entries of FLOOR_AUTOTILE_TABLE.
function q0Coords(top: boolean, left: boolean, tl: boolean): [number, number] {
  const x = left ? 0 : 2;
  const y = (top && left) ? (tl ? 0 : 2) : top ? 2 : ((!left && tl) ? 0 : 4);
  return [x, y];
}
function q1Coords(top: boolean, right: boolean, tr: boolean): [number, number] {
  if (top && right) return tr ? [1, 0] : [3, 2];
  if (top) return [1, 2];
  if (right) return [3, 4];
  return tr ? [3, 0] : [1, 4];
}
function q2Coords(bottom: boolean, left: boolean, bl: boolean): [number, number] {
  if (bottom && left) return bl ? [0, 1] : [0, 5];
  if (bottom) return [2, 5];
  if (left) return [0, 3];
  return bl ? [2, 1] : [2, 3];
}
function q3Coords(bottom: boolean, right: boolean, br: boolean): [number, number] {
  if (bottom && right) return br ? [1, 1] : [3, 5];
  if (bottom) return [1, 5];
  if (right) return [3, 3];
  return br ? [3, 1] : [1, 3];
}

// Build shape lookup: quarter coordinates → shape index
const FLOOR_SHAPE_LOOKUP = new Map<string, number>();
(function() {
  for (let i = 0; i < FLOOR_AUTOTILE_TABLE.length; i++) {
    const t = FLOOR_AUTOTILE_TABLE[i];
    const key = `${t[0][0]},${t[0][1]},${t[1][0]},${t[1][1]},${t[2][0]},${t[2][1]},${t[3][0]},${t[3][1]}`;
    FLOOR_SHAPE_LOOKUP.set(key, i);
  }
})();

function findFloorShape(
  top: boolean, right: boolean, bottom: boolean, left: boolean,
  topLeft: boolean, topRight: boolean, bottomLeft: boolean, bottomRight: boolean
): number {
  // In RPG Maker MV, corners only produce a visual difference when ALL 4 edges
  // are connected AND ALL 4 corners are connected (shape 47 = fully inner tile).
  // Otherwise (any edge or corner missing), corners are treated as absent (shape 46 for 4-edge).
  const allEdges = top && right && bottom && left;
  const allCorners = allEdges && topLeft && topRight && bottomLeft && bottomRight;
  const tl = allCorners;
  const tr = allCorners;
  const bl = allCorners;
  const br = allCorners;

  // Free diagonals: diagonal present but NEITHER adjacent edge connected
  const tlFree = !top && !left && topLeft;
  const trFree = !top && !right && topRight;
  const blFree = !bottom && !left && bottomLeft;
  const brFree = !bottom && !right && bottomRight;

  const c0 = q0Coords(top, left, tl || tlFree);
  const c1 = q1Coords(top, right, tr || trFree);
  const c2 = q2Coords(bottom, left, bl || blFree);
  const c3 = q3Coords(bottom, right, br || brFree);
  const key = `${c0[0]},${c0[1]},${c1[0]},${c1[1]},${c2[0]},${c2[1]},${c3[0]},${c3[1]}`;
  return FLOOR_SHAPE_LOOKUP.get(key) ?? 0;
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
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return true;
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

// Exports for tile ID constants
export { TILE_ID_B, TILE_ID_C, TILE_ID_D, TILE_ID_E, TILE_ID_A5, TILE_ID_A1, TILE_ID_A2, TILE_ID_A3, TILE_ID_A4, TILE_ID_MAX };
