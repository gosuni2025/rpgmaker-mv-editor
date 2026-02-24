/**
 * MCP (Model Context Protocol) 서버 매니저.
 * 별도 HTTP 서버를 띄워 SSE transport로 MCP 프로토콜을 구현.
 * Claude 등 MCP 클라이언트가 이 서버에 연결해 에디터 도구를 사용할 수 있음.
 */
import http from 'http';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import type { WebSocket } from 'ws';
import { EVENT_CMD_REF, defaultPage, TEXT_TAGS, MCP_TOOLS } from './mcpConstants';

export interface McpLog {
  id: string;
  timestamp: number;
  sessionId: string;
  type: 'connect' | 'disconnect' | 'call' | 'response' | 'error';
  tool?: string;
  args?: unknown;
  result?: unknown;
  durationMs?: number;
}

interface Session {
  id: string;
  connectedAt: number;
  send: (data: unknown) => void;
  destroy: () => void;
}

const PROTOCOL_VERSION = '2024-11-05';
const MAX_LOGS = 300;

class McpManager extends EventEmitter {
  private _server: http.Server | null = null;
  private _port = 3002;
  private _editorPort = 3001;
  private _sessions = new Map<string, Session>();
  private _logs: McpLog[] = [];
  private _startError: string | null = null;
  private _wsClients = new Set<WebSocket>();

  /** 에디터 WebSocket 클라이언트 등록 (index.ts attachWebSocket에서 호출) */
  addClient(ws: WebSocket) {
    this._wsClients.add(ws);
    ws.on('close', () => this._wsClients.delete(ws));
  }

  /** 에디터 클라이언트들에게 MCP 도구 호출 결과를 브로드캐스트 */
  private broadcastToEditor(msg: object) {
    const data = JSON.stringify(msg);
    for (const ws of this._wsClients) {
      try { ws.send(data); } catch { this._wsClients.delete(ws); }
    }
  }

  /** write 도구 완료 후 클라이언트에 알릴 변경 파일 목록 */
  private changedFiles(tool: string, args: Record<string, unknown>): string[] {
    const mapFile = (id: unknown) => `Map${String(id).padStart(3, '0')}.json`;
    const dbFile = (type: unknown) => {
      const map: Record<string, string> = {
        actors: 'Actors.json', classes: 'Classes.json', skills: 'Skills.json',
        items: 'Items.json', weapons: 'Weapons.json', armors: 'Armors.json',
        enemies: 'Enemies.json', troops: 'Troops.json', states: 'States.json',
        animations: 'Animations.json', tilesets: 'Tilesets.json',
        commonEvents: 'CommonEvents.json', system: 'System.json',
      };
      return map[type as string] ?? null;
    };
    switch (tool) {
      case 'create_event':
      case 'update_event':
        return [mapFile(args.mapId)];
      case 'create_map':
        return ['MapInfos.json'];
      case 'update_map_properties':
      case 'set_map_tiles':
        return [mapFile(args.mapId)];
      case 'set_start_position':
        return ['System.json'];
      case 'update_database_entry': {
        const f = dbFile(args.type);
        return f ? [f] : [];
      }
      default: return [];
    }
  }

  /** 도구 호출 결과를 요약 문자열로 변환 */
  private summarizeToolCall(tool: string, args: Record<string, unknown>, result: unknown, success: boolean): string {
    if (!success) return `MCP 오류: ${tool} — ${String(result)}`;
    const r = result as Record<string, unknown>;
    switch (tool) {
      case 'create_event':
        return `MCP: 이벤트 생성 — "${r?.event ? (r.event as Record<string,unknown>).name : args.name}" (ID: ${r?.eventId}) at (${args.x}, ${args.y}) 맵${args.mapId}`;
      case 'update_event': {
        const fields: string[] = [];
        if (args.name !== undefined) fields.push(`이름="${args.name}"`);
        if (args.x !== undefined || args.y !== undefined) fields.push(`위치=(${args.x},${args.y})`);
        if (args.pages !== undefined) fields.push('페이지 수정');
        if (args.note !== undefined) fields.push('노트 수정');
        return `MCP: 이벤트 수정 — ID ${args.eventId} 맵${args.mapId}${fields.length ? ' (' + fields.join(', ') + ')' : ''}`;
      }
      case 'create_map':
        return `MCP: 맵 생성 — "${args.name}" (${args.width ?? 17}×${args.height ?? 13})`;
      case 'update_map_properties': {
        const fields = args.properties ? Object.keys(args.properties as object).join(', ') : '';
        return `MCP: 맵 속성 수정 — 맵${args.mapId}${fields ? ' (' + fields + ')' : ''}`;
      }
      case 'set_map_tiles': {
        const count = Array.isArray(args.tiles) ? args.tiles.length : 0;
        return `MCP: 타일 배치 — 맵${args.mapId} ${count}개 타일`;
      }
      case 'set_start_position':
        return `MCP: 시작 위치 설정 — 맵${args.mapId} (${args.x}, ${args.y})`;
      case 'update_database_entry': {
        const fields = args.fields ? Object.keys(args.fields as object).join(', ') : '';
        return `MCP: DB 수정 — ${args.type}[${args.id}]${fields ? ' (' + fields + ')' : ''}`;
      }
      default:
        return '';
    }
  }

  get port() { return this._port; }
  get isRunning() { return this._server !== null; }
  get agentCount() { return this._sessions.size; }
  get startError() { return this._startError; }

  getStatus() {
    return {
      running: this.isRunning,
      port: this._port,
      agentCount: this._sessions.size,
      startError: this._startError,
      logs: this._logs.slice(-100),
    };
  }

  setEditorPort(port: number) { this._editorPort = port; }

  private addLog(log: Omit<McpLog, 'id' | 'timestamp'>) {
    const entry: McpLog = { id: crypto.randomUUID(), timestamp: Date.now(), ...log };
    this._logs.push(entry);
    if (this._logs.length > MAX_LOGS * 1.5) this._logs = this._logs.slice(-MAX_LOGS);
    this.emit('status-changed');
  }

  start(port?: number): Promise<void> {
    if (this._server) return Promise.resolve();
    if (port !== undefined) this._port = port;
    this._startError = null;

    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

        const url = new URL(req.url ?? '/', `http://localhost:${this._port}`);
        if (req.method === 'GET' && url.pathname === '/sse') {
          this.handleSSE(req, res, url);
        } else if (req.method === 'POST' && url.pathname === '/message') {
          this.handleMessage(req, res, url);
        } else {
          res.writeHead(404); res.end('Not found');
        }
      });

      server.on('error', (err: Error & { code?: string }) => {
        const msg = err.code === 'EADDRINUSE'
          ? `포트 ${this._port} 이미 사용 중`
          : err.message;
        this._startError = msg;
        this.emit('status-changed');
        reject(new Error(msg));
      });

      server.listen(this._port, '0.0.0.0', () => {
        this._server = server;
        console.log(`[MCP] SSE 서버 시작: http://localhost:${this._port}/sse`);
        this.emit('status-changed');
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this._server) { resolve(); return; }
      // 활성 SSE 연결을 강제로 닫아야 server.close() 콜백이 호출됨
      for (const session of this._sessions.values()) {
        try { session.destroy(); } catch {}
      }
      this._sessions.clear();
      this._server.close(() => {
        this._server = null;
        this.emit('status-changed');
        resolve();
      });
    });
  }

  async restart(newPort?: number): Promise<void> {
    await this.stop();
    await this.start(newPort);
  }

  // ── SSE 핸들러 ─────────────────────────────────────────────────────────────

  private handleSSE(req: http.IncomingMessage, res: http.ServerResponse, _url: URL) {
    const sessionId = crypto.randomUUID();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendEvent = (event: string, data: unknown) => {
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      res.write(`event: ${event}\ndata: ${str}\n\n`);
    };

    // MCP SSE transport: 먼저 endpoint 이벤트로 POST URL 전달
    sendEvent('endpoint', `/message?sessionId=${sessionId}`);

    const session: Session = {
      id: sessionId,
      connectedAt: Date.now(),
      send: (data: unknown) => sendEvent('message', data),
      destroy: () => { clearInterval(ping); res.destroy(); },
    };
    this._sessions.set(sessionId, session);
    this.addLog({ sessionId, type: 'connect' });

    const ping = setInterval(() => {
      try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
    }, 25000);

    req.on('close', () => {
      clearInterval(ping);
      this._sessions.delete(sessionId);
      this.addLog({ sessionId, type: 'disconnect' });
    });
  }

  // ── 메시지 핸들러 ───────────────────────────────────────────────────────────

  private handleMessage(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
    const sessionId = url.searchParams.get('sessionId') ?? '';
    const session = this._sessions.get(sessionId);
    if (!session) { res.writeHead(404); res.end('Session not found'); return; }

    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', async () => {
      try {
        const msg = JSON.parse(body);
        res.writeHead(202); res.end('Accepted');
        await this.handleRpc(session, msg);
      } catch (err) {
        res.writeHead(400); res.end(String(err));
      }
    });
  }

  private async handleRpc(session: Session, msg: {
    jsonrpc: string;
    id?: unknown;
    method: string;
    params?: Record<string, unknown>;
  }) {
    const { id, method, params } = msg;

    if (method === 'initialize') {
      session.send({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: 'rpgmaker-mv-editor', version: '1.0.0' },
        },
      });
      return;
    }
    if (method === 'notifications/initialized' || method === 'ping') {
      if (id !== undefined) session.send({ jsonrpc: '2.0', id, result: {} });
      return;
    }
    if (method === 'tools/list') {
      session.send({ jsonrpc: '2.0', id, result: { tools: this.toolList() } });
      return;
    }
    if (method === 'tools/call') {
      const toolName = (params?.name as string) ?? '';
      const toolArgs = (params?.arguments as Record<string, unknown>) ?? {};
      const startMs = Date.now();
      this.addLog({ sessionId: session.id, type: 'call', tool: toolName, args: toolArgs });
      try {
        const result = await this.callTool(toolName, toolArgs);
        const durationMs = Date.now() - startMs;
        this.addLog({ sessionId: session.id, type: 'response', tool: toolName, result, durationMs });
        const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        session.send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });
        // write 도구: 에디터 클라이언트에 토스트 + 파일 변경 알림
        const summary = this.summarizeToolCall(toolName, toolArgs, result, true);
        if (summary) this.broadcastToEditor({ type: 'mcpToolResult', success: true, summary });
        const changed = this.changedFiles(toolName, toolArgs);
        for (const file of changed) this.broadcastToEditor({ type: 'fileChanged', file });
      } catch (err) {
        const durationMs = Date.now() - startMs;
        const errMsg = String(err);
        this.addLog({ sessionId: session.id, type: 'error', tool: toolName, result: errMsg, durationMs });
        session.send({ jsonrpc: '2.0', id, error: { code: -32603, message: errMsg } });
        // 오류도 알림
        const summary = this.summarizeToolCall(toolName, toolArgs, errMsg, false);
        if (summary) this.broadcastToEditor({ type: 'mcpToolResult', success: false, summary });
      }
      return;
    }
    if (id !== undefined) {
      session.send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  }

  // ── API 헬퍼 ───────────────────────────────────────────────────────────────

  private apiBase() { return `http://127.0.0.1:${this._editorPort}/api`; }

  private async apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${this.apiBase()}${path}`);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }
  private async apiPut<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.apiBase()}${path}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }
  private async apiPost<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.apiBase()}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }

  // ── 도구 실행 ──────────────────────────────────────────────────────────────

  private async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'get_project_info': return this.apiGet('/project/info');

      case 'list_maps': return this.apiGet('/maps/');

      case 'get_map': {
        const map = await this.apiGet<Record<string, unknown>>(`/maps/${args.mapId}`);
        if (!args.includeTiles) delete map['data'];
        return map;
      }

      case 'create_map': return this.apiPost('/maps/', args);

      case 'list_events': {
        type MapEv = { id: number; name: string; x: number; y: number; pages: { trigger: number }[]; note: string };
        const map = await this.apiGet<{ events?: (null | MapEv)[] }>(`/maps/${args.mapId}`);
        return (map.events ?? []).filter(Boolean).map(e => ({
          id: e!.id, name: e!.name, x: e!.x, y: e!.y,
          pageCount: e!.pages.length, triggers: e!.pages.map(p => p.trigger), note: e!.note,
        }));
      }

      case 'get_event': {
        const map = await this.apiGet<{ events?: (null | { id: number })[] }>(`/maps/${args.mapId}`);
        const ev = (map.events ?? []).find(e => e?.id === args.eventId);
        if (!ev) throw new Error(`이벤트 ${args.eventId} 없음`);
        return ev;
      }

      case 'create_event': {
        type MapData = { events?: (null | { id: number })[] };
        const map = await this.apiGet<MapData>(`/maps/${args.mapId}`);
        const events = (map as Record<string, unknown>).events as (null | { id: number })[] ?? [];
        const id = events.reduce((max, e) => (e ? Math.max(max, e.id) : max), 0) + 1;
        const newEvent = { id, name: args.name ?? '새 이벤트', note: args.note ?? '', x: args.x, y: args.y, pages: args.pages ?? [defaultPage()] };
        while (events.length <= id) events.push(null);
        events[id] = newEvent as { id: number };
        (map as Record<string, unknown>).events = events;
        await this.apiPut(`/maps/${args.mapId}`, map);
        return { success: true, eventId: id, event: newEvent };
      }

      case 'update_event': {
        const map = await this.apiGet<Record<string, unknown>>(`/maps/${args.mapId}`);
        const events = (map.events as (null | Record<string, unknown>)[]) ?? [];
        const ev = events.find(e => e?.['id'] === args.eventId);
        if (!ev) throw new Error(`이벤트 ${args.eventId} 없음`);
        if (args.name !== undefined) ev['name'] = args.name;
        if (args.note !== undefined) ev['note'] = args.note;
        if (args.x !== undefined) ev['x'] = args.x;
        if (args.y !== undefined) ev['y'] = args.y;
        if (args.pages !== undefined) ev['pages'] = args.pages;
        await this.apiPut(`/maps/${args.mapId}`, map);
        return { success: true, event: ev };
      }

      case 'search_events': return this.apiPost('/events/search', args);

      case 'get_database': return this.apiGet(`/database/${args.type}`);

      case 'get_database_entry': {
        const data = await this.apiGet<(unknown | null)[]>(`/database/${args.type}`);
        const entry = Array.isArray(data) ? data[args.id as number] : null;
        if (entry == null) throw new Error(`${args.type}[${args.id}] 없음`);
        return entry;
      }

      case 'update_database_entry': {
        const data = await this.apiGet<(Record<string, unknown> | null)[]>(`/database/${args.type}`);
        if (!Array.isArray(data)) throw new Error('배열 형식 아님');
        const entry = data[args.id as number];
        if (entry == null) throw new Error(`${args.type}[${args.id}] 없음`);
        data[args.id as number] = { ...entry, ...(args.fields as Record<string, unknown>) };
        await this.apiPut(`/database/${args.type}`, data);
        return data[args.id as number];
      }

      case 'get_event_command_reference': return EVENT_CMD_REF;

      case 'list_plugin_commands': {
        // 활성 플러그인 목록 + 파싱된 메타데이터를 결합하여 커맨드 요약 반환
        const pluginListData = await this.apiGet<{
          list: { name: string; status: boolean; description: string }[];
        }>('/plugins');
        const allMeta = await this.apiGet<Record<string, {
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
        const name = args.name as string;
        if (!name) throw new Error('name 필수');
        const allMeta2 = await this.apiGet<Record<string, unknown>>('/plugins/metadata');
        const meta2 = allMeta2[name];
        if (!meta2) throw new Error(`플러그인 "${name}" 없음 또는 메타데이터 없음`);
        return meta2;
      }

      case 'update_map_properties': {
        const map = await this.apiGet<Record<string, unknown>>(`/maps/${args.mapId}`);
        const props = args.properties as Record<string, unknown>;
        if (!props || typeof props !== 'object') throw new Error('properties 필드 필요');
        const updated = { ...map, ...props };
        // data 배열이 없으면 서버가 덮어쓰지 않도록 유지
        await this.apiPut(`/maps/${args.mapId}`, updated);
        return { success: true, mapId: args.mapId, updated: Object.keys(props) };
      }

      case 'set_map_tiles': {
        const mapData = await this.apiGet<Record<string, unknown>>(`/maps/${args.mapId}`);
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
        await this.apiPut(`/maps/${args.mapId}`, mapData);
        return { success: true, mapId: args.mapId, count: tiles.length };
      }

      case 'set_start_position': {
        const sys = await this.apiGet<Record<string, unknown>>('/database/system');
        sys['startMapId'] = args.mapId;
        sys['startX'] = args.x;
        sys['startY'] = args.y;
        await this.apiPut('/database/system', sys);
        return { success: true, startMapId: args.mapId, startX: args.x, startY: args.y };
      }

      case 'list_resources': {
        const folder = (args.type as string) ?? 'characters';
        const AUDIO_TYPES = ['bgm', 'bgs', 'me', 'se'];
        let files: string[];
        if (AUDIO_TYPES.includes(folder)) {
          files = await this.apiGet<string[]>(`/audio/${folder}`);
        } else {
          files = await this.apiGet<string[]>(`/resources/${folder}`);
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

  private toolList() { return MCP_TOOLS; }
}

export const mcpManager = new McpManager();
