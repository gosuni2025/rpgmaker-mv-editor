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
import settingsRoutes from './routes/settings';

export interface AppOptions {
  runtimePath?: string;
  clientDistPath?: string;
}

export function createApp(options: AppOptions = {}) {
  const resolvedRuntimePath = options.runtimePath || path.join(__dirname, 'runtime');

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

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

  // /game/fogtest.html - FogOfWar3D 격리 테스트 씬
  app.get('/game/fogtest.html', (req, res) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project open');
    const mapId = req.query.map ? parseInt(req.query.map as string, 10) : 1;
    const mapStr = String(mapId).padStart(3, '0');
    const cacheBust = `?v=${Date.now()}`;
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>FogOfWar3D Test - Map${mapStr}</title>
    <style>
        body { margin:0; background:#000; overflow:hidden; }
        #info { position:fixed; top:10px; left:10px; color:#0f0; font:12px monospace; z-index:9999; background:rgba(0,0,0,0.7); padding:8px; border-radius:4px; }
    </style>
</head>
<body>
    <div id="info">Loading...</div>
    <script src="js/libs/three.min.js"></script>
    <script src="js/renderer/RendererFactory.js${cacheBust}"></script>
    <script src="js/renderer/RendererStrategy.js${cacheBust}"></script>
    <script src="js/renderer/three/ThreeRendererFactory.js${cacheBust}"></script>
    <script src="js/renderer/three/ThreeRendererStrategy.js${cacheBust}"></script>
    <script src="js/renderer/three/ThreeContainer.js${cacheBust}"></script>
    <script src="js/renderer/three/ThreeSprite.js${cacheBust}"></script>
    <script src="js/renderer/three/ThreeGraphicsNode.js${cacheBust}"></script>
    <script src="js/renderer/three/ThreeTilemap.js${cacheBust}"></script>
    <script src="js/renderer/three/ThreeWaterShader.js${cacheBust}"></script>
    <script src="js/renderer/three/ThreeFilters.js${cacheBust}"></script>
    <script src="js/rpg_core.js${cacheBust}"></script>
    <script src="js/rpg_managers.js${cacheBust}"></script>
    <script src="js/rpg_objects.js${cacheBust}"></script>
    <script src="js/rpg_scenes.js${cacheBust}"></script>
    <script src="js/rpg_sprites.js${cacheBust}"></script>
    <script src="js/rpg_windows.js${cacheBust}"></script>
    <script src="js/Mode3D.js${cacheBust}"></script>
    <script src="js/ShadowAndLight.js${cacheBust}"></script>
    <script src="js/PostProcessEffects.js${cacheBust}"></script>
    <script src="js/PostProcess.js${cacheBust}"></script>
    <script src="js/PictureShader.js${cacheBust}"></script>
    <script src="js/FogOfWar.js${cacheBust}"></script>
    <script src="js/FogOfWar3D.js${cacheBust}"></script>
    <script src="js/DevPanelUtils.js${cacheBust}"></script>
    <script src="js/FogOfWarDevPanel.js${cacheBust}"></script>
    <script>
    (function() {
        var info = document.getElementById('info');
        var mapId = ${mapId};
        var mapFile = 'Map' + String(mapId).padStart(3, '0') + '.json';

        info.textContent = 'Fetching ' + mapFile + '...';

        // 맵 데이터 로드
        fetch('/game/data/' + mapFile).then(function(r) { return r.json(); }).then(function(mapData) {
            info.textContent = 'Map loaded: ' + mapData.width + 'x' + mapData.height;

            var fow = mapData.fogOfWar || {};
            var fogMode = fow.fogMode || '2d';
            var mapW = mapData.width;
            var mapH = mapData.height;
            var tileSize = 48;
            var totalW = mapW * tileSize;
            var totalH = mapH * tileSize;

            // Three.js 렌더러 생성
            var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setClearColor(0x222222, 1);
            document.body.appendChild(renderer.domElement);

            var scene = new THREE.Scene();

            // 카메라: PerspectiveCamera (3D 박스를 확인하기 위해)
            var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
            camera.position.set(totalW / 2, totalH / 2, Math.max(totalW, totalH) * 1.2);
            camera.lookAt(totalW / 2, totalH / 2, 0);

            // 바닥 그리드 (맵 영역 시각화)
            var gridGeo = new THREE.PlaneGeometry(totalW, totalH);
            var gridMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
            var gridMesh = new THREE.Mesh(gridGeo, gridMat);
            gridMesh.position.set(totalW / 2, totalH / 2, -1);
            scene.add(gridMesh);

            // 타일 격자선
            var gridLineMat = new THREE.LineBasicMaterial({ color: 0x444444 });
            for (var x = 0; x <= mapW; x++) {
                var pts = [new THREE.Vector3(x * tileSize, 0, 0), new THREE.Vector3(x * tileSize, totalH, 0)];
                var geo = new THREE.BufferGeometry().setFromPoints(pts);
                scene.add(new THREE.Line(geo, gridLineMat));
            }
            for (var y = 0; y <= mapH; y++) {
                var pts = [new THREE.Vector3(0, y * tileSize, 0), new THREE.Vector3(totalW, y * tileSize, 0)];
                var geo = new THREE.BufferGeometry().setFromPoints(pts);
                scene.add(new THREE.Line(geo, gridLineMat));
            }

            // FogOfWar 가시성 데이터 초기화
            FogOfWar.setup(mapW, mapH, fow);

            // 시작 위치 기준 가시성 계산
            var startX = Math.floor(mapW / 2);
            var startY = Math.floor(mapH / 2);
            fetch('/game/data/System.json').then(function(r) { return r.json(); }).then(function(sys) {
                startX = sys.startX || startX;
                startY = sys.startY || startY;
            }).catch(function() {}).finally(function() {
                FogOfWar._prevPlayerX = -1;
                FogOfWar._prevPlayerY = -1;
                FogOfWar.updateVisibilityAt(startX, startY);
                FogOfWar._syncDisplay();
                FogOfWar._updateTexture();

                info.textContent = 'fogMode=' + fogMode + ' | map=' + mapW + 'x' + mapH + ' | start=(' + startX + ',' + startY + ')';

                // 시작 위치 마커
                var markerGeo = new THREE.CircleGeometry(tileSize * 0.3, 16);
                var markerMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
                var marker = new THREE.Mesh(markerGeo, markerMat);
                marker.position.set((startX + 0.5) * tileSize, (startY + 0.5) * tileSize, 2);
                scene.add(marker);

                // 3D 박스 FOW 메쉬 생성
                if (fogMode === '3dbox') {
                    var mesh = FogOfWar3D._createMesh(mapW, mapH, fow);
                    if (mesh) {
                        scene.add(mesh);
                        info.textContent += ' | 3D Box mesh created (' + (mapW * mapH) + ' instances)';
                    } else {
                        info.textContent += ' | ERROR: FogOfWar3D._createMesh returned null';
                    }
                } else if (fogMode === 'volumetric' || fogMode === '2d' || fogMode === '') {
                    var group = FogOfWar._createMesh();
                    if (group) {
                        group.position.set(totalW / 2, totalH / 2, 0);
                        scene.add(group);
                        info.textContent += ' | Volumetric mesh created';
                    }
                }

                // 마우스 회전 컨트롤
                var isDragging = false;
                var lastMouse = { x: 0, y: 0 };
                var spherical = { theta: 0, phi: Math.PI / 4 };
                var distance = camera.position.distanceTo(new THREE.Vector3(totalW / 2, totalH / 2, 0));
                var center = new THREE.Vector3(totalW / 2, totalH / 2, 0);

                function updateCamera() {
                    var x = distance * Math.sin(spherical.phi) * Math.cos(spherical.theta);
                    var y = distance * Math.sin(spherical.phi) * Math.sin(spherical.theta);
                    var z = distance * Math.cos(spherical.phi);
                    camera.position.set(center.x + x, center.y + y, center.z + z);
                    camera.lookAt(center);
                }

                renderer.domElement.addEventListener('mousedown', function(e) {
                    isDragging = true;
                    lastMouse.x = e.clientX;
                    lastMouse.y = e.clientY;
                });
                window.addEventListener('mouseup', function() { isDragging = false; });
                window.addEventListener('mousemove', function(e) {
                    if (!isDragging) return;
                    var dx = e.clientX - lastMouse.x;
                    var dy = e.clientY - lastMouse.y;
                    spherical.theta -= dx * 0.005;
                    spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.01, spherical.phi - dy * 0.005));
                    lastMouse.x = e.clientX;
                    lastMouse.y = e.clientY;
                    updateCamera();
                });
                renderer.domElement.addEventListener('wheel', function(e) {
                    distance = Math.max(100, Math.min(10000, distance + e.deltaY * 2));
                    updateCamera();
                });
                updateCamera();

                // 렌더 루프
                function animate() {
                    requestAnimationFrame(animate);
                    if (FogOfWar3D._active) {
                        FogOfWar3D._updateUniforms(1.0 / 60.0);
                    }
                    if (FogOfWar._fogGroup) {
                        FogOfWar._time += 1.0 / 60.0;
                        var fogMeshChild = FogOfWar._fogGroup.children[0];
                        if (fogMeshChild && fogMeshChild.material && fogMeshChild.material.uniforms) {
                            fogMeshChild.material.uniforms.uTime.value = FogOfWar._time;
                        }
                    }
                    renderer.render(scene, camera);
                }
                animate();
            });
        }).catch(function(err) {
            info.textContent = 'ERROR: ' + err.message;
        });

        window.addEventListener('resize', function() {
            // resize는 렌더러 생성 후에만
        });
    })();
    </script>
</body>
</html>`;
    res.type('html').send(html);
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
    const devScript = isDev ? '\n        <script type="text/javascript" src="js/ThreeDevOverlay.js"></script>\n        <script type="text/javascript" src="js/CameraZoneDevOverlay.js"></script>\n        <script type="text/javascript" src="js/FogOfWarDevPanel.js"></script>' : '';
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
    const cacheBust = `?v=${Date.now()}`;
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
        <script type="text/javascript" src="js/renderer/RendererFactory.js${cacheBust}"></script>
        <script type="text/javascript" src="js/renderer/RendererStrategy.js${cacheBust}"></script>
        <script type="text/javascript" src="js/renderer/three/ThreeRendererFactory.js${cacheBust}"></script>
        <script type="text/javascript" src="js/renderer/three/ThreeRendererStrategy.js${cacheBust}"></script>
        <script type="text/javascript" src="js/renderer/three/ThreeContainer.js${cacheBust}"></script>
        <script type="text/javascript" src="js/renderer/three/ThreeSprite.js${cacheBust}"></script>
        <script type="text/javascript" src="js/renderer/three/ThreeGraphicsNode.js${cacheBust}"></script>
        <script type="text/javascript" src="js/renderer/three/ThreeTilemap.js${cacheBust}"></script>
        <script type="text/javascript" src="js/renderer/three/ThreeWaterShader.js${cacheBust}"></script>
        <script type="text/javascript" src="js/renderer/three/ThreeFilters.js${cacheBust}"></script>
        <script type="text/javascript" src="js/rpg_core.js${cacheBust}"></script>
        <script type="text/javascript" src="js/rpg_managers.js${cacheBust}"></script>
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
        <script type="text/javascript" src="js/DevPanelUtils.js${cacheBust}"></script>
        <script type="text/javascript" src="js/rpg_objects.js${cacheBust}"></script>
        <script type="text/javascript" src="js/rpg_scenes.js${cacheBust}"></script>
        <script type="text/javascript" src="js/rpg_sprites.js${cacheBust}"></script>
        <script type="text/javascript" src="js/rpg_windows.js${cacheBust}"></script>
        <script type="text/javascript" src="js/Mode3D.js${cacheBust}"></script>
        <script type="text/javascript" src="js/ShadowAndLight.js${cacheBust}"></script>
        <script type="text/javascript" src="js/PostProcessEffects.js${cacheBust}"></script>
        <script type="text/javascript" src="js/PostProcess.js${cacheBust}"></script>
        <script type="text/javascript" src="js/PictureShader.js${cacheBust}"></script>
        <script type="text/javascript" src="js/FogOfWar.js${cacheBust}"></script>
        <script type="text/javascript" src="js/FogOfWar3D.js${cacheBust}"></script>
        <script type="text/javascript" src="js/plugins.js"></script>${devScript}${startMapScript}
        <script type="text/javascript" src="js/main.js${cacheBust}"></script>
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

  // /game/fonts, /game/icon - 내장 런타임
  app.use('/game/fonts', express.static(path.join(resolvedRuntimePath, 'fonts')));
  app.use('/game/icon', express.static(path.join(resolvedRuntimePath, 'icon')));

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
  app.use('/api/settings', settingsRoutes);

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

  return app;
}

export function attachWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws: WebSocket) => {
    fileWatcher.addClient(ws);
  });
  return wss;
}

// dev 모드 직접 실행 시
if (require.main === module) {
  const app = createApp();
  const server = http.createServer(app);
  attachWebSocket(server);

  const PORT = 3001;
  server.listen(PORT, () => {
    console.log(`Editor server listening on port ${PORT}`);
  });
}
