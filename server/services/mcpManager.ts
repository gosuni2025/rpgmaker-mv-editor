/**
 * MCP (Model Context Protocol) 서버 매니저.
 * 별도 HTTP 서버를 띄워 SSE transport로 MCP 프로토콜을 구현.
 * Claude 등 MCP 클라이언트가 이 서버에 연결해 에디터 도구를 사용할 수 있음.
 */
import http from 'http';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import type { WebSocket } from 'ws';

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
}

const PROTOCOL_VERSION = '2024-11-05';
const MAX_LOGS = 300;

// 이벤트 커맨드 레퍼런스 (간략)
const EVENT_CMD_REF = {
  note: 'code, indent, parameters[] 형태. list는 반드시 {code:0,indent:0,parameters:[]}로 끝낼 것.',
  commands: {
    101: '텍스트 표시 시작. params=[faceName,faceIndex,background,position]. 반드시 401로 이어짐.',
    401: '텍스트 한 줄. params=[text]',
    102: '선택지. params=[choices[], cancelBranch, defaultBranch, positionType, background]',
    402: '선택지 분기. params=[index, text]', 404: '선택지 끝',
    111: '조건 분기. params=[type,...] type:0=switch,1=variable,2=selfSwitch,4=actor,7=item,10=gold,12=script',
    411: 'else', 412: '분기 끝',
    112: '반복', 113: '반복 탈출', 413: '반복 끝',
    115: '이벤트 종료', 117: '커먼 이벤트. params=[id]',
    118: '라벨. params=[name]', 119: '라벨 이동. params=[name]',
    121: '스위치 제어. params=[startId,endId,0=ON|1=OFF]',
    122: '변수 제어. params=[startId,endId,operation,operandType,valueA,valueB]',
    123: '자기 스위치. params=["A"|"B"|"C"|"D",0|1]',
    125: '골드. params=[0=add|1=sub, 0=const|1=var, amount]',
    126: '아이템. params=[itemId, 0=add|1=sub, 0=const|1=var, amount]',
    129: '파티. params=[actorId, 0=add|1=remove, 0|1]',
    201: '장소이동. params=[0=direct, mapId, x, y, dir, fadeType]',
    203: '이벤트 위치. params=[charId(-1=player,0=this), 0=direct, x, y, dir]',
    205: '이동 루트. params=[charId, {repeat,skippable,wait,list:[{code,parameters}]}]',
    221: '화면 페이드아웃', 222: '화면 페이드인',
    223: '화면 색조. params=[[r,g,b,gray], duration, wait]',
    225: '화면 진동. params=[power, speed, duration, wait]',
    230: '대기. params=[frames]',
    231: '그림 표시. params=[pictureId, name, origin, posType, x, y, scaleX, scaleY, opacity, blend]',
    235: '그림 소거. params=[pictureId]',
    241: 'BGM 재생. params=[{name,volume,pitch,pan}]',
    250: 'SE 재생. params=[{name,volume,pitch,pan}]',
    355: 'Script. params=[code]. 여러 줄은 655로 이어짐',
    356: '플러그인 커맨드. params=[command string]',
  },
  defaultPage: {
    conditions:{actorId:1,actorValid:false,itemId:1,itemValid:false,selfSwitchCh:'A',selfSwitchValid:false,switch1Id:1,switch1Valid:false,switch2Id:1,switch2Valid:false,variableId:1,variableValid:false,variableValue:0},
    directionFix:false,
    image:{characterIndex:0,characterName:'',direction:2,pattern:1,tileId:0},
    list:[{code:0,indent:0,parameters:[]}],
    moveFrequency:3,moveRoute:{list:[{code:0,parameters:[]}],repeat:true,skippable:false,wait:false},
    moveSpeed:3,moveType:0,priorityType:1,stepAnime:false,through:false,trigger:0,walkAnime:true,
  },
  triggerValues: '0=액션버튼, 1=플레이어접촉, 2=이벤트접촉, 3=자동실행, 4=병렬처리',
  priorityTypes: '0=캐릭터 아래, 1=캐릭터와 같음, 2=캐릭터 위',
};

function defaultPage() { return JSON.parse(JSON.stringify(EVENT_CMD_REF.defaultPage)); }

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
        // write 도구: 에디터 클라이언트에 토스트 알림
        const summary = this.summarizeToolCall(toolName, toolArgs, result, true);
        if (summary) this.broadcastToEditor({ type: 'mcpToolResult', success: true, summary });
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

      default: throw new Error(`알 수 없는 도구: ${name}`);
    }
  }

  // ── 도구 목록 ──────────────────────────────────────────────────────────────

  private toolList() {
    const obj = (desc: string, props: Record<string, { type: string; description?: string }>, required: string[] = []) =>
      ({ type: 'object', properties: props, required });
    return [
      { name: 'get_project_info', description: '현재 열린 프로젝트 정보', inputSchema: obj('', {}) },
      { name: 'list_maps', description: '맵 목록', inputSchema: obj('', {}) },
      { name: 'get_map', description: '맵 데이터 (includeTiles=false로 타일 배열 제외)', inputSchema: obj('', { mapId: { type: 'number' }, includeTiles: { type: 'boolean' } }, ['mapId']) },
      { name: 'create_map', description: '새 맵 생성', inputSchema: obj('', { name: { type: 'string' }, width: { type: 'number' }, height: { type: 'number' }, tilesetId: { type: 'number' }, parentId: { type: 'number' } }, ['name']) },
      { name: 'list_events', description: '맵 이벤트 목록 (간략)', inputSchema: obj('', { mapId: { type: 'number' } }, ['mapId']) },
      { name: 'get_event', description: '이벤트 전체 데이터', inputSchema: obj('', { mapId: { type: 'number' }, eventId: { type: 'number' } }, ['mapId', 'eventId']) },
      { name: 'create_event', description: '이벤트 생성. 커맨드 형식은 get_event_command_reference 참고', inputSchema: obj('', { mapId: { type: 'number' }, x: { type: 'number' }, y: { type: 'number' }, name: { type: 'string' }, note: { type: 'string' }, pages: { type: 'array' } }, ['mapId', 'x', 'y']) },
      { name: 'update_event', description: '이벤트 수정 (부분 업데이트)', inputSchema: obj('', { mapId: { type: 'number' }, eventId: { type: 'number' }, name: { type: 'string' }, note: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, pages: { type: 'array' } }, ['mapId', 'eventId']) },
      { name: 'search_events', description: '이벤트 검색 (name/switchId/variableId)', inputSchema: obj('', { name: { type: 'string' }, switchId: { type: 'number' }, variableId: { type: 'number' } }) },
      { name: 'get_database', description: 'DB 조회. type: actors/classes/skills/items/weapons/armors/enemies/troops/states/tilesets/commonEvents/system', inputSchema: obj('', { type: { type: 'string' } }, ['type']) },
      { name: 'get_database_entry', description: 'DB 단일 항목 조회', inputSchema: obj('', { type: { type: 'string' }, id: { type: 'number' } }, ['type', 'id']) },
      { name: 'update_database_entry', description: 'DB 항목 부분 업데이트. fields에 변경할 필드만 전달', inputSchema: obj('', { type: { type: 'string' }, id: { type: 'number' }, fields: { type: 'object' } }, ['type', 'id', 'fields']) },
      { name: 'get_event_command_reference', description: '★ 이벤트 커맨드 형식 레퍼런스. 이벤트 생성 전 먼저 호출하세요.', inputSchema: obj('', {}) },
    ];
  }
}

export const mcpManager = new McpManager();
