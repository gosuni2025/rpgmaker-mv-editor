import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { RPGEvent, MoveRoute } from '../../types/rpgMakerMV';
import type { WaypointSession, WaypointPos } from '../../utils/astar';
import { runAstar, pathToMvCommands, findNearestReachableTile } from '../../utils/astar';
import { emitWaypointSessionChange, pushWaypointHistory } from '../MapEditor/useWaypointMode';
import { pushEventUndoEntry } from '../../store/editingHelpers';
import './InspectorPanel.css';

/** 경로 엔트리: 자율이동 or 실행내용(코드 205) */
export interface RouteEntry {
  id: string; // 고유 키
  label: string;
  type: 'autonomous' | 'command'; // 자율이동 vs 실행내용
  pageIndex: number;
  commandIndex?: number; // 실행내용일 때 커맨드 인덱스
  characterId?: number; // -1=플레이어, 0=해당 이벤트, >0=다른 이벤트
  moveRoute: MoveRoute;
  visible: boolean;
  color: string;
}

const ROUTE_COLORS = [
  '#ff8800', // 오렌지 (자율이동 기본)
  '#44aaff', // 파란
  '#ff44aa', // 핑크
  '#44ff88', // 녹색
  '#ffaa44', // 밝은 오렌지
  '#aa44ff', // 보라
  '#44ffff', // 시안
  '#ffff44', // 노랑
];

function getCharacterName(charId: number, events: (RPGEvent | null)[] | undefined): string {
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
function simulateMoveRoute(
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

/** 경로 그룹 (카테고리별) */
interface RouteGroup {
  key: string;
  label: string;
  entries: RouteEntry[];
}

function getCategoryKey(entry: Omit<RouteEntry, 'visible' | 'color'>): string {
  if (entry.type === 'autonomous') return 'autonomous';
  if (entry.characterId === -1) return 'player';
  if (entry.characterId === 0 || entry.characterId == null) return 'self';
  return `ev_${entry.characterId}`;
}

function getCategoryLabel(entry: Omit<RouteEntry, 'visible' | 'color'>, events: (RPGEvent | null)[] | undefined): string {
  if (entry.type === 'autonomous') return '자율 이동';
  if (entry.characterId === -1) return '플레이어';
  if (entry.characterId === 0 || entry.characterId == null) return '해당 이벤트';
  return getCharacterName(entry.characterId, events);
}

/** 이벤트의 모든 페이지에서 경로를 추출 */
function extractRoutes(event: RPGEvent, events: (RPGEvent | null)[] | undefined): Omit<RouteEntry, 'visible' | 'color'>[] {
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
function emitRouteVisibilityChange(
  entries: RouteEntry[],
  eventId: number,
  eventX: number,
  eventY: number,
  startOverrides?: Record<string, { x: number; y: number }>,
) {
  (window as any)._editorRouteEntries = { entries, eventId, eventX, eventY, startOverrides };
  window.dispatchEvent(new CustomEvent('editor-route-visibility-change'));
}

function clearRouteVisibility() {
  (window as any)._editorRouteEntries = null;
  window.dispatchEvent(new CustomEvent('editor-route-visibility-change'));
}

export default function EventInspector() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const tilesetInfo = useEditorStore((s) => s.tilesetInfo);
  const selectedEventIds = useEditorStore((s) => s.selectedEventIds);

  // 웨이포인트 세션 상태
  const [waypointSession, setWaypointSession] = useState<WaypointSession | null>(null);
  const sessionRef = useRef<WaypointSession | null>(null);

  // editor-waypoint-updated: 세션 내 waypoints가 변경됨 → 리렌더링 트리거
  useEffect(() => {
    const onUpdated = () => {
      const s = (window as any)._editorWaypointSession as WaypointSession | null;
      if (s) setWaypointSession({ ...s, waypoints: [...s.waypoints] });
    };
    const onSessionChange = () => {
      const s = (window as any)._editorWaypointSession as WaypointSession | null;
      sessionRef.current = s;
      setWaypointSession(s ? { ...s } : null);
    };
    window.addEventListener('editor-waypoint-updated', onUpdated);
    window.addEventListener('editor-waypoint-session-change', onSessionChange);
    return () => {
      window.removeEventListener('editor-waypoint-updated', onUpdated);
      window.removeEventListener('editor-waypoint-session-change', onSessionChange);
    };
  }, []);

  const updateSessionField = useCallback(<K extends keyof WaypointSession>(key: K, value: WaypointSession[K]) => {
    const s = (window as any)._editorWaypointSession as WaypointSession | null;
    if (!s) return;
    (s as any)[key] = value;
    (window as any)._editorWaypointSession = s;
    setWaypointSession({ ...s });
    // 오버레이에 변경 알림
    window.dispatchEvent(new CustomEvent('editor-waypoint-updated'));
  }, []);

  const deleteWaypoint = useCallback((id: string) => {
    const s = (window as any)._editorWaypointSession as WaypointSession | null;
    if (!s) return;
    pushWaypointHistory(s);
    s.waypoints = s.waypoints.filter(w => w.id !== id);
    (window as any)._editorWaypointSession = s;
    setWaypointSession({ ...s, waypoints: [...s.waypoints] });
    window.dispatchEvent(new CustomEvent('editor-waypoint-updated'));
  }, []);

  const cancelWaypoint = useCallback(() => {
    (window as any)._editorWaypointSession = null;
    emitWaypointSessionChange();
  }, []);

  const confirmWaypoint = useCallback(() => {
    const s = (window as any)._editorWaypointSession as WaypointSession | null;
    if (!s || s.waypoints.length === 0) return;
    if (!currentMap || !tilesetInfo) return;

    const { data, width, height } = currentMap;
    const { flags } = tilesetInfo;

    // avoidEvents 옵션: 현재 이벤트를 제외한 이벤트 위치를 장애물로
    let blockedTiles: Set<string> | undefined;
    if (s.avoidEvents && currentMap.events) {
      blockedTiles = new Set<string>();
      for (const ev of currentMap.events) {
        if (ev && ev.id !== s.eventId) blockedTiles.add(`${ev.x},${ev.y}`);
      }
    }

    // 시작점 → WP1 → ... → 마지막 WP 순서로 A* 계산
    const allCommands: ReturnType<typeof pathToMvCommands> = [];
    let cx = s.startX;
    let cy = s.startY;

    for (const wp of s.waypoints) {
      const path = runAstar(cx, cy, wp.x, wp.y, data, width, height, flags, s.allowDiagonal, 2000, blockedTiles, s.ignorePassability);
      if (path.length >= 2) {
        allCommands.push(...pathToMvCommands(path));
      } else if (path.length === 0) {
        // 경로를 찾지 못한 경우 — 직접 이동 (장애물 무시)
        const dx = wp.x - cx;
        const dy = wp.y - cy;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const signX = Math.sign(dx);
        const signY = Math.sign(dy);
        for (let i = 0; i < absDx; i++) allCommands.push({ code: signX > 0 ? 3 : 2 });
        for (let i = 0; i < absDy; i++) allCommands.push({ code: signY > 0 ? 1 : 4 });
      }
      cx = wp.x;
      cy = wp.y;
    }

    const confirmedRouteKey = s.routeKey;
    s.onConfirm?.(allCommands);
    cancelWaypoint();
    // 확정된 경로 표시 활성화
    if (confirmedRouteKey) {
      setRouteVisibility(prev => ({ ...prev, [confirmedRouteKey]: true }));
    }
  }, [currentMap, tilesetInfo, cancelWaypoint]);

  const event = useMemo(() => {
    if (selectedEventIds.length !== 1 || !currentMap?.events) return null;
    return currentMap.events.find(e => e && e.id === selectedEventIds[0]) as RPGEvent | undefined ?? null;
  }, [selectedEventIds, currentMap?.events]);

  // 경로 추출
  const rawRoutes = useMemo(() => {
    if (!event) return [];
    return extractRoutes(event, currentMap?.events);
  }, [event, currentMap?.events]);

  // 경로 가시성 상태
  const [routeVisibility, setRouteVisibility] = useState<Record<string, boolean>>({});

  // 경로 끝 지점부터 다음 경로 그리기 옵션
  const [continueFromEnd, setContinueFromEnd] = useState(true);

  // 이벤트가 바뀌면 가시성 초기화: 자율이동은 켜고, 나머지는 끈 상태로
  useEffect(() => {
    const vis: Record<string, boolean> = {};
    for (const r of rawRoutes) {
      vis[r.id] = true;
    }
    setRouteVisibility(vis);
  }, [event?.id, rawRoutes.length]);

  // RouteEntry 리스트 생성
  const routeEntries: RouteEntry[] = useMemo(() => {
    let colorIndex = 0;
    return rawRoutes.map(r => ({
      ...r,
      visible: routeVisibility[r.id] ?? true,
      color: ROUTE_COLORS[colorIndex++ % ROUTE_COLORS.length],
    }));
  }, [rawRoutes, routeVisibility]);

  // 카테고리별 그룹핑
  const routeGroups = useMemo((): RouteGroup[] => {
    const map = new Map<string, RouteGroup>();
    const order: string[] = [];
    for (const entry of routeEntries) {
      const key = getCategoryKey(entry);
      const label = getCategoryLabel(entry, currentMap?.events);
      if (!map.has(key)) {
        map.set(key, { key, label, entries: [] });
        order.push(key);
      }
      map.get(key)!.entries.push(entry);
    }
    return order.map(k => map.get(k)!);
  }, [routeEntries, currentMap?.events]);

  // 오버레이에 가시성 전파
  useEffect(() => {
    if (event) {
      const visibleEntries = routeEntries.filter(e => e.visible);

      // continueFromEnd: 그룹별로 이전 경로 끝점을 다음 경로의 시작점으로 전달
      let startOverrides: Record<string, { x: number; y: number }> | undefined;
      if (continueFromEnd) {
        startOverrides = {};
        for (const group of routeGroups) {
          // 그룹 첫 번째 entry의 캐릭터 기본 시작점 결정
          let cx = event.x;
          let cy = event.y;
          const first = group.entries[0];
          if (first?.characterId != null && first.characterId > 0) {
            const charEv = currentMap?.events?.find(e => e && e.id === first.characterId);
            if (charEv) { cx = charEv.x; cy = charEv.y; }
          }
          // 순서대로 체이닝: i번째 entry의 시작점 = 0~(i-1) 경로들의 끝점
          for (let i = 0; i < group.entries.length; i++) {
            const e = group.entries[i];
            if (i > 0) startOverrides![e.id] = { x: cx, y: cy };
            const cmds = e.moveRoute.list.filter(c => c.code !== 0);
            const dest = simulateMoveRoute(cmds, cx, cy);
            cx = dest.x;
            cy = dest.y;
          }
        }
      }

      emitRouteVisibilityChange(visibleEntries, event.id, event.x, event.y, startOverrides);
    } else {
      clearRouteVisibility();
    }
    return () => clearRouteVisibility();
  }, [routeEntries, event?.id, event?.x, event?.y, continueFromEnd, routeGroups, currentMap?.events]);

  const toggleRoute = useCallback((id: string) => {
    setRouteVisibility(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleAll = useCallback((visible: boolean) => {
    setRouteVisibility(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) next[key] = visible;
      return next;
    });
  }, []);

  /** 기존 경로를 웨이포인트 편집 모드로 재설정 */
  const startWaypointFromRoute = useCallback((entry: RouteEntry) => {
    if (waypointSession) return;
    if (!event || !currentMap) return;

    // 캐릭터 시작 위치 결정
    let startX = event.x;
    let startY = event.y;
    if (entry.characterId != null && entry.characterId > 0) {
      const charEv = currentMap.events?.find((e: RPGEvent | null) => e && e.id === entry.characterId) as RPGEvent | undefined;
      if (charEv) { startX = charEv.x; startY = charEv.y; }
    }

    let initialWaypoints: WaypointPos[] = [];
    if (continueFromEnd) {
      // 같은 그룹(카테고리)에서 현재 entry 이전까지의 경로를 체이닝하여 끝점 계산
      const groupKey = getCategoryKey(entry);
      const group = routeGroups.find(g => g.key === groupKey);
      const idxInGroup = group ? group.entries.findIndex(e => e.id === entry.id) : -1;
      if (group && idxInGroup > 0) {
        // 그룹의 첫 번째 경로부터 현재 entry 직전까지 순서대로 시뮬레이션
        let cx = startX;
        let cy = startY;
        for (let i = 0; i < idxInGroup; i++) {
          const cmds = group.entries[i].moveRoute.list.filter(c => c.code !== 0);
          const d = simulateMoveRoute(cmds, cx, cy);
          cx = d.x;
          cy = d.y;
        }
        startX = cx;
        startY = cy;
      } else {
        // 그룹의 첫 번째 경로: 해당 경로 자체의 끝점에서 시작
        const moveCmds = entry.moveRoute.list.filter(c => c.code !== 0);
        const dest = simulateMoveRoute(moveCmds, startX, startY);
        startX = dest.x;
        startY = dest.y;
      }
      // initialWaypoints는 비어있음 — 끝점 이후를 새로 그림
    } else {
      const moveCmds = entry.moveRoute.list.filter(c => c.code !== 0);
      const dest = simulateMoveRoute(moveCmds, startX, startY);
      // 기존 동작: 현재 위치 → 목적지를 초기 웨이포인트로
      if (dest.x !== startX || dest.y !== startY) {
        initialWaypoints = [{ id: crypto.randomUUID(), x: dest.x, y: dest.y }];
      } else {
        const ms = useEditorStore.getState();
        const tf = ms.tilesetInfo;
        if (tf) {
          const nearby = findNearestReachableTile(startX, startY, currentMap.data, currentMap.width, currentMap.height, tf.flags);
          if (nearby) initialWaypoints = [{ id: crypto.randomUUID(), x: nearby.x, y: nearby.y }];
        }
      }
    }

    const capturedEventId = event.id;
    const session: WaypointSession = {
      eventId: capturedEventId,
      routeKey: entry.id,
      type: entry.type,
      pageIndex: entry.pageIndex,
      commandIndex: entry.commandIndex,
      characterId: entry.characterId ?? 0,
      startX,
      startY,
      waypoints: initialWaypoints,
      allowDiagonal: false,
      avoidEvents: false,
      ignorePassability: false,
      onConfirm: (commands) => {
        const route = {
          list: [...commands, { code: 0 }],
          repeat: entry.moveRoute.repeat,
          skippable: entry.moveRoute.skippable,
          wait: entry.moveRoute.wait,
        };
        const st = useEditorStore.getState();
        if (!st.currentMap) return;
        const oldEvents = [...(st.currentMap.events || [])];
        const evs = [...oldEvents];
        const evIdx = evs.findIndex(e => e && e.id === capturedEventId);
        if (evIdx < 0 || !evs[evIdx]) return;
        const evCopy = { ...evs[evIdx]! };
        const pagesCopy = [...evCopy.pages];
        if (entry.type === 'autonomous') {
          pagesCopy[entry.pageIndex] = { ...pagesCopy[entry.pageIndex], moveRoute: route };
        } else if (entry.commandIndex !== undefined) {
          const listCopy = [...(pagesCopy[entry.pageIndex]?.list || [])];
          const cmd = listCopy[entry.commandIndex];
          if (cmd) {
            listCopy[entry.commandIndex] = { ...cmd, parameters: [entry.characterId ?? 0, route] };
            pagesCopy[entry.pageIndex] = { ...pagesCopy[entry.pageIndex], list: listCopy };
          }
        }
        evCopy.pages = pagesCopy;
        evs[evIdx] = evCopy;
        useEditorStore.setState({ currentMap: { ...st.currentMap, events: evs } as any });
        pushEventUndoEntry(useEditorStore.getState as any, useEditorStore.setState as any, oldEvents, evs);
      },
    };

    // 재설정할 경로가 숨겨져 있으면 표시로 변경
    setRouteVisibility(prev => ({ ...prev, [entry.id]: true }));

    (window as any)._editorWaypointSession = session;
    pushWaypointHistory(session);
    emitWaypointSessionChange();
  }, [waypointSession, event, currentMap, continueFromEnd, routeGroups]);

  // 이벤트 미선택
  if (!event) {
    return (
      <div className="light-inspector">
        <div style={{ color: '#666', fontSize: 12, padding: 8 }}>
          {selectedEventIds.length > 1
            ? `${selectedEventIds.length}개 이벤트 선택됨`
            : (<>
              <span style={{ color: '#4a4' }}>맵에서 이벤트를 선택하세요.</span>
              <div style={{ color: '#aaa', marginTop: 8, lineHeight: 1.6 }}>
                이벤트는 맵 위에 배치되는 상호작용 오브젝트입니다.
                NPC 대화, 보물상자, 문 전환, 함정 등 게임 내 모든 상호작용을 담당합니다.
                <br /><br />
                조건 분기, 변수 제어, 화면 연출, 전투 호출 등
                다양한 이벤트 커맨드를 조합하여 게임 로직을 구성할 수 있습니다.
                <br /><br />
                더블클릭으로 이벤트를 생성/편집하거나,
                우클릭 메뉴에서 새 이벤트를 만들 수 있습니다.
              </div>
            </>)}
        </div>
      </div>
    );
  }

  const page = event.pages[0]; // 첫 페이지 기본 정보
  const MOVE_TYPE_NAMES = ['고정', '랜덤', '접근', '커스텀'];
  const TRIGGER_NAMES = ['결정키', '플레이어 접촉', '이벤트 접촉', '자동 실행', '병렬 처리'];
  const PRIORITY_NAMES = ['캐릭터 아래', '캐릭터와 같은', '캐릭터 위'];

  return (
    <div className="light-inspector">

      {/* 웨이포인트 편집 패널 */}
      {waypointSession && (
        <div className="waypoint-panel">
          <div className="waypoint-panel-title">
            <span>웨이포인트 편집</span>
            <span style={{ fontSize: 10, color: '#aaa', fontWeight: 'normal' }}>
              {waypointSession.type === 'autonomous' ? '자율이동' : '이동루트 커맨드'}
            </span>
          </div>

          <div className="waypoint-panel-option">
            <label className="waypoint-checkbox">
              <input
                type="checkbox"
                checked={waypointSession.allowDiagonal}
                onChange={e => updateSessionField('allowDiagonal', e.target.checked)}
              />
              대각선 이동 허용
            </label>
            <label className="waypoint-checkbox" style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={waypointSession.avoidEvents}
                onChange={e => updateSessionField('avoidEvents', e.target.checked)}
              />
              이벤트 위치 회피
            </label>
            <label className="waypoint-checkbox" style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={waypointSession.ignorePassability}
                onChange={e => updateSessionField('ignorePassability', e.target.checked)}
              />
              이동 불가 타일 무시
            </label>
          </div>

          <div className="waypoint-list">
            {waypointSession.waypoints.length === 0 ? (
              <div className="waypoint-empty">맵을 클릭해 경유지/목적지를 추가하세요</div>
            ) : (
              waypointSession.waypoints.map((wp, i) => (
                <div key={wp.id} className="waypoint-item">
                  <span className="waypoint-item-label">
                    {i === waypointSession.waypoints.length - 1
                      ? <span style={{ color: '#f77' }}>목적지</span>
                      : <span style={{ color: '#fa0' }}>경유 {i + 1}</span>
                    }
                  </span>
                  <span className="waypoint-item-pos">({wp.x}, {wp.y})</span>
                  <button className="waypoint-delete-btn" onClick={() => deleteWaypoint(wp.id)} title="삭제">✕</button>
                </div>
              ))
            )}
          </div>

          <div className="waypoint-panel-hint">
            드래그로 위치 조정 가능 · 마지막 웨이포인트가 최종 목적지
          </div>

          <div className="waypoint-panel-buttons">
            <button className="db-btn" onClick={cancelWaypoint}>취소</button>
            <button
              className="db-btn db-btn-primary"
              onClick={confirmWaypoint}
              disabled={waypointSession.waypoints.length === 0}
            >
              확정
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="light-inspector-section">
        <div className="light-inspector-title">
          이벤트 #{String(event.id).padStart(3, '0')}
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">이름</span>
          <span style={{ color: '#ddd', fontSize: 12 }}>{event.name || '(없음)'}</span>
        </div>
        <div className="light-inspector-row">
          <span className="light-inspector-label">위치</span>
          <span style={{ color: '#ddd', fontSize: 12 }}>({event.x}, {event.y})</span>
        </div>
      </div>

      {/* 기본 속성 */}
      {page && (
        <div className="light-inspector-section">
          <div className="light-inspector-title">페이지 1 속성</div>
          <div className="light-inspector-row">
            <span className="light-inspector-label">이동</span>
            <span style={{ color: '#ddd', fontSize: 12 }}>{MOVE_TYPE_NAMES[page.moveType] ?? page.moveType}</span>
          </div>
          <div className="light-inspector-row">
            <span className="light-inspector-label">발동</span>
            <span style={{ color: '#ddd', fontSize: 12 }}>{TRIGGER_NAMES[page.trigger] ?? page.trigger}</span>
          </div>
          <div className="light-inspector-row">
            <span className="light-inspector-label">우선권</span>
            <span style={{ color: '#ddd', fontSize: 12 }}>{PRIORITY_NAMES[page.priorityType] ?? page.priorityType}</span>
          </div>
          <div className="light-inspector-row">
            <span className="light-inspector-label">페이지</span>
            <span style={{ color: '#ddd', fontSize: 12 }}>{event.pages.length}개</span>
          </div>
        </div>
      )}

      {/* 옵션 */}
      {page && (
        <div className="light-inspector-section">
          <div className="light-inspector-title">옵션</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', fontSize: 11, color: '#aaa' }}>
            {page.walkAnime && <span style={{ color: '#8cf' }}>걷기</span>}
            {page.stepAnime && <span style={{ color: '#8cf' }}>제자리</span>}
            {page.directionFix && <span style={{ color: '#f8a' }}>방향고정</span>}
            {page.through && <span style={{ color: '#fa8' }}>통과</span>}
            {!page.walkAnime && !page.stepAnime && !page.directionFix && !page.through && (
              <span>(없음)</span>
            )}
          </div>
        </div>
      )}

      {/* 경로 목록 */}
      <div className="light-inspector-section">
        <div className="light-inspector-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>경로</span>
          {routeEntries.length > 0 && (
            <span style={{ display: 'flex', gap: 4 }}>
              <button
                className="event-route-toggle-btn"
                onClick={() => toggleAll(true)}
                title="모두 표시"
              >
                전체ON
              </button>
              <button
                className="event-route-toggle-btn"
                onClick={() => toggleAll(false)}
                title="모두 숨기기"
              >
                전체OFF
              </button>
            </span>
          )}
        </div>
        {routeEntries.length > 0 && !waypointSession && (
          <label className="waypoint-checkbox" style={{ marginBottom: 6, fontSize: 11 }}>
            <input
              type="checkbox"
              checked={continueFromEnd}
              onChange={e => setContinueFromEnd(e.target.checked)}
            />
            경로 끝 지점부터 다음 경로 그리기
          </label>
        )}
        {routeEntries.length === 0 ? (
          <div style={{ color: '#666', fontSize: 11, padding: '4px 0' }}>경로 없음</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {routeGroups.map((group) => (
              <div key={group.key} className="event-route-group">
                <div className="event-route-group-header">{group.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {group.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`event-route-item ${entry.visible ? 'visible' : 'hidden'}`}
                      onClick={() => toggleRoute(entry.id)}
                    >
                      <span
                        className="event-route-swatch"
                        style={{ backgroundColor: entry.visible ? entry.color : '#555' }}
                      />
                      <span className="event-route-label">{entry.label}</span>
                      <span className="event-route-count">
                        {entry.moveRoute.list.filter(c => c.code !== 0).length}개
                      </span>
                      <button
                        className="event-route-reset-btn"
                        onClick={(e) => { e.stopPropagation(); startWaypointFromRoute(entry); }}
                        disabled={!!waypointSession}
                        title="웨이포인트로 경로 재설정"
                      >
                        재설정
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note */}
      {event.note && (
        <div className="light-inspector-section">
          <div className="light-inspector-title">메모</div>
          <div style={{ color: '#aaa', fontSize: 11, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
            {event.note}
          </div>
        </div>
      )}
    </div>
  );
}
