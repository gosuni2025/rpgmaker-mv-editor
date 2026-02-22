import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { api } from '../client.js';

export function registerMapTools(server: McpServer) {

  server.tool(
    'list_maps',
    '현재 열린 RPG Maker MV 프로젝트의 맵 목록을 반환합니다. parentId, order, expanded 등 트리 구조 포함.',
    {},
    async () => {
      const maps = await api.get<unknown[]>('/api/maps/');
      return { content: [{ type: 'text', text: JSON.stringify(maps, null, 2) }] };
    },
  );

  server.tool(
    'get_map',
    '맵 데이터를 가져옵니다. 타일 데이터(data 배열)는 크기가 크므로 includeTiles=false로 제외할 수 있습니다.',
    {
      mapId: z.number().describe('맵 ID (MapInfos의 id)'),
      includeTiles: z.boolean().optional().default(false).describe('타일 데이터(data 배열) 포함 여부. 기본값 false.'),
    },
    async ({ mapId, includeTiles }) => {
      const map = await api.get<Record<string, unknown>>(`/api/maps/${mapId}`);
      if (!includeTiles) {
        delete map['data'];
      }
      return { content: [{ type: 'text', text: JSON.stringify(map, null, 2) }] };
    },
  );

  server.tool(
    'get_project_info',
    '현재 열린 RPG Maker MV 프로젝트 정보(경로, 이름, System.json 기본값 등)를 반환합니다.',
    {},
    async () => {
      const info = await api.get<unknown>('/api/project/info');
      return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
    },
  );

  server.tool(
    'create_map',
    '새 맵을 생성합니다.',
    {
      name: z.string().describe('맵 이름'),
      width: z.number().default(17).describe('맵 너비 (타일 수)'),
      height: z.number().default(13).describe('맵 높이 (타일 수)'),
      tilesetId: z.number().default(1).describe('사용할 타일셋 ID'),
      parentId: z.number().optional().describe('부모 맵 ID (트리 위치). 없으면 최상위.'),
    },
    async ({ name, width, height, tilesetId, parentId }) => {
      const result = await api.post<unknown>('/api/maps/', { name, width, height, tilesetId, parentId: parentId ?? 0 });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
}
