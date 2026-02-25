import type { RPGEvent, MoveRoute } from '../../types/rpgMakerMV';

/** 경로 엔트리: 자율이동 or 실행내용(코드 205) */
export interface RouteEntry {
  id: string;
  label: string;
  type: 'autonomous' | 'command';
  pageIndex: number;
  commandIndex?: number;
  characterId?: number; // -1=플레이어, 0=해당 이벤트, >0=다른 이벤트
  moveRoute: MoveRoute;
  visible: boolean;
  color: string;
}

/** 경로 그룹 (카테고리별) */
export interface RouteGroup {
  key: string;
  label: string;
  entries: RouteEntry[];
}

export const ROUTE_COLORS = [
  '#ff8800',
  '#44aaff',
  '#ff44aa',
  '#44ff88',
  '#ffaa44',
  '#aa44ff',
  '#44ffff',
  '#ffff44',
];

export function getCharacterName(charId: number, events: (RPGEvent | null)[] | undefined): string {
  if (charId === -1) return '플레이어';
  if (charId === 0) return '해당 이벤트';
  if (charId > 0 && events) {
    const ev = events.find(e => e && e.id === charId);
    if (ev) return `EV${String(charId).padStart(3, '0')}:${ev.name || ''}`;
    return `EV${String(charId).padStart(3, '0')}`;
  }
  return `이벤트 ${charId}`;
}

/** 이동 루트 커맨드를 시뮬레이션하여 최종 위치 반환 */
export function simulateMoveRoute(
  commands: { code: number }[],
  startX: number,
  startY: number,
): { x: number; y: number } {
  let x = startX;
  let y = startY;
  for (const cmd of commands) {
    switch (cmd.code) {
      case 1: y++; break;        // 아래
      case 2: x--; break;        // 왼쪽
      case 3: x++; break;        // 오른쪽
      case 4: y--; break;        // 위
      case 5: x--; y++; break;   // 좌하
      case 6: x++; y++; break;   // 우하
      case 7: x--; y--; break;   // 좌상
      case 8: x++; y--; break;   // 우상
    }
  }
  return { x, y };
}

export function getCategoryKey(entry: Omit<RouteEntry, 'visible' | 'color'>): string {
  if (entry.type === 'autonomous') return 'autonomous';
  if (entry.characterId === -1) return 'player';
  if (entry.characterId === 0 || entry.characterId == null) return 'self';
  return `ev_${entry.characterId}`;
}

export function getCategoryLabel(entry: Omit<RouteEntry, 'visible' | 'color'>, events: (RPGEvent | null)[] | undefined): string {
  if (entry.type === 'autonomous') return '자율 이동';
  if (entry.characterId === -1) return '플레이어';
  if (entry.characterId === 0 || entry.characterId == null) return '해당 이벤트';
  return getCharacterName(entry.characterId, events);
}

/** 이벤트의 모든 페이지에서 경로를 추출 */
export function extractRoutes(event: RPGEvent, events: (RPGEvent | null)[] | undefined): Omit<RouteEntry, 'visible' | 'color'>[] {
  const routes: Omit<RouteEntry, 'visible' | 'color'>[] = [];

  for (let pi = 0; pi < event.pages.length; pi++) {
    const page = event.pages[pi];

    // 자율이동 커스텀 경로 (moveType === 3)
    if (page.moveType === 3 && page.moveRoute && page.moveRoute.list.length > 0) {
      const hasActualMoves = page.moveRoute.list.some(cmd => cmd.code !== 0);
      if (hasActualMoves) {
        routes.push({
          id: `auto_p${pi}`,
          label: `P${pi + 1}`,
          type: 'autonomous',
          pageIndex: pi,
          characterId: 0,
          moveRoute: page.moveRoute,
        });
      }
    }

    // 실행내용에서 코드 205 (이동 루트 설정) 추출
    if (page.list) {
      for (let ci = 0; ci < page.list.length; ci++) {
        const cmd = page.list[ci];
        if (cmd.code === 205 && cmd.parameters && cmd.parameters.length >= 2) {
          const charId = cmd.parameters[0] as number;
          const route = cmd.parameters[1] as MoveRoute;
          if (route && route.list && route.list.some(mc => mc.code !== 0)) {
            routes.push({
              id: `cmd_p${pi}_c${ci}`,
              label: `P${pi + 1}`,
              type: 'command',
              pageIndex: pi,
              commandIndex: ci,
              characterId: charId,
              moveRoute: route,
            });
          }
        }
      }
    }
  }

  return routes;
}

// 경로 가시성을 오버레이 훅에 전달하기 위한 글로벌 이벤트
export function emitRouteVisibilityChange(
  entries: RouteEntry[],
  eventId: number,
  eventX: number,
  eventY: number,
  startOverrides?: Record<string, { x: number; y: number }>,
) {
  (window as any)._editorRouteEntries = { entries, eventId, eventX, eventY, startOverrides };
  window.dispatchEvent(new CustomEvent('editor-route-visibility-change'));
}

export function clearRouteVisibility() {
  (window as any)._editorRouteEntries = null;
  window.dispatchEvent(new CustomEvent('editor-route-visibility-change'));
}
