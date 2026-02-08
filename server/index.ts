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

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Playtest: serve game in new window
const runtimePath = path.join(__dirname, 'runtime');

// /game/index.html - 동적 생성 (내장 런타임 JS + 프로젝트 플러그인)
// plugins.js만 로드하면 PluginManager.setup()이 main.js에서 개별 플러그인을 동적 로드함
app.get('/game/index.html', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project open');

  const title = path.basename(projectManager.currentPath!);
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
        <script type="text/javascript" src="js/rpg_objects.js"></script>
        <script type="text/javascript" src="js/rpg_scenes.js"></script>
        <script type="text/javascript" src="js/rpg_sprites.js"></script>
        <script type="text/javascript" src="js/rpg_windows.js"></script>
        <script type="text/javascript" src="js/plugins.js"></script>
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

// /game/data, /game/img, /game/audio, /game/movies - 프로젝트에서 서빙
app.use('/game/data', (req, res, next) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project');
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

app.use('/api/project', projectRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/plugins', pluginsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/generator', generatorRoutes);

const server = http.createServer(app);

const wss = new WebSocketServer({ server });
wss.on('connection', (ws: WebSocket) => {
  fileWatcher.addClient(ws);
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Editor server listening on port ${PORT}`);
});
