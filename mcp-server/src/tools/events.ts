import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../client.js';
import { EVENT_COMMAND_REFERENCE } from './schema.js';

// ── 타입 ────────────────────────────────────────────────────────────────────

interface EventCommand {
  code: number;
  indent: number;
  parameters: unknown[];
}

interface EventPage {
  conditions: Record<string, unknown>;
  directionFix: boolean;
  image: Record<string, unknown>;
  list: EventCommand[];
  moveFrequency: number;
  moveRoute: Record<string, unknown>;
  moveSpeed: number;
  moveType: number;
  priorityType: number;
  stepAnime: boolean;
  through: boolean;
  trigger: number;
  walkAnime: boolean;
}

interface MapEvent {
  id: number;
  name: string;
  note: string;
  x: number;
  y: number;
  pages: EventPage[];
}

interface MapData {
  events: (MapEvent | null)[];
  [key: string]: unknown;
}

// ── 공통 헬퍼 ───────────────────────────────────────────────────────────────

async function getMap(mapId: number): Promise<MapData> {
  return api.get<MapData>(`/api/maps/${mapId}`);
}

async function saveMap(mapId: number, map: MapData): Promise<unknown> {
  return api.put<unknown>(`/api/maps/${mapId}`, map);
}

function nextEventId(events: (MapEvent | null)[]): number {
  return events.reduce((max, e) => (e ? Math.max(max, e.id) : max), 0) + 1;
}

function defaultPage(): EventPage {
  return {
    conditions: {
      actorId: 1, actorValid: false,
      itemId: 1, itemValid: false,
      selfSwitchCh: 'A', selfSwitchValid: false,
      switch1Id: 1, switch1Valid: false,
      switch2Id: 1, switch2Valid: false,
      variableId: 1, variableValid: false, variableValue: 0,
    },
    directionFix: false,
    image: { characterIndex: 0, characterName: '', direction: 2, pattern: 1, tileId: 0 },
    list: [{ code: 0, indent: 0, parameters: [] }],
    moveFrequency: 3,
    moveRoute: { list: [{ code: 0, parameters: [] }], repeat: true, skippable: false, wait: false },
    moveSpeed: 3,
    moveType: 0,
    priorityType: 1,
    stepAnime: false,
    through: false,
    trigger: 0,
    walkAnime: true,
  };
}

// ── 이벤트 커맨드 레퍼런스 ──────────────────────────────────────────────────

export function registerEventTools(server: McpServer) {

  server.tool(
    'get_event_command_reference',
    'RPG Maker MV 이벤트 커맨드 스키마 레퍼런스를 반환합니다. 이벤트를 생성하기 전에 이 도구를 호출하여 올바른 parameters 형식을 확인하세요. 소스코드를 읽을 필요 없음.',
    {},
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(EVENT_COMMAND_REFERENCE, null, 2) }],
    }),
  );

  // ── 조회 ─────────────────────────────────────────────────────────────────

  server.tool(
    'list_events',
    '맵의 이벤트 목록을 간략하게 반환합니다 (id, name, x, y, 트리거). 전체 커맨드 내용은 get_event로 조회.',
    {
      mapId: z.number().describe('맵 ID'),
    },
    async ({ mapId }) => {
      const map = await getMap(mapId);
      const events = (map.events ?? [])
        .filter(Boolean)
        .map((e) => ({
          id: e!.id,
          name: e!.name,
          x: e!.x,
          y: e!.y,
          pageCount: e!.pages.length,
          triggers: e!.pages.map((p) => p.trigger),
          note: e!.note,
        }));
      return { content: [{ type: 'text', text: JSON.stringify(events, null, 2) }] };
    },
  );

  server.tool(
    'get_event',
    '맵의 특정 이벤트 전체 데이터를 반환합니다 (모든 페이지 + 커맨드 리스트 포함).',
    {
      mapId: z.number().describe('맵 ID'),
      eventId: z.number().describe('이벤트 ID'),
    },
    async ({ mapId, eventId }) => {
      const map = await getMap(mapId);
      const event = (map.events ?? []).find((e) => e?.id === eventId);
      if (!event) throw new Error(`이벤트 ${eventId}를 맵 ${mapId}에서 찾을 수 없음`);
      return { content: [{ type: 'text', text: JSON.stringify(event, null, 2) }] };
    },
  );

  server.tool(
    'search_events',
    '모든 맵에서 이벤트를 검색합니다. 이름, 스위치 ID, 변수 ID로 검색 가능.',
    {
      name: z.string().optional().describe('이벤트 이름 (부분 일치)'),
      switchId: z.number().optional().describe('스위치 ID'),
      variableId: z.number().optional().describe('변수 ID'),
      text: z.string().optional().describe('이벤트 텍스트 (대화 내용 등)'),
    },
    async (params) => {
      const result = await api.post<unknown>('/api/events/search', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── 생성 / 수정 / 삭제 ───────────────────────────────────────────────────

  server.tool(
    'create_event',
    `맵에 새 이벤트를 생성합니다.
pages를 생략하면 빈 페이지 1개가 자동 생성됩니다.
커맨드(list) 형식은 get_event_command_reference 도구로 확인하세요.`,
    {
      mapId: z.number().describe('맵 ID'),
      x: z.number().describe('이벤트 X 좌표'),
      y: z.number().describe('이벤트 Y 좌표'),
      name: z.string().default('새 이벤트').describe('이벤트 이름'),
      note: z.string().default('').describe('메모'),
      pages: z.array(z.any()).optional().describe('페이지 배열. 생략 시 기본 빈 페이지 생성.'),
    },
    async ({ mapId, x, y, name, note, pages }) => {
      const map = await getMap(mapId);
      const events = map.events ?? [];
      const id = nextEventId(events);

      const newEvent: MapEvent = {
        id,
        name,
        note,
        x,
        y,
        pages: (pages as EventPage[] | undefined) ?? [defaultPage()],
      };

      while (events.length <= id) events.push(null);
      events[id] = newEvent;
      map.events = events;

      await saveMap(mapId, map);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, eventId: id, event: newEvent }, null, 2) }] };
    },
  );

  server.tool(
    'update_event',
    `이벤트를 수정합니다. 제공한 필드만 업데이트됩니다 (부분 업데이트 지원).
pages를 교체할 경우 get_event_command_reference 도구로 커맨드 형식을 먼저 확인하세요.`,
    {
      mapId: z.number().describe('맵 ID'),
      eventId: z.number().describe('이벤트 ID'),
      name: z.string().optional().describe('새 이름'),
      note: z.string().optional().describe('새 메모'),
      x: z.number().optional().describe('새 X 좌표'),
      y: z.number().optional().describe('새 Y 좌표'),
      pages: z.array(z.any()).optional().describe('새 페이지 배열 (전체 교체)'),
    },
    async ({ mapId, eventId, name, note, x, y, pages }) => {
      const map = await getMap(mapId);
      const events = map.events ?? [];
      const event = events.find((e) => e?.id === eventId);
      if (!event) throw new Error(`이벤트 ${eventId}를 맵 ${mapId}에서 찾을 수 없음`);

      if (name !== undefined) event.name = name;
      if (note !== undefined) event.note = note;
      if (x !== undefined) event.x = x;
      if (y !== undefined) event.y = y;
      if (pages !== undefined) event.pages = pages as EventPage[];

      await saveMap(mapId, map);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, event }, null, 2) }] };
    },
  );

  server.tool(
    'update_event_page',
    `이벤트의 특정 페이지만 수정합니다 (부분 업데이트 지원).
list(커맨드 배열)를 교체할 때는 get_event_command_reference 도구로 형식을 확인하세요.`,
    {
      mapId: z.number().describe('맵 ID'),
      eventId: z.number().describe('이벤트 ID'),
      pageIndex: z.number().describe('페이지 인덱스 (0부터 시작)'),
      trigger: z.number().optional().describe('트리거: 0=액션버튼, 1=플레이어접촉, 2=이벤트접촉, 3=자동실행, 4=병렬처리'),
      priorityType: z.number().optional().describe('우선순위: 0=캐릭터 아래, 1=캐릭터와 같음, 2=캐릭터 위'),
      moveType: z.number().optional().describe('이동타입: 0=고정, 1=랜덤, 2=접근, 3=커스텀'),
      list: z.array(z.any()).optional().describe('커맨드 배열 (전체 교체)'),
      characterName: z.string().optional().describe('캐릭터 이미지 파일명'),
      characterIndex: z.number().optional().describe('캐릭터 인덱스 (0~7)'),
    },
    async ({ mapId, eventId, pageIndex, trigger, priorityType, moveType, list, characterName, characterIndex }) => {
      const map = await getMap(mapId);
      const events = map.events ?? [];
      const event = events.find((e) => e?.id === eventId);
      if (!event) throw new Error(`이벤트 ${eventId}를 맵 ${mapId}에서 찾을 수 없음`);

      const page = event.pages[pageIndex];
      if (!page) throw new Error(`페이지 인덱스 ${pageIndex}가 존재하지 않음`);

      if (trigger !== undefined) page.trigger = trigger;
      if (priorityType !== undefined) page.priorityType = priorityType;
      if (moveType !== undefined) page.moveType = moveType;
      if (list !== undefined) page.list = list as EventCommand[];
      if (characterName !== undefined) (page.image as Record<string, unknown>).characterName = characterName;
      if (characterIndex !== undefined) (page.image as Record<string, unknown>).characterIndex = characterIndex;

      await saveMap(mapId, map);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, page }, null, 2) }] };
    },
  );

  server.tool(
    'delete_event',
    '이벤트를 삭제합니다.',
    {
      mapId: z.number().describe('맵 ID'),
      eventId: z.number().describe('삭제할 이벤트 ID'),
    },
    async ({ mapId, eventId }) => {
      const map = await getMap(mapId);
      const events = map.events ?? [];
      if (!events[eventId]) throw new Error(`이벤트 ${eventId}를 맵 ${mapId}에서 찾을 수 없음`);

      events[eventId] = null;
      map.events = events;
      await saveMap(mapId, map);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, deletedEventId: eventId }) }] };
    },
  );
}
