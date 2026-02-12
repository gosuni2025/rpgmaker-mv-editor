import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import fileWatcher from './services/fileWatcher';
import projectManager from './services/projectManager';

import projectRoutes from './routes/project';
import mapsRoutes from './routes/maps';
import databaseRoutes from './routes/database';
import resourcesRoutes from './routes/resources';
import audioRoutes from './routes/audio';
import pluginsRoutes from './routes/plugins';
import eventsRoutes from './routes/events';
import generatorRoutes from './routes/generator';
import localizationRoutes from './routes/localization';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Playtest: serve game in new window
const runtimePath = path.join(__dirname, 'runtime');

// /game/save/* - 게임 세이브 파일 저장/로드 API (config, global, save files)
const validSaveFile = (name: string) => /^[\w.-]+\.rpgsave(\.bak)?$/.test(name);

app.get('/game/save/:filename', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project open');
  if (!validSaveFile(req.params.filename)) return res.status(400).send('Invalid filename');
  const filePath = path.join(projectManager.currentPath!, 'save', req.params.filename);
  if (!fs.existsSync(filePath)) return res.type('text/plain').send('');
  res.type('text/plain').send(fs.readFileSync(filePath, 'utf8'));
});

app.put('/game/save/:filename', express.text({ limit: '10mb' }), (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project open');
  if (!validSaveFile(req.params.filename)) return res.status(400).send('Invalid filename');
  const saveDir = path.join(projectManager.currentPath!, 'save');
  if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
  fs.writeFileSync(path.join(saveDir, req.params.filename), req.body, 'utf8');
  res.json({ ok: true });
});

app.delete('/game/save/:filename', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project open');
  if (!validSaveFile(req.params.filename)) return res.status(400).send('Invalid filename');
  const filePath = path.join(projectManager.currentPath!, 'save', req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ ok: true });
});

app.get('/game/save-exists/:filename', (req, res) => {
  if (!projectManager.isOpen()) return res.json({ exists: false });
  if (!validSaveFile(req.params.filename)) return res.json({ exists: false });
  const filePath = path.join(projectManager.currentPath!, 'save', req.params.filename);
  res.json({ exists: fs.existsSync(filePath) });
});

// /game/index.html - 동적 생성 (내장 런타임 JS + 프로젝트 플러그인)
// plugins.js만 로드하면 PluginManager.setup()이 main.js에서 개별 플러그인을 동적 로드함
app.get('/game/index.html', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project open');

  const title = path.basename(projectManager.currentPath!);
  const isDev = req.query.dev === 'true';
  const startMapId = req.query.startMapId ? parseInt(req.query.startMapId as string, 10) : 0;
  const hasStartPos = req.query.startX !== undefined && req.query.startY !== undefined;
  const startX = req.query.startX ? parseInt(req.query.startX as string, 10) : 0;
  const startY = req.query.startY ? parseInt(req.query.startY as string, 10) : 0;
  const devScript = isDev ? '\n        <script type="text/javascript" src="js/ThreeDevOverlay.js"></script>' : '';
  const startMapScript = startMapId > 0 ? `
        <script type="text/javascript">
        // 현재 맵에서 테스트: 타이틀 스킵하고 지정 맵에서 시작
        (function() {
            var _Scene_Boot_start = Scene_Boot.prototype.start;
            Scene_Boot.prototype.start = function() {
                Scene_Base.prototype.start.call(this);
                SoundManager.preloadImportantSounds();
                DataManager.setupNewGame();
                ${hasStartPos
                  ? `$gamePlayer.reserveTransfer(${startMapId}, ${startX}, ${startY});`
                  : `$gamePlayer.reserveTransfer(${startMapId}, $dataSystem.startX, $dataSystem.startY);`}
                SceneManager.goto(Scene_Map);
                this.updateDocumentTitle();
            };
        })();
        </script>` : '';
  const html = `<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="viewport" content="user-scalable=no">
        <link rel="icon" href="icon/icon.png" type="image/png">
        <link rel="apple-touch-icon" href="icon/icon.png">
        <link rel="stylesheet" type="text/css" href="fonts/gamefont.css">
        <title>${title} - Playtest</title>
    </head>
    <body style="background-color: black">
        <script type="text/javascript" src="js/libs/three.min.js"></script>
        <script type="text/javascript" src="js/libs/fpsmeter.js"></script>
        <script type="text/javascript" src="js/libs/lz-string.js"></script>
        <script type="text/javascript" src="js/libs/iphone-inline-video.browser.js"></script>
        <script type="text/javascript" src="js/renderer/RendererFactory.js"></script>
        <script type="text/javascript" src="js/renderer/RendererStrategy.js"></script>
        <script type="text/javascript" src="js/renderer/three/ThreeRendererFactory.js"></script>
        <script type="text/javascript" src="js/renderer/three/ThreeRendererStrategy.js"></script>
        <script type="text/javascript" src="js/renderer/three/ThreeContainer.js"></script>
        <script type="text/javascript" src="js/renderer/three/ThreeSprite.js"></script>
        <script type="text/javascript" src="js/renderer/three/ThreeGraphicsNode.js"></script>
        <script type="text/javascript" src="js/renderer/three/ThreeTilemap.js"></script>
        <script type="text/javascript" src="js/renderer/three/ThreeFilters.js"></script>
        <script type="text/javascript" src="js/rpg_core.js"></script>
        <script type="text/javascript" src="js/rpg_managers.js"></script>
        <script type="text/javascript">
        // StorageManager override: 서버 API를 통해 프로젝트 save/ 폴더에 저장
        (function() {
            function saveFileName(savefileId) {
                if (savefileId < 0) return 'config.rpgsave';
                if (savefileId === 0) return 'global.rpgsave';
                return 'file' + savefileId + '.rpgsave';
            }

            function syncRequest(method, url, data) {
                var xhr = new XMLHttpRequest();
                xhr.open(method, url, false);
                if (data !== undefined) {
                    xhr.setRequestHeader('Content-Type', 'text/plain');
                    xhr.send(data);
                } else {
                    xhr.send();
                }
                return xhr;
            }

            StorageManager.save = function(savefileId, json) {
                var data = LZString.compressToBase64(json);
                var name = saveFileName(savefileId);
                syncRequest('PUT', '/game/save/' + name, data);
            };

            StorageManager.load = function(savefileId) {
                var name = saveFileName(savefileId);
                var xhr = syncRequest('GET', '/game/save/' + name);
                if (xhr.status === 200 && xhr.responseText) {
                    return LZString.decompressFromBase64(xhr.responseText);
                }
                return null;
            };

            StorageManager.exists = function(savefileId) {
                var name = saveFileName(savefileId);
                var xhr = syncRequest('GET', '/game/save-exists/' + name);
                if (xhr.status === 200) {
                    return JSON.parse(xhr.responseText).exists;
                }
                return false;
            };

            StorageManager.remove = function(savefileId) {
                var name = saveFileName(savefileId);
                syncRequest('DELETE', '/game/save/' + name);
            };

            StorageManager.backup = function(savefileId) {
                if (this.exists(savefileId)) {
                    var data = this.load(savefileId);
                    var compressed = LZString.compressToBase64(data);
                    var name = saveFileName(savefileId) + '.bak';
                    syncRequest('PUT', '/game/save/' + name, compressed);
                }
            };

            StorageManager.backupExists = function(savefileId) {
                var name = saveFileName(savefileId) + '.bak';
                var xhr = syncRequest('GET', '/game/save-exists/' + name);
                if (xhr.status === 200) {
                    return JSON.parse(xhr.responseText).exists;
                }
                return false;
            };

            StorageManager.cleanBackup = function(savefileId) {
                if (this.backupExists(savefileId)) {
                    var name = saveFileName(savefileId) + '.bak';
                    syncRequest('DELETE', '/game/save/' + name);
                }
            };

            StorageManager.isLocalMode = function() {
                return false;
            };
        })();
        </script>
        <script type="text/javascript" src="js/DevPanelUtils.js"></script>
        <script type="text/javascript" src="js/rpg_objects.js"></script>
        <script type="text/javascript" src="js/rpg_scenes.js"></script>
        <script type="text/javascript" src="js/rpg_sprites.js"></script>
        <script type="text/javascript" src="js/rpg_windows.js"></script>
        <script type="text/javascript" src="js/Mode3D.js"></script>
        <script type="text/javascript" src="js/ShadowAndLight.js"></script>
        <script type="text/javascript" src="js/DepthOfField.js"></script>
        <script type="text/javascript" src="js/plugins.js"></script>${devScript}${startMapScript}
        <script type="text/javascript" src="js/main.js"></script>
    </body>
</html>`;
  res.type('html').send(html);
});

// /game/js/* - 런타임 JS 코드 (내장)
// 플러그인 관련은 프로젝트에서 서빙
app.use('/game/js/plugins', (req, res, next) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project');
  express.static(path.join(projectManager.currentPath!, 'js', 'plugins'))(req, res, next);
});
app.get('/game/js/plugins.js', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project');
  res.sendFile(path.join(projectManager.currentPath!, 'js', 'plugins.js'));
});
// 나머지 JS는 내장 런타임
app.use('/game/js', express.static(path.join(runtimePath, 'js')));

// /game/fonts, /game/icon - 내장 런타임
app.use('/game/fonts', express.static(path.join(runtimePath, 'fonts')));
app.use('/game/icon', express.static(path.join(runtimePath, 'icon')));

// /game/data - 맵 파일은 ext 병합, 나머지는 정적 서빙
const mapFilePattern = /^\/Map(\d{3})\.json$/;
app.use('/game/data', (req, res, next) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project');
  res.set('Cache-Control', 'no-store');
  const match = req.path.match(mapFilePattern);
  if (match) {
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
  express.static(path.join(projectManager.currentPath!, 'data'))(req, res, next);
});
app.use('/game/img', (req, res, next) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project');
  express.static(path.join(projectManager.currentPath!, 'img'))(req, res, next);
});
app.use('/game/audio', (req, res, next) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project');
  express.static(path.join(projectManager.currentPath!, 'audio'))(req, res, next);
});
app.use('/game/movies', (req, res, next) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project');
  express.static(path.join(projectManager.currentPath!, 'movies'))(req, res, next);
});

// 에디터 런타임용: 프로젝트 img/, data/, plugins/ 직접 서빙 (ImageManager.loadBitmap이 사용)
app.use('/img', (req, res, next) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project');
  express.static(path.join(projectManager.currentPath!, 'img'))(req, res, next);
});
app.use('/data', (req, res, next) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project');
  res.set('Cache-Control', 'no-store');
  const match = req.path.match(mapFilePattern);
  if (match) {
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
  express.static(path.join(projectManager.currentPath!, 'data'))(req, res, next);
});
app.use('/plugins', (req, res, next) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project');
  express.static(path.join(projectManager.currentPath!, 'js', 'plugins'))(req, res, next);
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

const server = http.createServer(app);

const wss = new WebSocketServer({ server });
wss.on('connection', (ws: WebSocket) => {
  fileWatcher.addClient(ws);
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Editor server listening on port ${PORT}`);
});
