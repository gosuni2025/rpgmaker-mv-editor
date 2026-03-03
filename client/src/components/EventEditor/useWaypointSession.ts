import { useCallback } from 'react';
import type { RPGEvent } from '../../types/rpgMakerMV';
import type { WaypointSession, WaypointPos } from '../../utils/astar';
import { findNearestReachableTile } from '../../utils/astar';
import { emitWaypointSessionChange, pushWaypointHistory } from '../MapEditor/useWaypointMode';
import useEditorStore from '../../store/useEditorStore';

interface UseWaypointSessionOptions {
  event: RPGEvent;
  activePage: number;
  resolvedEventId: number;
  page: any;
  updatePage: (pageIndex: number, changes: any) => void;
  setShowMoveRoute: (show: boolean) => void;
  handleOk: () => void;
}

export function useWaypointSession({
  event,
  activePage,
  resolvedEventId,
  page,
  updatePage,
  setShowMoveRoute,
  handleOk,
}: UseWaypointSessionOptions) {
  const handleWaypointMode = useCallback((charId: number) => {
    // 이벤트 주변 가장 가까운 빈 공간을 초기 목적지로 자동 설정
    const mapState = useEditorStore.getState();
    const mapData = mapState.currentMap;
    const tf = mapState.tilesetInfo;
    const initialWaypoints: WaypointPos[] = [];
    if (mapData && tf) {
      const nearby = findNearestReachableTile(
        event.x, event.y,
        mapData.data, mapData.width, mapData.height, tf.flags,
      );
      if (nearby) {
        initialWaypoints.push({ id: crypto.randomUUID(), x: nearby.x, y: nearby.y });
      }
    }
    const session: WaypointSession = {
      eventId: event.id,
      routeKey: `auto_p${activePage}`,
      type: 'autonomous',
      pageIndex: activePage,
      characterId: charId,
      startX: event.x,
      startY: event.y,
      waypoints: initialWaypoints,
      allowDiagonal: false,
      avoidEvents: false,
      ignorePassability: false,
      onConfirm: (commands) => {
        const route = {
          list: [...commands, { code: 0 }],
          repeat: page.moveRoute?.repeat ?? false,
          skippable: page.moveRoute?.skippable ?? false,
          wait: page.moveRoute?.wait ?? true,
        };
        // 컴포넌트가 이미 언마운트된 상태이므로 스토어를 직접 업데이트
        const st = useEditorStore.getState();
        if (!st.currentMap) return;
        const evs = [...(st.currentMap.events || [])];
        const evIdx = evs.findIndex(e => e && e.id === resolvedEventId);
        if (evIdx >= 0 && evs[evIdx]) {
          const evCopy = { ...evs[evIdx]! };
          const pagesCopy = [...evCopy.pages];
          pagesCopy[activePage] = { ...pagesCopy[activePage], moveRoute: route };
          evCopy.pages = pagesCopy;
          evs[evIdx] = evCopy;
          useEditorStore.setState({
            currentMap: { ...st.currentMap, events: evs } as any,
          });
        }
      },
    };
    (window as any)._editorWaypointSession = session;
    pushWaypointHistory(session); // 초기 상태 스냅샷 (undo로 빈 상태로 복원 가능)
    emitWaypointSessionChange();
    setShowMoveRoute(false);
    // 이벤트 에디터 저장 후 닫기
    handleOk();
  }, [event, activePage, resolvedEventId, page, setShowMoveRoute, handleOk]);

  return { handleWaypointMode };
}
