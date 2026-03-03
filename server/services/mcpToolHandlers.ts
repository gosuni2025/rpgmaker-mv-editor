import { EVENT_CMD_REF, defaultPage, TEXT_TAGS } from './mcpConstants';

export interface McpApiClient {
  get<T>(path: string): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

export async function handleTool(name: string, args: Record<string, unknown>, api: McpApiClient): Promise<unknown> {
  switch (name) {
    case 'get_project_info': return api.get('/project/info');

    case 'list_maps': return api.get('/maps/');

    case 'get_map': {
      const map = await api.get<Record<string, unknown>>(`/maps/${args.mapId}`);
      if (!args.includeTiles) delete map['data'];
      return map;
    }

    case 'create_map': return api.post('/maps/', args);

    case 'list_events': {
      type MapEv = { id: number; name: string; x: number; y: number; pages: { trigger: number }[]; note: string };
      const map = await api.get<{ events?: (null | MapEv)[] }>(`/maps/${args.mapId}`);
      return (map.events ?? []).filter(Boolean).map(e => ({
        id: e!.id, name: e!.name, x: e!.x, y: e!.y,
        pageCount: e!.pages.length, triggers: e!.pages.map(p => p.trigger), note: e!.note,
      }));
    }

    case 'get_event': {
      const map = await api.get<{ events?: (null | { id: number })[] }>(`/maps/${args.mapId}`);
      const ev = (map.events ?? []).find(e => e?.id === args.eventId);
      if (!ev) throw new Error(`이벤트 ${args.eventId} 없음`);
      return ev;
    }

    case 'create_event': {
      type MapData = { events?: (null | { id: number })[] };
      const map = await api.get<MapData>(`/maps/${args.mapId}`);
      const events = (map as Record<string, unknown>).events as (null | { id: number })[] ?? [];
      const id = events.reduce((max, e) => (e ? Math.max(max, e.id) : max), 0) + 1;
      const newEvent = { id, name: args.name ?? '새 이벤트', note: args.note ?? '', x: args.x, y: args.y, pages: args.pages ?? [defaultPage()] };
      while (events.length <= id) events.push(null);
      events[id] = newEvent as { id: number };
      (map as Record<string, unknown>).events = events;
      await api.put(`/maps/${args.mapId}`, map);
      return { success: true, eventId: id, event: newEvent };
    }

    case 'update_event': {
      const map = await api.get<Record<string, unknown>>(`/maps/${args.mapId}`);
      const events = (map.events as (null | Record<string, unknown>)[]) ?? [];
      const ev = events.find(e => e?.['id'] === args.eventId);
      if (!ev) throw new Error(`이벤트 ${args.eventId} 없음`);
      if (args.name !== undefined) ev['name'] = args.name;
      if (args.note !== undefined) ev['note'] = args.note;
      if (args.x !== undefined) ev['x'] = args.x;
      if (args.y !== undefined) ev['y'] = args.y;
      if (args.pages !== undefined) ev['pages'] = args.pages;
      await api.put(`/maps/${args.mapId}`, map);
      return { success: true, event: ev };
    }

    case 'search_events': return api.post('/events/search', args);

    case 'get_database': return api.get(`/database/${args.type}`);

    case 'get_database_entry': {
      const data = await api.get<(unknown | null)[]>(`/database/${args.type}`);
      const entry = Array.isArray(data) ? data[args.id as number] : null;
      if (entry == null) throw new Error(`${args.type}[${args.id}] 없음`);
      return entry;
    }

    case 'update_database_entry': {
      const data = await api.get<(Record<string, unknown> | null)[]>(`/database/${args.type}`);
      if (!Array.isArray(data)) throw new Error('배열 형식 아님');
      const entry = data[args.id as number];
      if (entry == null) throw new Error(`${args.type}[${args.id}] 없음`);
      data[args.id as number] = { ...entry, ...(args.fields as Record<string, unknown>) };
      await api.put(`/database/${args.type}`, data);
      return data[args.id as number];
    }

    case 'get_event_command_reference': return EVENT_CMD_REF;

    case 'list_plugin_commands': {
      // 활성 플러그인 목록 + 파싱된 메타데이터를 결합하여 커맨드 요약 반환
      const pluginListData = await api.get<{
        list: { name: string; status: boolean; description: string }[];
      }>('/plugins');
      const allMeta = await api.get<Record<string, {
        plugindesc: string;
        help: string;
        commands?: { name: string; text: string; desc: string; args: { name: string; type: string; options: { label: string; value: string }[]; default: string }[] }[];
      }>>('/plugins/metadata');

      const enabledPlugins = (pluginListData.list || []).filter(p => p.status);
      const result: {
        name: string; desc: string;
        commands: { cmd: string; desc: string; args: string }[];
        helpExcerpt: string;
      }[] = [];

      for (const p of enabledPlugins) {
        const meta = allMeta[p.name];
        if (!meta) continue;
        const cmds = (meta.commands || []).map(c => {
          const argStr = c.args.map(a => {
            if (a.options && a.options.length > 0) {
              return `${a.name}=${a.options.map(o => o.value).join('|')}`;
            }
            return `${a.name}:${a.type}`;
          }).join(' ');
          return { cmd: c.name, desc: c.text || c.desc, args: argStr };
        });
        if (cmds.length === 0 && !meta.help.includes('플러그인 커맨드') && !meta.help.toLowerCase().includes('plugin command')) continue;
        // @help에서 플러그인 커맨드 섹션 추출
        const helpLines = meta.help.split('\n');
        let excerpt = '';
        const cmdSectionIdx = helpLines.findIndex(l => /플러그인 커맨드|plugin command/i.test(l));
        if (cmdSectionIdx >= 0) {
          excerpt = helpLines.slice(cmdSectionIdx, cmdSectionIdx + 10).join('\n').trim();
        } else if (meta.help) {
          excerpt = meta.help.slice(0, 200).trim();
        }
        result.push({ name: p.name, desc: meta.plugindesc || p.description, commands: cmds, helpExcerpt: excerpt });
      }

      return { plugins: result, textTags: TEXT_TAGS };
    }

    case 'get_plugin_detail': {
      const pluginName = args.name as string;
      if (!pluginName) throw new Error('name 필수');
      const allMeta2 = await api.get<Record<string, unknown>>('/plugins/metadata');
      const meta2 = allMeta2[pluginName];
      if (!meta2) throw new Error(`플러그인 "${pluginName}" 없음 또는 메타데이터 없음`);
      return meta2;
    }

    case 'update_map_properties': {
      const map = await api.get<Record<string, unknown>>(`/maps/${args.mapId}`);
      const props = args.properties as Record<string, unknown>;
      if (!props || typeof props !== 'object') throw new Error('properties 필드 필요');
      const updated = { ...map, ...props };
      // data 배열이 없으면 서버가 덮어쓰지 않도록 유지
      await api.put(`/maps/${args.mapId}`, updated);
      return { success: true, mapId: args.mapId, updated: Object.keys(props) };
    }

    case 'set_map_tiles': {
      const mapData = await api.get<Record<string, unknown>>(`/maps/${args.mapId}`);
      const tiles = args.tiles as { x: number; y: number; z: number; tileId: number }[];
      if (!Array.isArray(tiles) || tiles.length === 0) throw new Error('tiles 배열 필요');
      const width = mapData.width as number;
      const height = mapData.height as number;
      const data = mapData.data as number[];
      if (!data) throw new Error('맵 data 배열 없음 (includeTiles 필요)');
      for (const t of tiles) {
        const idx = (t.z * height + t.y) * width + t.x;
        if (idx < 0 || idx >= data.length) throw new Error(`범위 초과: (${t.x},${t.y},z=${t.z})`);
        data[idx] = t.tileId;
      }
      mapData.data = data;
      await api.put(`/maps/${args.mapId}`, mapData);
      return { success: true, mapId: args.mapId, count: tiles.length };
    }

    case 'set_start_position': {
      const sys = await api.get<Record<string, unknown>>('/database/system');
      sys['startMapId'] = args.mapId;
      sys['startX'] = args.x;
      sys['startY'] = args.y;
      await api.put('/database/system', sys);
      return { success: true, startMapId: args.mapId, startX: args.x, startY: args.y };
    }

    case 'list_resources': {
      const folder = (args.type as string) ?? 'characters';
      const AUDIO_TYPES = ['bgm', 'bgs', 'me', 'se'];
      let files: string[];
      if (AUDIO_TYPES.includes(folder)) {
        files = await api.get<string[]>(`/audio/${folder}`);
      } else {
        files = await api.get<string[]>(`/resources/${folder}`);
      }
      // 확장자 제거한 이름도 함께 반환 (characterName/bgm name 등에 사용하는 형식)
      return files.map(f => ({
        filename: f,
        name: f.replace(/\.[^.]+$/, ''),
      }));
    }

    default: throw new Error(`알 수 없는 도구: ${name}`);
  }
}
