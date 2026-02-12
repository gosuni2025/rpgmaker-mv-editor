import type { MapData } from '../types/rpgMakerMV';
import type { EditorState } from './types';
import { pushEventUndoEntry, incrementName } from './editingHelpers';

type SetFn = (partial: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) => void;
type GetFn = () => EditorState;

export function copyEventOp(get: GetFn, set: SetFn, eventId: number) {
  const map = get().currentMap;
  if (!map || !map.events) return;
  const ev = map.events.find((e) => e && e.id === eventId);
  if (ev) set({ clipboard: { type: 'event', event: JSON.parse(JSON.stringify(ev)) } });
}

export function cutEventOp(get: GetFn, set: SetFn, eventId: number) {
  copyEventOp(get, set, eventId);
  deleteEventOp(get, set, eventId);
}

export function pasteEventOp(get: GetFn, set: SetFn, x: number, y: number) {
  const { clipboard, currentMap } = get();
  if (!clipboard || clipboard.type !== 'event' || !clipboard.event || !currentMap) return;
  const oldEvents = [...(currentMap.events || [])];
  const events = [...oldEvents];
  const maxId = events.reduce((max, e) => (e && e.id > max ? e.id : max), 0);
  const src = clipboard.event as Record<string, unknown>;
  const newName = incrementName(src.name as string, events);
  const newEvent = { ...src, id: maxId + 1, x, y, name: newName };
  while (events.length <= maxId + 1) events.push(null);
  events[maxId + 1] = newEvent as MapData['events'][0];
  set({ currentMap: { ...currentMap, events } });
  pushEventUndoEntry(get, set, oldEvents, events);
}

export function deleteEventOp(get: GetFn, set: SetFn, eventId: number) {
  const map = get().currentMap;
  if (!map || !map.events) return;
  const oldEvents = [...map.events];
  const events = map.events.map((e) => (e && e.id === eventId ? null : e));
  set({ currentMap: { ...map, events } });
  pushEventUndoEntry(get, set, oldEvents, events);
}

export function copyEventsOp(get: GetFn, set: SetFn, eventIds: number[]) {
  const map = get().currentMap;
  if (!map || !map.events || eventIds.length === 0) return;
  const evts = eventIds
    .map(id => map.events.find(e => e && e.id === id))
    .filter((e): e is NonNullable<typeof e> => !!e);
  if (evts.length === 0) return;
  set({ clipboard: { type: 'events', events: JSON.parse(JSON.stringify(evts)) } });
}

export function pasteEventsOp(get: GetFn, set: SetFn, x: number, y: number) {
  const { clipboard, currentMap } = get();
  if (!currentMap) return;
  let evts: any[] | undefined;
  if (clipboard?.type === 'events' && clipboard.events) {
    evts = clipboard.events as any[];
  } else if (clipboard?.type === 'event' && clipboard.event) {
    evts = [clipboard.event];
  }
  if (!evts || evts.length === 0) return;
  // 원본 이벤트들의 좌상단 기준으로 오프셋 계산
  const minX = Math.min(...evts.map((e: any) => e.x));
  const minY = Math.min(...evts.map((e: any) => e.y));
  const oldEvents = [...(currentMap.events || [])];
  const events = [...oldEvents];
  let maxId = events.reduce((max, e) => (e && e.id > max ? e.id : max), 0);
  const newIds: number[] = [];
  for (const evt of evts) {
    const newId = ++maxId;
    const nx = x + ((evt as any).x - minX);
    const ny = y + ((evt as any).y - minY);
    // 해당 위치에 이미 이벤트가 있으면 스킵
    const occupied = events.some(e => e && e.id !== 0 && e.x === nx && e.y === ny);
    if (occupied) continue;
    const newName = incrementName((evt as any).name as string, events);
    const newEvent = { ...(evt as any), id: newId, x: nx, y: ny, name: newName };
    while (events.length <= newId) events.push(null);
    events[newId] = newEvent as MapData['events'][0];
    newIds.push(newId);
  }
  set({ currentMap: { ...currentMap, events }, selectedEventIds: newIds, selectedEventId: newIds[0] ?? null });
  pushEventUndoEntry(get, set, oldEvents, events);
}

export function deleteEventsOp(get: GetFn, set: SetFn, eventIds: number[]) {
  const map = get().currentMap;
  if (!map || !map.events || eventIds.length === 0) return;
  const oldEvents = [...map.events];
  const idSet = new Set(eventIds);
  const events = map.events.map(e => (e && idSet.has(e.id) ? null : e));
  set({ currentMap: { ...map, events }, selectedEventIds: [], selectedEventId: null });
  pushEventUndoEntry(get, set, oldEvents, events);
}

export function moveEventsOp(get: GetFn, set: SetFn, eventIds: number[], dx: number, dy: number) {
  const map = get().currentMap;
  if (!map || !map.events || eventIds.length === 0) return;
  if (dx === 0 && dy === 0) return;
  const idSet = new Set(eventIds);
  // 이동 대상 위치에 다른 이벤트가 있는지 확인
  const movingEvents = map.events.filter(e => e && idSet.has(e.id));
  const newPositions = movingEvents.map(e => ({ x: e!.x + dx, y: e!.y + dy }));
  // 맵 범위 체크
  if (newPositions.some(p => p.x < 0 || p.x >= map.width || p.y < 0 || p.y >= map.height)) return;
  // 이동하지 않는 이벤트와 겹치는지 확인
  const nonMoving = map.events.filter(e => e && e.id !== 0 && !idSet.has(e.id));
  for (const np of newPositions) {
    if (nonMoving.some(e => e!.x === np.x && e!.y === np.y)) return;
  }
  // 이동 대상끼리 겹치는지 확인
  const posSet = new Set(newPositions.map(p => `${p.x},${p.y}`));
  if (posSet.size !== newPositions.length) return;

  const oldEvents = [...map.events];
  const events = map.events.map(e => {
    if (e && idSet.has(e.id)) {
      return { ...e, x: e.x + dx, y: e.y + dy };
    }
    return e;
  });
  set({ currentMap: { ...map, events } });
  pushEventUndoEntry(get, set, oldEvents, events);
}
