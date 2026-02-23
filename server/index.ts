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
import bundleRoutes from './routes/bundles';

export interface AppOptions {
  runtimePath?: string;
  clientDistPath?: string;
}

// ── 인메모리 플레이테스트 세션 (DEMO_MODE용) ──────────────────────────────
interface PlaytestSession {
  mapId: number;
  mapData: Record<string, unknown>;
  expiresAt: number;
}
const playtestSessions = new Map<string, PlaytestSession>();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30분
const MAX_SESSIONS = 200;

function createPlaytestSession(mapId: number, mapData: Record<string, unknown>): string {
  // 만료 세션 정리
  const now = Date.now();
  for (const [token, session] of playtestSessions) {
    if (session.expiresAt < now) playtestSessions.delete(token);
  }
  // 최대 세션 초과 시 가장 오래된 것 제거
  if (playtestSessions.size >= MAX_SESSIONS) {
    const oldest = [...playtestSessions.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) playtestSessions.delete(oldest[0]);
  }
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  playtestSessions.set(token, { mapId, mapData, expiresAt: now + SESSION_TTL_MS });
  return token;
}

export function createApp(options: AppOptions = {}) {
  const DEMO_MODE = process.env.DEMO_MODE === 'true';
  const resolvedRuntimePath = options.runtimePath || path.join(__dirname, 'runtime');
  setRuntimePath(resolvedRuntimePath);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // /game/save/* - 게임 세이브 파일 저장/로드 API (config, global, save files)
  const validSaveFile = (name: string) => /^[\w.-]+\.rpgsave(\.bak)?$/.test(name);

  // save/ 폴더의 파일 목록 반환 (StorageManager.exists 배치 최적화용)
  app.get('/game/save-list', (req, res) => {
    if (!projectManager.isOpen()) return res.json([]);
    const saveDir = path.join(projectManager.currentPath!, 'save');
    if (!fs.existsSync(saveDir)) return res.json([]);
    const files = fs.readdirSync(saveDir).filter(f => validSaveFile(f));
    res.json(files);
  });

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
  app.get('/game/index.html', (req, res) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project open');

    const title = path.basename(projectManager.currentPath!);
    const isDev = req.query.dev === 'true';
    const startMapId = req.query.startMapId ? parseInt(req.query.startMapId as string, 10) : 0;
    const hasStartPos = req.query.startX !== undefined && req.query.startY !== undefined;
    const startX = req.query.startX ? parseInt(req.query.startX as string, 10) : 0;
    const startY = req.query.startY ? parseInt(req.query.startY as string, 10) : 0;
    const sessionToken = req.query.session as string | undefined;
    const devScript = isDev ? '\n        <script defer src="js/ThreeDevOverlay.js"></script>\n        <script defer src="js/CameraZoneDevOverlay.js"></script>\n        <script defer src="js/FogOfWarDevPanel.js"></script>\n        <script defer src="js/MemoryDevPanel.js"></script>\n        <script defer src="js/TileIdDevOverlay.js"></script>\n        <script defer src="js/DepthDebugPanel.js"></script>\n        <script defer src="js/RenderModeDevPanel.js"></script>' : '';
    const startMapScript = startMapId > 0 ? `
        <script type="module">
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
            // 5초 후에도 로딩 중이면 진단 로그 출력 (이후 매 5초마다 반복)
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
    const testSW = req.query.testsw === '1';
    const cacheBust = `?v=${Date.now()}`;
    // 프로젝트가 WebP 이미지를 사용하는지 감지
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

            // 파일 존재 여부 캐시: /game/save-list 한 번으로 일괄 로드
            StorageManager._existsCache = null;
            StorageManager._loadExistsCache = function() {
                var xhr = syncRequest('GET', '/game/save-list');
                var cache = {};
                if (xhr.status === 200) {
                    JSON.parse(xhr.responseText).forEach(function(name) { cache[name] = true; });
                }
                this._existsCache = cache;
            };

            StorageManager.save = function(savefileId, json) {
                var data = LZString.compressToBase64(json);
                var name = saveFileName(savefileId);
                syncRequest('PUT', '/game/save/' + name, data);
                if (this._existsCache) this._existsCache[name] = true;
                DataManager._cachedGlobalInfo = null;
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
                if (!this._existsCache) this._loadExistsCache();
                return !!this._existsCache[saveFileName(savefileId)];
            };

            StorageManager.remove = function(savefileId) {
                var name = saveFileName(savefileId);
                syncRequest('DELETE', '/game/save/' + name);
                if (this._existsCache) delete this._existsCache[name];
                DataManager._cachedGlobalInfo = null;
            };

            StorageManager.backup = function(savefileId) {
                if (this.exists(savefileId)) {
                    var data = this.load(savefileId);
                    var compressed = LZString.compressToBase64(data);
                    var name = saveFileName(savefileId) + '.bak';
                    syncRequest('PUT', '/game/save/' + name, compressed);
                    if (this._existsCache) this._existsCache[name] = true;
                }
            };

            StorageManager.backupExists = function(savefileId) {
                if (!this._existsCache) this._loadExistsCache();
                return !!this._existsCache[saveFileName(savefileId) + '.bak'];
            };

            StorageManager.cleanBackup = function(savefileId) {
                if (this.backupExists(savefileId)) {
                    var name = saveFileName(savefileId) + '.bak';
                    syncRequest('DELETE', '/game/save/' + name);
                    if (this._existsCache) delete this._existsCache[name];
                }
            };

            StorageManager.isLocalMode = function() {
                return false;
            };

            // DataManager.loadGlobalInfo 캐싱:
            // drawItem()이 슬롯마다 호출하므로 refresh 단위로 1회만 XHR 발생하도록 캐싱
            DataManager._cachedGlobalInfo = null;
            var _origLoadGlobalInfo = DataManager.loadGlobalInfo;
            DataManager.loadGlobalInfo = function() {
                if (this._cachedGlobalInfo) return this._cachedGlobalInfo;
                this._cachedGlobalInfo = _origLoadGlobalInfo.call(this);
                return this._cachedGlobalInfo;
            };
            var _origSaveGlobalInfo = DataManager.saveGlobalInfo;
            DataManager.saveGlobalInfo = function(info) {
                _origSaveGlobalInfo.call(this, info);
                this._cachedGlobalInfo = info;
            };
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
        <script defer src="js/plugins.js"></script>${devScript}${startMapScript}${sessionToken && startMapId > 0 ? `
        <script type="module">
        // 인메모리 세션에서 맵 데이터 로드 (DEMO_MODE 플레이테스트)
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
                        if (xhr.status < 400) {
                            window[name] = JSON.parse(xhr.responseText);
                            DataManager.onLoad(window[name]);
                        }
                    };
                    window[name] = null;
                    xhr.send();
                    return;
                }
                _orig(name, src);
            };

            // 데모 모드: 이미지 로딩 실패 시 게임 중단 방지
            // 누락된 에셋(animations 등)이 있어도 플레이 가능하도록
            var _origCreateLoader = ResourceHandler.createLoader.bind(ResourceHandler);
            ResourceHandler.createLoader = function(url, retryMethod, resignMethod, retryInterval) {
                if (url && /\\.(png|jpg|jpeg|gif|webp)(\\?|$)/i.test(url)) {
                    // 이미지 파일: 재시도 후 실패해도 SceneManager.stop() 하지 않음
                    var retryArr = retryInterval || ResourceHandler._defaultRetryInterval;
                    var retryCount = 0;
                    return function() {
                        if (retryCount < retryArr.length) {
                            setTimeout(retryMethod, retryArr[retryCount]);
                            retryCount++;
                        } else {
                            if (resignMethod) resignMethod(); // 에러 상태로 설정
                            // Graphics.printLoadingError / SceneManager.stop() 생략
                        }
                    };
                }
                return _origCreateLoader(url, retryMethod, resignMethod, retryInterval);
            };

            // 에러 상태 비트맵이 ImageCache.isReady()를 영원히 막지 않도록 패치
            var _origCacheIsReady = ImageCache.prototype.isReady;
            ImageCache.prototype.isReady = function() {
                var items = this._items;
                return !Object.keys(items).some(function(key) {
                    var bitmap = items[key].bitmap;
                    // 에러 비트맵은 로딩 완료로 간주 (없는 에셋 무시)
                    if (bitmap.isError()) return false;
                    return !bitmap.isRequestOnly() && !bitmap.isReady();
                });
            };
        })();
        </script>` : ''}
        ${testSW ? `<script>
        // ── SW 번들 테스트 모드 (?testsw=1) ──────────────────────────────────
        (function() {
            var mainSrc = 'js/main.js${cacheBust}';
            var mainLoaded = false;
            function loadMain() {
                if (mainLoaded) return; mainLoaded = true;
                removeOverlay();
                var s = document.createElement('script'); s.src = mainSrc;
                document.body.appendChild(s);
            }
            var overlay = null;
            function createOverlay() {
                overlay = document.createElement('div');
                overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;color:#ccc';
                overlay.innerHTML = '<div style="font-size:15px;margin-bottom:20px">[SW 번들 테스트] 리소스 다운로드 중...</div><div style="width:360px;background:#222;border-radius:4px;overflow:hidden;height:8px"><div id="sw-bar" style="height:8px;width:0%;background:#2c6fc7;transition:width 0.15s"></div></div><div id="sw-txt" style="font-size:12px;margin-top:10px;color:#888"></div>';
                document.body.appendChild(overlay);
            }
            function removeOverlay() { if (overlay) { overlay.remove(); overlay = null; } }
            function setProgress(loaded, total) {
                if (!overlay) return;
                var pct = total > 0 ? Math.round(loaded / total * 100) : 0;
                document.getElementById('sw-bar').style.width = pct + '%';
                document.getElementById('sw-txt').textContent = loaded + ' / ' + total + ' (' + pct + '%)';
            }
            if (!('serviceWorker' in navigator)) { loadMain(); return; }
            navigator.serviceWorker.addEventListener('message', function(e) {
                var msg = e.data; if (!msg) return;
                console.log('[SW]', msg.type, msg);
                if (msg.type === 'bundle-progress') setProgress(msg.loadedFiles, msg.totalFiles);
                else if (msg.type === 'bundle-ready' || msg.type === 'bundle-skip' || msg.type === 'bundle-error') loadMain();
            });
            var fallback = setTimeout(function() { console.warn('[SW] fallback timeout'); loadMain(); }, 60000);
            createOverlay();
            navigator.serviceWorker.register('sw.js', { scope: './' })
                .then(function(reg) {
                    console.log('[SW] registered, active:', reg.active?.state, 'installing:', reg.installing?.state);
                    if (reg.active && !reg.installing && !reg.waiting) { clearTimeout(fallback); loadMain(); }
                })
                .catch(function(err) { console.warn('[SW] 등록 실패:', err); clearTimeout(fallback); loadMain(); });
        })();
        </script>` : `<script defer src="js/main.js${cacheBust}"></script>`}
    </body>
</html>`;
    res.type('html').send(html);
  });

  // /game/js/* - 런타임 JS 코드 (내장)
  app.use('/game/js/plugins', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    express.static(path.join(projectManager.currentPath!, 'js', 'plugins'))(req, res, next);
  });
  app.get('/game/js/plugins.js', (req, res) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    res.sendFile(path.join(projectManager.currentPath!, 'js', 'plugins.js'));
  });
  app.use('/game/js', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }, express.static(path.join(resolvedRuntimePath, 'js')));

  // /runtime - 에디터 클라이언트용 런타임 JS 서빙 (client/public/runtime/ 심볼릭 링크 대체)
  app.use('/runtime', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }, express.static(path.join(resolvedRuntimePath, 'js')));

  // /game/fonts, /game/icon - 내장 런타임
  app.use('/game/fonts', express.static(path.join(resolvedRuntimePath, 'fonts')));
  app.use('/game/icon', express.static(path.join(resolvedRuntimePath, 'icon')));

  // /game/sw.js - ServiceWorker
  app.get('/game/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(resolvedRuntimePath, 'sw.js'));
  });

  // /game/bundles/* - 리소스 번들 manifest API
  app.use('/game/bundles', bundleRoutes);

  // /game/data - 맵 파일은 ext 병합, Test_ prefix는 원본으로 리다이렉트, 나머지는 정적 서빙
  const mapFilePattern = /^\/Map(\d{3})\.json$/;
  const testPrefixPattern = /^\/Test_(.+)$/;
  app.use('/game/data', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    res.set('Cache-Control', 'no-store');
    // 전투 테스트: Test_ prefix 파일 요청을 원본 파일로 리다이렉트
    const urlPath = req.url.split('?')[0];
    const testMatch = urlPath.match(testPrefixPattern);
    if (testMatch) {
      req.url = req.url.replace(/\/Test_/, '/');
    }
    const effectivePath = req.url.split('?')[0];
    const match = effectivePath.match(mapFilePattern);
    if (match) {
      // 인메모리 세션 우선 조회 (DEMO_MODE 플레이테스트)
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
    // express.static이 파일을 찾지 못하면 next()를 호출하는데,
    // 이후 catch-all 핸들러가 /game/ 경로에 응답하지 않아 XHR이 무한 대기함.
    // (_mapExtLoaded가 영원히 false → Now Loading 무한 대기 버그)
    // → 파일 없을 때 명시적으로 404 반환
    express.static(path.join(projectManager.currentPath!, 'data'))(req, res, () => {
      if (!res.headersSent) res.status(404).send('Not found');
    });
  });
  app.use('/game/img', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    res.set('Cache-Control', 'no-store');
    const imgDir = path.join(projectManager.currentPath!, 'img');
    // PNG ↔ WebP 폴백: 요청된 파일 없으면 대체 확장자 시도
    const ext = path.extname(req.path).toLowerCase();
    if (ext === '.png' || ext === '.webp') {
      const altExt = ext === '.png' ? '.webp' : '.png';
      const reqFile = path.join(imgDir, req.path);
      if (!fs.existsSync(reqFile) && fs.existsSync(reqFile.slice(0, -ext.length) + altExt)) {
        req.url = req.url.slice(0, -ext.length) + altExt;
      }
    }
    express.static(imgDir)(req, res, () => {
      if (!res.headersSent) res.status(404).send('Not found');
    });
  });
  app.use('/game/audio', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    express.static(path.join(projectManager.currentPath!, 'audio'))(req, res, () => {
      if (!res.headersSent) res.status(404).send('Not found');
    });
  });
  app.use('/game/movies', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    const moviesDir = path.join(projectManager.currentPath!, 'movies');
    // .webm/.mp4 폴백: 요청된 확장자 파일이 없으면 다른 확장자로 시도
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

  // 에디터 런타임용: 프로젝트 img/, data/, plugins/ 직접 서빙
  app.use('/img', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    res.set('Cache-Control', 'no-store');
    const imgDir = path.join(projectManager.currentPath!, 'img');
    // PNG ↔ WebP 폴백
    const ext = path.extname(req.path).toLowerCase();
    if (ext === '.png' || ext === '.webp') {
      const altExt = ext === '.png' ? '.webp' : '.png';
      const reqFile = path.join(imgDir, req.path);
      if (!fs.existsSync(reqFile) && fs.existsSync(reqFile.slice(0, -ext.length) + altExt)) {
        req.url = req.url.slice(0, -ext.length) + altExt;
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
  app.use('/audio', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    express.static(path.join(projectManager.currentPath!, 'audio'))(req, res, next);
  });
  app.use('/plugins', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
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
