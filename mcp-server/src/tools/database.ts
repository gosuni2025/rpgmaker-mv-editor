import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../client.js';

const DB_TYPES = [
  'actors', 'classes', 'skills', 'items', 'weapons', 'armors',
  'enemies', 'troops', 'states', 'animations', 'tilesets',
  'commonEvents', 'system', 'mapInfos',
] as const;

type DbType = typeof DB_TYPES[number];

export function registerDatabaseTools(server: McpServer) {

  server.tool(
    'get_database',
    `데이터베이스를 조회합니다.
type 목록: actors(액터), classes(직업), skills(스킬), items(아이템), weapons(무기), armors(방어구),
enemies(적), troops(적 그룹), states(상태), animations(애니메이션), tilesets(타일셋),
commonEvents(커먼 이벤트), system(시스템 설정), mapInfos(맵 목록)`,
    {
      type: z.enum(DB_TYPES).describe('데이터베이스 종류'),
    },
    async ({ type }) => {
      const data = await api.get<unknown>(`/api/database/${type}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'get_database_entry',
    '데이터베이스에서 단일 항목을 ID로 조회합니다.',
    {
      type: z.enum(DB_TYPES).describe('데이터베이스 종류'),
      id: z.number().describe('항목 ID (1부터 시작)'),
    },
    async ({ type, id }) => {
      const data = await api.get<(unknown | null)[]>(`/api/database/${type}`);
      const entry = Array.isArray(data) ? data[id] : null;
      if (entry == null) throw new Error(`${type}[${id}] 항목을 찾을 수 없음`);
      return { content: [{ type: 'text', text: JSON.stringify(entry, null, 2) }] };
    },
  );

  server.tool(
    'update_database_entry',
    `데이터베이스 항목을 부분 업데이트합니다.
제공한 필드만 덮어씁니다 (나머지는 유지). 전체 배열을 읽어서 수정 후 저장합니다.

예시 — 액터 이름 변경:
  type="actors", id=1, fields={"name":"용사"}

예시 — 스킬 데미지 공식 수정:
  type="skills", id=5, fields={"damage":{"type":1,"elementId":2,"formula":"a.atk*2","variance":20,"critical":false}}`,
    {
      type: z.enum(DB_TYPES).describe('데이터베이스 종류'),
      id: z.number().describe('항목 ID (1부터 시작)'),
      fields: z.record(z.any()).describe('업데이트할 필드들 (부분 업데이트)'),
    },
    async ({ type, id, fields }) => {
      const data = await api.get<(Record<string, unknown> | null)[]>(`/api/database/${type}`);
      if (!Array.isArray(data)) throw new Error(`${type}은 배열 형식이 아님`);
      const entry = data[id];
      if (entry == null) throw new Error(`${type}[${id}] 항목을 찾을 수 없음`);

      // 부분 업데이트 — 중첩 객체는 얕은 병합
      data[id] = { ...entry, ...fields };
      await api.put<unknown>(`/api/database/${type}`, data);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, updated: data[id] }, null, 2) }] };
    },
  );

  server.tool(
    'add_database_entry',
    `데이터베이스에 새 항목을 추가합니다.
기존 항목 중 마지막 ID + 1로 추가됩니다.
fields에 이름(name) 등 필요한 필드를 지정하세요.`,
    {
      type: z.enum(DB_TYPES as unknown as [DbType, ...DbType[]]).describe('데이터베이스 종류'),
      templateId: z.number().optional().describe('복사할 기존 항목 ID. 생략하면 빈 템플릿 사용.'),
      fields: z.record(z.any()).describe('설정할 필드들'),
    },
    async ({ type, templateId, fields }) => {
      const data = await api.get<(Record<string, unknown> | null)[]>(`/api/database/${type}`);
      if (!Array.isArray(data)) throw new Error(`${type}은 배열 형식이 아님`);

      const newId = data.length;
      let newEntry: Record<string, unknown>;

      if (templateId != null && data[templateId]) {
        // 기존 항목 복사 후 ID + fields 덮어쓰기
        newEntry = { ...data[templateId]!, id: newId, ...fields };
      } else {
        newEntry = { id: newId, ...fields };
      }

      data.push(newEntry);
      await api.put<unknown>(`/api/database/${type}`, data);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, newId, entry: newEntry }, null, 2) }] };
    },
  );

  server.tool(
    'get_common_event',
    '커먼 이벤트를 조회합니다. commonEvents 데이터베이스에서 단일 항목을 가져옵니다.',
    {
      id: z.number().describe('커먼 이벤트 ID (1부터 시작)'),
    },
    async ({ id }) => {
      const data = await api.get<(unknown | null)[]>('/api/database/commonEvents');
      const entry = Array.isArray(data) ? data[id] : null;
      if (entry == null) throw new Error(`커먼 이벤트 ${id}를 찾을 수 없음`);
      return { content: [{ type: 'text', text: JSON.stringify(entry, null, 2) }] };
    },
  );

  server.tool(
    'update_common_event',
    `커먼 이벤트를 수정합니다.
커맨드(list) 형식은 get_event_command_reference 도구로 확인하세요.`,
    {
      id: z.number().describe('커먼 이벤트 ID'),
      name: z.string().optional().describe('새 이름'),
      trigger: z.number().optional().describe('실행 조건: 0=없음, 1=스위치ON(병렬), 2=스위치ON(자동)'),
      switchId: z.number().optional().describe('조건 스위치 ID'),
      list: z.array(z.any()).optional().describe('커맨드 배열 (전체 교체)'),
    },
    async ({ id, name, trigger, switchId, list }) => {
      const data = await api.get<(Record<string, unknown> | null)[]>('/api/database/commonEvents');
      if (!Array.isArray(data)) throw new Error('커먼 이벤트 형식 오류');
      const entry = data[id];
      if (entry == null) throw new Error(`커먼 이벤트 ${id}를 찾을 수 없음`);

      if (name !== undefined) entry.name = name;
      if (trigger !== undefined) entry.trigger = trigger;
      if (switchId !== undefined) entry.switchId = switchId;
      if (list !== undefined) entry.list = list;

      await api.put<unknown>('/api/database/commonEvents', data);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, entry }, null, 2) }] };
    },
  );
}
