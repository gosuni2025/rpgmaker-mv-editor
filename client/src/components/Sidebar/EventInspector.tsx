import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { RPGEvent } from '../../types/rpgMakerMV';
import type { WaypointSession, WaypointPos } from '../../utils/astar';
import { runAstar, pathToMvCommands, findNearestReachableTile } from '../../utils/astar';
import { emitWaypointSessionChange, pushWaypointHistory } from '../MapEditor/useWaypointMode';
import { pushEventUndoEntry } from '../../store/editingHelpers';
import {
  type RouteEntry, type RouteGroup,
  ROUTE_COLORS,
  getCategoryKey, getCategoryLabel, extractRoutes,
  simulateMoveRoute, emitRouteVisibilityChange, clearRouteVisibility,
} from './EventInspectorRouteUtils';
import { WaypointPanel } from './WaypointPanel';
import './InspectorPanel.css';

export default function EventInspector() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const tilesetInfo = useEditorStore((s) => s.tilesetInfo);
  const selectedEventIds = useEditorStore((s) => s.selectedEventIds);

  const [waypointSession, setWaypointSession] = useState<WaypointSession | null>(null);
  const sessionRef = useRef<WaypointSession | null>(null);

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

    let blockedTiles: Set<string> | undefined;
    if (s.avoidEvents && currentMap.events) {
      blockedTiles = new Set<string>();
      for (const ev of currentMap.events) {
        if (ev && ev.id !== s.eventId) blockedTiles.add(`${ev.x},${ev.y}`);
      }
    }

    const allCommands: ReturnType<typeof pathToMvCommands> = [];
    let cx = s.startX;
    let cy = s.startY;

    for (const wp of s.waypoints) {
      const path = runAstar(cx, cy, wp.x, wp.y, data, width, height, flags, s.allowDiagonal, 2000, blockedTiles, s.ignorePassability);
      if (path.length >= 2) {
        allCommands.push(...pathToMvCommands(path));
      } else if (path.length === 0) {
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
    if (confirmedRouteKey) {
      setRouteVisibility(prev => ({ ...prev, [confirmedRouteKey]: true }));
    }
  }, [currentMap, tilesetInfo, cancelWaypoint]);

  const event = useMemo(() => {
    if (selectedEventIds.length !== 1 || !currentMap?.events) return null;
    return currentMap.events.find(e => e && e.id === selectedEventIds[0]) as RPGEvent | undefined ?? null;
  }, [selectedEventIds, currentMap?.events]);

  const rawRoutes = useMemo(() => {
    if (!event) return [];
    return extractRoutes(event, currentMap?.events);
  }, [event, currentMap?.events]);

  const [routeVisibility, setRouteVisibility] = useState<Record<string, boolean>>({});
  const [continueFromEnd, setContinueFromEnd] = useState(true);

  useEffect(() => {
    const vis: Record<string, boolean> = {};
    for (const r of rawRoutes) vis[r.id] = true;
    setRouteVisibility(vis);
  }, [event?.id, rawRoutes.length]);

  const routeEntries: RouteEntry[] = useMemo(() => {
    let colorIndex = 0;
    return rawRoutes.map(r => ({
      ...r,
      visible: routeVisibility[r.id] ?? true,
      color: ROUTE_COLORS[colorIndex++ % ROUTE_COLORS.length],
    }));
  }, [rawRoutes, routeVisibility]);

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

  useEffect(() => {
    if (event) {
      const visibleEntries = routeEntries.filter(e => e.visible);
      let startOverrides: Record<string, { x: number; y: number }> | undefined;
      if (continueFromEnd) {
        startOverrides = {};
        for (const group of routeGroups) {
          let cx = event.x;
          let cy = event.y;
          const first = group.entries[0];
          if (first?.characterId != null && first.characterId > 0) {
            const charEv = currentMap?.events?.find(e => e && e.id === first.characterId);
            if (charEv) { cx = charEv.x; cy = charEv.y; }
          }
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

  const startWaypointFromRoute = useCallback((entry: RouteEntry) => {
    if (waypointSession) return;
    if (!event || !currentMap) return;

    let startX = event.x;
    let startY = event.y;
    if (entry.characterId != null && entry.characterId > 0) {
      const charEv = currentMap.events?.find((e: RPGEvent | null) => e && e.id === entry.characterId) as RPGEvent | undefined;
      if (charEv) { startX = charEv.x; startY = charEv.y; }
    }

    let initialWaypoints: WaypointPos[] = [];

    let chained = false;
    if (continueFromEnd) {
      const groupKey = getCategoryKey(entry);
      const group = routeGroups.find(g => g.key === groupKey);
      const idxInGroup = group ? group.entries.findIndex(e => e.id === entry.id) : -1;
      if (group && idxInGroup > 0) {
        let cx = startX;
        let cy = startY;
        for (let i = 0; i < idxInGroup; i++) {
          const cmds = group.entries[i].moveRoute.list.filter(c => c.code !== 0);
          const d = simulateMoveRoute(cmds, cx, cy);
          cx = d.x; cy = d.y;
        }
        startX = cx;
        startY = cy;
        chained = true;
      }
    }

    if (!chained) {
      const moveCmds = entry.moveRoute.list.filter(c => c.code !== 0);
      const dest = simulateMoveRoute(moveCmds, startX, startY);
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

    setRouteVisibility(prev => ({ ...prev, [entry.id]: true }));
    (window as any)._editorWaypointSession = session;
    pushWaypointHistory(session);
    emitWaypointSessionChange();
  }, [waypointSession, event, currentMap, continueFromEnd, routeGroups]);

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

  const page = event.pages[0];
  const MOVE_TYPE_NAMES = ['고정', '랜덤', '접근', '커스텀'];
  const TRIGGER_NAMES = ['결정키', '플레이어 접촉', '이벤트 접촉', '자동 실행', '병렬 처리'];
  const PRIORITY_NAMES = ['캐릭터 아래', '캐릭터와 같은', '캐릭터 위'];

  return (
    <div className="light-inspector">

      {waypointSession && (
        <WaypointPanel
          session={waypointSession}
          onUpdateField={updateSessionField}
          onDeleteWaypoint={deleteWaypoint}
          onCancel={cancelWaypoint}
          onConfirm={confirmWaypoint}
        />
      )}

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

      <div className="light-inspector-section">
        <div className="light-inspector-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>경로</span>
          {routeEntries.length > 0 && (
            <span style={{ display: 'flex', gap: 4 }}>
              <button className="event-route-toggle-btn" onClick={() => toggleAll(true)} title="모두 표시">전체ON</button>
              <button className="event-route-toggle-btn" onClick={() => toggleAll(false)} title="모두 숨기기">전체OFF</button>
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
                      <span className="event-route-swatch" style={{ backgroundColor: entry.visible ? entry.color : '#555' }} />
                      <span className="event-route-label">{entry.label}</span>
                      <span className="event-route-count">{entry.moveRoute.list.filter(c => c.code !== 0).length}개</span>
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
