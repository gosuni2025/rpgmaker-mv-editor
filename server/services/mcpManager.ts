/**
 * MCP (Model Context Protocol) 서버 매니저.
 * 별도 HTTP 서버를 띄워 SSE transport로 MCP 프로토콜을 구현.
 * Claude 등 MCP 클라이언트가 이 서버에 연결해 에디터 도구를 사용할 수 있음.
 */
import http from 'http';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import type { WebSocket } from 'ws';
import { MCP_TOOLS } from './mcpConstants';
import { handleTool, McpApiClient } from './mcpToolHandlers';

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
    const api: McpApiClient = {
      get: this.apiGet.bind(this),
      put: this.apiPut.bind(this),
      post: this.apiPost.bind(this),
    };
    return handleTool(name, args, api);
  }

  private toolList() { return MCP_TOOLS; }
}

export const mcpManager = new McpManager();
