/**
 * EventCommandEditor에서 웨이포인트 세션 객체를 생성하는 유틸리티.
 * MoveRouteDialog의 onWaypointMode 콜백에서 사용.
 */
import type { EventCommand, MoveRoute } from '../../types/rpgMakerMV';
import type { WaypointSession, WaypointPos } from '../../utils/astar';
import { findNearestReachableTile } from '../../utils/astar';
import useEditorStore from '../../store/useEditorStore';
import type { EventCommandContext } from './EventCommandEditor';

interface WaypointSessionOptions {
  charId: number;
  context: EventCommandContext | undefined;
  editingIdx: number | undefined;
  primaryIndex: number;
  commandsLength: number;
  waypointConfirmRef: React.MutableRefObject<{
    updateCommandParams: (idx: number, params: unknown[], extra?: EventCommand[]) => void;
    insertCommandWithParams: (code: number, params: unknown[], extra?: EventCommand[]) => void;
  } | null>;
}

export function buildWaypointSession(opts: WaypointSessionOptions): WaypointSession {
  const { charId, context, editingIdx, primaryIndex, commandsLength, waypointConfirmRef } = opts;

  const mapEvents = useEditorStore.getState().currentMap?.events ?? [];
  const currentEvent = context?.eventId != null
    ? (mapEvents.find(e => e && e.id === context.eventId) as any)
    : null;
  const startX = currentEvent?.x ?? 0;
  const startY = currentEvent?.y ?? 0;

  const capturedInsertAt = primaryIndex >= 0 ? primaryIndex : commandsLength - 1;
  const capturedEventId = context?.eventId;
  const capturedPageIndex = context?.pageIndex ?? 0;

  const initial: WaypointPos[] = [];
  const ms = useEditorStore.getState();
  const md = ms.currentMap;
  const tf = ms.tilesetInfo;
  if (md && tf) {
    const nearby = findNearestReachableTile(startX, startY, md.data, md.width, md.height, tf.flags);
    if (nearby) initial.push({ id: crypto.randomUUID(), x: nearby.x, y: nearby.y });
  }

  return {
    eventId: context?.eventId ?? 0,
    routeKey: editingIdx !== undefined
      ? `cmd_p${capturedPageIndex}_c${editingIdx}`
      : `cmd_p${capturedPageIndex}_c${capturedInsertAt}`,
    type: 'command',
    pageIndex: capturedPageIndex,
    commandIndex: editingIdx,
    characterId: charId,
    startX,
    startY,
    waypoints: initial,
    allowDiagonal: false,
    avoidEvents: false,
    ignorePassability: false,
    onConfirm: (commands) => {
      const route: MoveRoute = {
        list: [...commands, { code: 0 }],
        repeat: false,
        skippable: false,
        wait: true,
      };
      if (capturedEventId != null) {
        const st = useEditorStore.getState();
        if (!st.currentMap) return;
        const evs = [...(st.currentMap.events || [])];
        const evIdx = evs.findIndex(e => e && e.id === capturedEventId);
        if (evIdx >= 0 && evs[evIdx]) {
          const evCopy = { ...evs[evIdx]! };
          const pagesCopy = [...evCopy.pages];
          const listCopy = [...(pagesCopy[capturedPageIndex]?.list || [])];
          if (editingIdx !== undefined) {
            listCopy[editingIdx] = { ...listCopy[editingIdx], parameters: [charId, route] };
          } else {
            listCopy.splice(capturedInsertAt, 0, { code: 205, indent: 0, parameters: [charId, route] });
          }
          pagesCopy[capturedPageIndex] = { ...pagesCopy[capturedPageIndex], list: listCopy };
          evCopy.pages = pagesCopy;
          evs[evIdx] = evCopy;
          useEditorStore.setState({ currentMap: { ...st.currentMap, events: evs } as any });
        }
      } else {
        if (editingIdx !== undefined) {
          waypointConfirmRef.current?.updateCommandParams(editingIdx, [charId, route]);
        } else {
          waypointConfirmRef.current?.insertCommandWithParams(205, [charId, route]);
        }
      }
    },
  };
}
