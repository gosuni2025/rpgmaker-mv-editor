import fs from 'fs';
import path from 'path';
import express from 'express';
import projectManager from '../services/projectManager';

const router = express.Router();

/** UI 에디터 config 파일 경로 */
function getConfigPath(): string | null {
  if (!projectManager.isOpen()) return null;
  return path.join(projectManager.currentPath!, 'data', 'UIEditorConfig.json');
}

/** GET /api/ui-editor/preview — iframe 내에서 게임 런타임을 구동하는 HTML */
router.get('/preview', (req, res) => {
  if (!projectManager.isOpen()) {
    return res.status(404).send('<h2>프로젝트가 열려있지 않습니다</h2>');
  }

  const cb = `?v=${Date.now()}`;

  // WebP 감지 (game.ts와 동일)
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

  // 핵심: <base href="/game/"> 로 상대 경로를 /game/로 해석하게 함
  // PluginManager.makeUrl → js/plugins/SkyBox.js → /game/js/plugins/SkyBox.js ✓
  // DataManager → data/System.json → /game/data/System.json ✓
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="viewport" content="user-scalable=no">
    <base href="/game/">
    <link rel="stylesheet" type="text/css" href="fonts/gamefont.css">
    <title>UI Editor Preview</title>
    <style>body { margin: 0; background: black; overflow: hidden; }</style>
    <script>window.__CACHE_BUST__={webp:${useWebp}};</script>
  </head>
  <body>
    <script src="js/libs/three.global.min.js"></script>
    <script defer src="js/libs/fpsmeter.js"></script>
    <script defer src="js/libs/lz-string.js"></script>
    <script defer src="js/libs/iphone-inline-video.browser.js"></script>
    <script defer src="js/renderer/RendererFactory.js${cb}"></script>
    <script defer src="js/renderer/RendererStrategy.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeRendererFactory.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeRendererStrategy.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeContainer.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeSprite.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeGraphicsNode.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeTilemap.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeWaterShader.js${cb}"></script>
    <script defer src="js/renderer/three/ThreeFilters.js${cb}"></script>
    <script defer src="js/rpg_core.js${cb}"></script>
    <script defer src="js/rpg_managers.js${cb}"></script>
    <script type="module">
    // StorageManager: no-op (UI 에디터는 저장 불필요)
    (function() {
      function noop() {}
      StorageManager.save = noop;
      StorageManager.load = function() { return null; };
      StorageManager.exists = function() { return false; };
      StorageManager.isLocalMode = function() { return false; };
      // 오디오 억제
      AudioManager.playBgm = noop;
      AudioManager.playBgs = noop;
      AudioManager.playMe = noop;
      AudioManager.playSe = noop;
      AudioManager.stopAll = noop;
    })();
    </script>
    <script defer src="js/DevPanelUtils.js${cb}"></script>
    <script defer src="js/rpg_objects.js${cb}"></script>
    <script defer src="js/rpg_scenes.js${cb}"></script>
    <script defer src="js/rpg_sprites.js${cb}"></script>
    <script defer src="js/rpg_windows.js${cb}"></script>
    <script defer src="js/PluginTween.js${cb}"></script>
    <script defer src="js/Mode3D.js${cb}"></script>
    <script defer src="js/ShadowAndLight.js${cb}"></script>
    <script defer src="js/PostProcessEffects.js${cb}"></script>
    <script defer src="js/PostProcess.js${cb}"></script>
    <script defer src="js/PictureShader.js${cb}"></script>
    <script defer src="js/FogOfWar.js${cb}"></script>
    <script defer src="js/FogOfWar3DVolume.js${cb}"></script>
    <script defer src="js/ExtendedText.js${cb}"></script>
    <script defer src="js/plugins.js"></script>
    <script type="module">
    // UI 에디터 브릿지 + Scene_Boot 오버라이드
    (function() {
      // URL params에서 초기 씬 결정 (새 탭 standalone 지원)
      var _urlParams = new URLSearchParams(window.location.search);
      var _targetScene = _urlParams.get('scene') || 'Scene_Options';

      // Scene_Boot: 타이틀 스킵 후 대상 씬으로
      Scene_Boot.prototype.start = function() {
        Scene_Base.prototype.start.call(this);
        SoundManager.preloadImportantSounds();
        DataManager.setupNewGame();
        var SceneCtor = window[_targetScene] || window.Scene_Options;
        SceneManager.goto(SceneCtor);
        this.updateDocumentTitle();
      };

      // 씬 변경 감지용
      var _prevScene = null;

      // ── 요소 캡처: Window 내부 draw 메서드 계측 ─────────────────────────
      var PER_ACTOR_WINDOWS = { 'Window_BattleStatus': true, 'Window_MenuStatus': true };

      // drawActorFace(actor, faceName, faceIndex, x, y, width, height) → argX=3
      // drawActorName/Class/Nickname(actor, x, y, width)               → argX=1
      // drawActorLevel/Icons/Hp/Mp/Tp(actor, x, y, width?)             → argX=1
      // drawSimpleStatus(actor, x, y, width)                           → argX=1
      var ELEM_SPECS = [
        { method:'drawActorName',     type:'actorName',     label:'이름',        argX:1, argY:2, argW:3, argH:null },
        { method:'drawActorClass',    type:'actorClass',    label:'직업',        argX:1, argY:2, argW:3, argH:null },
        { method:'drawActorNickname', type:'actorNickname', label:'별명',        argX:1, argY:2, argW:3, argH:null },
        { method:'drawActorFace',     type:'actorFace',     label:'페이스',      argX:3, argY:4, argW:5, argH:6   },
        { method:'drawActorLevel',    type:'actorLevel',    label:'레벨',        argX:1, argY:2, argW:null, argH:null },
        { method:'drawActorIcons',    type:'actorIcons',    label:'상태 아이콘', argX:1, argY:2, argW:3, argH:null },
        { method:'drawActorHp',       type:'actorHp',       label:'HP',          argX:1, argY:2, argW:3, argH:null },
        { method:'drawActorMp',       type:'actorMp',       label:'MP',          argX:1, argY:2, argW:3, argH:null },
        { method:'drawActorTp',       type:'actorTp',       label:'TP',          argX:1, argY:2, argW:3, argH:null },
        { method:'drawSimpleStatus',  type:'simpleStatus',  label:'간단 상태',   argX:1, argY:2, argW:3, argH:null },
      ];

      // Window_Base 원본 메서드 캡처 (UITheme.js 플러그인 적용 전)
      // module script이므로 defer scripts 이후 실행 → Window_Base 접근 가능
      var ORIG_BASE_METHODS = {};
      (function() {
        if (typeof Window_Base === 'undefined') return;
        ELEM_SPECS.forEach(function(spec) {
          var m = Window_Base.prototype[spec.method];
          if (m) ORIG_BASE_METHODS[spec.method] = m;
        });
      })();

      /** Window 내 요소 위치 캡처 (bitmap 클리어 없이 draw 메서드만 인터셉트) */
      function captureElements(win) {
        if (!win || !win.constructor) return [];
        var className = win.constructor.name;
        var isPerActor = !!PER_ACTOR_WINDOWS[className];
        var elements = [];
        var seen = {};

        // 인스턴스 메서드로 오버라이드 (prototype 유지, 캡처 후 delete로 복원)
        ELEM_SPECS.forEach(function(spec) {
          var proto = win.constructor.prototype;
          if (!proto || !proto[spec.method]) return;
          win[spec.method] = (function(spec) {
            return function() {
              if (seen[spec.type]) return;
              seen[spec.type] = true;
              var args = Array.prototype.slice.call(arguments);
              var lh = win.lineHeight ? win.lineHeight() : 36;
              elements.push({
                type: spec.type,
                label: spec.label,
                x: spec.argX !== null && args[spec.argX] !== undefined ? args[spec.argX] : 0,
                y: spec.argY !== null && args[spec.argY] !== undefined ? args[spec.argY] : 0,
                width:  spec.argW !== null && args[spec.argW] !== undefined ? args[spec.argW] : 128,
                height: spec.argH !== null && args[spec.argH] !== undefined ? args[spec.argH] : lh,
                isPerActor: isPerActor,
              });
            };
          })(spec);
        });

        // drawBlock1-4 (Window_Status 계열) 또는 drawItem(0) (리스트 계열) 호출
        var hadBlock = false;
        ['drawBlock1','drawBlock2','drawBlock3','drawBlock4'].forEach(function(m) {
          if (typeof win[m] === 'function') { hadBlock = true; try { win[m](); } catch(e) {} }
        });
        if (!hadBlock && typeof win.drawItem === 'function') {
          try { win.drawItem(0); } catch(e) {}
        }

        // 인스턴스 오버라이드 제거 → prototype 복원
        ELEM_SPECS.forEach(function(spec) {
          if (win.hasOwnProperty(spec.method)) delete win[spec.method];
        });

        return elements;
      }

      /** 저장된 요소 오버라이드를 인스턴스 메서드로 설치 후 refresh */
      function reinstallElemOvs(win) {
        var ovs = win.__uiElemOvs || {};
        // 이전 인스턴스 패치 제거
        ELEM_SPECS.forEach(function(spec) {
          if (win.hasOwnProperty(spec.method)) delete win[spec.method];
        });
        // 새 패치 설치 (Window_Base 원본 메서드 기반 → UITheme.js 우회)
        ELEM_SPECS.forEach(function(spec) {
          var cfg = ovs[spec.type];
          if (!cfg) return;
          var origBase = ORIG_BASE_METHODS[spec.method];
          if (!origBase) return;
          win[spec.method] = (function(orig, cfg, spec) {
            return function() {
              var args = Array.prototype.slice.call(arguments);
              if (cfg.x !== undefined && spec.argX !== null) args[spec.argX] = cfg.x;
              if (cfg.y !== undefined && spec.argY !== null) args[spec.argY] = cfg.y;
              if (cfg.width !== undefined && spec.argW !== null) args[spec.argW] = cfg.width;
              if (cfg.height !== undefined && spec.argH !== null) args[spec.argH] = cfg.height;
              return orig.apply(this, args);
            };
          })(origBase, cfg, spec);
        });
        try { if (win.refresh) win.refresh(); } catch(e) {}
      }

      /** Window 정보 추출 */
      function extractWindowInfo(win, id) {
        var tone = win._colorTone || [0, 0, 0, 0];
        return {
          id: id,
          className: win.constructor ? win.constructor.name : 'Unknown',
          x: Math.round(win.x),
          y: Math.round(win.y),
          width: Math.round(win.width),
          height: Math.round(win.height),
          opacity: typeof win.opacity !== 'undefined' ? win.opacity : 255,
          backOpacity: typeof win.backOpacity !== 'undefined' ? win.backOpacity : 192,
          padding: typeof win._padding !== 'undefined' ? win._padding : 18,
          fontSize: (win.standardFontSize ? win.standardFontSize() : (win.contents && win.contents.fontSize)) || 28,
          fontFace: win.standardFontFace ? win.standardFontFace() : 'GameFont',
          windowskinName: 'Window',
          colorTone: [tone[0] || 0, tone[1] || 0, tone[2] || 0],
          visible: win.visible !== false,
          elements: captureElements(win),
        };
      }

      /** 씬에서 Window_* 목록 수집 */
      function collectWindows(scene) {
        if (!scene) return [];
        var windows = [];
        var counter = {};
        function traverse(container) {
          if (!container || !container.children) return;
          for (var i = 0; i < container.children.length; i++) {
            var child = container.children[i];
            if (!child) continue;
            var cname = child.constructor && child.constructor.name;
            if (cname && cname.startsWith('Window_') && typeof child.width !== 'undefined') {
              if (!counter[cname]) counter[cname] = 0;
              var id = cname + '_' + counter[cname]++;
              windows.push(extractWindowInfo(child, id));
            }
            traverse(child);
          }
        }
        traverse(scene);
        return windows;
      }

      /** 창 목록을 에디터에 보고 */
      function reportWindows(type) {
        var windows = collectWindows(SceneManager._scene);
        var msg = { type: type || 'windowUpdated', windows: windows };
        if (type === 'sceneReady') {
          msg.gameWidth = (typeof Graphics !== 'undefined' ? Graphics.width : null) || 816;
          msg.gameHeight = (typeof Graphics !== 'undefined' ? Graphics.height : null) || 624;
        }
        window.parent.postMessage(msg, '*');
      }

      /** windowId → 실제 창 객체 */
      function findWindow(windowId) {
        var scene = SceneManager._scene;
        if (!scene) return null;
        var counter = {};
        var found = null;
        function traverse(container) {
          if (!container || !container.children || found) return;
          for (var i = 0; i < container.children.length; i++) {
            var child = container.children[i];
            if (!child) continue;
            var cname = child.constructor && child.constructor.name;
            if (cname && cname.startsWith('Window_') && typeof child.width !== 'undefined') {
              if (!counter[cname]) counter[cname] = 0;
              var id = cname + '_' + counter[cname]++;
              if (id === windowId) { found = child; return; }
            }
            traverse(child);
          }
        }
        traverse(scene);
        return found;
      }

      /** className 기준 모든 창에 속성 적용 */
      function applyOverrideToClass(className, prop, value) {
        var scene = SceneManager._scene;
        if (!scene) return;
        function traverse(container) {
          if (!container || !container.children) return;
          for (var i = 0; i < container.children.length; i++) {
            var child = container.children[i];
            if (!child) continue;
            if (child.constructor && child.constructor.name === className) {
              if (prop === 'elements' && value && typeof value === 'object') {
                // 요소 오버라이드 적용
                child.__uiElemOvs = value;
                reinstallElemOvs(child);
              } else {
                applyPropToWindow(child, prop, value);
              }
            }
            traverse(child);
          }
        }
        traverse(scene);
      }

      function applyPropToWindow(win, prop, value) {
        try {
          switch (prop) {
            case 'x': win.x = value; break;
            case 'y': win.y = value; break;
            case 'width':
              win.width = value;
              if (win._refreshAllParts) win._refreshAllParts();
              if (win.refresh) win.refresh();
              break;
            case 'height':
              win.height = value;
              if (win._refreshAllParts) win._refreshAllParts();
              if (win.refresh) win.refresh();
              break;
            case 'opacity': win.opacity = value; break;
            case 'backOpacity': win.backOpacity = value; break;
            case 'padding':
              win._padding = value;
              if (win._refreshAllParts) win._refreshAllParts();
              break;
            case 'fontSize':
              if (win.contents) win.contents.fontSize = value;
              if (win.refresh) win.refresh();
              break;
            case 'colorTone':
              if (win.setTone) win.setTone(value[0], value[1], value[2]);
              break;
            case 'windowskinName':
              if (typeof ImageManager !== 'undefined' && value) {
                var newSkin = ImageManager.loadSystem(value);
                newSkin.addLoadListener(function() {
                  win.windowskin = newSkin;
                  if (win._refreshAllParts) win._refreshAllParts();
                });
              }
              break;
          }
        } catch (e) {
          console.warn('[UIEditorBridge] applyProp error:', prop, e);
        }
      }

      function loadScene(sceneName) {
        var SceneCtor = window[sceneName];
        if (!SceneCtor) {
          console.warn('[UIEditorBridge] 씬 없음:', sceneName);
          return;
        }
        _targetScene = sceneName;
        try { SceneManager.goto(SceneCtor); } catch(e) { console.error(e); }
      }

      // 씬 변경 감지 (200ms 폴링)
      setInterval(function() {
        var scene = SceneManager._scene;
        if (!scene || scene === _prevScene) return;
        _prevScene = scene;
        setTimeout(function() { reportWindows('sceneReady'); }, 500);
      }, 200);

      // postMessage 수신
      window.addEventListener('message', function(e) {
        if (e.source !== window.parent) return;
        var data = e.data;
        if (!data || !data.type) return;
        switch (data.type) {
          case 'loadScene':
            loadScene(data.sceneName);
            break;
          case 'updateWindowProp': {
            var win = findWindow(data.windowId);
            if (win) {
              applyPropToWindow(win, data.prop, data.value);
              reportWindows('windowUpdated');
            }
            break;
          }
          case 'applyOverride':
            applyOverrideToClass(data.className, data.prop, data.value);
            reportWindows('windowUpdated');
            break;
          case 'updateElementProp': {
            var ewin = findWindow(data.windowId);
            if (ewin) {
              if (!ewin.__uiElemOvs) ewin.__uiElemOvs = {};
              if (!ewin.__uiElemOvs[data.elemType]) ewin.__uiElemOvs[data.elemType] = {};
              ewin.__uiElemOvs[data.elemType][data.prop] = data.value;
              reinstallElemOvs(ewin);
              reportWindows('windowUpdated');
            }
            break;
          }
          case 'refreshScene':
            loadScene(_targetScene);
            break;
        }
      });

      // 키보드 입력 억제
      window.addEventListener('keydown', function(e) { e.stopPropagation(); }, true);
      window.addEventListener('keyup', function(e) { e.stopPropagation(); }, true);

      // 브릿지 준비 알림
      window.parent.postMessage({ type: 'bridgeReady' }, '*');
    })();
    </script>
    <script defer src="js/main.js${cb}"></script>
  </body>
</html>`;

  res.type('html').send(html);
});

/** GET /api/ui-editor/config — UIEditorConfig.json 읽기 */
router.get('/config', (req, res) => {
  const configPath = getConfigPath();
  if (!configPath) return res.status(404).json({ error: 'No project' });
  if (!fs.existsSync(configPath)) return res.json({ overrides: {} });
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.json(data);
  } catch {
    res.json({ overrides: {} });
  }
});

/** PUT /api/ui-editor/config — UIEditorConfig.json 저장 */
router.put('/config', (req, res) => {
  const configPath = getConfigPath();
  if (!configPath) return res.status(404).json({ error: 'No project' });
  try {
    fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});


// ─── UIEditorSkins.json 관리 ─────────────────────────────────────────────────

interface SkinEntry { name: string; label?: string; file?: string; cornerSize: number; frameX?: number; frameY?: number; frameW?: number; frameH?: number; fillX?: number; fillY?: number; fillW?: number; fillH?: number; useCenterFill?: boolean; cursorX?: number; cursorY?: number; cursorW?: number; cursorH?: number; cursorCornerSize?: number; cursorRenderMode?: 'nineSlice' | 'stretch' | 'tile'; cursorBlendMode?: 'normal' | 'add' | 'multiply' | 'screen'; cursorOpacity?: number; cursorBlink?: boolean; }
interface SkinsData { defaultSkin: string; skins: SkinEntry[]; }

const DEFAULT_SKINS: SkinEntry[] = [{ name: 'Window', file: 'Window', cornerSize: 24, useCenterFill: false }];
const DEFAULT_SKINS_DATA: SkinsData = { defaultSkin: 'Window', skins: DEFAULT_SKINS };

function getSkinsPath(): string | null {
  if (!projectManager.isOpen()) return null;
  return path.join(projectManager.currentPath!, 'data', 'UIEditorSkins.json');
}

function readSkinsData(): SkinsData {
  const p = getSkinsPath();
  if (!p || !fs.existsSync(p)) return { ...DEFAULT_SKINS_DATA, skins: [...DEFAULT_SKINS] };
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const skins = Array.isArray(data.skins) && data.skins.length > 0 ? data.skins : [...DEFAULT_SKINS];
    // Window 스킨: 기존 JSON에 useCenterFill 없으면 false로 패치 (RPG MV 기본 배경은 별도 영역)
    const windowSkin = skins.find((s: SkinEntry) => s.name === 'Window');
    if (windowSkin && windowSkin.useCenterFill === undefined) windowSkin.useCenterFill = false;
    // 마이그레이션: file 없는 항목에 file = name 자동 패치
    for (const s of skins) {
      if (!s.file) s.file = s.name;
    }
    return { defaultSkin: data.defaultSkin || 'Window', skins };
  } catch {}
  return { ...DEFAULT_SKINS_DATA, skins: [...DEFAULT_SKINS] };
}

function writeSkinsData(data: SkinsData): void {
  const p = getSkinsPath();
  if (!p) return;
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

// ─── 스킨 CRUD ────────────────────────────────────────────────────────────────

/** GET /api/ui-editor/skins — UIEditorSkins.json ({ defaultSkin, skins }) */
router.get('/skins', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  res.json(readSkinsData());
});

/** PUT /api/ui-editor/skins/default — defaultSkin 변경 */
router.put('/skins/default', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  const { defaultSkin } = req.body as { defaultSkin?: string };
  if (!defaultSkin) return res.status(400).json({ error: 'defaultSkin required' });
  const data = readSkinsData();
  data.defaultSkin = defaultSkin;
  writeSkinsData(data);
  res.json({ ok: true });
});

/** POST /api/ui-editor/skins — 스킨 등록 */
router.post('/skins', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  const { name, file, label, cornerSize = 24 } = req.body as { name?: string; file?: string; label?: string; cornerSize?: number };
  if (!name) return res.status(400).json({ error: 'name required' });
  const data = readSkinsData();
  if (data.skins.find((s) => s.name === name)) return res.status(409).json({ error: 'Already exists' });
  const entry: SkinEntry = { name, cornerSize };
  if (file) entry.file = file;
  if (label) entry.label = label;
  data.skins.push(entry);
  writeSkinsData(data);
  res.json({ ok: true });
});

/** PUT /api/ui-editor/skins/:name — cornerSize 업데이트 */
router.put('/skins/:name', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  const data = readSkinsData();
  const idx = data.skins.findIndex((s) => s.name === req.params.name);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  const { cornerSize, label, frameX, frameY, frameW, frameH, fillX, fillY, fillW, fillH, useCenterFill, cursorX, cursorY, cursorW, cursorH, cursorCornerSize, cursorRenderMode, cursorBlendMode, cursorOpacity, cursorBlink } = req.body as { cornerSize?: number; label?: string; frameX?: number; frameY?: number; frameW?: number; frameH?: number; fillX?: number; fillY?: number; fillW?: number; fillH?: number; useCenterFill?: boolean; cursorX?: number; cursorY?: number; cursorW?: number; cursorH?: number; cursorCornerSize?: number; cursorRenderMode?: 'nineSlice' | 'stretch' | 'tile'; cursorBlendMode?: 'normal' | 'add' | 'multiply' | 'screen'; cursorOpacity?: number; cursorBlink?: boolean };
  if (cornerSize !== undefined) data.skins[idx].cornerSize = cornerSize;
  if (label !== undefined) data.skins[idx].label = label;
  if (frameX !== undefined) data.skins[idx].frameX = frameX;
  if (frameY !== undefined) data.skins[idx].frameY = frameY;
  if (frameW !== undefined) data.skins[idx].frameW = frameW;
  if (frameH !== undefined) data.skins[idx].frameH = frameH;
  if (fillX !== undefined) data.skins[idx].fillX = fillX;
  if (fillY !== undefined) data.skins[idx].fillY = fillY;
  if (fillW !== undefined) data.skins[idx].fillW = fillW;
  if (fillH !== undefined) data.skins[idx].fillH = fillH;
  if (useCenterFill !== undefined) data.skins[idx].useCenterFill = useCenterFill;
  if (cursorX !== undefined) data.skins[idx].cursorX = cursorX;
  if (cursorY !== undefined) data.skins[idx].cursorY = cursorY;
  if (cursorW !== undefined) data.skins[idx].cursorW = cursorW;
  if (cursorH !== undefined) data.skins[idx].cursorH = cursorH;
  if (cursorCornerSize !== undefined) data.skins[idx].cursorCornerSize = cursorCornerSize;
  if (cursorRenderMode !== undefined) data.skins[idx].cursorRenderMode = cursorRenderMode;
  if (cursorBlendMode !== undefined) data.skins[idx].cursorBlendMode = cursorBlendMode;
  if (cursorOpacity !== undefined) data.skins[idx].cursorOpacity = cursorOpacity;
  if (cursorBlink !== undefined) data.skins[idx].cursorBlink = cursorBlink;
  writeSkinsData(data);
  res.json({ ok: true });
});

/** DELETE /api/ui-editor/skins/:name — 스킨 삭제 */
router.delete('/skins/:name', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  const data = readSkinsData();
  const idx = data.skins.findIndex((s) => s.name === req.params.name);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  data.skins.splice(idx, 1);
  writeSkinsData(data);
  res.json({ ok: true });
});

/** POST /api/ui-editor/upload-skin — 새 윈도우스킨 PNG 업로드 + 스킨 목록에 자동 등록 */
router.post('/upload-skin', express.raw({ type: 'image/png', limit: '10mb' }), (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });
  const name = (req.query.name as string || '').replace(/[^a-zA-Z0-9_\-가-힣]/g, '');
  if (!name) return res.status(400).json({ error: 'name required' });
  const systemDir = path.join(projectManager.currentPath!, 'img', 'system');
  if (!fs.existsSync(systemDir)) fs.mkdirSync(systemDir, { recursive: true });
  const dest = path.join(systemDir, `${name}.png`);
  try {
    fs.writeFileSync(dest, req.body as Buffer);
    // 스킨 목록에 자동 등록 (이미 있으면 스킵)
    const data = readSkinsData();
    if (!data.skins.find((s) => s.name === name)) {
      data.skins.push({ name, cornerSize: 24 });
      writeSkinsData(data);
    }
    res.json({ ok: true, name });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
