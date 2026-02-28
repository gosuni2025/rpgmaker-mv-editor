import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import fileWatcher from './services/fileWatcher';
import projectManager from './services/projectManager';
import { mcpManager } from './services/mcpManager';

import projectRoutes from './routes/project';
import { setRuntimePath } from './routes/project/migrationUtils';
import mapsRoutes from './routes/maps';
import databaseRoutes from './routes/database';
import resourcesRoutes from './routes/resources';
import audioRoutes from './routes/audio';
import pluginsRoutes from './routes/plugins';
import eventsRoutes from './routes/events';
import generatorRoutes from './routes/generator';
import localizationRoutes from './routes/localization';
import settingsRoutes from './routes/settings';
import projectSettingsRoutes from './routes/projectSettings';
import versionRoutes from './routes/version';
import uiEditorRoutes from './routes/uiEditor';
import { createPlaytestSession, createGameRouter } from './routes/game';

export interface AppOptions {
  runtimePath?: string;
  clientDistPath?: string;
}


export function createApp(options: AppOptions = {}) {
  const DEMO_MODE = process.env.DEMO_MODE === 'true';
  const resolvedRuntimePath = options.runtimePath || path.join(__dirname, 'runtime');
  setRuntimePath(resolvedRuntimePath);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // /game/* - 플레이테스트 라우터
  app.use('/game', createGameRouter(resolvedRuntimePath));

  // /runtime - 에디터 클라이언트용 런타임 JS 서빙 (client/public/runtime/ 심볼릭 링크 대체)
  app.use('/runtime', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }, express.static(path.join(resolvedRuntimePath, 'js')));

  // 에디터 런타임용: 프로젝트 img/, data/, audio/, plugins/ 직접 서빙
  const mapFilePattern = /^\/Map(\d{3})\.json$/;

  app.use('/img', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    res.set('Cache-Control', 'no-store');
    const imgDir = path.join(projectManager.currentPath!, 'img');
    // PNG ↔ WebP 폴백
    const ext = path.extname(req.path).toLowerCase();
    if (ext === '.png' || ext === '.webp') {
      const altExt = ext === '.png' ? '.webp' : '.png';
      const decodedPath = decodeURIComponent(req.path);
      const reqFile = path.join(imgDir, decodedPath);
      if (!fs.existsSync(reqFile) && fs.existsSync(reqFile.slice(0, -ext.length) + altExt)) {
        // 쿼리 파라미터(?v=...)가 있을 경우 경로 부분만 확장자 교체
        const queryIdx = req.url.indexOf('?');
        if (queryIdx >= 0) {
          const urlPath = req.url.slice(0, queryIdx);
          const query = req.url.slice(queryIdx);
          req.url = urlPath.slice(0, -ext.length) + altExt + query;
        } else {
          req.url = req.url.slice(0, -ext.length) + altExt;
        }
      }
    }
    express.static(imgDir)(req, res, next);
  });
  app.use('/data', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    res.set('Cache-Control', 'no-store');
    const match = req.path.match(mapFilePattern);
    if (match) {
      try {
        const mapId = parseInt(match[1], 10);
        const mapFile = `Map${match[1]}.json`;
        const data = projectManager.readJSON(mapFile) as Record<string, unknown>;
        const ext = projectManager.readExtJSON(mapFile);
        const merged = { ...data, ...ext };
        // __ref 마커를 인라인으로 병합 (게임 런타임은 외부 파일을 이해 못함)
        // pages만 외부 파일에서 로드하여 병합, __ref/__note 제거
        const events = (merged.events as any[]) || [];
        merged.events = events.map((ev: any) => {
          if (!ev) return ev;
          if (ev.__ref) {
            try {
              const extEvent = projectManager.readEventFile(mapId, ev.id) as Record<string, unknown>;
              const { __ref: _r, __note: _n, ...baseEvent } = ev;
              return { ...baseEvent, note: extEvent.note ?? baseEvent.note, pages: extEvent.pages ?? [] };
            } catch {
              const { __ref: _r, __note: _n, ...baseEvent } = ev;
              return { ...baseEvent, pages: baseEvent.pages ?? [] };
            }
          }
          if (!ev.pages) return { ...ev, pages: [] };
          return ev;
        });
        res.json(merged);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return res.status(404).send('Not found');
        return res.status(500).send((err as Error).message);
      }
      return;
    }
    express.static(path.join(projectManager.currentPath!, 'data'))(req, res, () => {
      if (!res.headersSent) res.status(404).send('Not found');
    });
  });
  app.use('/audio', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    express.static(path.join(projectManager.currentPath!, 'audio'))(req, res, next);
  });
  app.use('/plugins', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    res.set('Cache-Control', 'no-store');
    express.static(path.join(projectManager.currentPath!, 'js', 'plugins'))(req, res, next);
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/config', (_req, res) => res.json({ demoMode: DEMO_MODE }));

  // MCP 서버 상태 API
  app.get('/api/mcp/status', (_req, res) => res.json(mcpManager.getStatus()));
  app.post('/api/mcp/restart', async (req, res) => {
    try {
      const port = req.body?.port ? parseInt(req.body.port) : undefined;
      await mcpManager.restart(port);
      res.json(mcpManager.getStatus());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
  app.post('/api/mcp/stop', async (_req, res) => {
    await mcpManager.stop();
    res.json(mcpManager.getStatus());
  });
  app.post('/api/playtestSession', (req, res) => {
    if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
    const { mapId, mapData } = req.body as { mapId: number; mapData: Record<string, unknown> };
    if (!mapId || !mapData) return res.status(400).json({ error: 'mapId and mapData required' });
    const sessionToken = createPlaytestSession(mapId, mapData);
    res.json({ sessionToken });
  });

  app.use('/api/project', projectRoutes);
  app.use('/api/maps', mapsRoutes);
  app.use('/api/database', databaseRoutes);
  app.use('/api/resources', resourcesRoutes);
  app.use('/api/audio', audioRoutes);
  app.use('/api/plugins', pluginsRoutes);
  app.use('/api/events', eventsRoutes);
  app.use('/api/generator', generatorRoutes);
  app.use('/api/localization', localizationRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/project-settings', projectSettingsRoutes);
  app.use('/api/version', versionRoutes);
  app.use('/api/ui-editor', uiEditorRoutes);

  // 디버그: 캔버스 이미지를 /tmp/mt_debug에 저장
  app.post('/api/debug/save-canvas', (req, res) => {
    const { filename, dataUrl } = req.body as { filename: string; dataUrl: string };
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const dir = '/tmp/mt_debug';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
    console.log('[debug] saved:', filePath);
    res.json({ ok: true, path: filePath });
  });

  // Electron 패키징 시 클라이언트 정적 파일 서빙
  if (options.clientDistPath) {
    app.use(express.static(options.clientDistPath));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api/') && !req.path.startsWith('/game/') &&
          !req.path.startsWith('/img/') && !req.path.startsWith('/data/') &&
          !req.path.startsWith('/plugins/')) {
        res.sendFile(path.join(options.clientDistPath!, 'index.html'));
      }
    });
  }

  // JSON 파싱 에러 로깅 (bad control character 등 디버깅용)
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      console.error(`[JSON Parse Error] ${req.method} ${req.path} — ${err.message}`);
      res.status(400).json({ error: 'Invalid JSON', detail: err.message });
      return;
    }
    next(err);
  });

  return app;
}

export function attachWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws: WebSocket) => {
    fileWatcher.addClient(ws);
    mcpManager.addClient(ws);
  });
  return wss;
}

// dev 모드 직접 실행 시 (Electron 번들 내에서는 실행 안 함)
if (require.main === module && !process.versions.electron) {
  const DEMO_MODE = process.env.DEMO_MODE === 'true';
  // DEMO_MODE: 빌드된 client/dist 서빙 (서버 디렉터리 기준 상위)
  const clientDistPath = process.env.CLIENT_DIST_PATH
    || (DEMO_MODE ? path.join(path.dirname(__dirname), 'client', 'dist') : undefined);
  const app = createApp({ clientDistPath });
  const server = http.createServer(app);
  attachWebSocket(server);

  const shutdown = async () => {
    await mcpManager.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000); // 3초 안에 안 닫히면 강제 종료
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  const PORT = parseInt(process.env.SERVER_PORT || process.env.PORT || '3001');
  // DEMO_MODE: 0.0.0.0으로 수신 (Railway 등 외부 접근), demo-project 자동 오픈
  const host = DEMO_MODE ? '0.0.0.0' : '127.0.0.1';
  server.listen(PORT, host, () => {
    console.log(`Editor server listening on ${host}:${PORT}${DEMO_MODE ? ' [DEMO_MODE]' : ''}`);
    // MCP 서버 자동 시작
    const MCP_PORT = parseInt(process.env.MCP_PORT || '3002');
    mcpManager.setEditorPort(PORT);
    mcpManager.start(MCP_PORT).catch(err => {
      console.warn(`[MCP] 서버 시작 실패: ${err.message}`);
    });
    if (DEMO_MODE) {
      // __dirname 기준 상위 디렉터리에서 demo-project 탐색 (CWD 독립적)
      const demoProjectPath = process.env.DEMO_PROJECT_PATH
        || path.join(path.dirname(__dirname), 'demo-project')
        || path.join(process.cwd(), 'demo-project');
      if (fs.existsSync(demoProjectPath)) {
        projectManager.open(demoProjectPath);
        console.log(`Demo project opened: ${demoProjectPath}`);
      } else {
        console.warn(`Demo project not found: ${demoProjectPath}`);
      }
    }
  });
}
