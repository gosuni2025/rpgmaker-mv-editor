/**
 * A* 경로 탐색 - RPG Maker MV 맵 기반
 *
 * Tileset flags 비트 의미 (Game_Map.prototype.checkPassage 기준):
 *   bit 0 (0x01): 아래 방향 통과 불가
 *   bit 1 (0x02): 왼쪽 방향 통과 불가
 *   bit 2 (0x04): 오른쪽 방향 통과 불가
 *   bit 3 (0x08): 위 방향 통과 불가
 *   bit 4 (0x10): ☆ 타일 — 통과에 영향 없음 (건너뜀)
 */

import type { MoveCommand } from '../types/rpgMakerMV';

// ===================================================================
// 타일셋 통과 판단
// ===================================================================

/** 이동 방향(dx,dy) → 현재 타일에서 나가는 방향 비트 */
function exitBit(dx: number, dy: number): number {
  if (dy > 0) return 0x01; // 아래
  if (dx < 0) return 0x02; // 왼쪽
  if (dx > 0) return 0x04; // 오른쪽
  if (dy < 0) return 0x08; // 위
  return 0;
}

/** 이동 방향(dx,dy) → 목적 타일에서 들어오는 방향 비트 (반대 방향) */
function enterBit(dx: number, dy: number): number {
  return exitBit(-dx, -dy);
}

function getTileId(
  data: number[],
  x: number, y: number, z: number,
  mapWidth: number, mapHeight: number,
): number {
  if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) return 0;
  return data[(z * mapHeight + y) * mapWidth + x] ?? 0;
}

/**
 * checkPassage: 한 타일의 특정 방향 비트에 대해 통과 가능 여부 반환.
 * flags[tileId]에서:
 *   ☆ 타일(0x10)이면 건너뜀
 *   bit == 0 → 통과 가능 (o)
 *   bit == set → 통과 불가 (x)
 * 레이어가 모두 ☆ 이거나 데이터가 없으면 통과 불가 처리.
 */
function checkPassageForTile(
  data: number[],
  x: number, y: number,
  bit: number,
  mapWidth: number, mapHeight: number,
  flags: number[],
): boolean {
  // RPG Maker MV의 checkPassage와 동일하게 상단 레이어(z=3)에서 하단(z=0) 순으로 확인.
  // 바닥(z=0)보다 벽/장식(z=1~3)을 먼저 판단해야 올바른 결과를 얻을 수 있음.
  for (let z = 3; z >= 0; z--) {
    const tileId = getTileId(data, x, y, z, mapWidth, mapHeight);
    if (tileId === 0) continue; // 빈 타일은 건너뜀
    const flag = flags[tileId] ?? 0x0f;
    if ((flag & 0x10) !== 0) continue; // ☆ 타일: 통과 여부 무관
    if ((flag & bit) === 0) return true;   // 통과 가능
    if ((flag & bit) === bit) return false; // 통과 불가
  }
  return false; // 모두 ☆이거나 빈 타일 → 통과 불가로 처리
}

/** (x,y) → (x+dx, y+dy) 이동이 가능한지 확인 */
function isPassable(
  x: number, y: number,
  dx: number, dy: number,
  data: number[], mapWidth: number, mapHeight: number,
  flags: number[],
): boolean {
  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || nx >= mapWidth || ny < 0 || ny >= mapHeight) return false;

  const from = exitBit(dx, dy);
  const to   = enterBit(dx, dy);

  // 현재 타일에서 나가는 방향 체크
  if (!checkPassageForTile(data, x, y, from, mapWidth, mapHeight, flags)) return false;
  // 목적 타일에서 들어오는 방향 체크
  if (!checkPassageForTile(data, nx, ny, to, mapWidth, mapHeight, flags)) return false;

  return true;
}

/** 대각선 이동 가능 여부: 코너 커팅 없이, 두 직선 방향 모두 가능해야 함 */
function isDiagonalPassable(
  x: number, y: number,
  dx: number, dy: number,
  data: number[], mapWidth: number, mapHeight: number,
  flags: number[],
): boolean {
  // 두 직선 방향 중 하나라도 통과 가능해야 함 (RPG Maker MV 방식)
  const canH = isPassable(x, y, dx, 0, data, mapWidth, mapHeight, flags);
  const canV = isPassable(x, y, 0, dy, data, mapWidth, mapHeight, flags);
  if (!canH && !canV) return false;

  // 목적 타일에서도 두 직선 방향 체크
  const nx = x + dx;
  const ny = y + dy;
  const canHrev = isPassable(nx, ny, -dx, 0, data, mapWidth, mapHeight, flags);
  const canVrev = isPassable(nx, ny, 0, -dy, data, mapWidth, mapHeight, flags);
  return (canH || canHrev) && (canV || canVrev);
}

// ===================================================================
// A* 알고리즘
// ===================================================================

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

function heuristic(ax: number, ay: number, bx: number, by: number, allowDiagonal: boolean): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  if (allowDiagonal) {
    // Octile distance: diagonal cost = √2 ≈ 1.414
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  }
  return dx + dy; // Manhattan distance
}

function nodeKey(x: number, y: number): number {
  return x * 100000 + y;
}

const STRAIGHT_DIRS = [
  [0, 1],  // 아래
  [0, -1], // 위
  [-1, 0], // 왼쪽
  [1, 0],  // 오른쪽
];

const DIAGONAL_DIRS = [
  [-1, 1],  // 좌하
  [1, 1],   // 우하
  [-1, -1], // 좌상
  [1, -1],  // 우상
];

/**
 * A* 경로 탐색.
 * @param blockedTiles - "x,y" 형태의 추가 장애물 타일 집합 (예: 이벤트 위치)
 * @returns 시작점을 포함한 경로 배열. 경로를 찾지 못하면 빈 배열.
 */
export function runAstar(
  startX: number, startY: number,
  endX: number, endY: number,
  data: number[],
  mapWidth: number, mapHeight: number,
  flags: number[],
  allowDiagonal: boolean,
  maxNodes = 2000,
  blockedTiles?: ReadonlySet<string>,
  ignorePassability = false,
): { x: number; y: number }[] {
  if (startX === endX && startY === endY) return [{ x: startX, y: startY }];

  const openList: Node[] = [];
  const openSet = new Map<number, Node>();
  const closedSet = new Set<number>();

  const startNode: Node = {
    x: startX, y: startY, g: 0,
    h: heuristic(startX, startY, endX, endY, allowDiagonal),
    f: 0, parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  openList.push(startNode);
  openSet.set(nodeKey(startX, startY), startNode);

  let iterations = 0;

  while (openList.length > 0) {
    if (++iterations > maxNodes) break;

    // 가장 작은 f 값 노드 선택
    let bestIdx = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[bestIdx].f) bestIdx = i;
    }
    const current = openList[bestIdx];
    openList.splice(bestIdx, 1);
    openSet.delete(nodeKey(current.x, current.y));
    closedSet.add(nodeKey(current.x, current.y));

    if (current.x === endX && current.y === endY) {
      // 경로 복원
      const path: { x: number; y: number }[] = [];
      let node: Node | null = current;
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    // 직선 이동
    for (const [dx, dy] of STRAIGHT_DIRS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = nodeKey(nx, ny);
      if (closedSet.has(key)) continue;
      // 목적지가 blockedTile이어도 도달은 허용
      if (blockedTiles?.has(`${nx},${ny}`) && !(nx === endX && ny === endY)) continue;
      if (!ignorePassability && !isPassable(current.x, current.y, dx, dy, data, mapWidth, mapHeight, flags)) continue;

      const g = current.g + 1;
      const existing = openSet.get(key);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = g + existing.h;
          existing.parent = current;
        }
      } else {
        const h = heuristic(nx, ny, endX, endY, allowDiagonal);
        const node: Node = { x: nx, y: ny, g, h, f: g + h, parent: current };
        openList.push(node);
        openSet.set(key, node);
      }
    }

    // 대각선 이동
    if (allowDiagonal) {
      for (const [dx, dy] of DIAGONAL_DIRS) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const key = nodeKey(nx, ny);
        if (closedSet.has(key)) continue;
        if (blockedTiles?.has(`${nx},${ny}`) && !(nx === endX && ny === endY)) continue;
        if (!ignorePassability && !isDiagonalPassable(current.x, current.y, dx, dy, data, mapWidth, mapHeight, flags)) continue;

        const g = current.g + Math.SQRT2;
        const existing = openSet.get(key);
        if (existing) {
          if (g < existing.g) {
            existing.g = g;
            existing.f = g + existing.h;
            existing.parent = current;
          }
        } else {
          const h = heuristic(nx, ny, endX, endY, allowDiagonal);
          const node: Node = { x: nx, y: ny, g, h, f: g + h, parent: current };
          openList.push(node);
          openSet.set(key, node);
        }
      }
    }
  }

  return []; // 경로 없음
}

// ===================================================================
// 주변 빈 공간 탐색
// ===================================================================

/**
 * (cx, cy)에서 이동 가능한 가장 가까운 인접 타일을 BFS로 탐색.
 * 탐색 방향 우선순위: 상하좌우 → 대각선.
 * @param maxRadius 탐색 최대 반경 (기본 5타일)
 */
export function findNearestReachableTile(
  cx: number, cy: number,
  data: number[], mapWidth: number, mapHeight: number,
  flags: number[],
  maxRadius = 5,
  blockedTiles?: ReadonlySet<string>,
): { x: number; y: number } | null {
  const visited = new Set<string>();
  const queue: { x: number; y: number; dist: number }[] = [];

  const enqueue = (x: number, y: number, dist: number) => {
    const k = `${x},${y}`;
    if (!visited.has(k)) {
      visited.add(k);
      queue.push({ x, y, dist });
    }
  };

  // 시작 위치 자체는 건너뜀 (이벤트가 있는 위치)
  visited.add(`${cx},${cy}`);

  // 직선 4방향 우선, 그 다음 대각선
  for (const [dx, dy] of [...STRAIGHT_DIRS, ...DIAGONAL_DIRS]) {
    enqueue(cx + dx, cy + dy, 1);
  }

  while (queue.length > 0) {
    queue.sort((a, b) => a.dist - b.dist);
    const cur = queue.shift()!;
    if (cur.dist > maxRadius) break;
    if (cur.x < 0 || cur.x >= mapWidth || cur.y < 0 || cur.y >= mapHeight) continue;
    if (blockedTiles?.has(`${cur.x},${cur.y}`)) continue;

    // 이 위치로 진입 가능한지: 이전 위치(cx,cy)가 아닌 어떤 방향에서든 접근 가능하면 됨
    // 간단히: 이 타일에서 최소 한 방향으로 이동 가능한지 확인
    let reachable = false;
    for (const [dx, dy] of STRAIGHT_DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (isPassable(nx, ny, -dx, -dy, data, mapWidth, mapHeight, flags)) {
        reachable = true;
        break;
      }
    }
    if (reachable) return { x: cur.x, y: cur.y };

    // 주변 탐색 확장
    for (const [dx, dy] of [...STRAIGHT_DIRS, ...DIAGONAL_DIRS]) {
      enqueue(cur.x + dx, cur.y + dy, cur.dist + 1);
    }
  }

  return null;
}

// ===================================================================
// 경로 → RPG Maker MV 이동 커맨드 변환
// ===================================================================

/**
 * (dx, dy) → RPG Maker MV ROUTE_MOVE_* 코드
 * 직선: 1=아래, 2=왼쪽, 3=오른쪽, 4=위
 * 대각선: 5=좌하, 6=우하, 7=좌상, 8=우상
 */
function dirToCode(dx: number, dy: number): number {
  if (dx === 0  && dy === 1)  return 1; // 아래
  if (dx === -1 && dy === 0)  return 2; // 왼쪽
  if (dx === 1  && dy === 0)  return 3; // 오른쪽
  if (dx === 0  && dy === -1) return 4; // 위
  if (dx === -1 && dy === 1)  return 5; // 좌하
  if (dx === 1  && dy === 1)  return 6; // 우하
  if (dx === -1 && dy === -1) return 7; // 좌상
  if (dx === 1  && dy === -1) return 8; // 우상
  return 0;
}

/**
 * 경로 배열(시작점 포함)을 RPG Maker MV 이동 커맨드 배열로 변환.
 * 마지막 ROUTE_END(code=0)는 포함하지 않음.
 */
export function pathToMvCommands(path: { x: number; y: number }[]): MoveCommand[] {
  const cmds: MoveCommand[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1].x - path[i].x;
    const dy = path[i + 1].y - path[i].y;
    const code = dirToCode(dx, dy);
    if (code > 0) {
      cmds.push({ code });
    }
  }
  return cmds;
}

// ===================================================================
// 웨이포인트 세션 타입
// ===================================================================

export interface WaypointPos {
  id: string;
  x: number;
  y: number;
}

export interface WaypointSession {
  eventId: number;
  routeKey: string;        // 'auto_p0', 'cmd_p0_c1' 등
  type: 'autonomous' | 'command';
  pageIndex: number;
  commandIndex?: number;
  characterId: number;     // -1=플레이어, 0=해당 이벤트, N=다른 이벤트
  startX: number;
  startY: number;
  waypoints: WaypointPos[];
  allowDiagonal: boolean;
  avoidEvents: boolean;        // 맵 이벤트 위치를 장애물로 처리
  ignorePassability: boolean;  // true면 통과불가 타일 무시
  onConfirm?: (commands: MoveCommand[]) => void;
  /** undo/redo 히스토리 (내부 전용) */
  _history?: WaypointPos[][];
  _historyIdx?: number;
}
