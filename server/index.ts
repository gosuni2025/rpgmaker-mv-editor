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
        #info { position:fixed; top:10px; left:10px; color:#0f0; font:12px monospace; z-index:9999; background:rgba(0,0,0,0.7); padding:8px; border-radius:4px; pointer-events:none; }
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

        fetch('/game/data/' + mapFile).then(function(r) { return r.json(); }).then(function(mapData) {
            var fow = mapData.fogOfWar || {};
            var fogMode = fow.fogMode || '2d';
            var mapW = mapData.width;
            var mapH = mapData.height;
            var tileSize = 48;
            var totalW = mapW * tileSize;
            var totalH = mapH * tileSize;

            // Three.js 렌더러
            window._testRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            var renderer = window._testRenderer;
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setClearColor(0x1a2a3a, 1);
            document.body.appendChild(renderer.domElement);

            window._testScene = new THREE.Scene();
            var scene = window._testScene;

            // PerspectiveCamera
            window._testCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
            var camera = window._testCamera;

            // 바닥
            var floorMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(totalW, totalH),
                new THREE.MeshBasicMaterial({ color: 0x2a4a2a, side: THREE.DoubleSide })
            );
            floorMesh.position.set(totalW / 2, totalH / 2, -1);
            scene.add(floorMesh);

            // 격자선
            var gridMat = new THREE.LineBasicMaterial({ color: 0x3a5a3a });
            for (var x = 0; x <= mapW; x++) {
                scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(x * tileSize, 0, 0), new THREE.Vector3(x * tileSize, totalH, 0)
                ]), gridMat));
            }
            for (var y = 0; y <= mapH; y++) {
                scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(0, y * tileSize, 0), new THREE.Vector3(totalW, y * tileSize, 0)
                ]), gridMat));
            }

            // FogOfWar 초기화
            FogOfWar.setup(mapW, mapH, fow);

            var playerX = Math.floor(mapW / 2);
            var playerY = Math.floor(mapH / 2);
            fetch('/game/data/System.json').then(function(r) { return r.json(); }).then(function(sys) {
                playerX = sys.startX || playerX;
                playerY = sys.startY || playerY;
            }).catch(function() {}).finally(function() {
                FogOfWar._prevPlayerX = -1;
                FogOfWar._prevPlayerY = -1;
                FogOfWar.updateVisibilityAt(playerX, playerY);
                FogOfWar._syncDisplay();
                FogOfWar._updateTexture();

                // 플레이어 마커
                var marker = new THREE.Mesh(
                    new THREE.CircleGeometry(tileSize * 0.3, 16),
                    new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
                );
                marker.position.set((playerX + 0.5) * tileSize, (playerY + 0.5) * tileSize, 2);
                scene.add(marker);

                // FOW 메쉬 생성
                if (fogMode === '3dbox') {
                    var mesh = FogOfWar3D._createMesh(mapW, mapH, fow);
                    if (mesh) scene.add(mesh);
                } else {
                    var group = FogOfWar._createMesh();
                    if (group) { group.position.set(totalW / 2, totalH / 2, 0); scene.add(group); }
                }

                function updateInfo() {
                    info.textContent = 'fogMode=' + fogMode + ' | ' + mapW + 'x' + mapH
                        + ' | pos=(' + playerX + ',' + playerY + ') | WASD/방향키:이동 더블클릭:텔레포트';
                }
                updateInfo();

                // --- orbit 카메라 ---
                var orbitCenter = new THREE.Vector3((playerX + 0.5) * tileSize, (playerY + 0.5) * tileSize, 0);
                var spherical = { theta: 0, phi: Math.PI / 5 };
                var distance = 600;
                var isDragging = false, dragButton = -1;
                var lastMouse = { x: 0, y: 0 };

                function updateCamera() {
                    camera.position.set(
                        orbitCenter.x + distance * Math.sin(spherical.phi) * Math.cos(spherical.theta),
                        orbitCenter.y + distance * Math.sin(spherical.phi) * Math.sin(spherical.theta),
                        orbitCenter.z + distance * Math.cos(spherical.phi)
                    );
                    camera.lookAt(orbitCenter);
                }
                updateCamera();

                renderer.domElement.addEventListener('mousedown', function(e) {
                    isDragging = true; dragButton = e.button;
                    lastMouse.x = e.clientX; lastMouse.y = e.clientY;
                });
                window.addEventListener('mouseup', function() { isDragging = false; dragButton = -1; });
                window.addEventListener('mousemove', function(e) {
                    if (!isDragging) return;
                    var dx = e.clientX - lastMouse.x, dy = e.clientY - lastMouse.y;
                    lastMouse.x = e.clientX; lastMouse.y = e.clientY;
                    if (dragButton === 0) {
                        spherical.theta -= dx * 0.005;
                        spherical.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.01, spherical.phi - dy * 0.005));
                    } else if (dragButton === 2) {
                        var right = new THREE.Vector3(), up = new THREE.Vector3();
                        camera.getWorldDirection(up);
                        right.crossVectors(up, camera.up).normalize();
                        up.crossVectors(right, up).normalize();
                        var s = distance * 0.002;
                        orbitCenter.add(right.multiplyScalar(-dx * s));
                        orbitCenter.add(up.multiplyScalar(dy * s));
                    }
                    updateCamera();
                });
                renderer.domElement.addEventListener('wheel', function(e) {
                    distance = Math.max(50, Math.min(10000, distance * (1 + e.deltaY * 0.001)));
                    updateCamera();
                });
                renderer.domElement.addEventListener('contextmenu', function(e) { e.preventDefault(); });

                // --- 더블클릭: 텔레포트 ---
                renderer.domElement.addEventListener('dblclick', function(e) {
                    var rect = renderer.domElement.getBoundingClientRect();
                    var mouse = new THREE.Vector2(
                        ((e.clientX - rect.left) / rect.width) * 2 - 1,
                        -((e.clientY - rect.top) / rect.height) * 2 + 1
                    );
                    var rc = new THREE.Raycaster();
                    rc.setFromCamera(mouse, camera);
                    var pt = new THREE.Vector3();
                    if (rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1), 0), pt)) {
                        var nx = Math.floor(pt.x / tileSize), ny = Math.floor(pt.y / tileSize);
                        if (nx >= 0 && nx < mapW && ny >= 0 && ny < mapH) {
                            playerX = nx; playerY = ny;
                            FogOfWar.updateVisibilityAt(playerX, playerY);
                            marker.position.set((playerX + 0.5) * tileSize, (playerY + 0.5) * tileSize, 2);
                            updateInfo();
                        }
                    }
                });

                // --- WASD / 방향키 이동 ---
                window.addEventListener('keydown', function(e) {
                    var moved = false;
                    if (e.key === 'w' || e.key === 'ArrowUp')    { playerY = Math.max(0, playerY - 1); moved = true; }
                    if (e.key === 's' || e.key === 'ArrowDown')  { playerY = Math.min(mapH - 1, playerY + 1); moved = true; }
                    if (e.key === 'a' || e.key === 'ArrowLeft')  { playerX = Math.max(0, playerX - 1); moved = true; }
                    if (e.key === 'd' || e.key === 'ArrowRight') { playerX = Math.min(mapW - 1, playerX + 1); moved = true; }
                    if (moved) {
                        FogOfWar.updateVisibilityAt(playerX, playerY);
                        marker.position.set((playerX + 0.5) * tileSize, (playerY + 0.5) * tileSize, 2);
                        updateInfo();
                    }
                });

                // --- 렌더 루프 ---
                var lastFrameTime = performance.now();
                function animate() {
                    requestAnimationFrame(animate);
                    var now = performance.now();
                    var dt = Math.min((now - lastFrameTime) / 1000, 0.1);
                    lastFrameTime = now;

                    // FogOfWar 시간 업데이트 (lerpDisplay + edgeData + texture)
                    if (FogOfWar._active && FogOfWar._lerpDisplay) {
                        FogOfWar._lerpDisplay(dt);
                        FogOfWar._computeEdgeData(dt);
                        FogOfWar._updateTexture();
                    }

                    if (FogOfWar3D._active) FogOfWar3D._updateUniforms(dt);

                    if (FogOfWar._fogGroup) {
                        FogOfWar._time += dt;
                        var fc = FogOfWar._fogGroup.children[0];
                        if (fc && fc.material && fc.material.uniforms) fc.material.uniforms.uTime.value = FogOfWar._time;
                    }

                    renderer.render(scene, camera);
                }
                animate();

                // resize
                window.addEventListener('resize', function() {
                    camera.aspect = window.innerWidth / window.innerHeight;
                    camera.updateProjectionMatrix();
                    renderer.setSize(window.innerWidth, window.innerHeight);
                });
            });
        }).catch(function(err) {
            info.textContent = 'ERROR: ' + err.message;
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
  app.use('/audio', (req, res, next) => {
    if (!projectManager.isOpen()) return res.status(404).send('No project');
    express.static(path.join(projectManager.currentPath!, 'audio'))(req, res, next);
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
