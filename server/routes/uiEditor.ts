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

  const cacheBust = `?v=${Date.now()}`;

  // 브릿지 스크립트 (인라인 임베드)
  // StorageManager 오버라이드는 `/game/` 경로를 사용
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="user-scalable=no">
    <link rel="stylesheet" type="text/css" href="/game/fonts/gamefont.css">
    <title>UI Editor Preview</title>
    <style>
      body { margin: 0; background: black; overflow: hidden; }
    </style>
  </head>
  <body>
    <script src="/game/js/libs/three.global.min.js"></script>
    <script defer src="/game/js/libs/lz-string.js"></script>
    <script defer src="/game/js/renderer/RendererFactory.js${cacheBust}"></script>
    <script defer src="/game/js/renderer/RendererStrategy.js${cacheBust}"></script>
    <script defer src="/game/js/renderer/three/ThreeRendererFactory.js${cacheBust}"></script>
    <script defer src="/game/js/renderer/three/ThreeRendererStrategy.js${cacheBust}"></script>
    <script defer src="/game/js/renderer/three/ThreeContainer.js${cacheBust}"></script>
    <script defer src="/game/js/renderer/three/ThreeSprite.js${cacheBust}"></script>
    <script defer src="/game/js/renderer/three/ThreeGraphicsNode.js${cacheBust}"></script>
    <script defer src="/game/js/renderer/three/ThreeTilemap.js${cacheBust}"></script>
    <script defer src="/game/js/renderer/three/ThreeWaterShader.js${cacheBust}"></script>
    <script defer src="/game/js/renderer/three/ThreeFilters.js${cacheBust}"></script>
    <script defer src="/game/js/rpg_core.js${cacheBust}"></script>
    <script defer src="/game/js/rpg_managers.js${cacheBust}"></script>
    <script defer src="/game/js/rpg_objects.js${cacheBust}"></script>
    <script defer src="/game/js/rpg_scenes.js${cacheBust}"></script>
    <script defer src="/game/js/rpg_sprites.js${cacheBust}"></script>
    <script defer src="/game/js/rpg_windows.js${cacheBust}"></script>
    <script defer src="/game/js/plugins.js"></script>

    <script type="module">
    // StorageManager → 서버 API (플레이테스트와 동일)
    (function() {
      StorageManager.save = function() {};
      StorageManager.load = function() { return null; };
      StorageManager.exists = function() { return false; };
    })();

    // 오디오 억제
    AudioManager.playBgm = function() {};
    AudioManager.playBgs = function() {};
    AudioManager.playMe = function() {};
    AudioManager.playSe = function() {};
    AudioManager.stopAll = function() {};

    // Scene_Boot 오버라이드: 타이틀 스킵 후 에디터가 요청한 씬으로
    var __uiEditorTargetScene = 'Scene_Options';
    Scene_Boot.prototype.start = function() {
      Scene_Base.prototype.start.call(this);
      SoundManager.preloadImportantSounds();
      DataManager.setupNewGame();
      var SceneCtor = window[__uiEditorTargetScene] || window.Scene_Options;
      SceneManager.goto(SceneCtor);
      this.updateDocumentTitle();
    };

    // 브릿지 초기화 (모든 defer 스크립트 로드 완료 후)
    (function initBridge() {
      var _prevScene = null;

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
          opacity: win.opacity || 255,
          backOpacity: win.backOpacity || 192,
          padding: win.padding || 18,
          fontSize: (win.standardFontSize ? win.standardFontSize() : (win.contents && win.contents.fontSize)) || 28,
          fontFace: win.standardFontFace ? win.standardFontFace() : 'GameFont',
          windowskinName: 'Window',
          colorTone: [tone[0] || 0, tone[1] || 0, tone[2] || 0],
          visible: win.visible !== false,
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
        window.parent.postMessage({ type: type || 'windowUpdated', windows: windows }, '*');
      }

      /** windowId → 실제 창 객체 찾기 */
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
              applyPropToWindow(child, prop, value);
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
        __uiEditorTargetScene = sceneName;
        try { SceneManager.goto(SceneCtor); } catch(e) { console.error(e); }
      }

      // 씬 변경 감지 (200ms 폴링)
      setInterval(function() {
        var scene = SceneManager._scene;
        if (!scene || scene === _prevScene) return;
        _prevScene = scene;
        setTimeout(function() {
          reportWindows('sceneReady');
        }, 400);
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
          case 'refreshScene':
            loadScene(__uiEditorTargetScene);
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

    <script defer src="/game/js/main.js${cacheBust}"></script>
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

/** POST /api/ui-editor/generate-plugin — UITheme.js 생성 및 플러그인 등록 */
router.post('/generate-plugin', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });

  const configPath = getConfigPath()!;
  let config: { overrides?: Record<string, Record<string, unknown>> } = {};
  if (fs.existsSync(configPath)) {
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
  }
  const overrides = config.overrides ?? {};

  // 플러그인 코드 생성
  let code = `// Auto-generated by RPG Maker MV Web Editor — UI Theme
// 이 파일을 직접 편집하지 마세요. UI 에디터에서 생성됩니다.
/*:
 * @plugindesc UI 테마 (자동 생성)
 * @author RPG Maker MV Web Editor
 */
(function() {
`;

  for (const [className, props] of Object.entries(overrides)) {
    if (!props || Object.keys(props).length === 0) continue;
    const ctor = String(className);
    code += `\n  // ${ctor}\n`;
    code += `  var _${ctor}_initialize = ${ctor}.prototype.initialize;\n`;
    code += `  ${ctor}.prototype.initialize = function() {\n`;
    code += `    _${ctor}_initialize.apply(this, arguments);\n`;

    // 속성별 코드
    if ('opacity' in props) code += `    this.opacity = ${JSON.stringify(props.opacity)};\n`;
    if ('backOpacity' in props) code += `    this.backOpacity = ${JSON.stringify(props.backOpacity)};\n`;
    if ('colorTone' in props) {
      const t = props.colorTone as number[];
      code += `    this.setTone(${t[0]}, ${t[1]}, ${t[2]});\n`;
    }
    code += `  };\n`;

    if ('x' in props || 'y' in props) {
      code += `  var _${ctor}_updatePlacement = ${ctor}.prototype.updatePlacement;\n`;
      code += `  ${ctor}.prototype.updatePlacement = function() {\n`;
      code += `    _${ctor}_updatePlacement.apply(this, arguments);\n`;
      if ('x' in props) code += `    this.x = ${JSON.stringify(props.x)};\n`;
      if ('y' in props) code += `    this.y = ${JSON.stringify(props.y)};\n`;
      code += `  };\n`;
    }
    if ('width' in props) {
      code += `  ${ctor}.prototype.windowWidth = function() { return ${JSON.stringify(props.width)}; };\n`;
    }
    if ('height' in props) {
      code += `  ${ctor}.prototype.windowHeight = function() { return ${JSON.stringify(props.height)}; };\n`;
    }
    if ('fontSize' in props) {
      code += `  ${ctor}.prototype.standardFontSize = function() { return ${JSON.stringify(props.fontSize)}; };\n`;
    }
    if ('padding' in props) {
      code += `  ${ctor}.prototype.standardPadding = function() { return ${JSON.stringify(props.padding)}; };\n`;
    }
    if ('backOpacity' in props) {
      code += `  ${ctor}.prototype.standardBackOpacity = function() { return ${JSON.stringify(props.backOpacity)}; };\n`;
    }
  }

  code += `\n})();\n`;

  // 파일 저장
  const pluginsDir = path.join(projectManager.currentPath!, 'js', 'plugins');
  if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });
  const pluginPath = path.join(pluginsDir, 'UITheme.js');
  fs.writeFileSync(pluginPath, code, 'utf8');

  // plugins.js에 등록 (이미 있으면 스킵)
  const pluginsJsPath = path.join(projectManager.currentPath!, 'js', 'plugins.js');
  if (fs.existsSync(pluginsJsPath)) {
    let pluginsJs = fs.readFileSync(pluginsJsPath, 'utf8');
    if (!pluginsJs.includes('"UITheme"')) {
      // 배열에 추가
      pluginsJs = pluginsJs.replace(
        /(\$plugins\s*=\s*\[)([\s\S]*?)(\];)/,
        (_, open, content, close) => {
          const newEntry = `\n{"name":"UITheme","status":true,"description":"UI 테마 (자동 생성)","parameters":{}},`;
          return open + newEntry + content + close;
        }
      );
      fs.writeFileSync(pluginsJsPath, pluginsJs, 'utf8');
    }
  }

  res.json({ ok: true, pluginPath });
});

export default router;
