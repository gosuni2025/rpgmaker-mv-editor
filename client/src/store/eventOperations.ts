import type { MapData } from '../types/rpgMakerMV';
import type { EditorState } from './types';
import { pushEventUndoEntry, incrementName } from './editingHelpers';

type SetFn = (partial: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) => void;
type GetFn = () => EditorState;

export function addEventOp(get: GetFn, set: SetFn, x: number = 0, y: number = 0): number | null {
  const { currentMap } = get();
  if (!currentMap) return null;
  const events = [...(currentMap.events || [])];
  const maxId = events.reduce((max, e) => (e && e.id > max ? e.id : max), 0);
  const newId = maxId + 1;
  const newEvent = {
    id: newId,
    name: `EV${String(newId).padStart(3, '0')}`,
    x,
    y,
    note: '',
    pages: [{
      conditions: {
        actorId: 1, actorValid: false, itemId: 1, itemValid: false,
        selfSwitchCh: 'A', selfSwitchValid: false,
        switch1Id: 1, switch1Valid: false, switch2Id: 1, switch2Valid: false,
        variableId: 1, variableValid: false, variableValue: 0,
      },
      directionFix: false,
      image: { characterIndex: 0, characterName: '', direction: 2, pattern: 1, tileId: 0 },
      list: [{ code: 0, indent: 0, parameters: [] }],
      moveFrequency: 3,
      moveRoute: { list: [{ code: 0 }], repeat: true, skippable: false, wait: false },
      moveSpeed: 3,
      moveType: 0,
      priorityType: 1,
      stepAnime: false,
      through: false,
      trigger: 0,
      walkAnime: true,
    }],
  } as MapData['events'][number];
  const oldEvents = [...events];
  while (events.length <= newId) events.push(null);
  events[newId] = newEvent;
  set({ currentMap: { ...currentMap, events }, selectedEventId: newId });
  pushEventUndoEntry(get, set, oldEvents, events);
  return newId;
}

export function copyEventOp(get: GetFn, set: SetFn, eventId: number) {
  const map = get().currentMap;
  if (!map || !map.events) return;
  const ev = map.events.find((e) => e && e.id === eventId);
  if (ev) {
    const npcEntry = map.npcData?.[eventId];
    const npcData = npcEntry ? { [eventId]: npcEntry } : undefined;
    // __ref 제거: 붙여넣기 시 새 이벤트는 인라인으로 시작
    const { __ref: _r, ...evData } = JSON.parse(JSON.stringify(ev));
    set({ clipboard: { type: 'event', event: evData, npcData } });
  }
}

export function cutEventOp(get: GetFn, set: SetFn, eventId: number) {
  copyEventOp(get, set, eventId);
  deleteEventOp(get, set, eventId);
}

export function pasteEventOp(get: GetFn, set: SetFn, x: number, y: number) {
  const { clipboard, currentMap } = get();
  if (!clipboard || clipboard.type !== 'event' || !clipboard.event || !currentMap) return;
  // 해당 위치에 이미 이벤트가 있으면 붙여넣기하지 않음
  if (currentMap.events?.some(e => e && e.id !== 0 && e.x === x && e.y === y)) return;
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
  const npcData: Record<number, { name: string; showName: boolean }> = {};
  for (const id of eventIds) {
    if (map.npcData?.[id]) npcData[id] = map.npcData[id];
  }
  // __ref 제거: 붙여넣기 시 새 이벤트는 인라인으로 시작
  const evtsCopied = JSON.parse(JSON.stringify(evts)).map(({ __ref: _r, ...ev }: any) => ev);
  set({ clipboard: {
    type: 'events',
    events: evtsCopied,
    npcData: Object.keys(npcData).length > 0 ? JSON.parse(JSON.stringify(npcData)) : undefined,
  } });
}

export function pasteEventsOp(get: GetFn, set: SetFn, x: number, y: number): { pastedCount: number; blockedPositions: number } {
  const { clipboard, currentMap } = get();
  if (!currentMap) return { pastedCount: 0, blockedPositions: 0 };
  let evts: any[] | undefined;
  if (clipboard?.type === 'events' && clipboard.events) {
    evts = clipboard.events as any[];
  } else if (clipboard?.type === 'event' && clipboard.event) {
    evts = [clipboard.event];
  }
  if (!evts || evts.length === 0) return { pastedCount: 0, blockedPositions: 0 };
  // 원본 이벤트들의 좌상단 기준으로 오프셋 계산
  const minX = Math.min(...evts.map((e: any) => e.x));
  const minY = Math.min(...evts.map((e: any) => e.y));
  const oldEvents = [...(currentMap.events || [])];
  const events = [...oldEvents];
  // 충돌 체크 + 배치 가능 목록 분리
  let blockedPositions = 0;
  const placeable: { evt: any; nx: number; ny: number }[] = [];
  for (const evt of evts) {
    const nx = x + ((evt as any).x - minX);
    const ny = y + ((evt as any).y - minY);
    const occupied = events.some(e => e && e.id !== 0 && e.x === nx && e.y === ny);
    if (occupied) { blockedPositions++; } else { placeable.push({ evt, nx, ny }); }
  }
  let maxId = events.reduce((max, e) => (e && e.id > max ? e.id : max), 0);
  const newIds: number[] = [];
  const idMapping: Record<number, number> = {};
  for (const { evt, nx, ny } of placeable) {
    const newId = ++maxId;
    idMapping[(evt as any).id] = newId;
    const newName = incrementName((evt as any).name as string, events);
    const newEvent = { ...(evt as any), id: newId, x: nx, y: ny, name: newName };
    while (events.length <= newId) events.push(null);
    events[newId] = newEvent as MapData['events'][0];
    newIds.push(newId);
  }
  // npcData 적용: 원본 eventId → 새 eventId로 매핑
  const newNpcData = { ...(currentMap.npcData || {}) };
  if (clipboard?.npcData) {
    for (const [oldIdStr, data] of Object.entries(clipboard.npcData)) {
      const newId = idMapping[Number(oldIdStr)];
      if (newId !== undefined) newNpcData[newId] = data;
    }
  }
  set({
    currentMap: {
      ...currentMap,
      events,
      npcData: Object.keys(newNpcData).length > 0 ? newNpcData : undefined,
    },
    selectedEventIds: newIds,
    selectedEventId: newIds[0] ?? null,
  });
  if (newIds.length > 0) pushEventUndoEntry(get, set, oldEvents, events);
  return { pastedCount: newIds.length, blockedPositions };
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
