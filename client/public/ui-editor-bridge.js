/**
 * UI Editor Bridge
 * iframe 내부에서 실행되어 에디터와 postMessage로 통신한다.
 */
(function () {
  'use strict';

  // 오디오 억제
  if (typeof WebAudioApi !== 'undefined') {
    WebAudioApi.prototype.play = function () {};
  }

  // RPGMaker 오디오 억제 (rpg_managers.js 로드 후)
  var _suppressAudio = function () {
    if (typeof AudioManager !== 'undefined') {
      AudioManager.playBgm = function () {};
      AudioManager.playBgs = function () {};
      AudioManager.playMe = function () {};
      AudioManager.playSeToMap = function () {};
      AudioManager.stopAll = function () {};
    }
  };

  var _currentScene = null;
  var _highlightCanvas = null;
  var _selectedWindowId = null;

  /** Window 정보를 추출한다 */
  function extractWindowInfo(win, id) {
    var orig = win._uiThemeOriginal;
    return {
      id: id,
      className: win.constructor ? win.constructor.name : 'Unknown',
      x: Math.round(win.x),
      y: Math.round(win.y),
      width: Math.round(win.width),
      height: Math.round(win.height),
      opacity: win.opacity,
      backOpacity: win.backOpacity,
      padding: win.padding,
      fontSize: win.standardFontSize ? win.standardFontSize() : 28,
      fontFace: win.standardFontFace ? win.standardFontFace() : 'GameFont',
      windowskinName: win._windowskin ? (win._windowskin._url || '').replace(/.*\//, '').replace(/\.\w+$/, '') : 'Window',
      colorTone: win._colorTone ? [win._colorTone[0], win._colorTone[1], win._colorTone[2]] : [0, 0, 0],
      visible: win.visible,
      originalX: orig ? Math.round(orig.x) : Math.round(win.x),
      originalY: orig ? Math.round(orig.y) : Math.round(win.y),
      originalWidth: orig ? Math.round(orig.width) : Math.round(win.width),
      originalHeight: orig ? Math.round(orig.height) : Math.round(win.height),
    };
  }

  /** 현재 씬의 모든 Window를 수집한다 */
  function collectWindows(scene) {
    if (!scene) return [];
    var windows = [];
    var counter = 0;
    var traverse = function (container) {
      if (!container || !container.children) return;
      for (var i = 0; i < container.children.length; i++) {
        var child = container.children[i];
        // Window_Base 계열만 (width/height/opacity 프로퍼티 존재)
        if (child && typeof child.opacity !== 'undefined' && typeof child.width !== 'undefined' && child.constructor && child.constructor.name && child.constructor.name.startsWith('Window_')) {
          var id = child.constructor.name + '_' + counter++;
          windows.push(extractWindowInfo(child, id));
          // 자식 창도 탐색
          traverse(child);
        } else {
          traverse(child);
        }
      }
    };
    traverse(scene);
    return windows;
  }

  /** 씬 로드 */
  function loadScene(sceneName) {
    var SceneCtor = window[sceneName];
    if (!SceneCtor) {
      console.warn('[UIEditorBridge] 씬을 찾을 수 없음:', sceneName);
      return;
    }
    try {
      _suppressAudio();
      SceneManager.goto(SceneCtor);
      // prepare()가 필요한 씬: goto() 직후 _nextScene에 더미 데이터 전달
      if (sceneName === 'Scene_Shop') {
        SceneManager.prepareNextScene([], false);
      } else if (sceneName === 'Scene_Name') {
        SceneManager.prepareNextScene(1, 12);
      }
    } catch (e) {
      console.error('[UIEditorBridge] loadScene error:', e);
    }
  }

  /** Window 속성 변경 적용 */
  function applyWindowProp(windowId, prop, value) {
    var scene = SceneManager._scene;
    if (!scene) return;
    var counter = 0;
    var found = false;
    var traverse = function (container) {
      if (!container || !container.children || found) return;
      for (var i = 0; i < container.children.length; i++) {
        var child = container.children[i];
        if (child && child.constructor && child.constructor.name && child.constructor.name.startsWith('Window_')) {
          var id = child.constructor.name + '_' + counter++;
          if (id === windowId) {
            applyPropToWindow(child, prop, value);
            found = true;
            return;
          }
          traverse(child);
        } else {
          traverse(child);
        }
      }
    };
    traverse(scene);
  }

  /** className 기준으로 모든 일치 창에 속성 적용 */
  function applyOverrideToClass(className, prop, value) {
    var scene = SceneManager._scene;
    if (!scene) return;
    var traverse = function (container) {
      if (!container || !container.children) return;
      for (var i = 0; i < container.children.length; i++) {
        var child = container.children[i];
        if (child && child.constructor && child.constructor.name === className) {
          applyPropToWindow(child, prop, value);
        }
        traverse(child);
      }
    };
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
          win.padding = value;
          if (win._refreshAllParts) win._refreshAllParts();
          break;
        case 'fontSize':
          win.contents.fontSize = value;
          if (win.refresh) win.refresh();
          break;
        case 'colorTone':
          if (win.setTone) win.setTone(value[0], value[1], value[2]);
          break;
        case 'renderCamera':
          if (window._uiSetWindowLayer) {
            window._uiSetWindowLayer(win, value === 'perspective' ? 1 : 0);
          }
          break;
        default: break;
      }
    } catch (e) {
      console.warn('[UIEditorBridge] applyProp error:', prop, e);
    }
    // 업데이트 후 창 목록 재보고
    reportWindows();
  }

  /** 창 목록을 에디터에 보고 */
  function reportWindows() {
    var scene = SceneManager._scene;
    var windows = collectWindows(scene);
    window.parent.postMessage({ type: 'windowUpdated', windows: windows }, '*');
  }

  /** 씬 로드 완료 감지 */
  var _prevScene = null;
  var _checkTimer = setInterval(function () {
    var scene = SceneManager._scene;
    if (!scene) return;
    if (scene === _prevScene) return;
    _prevScene = scene;
    // 씬이 시작된 뒤 조금 기다렸다가 창 보고
    setTimeout(function () {
      _suppressAudio();
      var windows = collectWindows(SceneManager._scene);
      window.parent.postMessage({ type: 'sceneReady', windows: windows }, '*');
    }, 300);
  }, 200);

  /** postMessage 리스너 */
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;
    var data = e.data;
    if (!data || !data.type) return;

    switch (data.type) {
      case 'loadScene':
        loadScene(data.sceneName);
        break;
      case 'selectWindow':
        _selectedWindowId = data.windowId;
        break;
      case 'updateWindowProp':
        applyWindowProp(data.windowId, data.prop, data.value);
        break;
      case 'applyOverride':
        applyOverrideToClass(data.className, data.prop, data.value);
        break;
      case 'updateRuntimeOverride':
        // UITheme.js의 _ov를 런타임에서 업데이트 (updatePlacement 재적용 시 새 값 사용)
        if (window._uiThemeUpdateOv) window._uiThemeUpdateOv(data.className, data.prop, data.value);
        break;
      case 'clearRuntimeOverride':
        // UITheme.js의 _ov에서 항목 삭제 (RMMV 기본값으로 리셋)
        if (window._uiThemeClearOv) window._uiThemeClearOv(data.className);
        break;
      case 'refreshScene':
        loadScene(SceneManager._scene ? SceneManager._scene.constructor.name : 'Scene_Options');
        break;
      default: break;
    }
  });

  // 키보드 입력 억제 (게임 이벤트 방지)
  window.addEventListener('keydown', function (e) { e.stopPropagation(); }, true);
  window.addEventListener('keyup', function (e) { e.stopPropagation(); }, true);

  // 준비 알림 (rpg_managers 로드 후 실행됨)
  setTimeout(function () {
    _suppressAudio();
    window.parent.postMessage({ type: 'bridgeReady' }, '*');
  }, 500);

})();
