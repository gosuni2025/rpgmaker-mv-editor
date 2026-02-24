import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import projectManager from '../services/projectManager';
import bundleRoutes from './bundles';

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

// ── /game/index.html 동적 생성 ────────────────────────────────────────────────
function buildGameHtml(req: Request, res: Response, resolvedRuntimePath: string): void {
  if (!projectManager.isOpen()) { res.status(404).send('No project open'); return; }

  const title = path.basename(projectManager.currentPath!);
  const isDev = req.query.dev === 'true';
  const startMapId = req.query.startMapId ? parseInt(req.query.startMapId as string, 10) : 0;
  const hasStartPos = req.query.startX !== undefined && req.query.startY !== undefined;
  const startX = req.query.startX ? parseInt(req.query.startX as string, 10) : 0;
  const startY = req.query.startY ? parseInt(req.query.startY as string, 10) : 0;
  const sessionToken = req.query.session as string | undefined;
  const testSW = req.query.testsw === '1';
  const cacheBust = `?v=${Date.now()}`;

  const devScript = isDev ? '\n        <script defer src="js/ThreeDevOverlay.js"></script>\n        <script defer src="js/CameraZoneDevOverlay.js"></script>\n        <script defer src="js/FogOfWarDevPanel.js"></script>\n        <script defer src="js/MemoryDevPanel.js"></script>\n        <script defer src="js/TileIdDevOverlay.js"></script>\n        <script defer src="js/DepthDebugPanel.js"></script>\n        <script defer src="js/RenderModeDevPanel.js"></script>' : '';

  const startMapScript = startMapId > 0 ? `
        <script type="module">
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
            var _diagTimer = setInterval(function() {
                var scene = SceneManager._scene;
                if (!scene || SceneManager._sceneStarted) { clearInterval(_diagTimer); return; }
                var sceneName = scene.constructor ? scene.constructor.name : String(scene.constructor);
                console.warn('[Playtest] Now Loading 중. 씬:', sceneName, '/ stopped:', !!SceneManager._stopped);
                console.warn('  ImageManager.isReady():', ImageManager.isReady());
                console.warn('  DataManager.isDatabaseLoaded():', DataManager.isDatabaseLoaded());
                console.warn('  DataManager.isMapLoaded():', DataManager.isMapLoaded());
                console.warn('  Graphics.isFontLoaded(GameFont):', Graphics.isFontLoaded('GameFont'));
                console.warn('  scene.isReady():', (function(){ try { return scene.isReady(); } catch(e){ return 'ERROR:'+e; } })());
                if (sceneName === 'Scene_Map') {
                    console.warn('  $dataMap:', !!window.$dataMap, '/ $gamePlayer._newMapId:', window.$gamePlayer && window.$gamePlayer._newMapId);
                    console.warn('  scene._mapLoaded:', scene._mapLoaded, '/ scene._transfer:', scene._transfer);
                }
            }, 5000);
        })();
        </script>` : '';

  const sessionScript = sessionToken && startMapId > 0 ? `
        <script type="module">
        (function() {
            var _SESSION_TOKEN = '${sessionToken}';
            var _SESSION_MAP_ID = ${startMapId};
            var _orig = DataManager.loadDataFile.bind(DataManager);
            DataManager.loadDataFile = function(name, src) {
                var m = src.match(/^Map(\\d{3})\\.json$/);
                if (m && parseInt(m[1], 10) === _SESSION_MAP_ID) {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', 'data/' + src + '?session=' + _SESSION_TOKEN, true);
                    xhr.overrideMimeType('application/json');
                    xhr.onload = function() {
                        if (xhr.status < 400) { window[name] = JSON.parse(xhr.responseText); DataManager.onLoad(window[name]); }
                    };
                    window[name] = null; xhr.send(); return;
                }
                _orig(name, src);
            };
            var _origCreateLoader = ResourceHandler.createLoader.bind(ResourceHandler);
            ResourceHandler.createLoader = function(url, retryMethod, resignMethod, retryInterval) {
                if (url && /\\.(png|jpg|jpeg|gif|webp)(\\?|$)/i.test(url)) {
                    var retryArr = retryInterval || ResourceHandler._defaultRetryInterval;
                    var retryCount = 0;
                    return function() {
                        if (retryCount < retryArr.length) { setTimeout(retryMethod, retryArr[retryCount]); retryCount++; }
                        else { if (resignMethod) resignMethod(); }
                    };
                }
                return _origCreateLoader(url, retryMethod, resignMethod, retryInterval);
            };
            var _origCacheIsReady = ImageCache.prototype.isReady;
            ImageCache.prototype.isReady = function() {
                var items = this._items;
                return !Object.keys(items).some(function(key) {
                    var bitmap = items[key].bitmap;
                    if (bitmap.isError()) return false;
                    return !bitmap.isRequestOnly() && !bitmap.isReady();
                });
            };
        })();
        </script>` : '';

  const swScript = testSW ? `<script>
        (function() {
            var mainSrc = 'js/main.js${cacheBust}';
            var mainLoaded = false;
            function loadMain() { if (mainLoaded) return; mainLoaded = true; removeOverlay(); var s = document.createElement('script'); s.src = mainSrc; document.body.appendChild(s); }
            var overlay = null;
            function createOverlay() {
                overlay = document.createElement('div');
                overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;color:#ccc';
                overlay.innerHTML = '<div style="font-size:15px;margin-bottom:20px">[SW 번들 테스트] 리소스 다운로드 중...</div><div style="width:360px;background:#222;border-radius:4px;overflow:hidden;height:8px"><div id="sw-bar" style="height:8px;width:0%;background:#2c6fc7;transition:width 0.15s"></div></div><div id="sw-txt" style="font-size:12px;margin-top:10px;color:#888"></div>';
                document.body.appendChild(overlay);
            }
            function removeOverlay() { if (overlay) { overlay.remove(); overlay = null; } }
            function setProgress(loaded, total) { if (!overlay) return; var pct = total > 0 ? Math.round(loaded / total * 100) : 0; document.getElementById('sw-bar').style.width = pct + '%'; document.getElementById('sw-txt').textContent = loaded + ' / ' + total + ' (' + pct + '%)'; }
            if (!('serviceWorker' in navigator)) { loadMain(); return; }
            navigator.serviceWorker.addEventListener('message', function(e) { var msg = e.data; if (!msg) return; if (msg.type === 'bundle-progress') setProgress(msg.loadedFiles, msg.totalFiles); else if (msg.type === 'bundle-ready' || msg.type === 'bundle-skip' || msg.type === 'bundle-error') loadMain(); });
            var fallback = setTimeout(function() { loadMain(); }, 60000);
            createOverlay();
            navigator.serviceWorker.register('sw.js', { scope: './' }).then(function(reg) { if (reg.active && !reg.installing && !reg.waiting) { clearTimeout(fallback); loadMain(); } }).catch(function() { clearTimeout(fallback); loadMain(); });
        })();
        </script>` : `<script defer src="js/main.js${cacheBust}"></script>`;

  const imgDir = path.join(projectManager.currentPath!, 'img');
  let useWebp = false;
  if (fs.existsSync(imgDir)) {
    const checkWebp = (dir: string): boolean => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) { if (checkWebp(path.join(dir, e.name))) return true; }
        else if (e.name.toLowerCase().endsWith('.webp')) return true;
      }
      return false;
    };
    useWebp = checkWebp(imgDir);
  }
  const cacheBustScript = `<script>window.__CACHE_BUST__={webp:${useWebp}};</script>`;

  res.type('html').send(`<!DOCTYPE html>
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
        ${cacheBustScript}
    </head>
    <body style="background-color: black">
        <script src="js/libs/three.global.min.js"></script>
        <script defer src="js/libs/fpsmeter.js"></script>
        <script defer src="js/libs/lz-string.js"></script>
        <script defer src="js/libs/iphone-inline-video.browser.js"></script>
        <script defer src="js/renderer/RendererFactory.js${cacheBust}"></script>
        <script defer src="js/renderer/RendererStrategy.js${cacheBust}"></script>
        <script defer src="js/renderer/three/ThreeRendererFactory.js${cacheBust}"></script>
        <script defer src="js/renderer/three/ThreeRendererStrategy.js${cacheBust}"></script>
        <script defer src="js/renderer/three/ThreeContainer.js${cacheBust}"></script>
        <script defer src="js/renderer/three/ThreeSprite.js${cacheBust}"></script>
        <script defer src="js/renderer/three/ThreeGraphicsNode.js${cacheBust}"></script>
        <script defer src="js/renderer/three/ThreeTilemap.js${cacheBust}"></script>
        <script defer src="js/renderer/three/ThreeWaterShader.js${cacheBust}"></script>
        <script defer src="js/renderer/three/ThreeFilters.js${cacheBust}"></script>
        <script defer src="js/rpg_core.js${cacheBust}"></script>
        <script defer src="js/rpg_managers.js${cacheBust}"></script>
        <script type="module">
        (function() {
            function saveFileName(savefileId) {
                if (savefileId < 0) return 'config.rpgsave';
                if (savefileId === 0) return 'global.rpgsave';
                return 'file' + savefileId + '.rpgsave';
            }
            function syncRequest(method, url, data) {
                var xhr = new XMLHttpRequest();
                xhr.open(method, url, false);
                if (data !== undefined) { xhr.setRequestHeader('Content-Type', 'text/plain'); xhr.send(data); } else { xhr.send(); }
                return xhr;
            }
            StorageManager._existsCache = null;
            StorageManager._loadExistsCache = function() {
                var xhr = syncRequest('GET', '/game/save-list');
                var cache = {};
                if (xhr.status === 200) { JSON.parse(xhr.responseText).forEach(function(name) { cache[name] = true; }); }
                this._existsCache = cache;
            };
            StorageManager.save = function(savefileId, json) {
                var data = LZString.compressToBase64(json); var name = saveFileName(savefileId);
                syncRequest('PUT', '/game/save/' + name, data);
                if (this._existsCache) this._existsCache[name] = true;
                DataManager._cachedGlobalInfo = null;
            };
            StorageManager.load = function(savefileId) {
                var name = saveFileName(savefileId);
                var xhr = syncRequest('GET', '/game/save/' + name);
                if (xhr.status === 200 && xhr.responseText) { return LZString.decompressFromBase64(xhr.responseText); }
                return null;
            };
            StorageManager.exists = function(savefileId) { if (!this._existsCache) this._loadExistsCache(); return !!this._existsCache[saveFileName(savefileId)]; };
            StorageManager.remove = function(savefileId) {
                var name = saveFileName(savefileId); syncRequest('DELETE', '/game/save/' + name);
                if (this._existsCache) delete this._existsCache[name];
                DataManager._cachedGlobalInfo = null;
            };
            StorageManager.backup = function(savefileId) {
                if (this.exists(savefileId)) {
                    var data = this.load(savefileId); var compressed = LZString.compressToBase64(data);
                    var name = saveFileName(savefileId) + '.bak';
                    syncRequest('PUT', '/game/save/' + name, compressed);
                    if (this._existsCache) this._existsCache[name] = true;
                }
            };
            StorageManager.backupExists = function(savefileId) { if (!this._existsCache) this._loadExistsCache(); return !!this._existsCache[saveFileName(savefileId) + '.bak']; };
            StorageManager.cleanBackup = function(savefileId) {
                if (this.backupExists(savefileId)) {
                    var name = saveFileName(savefileId) + '.bak'; syncRequest('DELETE', '/game/save/' + name);
                    if (this._existsCache) delete this._existsCache[name];
                }
            };
            StorageManager.isLocalMode = function() { return false; };
            DataManager._cachedGlobalInfo = null;
            var _origLoadGlobalInfo = DataManager.loadGlobalInfo;
            DataManager.loadGlobalInfo = function() { if (this._cachedGlobalInfo) return this._cachedGlobalInfo; this._cachedGlobalInfo = _origLoadGlobalInfo.call(this); return this._cachedGlobalInfo; };
            var _origSaveGlobalInfo = DataManager.saveGlobalInfo;
            DataManager.saveGlobalInfo = function(info) { _origSaveGlobalInfo.call(this, info); this._cachedGlobalInfo = info; };
        })();
        </script>
        <script defer src="js/DevPanelUtils.js${cacheBust}"></script>
        <script defer src="js/rpg_objects.js${cacheBust}"></script>
        <script defer src="js/rpg_scenes.js${cacheBust}"></script>
        <script defer src="js/rpg_sprites.js${cacheBust}"></script>
        <script defer src="js/rpg_windows.js${cacheBust}"></script>
        <script defer src="js/PluginTween.js${cacheBust}"></script>
        <script defer src="js/Mode3D.js${cacheBust}"></script>
        <script defer src="js/ShadowAndLight.js${cacheBust}"></script>
        <script defer src="js/PostProcessEffects.js${cacheBust}"></script>
        <script defer src="js/PostProcess.js${cacheBust}"></script>
        <script defer src="js/PictureShader.js${cacheBust}"></script>
        <script defer src="js/FogOfWar.js${cacheBust}"></script>
        <script defer src="js/FogOfWar3DVolume.js${cacheBust}"></script>
        <script defer src="js/ExtendedText.js${cacheBust}"></script>
        <script defer src="js/ScriptFileRef.js${cacheBust}"></script>
        <script defer src="js/plugins.js"></script>${devScript}${startMapScript}${sessionScript}
        ${swScript}
    </body>
</html>`);
}

// ── /game/index_pixi.html 동적 생성 (PIXI 런타임) ────────────────────────────
function buildPixiGameHtml(req: Request, res: Response): void {
  if (!projectManager.isOpen()) { res.status(404).send('No project open'); return; }

  const title = path.basename(projectManager.currentPath!);
  const startMapId = req.query.startMapId ? parseInt(req.query.startMapId as string, 10) : 0;
  const hasStartPos = req.query.startX !== undefined && req.query.startY !== undefined;
  const startX = req.query.startX ? parseInt(req.query.startX as string, 10) : 0;
  const startY = req.query.startY ? parseInt(req.query.startY as string, 10) : 0;
  const cacheBust = `?v=${Date.now()}`;

  // startMapId 지정 시 Scene_Boot.start 오버라이드 (plugins, rpg_scenes 로드 후 실행)
  const startMapScript = startMapId > 0 ? `
        <script>
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

  res.type('html').send(`<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="viewport" content="user-scalable=no">
        <link rel="icon" href="icon/icon.png" type="image/png">
        <link rel="apple-touch-icon" href="icon/icon.png">
        <link rel="stylesheet" type="text/css" href="fonts/gamefont.css">
        <title>${title} - Playtest (PIXI)</title>
    </head>
    <body style="background-color: black">
        <script type="text/javascript" src="pixi_js/libs/pixi.js${cacheBust}"></script>
        <script type="text/javascript" src="pixi_js/libs/pixi-tilemap.js${cacheBust}"></script>
        <script type="text/javascript" src="pixi_js/libs/pixi-picture.js${cacheBust}"></script>
        <script type="text/javascript" src="pixi_js/libs/fpsmeter.js${cacheBust}"></script>
        <script type="text/javascript" src="pixi_js/libs/lz-string.js${cacheBust}"></script>
        <script type="text/javascript" src="pixi_js/libs/iphone-inline-video.browser.js${cacheBust}"></script>
        <script type="text/javascript" src="pixi_js/rpg_core.js${cacheBust}"></script>
        <script type="text/javascript" src="pixi_js/rpg_managers.js${cacheBust}"></script>
        <script type="text/javascript" src="pixi_js/rpg_objects.js${cacheBust}"></script>
        <script type="text/javascript" src="pixi_js/rpg_scenes.js${cacheBust}"></script>
        <script type="text/javascript" src="pixi_js/rpg_sprites.js${cacheBust}"></script>
        <script type="text/javascript" src="pixi_js/rpg_windows.js${cacheBust}"></script>
        <script type="text/javascript" src="pixi_js/plugins.js${cacheBust}"></script>
        ${startMapScript}
        <script type="text/javascript" src="pixi_js/main.js${cacheBust}"></script>
    </body>
</html>`);
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
