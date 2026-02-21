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

// Autotile tables (imported from autotileTables.ts)
import {
  FLOOR_AUTOTILE_TABLE,
  WALL_AUTOTILE_TABLE,
  WATERFALL_AUTOTILE_TABLE,
} from './autotileTables';
export { FLOOR_AUTOTILE_TABLE, WALL_AUTOTILE_TABLE, WATERFALL_AUTOTILE_TABLE };

// Autotile shape calculation functions (imported from autotileCalculator.ts)
import { computeAutoShapeForPosition as _computeAutoShape } from './autotileCalculator';
export {
  computeAutoShapeForPosition,
  getShapeNeighbors,
  findFloorShape,
  findWallShape,
} from './autotileCalculator';
export type { ShapeNeighborInfo } from './autotileCalculator';

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

// --- Autotile shape calculation (delegated to autotileCalculator.ts) ---

export function getAutotileKindExported(tileId: number): number {
  return getAutotileKind(tileId);
}

export function makeAutotileId(kind: number, shape: number): number {
  return TILE_ID_A1 + kind * 48 + shape;
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

  const computedShape = isAuto && !a5 ? _computeAutoShape(data, width, height, x, y, z, tileId) : -1;

  return { tileId, kind, shape, isAuto, isA5: a5, neighbors, computedShape };
}

// Debug: expose tileHelper for console testing
(window as unknown as Record<string, unknown>).__tileHelper = {
  computeAutoShapeForPosition: _computeAutoShape, isAutotile, isTileA5, getAutotileKindExported, makeAutotileId,
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

/**
 * B/C/D/E 타일인지 확인 (tileId 1~1535, A5 미만의 일반 타일)
 * RPG Maker MV에서 이들은 "upper layer" 타일로, z=1/z=2에 자동 배치됨.
 */
export function isUpperLayerTile(tileId: number): boolean {
  return tileId > 0 && tileId < TILE_ID_A5;
}

/**
 * 타일 ID에서 사람이 읽을 수 있는 상세 정보를 반환.
 * 맵 에디터 툴팁에서 사용.
 */
export interface TileDescription {
  tileId: number;
  /** 타일 종류 (예: "A1", "A2", "B", "빈 타일") */
  category: string;
  /** 타일 이름 (예: "바다 1", "지형 3") */
  name: string;
  /** 타일셋 이미지 파일명 (tilesetNames에서 조회) */
  fileName: string | null;
  /** 시트 인덱스 (0~8) */
  sheetIndex: number;
  /** 오토타일 여부 */
  isAutotile: boolean;
  /** 애니메이션 타일 여부 (물, 폭포 등) */
  isAnimated: boolean;
  /** 타일 특성 태그 목록 */
  tags: string[];
  /** 시트 내 인덱스 (일반 타일) 또는 kind (오토타일) */
  indexInSheet: number;
}

export function getTileDescription(tileId: number, tilesetNames?: string[], layer?: number): TileDescription | null {
  if (tileId === 0) return null;

  // 리전: z=5 레이어에서만 1~255를 리전으로 해석
  // (TILE_ID_B=0 이므로 layer 구분 없이 처리하면 B 타일이 리전으로 오인됨)
  if (layer === 5 && tileId >= 1 && tileId <= 255) {
    return {
      tileId,
      category: '리전',
      name: `리전 ${tileId}`,
      fileName: null,
      sheetIndex: -1,
      isAutotile: false,
      isAnimated: false,
      tags: ['리전'],
      indexInSheet: tileId,
    };
  }

  const tags: string[] = [];

  if (isTileA1(tileId)) {
    const kind = getAutotileKind(tileId);
    const kindType = getA1KindType(kind);
    const kindName = getA1KindName(kind);
    const animated = kindType === 'water' || kindType === 'waterfall';
    if (animated) tags.push('애니메이션');
    if (kindType === 'water') tags.push('물');
    else if (kindType === 'waterfall') tags.push('폭포');
    else tags.push('정적');
    if (isA1DecorationTile(tileId)) tags.push('장식');
    tags.push('오토타일');
    return {
      tileId,
      category: 'A1',
      name: kindName,
      fileName: tilesetNames?.[0] || null,
      sheetIndex: 0,
      isAutotile: true,
      isAnimated: animated,
      tags,
      indexInSheet: kind,
    };
  }

  if (isTileA2(tileId)) {
    const kind = getAutotileKind(tileId);
    const col = kind % 8;
    const row = Math.floor(kind / 8) - 2;
    const isDeco = col >= 4;
    if (isDeco) tags.push('장식');
    tags.push('오토타일');
    return {
      tileId,
      category: 'A2',
      name: `A2 지형 (${col}, ${row})`,
      fileName: tilesetNames?.[1] || null,
      sheetIndex: 1,
      isAutotile: true,
      isAnimated: false,
      tags,
      indexInSheet: kind - 16,
    };
  }

  if (isTileA3(tileId)) {
    const kind = getAutotileKind(tileId);
    const col = kind % 8;
    const row = Math.floor(kind / 8) - 6;
    tags.push('벽(외벽)');
    tags.push('오토타일');
    return {
      tileId,
      category: 'A3',
      name: `A3 건물 외벽 (${col}, ${row})`,
      fileName: tilesetNames?.[2] || null,
      sheetIndex: 2,
      isAutotile: true,
      isAnimated: false,
      tags,
      indexInSheet: kind - 48,
    };
  }

  if (isTileA4(tileId)) {
    const kind = getAutotileKind(tileId);
    const col = kind % 8;
    const row = Math.floor(kind / 8) - 10;
    const isWall = Math.floor(kind / 8) % 2 === 1;
    tags.push(isWall ? '벽' : '바닥');
    tags.push('오토타일');
    return {
      tileId,
      category: 'A4',
      name: `A4 ${isWall ? '벽' : '바닥'} (${col}, ${row})`,
      fileName: tilesetNames?.[3] || null,
      sheetIndex: 3,
      isAutotile: true,
      isAnimated: false,
      tags,
      indexInSheet: kind - 80,
    };
  }

  if (isTileA5(tileId)) {
    const localId = tileId - TILE_ID_A5;
    const col = localId % 8;
    const row = Math.floor(localId / 8);
    return {
      tileId,
      category: 'A5',
      name: `A5 타일 (${col}, ${row})`,
      fileName: tilesetNames?.[4] || null,
      sheetIndex: 4,
      isAutotile: false,
      isAnimated: false,
      tags: ['일반 타일'],
      indexInSheet: localId,
    };
  }

  // B~E 타일
  let cat: string;
  let offset: number;
  let sheetIdx: number;
  if (tileId >= TILE_ID_E) {
    cat = 'E'; offset = TILE_ID_E; sheetIdx = 8;
  } else if (tileId >= TILE_ID_D) {
    cat = 'D'; offset = TILE_ID_D; sheetIdx = 7;
  } else if (tileId >= TILE_ID_C) {
    cat = 'C'; offset = TILE_ID_C; sheetIdx = 6;
  } else {
    cat = 'B'; offset = TILE_ID_B; sheetIdx = 5;
  }
  const localId = tileId - offset;
  const col = localId % 8;
  const row = Math.floor(localId / 8) % 16;
  const half = localId >= 128 ? '우' : '좌';
  return {
    tileId,
    category: cat,
    name: `${cat} 타일 (${col}, ${row}) ${half}`,
    fileName: tilesetNames?.[sheetIdx] || null,
    sheetIndex: sheetIdx,
    isAutotile: false,
    isAnimated: false,
    tags: ['일반 타일'],
    indexInSheet: localId,
  };
}

// Exports for tile ID constants
export { TILE_ID_B, TILE_ID_C, TILE_ID_D, TILE_ID_E, TILE_ID_A5, TILE_ID_A1, TILE_ID_A2, TILE_ID_A3, TILE_ID_A4, TILE_ID_MAX };
