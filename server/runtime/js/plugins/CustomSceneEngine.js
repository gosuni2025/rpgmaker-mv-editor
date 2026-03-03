//=============================================================================
// CustomSceneEngine.js
/*:
 * @plugindesc 커스텀 씬 엔진 - UIScenes/ 디렉터리에서 씬을 동적으로 생성
 * @author UI Editor
 * @require UITheme
 *
 * @help CustomSceneEngine.js
 *
 * data/UIScenes/_index.json + 씬별 JSON 파일을 읽어 커스텀 씬(Scene_CS_*)을 동적으로 생성합니다.
 * 에디터의 씬 에디터에서 정의한 씬을 게임 런타임에서 실행할 수 있습니다.
 *
 * ● 기본 동작
 *   data/UIScenes/_index.json 이 없으면 아무 씬도 등록하지 않습니다.
 *
 * ● 오버레이 씬 (Overlay Scene)
 *   에디터에서 커스텀 씬의 "오버레이 모드"를 활성화하면,
 *   씬 전환 없이 인게임 맵 위에 UI를 표시할 수 있습니다.
 *   여러 오버레이를 동시에 표시할 수 있습니다.
 *
 *   플러그인 커맨드:
 *     OVERLAY SHOW <sceneId>    — 오버레이 표시 (없으면 생성)
 *     OVERLAY HIDE <sceneId>    — 오버레이 숨김
 *     OVERLAY TOGGLE <sceneId>  — 토글
 *     OVERLAY DESTROY <sceneId> — 오버레이 제거 (다음 SHOW 시 재생성)
 *
 *   커스텀 씬 내에서 customScene/gotoScene 액션의 target이 오버레이 씬이면
 *   SceneManager.push 대신 OverlayManager.show를 자동 사용합니다.
 *   popScene 액션은 오버레이를 숨깁니다.
 *
 * ● 호환성
 *   RPG Maker MV 1.6.x 이상, NW.js 및 웹 브라우저 배포 모두 지원.
 *   이 플러그인은 에디터에서 자동으로 관리됩니다.
 */
(function () {
  'use strict'; var _scenesData = {}; var _configData = {};
  function loadJSON(url, fallback) {
    if (fallback === undefined) fallback = {};
    try {
      var xhr = new XMLHttpRequest(); xhr.open('GET', url + '?_=' + Date.now(), false);
      xhr.send(); if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
    } catch (e) {}
    return fallback;
  }
  function loadJSONSafe(url) { return loadJSON(url, null); }
  function loadScenesData() {
    var index = loadJSONSafe('data/UIScenes/_index.json'); if (!index || !Array.isArray(index)) return { scenes: {} }; var scenes = {};
    for (var i = 0; i < index.length; i++) {
      var scene = loadJSONSafe('data/UIScenes/' + index[i] + '.json'); if (scene && scene.id) scenes[scene.id] = scene;
    }
    return { scenes: scenes };
  }
  _scenesData = loadScenesData(); _configData = loadJSON('data/UIEditorConfig.json');
  function resolveTemplate(text) {
    if (!text || typeof text !== 'string') return text || ''; var result = ''; var i = 0;
    while (i < text.length) {
      if (text[i] !== '{') { result += text[i++]; continue; }
      var depth = 1, j = i + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++;
      }
      if (depth !== 0) { result += text[i++]; continue; }
      var expr = text.slice(i + 1, j - 1); result += _evalTemplateExpr(expr); i = j;
    }
    return result;
  }
  function _evalTemplateExpr(expr) {
    var actorMatch = expr.match(/^actor\[([^\]]+)\]\.(\w+)$/);
    if (actorMatch && typeof $gameParty !== 'undefined') {
      try {
        var members = $gameParty.members(); var idxExpr = actorMatch[1];
        var idx = /^\d+$/.test(idxExpr) ? parseInt(idxExpr) : (function() {
          try { var c = (SceneManager._scene && SceneManager._scene._ctx) || {};
                return Number(new Function('$ctx', 'return (' + idxExpr + ')')(c)) || 0;
          } catch(e) { return 0; }
        })(); var field = actorMatch[2]; var actor = members[idx]; if (!actor) return '';
        switch (field) {
          case 'name':  return actor.name(); case 'class': return actor.currentClass() ? actor.currentClass().name : '';
          case 'level': return String(actor.level); case 'hp':    return String(actor.hp); case 'mhp':   return String(actor.mhp); case 'mp':    return String(actor.mp);
          case 'mmp':   return String(actor.mmp); case 'tp':    return String(actor.tp); default:      return String(actor[field] !== undefined ? actor[field] : '');
        }
      } catch(e) { return ''; }
    }
    var varMatch = expr.match(/^var:(\d+)$/); if (varMatch && typeof $gameVariables !== 'undefined') return String($gameVariables.value(parseInt(varMatch[1])));
    var swMatch = expr.match(/^switch:(\d+)$/); if (swMatch && typeof $gameSwitches !== 'undefined') return $gameSwitches.value(parseInt(swMatch[1])) ? 'ON' : 'OFF';
    if (expr === 'gold' && typeof $gameParty !== 'undefined') return String($gameParty.gold());
    if (expr === 'mapName') {
      if (typeof MinimapManager !== 'undefined' && typeof MinimapManager.getMapName === 'function') return MinimapManager.getMapName();
      if (typeof $dataMapInfos !== 'undefined' && typeof $gameMap !== 'undefined') {
        var info = $dataMapInfos[$gameMap.mapId()]; return info ? (info.name || '') : '';
      }
      return '';
    }
    var cfgMatch = expr.match(/^config\.(\w+)$/);
    if (cfgMatch && typeof ConfigManager !== 'undefined') {
      var v = ConfigManager[cfgMatch[1]]; return typeof v === 'boolean' ? (v ? 'ON' : 'OFF') : String(v !== undefined ? v : '');
    }
    try {
      var $ctx = (SceneManager._scene && SceneManager._scene._ctx) || {}; var val = new Function('$ctx', 'return (' + expr + ')')($ctx); return val == null ? '' : String(val);
    } catch (e) {}
    return '';
  }
  Object.defineProperty(window, '$ctx', {
    get: function() { return (SceneManager._scene && SceneManager._scene._ctx) || {}; },
    configurable: true,
  });
  var CSHelper = {
    actorFace: function(actorIndex) {
      if (typeof $gameParty === 'undefined') return null; var actor = $gameParty.members()[actorIndex || 0]; return actor ? ImageManager.loadFace(actor.faceName()) : null;
    },
    actorFaceSrcRect: function(actorIndex) {
      if (typeof $gameParty === 'undefined') return null; var actor = $gameParty.members()[actorIndex || 0];
      if (!actor) return null; var i = actor.faceIndex(); return { x: i % 4 * 144, y: Math.floor(i / 4) * 144, w: 144, h: 144 };
    },
    actorCharacter: function(actorIndex) {
      if (typeof $gameParty === 'undefined') return null; var actor = $gameParty.members()[actorIndex || 0];
      return actor ? ImageManager.loadCharacter(actor.characterName()) : null;
    },
    actorCharacterSrcRect: function(actorIndex) {
      if (typeof $gameParty === 'undefined') return null; var actor = $gameParty.members()[actorIndex || 0]; if (!actor) return null; var charName  = actor.characterName();
      var charIndex = actor.characterIndex(); var bitmap    = ImageManager.loadCharacter(charName); var isBig     = ImageManager.isBigCharacter(charName); var cw, ch, sx, sy;
      if (isBig) {
        cw = Math.floor(bitmap.width  / 3); ch = Math.floor(bitmap.height / 4); sx = cw; sy = 0;
      } else {
        cw = Math.floor(bitmap.width  / 12); ch = Math.floor(bitmap.height / 8); sx = (charIndex % 4 * 3 + 1) * cw; sy = Math.floor(charIndex / 4) * 4 * ch;
      }
      return { x: sx, y: sy, w: cw, h: ch };
    },
    enemyBattler: function(enemy) {
      if (!enemy) return null;
      return (typeof $gameSystem !== 'undefined' && $gameSystem.isSideView())
        ? ImageManager.loadSvEnemy(enemy.battlerName, enemy.battlerHue)
        : ImageManager.loadEnemy(enemy.battlerName, enemy.battlerHue);
    },
    bitmap: function(folder, name) { return ImageManager.loadBitmap(folder, name);     },
    savefileCount: function() { return (typeof DataManager !== 'undefined') ? DataManager.maxSavefiles() : 0;     },
    savefileInfo: function(fileId) { return (typeof DataManager !== 'undefined') ? DataManager.loadSavefileInfo(fileId) : null;     },
    savefileValid: function(fileId) { return (typeof DataManager !== 'undefined') ? DataManager.isThisGameFile(fileId) : false;     },
    lastSavefileId: function() {
      return (typeof DataManager !== 'undefined' && DataManager.lastAccessedSavefileId())
        ? DataManager.lastAccessedSavefileId() : 1;
    },
  }; window.CSHelper = CSHelper; var _widgetRegistry = {};
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
      } else isEnabled = cmd.enabled !== false; var name = resolveTemplate(cmd.name);
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
  var WidgetAnimator = (function() {
    var _tasks = [];
    function easeFunc(name, t) {
      t = Math.min(Math.max(t, 0), 1);
      switch (name) {
        case 'easeIn':    return t * t; case 'easeInOut': return t < 0.5 ? 2*t*t : 1-2*(1-t)*(1-t); case 'linear':    return t;
        case 'bounce': {
          if      (t < 1/2.75)  { return 7.5625*t*t; }
          else if (t < 2/2.75)  { t -= 1.5/2.75;  return 7.5625*t*t+0.75; }
          else if (t < 2.5/2.75){ t -= 2.25/2.75; return 7.5625*t*t+0.9375; }
          else                  { t -= 2.625/2.75; return 7.5625*t*t+0.984375; }
        }
        default: return 1-(1-t)*(1-t);
      }
    }
    function applyTask(task, t) {
      var e = easeFunc(task.easing || 'easeOut', t); var obj = task.obj, p = task.props;      if (p.x        !== undefined) obj.x        = p.x.from        + (p.x.to        - p.x.from)        * e;
      if (p.y        !== undefined) obj.y        = p.y.from        + (p.y.to        - p.y.from)        * e;
      if (p.opacity  !== undefined) obj.opacity  = Math.round(p.opacity.from  + (p.opacity.to  - p.opacity.from)  * e);
      if (p.scaleY   !== undefined && obj.scale)  obj.scale.y = p.scaleY.from  + (p.scaleY.to  - p.scaleY.from)  * e;
      if (p.scaleX   !== undefined && obj.scale)  obj.scale.x = p.scaleX.from  + (p.scaleX.to  - p.scaleX.from)  * e;
      if (p.rotation !== undefined) obj.rotation = p.rotation.from + (p.rotation.to - p.rotation.from) * e;
      if (p.openness !== undefined && obj.openness !== undefined) obj.openness = Math.round(p.openness.from + (p.openness.to - p.openness.from) * e);
    }
    function buildPropsForEffect(eff, obj, isEnter) {
      var type = (eff && eff.type) || 'none'; if (type === 'none') return null;
      var origX = obj.x || 0, origY = obj.y || 0; var origOp = (obj.opacity !== undefined) ? obj.opacity : 255;
      var w = obj.width || 0, h = obj.height || 0; var offset, fromScale, fromAngle;
      function op() { return isEnter ? {from:0,to:origOp} : {from:origOp,to:0}; }
      function sc(f,t) { return isEnter ? {from:f,to:t} : {from:t,to:f}; }
      switch (type) {
        case 'fade': case 'fadeIn': return { opacity: op() }; case 'fadeOut': return { opacity: isEnter ? {from:origOp,to:0} : {from:0,to:origOp} };
        case 'slideDown': case 'slideBottom':
          offset = eff.offset !== undefined ? eff.offset : Math.max(h, 40);
          return { y: isEnter ? {from:origY-offset,to:origY} : {from:origY,to:origY+offset}, opacity: op() };
        case 'slideUp': case 'slideTop':
          offset = eff.offset !== undefined ? eff.offset : Math.max(h, 40);
          return { y: isEnter ? {from:origY+offset,to:origY} : {from:origY,to:origY-offset}, opacity: op() };
        case 'slideLeft':
          offset = eff.offset !== undefined ? eff.offset : Math.max(w, 40);
          return { x: isEnter ? {from:origX+offset,to:origX} : {from:origX,to:origX-offset}, opacity: op() };
        case 'slideRight':
          offset = eff.offset !== undefined ? eff.offset : Math.max(w, 40);
          return { x: isEnter ? {from:origX-offset,to:origX} : {from:origX,to:origX+offset}, opacity: op() };
        case 'openness':
          if (typeof obj.openness !== 'undefined') return { openness: sc(0, 255) };
          return { scaleY: sc(0, 1), y: isEnter ? {from:origY+h/2,to:origY} : {from:origY,to:origY+h/2} };
        case 'zoom':
          fromScale = eff.fromScale !== undefined ? eff.fromScale : 0.5; return { scaleX: sc(fromScale,1), scaleY: sc(fromScale,1), opacity: op() };
        case 'bounce':
          fromScale = eff.fromScale !== undefined ? eff.fromScale : 0; return { scaleX: sc(fromScale,1), scaleY: sc(fromScale,1), opacity: op() };
        case 'rotate':
          fromAngle = eff.fromAngle !== undefined ? eff.fromAngle : 180;
          return { rotation: isEnter ? {from:fromAngle*Math.PI/180,to:0} : {from:0,to:fromAngle*Math.PI/180}, opacity: op() };
        case 'rotateX': return { scaleY: sc(0,1), opacity: op() }; case 'rotateY': return { scaleX: sc(0,1), opacity: op() }; default: return null;
      }
    }
    return {
      play: function(obj, animDef, isEnter, onComplete) {
        if (!obj) { if (onComplete) onComplete(); return; }
        this.clear(obj); var isNew = Array.isArray(animDef); var effects = isNew ? animDef : (animDef ? [animDef] : []);
        var valid = effects.filter(function(e) { return e && e.type && e.type !== 'none'; });
        if (valid.length === 0) { if (onComplete) onComplete(); return; }
        var maxEnd = -1, maxIdx = 0; for (var i = 0; i < valid.length; i++) {
          var dur0 = valid[i].duration !== undefined ? valid[i].duration : (isNew ? 300 : 15); var del0 = valid[i].delay || 0;
          if (dur0 + del0 > maxEnd) { maxEnd = dur0 + del0; maxIdx = i; }
        }
        for (var j = 0; j < valid.length; j++) {
          var eff = valid[j]; var props = buildPropsForEffect(eff, obj, isEnter);
          if (!props) continue; var duration = eff.duration !== undefined ? eff.duration : (isNew ? 300 : 15);
          var frames   = isNew ? Math.max(1, Math.round(duration / 1000 * 60)) : Math.max(1, duration);
          var delay    = eff.delay || 0; var delayF   = isNew ? Math.max(0, Math.round(delay / 1000 * 60)) : Math.max(0, delay);
          var easing   = eff.easing || 'easeOut'; if (j === 0 && delayF === 0) applyTask({obj:obj, props:props, easing:easing}, 0);
          _tasks.push({
            obj: obj, props: props,
            frame: 0, duration: frames, delay: delayF,
            easing: easing,
            onComplete: j === maxIdx ? (onComplete || null) : null,
          });
        }
      },
      clear: function(obj) {
        _tasks = _tasks.filter(function(t) { return t.obj !== obj; });
      },
      isActive: function(obj) {
        return _tasks.some(function(t) { return t.obj === obj; });
      },
      update: function() {
        if (!_tasks.length) return; var done = [];
        for (var i = 0; i < _tasks.length; i++) {
          var task = _tasks[i];
          if (task.delay > 0) { task.delay--; continue; }
          task.frame++; applyTask(task, task.frame / task.duration); if (task.frame >= task.duration) done.push(i);
        }
        for (var j = done.length - 1; j >= 0; j--) {
          var cb = _tasks[done[j]].onComplete; _tasks.splice(done[j], 1); if (cb) cb();
        }
      },
    };
  })(); window.WidgetAnimator = WidgetAnimator;
  function Widget_Base() {}
  Widget_Base.prototype.initialize = function(def, parentWidget) {
    this._def = def || {}; this._id = def.id || ''; this._x = def.x || 0;
    this._y = def.y || 0; this._width = def.width || 100; this._height = def.height || 36; this._visible = def.visible !== false;
    this._children = []; this._parent = parentWidget || null; this._displayObject = null; var nt = def.navUp || def.navDown || def.navLeft || def.navRight;
    this._navTargets = nt ? {
      up: def.navUp || null, down: def.navDown || null,
      left: def.navLeft || null, right: def.navRight || null,
    } : null; var rawScripts = def.scripts;
    if (rawScripts) {
      var compiled = {}; var keys = ['onCreate', 'onUpdate', 'onRefresh', 'onDestroy'];
      for (var si = 0; si < keys.length; si++) {
        var key = keys[si]; var code = rawScripts[key];
        if (code && code.trim()) {
          try { compiled[key] = new Function('$ctx', code); }
          catch(e) { console.error('[Widget] script compile error "' + key + '" (' + (def.id||'') + '):', e); }
        }
      }
      this._scripts = Object.keys(compiled).length ? compiled : null;
    } else this._scripts = null;
  }; Widget_Base.prototype.displayObject = function() { return this._displayObject; };
  Widget_Base.prototype._runScript = function(name) {
    if (!this._scripts || !this._scripts[name]) return;
    try {
      var scene = SceneManager._scene; var $ctx = scene ? (scene._ctx || {}) : {}; this._scripts[name].call(scene, $ctx);
    } catch(e) {
      console.error('[Widget] script "' + name + '" error (' + this._id + '):', e);
    }
  };
  Widget_Base.prototype.addChildWidget = function(child) {
    this._children.push(child); child._parent = this;
    if (this._displayObject && child.displayObject()) {
      if (child._decoSprite) this._displayObject.addChild(child._decoSprite); this._displayObject.addChild(child.displayObject());
    }
  };
  function _decoRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  Widget_Base.prototype._drawDecoBg = function(bmp, w, h, def) {
    var color = def.bgColor; if (!color) return; var r = def.borderRadius || 0; var ctx = bmp._context; if (!ctx) return; ctx.save(); ctx.fillStyle = color;
    if (r > 0) { _decoRoundRect(ctx, 0, 0, w, h, r); ctx.fill(); }
    else { ctx.fillRect(0, 0, w, h); }
    ctx.restore(); bmp._setDirty();
  };
  Widget_Base.prototype._drawDecoBorder = function(bmp, w, h, def) {
    var bw = def.borderWidth; if (!bw || bw <= 0) return;
    var color = def.borderColor || '#ffffff'; var r = def.borderRadius || 0; var ctx = bmp._context;    if (!ctx) return; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = bw; var half = bw / 2;
    if (r > 0) {
      var ri = Math.max(0, r - half); _decoRoundRect(ctx, half, half, w - bw, h - bw, ri); ctx.stroke();
    } else ctx.strokeRect(half, half, w - bw, h - bw); ctx.restore(); bmp._setDirty();
  };
  Widget_Base.prototype._applyWindowStyle = function(win, def) {
    if (def.windowed === false) {
      win.setBackgroundType(2); return;
    }
    if (def.windowStyle && def.windowStyle !== 'default') {
      var csOv = { windowStyle: def.windowStyle };
      if (def.windowStyle === 'frame') {
        if (def.windowskinName) csOv.windowskinName = def.windowskinName; if (def.skinId) csOv.skinId = def.skinId; if (def.colorTone) csOv.colorTone = def.colorTone;
      } else if (def.windowStyle === 'image') {
        if (def.imageFile) {
          csOv.imageFile = def.imageFile; win._themeSkin = ImageManager.loadSystem(def.imageFile);
        }
        if (def.imageRenderMode) csOv.imageRenderMode = def.imageRenderMode;
      }
      if (typeof window._uiThemeSetWindowOverride === 'function') window._uiThemeSetWindowOverride(win._customClassName, csOv);
    }
    if (def.backOpacity !== undefined) win.backOpacity = def.backOpacity;
  };
  Widget_Base.prototype._createDecoSprite = function(def, w, h) {
    var hasBg = !!def.bgColor; var hasBorder = !!(def.borderWidth && def.borderWidth > 0);
    if (!hasBg && !hasBorder) { this._decoSprite = null; return; }
    var sprite = new Sprite(); sprite.x = def.x || 0; sprite.y = def.y || 0; var bmp = new Bitmap(Math.max(1, w), Math.max(1, h));
    if (hasBg) this._drawDecoBg(bmp, w, h, def); if (hasBorder) this._drawDecoBorder(bmp, w, h, def);
    if (def.bgAlpha !== undefined) sprite.opacity = Math.round(def.bgAlpha * 255); sprite.bitmap = bmp; this._decoSprite = sprite;
  };
  Widget_Base.prototype.playEnterAnim = function(fallbackDef) {
    var animDef = (this._def && this._def.enterAnimation !== undefined)
      ? this._def.enterAnimation : fallbackDef;
    var isEmpty = !animDef || (Array.isArray(animDef) ? animDef.length === 0 : animDef.type === 'none');
    if (isEmpty) return; var obj = this.displayObject(); if (!obj) return; WidgetAnimator.play(obj, animDef, true, null); var wins = []; this._collectWindowDescendants(wins);
    for (var i = 0; i < wins.length; i++) {
      var wo = wins[i].displayObject(); if (wo && !WidgetAnimator.isActive(wo)) WidgetAnimator.play(wo, animDef, true, null);
    }
  };
  Widget_Base.prototype.playExitAnim = function(fallbackDef, onComplete) {
    var animDef = (this._def && this._def.exitAnimation !== undefined)
      ? this._def.exitAnimation : fallbackDef;
    var isEmpty = !animDef || (Array.isArray(animDef) ? animDef.length === 0 : animDef.type === 'none');
    if (isEmpty) {
      if (onComplete) onComplete(); return false;
    }
    var obj = this.displayObject();
    if (!obj) { if (onComplete) onComplete(); return false; }
    WidgetAnimator.play(obj, animDef, false, onComplete); var wins = []; this._collectWindowDescendants(wins);
    for (var i = 0; i < wins.length; i++) {
      var wo = wins[i].displayObject(); if (wo && !WidgetAnimator.isActive(wo)) WidgetAnimator.play(wo, animDef, false, null);
    }
    return true;
  };
  Widget_Base.prototype._collectWindowDescendants = function(out) {
    for (var i = 0; i < this._children.length; i++) {
      var child = this._children[i]; if (child.displayObject() instanceof Window_Base) out.push(child); child._collectWindowDescendants(out);
    }
  };
  Widget_Base.prototype._syncWindowDescendants = function() {
    var obj = this._displayObject; if (!obj) return;
    var cx = obj.x, cy = obj.y; if (this._prevDispX === undefined) this._prevDispX = cx; this._prevDispY = cy; return;
    var dx = cx - this._prevDispX, dy = cy - this._prevDispY; if (dx === 0 && dy === 0) return;
    this._prevDispX = cx; this._prevDispY = cy; var wins = []; this._collectWindowDescendants(wins);
    for (var i = 0; i < wins.length; i++) {
      var wo = wins[i].displayObject(); wo.x += dx; wo.y += dy;
      if (wins[i]._decoSprite) { wins[i]._decoSprite.x += dx; wins[i]._decoSprite.y += dy; }
    }
  };
  Widget_Base.prototype.update = function() {
    this._syncWindowDescendants(); if (this._scripts) this._runScript('onUpdate'); for (var i = 0; i < this._children.length; i++) this._children[i].update();
  };
  Widget_Base.prototype.refresh = function() {
    if (this._scripts) this._runScript('onRefresh'); for (var i = 0; i < this._children.length; i++) this._children[i].refresh();
  };
  Widget_Base.prototype.findWidget = function(id) {
    if (this._id === id) return this;
    for (var i = 0; i < this._children.length; i++) {
      var found = this._children[i].findWidget(id); if (found) return found;
    }
    return null;
  };
  Widget_Base.prototype.collectFocusable = function(out) {
    if (this._def && this._def.focusable === true) out.push(this); for (var i = 0; i < this._children.length; i++) this._children[i].collectFocusable(out);
  }; Widget_Base.prototype.activate = function() {}; Widget_Base.prototype.deactivate = function() {};
  Widget_Base.prototype.hide = function() {
    var dObj = this._displayObject; if (dObj) dObj.visible = false; if (this._decoSprite) this._decoSprite.visible = false;
  };
  Widget_Base.prototype.show = function() {
    var dObj = this._displayObject; if (dObj) dObj.visible = true; if (this._decoSprite) this._decoSprite.visible = true;
  }; Widget_Base.prototype.close = function() { this.hide(); }; Widget_Base.prototype.open  = function() { this.show(); };
  Widget_Base.prototype.destroy = function() {
    if (this._scripts) this._runScript('onDestroy'); if (this._bitmap && this._bitmap.destroy) this._bitmap.destroy();
    for (var i = 0; i < this._children.length; i++) this._children[i].destroy(); this._children = [];
    if (this._decoSprite) {
      if (this._decoSprite._bitmap) this._decoSprite._bitmap.destroy(); this._decoSprite.destroy(); this._decoSprite = null;
    }
    if (this._labelSprite) {
      if (this._labelSprite._bitmap) this._labelSprite._bitmap.destroy(); this._labelSprite.destroy(); this._labelSprite = null;
    }
    if (this._displayObject && this._displayObject.destroy) {
      this._displayObject.destroy(); this._displayObject = null;
    }
  }; window.Widget_Base = Widget_Base;
  function Widget_Panel() {}
  Widget_Panel.prototype = Object.create(Widget_Base.prototype); Widget_Panel.prototype.constructor = Widget_Panel;
  Widget_Panel.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget); this._windowed = def.windowed !== false;
    if (this._windowed) {
      var padding = def.padding; var win = new Window_Base(this._x, this._y, this._width, this._height || 400);
      if (padding !== undefined) win._padding = padding; win._customClassName = 'Window_CS_' + this._id;
      this._applyWindowStyle(win, def); if (def.bgAlpha !== undefined) win.opacity = Math.round(def.bgAlpha * 255);
      this._displayObject = win; this._padding = win._padding; this._createDecoSprite(def, this._width, this._height || 400);
    } else {
      var container = new Sprite(); container.x = this._x; container.y = this._y; if (def.bgAlpha !== undefined) container.opacity = Math.round(def.bgAlpha * 255);
      this._displayObject = container; this._padding = 0; this._createDecoSprite(def, this._width, this._height || 400);
      if (this._decoSprite) {
        this._decoSprite.x = 0; this._decoSprite.y = 0; this._displayObject.addChild(this._decoSprite); this._decoSprite = null;
      }
    }
  };
  Widget_Panel.prototype.addChildWidget = function(child) {
    this._children.push(child); child._parent = this;
    if (child.displayObject()) {
      var childObj = child.displayObject();
      if (childObj instanceof Window_Base) {
        childObj.x += this._x; childObj.y += this._y;
        if (child._decoSprite)  { child._decoSprite.x  += this._x; child._decoSprite.y  += this._y; }
        if (child._labelSprite) { child._labelSprite.x += this._x; child._labelSprite.y += this._y; }
        if (child._rowOverlay)  { child._rowOverlay.x  += this._x; child._rowOverlay.y  += this._y; }
      } else if (this._displayObject) {
        var target = (this._windowed && this._displayObject._windowSpriteContainer)
          ? this._displayObject._windowSpriteContainer : this._displayObject;
        if (child._decoSprite) target.addChild(child._decoSprite); target.addChild(childObj);
      }
    }
  };
  Widget_Panel.prototype.update = function() {
    Widget_Base.prototype.update.call(this); if (!this._displayObject) return; var dispVis = this._displayObject._visible !== false;    for (var vi = 0; vi < this._children.length; vi++) {
      var vch = this._children[vi]; var vobj = vch && vch.displayObject && vch.displayObject();
      if (vobj && (vobj instanceof Window_Base) && vobj._visible !== dispVis) vobj.visible = dispVis;
    }
    if (!this._windowed) return; var linked = this._def && this._def.linkedFocus;    if (!linked || !linked.length) return; var navMgr = SceneManager._scene && SceneManager._scene._navManager;    if (!navMgr) return; var aw = navMgr._activeIndex >= 0 ? navMgr._focusables[navMgr._activeIndex] : null; var aid = aw ? aw._id : null;    var isLinked = aid && linked.indexOf(aid) >= 0; var dimAlpha = isLinked ? 1.0 : 0.63;
    if (Math.abs((this._displayObject.alpha || 1) - dimAlpha) > 0.005) {
      this._displayObject.alpha = dimAlpha;
      for (var _di = 0; _di < this._children.length; _di++) {
        var _dch = this._children[_di]; var _dobj = _dch && _dch.displayObject && _dch.displayObject(); if (!_dobj) continue;
        if (typeof _dobj.syncTransform === 'function') {
          _dobj._forcedOpacity = (dimAlpha < 1.0) ? dimAlpha : undefined;
        } else {
          if (_dch._baseDimAlpha === undefined) _dch._baseDimAlpha = _dobj.alpha || 1; _dobj.alpha = _dch._baseDimAlpha * dimAlpha;
        }
      }
    }
  }; window.Widget_Panel = Widget_Panel;
  function Widget_Label() {}
  Widget_Label.prototype = Object.create(Widget_Base.prototype); Widget_Label.prototype.constructor = Widget_Label;
  Widget_Label.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget); this._template = def.text || ''; this._align = def.align || 'left';
    this._vAlign = def.verticalAlign || 'middle'; this._fontSize = def.fontSize || 28;
    var colorVal = def.color || '#ffffff'; this._colorTemplate = (colorVal && colorVal.charAt(0) === '{') ? colorVal : null;
    this._color = this._colorTemplate ? '#ffffff' : colorVal; this._useTextEx = def.useTextEx === true;
    if (this._useTextEx) {
      var win = new Window_Base(this._x, this._y, this._width, this._height); win._padding = 0;
      win.standardPadding = function() { return 0; }; win.opacity = 0; win.backOpacity = 0; win.createContents();
      if (def.fontSize) win.contents.fontSize = def.fontSize; this._win = win; this._displayObject = win;
    } else {
      var sprite = new Sprite(); sprite.x = this._x; sprite.y = this._y; if (def.bgAlpha !== undefined) sprite.opacity = Math.round(def.bgAlpha * 255);
      var bitmap = new Bitmap(this._width, this._height); bitmap.fontSize = this._fontSize;
      sprite.bitmap = bitmap; this._sprite = sprite; this._bitmap = bitmap; this._displayObject = sprite;
    }
    this.refresh();
  };
  Widget_Label.prototype.refresh = function() {
    if (this._useTextEx) {
      if (!this._win) return; var text = resolveTemplate(this._template); if (text === this._lastText) return; this._lastText = text;
      this._win.contents.clear(); var lh = this._win.lineHeight();
      var ty = (this._vAlign === 'top') ? 0 :
               (this._vAlign === 'bottom') ? Math.max(0, this._height - lh) :
               Math.floor((this._height - lh) / 2);
      this._win.drawTextEx(text, 0, ty); Widget_Base.prototype.refresh.call(this); return;
    }
    if (!this._bitmap) return; var text = resolveTemplate(this._template);
    var color = this._colorTemplate ? ((resolveTemplate(this._colorTemplate) || '').trim() || '#ffffff') : this._color;
    if (text === this._lastText && color === this._lastColor && this._align === this._lastAlign && this._vAlign === this._lastVAlign) return;
    this._lastText = text; this._lastColor = color; this._lastAlign = this._align; this._lastVAlign = this._vAlign;
    this._bitmap.clear(); this._drawDecoBg(this._bitmap, this._width, this._height, this._def); this._bitmap.textColor = color; var textH = this._fontSize + 8;
    var ty = this._vAlign === 'top' ? 0
           : this._vAlign === 'bottom' ? this._height - textH
           : Math.floor((this._height - textH) / 2);
    this._bitmap.drawText(text, 0, ty, this._width, textH, this._align);
    this._drawDecoBorder(this._bitmap, this._width, this._height, this._def); Widget_Base.prototype.refresh.call(this);
  };
  Widget_Label.prototype.update = function() {
    this.refresh(); Widget_Base.prototype.update.call(this);
  }; window.Widget_Label = Widget_Label;
  function Widget_TextArea() {}
  Widget_TextArea.prototype = Object.create(Widget_Base.prototype); Widget_TextArea.prototype.constructor = Widget_TextArea;
  Widget_TextArea.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget); this._template = def.text || ''; this._align = def.align || 'left';
    this._vAlign = def.verticalAlign || 'top'; this._fontSize = def.fontSize || 20;
    this._color = def.color || '#dddddd'; this._lineHeight = def.lineHeight || (this._fontSize + 8); this._useTextEx = def.useTextEx === true;
    if (this._useTextEx) {
      var win = new Window_Base(this._x, this._y, this._width, this._height); win._padding = 0;
      win.standardPadding = function() { return 0; }; win.opacity = 0; win.backOpacity = 0; win.createContents();
      if (def.fontSize) win.contents.fontSize = def.fontSize; this._win = win; this._displayObject = win;
    } else {
      var sprite = new Sprite(); sprite.x = this._x; sprite.y = this._y; var bitmap = new Bitmap(this._width, this._height);
      bitmap.fontSize = this._fontSize; sprite.bitmap = bitmap; this._sprite = sprite; this._bitmap = bitmap; this._displayObject = sprite;
    }
    this.refresh();
  };
  Widget_TextArea.prototype.refresh = function() {
    var rawText = resolveTemplate(this._template);
    var isPlaceholder = !rawText && !!window._uiEditorPreview && !!this._template; var text = isPlaceholder ? this._template : rawText;
    if (this._useTextEx) {
      if (!this._win) return; if (text === this._lastText) return; this._lastText = text; this._win.contents.clear();
      if (this._fontSize) this._win.contents.fontSize = this._fontSize; var lh = this._win.lineHeight();
      var lines = text ? text.split('\n') : []; var totalH = lines.length * lh;
      var startY = this._vAlign === 'middle' ? Math.floor((this._height - totalH) / 2)
                 : this._vAlign === 'bottom'  ? this._height - totalH : 0;
      for (var j = 0; j < lines.length; j++) {
        var ty = startY + j * lh; if (ty + lh > this._height) break; this._win.drawTextEx(lines[j], 0, ty);
      }
      Widget_Base.prototype.refresh.call(this); return;
    }
    if (!this._bitmap) return; if (text === this._lastText && this._align === this._lastAlign && this._vAlign === this._lastVAlign) return;
    this._lastText = text; this._lastAlign = this._align; this._lastVAlign = this._vAlign;
    this._bitmap.clear(); this._bitmap.fontSize = this._fontSize; this._bitmap.textColor = isPlaceholder ? 'rgba(200,200,200,0.5)' : this._color;
    var lh = this._lineHeight; var lines = text ? text.split('\n') : [];
    var totalH = Math.min(lines.length, Math.floor(this._height / lh)) * lh;
    var startY = this._vAlign === 'middle' ? Math.floor((this._height - totalH) / 2)
               : this._vAlign === 'bottom'  ? this._height - totalH : 0;
    for (var i = 0; i < lines.length; i++) {
      var y = startY + i * lh; if (y + lh > this._height) break; this._bitmap.drawText(lines[i], 0, y, this._width, lh, this._align);
    }
    Widget_Base.prototype.refresh.call(this);
  };
  Widget_TextArea.prototype.update = function() {
    this.refresh(); Widget_Base.prototype.update.call(this);
  }; window.Widget_TextArea = Widget_TextArea;
  function Widget_Image() {}
  Widget_Image.prototype = Object.create(Widget_Base.prototype); Widget_Image.prototype.constructor = Widget_Image;
  Widget_Image.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget); this._imageSource    = def.imageSource    || 'file';
    this._actorIndex     = def.actorIndex     || 0; this._actorIndexExpr = def.actorIndexExpr || null;
    this._iconIndexExpr  = def.iconIndexExpr  || null; this._bitmapExpr     = def.bitmapExpr     || null;
    this._srcRectExpr = def.srcRectExpr || null; this._fitMode     = def.fitMode     || 'stretch';
    this._lastBitmap  = null; var sprite = new Sprite(); sprite.x = this._x; sprite.y = this._y; if (def.bgAlpha !== undefined) sprite.opacity = Math.round(def.bgAlpha * 255);
    if (!this._bitmapExpr && this._imageSource !== 'file' && this._imageSource !== 'icon') {
      var bmp = new Bitmap(this._width || 144, this._height || 144); sprite.bitmap = bmp; this._bitmap = bmp;
    }
    this._displayObject = sprite; this.refresh();
  };
  Widget_Image.prototype.refresh = function() {
    var sprite = this._displayObject; if (!sprite) return;
    if (this._bitmapExpr) {
      this._refreshFromExpr(sprite);
    } else {
      switch (this._imageSource) {
        case 'actorFace':      this._refreshActorFace(sprite);      break; case 'actorCharacter': this._refreshActorCharacter(sprite); break;
        case 'icon':           this._refreshIcon(sprite);           break; default:               this._refreshFile(sprite);           break;
      }
    }
    Widget_Base.prototype.refresh.call(this);
  };
  Widget_Image.prototype._refreshFromExpr = function(sprite) {
    var bitmap;
    try { bitmap = new Function('return (' + this._bitmapExpr + ')')(); }
    catch(e) { console.error('[Widget_Image] bitmapExpr error:', e); return; }
    if (!bitmap) { sprite.bitmap = null; this._lastBitmap = null; return; }
    if (bitmap === this._lastBitmap) return; this._lastBitmap = bitmap; var self     = this; var w        = this._width  || 100;
    var h        = this._height || 100; var srcExpr  = this._srcRectExpr; var fitMode  = this._fitMode;
    bitmap.addLoadListener(function() {
      var srcRect = null;
      if (srcExpr) { try { srcRect = new Function('return (' + srcExpr + ')')(); } catch(e) {} }
      var sx = srcRect ? srcRect.x : 0; var sy = srcRect ? srcRect.y : 0;
      var sw = srcRect ? srcRect.w : bitmap.width; var sh = srcRect ? srcRect.h : bitmap.height; if (!sw || !sh) return; var bmp = new Bitmap(w, h);
      if (fitMode === 'contain') {
        var scale = Math.min(w / sw, h / sh); var dw = Math.floor(sw * scale); var dh = Math.floor(sh * scale);
        bmp.blt(bitmap, sx, sy, sw, sh,
          Math.floor((w - dw) / 2), Math.floor((h - dh) / 2), dw, dh);
      } else if (fitMode === 'none') {
        bmp.blt(bitmap, sx, sy, Math.min(sw, w), Math.min(sh, h), 0, 0);
      } else bmp.blt(bitmap, sx, sy, sw, sh, 0, 0, w, h); if (self._bitmap && self._bitmap !== bmp) self._bitmap.destroy(); self._bitmap = bmp; sprite.bitmap = bmp;
    });
  };
  Widget_Image.prototype._refreshFile = function(sprite) {
    var def = this._def; var w = this._width; var h = this._height || 100;
    if (!def.imageName) {
      if (!this._bitmap) {
        this._bitmap = new Bitmap(w, h); sprite.bitmap = this._bitmap;
      }
      this._bitmap.clear(); this._bitmap.fillRect(0, 0, w, h, def.bgColor || '#ffffff'); this._drawDecoBorder(this._bitmap, w, h, def); return;
    }
    if (typeof ImageManager === 'undefined') return; var folder = def.imageFolder || 'img/system/';
    var bitmap = ImageManager.loadBitmap(folder, def.imageName); var self = this;
    bitmap.addLoadListener(function() {
      var drawW = self._width || bitmap.width; var drawH = self._height || bitmap.height;
      var bmp = new Bitmap(drawW, drawH); self._drawDecoBg(bmp, drawW, drawH, def);
      bmp.blt(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, drawW, drawH); self._drawDecoBorder(bmp, drawW, drawH, def);
      if (self._bitmap && self._bitmap !== bmp) self._bitmap.destroy(); self._bitmap = bmp; sprite.bitmap = bmp;
    });
  };
  Widget_Image.prototype._resolveActorIndex = function() {
    if (this._actorIndexExpr) {
      try { var c = (SceneManager._scene && SceneManager._scene._ctx) || {};
            return Number(new Function('$ctx', 'return (' + this._actorIndexExpr + ')')(c)) || 0;
      } catch(e) { return 0; }
    }
    return this._actorIndex;
  };
  Widget_Image.prototype._refreshActorFace = function(sprite) {
    var aidx = this._resolveActorIndex(); var bitmap = CSHelper.actorFace(aidx); if (!bitmap) return; var srcRect = CSHelper.actorFaceSrcRect(aidx);
    if (bitmap === this._lastBitmap && sprite.bitmap) return; this._lastBitmap = bitmap; var self = this; var w = this._width || 144, h = this._height || 144;
    bitmap.addLoadListener(function() {
      if (!self._bitmap) { self._bitmap = new Bitmap(w, h); sprite.bitmap = self._bitmap; }
      self._bitmap.clear();
      if (srcRect) {
        self._bitmap.blt(bitmap, srcRect.x, srcRect.y, srcRect.w, srcRect.h, 0, 0, w, h);
      } else self._bitmap.blt(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, w, h);
    });
  };
  Widget_Image.prototype._refreshActorCharacter = function(sprite) {
    var aidx = this._resolveActorIndex(); var bitmap = CSHelper.actorCharacter(aidx); if (!bitmap) return; if (bitmap === this._lastBitmap && sprite.bitmap) return;
    this._lastBitmap = bitmap; var self = this; var w = this._width || 48, h = this._height || 48;
    bitmap.addLoadListener(function() {
      var srcRect = CSHelper.actorCharacterSrcRect(aidx);
      if (!self._bitmap) { self._bitmap = new Bitmap(w, h); sprite.bitmap = self._bitmap; }
      self._bitmap.clear();
      if (srcRect) {
        self._bitmap.blt(bitmap, srcRect.x, srcRect.y, srcRect.w, srcRect.h, 0, 0, w, h);
      } else self._bitmap.blt(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, w, h);
    });
  };
  Widget_Image.prototype._refreshIcon = function(sprite) {
    var iconIdx = 0;
    if (this._iconIndexExpr) {
      try {
        var $ctx = (SceneManager._scene && SceneManager._scene._ctx) || {}; iconIdx = Number(new Function('$ctx', 'return (' + this._iconIndexExpr + ')')($ctx)) || 0;
      } catch(e) {}
    }
    if (iconIdx === this._lastIconIdx && sprite.bitmap) return; this._lastIconIdx = iconIdx;
    var iconSet = ImageManager.loadSystem('IconSet'); var w = this._width  || 32; var h = this._height || 32; var self = this;
    iconSet.addLoadListener(function() {
      var pw = (typeof Window_Base !== 'undefined' && Window_Base._iconWidth)  || 32;
      var ph = (typeof Window_Base !== 'undefined' && Window_Base._iconHeight) || 32;
      var cols = Math.floor(iconSet.width / pw); var sx = (iconIdx % cols) * pw; var sy = Math.floor(iconIdx / cols) * ph;
      if (!self._bitmap || self._bitmap.width !== w || self._bitmap.height !== h) {
        self._bitmap = new Bitmap(w, h); sprite.bitmap = self._bitmap;
      }
      self._bitmap.clear(); self._bitmap.blt(iconSet, sx, sy, pw, ph, 0, 0, w, h);
    });
  };
  Widget_Image.prototype.update = function() {
    if (this._updateCount === undefined) this._updateCount = 0; var n = ++this._updateCount;
    var needRefresh = (this._bitmapExpr || this._iconIndexExpr) ? (n % 10 === 0)
                    : this._actorIndexExpr ? (n % 30 === 0)
                    : (this._imageSource !== 'file' && n % 60 === 0);
    if (needRefresh) this.refresh(); Widget_Base.prototype.update.call(this);
  }; window.Widget_Image = Widget_Image;
  function Widget_Gauge() {}
  Widget_Gauge.prototype = Object.create(Widget_Base.prototype); Widget_Gauge.prototype.constructor = Widget_Gauge;
  Widget_Gauge.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget); this._valueExpr      = def.valueExpr      || null;
    this._maxExpr        = def.maxExpr        || null; this._labelExpr      = def.labelExpr      || null;
    this._gaugeType      = def.gaugeType      || 'hp'; this._actorIndex     = def.actorIndex     || 0;
    this._actorIndexExpr = def.actorIndexExpr || null; this._gaugeRenderMode = def.gaugeRenderMode || 'palette';
    this._gaugeSkinId = def.gaugeSkinId || null; var hasChildren = def.children && def.children.length > 0;
    this._showLabel = !hasChildren && def.showLabel !== false; this._showValue = !hasChildren && def.showValue !== false;
    this._skinData = null; this._skinBitmap = null; this._windowSkin = null; var sprite = new Sprite(); sprite.x = this._x;
    sprite.y = this._y; if (def.bgAlpha !== undefined) sprite.opacity = Math.round(def.bgAlpha * 255);
    var bitmap = new Bitmap(this._width, this._height || 36); sprite.bitmap = bitmap; this._sprite = sprite; this._bitmap = bitmap; this._displayObject = sprite;
    if (this._gaugeSkinId && typeof UIEditorSkins !== 'undefined') {
      var skinEntry = UIEditorSkins.find(function(s) { return s.name === this._gaugeSkinId; }.bind(this));
      if (skinEntry) {
        this._skinData = skinEntry; this._skinBitmap = ImageManager.loadSystem(skinEntry.gaugeFile || skinEntry.file || skinEntry.name);
      }
    }
    if (!this._skinData) this._windowSkin = ImageManager.loadSystem('Window'); this.refresh();
  };
  Widget_Gauge.prototype.refresh = function() {
    if (!this._bitmap) return; var w = this._width; var h = this._height || 36;    var barH = Math.max(6, Math.round(h * 0.35)); var barY = h - barH;    this._bitmap.clear(); this._drawDecoBg(this._bitmap, w, h, this._def); var label = '', cur = 0, max = 1; var hasValue = false;
    if (this._valueExpr) {
      var $ctx = (SceneManager._scene && SceneManager._scene._ctx) || {};
      try { cur = Number(eval(this._valueExpr)) || 0; } catch(e) { cur = 0; }
      try { max = Number(eval(this._maxExpr))   || 1; } catch(e) { max = 1; }
      try { label = this._labelExpr ? String(eval(this._labelExpr)) : ''; } catch(e) { label = ''; }
      hasValue = true;
    } else if (typeof $gameParty !== 'undefined') {
      var aidx = this._actorIndex;
      if (this._actorIndexExpr) {
        try { var c = (SceneManager._scene && SceneManager._scene._ctx) || {};
              aidx = Number(new Function('$ctx', 'return (' + this._actorIndexExpr + ')')(c)) || 0;
        } catch(e) { aidx = 0; }
      }
      var actor = $gameParty.members()[aidx];
      if (actor) {
        switch (this._gaugeType) {
          case 'hp': label='HP'; cur=actor.hp; max=actor.mhp; break; case 'mp': label='MP'; cur=actor.mp; max=actor.mmp; break;
          case 'tp': label='TP'; cur=actor.tp; max=actor.maxTp(); break;
        }
        hasValue = true;
      }
    }
    if (hasValue) {
      var rate = max > 0 ? cur / max : 0;
      if (this._gaugeRenderMode === 'image' && this._skinData && this._skinBitmap && this._skinBitmap.isReady()) {
        var sd = this._skinData; var bgX = sd.gaugeBgX || 0, bgY = sd.gaugeBgY || 0;
        var bgW = sd.gaugeBgW || 0, bgH = sd.gaugeBgH || 0; var fX = sd.gaugeFillX || 0, fY = sd.gaugeFillY || 0;
        var fW = sd.gaugeFillW || 0, fH = sd.gaugeFillH || 0; var fillDir = sd.gaugeFillDir || 'horizontal';
        if (bgW > 0 && bgH > 0) this._bitmap.blt(this._skinBitmap, bgX, bgY, bgW, bgH, 0, barY, w, barH);
        if (fW > 0 && fH > 0) {
          if (fillDir === 'horizontal') {
            var fillW = Math.floor(w * rate); var srcFillW = Math.floor(fW * rate);
            if (fillW > 0) this._bitmap.blt(this._skinBitmap, fX, fY, srcFillW, fH, 0, barY, fillW, barH);
          } else {
            var fillH = Math.floor(barH * rate); var srcFillH = Math.floor(fH * rate);
            if (fillH > 0) this._bitmap.blt(this._skinBitmap, fX, fY + fH - srcFillH, fW, srcFillH, 0, barY + barH - fillH, w, fillH);
          }
        }
      } else if (this._gaugeRenderMode === 'palette' && this._skinData && this._skinBitmap && this._skinBitmap.isReady()) {
        var sdp = this._skinData; var bgXp = sdp.gaugeBgX || 0, bgYp = sdp.gaugeBgY || 0;
        var bgWp = sdp.gaugeBgW || 0, bgHp = sdp.gaugeBgH || 0; var fXp = sdp.gaugeFillX || 0, fYp = sdp.gaugeFillY || 0;
        var fWp = sdp.gaugeFillW || 0, fHp = sdp.gaugeFillH || 0; var fillDirP = sdp.gaugeFillDir || 'horizontal';
        if (bgWp > 0 && bgHp > 0) this._bitmap.blt(this._skinBitmap, bgXp, bgYp, bgWp, bgHp, 0, barY, w, barH); var color1P, color2P;
        if (fWp > 0 && fHp > 0) {
          var midYp = fYp + Math.floor(fHp / 2); var midXp = fXp + Math.floor(fWp / 2);
          if (fillDirP === 'vertical') {
            color1P = this._skinBitmap.getPixel(midXp, fYp); color2P = this._skinBitmap.getPixel(midXp, fYp + fHp - 1);
          } else {
            color1P = this._skinBitmap.getPixel(fXp, midYp); color2P = this._skinBitmap.getPixel(fXp + fWp - 1, midYp);
          }
        }
        if (!color1P) color1P = '#20c020'; if (!color2P) color2P = '#60e060';
        if (fillDirP === 'vertical') {
          var fillHp = Math.floor(barH * rate); if (fillHp > 0) this._bitmap.gradientFillRect(0, barY + barH - fillHp, w, fillHp, color1P, color2P, true);
        } else {
          var fillWp = Math.floor(w * rate); if (fillWp > 0) this._bitmap.gradientFillRect(0, barY, fillWp, barH, color1P, color2P);
        }
      } else {
        var color1, color2, bgColor; var wsColors = { hp:[20,21], mp:[22,23], tp:[28,29] };
        var fallbackColors = { hp:['#20c020','#60e060'], mp:['#2040c0','#4080e0'], tp:['#c08020','#e0c040'] };
        function wsPixel(ws, idx) { return ws.getPixel(96 + (idx%8)*12+6, 144 + Math.floor(idx/8)*12+6); }
        if (this._windowSkin && this._windowSkin.isReady()) {
          var ws = this._windowSkin; bgColor = wsPixel(ws, 19); var ci = wsColors[this._gaugeType];
          if (ci) { color1 = wsPixel(ws, ci[0]); color2 = wsPixel(ws, ci[1]); }
          else { color1 = '#20c020'; color2 = '#60e060'; }
        } else {
          bgColor = '#202020'; var fc = fallbackColors[this._gaugeType] || ['#20c020','#60e060']; color1 = fc[0]; color2 = fc[1];
        }
        this._bitmap.fillRect(0, barY, w, barH, bgColor || '#202020'); var fillWf = Math.floor(w * rate);
        if (fillWf > 0) this._bitmap.gradientFillRect(0, barY, fillWf, barH, color1, color2);
      }
    }
    if (hasValue) {
      var textColor = (this._windowSkin && this._windowSkin.isReady())
        ? this._windowSkin.getPixel(96 + (0 % 8) * 12 + 6, 144 + Math.floor(0 / 8) * 12 + 6)
        : '#ffffff';
      var textSize = Math.max(12, Math.round((h - barH) * 0.75)); this._bitmap.fontSize = textSize;
      if (this._showLabel && label) {
        this._bitmap.textColor = textColor; this._bitmap.drawText(label, 2, 0, Math.floor(w * 0.4), h - barH, 'left');
      }
      if (this._showValue) {
        var valStr = String(cur) + '/' + String(max); this._bitmap.textColor = textColor; this._bitmap.drawText(valStr, 0, 0, w - 2, h - barH, 'right');
      }
    }
    this._drawDecoBorder(this._bitmap, w, h, this._def); Widget_Base.prototype.refresh.call(this);
  };
  Widget_Gauge.prototype.update = function() {
    if (this._updateCount === undefined) this._updateCount = 0; if (++this._updateCount % 6 === 0) this.refresh(); Widget_Base.prototype.update.call(this);
  }; window.Widget_Gauge = Widget_Gauge;
  function Widget_Separator() {}
  Widget_Separator.prototype = Object.create(Widget_Base.prototype); Widget_Separator.prototype.constructor = Widget_Separator;
  Widget_Separator.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget); var sprite = new Sprite();
    sprite.x = this._x; sprite.y = this._y; if (def.bgAlpha !== undefined) sprite.opacity = Math.round(def.bgAlpha * 255);
    var h = this._height || 4; var bitmap = new Bitmap(this._width, h); this._drawDecoBg(bitmap, this._width, h, def); var lineY = Math.floor(h / 2) - 1;
    bitmap.paintOpacity = 64; bitmap.fillRect(0, lineY, this._width, 2, '#ffffff');
    bitmap.paintOpacity = 255; this._drawDecoBorder(bitmap, this._width, h, def); sprite.bitmap = bitmap; this._displayObject = sprite;
  }; window.Widget_Separator = Widget_Separator;
  function Widget_Background() {}
  Widget_Background.prototype = Object.create(Widget_Base.prototype); Widget_Background.prototype.constructor = Widget_Background;
  Widget_Background.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget); var sprite = new Sprite(); sprite.x = this._x; sprite.y = this._y;
    sprite.bitmap = SceneManager.backgroundBitmap(); if (def.bgAlpha !== undefined) sprite.opacity = Math.round(def.bgAlpha * 255); this._displayObject = sprite;
  }; window.Widget_Background = Widget_Background;
  function Widget_Icons() {}
  Widget_Icons.prototype = Object.create(Widget_Base.prototype); Widget_Icons.prototype.constructor = Widget_Icons;
  Widget_Icons.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget); this._iconsExpr = def.iconsExpr || null;
    this._maxCols   = def.maxCols   || 10; this._iconSize  = def.iconSize  || (typeof Window_Base !== 'undefined' && Window_Base._iconWidth) || 32;
    this._iconGap   = def.iconGap   !== undefined ? def.iconGap : 2; var h = this._height || (this._iconSize + this._iconGap);
    var bitmap = new Bitmap(this._width, h); this._bitmap = bitmap; var sprite = new Sprite(bitmap); sprite.x = this._x;
    sprite.y = this._y; if (def.bgAlpha !== undefined) sprite.opacity = Math.round(def.bgAlpha * 255); this._displayObject = sprite; this.refresh();
  };
  Widget_Icons.prototype._getIcons = function() {
    if (!this._iconsExpr) return [];
    try {
      var c = (SceneManager._scene && SceneManager._scene._ctx) || {};
      var result = new Function('$ctx', 'return (' + this._iconsExpr + ')')(c); return Array.isArray(result) ? result : [];
    } catch(e) { return []; }
  };
  Widget_Icons.prototype.refresh = function() {
    if (!this._bitmap) return; var w = this._width; var h = this._bitmap.height;    this._bitmap.clear(); this._drawDecoBg(this._bitmap, w, h, this._def); var icons = this._getIcons();
    if (!icons.length) { this._drawDecoBorder(this._bitmap, w, h, this._def); return; }
    var iconSet = ImageManager.loadSystem('IconSet'); var iconSize = this._iconSize; var gap = this._iconGap;
    var maxCols = this._maxCols; var iconW = typeof Window_Base !== 'undefined' ? Window_Base._iconWidth  : 32;
    var iconH = typeof Window_Base !== 'undefined' ? Window_Base._iconHeight : 32; var cols = 16; var bmp = this._bitmap; var def = this._def;
    iconSet.addLoadListener(function() {
      bmp.clear();
      for (var i = 0; i < icons.length; i++) {
        var iconIndex = icons[i]; if (!iconIndex) continue; var col = i % maxCols; var row = Math.floor(i / maxCols);
        var sx = (iconIndex % cols) * iconW; var sy = Math.floor(iconIndex / cols) * iconH;
        var dx = col * (iconSize + gap); var dy = row * (iconSize + gap); bmp.blt(iconSet, sx, sy, iconW, iconH, dx, dy, iconSize, iconSize);
      }
    }); this._drawDecoBorder(this._bitmap, w, h, this._def);
  };
  Widget_Icons.prototype.update = function() {
    if (this._updateCount === undefined) this._updateCount = 0; if (++this._updateCount % 30 === 0) this.refresh(); Widget_Base.prototype.update.call(this);
  }; window.Widget_Icons = Widget_Icons;
  function Widget_Options() {}
  Widget_Options.prototype = Object.create(Widget_Base.prototype); Widget_Options.prototype.constructor = Widget_Options;
  Widget_Options.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget); var win = new Window_CustomOptions(this._x, this._y, def);
    win._customClassName = 'Widget_CS_' + this._id; win.deactivate();
    this._applyWindowStyle(win, def); if (def.windowed !== false && def.bgAlpha !== undefined) win.opacity = Math.round(def.bgAlpha * 255);
    this._window = win; this._displayObject = win; this._createDecoSprite(def, this._width, def.height || 400);
  }; Widget_Options.prototype.collectFocusable = function(out) { out.push(this); };
  Widget_Options.prototype.activate = function() {
    if (this._window) {
      this._window.activate(); if (this._window.index() < 0) this._window.select(0);
    }
  }; Widget_Options.prototype.deactivate = function() { if (this._window) { this._window.deactivate(); this._window.deselect(); } };
  Widget_Options.prototype.setHandler = function(symbol, fn) { if (this._window) this._window.setHandler(symbol, fn); };
  Widget_Options.prototype.setCancelHandler = function(fn) { if (this._window) this._window.setHandler('cancel', fn); };
  Widget_Options.prototype.handlesUpDown = function() { return true; }; window.Widget_Options = Widget_Options;
  function Widget_Button() {}
  Widget_Button.prototype = Object.create(Widget_Base.prototype); Widget_Button.prototype.constructor = Widget_Button;
  Widget_Button.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._label = def.label !== undefined ? def.label : (def.name || 'Button'); this._handlerDef = def.action || null;
    this._leftHandlerDef = def.leftAction || null; this._rightHandlerDef = def.rightAction || null;
    this._focusable = def.focusable !== false; this._hideOnKeyboard = !!def.hideOnKeyboard;
    this._btnTouching = false; this._transition = def.transition || 'system'; this._transitionConfig = def.transitionConfig || {};
    this._btnState = 'normal'; this._transitionOverlay = null; this._transitionDisabled = false; this._labelSprite = null;
    this._labelBitmap = null; var hasChildren = !!(def.children && def.children.length > 0);
    var win = new Window_ButtonRow(this._x, this._y, this._width, this._height || 52); win._customClassName = 'Widget_CS_' + this._id; win.deactivate();
    var btnDef = def.windowed !== undefined ? def : Object.assign({}, def, { windowed: false }); this._applyWindowStyle(win, btnDef);
    if (btnDef.windowed !== false && def.bgAlpha !== undefined) win.opacity = Math.round(def.bgAlpha * 255);
    this._window = win; this._displayObject = win; this._createDecoSprite(def, this._width, this._height || 52);
    this._createButtonLabel(def); this._createTransitionSprite(def);
  }; Widget_Button.prototype.collectFocusable = function(out) { if (this._focusable) out.push(this); };
  Widget_Button.prototype.activate = function() { if (this._window) { this._window.activate(); this._window.select(0); } };
  Widget_Button.prototype.deactivate = function() { if (this._window) { this._window.deactivate(); this._window.deselect(); } };
  Widget_Button.prototype.setOkHandler = function(fn) { if (this._window) this._window.setHandler('ok', fn); };
  Widget_Button.prototype.setCancelHandler = function(fn) { if (this._window) this._window.setHandler('cancel', fn); };
  Widget_Button.prototype.setDisabled = function(disabled) { this._transitionDisabled = !!disabled; };
  Widget_Button.prototype._createButtonLabel = function(def) {
    if (!this._label) return; var w = this._width || 120; var h = this._height || 52;
    var fontSize = def.fontSize || 28; var bold = !!def.bold; var bmp = new Bitmap(Math.max(1, w), Math.max(1, h));
    bmp.fontSize = fontSize; bmp.fontBold = bold; var sprite = new Sprite(bmp); sprite.x = def.x || 0;
    sprite.y = def.y || 0; this._labelSprite = sprite; this._labelBitmap = bmp; this._refreshButtonLabel();
  };
  Widget_Button.prototype._refreshButtonLabel = function() {
    var bmp = this._labelBitmap; if (!bmp) return;
    var def = this._def; var fontSize = def.fontSize || 28; var color = def.color || '#ffffff'; var align = def.align || 'center';
    var w = this._width || 120; var h = this._height || 52; bmp.clear(); bmp.textColor = color; var textH = fontSize + 8;    var ty = Math.max(0, Math.floor((h - textH) / 2)); bmp.drawText(resolveTemplate(this._label), 0, ty, w, textH, align);
  };
  Widget_Button.prototype._createTransitionSprite = function(def) {
    if (this._transition === 'system') return; var w = this._width || 120; var h = this._height || 52;
    if (!this._decoSprite) {
      var base = new Sprite(new Bitmap(1, 1)); base.x = def.x || 0; base.y = def.y || 0; this._decoSprite = base;
    }
    if (this._transition === 'colorTint') {
      var overlay = new Sprite(new Bitmap(w, h)); this._decoSprite.addChild(overlay); this._transitionOverlay = overlay;
    } else if (this._transition === 'spriteSwap') {
      var imgSpr = new Sprite(); this._decoSprite.addChild(imgSpr); this._transitionOverlay = imgSpr;
    }
    this._applyTransition('normal');
  };
  Widget_Button.prototype._applyTransition = function(state) {
    if (!this._transitionOverlay) return; var cfg = this._transitionConfig;
    if (this._transition === 'colorTint') {
      var color = cfg[state + 'Color'] || cfg['normalColor'] || [255, 255, 255, 0]; var bmp = this._transitionOverlay.bitmap;      if (!bmp) return; var ctx = bmp._context; if (!ctx) return; ctx.clearRect(0, 0, bmp.width, bmp.height);
      if (color[3] > 0) {
        ctx.fillStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + (color[3] / 255).toFixed(3) + ')'; ctx.fillRect(0, 0, bmp.width, bmp.height);
      }
      bmp._setDirty();
    } else if (this._transition === 'spriteSwap') {
      var imgPath = cfg[state + 'Image'] || cfg['normalImage'];
      if (!imgPath) { this._transitionOverlay.bitmap = null; return; }
      var frame = cfg[state + 'Frame'] || cfg['normalFrame'] || null; var self = this;      var w = this._width || 120; var h = this._height || 52; var bmp = ImageManager.loadSystem(imgPath); this._transitionOverlay.bitmap = bmp;
      bmp.addLoadListener(function() {
        if (!self._transitionOverlay || self._transitionOverlay.bitmap !== bmp) return;
        if (frame) {
          self._transitionOverlay.scale.x = 1; self._transitionOverlay.scale.y = 1; self._transitionOverlay.setFrame(frame[0], frame[1], frame[2], frame[3]);
        } else {
          self._transitionOverlay.scale.x = w / bmp.width; self._transitionOverlay.scale.y = h / bmp.height;
        }
      });
    }
  };
  Widget_Button.prototype._syncExternalVisibility = function() {
    var parentVisible = true; var p = this._parent;
    while (p) {
      if (p._displayObject && !p._displayObject.visible) { parentVisible = false; break; }
      p = p._parent;
    }
    if (this._hideOnKeyboard) {
      var showBtn = parentVisible && typeof TouchInput !== 'undefined' && typeof Input !== 'undefined'
        ? TouchInput.date > Input.date : false;
      if (this._displayObject)     this._displayObject.visible     = showBtn; if (this._decoSprite)        this._decoSprite.visible        = showBtn;
      if (this._transitionOverlay) this._transitionOverlay.visible = showBtn; if (this._labelSprite)       this._labelSprite.visible       = showBtn;
    } else {
      if (this._decoSprite)        this._decoSprite.visible        = parentVisible; if (this._transitionOverlay) this._transitionOverlay.visible = parentVisible;
      if (this._labelSprite)       this._labelSprite.visible       = parentVisible;
    }
  };
  Widget_Button.prototype._updateTransitionState = function() {
    var win = this._window; if (!win) return; var newState;
    if (this._transitionDisabled) {
      newState = 'disabled';
    } else {
      var tx = TouchInput.x, ty = TouchInput.y; var wx = win.x, wy = win.y, ww = win.width, wh = win.height;
      var hovered = (tx >= wx && tx < wx + ww && ty >= wy && ty < wy + wh);
      if (hovered && TouchInput.isPressed()) {
        newState = 'pressed';
      } else if (hovered || win.active) {
        newState = 'highlighted';
      } else newState = 'normal';
    }
    if (newState !== this._btnState) {
      this._btnState = newState; this._applyTransition(newState);
    }
  };
  Widget_Button.prototype.update = function() {
    Widget_Base.prototype.update.call(this); this._syncExternalVisibility(); if (this._transition !== 'system') this._updateTransitionState();
    if (!this._transitionDisabled && this._window && this._window.isOpen() && this._window.visible) {
      if (TouchInput.isTriggered()) {
        var tx = TouchInput.x, ty = TouchInput.y; var wx = this._window.x, wy = this._window.y; var ww = this._window.width, wh = this._window.height;
        if (tx >= wx && tx < wx + ww && ty >= wy && ty < wy + wh) {
          if (this._focusable) {
            if (!this._window.active) {
              var navMgr = SceneManager._scene && SceneManager._scene._navManager; if (navMgr) navMgr.focusWidget(this._id);
            } else this._btnTouching = true;
          } else this._btnTouching = true;
        }
      }
      if (this._btnTouching) {
        if (TouchInput.isReleased()) {
          this._btnTouching = false; this._window.callOkHandler();
        } else if (!TouchInput.isPressed()) {   this._btnTouching = false; }
      }
    }
    if (this._labelSprite) this._labelSprite.opacity = this._transitionDisabled ? 128 : 255;
  }; window.Widget_Button = Widget_Button;
  function Widget_ShopNumber() {}
  Widget_ShopNumber.prototype = Object.create(Widget_Base.prototype); Widget_ShopNumber.prototype.constructor = Widget_ShopNumber;
  Widget_ShopNumber.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget); this._handlersDef = def.handlers || {};
    var h = def.height || 400; var win = new Window_ShopNumber(this._x, this._y, h); win._customClassName = 'Widget_CS_' + this._id; win.deactivate();
    this._applyWindowStyle(win, def); this._window = win; this._displayObject = win;
  }; Widget_ShopNumber.prototype.collectFocusable = function(out) { out.push(this); };
  Widget_ShopNumber.prototype.activate = function() { if (this._window) this._window.activate(); };
  Widget_ShopNumber.prototype.deactivate = function() { if (this._window) this._window.deactivate(); };
  Widget_ShopNumber.prototype.setup = function(item, max, price) {
    if (!this._window) return; this._window.setup(item, Math.max(1, Math.floor(max)), price);
    if (typeof TextManager !== 'undefined') this._window.setCurrencyUnit(TextManager.currencyUnit);
  }; Widget_ShopNumber.prototype.number = function() { return this._window ? this._window.number() : 0; };
  Widget_ShopNumber.prototype.setHandler = function(symbol, fn) { if (this._window) this._window.setHandler(symbol, fn); };
  Widget_ShopNumber.prototype.setCancelHandler = function(fn) { if (this._window) this._window.setHandler('cancel', fn); }; window.Widget_ShopNumber = Widget_ShopNumber;
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
  var BATTLE_WIN_PROXY_MAP = [
    { widgetId: 'logWindow',    winProp: '_logWindow'    },
    { widgetId: 'statusWindow', winProp: '_statusWindow' },
    { widgetId: 'helpWindow',   winProp: '_helpWindow'   },
    { widgetId: 'skillWindow',  winProp: '_skillWindow'  },
    { widgetId: 'itemWindow',   winProp: '_itemWindow'   },
    { widgetId: 'actorWindow',  winProp: '_actorWindow'  },
    { widgetId: 'enemyWindow',  winProp: '_enemyWindow'  },
  ];
  function installBattleWindowProxy(win, widget, widgetId) {
    if (!win) return; win._csProxied = true; if (win.move) win.move(-9999, win.y); else win.x = -9999;
    if (!widget) {
      console.error('[CSE:battle] 위젯 누락: id="' + widgetId + '" — battle.json에 해당 id의 위젯을 추가하세요.');
      ['show', 'open', 'activate'].forEach(function(m) {
        if (!win[m]) return;
        win[m] = function() {
          console.warn('[CSE:battle] ' + widgetId + '.' + m + '() — 위젯 없음');
        };
      }); return;
    }
    var DELEGATE = ['show', 'hide', 'open', 'close', 'activate', 'deactivate',
                    'refresh', 'select', 'deselect', 'setActor', 'setStypeId', 'setItem'];
    DELEGATE.forEach(function(method) {
      if (!win[method]) return; var orig = win[method].bind(win);
      win[method] = function() {
          try { orig.apply(win, arguments); } catch(e) {}
        if (method === 'activate') win.active = false; win.x = -9999; if (widget[method]) widget[method].apply(widget, arguments);
      };
    });
    if (win.setHandler) {
      var origSH = win.setHandler.bind(win);
      win.setHandler = function(symbol, fn) {
        origSH(symbol, fn); if (widget.setHandler) widget.setHandler(symbol, fn);
      };
    }
    if (widgetId === 'helpWindow' && win.setItem) {
      var _prevSetItem = win.setItem.bind(win);
      win.setItem = function(item) {
        _prevSetItem(item); var scene = SceneManager._scene;
        if (scene && scene._ctx) {
          var text = (item && item.description) ? item.description : '';
          if (item && item.stypeId !== undefined) {
            var actor = BattleManager.actor();
            if (actor) {
              var mpCost = actor.skillMpCost(item); var tpCost = actor.skillTpCost(item); var costs = []; if (mpCost > 0) costs.push('MP ' + mpCost);
              if (tpCost > 0) costs.push('TP ' + tpCost); if (costs.length > 0) text += '\n소비: ' + costs.join(' / ');
            }
          }
          scene._ctx.helpText = text;
        }
      };
    }
    if (widgetId === 'skillWindow' || widgetId === 'itemWindow') {
      win.item = function() { return widget._window ? widget._window.currentExt() : null; };
    }
    if (widgetId === 'actorWindow') {
      win.actor = function() {
        if (widget._window) return widget._window.currentExt(); return widget.currentExt ? widget.currentExt() : null;
      };
      win.index = function() {
        if (widget._window) return widget._window.index(); return widget.index ? widget.index() : -1;
      };
    }
    if (widgetId === 'enemyWindow') {
      win.enemy = function() { return widget._window ? widget._window.currentExt() : null; };
      win.enemyIndex = function() { return widget._window ? widget._window.index() : -1; };
    }
    if (widget._window && widget._window !== win && win._handlers) {   for (var _sym in win._handlers) if (Object.prototype.hasOwnProperty.call(win._handlers, _sym)) widget._window.setHandler(_sym, win._handlers[_sym]); }
  }
  function applyBattleOverrides(Klass, sceneId) {
    var SCU = Scene_CustomUI.prototype; var SCB = Scene_Battle.prototype;
    for (var key in SCU) if (SCU.hasOwnProperty(key) && !SCB.hasOwnProperty(key)) Klass.prototype[key] = SCU[key]; var origInit = Klass.prototype.initialize;
    Klass.prototype.initialize = function() {
      origInit.call(this); this._ctx = this._ctx || {}; this._widgetMap = {}; this._rootWidget = null;
    }; Klass.prototype._getSceneDef = function() { return (_scenesData.scenes || {})[sceneId] || null; }; var origCreateAllWindows = Klass.prototype.createAllWindows;
    Klass.prototype.createAllWindows = function() {
      var sceneDef = this._getSceneDef(); if (sceneDef && sceneDef.root) this._createWidgetTree(sceneDef); origCreateAllWindows.call(this); var nativePositions = {};
      for (var pi = 0; pi < BATTLE_WIN_PROXY_MAP.length; pi++) {
        var pentry = BATTLE_WIN_PROXY_MAP[pi]; var pwin = this[pentry.winProp];
        if (pwin) {
          nativePositions[pentry.widgetId] = {
            x: pwin.x, y: pwin.y, width: pwin.width, height: pwin.height
          };
        }
      }
      var wmap = this._widgetMap || {};
      for (var i = 0; i < BATTLE_WIN_PROXY_MAP.length; i++) {
        var entry = BATTLE_WIN_PROXY_MAP[i]; var win = this[entry.winProp]; var widget = wmap[entry.widgetId] || null; installBattleWindowProxy(win, widget, entry.widgetId);
      }
      if (this._messageWindow) this._messageWindow.x = -9999;
      if (sceneDef && sceneDef.root) {
        var needsSave = false;
        for (var widgetId in nativePositions) {
          var widgetDef = _findWidgetDefById(sceneDef.root, widgetId);
          if (widgetDef && widgetDef.nativeDefault) {
            var pos = nativePositions[widgetId]; widgetDef.x = pos.x; widgetDef.y = pos.y; widgetDef.width = pos.width;
            widgetDef.height = pos.height; var nwgt = wmap[widgetId]; if (nwgt) _applyPosToWidget(nwgt, pos); needsSave = true;
          }
        }
        if (needsSave) {
          _saveSceneDef(sceneDef, function() {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'sceneDefUpdated', sceneId: sceneDef.id }, '*');
            }
          });
        }
      }
      var _hiddenAtStart = ['skillWindow', 'itemWindow', 'actorWindow', 'enemyWindow', 'helpWindow', 'actorCommand'];
      for (var hi = 0; hi < _hiddenAtStart.length; hi++) {
        var hw = wmap[_hiddenAtStart[hi]]; if (hw && hw.hide) hw.hide();
      }
      var rootObj = this._rootWidget && this._rootWidget.displayObject(); if (rootObj && !(rootObj instanceof Window_Base)) this.addChild(rootObj);
    };
    Klass.prototype.createPartyCommandWindow = function() {
      var widget = this._widgetMap && this._widgetMap['partyCommand'];
      if (widget && widget._window) {
        var win = widget._window; win.setup = function() { this.refresh(); this.select(0); this.activate(); this.open(); }; this._partyCommandWindow = win;
      } else {
        this._partyCommandWindow = new Window_PartyCommand(); this.addWindow(this._partyCommandWindow);
      }
      this._partyCommandWindow.setHandler('fight',  this.commandFight.bind(this));
      this._partyCommandWindow.setHandler('escape', this.commandEscape.bind(this)); this._partyCommandWindow.deselect();
    };
    Klass.prototype.createActorCommandWindow = function() {
      var widget = this._widgetMap && this._widgetMap['actorCommand'];
      if (widget && widget._window) {
        var win = widget._window; var actorWidget = widget;
        win.setup = function(actor) {
          if (actorWidget._rebuildFromScript) actorWidget._rebuildFromScript(); if (actorWidget.show) actorWidget.show(); this.select(0); this.activate(); this.open();
        }; this._actorCommandWindow = win;
      } else {
        this._actorCommandWindow = new Window_ActorCommand(); this.addWindow(this._actorCommandWindow);
      }
      this._actorCommandWindow.setHandler('attack', this.commandAttack.bind(this)); this._actorCommandWindow.setHandler('skill',  this.commandSkill.bind(this));
      this._actorCommandWindow.setHandler('guard',  this.commandGuard.bind(this)); this._actorCommandWindow.setHandler('item',   this.commandItem.bind(this));
      this._actorCommandWindow.setHandler('cancel', this.selectPreviousCommand.bind(this));
    };
    Klass.prototype.commandAttack = function() {
      this._ctx.lastActorCommand = 'attack'; this._csInSubSelection = true;
      BattleManager.inputtingAction().setAttack(); this._actorCommandWindow.deactivate(); this.selectEnemySelection();
    };
    Klass.prototype.commandSkill = function() {
      var stypeId = 1;
      if (this._actorCommandWindow && typeof this._actorCommandWindow.currentExt === 'function') {
        var ext = this._actorCommandWindow.currentExt(); if (typeof ext === 'number') stypeId = ext;
      }
      this._ctx.lastActorCommand = 'skill'; this._ctx.currentSkillStypeId = stypeId; this._csInSubSelection = true; this._actorCommandWindow.deactivate();
      this._skillWindow.setActor(BattleManager.actor()); this._skillWindow.setStypeId(stypeId);
      this._skillWindow.refresh(); this._skillWindow.show(); this._skillWindow.activate(); this._helpWindow.show();
    };
    Klass.prototype.commandItem = function() {
      this._ctx.lastActorCommand = 'item'; this._csInSubSelection = true; this._actorCommandWindow.deactivate(); this._itemWindow.refresh();
      this._itemWindow.show(); this._itemWindow.activate(); this._helpWindow.show();
    }; var origSES = SCB.selectEnemySelection || function() {};
    Klass.prototype.selectEnemySelection = function() {
      this._csInSubSelection = true; var wmap = this._widgetMap || {}; if (wmap.actorCommand && wmap.actorCommand.deactivate) wmap.actorCommand.deactivate();
      ['statusWindow', 'actorWindow'].forEach(function(id) {
        var w = wmap[id]; if (w && w._rowOverlay) w._rowOverlay.alpha = 0.35; if (w && w._window) w._window.alpha = 0.35;
      }); var enemyWidget = wmap['enemyWindow'];
      if (enemyWidget && enemyWidget._window) {
        if (!enemyWidget._window._csBattleLifted) {
          if (enemyWidget._window.parent) enemyWidget._window.parent.removeChild(enemyWidget._window);
          SceneManager._scene.addChild(enemyWidget._window); enemyWidget._window._csBattleLifted = true;
        }
        if (!enemyWidget._window._csBattleBlinkHooked) {
          enemyWidget._window._csBattleBlinkHooked = true; var self = this;          var origWinSel = enemyWidget._window.select.bind(enemyWidget._window);
          enemyWidget._window.select = function(index) {
            origWinSel(index); if (self._enemyWindow && typeof self._enemyWindow.select === 'function') self._enemyWindow.select(index);
          };
        }
      }
      origSES.call(this);
    }; var origSAS = SCB.selectActorSelection || function() {};
    Klass.prototype.selectActorSelection = function() {
      this._csInSubSelection = true; var wmap = this._widgetMap || {};
      if (wmap.actorCommand && wmap.actorCommand.deactivate) wmap.actorCommand.deactivate(); origSAS.call(this);
    };
    Klass.prototype.onSkillCancel = function() {
      this._csInSubSelection = false; this._skillWindow.hide(); this._helpWindow.hide(); this._actorCommandWindow.activate();
    };
    Klass.prototype.onItemCancel = function() {
      this._csInSubSelection = false; this._itemWindow.hide(); this._helpWindow.hide(); this._actorCommandWindow.activate();
    };
    Klass.prototype.onActorCancel = function() {
      this._csInSubSelection = false; var actorWidget = this._widgetMap && this._widgetMap['actorWindow'];
      if (actorWidget && actorWidget.deactivate) actorWidget.deactivate(); var last = this._ctx.lastActorCommand;
      if (last === 'skill') { this._skillWindow.show(); this._skillWindow.activate(); }
      else if (last === 'item') { this._itemWindow.show(); this._itemWindow.activate(); }
      else { this._actorCommandWindow.activate(); }
    }; var origSPCS = SCB.startPartyCommandSelection || function() {};
    Klass.prototype.startPartyCommandSelection = function() {
      this._csInSubSelection = false; this._csActorCursorActive = false; var wmap = this._widgetMap || {};
      if (wmap.actorCommand) {
        if (wmap.actorCommand.deactivate) wmap.actorCommand.deactivate(); if (wmap.actorCommand.hide) wmap.actorCommand.hide();
      }
      if (wmap.actorWindow) if (wmap.actorWindow.hide) wmap.actorWindow.hide(); origSPCS.call(this);
    }; var origCIW = SCB.changeInputWindow || function() {};
    Klass.prototype.changeInputWindow = function() {
      if (this._csInSubSelection) return; origCIW.call(this);
    }; var origSACS = SCB.startActorCommandSelection || function() {};
    Klass.prototype.startActorCommandSelection = function() {
      var wmap = this._widgetMap || {}; if (wmap.partyCommand && wmap.partyCommand.deactivate) wmap.partyCommand.deactivate();
      origSACS.call(this); var actorWidget = wmap['actorWindow']; var actor = BattleManager.actor();
      if (actorWidget) {
        actorWidget.show(); if (actorWidget._window && actorWidget._window.open) actorWidget._window.open(); if (actor) actorWidget.select(actor.index());
      }
    };
    function _restoreStatusAlpha(wmap, alpha) {
      ['statusWindow', 'actorWindow'].forEach(function(id) {
        var w = wmap[id]; if (w && w._rowOverlay) w._rowOverlay.alpha = alpha; if (w && w._window) w._window.alpha = alpha;
      });
    }
    function _lowerEnemyWindow(inst, wmap) {
      var ew = wmap['enemyWindow'];
      if (ew && ew._window && ew._window._csBattleLifted) {
        if (ew._window.parent) ew._window.parent.removeChild(ew._window); if (inst._windowLayer) inst._windowLayer.addChild(ew._window); ew._window._csBattleLifted = false;
      }
    }
    Klass.prototype.onEnemyCancel = function() {
      this._csInSubSelection = false; if (this._enemyWindow && typeof this._enemyWindow.select === 'function') this._enemyWindow.select(-1);
      this._enemyWindow.hide(); var wmap = this._widgetMap || {}; _restoreStatusAlpha(wmap, 1); _lowerEnemyWindow(this, wmap);
      if (wmap.actorCommand && wmap.actorCommand.show) wmap.actorCommand.show(); var last = this._ctx.lastActorCommand || 'attack';
      if (last === 'attack') this._actorCommandWindow.activate();
      else if (last === 'skill') { this._skillWindow.show(); this._skillWindow.activate(); }
      else if (last === 'item') { this._itemWindow.show(); this._itemWindow.activate(); }
    }; var origOEO = SCB.onEnemyOk || function() {};
    Klass.prototype.onEnemyOk = function() {
      this._csInSubSelection = false; var wmap = this._widgetMap || {}; _restoreStatusAlpha(wmap, 1); _lowerEnemyWindow(this, wmap); origOEO.call(this);
    }; var origOAO = SCB.onActorOk || function() {};
    Klass.prototype.onActorOk = function() {
      if (!BattleManager.inputtingAction()) return; this._csInSubSelection = false; origOAO.call(this);
    }; var origStart = SCB.start;
    Klass.prototype.start = function() {
      if (window._uiEditorPreview) {
        this._isEditorPreview = true; Scene_Base.prototype.start.call(this);
      } else {
        this._isEditorPreview = false; origStart.call(this);
      }
    }; var origUpdate = Klass.prototype.update;
    Klass.prototype.update = function() {
      if (this._isEditorPreview) {
        Scene_Base.prototype.update.call(this);
      } else {
        origUpdate.call(this); if (this._logWindow && this._logWindow._lines) this._ctx.battleLog = this._logWindow._lines.join('\n'); this._csUpdateActorCursor();
      }
      if (this._widgetMap) {   for (var id in this._widgetMap) if (this._widgetMap[id].update) this._widgetMap[id].update(); }
    };
    Klass.prototype._csUpdateActorCursor = function() {
      var wmap = this._widgetMap || {}; var actorWidget = wmap['actorWindow']; if (!actorWidget) return;
      if (BattleManager.isInputting()) {
        if (!BattleManager.actor()) {
          if (actorWidget._csCursorOverlayVisible !== false) actorWidget.hide(); if (actorWidget._rowOverlay) actorWidget._rowOverlay.visible = false;
        }
        return;
      }
      var subject = BattleManager._subject;
      if (subject && subject.isActor && subject.isActor()) {
        var idx = subject.index();
        if (!this._csActorCursorActive) {
          this._csActorCursorActive = true; this._csActorCursorIdx = -1; actorWidget.show();
          if (actorWidget._window && actorWidget._window.open) actorWidget._window.open(); if (actorWidget._window) actorWidget._window.activate();
        }
        if (this._csActorCursorIdx !== idx) {
          this._csActorCursorIdx = idx; actorWidget.select(idx);
        }
      } else {
        if (this._csActorCursorActive) {
          this._csActorCursorActive = false; this._csActorCursorIdx = -1; actorWidget.hide();
        }
      }
    };
  }
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
})();