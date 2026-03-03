  function Window_CustomCommand() {
    this.initialize.apply(this, arguments);
  }
  Window_CustomCommand.prototype = Object.create(Window_Command.prototype); Window_CustomCommand.prototype.constructor = Window_CustomCommand;
  Window_CustomCommand.prototype.initialize = function (x, y, winDef) {
    this._winDef = winDef || {}; this._customClassName = 'Window_CS_' + (winDef && winDef.id ? winDef.id : 'unknown'); Window_Command.prototype.initialize.call(this, x, y);
  }; Window_CustomCommand.prototype.windowWidth = function () { return this._winDef.width || 240; };
  Window_CustomCommand.prototype.windowHeight = function () {
    if (this._winDef.height) return this._winDef.height; return this.fittingHeight(this.numVisibleRows());
  };
  Window_CustomCommand.prototype.numVisibleRows = function () {
    var cmds = this._winDef.commands || []; var cols = this._winDef.maxCols || 1; return Math.ceil(cmds.length / cols);
  }; Window_CustomCommand.prototype.maxCols = function () { return this._winDef.maxCols || 1; };
  Window_CustomCommand.prototype.makeCommandList = function () {
    var cmds = this._winDef.commands || [];
    for (var i = 0; i < cmds.length; i++) {
      var cmd = cmds[i]; var isEnabled;
      if (typeof cmd.enabledCondition === 'string' && cmd.enabledCondition) {
        try { isEnabled = !!(new Function('return ' + cmd.enabledCondition)()); }
        catch(e) { isEnabled = true; }
      } else isEnabled = cmd.enabled !== false; var name = resolveTemplate(cmd.name || cmd.text);
      this.addCommand(name, cmd.symbol, isEnabled, cmd.ext !== undefined ? cmd.ext : null);
    }
  };
  Window_CustomCommand.prototype.standardPadding = function() {
    if (this._winDef && this._winDef.padding !== undefined) return this._winDef.padding; return Window_Command.prototype.standardPadding.call(this);
  }; Window_CustomCommand.prototype.itemHeight = function() { return this._winDef.rowHeight || this.lineHeight(); };
  Window_CustomCommand.prototype.maxPageRows = function() { return Math.max(1, Window_Selectable.prototype.maxPageRows.call(this)); };
  Window_CustomCommand.prototype.drawItem = function(index) {
    var cmd = this._winDef.commands && this._winDef.commands[index]; var rect = this.itemRectForText(index);
    var rh   = this._winDef.rowHeight || this.lineHeight(); var lh   = this.lineHeight();
    var hasSub = cmd && cmd.subText; var nameY = Math.max(rect.y, rect.y + Math.floor((rh - lh * (hasSub ? 2 : 1)) / 2));
    this.resetTextColor(); if (cmd && cmd.textColor) this.changeTextColor(cmd.textColor); this.changePaintOpacity(this.isCommandEnabled(index));
    if (cmd && cmd.cols && cmd.cols.length > 0) {
      var cx = rect.x; var colIw = Window_Base._iconWidth || 32; for (var ci = 0; ci < cmd.cols.length; ci++) {
        var col = cmd.cols[ci]; this.resetTextColor(); if (col.color !== undefined) this.changeTextColor(this.textColor(col.color));
        this.changePaintOpacity(this.isCommandEnabled(index)); var textX = cx;
        if (col.iconIndex) {
          this.drawIcon(col.iconIndex, textX, nameY + Math.floor((lh - colIw) / 2)); textX += colIw + 4;
        }
        this.drawTextEx(col.text || '', textX, nameY);
        if (col.width !== undefined) {
          cx += col.width;
        } else break;
      }
      this.resetTextColor(); return;
    }
    var x = rect.x; var iconIdx = cmd && cmd.iconIndex;
    if (iconIdx) {
      var iw = Window_Base._iconWidth || 32; this.drawIcon(iconIdx, x, nameY + Math.floor((lh - iw) / 2)); x += iw + 4;
    }
    var numStr = (cmd && cmd.numberText !== undefined && cmd.numberText !== null)
      ? String(cmd.numberText) : null;
    var nameWidth = rect.width - (x - rect.x);
    if (numStr !== null) {
      var numW = this.textWidth(numStr) + 16; this.drawText(numStr, rect.x, nameY, rect.width, 'right'); nameWidth -= numW;
    }
    if (numStr !== null) {
      this.drawText(this.commandName(index), x, nameY, nameWidth, 'left');
    } else this.drawTextEx(this.commandName(index), x, nameY);
    if (hasSub) {
      if (!cmd.textColor) this.changeTextColor(this.textColor(8)); this.drawTextEx(cmd.subText, x, nameY + lh); this.resetTextColor();
    }
    if (cmd && cmd.rightText) {
      this.resetTextColor();
      if (cmd.rightTextColorIndex !== undefined) {
        this.changeTextColor(this.textColor(cmd.rightTextColorIndex)); this.changePaintOpacity(this.isCommandEnabled(index));
        this.drawText(cmd.rightText, rect.x, nameY, rect.width, 'right'); this.resetTextColor();
      } else {
        this.changePaintOpacity(this.isCommandEnabled(index)); this.drawText(cmd.rightText, rect.x, rect.y + rect.height - lh, rect.width, 'right');
      }
    }
    if (cmd && cmd.characters && cmd.characters.length > 0) {
      this.changePaintOpacity(this.isCommandEnabled(index));
      for (var ci = 0; ci < cmd.characters.length; ci++) {
        var cd = cmd.characters[ci]; if (cd && cd.length >= 4) this.drawCharacter(cd[0], cd[1], rect.x + cd[2], rect.y + cd[3]);
      }
    }
    if (cmd && cmd.images && cmd.images.length > 0) {
      this.changePaintOpacity(this.isCommandEnabled(index));
      for (var ii = 0; ii < cmd.images.length; ii++) {
        var imgDef = cmd.images[ii]; if (!imgDef || !imgDef.bitmapExpr) continue; var bitmap = null;
        try { bitmap = new Function('return (' + imgDef.bitmapExpr + ')')(); } catch(e) {}
        if (!bitmap || !bitmap.width) continue; var ix = rect.x + (imgDef.x || 0); var iy = rect.y + (imgDef.y || 0);
        var iw = imgDef.w !== undefined ? imgDef.w : bitmap.width; var ih = imgDef.h !== undefined ? imgDef.h : bitmap.height;
        if (imgDef.srcRect) {
          var sr = imgDef.srcRect; this.contents.blt(bitmap, sr.x, sr.y, sr.w, sr.h, ix, iy, iw, ih);
        } else this.contents.blt(bitmap, 0, 0, bitmap.width, bitmap.height, ix, iy, iw, ih);
      }
    }
    if (cmd && cmd.textColor) this.resetTextColor();
  };
  Window_CustomCommand.prototype.item = function() {
    var cmd = this._winDef.commands && this._winDef.commands[this.index()]; return (cmd && cmd.data !== undefined) ? cmd.data : null;
  }; window.Window_CustomCommand = Window_CustomCommand;
  function Window_CustomDisplay() {
    this.initialize.apply(this, arguments);
  }
  Window_CustomDisplay.prototype = Object.create(Window_Base.prototype); Window_CustomDisplay.prototype.constructor = Window_CustomDisplay;
  Window_CustomDisplay.prototype.initialize = function (x, y, width, height, winDef) {
    this._winDef = winDef || {}; this._customClassName = 'Window_CS_' + (winDef && winDef.id ? winDef.id : 'unknown');
    Window_Base.prototype.initialize.call(this, x, y, width, height); this.refresh();
  };
  Window_CustomDisplay.prototype.refresh = function () {
    if (!this.contents) return; this.contents.clear();
    var elements = this._winDef.elements || []; for (var i = 0; i < elements.length; i++) this.drawElement(elements[i]);
  };
  Window_CustomDisplay.prototype.drawElement = function (elem) {
    if (!elem || !elem.type) return; var actor = null; if (typeof $gameParty !== 'undefined' && $gameParty.leader) actor = $gameParty.leader();
    if (!actor && typeof $gameActors !== 'undefined' && $gameActors.actor) actor = $gameActors.actor(1); var x = elem.x || 0; var y = elem.y || 0; var w = elem.width || 200;    var h = elem.height || this.lineHeight(); var align = elem.align || 'left';
    switch (elem.type) {
      case 'label':
      case 'text': this.drawTextEx(elem.content || '', x, y); break; case 'actorFace': if (actor) this.drawActorFace(actor, x, y, w, h); break;
      case 'actorName': if (actor) this.drawActorName(actor, x, y, w); break;
      case 'actorClass': if (actor) this.drawActorClass(actor, x, y, w); break; case 'actorLevel': if (actor) this.drawActorLevel(actor, x, y); break;
      case 'actorHp': if (actor) this.drawActorHp(actor, x, y, w); break; case 'actorMp': if (actor) this.drawActorMp(actor, x, y, w); break;
      case 'actorTp': if (actor) this.drawActorTp(actor, x, y, w); break; case 'actorIcons': if (actor) this.drawActorIcons(actor, x, y); break;
      case 'gold': if (typeof $gameParty !== 'undefined' && typeof TextManager !== 'undefined') this.drawCurrencyValue($gameParty.gold(), TextManager.currencyUnit, x, y, w); break;
      case 'variable': {
        var varVal = typeof $gameVariables !== 'undefined' ? $gameVariables.value(elem.varId || 0) : 0;
        this.drawText(String(varVal) + (elem.suffix || ''), x, y, w, align); break;
      }
      case 'image':
        if (typeof ImageManager !== 'undefined' && elem.imageName) {
          var folder = elem.imageFolder || 'img/system/'; var bitmap = ImageManager.loadBitmap(folder, elem.imageName); var self = this;
          bitmap.addLoadListener(function () {
            var sw = elem.srcWidth || bitmap.width; var sh = elem.srcHeight || bitmap.height; self.contents.blt(bitmap, 0, 0, sw, sh, x, y, w, h);
          });
        }
        break;
      case 'separator':
        var lineY = y + this.lineHeight() / 2 - 1; this.contents.paintOpacity = 48;
        this.contents.fillRect(x, lineY, w, 2, this.normalColor()); this.contents.paintOpacity = 255; break;
    }
  }; window.Window_CustomDisplay = Window_CustomDisplay;
  function Widget_Scene() {}
  Widget_Scene.prototype = Object.create(Widget_Base.prototype); Widget_Scene.prototype.constructor = Widget_Scene;
  Widget_Scene.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget); this._instanceCtx = def.instanceCtx || {};
    this._sceneId = def.sceneId || ''; this._subRoot = null; var container = new Sprite(); container.x = this._x; container.y = this._y;
    this._displayObject = container; var subSceneDef = (_scenesData.scenes || _scenesData)[this._sceneId];
    if (!subSceneDef || !subSceneDef.root) return; var rootDef = JSON.parse(JSON.stringify(subSceneDef.root));
    rootDef.x = 0; rootDef.y = 0; if (def.width  !== undefined) rootDef.width  = def.width; if (def.height !== undefined) rootDef.height = def.height; var self = this;
    this._withCtx(function() {
      var scene = SceneManager._scene; if (!scene || !scene._buildWidget) return;
      var root = scene._buildWidget(rootDef, null); if (!root) return; self._subRoot = root; var dobj = root.displayObject();
      if (dobj && !(dobj instanceof Window_Base)) container.addChild(dobj);
    });
  };
  Widget_Scene.prototype._withCtx = function(fn) {
    var scene = SceneManager._scene;
    if (!scene || !scene._ctx) { fn(); return; }
    var ctx = scene._ctx; var ic = this._instanceCtx; var saved = {}; Object.keys(ic).forEach(function(k) { saved[k] = ctx[k]; ctx[k] = ic[k]; });
    try { fn(); } finally {
      Object.keys(saved).forEach(function(k) { ctx[k] = saved[k]; });
    }
  };
  Widget_Scene.prototype.refresh = function() {
    if (!this._subRoot) return; var self = this; this._withCtx(function() { self._subRoot.refresh(); });
  };
  Widget_Scene.prototype._collectWindowDescendants = function(out) {
    if (!this._subRoot) return; if (this._subRoot.displayObject() instanceof Window_Base) out.push(this._subRoot); this._subRoot._collectWindowDescendants(out);
  };
  Widget_Scene.prototype.update = function() {
    this._syncWindowDescendants(); if (!this._subRoot) return; var self = this; this._withCtx(function() { self._subRoot.update(); });
  };
  Widget_Scene.prototype.findWidget = function(id) {
    if (this._id === id) return this; if (this._subRoot) return this._subRoot.findWidget(id); return null;
  };
  Widget_Scene.prototype.destroy = function() {
    if (this._subRoot) { this._subRoot.destroy(); this._subRoot = null; }
    Widget_Base.prototype.destroy.call(this);
  }; window.Widget_Scene = Widget_Scene;
  function Window_CustomOptions() {
    this.initialize.apply(this, arguments);
  }
  Window_CustomOptions.prototype = Object.create(Window_Command.prototype); Window_CustomOptions.prototype.constructor = Window_CustomOptions;
  Window_CustomOptions.prototype.initialize = function(x, y, winDef) {
    this._winDef = winDef || {}; this._customClassName = 'Window_CS_' + (winDef && winDef.id ? winDef.id : 'options'); Window_Command.prototype.initialize.call(this, x, y);
  }; Window_CustomOptions.prototype.windowWidth = function() { return this._winDef.width || 400; };
  Window_CustomOptions.prototype.windowHeight = function() {
    if (this._winDef.height) return this._winDef.height; var opts = this._winDef.options || []; return this.fittingHeight(Math.max(opts.length, 1));
  };
  Window_CustomOptions.prototype.numVisibleRows = function() {
    var opts = this._winDef.options || []; return opts.length || 1;
  };
  Window_CustomOptions.prototype.makeCommandList = function() {
    var opts = this._winDef.options || []; for (var i = 0; i < opts.length; i++) this.addCommand(opts[i].name, opts[i].symbol);
  }; Window_CustomOptions.prototype.statusWidth = function() { return 120; };
  Window_CustomOptions.prototype.drawItem = function(index) {
    var rect = this.itemRectForText(index); var sw = this.statusWidth(); var titleWidth = rect.width - sw; this.resetTextColor();
    this.changePaintOpacity(this.isCommandEnabled(index)); this.drawText(this.commandName(index), rect.x, rect.y, titleWidth, 'left');
    this.drawText(this.statusText(index), titleWidth, rect.y, sw, 'right'); this.changePaintOpacity(true);
  };
  Window_CustomOptions.prototype.statusText = function(index) {
    var symbol = this.commandSymbol(index); var value = this.getConfigValue(symbol);
    if (this.isVolumeSymbol(symbol)) return (value || 0) + '%'; return value ? 'ON' : 'OFF';
  };
  Window_CustomOptions.prototype.isVolumeSymbol = function(symbol) {
    var opts = this._winDef.options || []; for (var i = 0; i < opts.length; i++) if (opts[i].symbol === symbol) return opts[i].optionType === 'volume';
    return symbol && symbol.indexOf('Volume') >= 0;
  }; Window_CustomOptions.prototype.getConfigValue = function(symbol) { return typeof ConfigManager !== 'undefined' ? ConfigManager[symbol] : undefined; };
  Window_CustomOptions.prototype.setConfigValue = function(symbol, value) { if (typeof ConfigManager !== 'undefined') ConfigManager[symbol] = value; };
  Window_CustomOptions.prototype.changeValue = function(symbol, value) {
    var last = this.getConfigValue(symbol);
    if (last !== value) {
      this.setConfigValue(symbol, value); this.redrawItem(this.findSymbol(symbol)); if (typeof SoundManager !== 'undefined') SoundManager.playCursor();
    }
  }; Window_CustomOptions.prototype.volumeOffset = function() { return 20; };
  Window_CustomOptions.prototype.processOk = function() {
    var symbol = this.commandSymbol(this.index()); var value = this.getConfigValue(symbol);
    if (this.isVolumeSymbol(symbol)) {
      value = ((value || 0) + this.volumeOffset()); if (value > 100) value = 0;
    } else value = !value; this.changeValue(symbol, value);
  };
  Window_CustomOptions.prototype.cursorRight = function(wrap) {
    var symbol = this.commandSymbol(this.index()); var value = this.getConfigValue(symbol);
    if (this.isVolumeSymbol(symbol)) {
      value = Math.min(100, (value || 0) + this.volumeOffset()); this.changeValue(symbol, value);
    } else this.changeValue(symbol, true);
  };
  Window_CustomOptions.prototype.cursorLeft = function(wrap) {
    var symbol = this.commandSymbol(this.index()); var value = this.getConfigValue(symbol);
    if (this.isVolumeSymbol(symbol)) {
      value = Math.max(0, (value || 0) - this.volumeOffset()); this.changeValue(symbol, value);
    } else this.changeValue(symbol, false);
  }; window.Window_CustomOptions = Window_CustomOptions;
  function Window_ButtonRow(x, y, w, h) {
    this.initialize.apply(this, arguments);
  }
  Window_ButtonRow.prototype = Object.create(Window_Selectable.prototype); Window_ButtonRow.prototype.constructor = Window_ButtonRow;
  Window_ButtonRow.prototype.initialize = function(x, y, w, h) {
    Window_Selectable.prototype.initialize.call(this, x, y, w, h); this._leftHandler = null; this._rightHandler = null; this.opacity = 0; this.backOpacity = 0;
  }; Window_ButtonRow.prototype.standardPadding = function() { return 0; }; Window_ButtonRow.prototype.maxItems = function() { return 1; };
  Window_ButtonRow.prototype.itemHeight = function() { return this.height; }; Window_ButtonRow.prototype.drawItem = function(index) {};
  Window_ButtonRow.prototype.setLeftHandler = function(fn) { this._leftHandler = fn; };
  Window_ButtonRow.prototype.setRightHandler = function(fn) { this._rightHandler = fn; };
  Window_ButtonRow.prototype.processHandling = function() {
    Window_Selectable.prototype.processHandling.call(this);
    if (this.isOpenAndActive()) {
      if (Input.isRepeated('left') && this._leftHandler) this._leftHandler(); if (Input.isRepeated('right') && this._rightHandler) this._rightHandler();
    }
  };
  Window_ButtonRow.prototype._updateCursor = function() {
    if (!this.active) {
      if (this._windowCursorSprite) this._windowCursorSprite.alpha = 0; return;
    }
    Window_Selectable.prototype._updateCursor.call(this);
  }; Window_ButtonRow.prototype.playOkSound = function() {}; window.Window_ButtonRow = Window_ButtonRow;
