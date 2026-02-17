import React, { useState, useEffect, useMemo, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { RPGEvent, MoveRoute } from '../../types/rpgMakerMV';
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
          label: `P${pi + 1}: 자율이동`,
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
            const charName = getCharacterName(charId, events);
            routes.push({
              id: `cmd_p${pi}_c${ci}`,
              label: `P${pi + 1}: 이동루트 → ${charName}`,
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
function emitRouteVisibilityChange(entries: RouteEntry[], eventId: number, eventX: number, eventY: number) {
  (window as any)._editorRouteEntries = { entries, eventId, eventX, eventY };
  window.dispatchEvent(new CustomEvent('editor-route-visibility-change'));
}

function clearRouteVisibility() {
  (window as any)._editorRouteEntries = null;
  window.dispatchEvent(new CustomEvent('editor-route-visibility-change'));
}

export default function EventInspector() {
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedEventIds = useEditorStore((s) => s.selectedEventIds);

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

  // 이벤트가 바뀌면 가시성 초기화: 자율이동은 켜고, 나머지는 끈 상태로
  useEffect(() => {
    const vis: Record<string, boolean> = {};
    for (const r of rawRoutes) {
      vis[r.id] = r.type === 'autonomous';
    }
    setRouteVisibility(vis);
  }, [event?.id, rawRoutes.length]);

  // RouteEntry 리스트 생성
  const routeEntries: RouteEntry[] = useMemo(() => {
    let colorIndex = 0;
    return rawRoutes.map(r => ({
      ...r,
      visible: routeVisibility[r.id] ?? (r.type === 'autonomous'),
      color: ROUTE_COLORS[colorIndex++ % ROUTE_COLORS.length],
    }));
  }, [rawRoutes, routeVisibility]);

  // 오버레이에 가시성 전파
  useEffect(() => {
    if (event) {
      const visibleEntries = routeEntries.filter(e => e.visible);
      emitRouteVisibilityChange(visibleEntries, event.id, event.x, event.y);
    } else {
      clearRouteVisibility();
    }
    return () => clearRouteVisibility();
  }, [routeEntries, event?.id, event?.x, event?.y]);

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
        {routeEntries.length === 0 ? (
          <div style={{ color: '#666', fontSize: 11, padding: '4px 0' }}>경로 없음</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {routeEntries.map((entry) => (
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
