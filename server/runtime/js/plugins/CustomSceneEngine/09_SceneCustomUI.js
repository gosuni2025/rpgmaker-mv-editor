  function Scene_CustomUI() {
    this.initialize.apply(this, arguments);
  }
  Scene_CustomUI.prototype = Object.create(Scene_Base.prototype); Scene_CustomUI.prototype.constructor = Scene_CustomUI;
  Scene_CustomUI.prototype.initialize = function () {
    Scene_Base.prototype.initialize.call(this); this._sceneId = ''; this._prepareData = {}; this._ctx = {};
    this._customWindows = {}; this._pendingPersonalAction = null; this._personalOriginWidget = null; this._sceneOnUpdateFn = null;
  };
  Scene_CustomUI.prototype.prepare = function () {
    var args = Array.prototype.slice.call(arguments); var sceneDef = this._getSceneDef();
    var prepareArgs = sceneDef && sceneDef.prepareArgs || []; this._prepareData = {};
    for (var i = 0; i < prepareArgs.length; i++) if (i < args.length) this._prepareData[prepareArgs[i]] = args[i];
  };
  Scene_CustomUI.prototype._getSceneDef = function () {
    var scenes = _scenesData.scenes || {}; return scenes[this._sceneId] || null;
  };
  Scene_CustomUI.prototype.create = function () {
    Scene_Base.prototype.create.call(this); this.createWindowLayer(); var sceneDef = this._getSceneDef();
    if (!sceneDef) { console.warn('[CSE] sceneDef not found for:', this._sceneId); return; }
    var initCtx = sceneDef.initCtx || {};
    for (var ick in initCtx) {
      var ickExpr = initCtx[ick];
      if (typeof ickExpr === 'string') {
        try { this._ctx[ick] = new Function('return (' + ickExpr + ')')(); }
        catch(e) { this._ctx[ick] = ickExpr; }
      } else this._ctx[ick] = ickExpr;
    }
    for (var pk in this._prepareData) this._ctx[pk] = this._prepareData[pk];
    if (sceneDef.root || (sceneDef.formatVersion && sceneDef.formatVersion >= 2)) {
      this._createWidgetTree(sceneDef);
    } else this._createLegacyWindows(sceneDef);
  };
  Scene_CustomUI.prototype._createLegacyWindows = function(sceneDef) {
    var windows = sceneDef.windows || []; var overrides = _configData.overrides || {};
    for (var i = 0; i < windows.length; i++) {
      var winDef = windows[i]; var x = winDef.x || 0; var y = winDef.y || 0; var w = winDef.width || 240;      var h = winDef.height; var customClassName = 'Window_CS_' + winDef.id; var ov = overrides[customClassName];
      if (ov) {
        if (ov.x !== undefined) x = ov.x; if (ov.y !== undefined) y = ov.y; if (ov.width !== undefined) w = ov.width; if (ov.height !== undefined) h = ov.height;
      }
      var win;
      if (winDef.windowType === 'command') {
        win = new Window_CustomCommand(x, y, winDef);
      } else win = new Window_CustomDisplay(x, y, w, h || 400, winDef); this._customWindows[winDef.id] = win; this.addWindow(win);
    }
    this._setupHandlers(sceneDef);
  };
  Scene_CustomUI.prototype._createWidgetTree = function(sceneDef) {
    this._rootWidget = null; this._widgetMap = {}; this._navManager = null; this._hasNavigation = !!sceneDef.navigation; if (!sceneDef.root) return;
    this._rootWidget = this._buildWidget(sceneDef.root, null); if (!this._rootWidget) return; var self = this; var scenePrefix = (sceneDef.id || '') + '/';
    function buildMap(widget, parentPath) {
      if (widget._id) {
        self._widgetMap[widget._id] = widget; widget._fullPath = parentPath + widget._id;
        var childPath = widget._fullPath + '/'; for (var i = 0; i < widget._children.length; i++) buildMap(widget._children[i], childPath);
      }
    }
    buildMap(this._rootWidget, scenePrefix); var rootObj = this._rootWidget.displayObject(); if (rootObj && !(rootObj instanceof Window_Base)) this.addChildAt(rootObj, 0);
    for (var id in this._widgetMap) {
      var w = this._widgetMap[id]; if (w._decoSprite && w.displayObject() instanceof Window_Base) this.addChild(w._decoSprite);
    }
    for (var id2 in this._widgetMap) {
      var w2 = this._widgetMap[id2]; var obj = w2.displayObject(); if (obj && obj instanceof Window_Base && !w2._topLayer) this.addWindow(obj);
    }
    for (var idL in this._widgetMap) if (this._widgetMap[idL]._labelSprite) this.addChild(this._widgetMap[idL]._labelSprite);
    for (var id3 in this._widgetMap) {
      var w3 = this._widgetMap[id3];
      if (w3 instanceof Widget_List && w3._rowOverlay) {
        this.addChild(w3._rowOverlay); if (!w3._dataScript) w3._rebuildRows();
      }
    }
    for (var idT in this._widgetMap) {
      var wT = this._widgetMap[idT]; if (!wT._topLayer) continue; var tObj = wT.displayObject(); if (!tObj) continue;
      if (tObj.parent) tObj.parent.removeChild(tObj); this.addChild(tObj);
    }
    this._setupWidgetHandlers(this._rootWidget);
    if (sceneDef.navigation) {
      this._navManager = new NavigationManager(); this._navManager.initialize(sceneDef.navigation);
      this._navManager.setScene(this); this._navManager.buildFocusList(this._rootWidget);
    }
    this._sceneOnUpdateFn = null;
    if (sceneDef.onUpdate) {
      try {
        this._sceneOnUpdateFn = new Function('$ctx', sceneDef.onUpdate);
      } catch(e) {
        console.error('[CSE] scene onUpdate compile error:', e);
      }
    }
    for (var oid in this._widgetMap) this._widgetMap[oid]._runScript('onCreate');
  };
  Scene_CustomUI.prototype._buildWidget = function(def, parentWidget) {
    if (!def || !def.type) return null; var widget = null;
    if (_widgetRegistry[def.type]) {
      widget = new _widgetRegistry[def.type]();
    } else {
      switch (def.type) {
        case 'panel':       widget = new Widget_Panel();       break; case 'label':       widget = new Widget_Label();       break;
        case 'textArea':    widget = new Widget_TextArea();    break; case 'image':       widget = new Widget_Image();       break;
        case 'gauge':       widget = new Widget_Gauge();       break; case 'separator':   widget = new Widget_Separator();   break;
        case 'icons':       widget = new Widget_Icons();       break; case 'button':      widget = new Widget_Button();      break;
        case 'list':        widget = new Widget_List();        break; case 'textList':    widget = new Widget_TextList();    break;
        case 'scene':       widget = new Widget_Scene();       break; case 'options':     widget = new Widget_Options();     break;
        case 'background':  widget = new Widget_Background();  break; case 'shopNumber':  widget = new Widget_ShopNumber();  break; default:            return null;
      }
    }
    widget.initialize(def, parentWidget); if (def.topLayer) widget._topLayer = true;
    if (def.visible === false) {
      var dObj = widget.displayObject(); if (dObj) dObj.visible = false;
    }
    if (def.children && def.children.length) {
      for (var i = 0; i < def.children.length; i++) {
        var child = this._buildWidget(def.children[i], widget); if (child) widget.addChildWidget(child);
      }
    }
    return widget;
  };
  Scene_CustomUI.prototype._setupWidgetHandlers = function(rootWidget) {
    var self = this;
    function bindExec(handler, w) {
      return function() { self._executeWidgetHandler(handler, w); };
    }
    function traverse(widget) {
      if (widget instanceof Widget_TextList) {
        var handlersDef = widget._handlersDef || {}; var okHandler = handlersDef['ok'] || null;
        widget.setHandler('ok', (function(okH, w) {
          return function() {
            if (self._ctx && self._ctx._formationMode) {
              var idx = w._window ? w._window.index() : -1; if (idx < 0) return;
              if (self._ctx._formationPending < 0) {
                self._ctx._formationPending = idx; if (typeof SoundManager !== 'undefined') SoundManager.playCursor(); if (w._window) w._window.activate();
              } else {
                $gameParty.swapOrder(idx, self._ctx._formationPending); self._ctx._formationPending = -1;
                if (typeof SoundManager !== 'undefined') SoundManager.playOk(); if (w._rebuildFromScript) w._rebuildFromScript(); if (w._window) w._window.activate();
              }
              return;
            }
            if (self._pendingPersonalAction) {
              var actorIdx = w._window ? w._window.index() : 0;
              var actor = typeof $gameParty !== 'undefined' ? $gameParty.members()[actorIdx] : null;
              if (actor) $gameParty.setMenuActor(actor); var pendingAction = self._pendingPersonalAction;              self._pendingPersonalAction = null; self._personalOriginWidget = null;
              if (w.deactivate) w.deactivate(); if (w.displayObject()) w.displayObject().visible = false;
              self._pendingActorWidgetId = null; self._executeWidgetHandler(pendingAction, w); return;
            }
            if (okH) self._executeWidgetHandler(okH, w);
          };
        })(okHandler, widget));
        for (var symbol in handlersDef) {
          if (symbol === 'ok') continue; widget.setHandler(symbol, bindExec(handlersDef[symbol], widget));
        }
        if (!handlersDef['cancel']) {
          widget.setCancelHandler((function(w) {
            return function() {
              if (self._ctx && self._ctx._formationMode) {
                if (self._ctx._formationPending >= 0) {
                  self._ctx._formationPending = -1; if (typeof SoundManager !== 'undefined') SoundManager.playCancel(); if (w._window) w._window.activate(); return;
                }
                self._ctx._formationMode = false; self._ctx._formationPending = -1;
                if (w.deactivate) w.deactivate(); if (w.displayObject()) w.displayObject().visible = false;
                var formOrigin = self._personalOriginWidget; self._personalOriginWidget = null;
                if (formOrigin && self._navManager) self._navManager.focusWidget(formOrigin._id); return;
              }
              if (self._pendingPersonalAction) {
                self._pendingPersonalAction = null; if (w.deactivate) w.deactivate();
                if (w.displayObject()) w.displayObject().visible = false; self._pendingActorWidgetId = null;
                var selOrigin = self._personalOriginWidget; self._personalOriginWidget = null;
                if (selOrigin && self._navManager) self._navManager.focusWidget(selOrigin._id); return;
              }
              self._executeWidgetHandler({ action: 'cancel' }, w);
            };
          })(widget));
        }
      } else if (widget instanceof Widget_Options) {
        widget.setCancelHandler((function(w) {
          return function() { self._onOptionsCancel(w); };
        })(widget));
      } else if (widget instanceof Widget_Button) {
        if (widget._handlerDef) widget.setOkHandler(bindExec(widget._handlerDef, widget));
        if (widget._leftHandlerDef && widget._window && widget._window.setLeftHandler) widget._window.setLeftHandler(bindExec(widget._leftHandlerDef, widget));
        if (widget._rightHandlerDef && widget._window && widget._window.setRightHandler) widget._window.setRightHandler(bindExec(widget._rightHandlerDef, widget));
        widget.setCancelHandler(bindExec({ action: 'cancel' }, widget));
      } else if (widget instanceof Widget_ShopNumber) {
        var snHandlers = widget._handlersDef || {}; if (snHandlers['ok']) widget.setHandler('ok', bindExec(snHandlers['ok'], widget));
        widget.setCancelHandler(bindExec(snHandlers['cancel'] || { action: 'cancel' }, widget));
      }
      for (var i = 0; i < widget._children.length; i++) traverse(widget._children[i]);
    }
    traverse(rootWidget);
  };
  Scene_CustomUI.prototype._executeWidgetHandler = function(handler, widget) {
    if (!handler || !handler.action) return; var self = this;
    function pushSceneOrOverlay(rawTarget, isCS) {
      var csId = rawTarget.startsWith('Scene_CS_') ? rawTarget.replace('Scene_CS_', '') : (isCS ? rawTarget : '');
      if (csId && OverlayManager._isOverlaySce(csId)) { OverlayManager.show(csId); return; }
      var name = (isCS && !rawTarget.startsWith('Scene_CS_')) ? 'Scene_CS_' + rawTarget : rawTarget; var Ctor = window[name]; if (Ctor) SceneManager.push(Ctor);
    }
    function adjustConfig(key, step, wrap) {
      if (key == null || typeof ConfigManager === 'undefined') return;
      var cur = ConfigManager[key] !== undefined ? ConfigManager[key] : 100;
      var next = wrap ? (cur + step > 100 ? 0 : cur + step) : Math.max(0, cur + step);
      if (cur !== next) { ConfigManager[key] = next; if (typeof SoundManager !== 'undefined') SoundManager.playCursor(); }
    }
    switch (handler.action) {
      case 'gotoScene': pushSceneOrOverlay(handler.target || '', false); break; case 'popScene': this.popScene(); break;
      case 'callCommonEvent': {
        var eventId = parseInt(handler.eventId || handler.target, 10);
        if (eventId && typeof $gameTemp !== 'undefined') { $gameTemp.reserveCommonEvent(eventId); SceneManager.goto(Scene_Map); }
        break;
      }
      case 'customScene': pushSceneOrOverlay(handler.target || '', true); break;
      case 'focusWidget':
        if (widget && widget.deactivate) widget.deactivate(); if (this._navManager && handler.target) this._navManager.focusWidget(handler.target); break;
      case 'refreshWidgets': if (this._rootWidget) this._rootWidget.refresh(); break;
      case 'activateWindow': {
        if (this._customWindows && this._customWindows[handler.target]) {
          if (widget && widget._window) widget._window.deactivate(); this._customWindows[handler.target].activate(); this._customWindows[handler.target].select(0);
        }
        break;
      }
      case 'script': {
        if (handler.code) {
          var prevNavIdx = this._navManager ? this._navManager._activeIndex : -99;
          try { var $ctx = this._ctx; (new Function('$ctx', handler.code)).call(this, $ctx); }
          catch (e) { console.error('[CustomScene] script error:', e); }
          if (this._rootWidget) this._rootWidget.refresh();
          var navFocusChanged = this._navManager && this._navManager._activeIndex !== prevNavIdx;
          if (handler.thenAction) this._executeWidgetHandler(handler.thenAction, widget); else if (!navFocusChanged && widget && widget.activate) widget.activate();
        }
        break;
      }
      case 'selectActor': {
        var actorWidget = this._widgetMap && this._widgetMap[handler.widget];
        if (actorWidget) {
          this._pendingPersonalAction = handler.thenAction || null; this._personalOriginWidget = widget;
          this._pendingActorWidgetId = handler.widget; if (typeof actorWidget.setFormationMode === 'function') actorWidget.setFormationMode(false);
          if (actorWidget.displayObject()) actorWidget.displayObject().visible = true; if (this._navManager) this._navManager.focusWidget(handler.widget);
        }
        break;
      }
      case 'formation': {
        var actorWidget2 = this._widgetMap && this._widgetMap[handler.widget];
        if (actorWidget2) {
          if (typeof actorWidget2.setFormationMode === 'function') { actorWidget2.setFormationMode(true); actorWidget2.setPendingIndex(-1); }
          else { this._ctx._formationMode = true; this._ctx._formationPending = -1; this._personalOriginWidget = widget; }
          if (actorWidget2.displayObject()) actorWidget2.displayObject().visible = true; if (this._navManager) this._navManager.focusWidget(handler.widget);
        }
        break;
      }
      case 'toggleConfig': {
        var cfgKey = handler.configKey;
        if (cfgKey != null && typeof ConfigManager !== 'undefined') {
          var prev = ConfigManager[cfgKey]; ConfigManager[cfgKey] = !prev;
          if (prev !== ConfigManager[cfgKey] && typeof SoundManager !== 'undefined') SoundManager.playCursor();
        }
        if (widget && widget.activate) widget.activate(); break;
      }
      case 'incrementConfig': adjustConfig(handler.configKey, handler.step || 20, true); if (widget && widget.activate) widget.activate(); break;
      case 'decrementConfig': adjustConfig(handler.configKey, -(handler.step || 20), false); if (widget && widget.activate) widget.activate(); break;
      case 'saveConfig': {
        if (typeof ConfigManager !== 'undefined' && typeof ConfigManager.save === 'function') ConfigManager.save();
        if (handler.thenAction) this._executeWidgetHandler(handler.thenAction, widget); break;
      }
      case 'useItem': {
        if (handler.itemExpr) {
          var useSkill = null, useUser = null;
          try { useSkill = new Function('$ctx', 'return (' + handler.itemExpr + ')')(this._ctx); } catch(e) {}
          try { useUser  = new Function('$ctx', 'return (' + handler.userExpr  + ')')(this._ctx); } catch(e) {}
          if (!useSkill || !useUser) { if (widget && widget.activate) widget.activate(); break; }
          if (!useUser.canUse(useSkill)) {
            if (typeof SoundManager !== 'undefined') SoundManager.playBuzzer(); if (widget && widget.activate) widget.activate(); break;
          }
          if (handler.setLastSkill && typeof useUser.setLastMenuSkill === 'function') useUser.setLastMenuSkill(useSkill);
          var skillAction = new Game_Action(useUser); skillAction.setItemObject(useSkill);
          if (skillAction.isForFriend() && handler.actorWidget) {
            this._ctx._pendingUseItem = useSkill; this._ctx._pendingUseItemUser = useUser; this._pendingPersonalAction = { action: 'applyItemToActor', itemListWidget: null };
            this._personalOriginWidget = widget; this._pendingItemListWidgetId = widget ? widget._id : null;
            this._pendingActorWidgetId = handler.actorWidget || null; if (widget && widget.displayObject()) widget.displayObject().visible = false;
            if (widget && widget._rowOverlay) widget._rowOverlay.visible = false;
            if (handler.actorPanelsWidget) {
              this._pendingActorPanelsWidgetId = handler.actorPanelsWidget; var apwShowNew = this._widgetMap[handler.actorPanelsWidget];
              if (apwShowNew && apwShowNew.displayObject()) apwShowNew.displayObject().visible = true;
            }
            var sawUI = this._widgetMap[handler.actorWidget];
            if (sawUI) {
              if (sawUI.displayObject()) sawUI.displayObject().visible = true; if (typeof sawUI.setFormationMode === 'function') sawUI.setFormationMode(false);
              if (this._navManager) this._navManager.focusWidget(handler.actorWidget);
            }
          } else {
            if (typeof SoundManager !== 'undefined') DataManager.isSkill(useSkill) ? SoundManager.playUseSkill() : SoundManager.playUseItem();
            useUser.useItem(useSkill); var sa2 = new Game_Action(useUser);
            sa2.setItemObject(useSkill); var sa2Targets = sa2.isForAll() ? $gameParty.members() : [useUser];
            sa2Targets.forEach(function(t) { sa2.apply(t); }); sa2.applyGlobal();
            if (typeof $gameTemp !== 'undefined' && $gameTemp.isCommonEventReserved()) {
              SceneManager.goto(Scene_Map);
            } else {
              if (this._rootWidget) this._rootWidget.refresh(); if (widget && widget.activate) widget.activate();
            }
          }
          break;
        }
        var ilId = handler.itemListWidget; var ilWidget = this._widgetMap && this._widgetMap[ilId];
        if (!ilWidget || !ilWidget._window) break; var useItem = ilWidget._window.item(); if (!useItem) break;
        if (!$gameParty.canUse(useItem)) {
          if (typeof SoundManager !== 'undefined') SoundManager.playBuzzer(); if (ilWidget.activate) ilWidget.activate(); break;
        }
        $gameParty.setLastItem(useItem); var useAction = new Game_Action($gameParty.leader()); useAction.setItemObject(useItem);
        if (useAction.isForFriend() && handler.actorWidget) {
          this._ctx._pendingUseItem = useItem;
          this._pendingPersonalAction = { action: 'applyItemToActor', itemListWidget: ilId, actorPanelsWidget: handler.actorPanelsWidget };
          this._personalOriginWidget = ilWidget; if (ilWidget.displayObject()) ilWidget.displayObject().visible = false;
          if (ilWidget._rowOverlay) ilWidget._rowOverlay.visible = false; this._pendingItemListWidgetId = ilId;
          if (handler.actorPanelsWidget) {
            this._pendingActorPanelsWidgetId = handler.actorPanelsWidget; var apwShow = this._widgetMap[handler.actorPanelsWidget];
            if (apwShow && apwShow.displayObject()) apwShow.displayObject().visible = true;
          }
          this._pendingActorWidgetId = handler.actorWidget || null; var awUI = this._widgetMap[handler.actorWidget];
          if (awUI) {
            if (awUI.displayObject()) awUI.displayObject().visible = true; if (typeof awUI.setFormationMode === 'function') awUI.setFormationMode(false);
            if (this._navManager) this._navManager.focusWidget(handler.actorWidget);
          }
        } else {
          this._applyItemToAll(useItem); if (this._rootWidget) this._rootWidget.refresh(); if (ilWidget.activate) ilWidget.activate();
        }
        break;
      }
      case 'applyItemToActor': {
        var pendingItem = this._ctx._pendingUseItem; if (!pendingItem) break; var pendingUser = this._ctx._pendingUseItemUser || null;
        var targetActor = typeof $gameParty !== 'undefined' && $gameParty.menuActor
          ? $gameParty.menuActor() : null;
        if (!targetActor) break; this._applyItemTo(pendingItem, targetActor, pendingUser);
        delete this._ctx._pendingUseItem; delete this._ctx._pendingUseItemUser; var awDoneId = this._pendingActorWidgetId;
        if (awDoneId) {
          var awDone = this._widgetMap[awDoneId];
          if (awDone) {
            if (awDone.deactivate) awDone.deactivate(); if (awDone.displayObject()) awDone.displayObject().visible = false;
          }
          this._pendingActorWidgetId = null;
        }
        var apwHideId = handler.actorPanelsWidget || this._pendingActorPanelsWidgetId;
        if (apwHideId) {
          var apwHide = this._widgetMap[apwHideId]; if (apwHide && apwHide.displayObject()) apwHide.displayObject().visible = false; this._pendingActorPanelsWidgetId = null;
        }
        var ilRestoreId = handler.itemListWidget || this._pendingItemListWidgetId;
        if (ilRestoreId) {
          var ilRestore = this._widgetMap[ilRestoreId]; if (ilRestore && ilRestore.displayObject()) ilRestore.displayObject().visible = true;
          if (ilRestore && ilRestore._rowOverlay) ilRestore._rowOverlay.visible = true; this._pendingItemListWidgetId = null;
        }
        if (this._rootWidget) this._rootWidget.refresh(); var retId = handler.itemListWidget;
        if (retId && this._navManager) {
          this._navManager.focusWidget(retId);
        } else if (this._personalOriginWidget && this._navManager) {   this._navManager.focusWidget(this._personalOriginWidget._id); }
        break;
      }
      case 'cancel': {
        var navMgr = this._navManager;
        if (navMgr && navMgr._cancelWidgetId) {
          var cancelWidget = this._widgetMap[navMgr._cancelWidgetId];
          if (cancelWidget && cancelWidget !== widget) {
            navMgr.focusWidget(navMgr._cancelWidgetId); return;
          }
        }
        this.popScene(); break;
      }
    }
  };
  Scene_CustomUI.prototype._applyItemTo = function(item, actor, user) {
    var effectUser = user || $gameParty.leader();
    if (typeof SoundManager !== 'undefined') DataManager.isSkill(item) ? SoundManager.playUseSkill() : SoundManager.playUseItem();
    effectUser.useItem(item); var action = new Game_Action(effectUser); action.setItemObject(item); action.apply(actor);
    action.applyGlobal(); if (typeof $gameTemp !== 'undefined' && $gameTemp.isCommonEventReserved()) SceneManager.goto(Scene_Map);
  };
  Scene_CustomUI.prototype._applyItemToAll = function(item) {
    if (typeof SoundManager !== 'undefined') DataManager.isSkill(item) ? SoundManager.playUseSkill() : SoundManager.playUseItem();
    $gameParty.leader().useItem(item); var action = new Game_Action($gameParty.leader());
    action.setItemObject(item); var targets = action.isForAll() ? $gameParty.members() : [$gameParty.leader()];
    targets.forEach(function(actor) { action.apply(actor); }); action.applyGlobal();
    if (typeof $gameTemp !== 'undefined' && $gameTemp.isCommonEventReserved()) SceneManager.goto(Scene_Map);
  };
  Scene_CustomUI.prototype.popScene = function() {
    if (this._exitAnimating) return; var self = this;    var sceneDef = this._getSceneDef(); var sceneExitAnim = sceneDef && sceneDef.exitAnimation;
    var widgetMap = this._widgetMap || {}; var ids = Object.keys(widgetMap); var animTargets = [];
    for (var i = 0; i < ids.length; i++) {
      var w = widgetMap[ids[i]]; var def = (w._def && w._def.exitAnimation !== undefined) ? w._def.exitAnimation : sceneExitAnim;
      if (def && def.type !== 'none') {
        var obj = w.displayObject(); if (obj) animTargets.push({ obj: obj, animDef: def });
      }
    }
    if (animTargets.length === 0) {
      Scene_Base.prototype.popScene.call(this); return;
    }
    this._exitAnimating = true; var remaining = animTargets.length;
    function onOne() {
      remaining--;
      if (remaining <= 0) {
        self._exitAnimating = false; Scene_Base.prototype.popScene.call(self);
      }
    }
    for (var j = 0; j < animTargets.length; j++) WidgetAnimator.play(animTargets[j].obj, animTargets[j].animDef, false, onOne);
  };
  Scene_CustomUI.prototype.terminate = function() {
    Scene_Base.prototype.terminate.call(this); if (this._navManager && this._navManager.dispose) this._navManager.dispose();
    if (this._rootWidget) {
      this._rootWidget.destroy(); this._rootWidget = null;
    }
    this._widgetMap = {};
    if (this._customWindows) {
      for (var wid in this._customWindows) {
        var cw = this._customWindows[wid];
        if (cw) {
          if (cw.contents && cw.contents.destroy) cw.contents.destroy(); if (cw.destroy) cw.destroy();
        }
      }
      this._customWindows = {};
    }
    var sceneDef = this._getSceneDef();
    if (sceneDef && sceneDef.saveConfigOnExit) if (typeof ConfigManager !== 'undefined' && typeof ConfigManager.save === 'function') ConfigManager.save();
  };
  Scene_CustomUI.prototype._onOptionsCancel = function(widget) {
    if (typeof ConfigManager !== 'undefined' && typeof ConfigManager.save === 'function') ConfigManager.save(); this.popScene();
  };
  Scene_CustomUI.prototype.start = function () {
    Scene_Base.prototype.start.call(this); var sceneDef = this._getSceneDef(); if (!sceneDef) return; var sceneEnterAnim = sceneDef.enterAnimation || null;
    var widgetMap = this._widgetMap || {}; for (var wid in widgetMap) widgetMap[wid].playEnterAnim(sceneEnterAnim);
    if (this._navManager) {
      this._navManager.start(); return;
    }
    var links = sceneDef.windowLinks || {};
    for (var winId in links) {
      if (links[winId].activateDefault && this._customWindows[winId]) {
        this._customWindows[winId].activate(); this._customWindows[winId].select(0);
      }
    }
  };
  Scene_CustomUI.prototype.update = function() {
    Scene_Base.prototype.update.call(this); WidgetAnimator.update();
    if (!this._navManager && this._hasNavigation && !this._navManagerWarnOnce) {
      this._navManagerWarnOnce = true; console.warn('[Scene_CustomUI] _navManager is null on update!');
    }
    if (this._navManager) this._navManager.update(); if (this._rootWidget) this._rootWidget.update();
    if (this._sceneOnUpdateFn) {
      try { this._sceneOnUpdateFn.call(this, this._ctx || {}); }
      catch(e) { console.error('[CSE] scene onUpdate error:', e); }
    }
    var sceneDef = this._getSceneDef(); var keyHandlers = sceneDef && sceneDef.keyHandlers;
    if (keyHandlers) {
      var keys = Object.keys(keyHandlers);
      for (var ki = 0; ki < keys.length; ki++) {
        var key = keys[ki];
        if (Input.isTriggered(key)) {
          this._executeWidgetHandler(keyHandlers[key], null); break;
        }
      }
    }
    if (this._widgetMap) {
      for (var vid in this._widgetMap) {
        var vw = this._widgetMap[vid]; if (typeof vw._syncExternalVisibility === 'function') vw._syncExternalVisibility();
      }
    }
  };
  Scene_CustomUI.prototype._setupHandlers = function (sceneDef) {
    var windows = sceneDef.windows || []; var self = this;    for (var i = 0; i < windows.length; i++) {
      var winDef = windows[i]; if (winDef.windowType !== 'command') continue;
      var cmdWin = this._customWindows[winDef.id]; if (!cmdWin) continue; var handlers = winDef.handlers || {};
      for (var symbol in handlers) {
        (function (sym, handler, cmdWindow) {
          cmdWindow.setHandler(sym, function () {
            self._executeHandler(handler, cmdWindow);
          });
        })(symbol, handlers[symbol], cmdWin);
      }
    }
  };
  Scene_CustomUI.prototype._executeHandler = function (handler, cmdWin) {
    if (!handler || !handler.action) return;
    switch (handler.action) {
      case 'activateWindow': {
        var targetWinId = handler.target;
        if (this._customWindows[targetWinId]) {
          if (cmdWin) cmdWin.deactivate(); this._customWindows[targetWinId].activate(); this._customWindows[targetWinId].select(0);
        }
        break;
      }
      case 'script': {
        if (handler.code) {
          try {
            var $ctx = this._ctx; var fn = new Function('$ctx', handler.code); fn.call(this, $ctx);
          } catch (e) {
            console.error('[CustomScene] script error:', e);
          }
          this._refreshDisplayWindows(); if (cmdWin) cmdWin.activate();
        }
        break;
      }
      default: this._executeWidgetHandler(handler, null); break;
    }
  };
  Scene_CustomUI.prototype._refreshDisplayWindows = function () {
    var sceneDef = this._getSceneDef(); if (!sceneDef) return; var windows = sceneDef.windows || [];
    for (var i = 0; i < windows.length; i++) {
      if (windows[i].windowType === 'display') {
        var win = this._customWindows[windows[i].id]; if (win && win.refresh) win.refresh();
      }
    }
  }; window.Scene_CustomUI = Scene_CustomUI;
  function _findWidgetDefById(root, id) {
    if (!root) return null; if (root.id === id) return root; var children = root.children || [];
    for (var i = 0; i < children.length; i++) {
      var found = _findWidgetDefById(children[i], id); if (found) return found;
    }
    return null;
  }
  function _applyPosToWidget(widget, pos) {
    var dobj = widget.displayObject ? widget.displayObject() : null; if (!dobj) return;
    if (typeof dobj.move === 'function') {
      dobj.move(pos.x, pos.y, pos.width, pos.height);
    } else {
      dobj.x = pos.x; dobj.y = pos.y;
    }
    widget._x = pos.x; widget._y = pos.y; widget._width = pos.width; widget._height = pos.height;
  }
  function _saveSceneDef(sceneDef, callback) {
    try {
      var xhr = new XMLHttpRequest(); xhr.open('PUT', '/api/ui-editor/scenes/' + sceneDef.id, true); xhr.setRequestHeader('Content-Type', 'application/json');
      if (callback) {
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) callback();
        };
      }
      xhr.send(JSON.stringify(sceneDef));
    } catch (e) {}
  }
