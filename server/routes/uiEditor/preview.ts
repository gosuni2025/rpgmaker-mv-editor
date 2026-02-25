import fs from 'fs';
import path from 'path';
import express from 'express';
import projectManager from '../../services/projectManager';

const router = express.Router();

function detectWebp(): boolean {
  const imgDir = path.join(projectManager.currentPath!, 'img');
  if (!fs.existsSync(imgDir)) return false;
  const check = (dir: string): boolean => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (check(path.join(dir, e.name))) return true; }
      else if (e.name.toLowerCase().endsWith('.webp')) return true;
    }
    return false;
  };
  return check(imgDir);
}

function buildPreviewHTML(useWebp: boolean): string {
  const cb = `?v=${Date.now()}`;
  return `<!DOCTYPE html>
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
        _prepareScene(_targetScene);
        this.updateDocumentTitle();
      };

      // 씬 변경 감지용
      var _prevScene = null;

      // ── 요소 캡처: Window 내부 draw 메서드 계측 ─────────────────────────
      var PER_ACTOR_WINDOWS = { 'Window_BattleStatus': true, 'Window_MenuStatus': true };

      var ELEM_SPECS = [
        { method:'drawActorName',     type:'actorName',     label:'이름',        argX:1, argY:2, argW:3, argH:null },
        { method:'drawActorClass',    type:'actorClass',    label:'직업',        argX:1, argY:2, argW:3, argH:null },
        { method:'drawActorNickname', type:'actorNickname', label:'별명',        argX:1, argY:2, argW:3, argH:null },
        { method:'drawActorFace',     type:'actorFace',     label:'페이스',      argX:1, argY:2, argW:3, argH:4   },
        { method:'drawActorLevel',    type:'actorLevel',    label:'레벨',        argX:1, argY:2, argW:null, argH:null },
        { method:'drawActorIcons',    type:'actorIcons',    label:'상태 아이콘', argX:1, argY:2, argW:3, argH:null },
        { method:'drawActorHp',       type:'actorHp',       label:'HP',          argX:1, argY:2, argW:3, argH:null },
        { method:'drawActorMp',       type:'actorMp',       label:'MP',          argX:1, argY:2, argW:3, argH:null },
        { method:'drawActorTp',       type:'actorTp',       label:'TP',          argX:1, argY:2, argW:3, argH:null },
        { method:'drawSimpleStatus',  type:'simpleStatus',  label:'간단 상태',   argX:1, argY:2, argW:3, argH:null },
      ];

      var ORIG_BASE_METHODS = {};
      (function() {
        if (typeof Window_Base === 'undefined') return;
        ELEM_SPECS.forEach(function(spec) {
          var m = Window_Base.prototype[spec.method];
          if (m) ORIG_BASE_METHODS[spec.method] = m;
        });
      })();

      function captureElements(win) {
        if (!win || !win.constructor) return [];
        var className = win.constructor.name;
        var isPerActor = !!PER_ACTOR_WINDOWS[className];
        var elements = [];
        var seen = {};
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
                type: spec.type, label: spec.label,
                x: spec.argX !== null && args[spec.argX] !== undefined ? args[spec.argX] : 0,
                y: spec.argY !== null && args[spec.argY] !== undefined ? args[spec.argY] : 0,
                width:  spec.argW !== null && args[spec.argW] !== undefined ? args[spec.argW] : 128,
                height: spec.argH !== null && args[spec.argH] !== undefined ? args[spec.argH] : lh,
                isPerActor: isPerActor,
              });
            };
          })(spec);
        });
        var hadBlock = false;
        ['drawBlock1','drawBlock2','drawBlock3','drawBlock4'].forEach(function(m) {
          if (typeof win[m] === 'function') { hadBlock = true; try { win[m](); } catch(e) {} }
        });
        if (!hadBlock && typeof win.drawItem === 'function') {
          try { win.drawItem(0); } catch(e) {}
        }
        ELEM_SPECS.forEach(function(spec) {
          if (win.hasOwnProperty(spec.method)) delete win[spec.method];
        });
        return elements;
      }

      function reinstallElemOvs(win) {
        var ovs = win.__uiElemOvs || {};
        ELEM_SPECS.forEach(function(spec) {
          if (win.hasOwnProperty(spec.method)) delete win[spec.method];
        });
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

      function extractWindowInfo(win, id) {
        var tone = win._colorTone || [0, 0, 0, 0];
        // pivot 보정: win.x는 screenX + pivot.x 이므로 pivot을 빼서 실제 화면 좌표로 복원
        var pivotX = (win.pivot && win.pivot.x) || 0;
        var pivotY = (win.pivot && win.pivot.y) || 0;
        return {
          id: id,
          className: win.constructor ? win.constructor.name : 'Unknown',
          x: Math.round(win.x - pivotX), y: Math.round(win.y - pivotY),
          width: Math.round(win.width), height: Math.round(win.height),
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

      function reportWindows(type) {
        var windows = collectWindows(SceneManager._scene);
        var msg = { type: type || 'windowUpdated', windows: windows };
        if (type === 'sceneReady') {
          msg.gameWidth = (typeof Graphics !== 'undefined' ? Graphics.width : null) || 816;
          msg.gameHeight = (typeof Graphics !== 'undefined' ? Graphics.height : null) || 624;
        }
        window.parent.postMessage(msg, '*');
      }

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

      // 정적 rotationX/Y에 맞춰 pivot 설정 헬퍼 (회전 중심을 anchor 기준으로 보정)
      function _applyStaticPivotToWin(win, anchor) {
        if (!win || !win.pivot) return;
        var rotX = win.rotationX !== undefined ? win.rotationX : 0;
        var rotY = win.rotationY !== undefined ? win.rotationY : 0;
        var rotZ = win.rotation !== undefined ? win.rotation : 0;
        var screenX = win.x - win.pivot.x;
        var screenY = win.y - win.pivot.y;
        if (rotX === 0 && rotY === 0 && rotZ === 0) {
          win.pivot.x = 0; win.pivot.y = 0;
          win.x = screenX; win.y = screenY;
          return;
        }
        var rx = 0.5, ry = 0.5;
        switch (anchor || 'center') {
          case 'top-left':    rx=0;   ry=0;   break;
          case 'top':         rx=0.5; ry=0;   break;
          case 'top-right':   rx=1;   ry=0;   break;
          case 'left':        rx=0;   ry=0.5; break;
          case 'center':      rx=0.5; ry=0.5; break;
          case 'right':       rx=1;   ry=0.5; break;
          case 'bottom-left': rx=0;   ry=1;   break;
          case 'bottom':      rx=0.5; ry=1;   break;
          case 'bottom-right':rx=1;   ry=1;   break;
        }
        var px = Math.floor((win.width||0) * rx);
        var py = Math.floor((win.height||0) * ry);
        win.pivot.x = px; win.pivot.y = py;
        win.x = screenX + px;
        win.y = screenY + py;
      }

      function applyPropToWindow(win, prop, value) {
        try {
          switch (prop) {
            case 'x': win.x = value + ((win.pivot && win.pivot.x) || 0); break;
            case 'y': win.y = value + ((win.pivot && win.pivot.y) || 0); break;
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
                if (window._uiThemeUpdateOv) window._uiThemeUpdateOv(win.constructor.name, 'windowskinName', value);
                var newSkin = ImageManager.loadSystem(value);
                win._themeSkin = newSkin;
                newSkin.addLoadListener(function() {
                  win.windowskin = newSkin;
                  if (win._refreshAllParts) win._refreshAllParts();
                });
              }
              break;
            case 'imageFile':
              if (typeof ImageManager !== 'undefined' && value) {
                if (window._uiThemeUpdateOv) window._uiThemeUpdateOv(win.constructor.name, 'imageFile', value);
                var imgBitmap = ImageManager.loadSystem(value);
                win._themeSkin = imgBitmap;
                imgBitmap.addLoadListener(function() {
                  if (win._refreshAllParts) win._refreshAllParts();
                });
              }
              break;
            case 'imageRenderMode':
              if (window._uiThemeUpdateOv) window._uiThemeUpdateOv(win.constructor.name, 'imageRenderMode', value);
              if (win._refreshAllParts) win._refreshAllParts();
              break;
            case 'windowStyle':
              if (window._uiThemeUpdateOv) window._uiThemeUpdateOv(win.constructor.name, 'windowStyle', value);
              if (win._refreshAllParts) win._refreshAllParts();
              break;
            case 'rotationX':
              if (window._uiThemeUpdateOv) window._uiThemeUpdateOv(win.constructor.name, 'rotationX', value);
              if (win.rotationX !== undefined) win.rotationX = (value || 0) * Math.PI / 180;
              { var _ov1 = window._uiGetOv ? window._uiGetOv(win.constructor.name) : {};
                _applyStaticPivotToWin(win, (_ov1.animPivot) || 'center');
                var _rc1 = _ov1.renderCamera || 'auto';
                if (window._uiSetWindowLayer) {
                  if (_rc1 === 'orthographic') window._uiSetWindowLayer(win, 0);
                  else if (_rc1 === 'perspective' || (value || 0) !== 0) window._uiSetWindowLayer(win, 1);
                } }
              break;
            case 'rotationY':
              if (window._uiThemeUpdateOv) window._uiThemeUpdateOv(win.constructor.name, 'rotationY', value);
              if (win.rotationY !== undefined) win.rotationY = (value || 0) * Math.PI / 180;
              { var _ov2 = window._uiGetOv ? window._uiGetOv(win.constructor.name) : {};
                _applyStaticPivotToWin(win, (_ov2.animPivot) || 'center');
                var _rc2 = _ov2.renderCamera || 'auto';
                if (window._uiSetWindowLayer) {
                  if (_rc2 === 'orthographic') window._uiSetWindowLayer(win, 0);
                  else if (_rc2 === 'perspective' || (value || 0) !== 0) window._uiSetWindowLayer(win, 1);
                } }
              break;
            case 'rotationZ':
              if (window._uiThemeUpdateOv) window._uiThemeUpdateOv(win.constructor.name, 'rotationZ', value);
              win.rotation = (value || 0) * Math.PI / 180;
              { var _ov3 = window._uiGetOv ? window._uiGetOv(win.constructor.name) : {};
                _applyStaticPivotToWin(win, (_ov3.animPivot) || 'center'); }
              break;
            case 'animPivot':
              if (window._uiThemeUpdateOv) window._uiThemeUpdateOv(win.constructor.name, 'animPivot', value);
              _applyStaticPivotToWin(win, value || 'center');
              break;
          }
        } catch (e) {
          console.warn('[UIEditorBridge] applyProp error:', prop, e);
        }
      }

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

      function _prepareScene(sceneName) {
        if (sceneName === 'Scene_Shop') {
          SceneManager.prepareNextScene([], false);
        } else if (sceneName === 'Scene_Name') {
          SceneManager.prepareNextScene(1, 12);
        }
      }

      function loadScene(sceneName) {
        var SceneCtor = window[sceneName];
        if (!SceneCtor) {
          console.warn('[UIEditorBridge] 씬 없음:', sceneName);
          return;
        }
        _targetScene = sceneName;
        try {
          SceneManager.goto(SceneCtor);
          _prepareScene(sceneName);
        } catch(e) { console.error(e); }
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
          case 'updateRuntimeOverride':
            if (window._uiThemeUpdateOv) window._uiThemeUpdateOv(data.className, data.prop, data.value);
            break;
          case 'clearRuntimeOverride':
            if (window._uiThemeClearOv) window._uiThemeClearOv(data.className);
            break;
          case 'clearAllRuntimeOverrides':
            if (window._uiThemeClearAllOv) window._uiThemeClearAllOv();
            break;
          case 'refreshScene':
            loadScene(_targetScene);
            break;
          case 'reloadWindowskin': {
            if (typeof ImageManager === 'undefined' || typeof SceneManager === 'undefined') break;
            var fname = data.filename;
            // 1. ImageManager 캐시에서 해당 항목 제거
            var cache = ImageManager._imageCache;
            if (cache && cache._items) {
              Object.keys(cache._items).forEach(function(key) {
                if (key.indexOf('img/system/' + fname) !== -1 ||
                    key.indexOf('img/system/' + encodeURIComponent(fname)) !== -1) {
                  delete cache._items[key];
                }
              });
            }
            // 2. 캐시 버스팅 URL로 새 Bitmap 강제 로드
            var reloadBitmap = Bitmap.load('img/system/' + fname + '.png?_t=' + Date.now());
            reloadBitmap.addLoadListener(function() {
              // 3. 씬의 모든 Window 중 해당 이미지를 사용하는 것을 교체 + refresh
              // UITheme.js는 windowskin 대신 _themeSkin으로 렌더링하므로 둘 다 체크
              var scene = SceneManager._scene;
              if (!scene) return;
              function urlMatches(bitmap) {
                if (!bitmap || typeof bitmap._url !== 'string') return false;
                return bitmap._url.indexOf('img/system/' + fname) !== -1;
              }
              function refreshWindows(container) {
                if (!container || !container.children) return;
                for (var i = 0; i < container.children.length; i++) {
                  var child = container.children[i];
                  if (!child) continue;
                  if (child.constructor && child.constructor.name &&
                      child.constructor.name.startsWith('Window_')) {
                    var needRefresh = false;
                    if (urlMatches(child.windowskin)) {
                      child.windowskin = reloadBitmap;
                      needRefresh = true;
                    }
                    if (urlMatches(child._themeSkin)) {
                      child._themeSkin = reloadBitmap;
                      needRefresh = true;
                    }
                    if (needRefresh && child._refreshAllParts) child._refreshAllParts();
                  }
                  refreshWindows(child);
                }
              }
              refreshWindows(scene);
            });
            break;
          }
        }
      });

      // 키보드 입력 억제 + Cmd/Ctrl+S → 부모 창 저장 위임
      window.addEventListener('keydown', function(e) {
        e.stopPropagation();
        if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.code === 'KeyS')) {
          e.preventDefault();
          window.parent.postMessage({ type: 'cmdSave' }, '*');
        }
      }, true);
      window.addEventListener('keyup', function(e) { e.stopPropagation(); }, true);

      // 브릿지 준비 알림
      window.parent.postMessage({ type: 'bridgeReady' }, '*');
    })();
    </script>
    <script defer src="js/main.js${cb}"></script>
  </body>
</html>`;
}

/** GET /api/ui-editor/preview — iframe 내에서 게임 런타임을 구동하는 HTML */
router.get('/', (req, res) => {
  if (!projectManager.isOpen()) {
    return res.status(404).send('<h2>프로젝트가 열려있지 않습니다</h2>');
  }
  res.type('html').send(buildPreviewHTML(detectWebp()));
});

export default router;
