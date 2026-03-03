  function registerCustomScenes() {
    var scenes = _scenesData.scenes || {};
    for (var sceneId in scenes) {
      var sceneDef = scenes[sceneId]; var className = 'Scene_CS_' + sceneId; var extendsName = sceneDef.extends;
      var Base = (extendsName && window[extendsName]) || Scene_CustomUI;
      var SceneCtor = (function (sid, BaseClass) {
        function CustomScene() {
          BaseClass.call(this);
        }
        CustomScene.prototype = Object.create(BaseClass.prototype); CustomScene.prototype.constructor = CustomScene;
        CustomScene.prototype.initialize = function () {
          BaseClass.prototype.initialize.call(this); this._sceneId = sid;
        };
        try {
          Object.defineProperty(CustomScene, 'name', { value: 'Scene_CS_' + sid, configurable: true });
        } catch (e) {}
        return CustomScene;
      })(sceneId, Base); if (extendsName === 'Scene_Battle') applyBattleOverrides(SceneCtor, sceneId); window[className] = SceneCtor;
    }
  }
  var _activeRedirects = {};
  function installSceneRedirects(redirects) {
    _activeRedirects = redirects || {};
    if (SceneManager._csOrigGoto) {
      SceneManager.goto = SceneManager._csOrigGoto; delete SceneManager._csOrigGoto;
    }
    if (SceneManager._csOrigPush) {
      SceneManager.push = SceneManager._csOrigPush; delete SceneManager._csOrigPush;
    }
    if (!redirects || Object.keys(redirects).length === 0) return; SceneManager._csOrigGoto = SceneManager.goto; SceneManager._csOrigPush = SceneManager.push;
    function resolve(SceneCtor) {
      if (!SceneCtor) return SceneCtor; var name = SceneCtor.name || ''; var target = redirects[name];
      if (target) {
        var RedirCtor = window[target]; if (RedirCtor) return RedirCtor;
      }
      return SceneCtor;
    }
    SceneManager.goto = function (SceneCtor) { return SceneManager._csOrigGoto.call(this, resolve(SceneCtor));     };
    SceneManager.push = function (SceneCtor) { return SceneManager._csOrigPush.call(this, resolve(SceneCtor));     };
  }
  function reloadCustomScenes() {
    _scenesData = loadScenesData(); _configData = loadJSON('data/UIEditorConfig.json'); registerCustomScenes();
    if (_noSceneRedirect) {
      installSceneRedirects({}); return;
    }
    var fileRedirects = _configData.sceneRedirects;
    if (fileRedirects && Object.keys(fileRedirects).length > 0) {
      installSceneRedirects(fileRedirects);
    } else installSceneRedirects(_activeRedirects);
  }
  function Scene_OverlayUI() {
    this.initialize.apply(this, arguments);
  }
  Scene_OverlayUI.prototype = Object.create(Scene_CustomUI.prototype); Scene_OverlayUI.prototype.constructor = Scene_OverlayUI;
  Scene_OverlayUI.prototype.popScene = function () { OverlayManager.hide(this._sceneId); };
  var OverlayManager = {
    _instances: {},
    show: function (sceneId, args) {
      var inst = this._instances[sceneId];
      if (!inst) {
        inst = this._create(sceneId, args); if (!inst) return; this._instances[sceneId] = inst;
      }
      inst.scene.visible = true;
    },
    hide: function (sceneId) {
      var inst = this._instances[sceneId]; if (inst) inst.scene.visible = false;
    },
    toggle: function (sceneId) {
      var inst = this._instances[sceneId]; if (!inst || !inst.scene.visible) this.show(sceneId); else this.hide(sceneId);
    },
    isVisible: function (sceneId) {
      var inst = this._instances[sceneId]; return !!(inst && inst.scene.visible);
    },
    destroy: function (sceneId) {
      var inst = this._instances[sceneId];
      if (inst) {
        if (inst.scene.parent) inst.scene.parent.removeChild(inst.scene); delete this._instances[sceneId];
      }
    },
    update: function () {
      var currentScene = SceneManager._scene;
      for (var id in this._instances) {
        var inst = this._instances[id]; if (currentScene && inst.scene.parent !== currentScene) currentScene.addChild(inst.scene);
        if (inst.scene.visible) if (inst.scene.update) inst.scene.update();
      }
    },
    _isOverlaySce: function (sceneId) {
      var scenes = _scenesData.scenes || {}; var def = scenes[sceneId]; return !!(def && def.overlay);
    },
    _create: function (sceneId, args) {
      if (!this._isOverlaySce(sceneId)) return null; var currentScene = SceneManager._scene; if (!currentScene) return null; var scene = new Scene_OverlayUI();
      scene._sceneId = sceneId; if (args && scene.prepare) scene.prepare.apply(scene, args);
      scene.create(); currentScene.addChild(scene); if (scene.start) scene.start(); return { scene: scene };
    },
  }; window.OverlayManager = OverlayManager; var _SceneManager_update = SceneManager.update;
  SceneManager.update = function () {
    _SceneManager_update.call(this); OverlayManager.update();
  }; var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command.toUpperCase() === 'OVERLAY') {
      var action = (args[0] || '').toUpperCase(); var sceneId = args[1] || '';
      switch (action) {
        case 'SHOW':    OverlayManager.show(sceneId);    break; case 'HIDE':    OverlayManager.hide(sceneId);    break;
        case 'TOGGLE':  OverlayManager.toggle(sceneId);  break; case 'DESTROY': OverlayManager.destroy(sceneId); break;
      }
    }
  }; var _noSceneRedirect = (new URLSearchParams(location.search)).has('noRedirect');
  registerCustomScenes(); installSceneRedirects(_noSceneRedirect ? {} : (_configData.sceneRedirects || {}));
  function findWidgetDefById(node, id) {
    if (!node) return null; if (node.id === id) return node; var children = node.children || [];
    for (var i = 0; i < children.length; i++) {
      var found = findWidgetDefById(children[i], id); if (found) return found;
    }
    return null;
  }
  function addMenuCommand(sceneId, widgetId, item, handlerDef, options) {
    var scenes = _scenesData.scenes || {}; var scene = scenes[sceneId]; if (!scene || !scene.root) return false; var widgetDef = findWidgetDefById(scene.root, widgetId);
    if (!widgetDef) return false; if (!widgetDef.items) widgetDef.items = widgetDef.commands || [];
    var exists = widgetDef.items.some(function(it) { return it.symbol === item.symbol; });
    if (!exists) {
      var idx = options != null && options.index != null ? options.index : null;
      if (idx !== null) {
        var len = widgetDef.items.length; widgetDef.items.splice(idx < 0 ? Math.max(0, len + idx) : idx, 0, item);
      } else widgetDef.items.push(item);
    }
    if (handlerDef) {
      if (!widgetDef.handlers) widgetDef.handlers = {}; if (!widgetDef.handlers[item.symbol]) widgetDef.handlers[item.symbol] = handlerDef;
    }
    return true;
  }
  window.__customSceneEngine = {
    reloadCustomScenes: reloadCustomScenes,
    updateSceneRedirects: function (redirects) {
      installSceneRedirects(redirects || {});
    },
    overlayManager: OverlayManager,
    registerWidget: function (type, WidgetClass) {
      _widgetRegistry[type] = WidgetClass;
    },
    addMenuCommand: addMenuCommand,
  };
  (function() {
    var params = new URLSearchParams(window.location.search); var testScene = params.get('uiTestScene');
    if (!testScene) return; var _origBootStart = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
      Scene_Base.prototype.start.call(this); SoundManager.preloadImportantSounds(); DataManager.setupNewGame(); var SceneCtor = window[testScene];
      if (SceneCtor) {
        SceneManager.goto(SceneCtor);
      } else _origBootStart.call(this); this.updateDocumentTitle();
    };
  })();
