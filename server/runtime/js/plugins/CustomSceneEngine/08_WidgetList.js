  function Widget_TextList() {}
  Widget_TextList.prototype = Object.create(Widget_Base.prototype); Widget_TextList.prototype.constructor = Widget_TextList;
  Widget_TextList.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget); this._items = def.items || def.commands || [];
    this._handlersDef = def.handlers || {}; this._dataScript = def.dataScript || null; this._onCursorDef = def.onCursor || null;
    this._autoHeight = def.autoHeight || false; this._autoRefresh = (def.autoRefresh !== false);
    this._focusable = (def.focusable !== false); this._itemSceneId = def.itemScene || null; this._rowWidgets = []; this._rowOverlay = null;
    var listDef = {
      id: def.id, width: def.width,
      commands: this._items,
      maxCols: def.maxCols || 1,
      rowHeight: def.rowHeight || 0,
    }; if (def.height) listDef.height = def.height;
    if (def.padding !== undefined) listDef.padding = def.padding; var win = new Window_CustomCommand(this._x, this._y, listDef);
    win._customClassName = 'Widget_CS_' + this._id;
    if (this._itemSceneId) {
      win.setBackgroundType(2); win.drawItem = function() {};
    }
    win.deactivate(); win.deselect();
    if (this._autoHeight) {
      if (this._dataScript) {
        win.height = 0;
      } else {
        var itemCount = this._items.length; win.height = itemCount > 0 ? win.fittingHeight(itemCount) : 0;
      }
    }
    if (!this._focusable) {
      win.updateCursor = function() { this.setCursorRect(0, 0, 0, 0); };
      win._updateCursor = function() { if (this._windowCursorSprite) this._windowCursorSprite.visible = false; };
    }
    this._applyWindowStyle(win, def); if (def.windowed !== false && def.bgAlpha !== undefined) win.opacity = Math.round(def.bgAlpha * 255);
    this._baseOpacity = win.opacity; this._window = win; this._displayObject = win; this._createDecoSprite(def, this._width, def.height || 400);
    if (this._onCursorDef && this._onCursorDef.code) {
      var onCursorCode = this._onCursorDef.code;
      win.callUpdateHelp = function() {
        try {
          var scene = SceneManager._scene;
          if (scene) { var $ctx = scene._ctx || {}; var fn = new Function('$ctx', onCursorCode); fn.call(scene, $ctx); }
        } catch(e) {
          console.error('[Widget_List] onCursor error:', e);
        }
      };
    }
    if (this._itemSceneId) {
      var overlay = new Sprite(); var _overlayPad = win._padding != null ? win._padding : win.standardPadding();
      overlay.x = this._x + _overlayPad; overlay.y = this._y + _overlayPad; this._rowOverlay = overlay;
    }
  };
  Widget_TextList.prototype._rebuildFromScript = function() {
    if (!this._dataScript || !this._window) return;
    try {
      var $ctx = (SceneManager._scene && SceneManager._scene._ctx) || {};
      var items = (new Function('$ctx', 'return (' + this._dataScript + ')'))($ctx); if (!Array.isArray(items)) items = []; this._window._winDef.commands = items;
      if (this._autoHeight) this._window.height = items.length > 0 ? this._window.fittingHeight(items.length) : 0;
      if (this._window.refresh) this._window.refresh(); if (this._itemSceneId) this._rebuildRows();
      if (items.length === 0) {
        this._window.deselect(); if (this._window._windowCursorSprite) this._window._windowCursorSprite.visible = false;
      } else if (!this._window.active) {
        var curIdx = this._window._index;
        var clampedIdx = (curIdx >= 0 && curIdx < items.length) ? curIdx
          : (this._lastIndex !== undefined && this._lastIndex >= 0 && this._lastIndex < items.length)
          ? this._lastIndex : 0;
        if (this._window._index !== clampedIdx) {
          this._window._index = clampedIdx; this._window.updateCursor();
        }
        if (this._window._windowCursorSprite) this._window._windowCursorSprite.visible = true;
      }
    } catch(e) {
      console.error('[Widget_List] dataScript error:', e);
    }
  };
  Widget_TextList.prototype._rebuildRows = function() {
    if (!this._itemSceneId || !this._rowOverlay) return; var scene = SceneManager._scene;    if (!scene || !scene._buildWidget) return; var subSceneDef = (_scenesData.scenes || {})[this._itemSceneId]; if (!subSceneDef || !subSceneDef.root) return;
    function patchFillWidth(node, w) {
      var children = node.children || [];
      for (var ci = 0; ci < children.length; ci++) {
        if (children[ci].fillWidth) children[ci].width = w; patchFillWidth(children[ci], w);
      }
    }
    for (var di = 0; di < this._rowWidgets.length; di++) if (this._rowWidgets[di]) this._rowWidgets[di].destroy();
    this._rowWidgets = []; while (this._rowOverlay.children.length > 0) this._rowOverlay.removeChildAt(0);
    var win = this._window; var commands = (win._winDef && win._winDef.commands) || [];
    var itemW = win.itemWidth ? win.itemWidth() : (this._width - (win._padding || win.standardPadding()) * 2);
    var itemH = win.itemHeight ? win.itemHeight() : win.lineHeight();
    for (var i = 0; i < commands.length; i++) {
      var rowData = commands[i] || {}; var instanceCtx = {}; for (var k in rowData) if (Object.prototype.hasOwnProperty.call(rowData, k)) instanceCtx[k] = rowData[k];
      var rootDef = JSON.parse(JSON.stringify(subSceneDef.root)); rootDef.x = 0; rootDef.y = 0; rootDef.width = itemW; rootDef.height = itemH; patchFillWidth(rootDef, itemW);
      var rowWidget = {
        _subRoot: null,
        _container: null,
        _instanceCtx: instanceCtx,
        _scene: scene,
        destroy: function() {
          if (this._subRoot) { this._subRoot.destroy(); this._subRoot = null; } if (this._container) { this._container.destroy(); this._container = null; }
        },
        _withCtx: function(fn) {
          var c = this._scene && this._scene._ctx;
          if (!c) { fn(); return; }
          var ic = this._instanceCtx; var sv = {}; Object.keys(ic).forEach(function(key) { sv[key] = c[key]; c[key] = ic[key]; });
          try { fn(); } finally { Object.keys(sv).forEach(function(key) { c[key] = sv[key]; }); }
        }
      }; var rowContainer = new Sprite(); rowWidget._container = rowContainer;
      rowWidget._withCtx(function() {
        var built = scene._buildWidget(rootDef, null);
        if (built) {
          rowWidget._subRoot = built; var dobj = built.displayObject(); if (dobj && !(dobj instanceof Window_Base)) rowContainer.addChild(dobj);
          if (scene._setupWidgetHandlers) scene._setupWidgetHandlers(built);
        }
      }); var rect = win.itemRect(i); rowContainer.x = rect.x; rowContainer.y = rect.y;
      rowContainer.opacity = (rowData.enabled === false) ? 160 : 255; this._rowOverlay.addChild(rowContainer); this._rowWidgets.push(rowWidget);
    }
  };
  Widget_TextList.prototype._updateRowPositions = function() {
    if (!this._rowWidgets.length || !this._window) return; var win = this._window; var commands = (win._winDef && win._winDef.commands) || [];
    for (var i = 0; i < this._rowWidgets.length; i++) {
      var rw = this._rowWidgets[i]; if (!rw || !rw._container) continue; var rect = win.itemRect(i); rw._container.x = rect.x;
      rw._container.y = rect.y; var rowData = commands[i] || {}; rw._container.opacity = (rowData.enabled === false) ? 160 : 255;
    }
  }; Widget_TextList.prototype.collectFocusable = function(out) { if (this._focusable !== false) out.push(this); };
  Widget_TextList.prototype.activate = function() {
    if (this._dataScript) this._rebuildFromScript();
    if (this._window) {
      this._window.activate(); var maxItems = this._window.maxItems();
      if (maxItems > 0) {
        var restore = (this._lastIndex !== undefined && this._lastIndex >= 0 && this._lastIndex < maxItems)
          ? this._lastIndex : 0;
        if (!this._hasActivated && this._def && this._def.initialIndexExpr) {
          try {
            var initIdx = Number(new Function('return (' + this._def.initialIndexExpr + ')')()); if (!isNaN(initIdx) && initIdx >= 0 && initIdx < maxItems) restore = initIdx;
          } catch(e) {}
        }
        this._hasActivated = true; this._window.select(restore);
      } else this._window.deselect();
    }
  };
  Widget_TextList.prototype.deactivate = function() {
    if (this._window) {
      this._lastIndex = this._window.index(); this._window.deactivate();
    }
  };
  Widget_TextList.prototype.refresh = function() {
    if (this._dataScript) this._rebuildFromScript(); else if (this._itemSceneId) this._rebuildRows(); Widget_Base.prototype.refresh.call(this);
  }; Widget_TextList.prototype.setHandler = function(symbol, fn) { if (this._window) this._window.setHandler(symbol, fn); };
  Widget_TextList.prototype.setCancelHandler = function(fn) { if (this._window) this._window.setHandler('cancel', fn); };
  Widget_TextList.prototype.update = function() {
    if (this._updateCount === undefined) this._updateCount = 0; ++this._updateCount;
    if (this._dataScript && this._autoRefresh !== false) {
      if (this._updateCount % 6 === 0) this._rebuildFromScript();
    } else if (!this._dataScript) {
      var items = this._items;
      var hasCondition = items && items.some(function(item) { return typeof item.enabledCondition === 'string' && item.enabledCondition;       });
      if (hasCondition && this._updateCount % 60 === 0 && this._window) this._window.refresh();
    }
    if (this._rowOverlay && this._window) this._rowOverlay.visible = this._window.visible;
    if (this._itemSceneId && this._rowWidgets.length > 0) {
      this._updateRowPositions();
      for (var ri = 0; ri < this._rowWidgets.length; ri++) {
        var rw = this._rowWidgets[ri]; if (rw && rw._subRoot) rw._withCtx(function() { rw._subRoot.update(); });
      }
    }
    if (this._window && this._def && this._def.dimOnInactive !== false && !this._itemSceneId) {
      var baseOp = this._baseOpacity !== undefined ? this._baseOpacity : 255;
      var targetOp = this._window.active ? baseOp : Math.round(baseOp * 0.63); if (this._window.opacity !== targetOp) this._window.opacity = targetOp;
    }
    Widget_Base.prototype.update.call(this);
  }; Widget_TextList.prototype.handlesUpDown = function() { return true; };
  Widget_TextList.prototype.destroy = function() {
    if (this._itemSceneId) {
      for (var di = 0; di < this._rowWidgets.length; di++) if (this._rowWidgets[di]) this._rowWidgets[di].destroy(); this._rowWidgets = [];
    }
    if (this._rowOverlay && this._rowOverlay.destroy) {
      this._rowOverlay.destroy(); this._rowOverlay = null;
    }
    Widget_Base.prototype.destroy.call(this);
  }; window.Widget_TextList = Widget_TextList;
  function Widget_List() {}
  Widget_List.prototype = Object.create(Widget_TextList.prototype); Widget_List.prototype.constructor = Widget_List;
  Widget_List.prototype.initialize = function(def, parentWidget) {
    Widget_TextList.prototype.initialize.call(this, def, parentWidget);
    if (def.cursorOnly) {
      var win = this._window; win.setBackgroundType(2); win.drawItem = function() {}; win._padding = 0;
      win.standardPadding = function() { return 0; }; win.spacing = function() { return 0; };
      win.cursorDown = function() {}; win.cursorUp   = function() {}; this.handlesUpDown = function() { return false; };
      win._updateCursor = function() {
        var spr = this._windowCursorSprite; if (!spr) return; spr.visible = this.isOpen() && this._cursorRect.width > 0; if (!spr.visible) return;
        if (this.active) {
          var blinkCount = this._animationCount % 40; var opacity = this.contentsOpacity;
          if (blinkCount < 20) opacity -= blinkCount * 8; else                 opacity -= (40 - blinkCount) * 8; spr.alpha = Math.max(0, opacity) / 255;
        } else spr.alpha = 0.5;
      }; var cursorOverlay = new Sprite(); cursorOverlay.x = this._x; cursorOverlay.y = this._y;
      this._rowOverlay = cursorOverlay; this._csCursorReparented = false; this._autoRefresh = false; win.visible = false;
    }
  };
  Widget_List.prototype.show = function() {
    if (this._def && this._def.cursorOnly) {
      this._csCursorOverlayVisible = true; if (this._rowOverlay) this._rowOverlay.visible = true;
    } else Widget_Base.prototype.show.call(this);
    if (!this._builtOnce && this._dataScript) {
      this._builtOnce = true; this._rebuildFromScript();
    }
  };
  Widget_List.prototype.hide = function() {
    if (!(this._def && this._def.cursorOnly)) Widget_Base.prototype.hide.call(this);
    this._csCursorOverlayVisible = false; if (this._rowOverlay) this._rowOverlay.visible = false;
  };
  Widget_List.prototype.update = function() {
    Widget_TextList.prototype.update.call(this);
    if (this._def && this._def.cursorOnly) {
      this._updateCursorOverlay(); if (this._rowOverlay && this._csCursorOverlayVisible !== undefined) this._rowOverlay.visible = this._csCursorOverlayVisible;
    }
  };
  Widget_List.prototype._updateCursorOverlay = function() {
    var win = this._window; if (!win || !win._windowCursorSprite) return;
    if (!this._csCursorReparented) {
      var spr = win._windowCursorSprite; if (spr.parent) spr.parent.removeChild(spr); this._rowOverlay.addChild(spr); this._csCursorReparented = true;
    }
  }; Widget_List.prototype.select   = function(i) { if (this._window) this._window.select(i); };
  Widget_List.prototype.deselect = function()  { if (this._window) this._window.deselect(); }; window.Widget_List = Widget_List;
  function NavigationManager() {}
  NavigationManager.prototype.initialize = function(config) {
    config = config || {}; this._defaultFocusId = config.defaultFocus || null; this._cancelWidgetId = config.cancelWidget || null;
    this._focusables = []; this._activeIndex = -1; this._scene = null; this._pendingNavDir = null; this._navPrevDir = null; this._navRepeatTimer = 0; var self = this;
    var keyDirMap = { 38:'up', 40:'down', 37:'left', 39:'right',
                      87:'up', 83:'down', 65:'left', 68:'right' };
    this._keydownHandler = function(e) {
      var dir = keyDirMap[e.keyCode];
      if (dir) { self._pendingNavDir = dir; }
    }; document.addEventListener('keydown', this._keydownHandler);
  };
  NavigationManager.prototype.dispose = function() {
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler); this._keydownHandler = null;
    }
  }; NavigationManager.prototype.setScene = function(scene) { this._scene = scene; };
  NavigationManager.prototype.buildFocusList = function(rootWidget) {
    var all = []; rootWidget.collectFocusable(all); this._focusables = all;
  };
  NavigationManager.prototype.start = function() {
    if (this._focusables.length === 0) return; var startIdx = 0;
    if (this._defaultFocusId) {
      var dfid = this._defaultFocusId; var dfSimple = dfid.indexOf('/') >= 0 ? dfid.split('/').pop() : dfid;
      for (var i = 0; i < this._focusables.length; i++) {
        var w = this._focusables[i]; if (w._id === dfid || w._fullPath === dfid || (dfid.indexOf('/') >= 0 && w._id === dfSimple)) startIdx = i; break;
      }
    }
    this._activateAt(startIdx);
  };
  NavigationManager.prototype._activateAt = function(idx) {
    if (idx < 0 || idx >= this._focusables.length) return;
    if (this._activeIndex >= 0 && this._focusables[this._activeIndex]) {
      var prevW = this._focusables[this._activeIndex]; prevW.deactivate(); prevW._runScript('onBlur');
    }
    this._activeIndex = idx; this._focusables[idx].activate(); this._focusables[idx]._runScript('onFocus');
  };
  NavigationManager.prototype.focusWidget = function(id) {
    var simpleId = id.indexOf('/') >= 0 ? id.split('/').pop() : id;
    for (var i = 0; i < this._focusables.length; i++) {
      var w = this._focusables[i]; if (w._id === id || w._fullPath === id || (id.indexOf('/') >= 0 && w._id === simpleId)) this._activateAt(i); return;
    }
  };
  NavigationManager.prototype.clearFocus = function() {
    if (this._activeIndex >= 0 && this._focusables[this._activeIndex]) {
      this._focusables[this._activeIndex].deactivate(); this._focusables[this._activeIndex]._runScript('onBlur');
    }
    this._activeIndex = -1;
  };
  NavigationManager.prototype.focusNext = function() {
    var next = (this._activeIndex + 1) % this._focusables.length; if (typeof SoundManager !== 'undefined') SoundManager.playCursor(); this._activateAt(next);
  };
  NavigationManager.prototype.focusPrev = function() {
    var prev = (this._activeIndex - 1 + this._focusables.length) % this._focusables.length;
    if (typeof SoundManager !== 'undefined') SoundManager.playCursor(); this._activateAt(prev);
  };
  NavigationManager.prototype.update = function() {
    if (this._focusables.length === 0) return;
    var activeWidget = this._activeIndex >= 0 ? this._focusables[this._activeIndex] : null; var DIRS = ['up', 'down', 'left', 'right']; var dirPressed = null;    for (var di = 0; di < DIRS.length; di++) {
      if (Input.isPressed(DIRS[di])) { dirPressed = DIRS[di]; break; }
    }
    if (!dirPressed && this._pendingNavDir) dirPressed = this._pendingNavDir; this._pendingNavDir = null; var doMove = false;
    if (dirPressed) {
      if (this._navPrevDir !== dirPressed) {
        this._navPrevDir = dirPressed; this._navRepeatTimer = 0; doMove = true;
      } else {
        this._navRepeatTimer++; var wait = Input.keyRepeatWait || 24; var interval = Input.keyRepeatInterval || 6;
        if (this._navRepeatTimer >= wait && (this._navRepeatTimer - wait) % interval === 0) doMove = true;
      }
    } else {
      this._navPrevDir = null; this._navRepeatTimer = 0;
    }
    if (doMove && activeWidget && activeWidget._def) {
      var def = activeWidget._def; var navTarget = null; if      (dirPressed === 'up')    navTarget = def.navUp    || null;
      else if (dirPressed === 'down')  navTarget = def.navDown  || null; else if (dirPressed === 'left')  navTarget = def.navLeft  || null;
      else if (dirPressed === 'right') navTarget = def.navRight || null;
      if (navTarget) {
        if (typeof SoundManager !== 'undefined') SoundManager.playCursor(); this.focusWidget(navTarget); return;
      }
    }
    if (this._focusables.length <= 1) return; if (Input.isTriggered('pagedown')) this.focusNext(); else if (Input.isTriggered('pageup')) this.focusPrev();
  }; window.NavigationManager = NavigationManager;
