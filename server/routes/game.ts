import express from 'express';
import fs from 'fs';
import path from 'path';
import projectManager from '../services/projectManager';
import bundleRoutes from './bundles';
import { buildGameHtml, buildPixiGameHtml } from './gameHtmlTemplates';

// ── 인메모리 플레이테스트 세션 ────────────────────────────────────────────────
interface PlaytestSession {
  mapId: number;
  mapData: Record<string, unknown>;
  expiresAt: number;
}
const playtestSessions = new Map<string, PlaytestSession>();
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 200;

export function createPlaytestSession(mapId: number, mapData: Record<string, unknown>): string {
  const now = Date.now();
  for (const [token, session] of playtestSessions) {
    if (session.expiresAt < now) playtestSessions.delete(token);
  }
  if (playtestSessions.size >= MAX_SESSIONS) {
    const oldest = [...playtestSessions.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) playtestSessions.delete(oldest[0]);
  }
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  playtestSessions.set(token, { mapId, mapData, expiresAt: now + SESSION_TTL_MS });
  return token;
}

// ── 팩토리: /game/* 라우터 생성 ──────────────────────────────────────────────
export function createGameRouter(resolvedRuntimePath: string): express.Router {
  const router = express.Router();
  const mapFilePattern = /^\/Map(\d{3})\.json$/;
  const testPrefixPattern = /^\/Test_(.+)$/;
  const validSaveFile = (name: string) => /^[\w.-]+\.rpgsave(\.bak)?$/.test(name);

  // 세이브 파일 API
  router.get('/save-list', (req, res) => {
    if (!projectManager.isOpen()) return res.json([]);
    const saveDir = path.join(projectManager.currentPath!, 'save');
    if (!fs.existsSync(saveDir)) return res.json([]);
    res.json(fs.readdirSync(saveDir).filter(f => validSaveFile(f)));
  });
  router.get('/save/:filename', (req, res) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project open');
    if (!validSaveFile(req.params.filename)) return res.status(400).send('Invalid filename');
    const filePath = path.join(projectManager.currentPath!, 'save', req.params.filename);
    if (!fs.existsSync(filePath)) return res.type('text/plain').send('');
    res.type('text/plain').send(fs.readFileSync(filePath, 'utf8'));
  });
  router.put('/save/:filename', express.text({ limit: '10mb' }), (req, res) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project open');
    if (!validSaveFile(req.params.filename)) return res.status(400).send('Invalid filename');
    const saveDir = path.join(projectManager.currentPath!, 'save');
    if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
    fs.writeFileSync(path.join(saveDir, req.params.filename), req.body, 'utf8');
    res.json({ ok: true });
  });
  router.delete('/save/:filename', (req, res) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project open');
    if (!validSaveFile(req.params.filename)) return res.status(400).send('Invalid filename');
    const filePath = path.join(projectManager.currentPath!, 'save', req.params.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true });
  });
  router.get('/save-exists/:filename', (req, res) => {
    if (!projectManager.isOpen()) return res.json({ exists: false });
    if (!validSaveFile(req.params.filename)) return res.json({ exists: false });
    res.json({ exists: fs.existsSync(path.join(projectManager.currentPath!, 'save', req.params.filename)) });
  });

  // index.html 동적 생성 (Three.js 런타임)
  router.get('/index.html', (req, res) => buildGameHtml(req, res, resolvedRuntimePath));

  // index_pixi.html 동적 생성 (PIXI 런타임)
  router.get('/index_pixi.html', (req, res) => buildPixiGameHtml(req, res));

  // PIXI 버전 JS 서빙 (프로젝트 원본 js/ 폴더)
  router.use('/pixi_js', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    res.set('Cache-Control', 'no-store');
    express.static(path.join(projectManager.currentPath!, 'js'))(req, res, () => {
      if (!res.headersSent) res.status(404).send('Not found');
    });
  });

  // 번들
  router.use('/bundles', bundleRoutes);

  // 정적 파일 서빙
  router.use('/js/plugins', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    express.static(path.join(projectManager.currentPath!, 'js', 'plugins'))(req, res, next);
  });
  router.get('/js/plugins.js', (req, res) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    res.sendFile(path.join(projectManager.currentPath!, 'js', 'plugins.js'));
  });
  router.use('/js', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); },
    express.static(path.join(resolvedRuntimePath, 'js')));
  router.use('/fonts', express.static(path.join(resolvedRuntimePath, 'fonts')));
  router.use('/icon', express.static(path.join(resolvedRuntimePath, 'icon')));
  router.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(resolvedRuntimePath, 'sw.js'));
  });

  router.use('/data', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    res.set('Cache-Control', 'no-store');
    const urlPath = req.url.split('?')[0];
    const testMatch = urlPath.match(testPrefixPattern);
    if (testMatch) req.url = req.url.replace(/\/Test_/, '/');
    const effectivePath = req.url.split('?')[0];
    const match = effectivePath.match(mapFilePattern);
    if (match) {
      const sessionToken = req.query.session as string | undefined;
      if (sessionToken) {
        const session = playtestSessions.get(sessionToken);
        if (session && session.mapId === parseInt(match[1], 10) && session.expiresAt > Date.now()) {
          return res.json(session.mapData);
        }
      }
      try {
        const mapFile = `Map${match[1]}.json`;
        const data = projectManager.readJSON(mapFile) as Record<string, unknown>;
        const ext = projectManager.readExtJSON(mapFile);
        res.json({ ...data, ...ext });
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

  router.use('/img', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    res.set('Cache-Control', 'no-store');
    const imgDir = path.join(projectManager.currentPath!, 'img');
    const ext = path.extname(req.path).toLowerCase();
    if (ext === '.png' || ext === '.webp') {
      const altExt = ext === '.png' ? '.webp' : '.png';
      const decodedPath = decodeURIComponent(req.path);
      const reqFile = path.join(imgDir, decodedPath);
      if (!fs.existsSync(reqFile) && fs.existsSync(reqFile.slice(0, -ext.length) + altExt)) {
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
    express.static(imgDir)(req, res, () => { if (!res.headersSent) res.status(404).send('Not found'); });
  });

  router.use('/audio', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    express.static(path.join(projectManager.currentPath!, 'audio'))(req, res, () => {
      if (!res.headersSent) res.status(404).send('Not found');
    });
  });

  router.use('/movies', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    const moviesDir = path.join(projectManager.currentPath!, 'movies');
    const reqPath = path.join(moviesDir, req.path);
    const ext = path.extname(reqPath).toLowerCase();
    if (ext === '.webm' || ext === '.mp4') {
      const altExt = ext === '.webm' ? '.mp4' : '.webm';
      if (!fs.existsSync(reqPath) && fs.existsSync(reqPath.replace(ext, altExt))) {
        req.url = req.url.replace(ext, altExt);
      }
    }
    express.static(moviesDir)(req, res, next);
  });

  return router;
}
