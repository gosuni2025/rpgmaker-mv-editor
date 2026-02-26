//=============================================================================
// CustomSceneEngine.js
//=============================================================================
/*:
 * @plugindesc 커스텀 씬 엔진 - UIEditorScenes.json에서 씬을 동적으로 생성
 * @author UI Editor
 *
 * @help CustomSceneEngine.js
 *
 * data/UIEditorScenes.json 파일을 읽어 커스텀 씬(Scene_CS_*)을 동적으로 생성합니다.
 * 에디터의 씬 에디터에서 정의한 씬을 게임 런타임에서 실행할 수 있습니다.
 *
 * ● 기본 동작
 *   UIEditorScenes.json이 없으면 아무 씬도 등록하지 않습니다.
 *
 * ● 호환성
 *   RPG Maker MV 1.6.x 이상, NW.js 및 웹 브라우저 배포 모두 지원.
 *   이 플러그인은 에디터에서 자동으로 관리됩니다.
 */

(function () {
  'use strict';

  //===========================================================================
  // 데이터 로드 (동기 XHR)
  //===========================================================================
  var _scenesData = {};
  var _configData = {};

  function loadJSON(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url + '?_=' + Date.now(), false);
      xhr.send();
      if (xhr.status === 200 || xhr.status === 0) {
        return JSON.parse(xhr.responseText);
      }
    } catch (e) {
      // 파일 없음 → 기본값
    }
    return {};
  }

  _scenesData = loadJSON('data/UIEditorScenes.json');
  _configData = loadJSON('data/UIEditorConfig.json');

  //===========================================================================
  // 템플릿 resolve 함수
  //===========================================================================
  function resolveTemplate(text) {
    if (!text || typeof text !== 'string') return text || '';
    return text.replace(/\{([^}]+)\}/g, function(match, expr) {
      try {
        // actor[N].field
        var actorMatch = expr.match(/^actor\[(\d+)\]\.(\w+)$/);
        if (actorMatch && typeof $gameParty !== 'undefined') {
          var members = $gameParty.members();
          var idx = parseInt(actorMatch[1]);
          var field = actorMatch[2];
          var actor = members[idx];
          if (!actor) return '';
          switch (field) {
            case 'name':  return actor.name();
            case 'class': return actor.currentClass() ? actor.currentClass().name : '';
            case 'level': return String(actor.level);
            case 'hp':    return String(actor.hp);
            case 'mhp':   return String(actor.mhp);
            case 'mp':    return String(actor.mp);
            case 'mmp':   return String(actor.mmp);
            case 'tp':    return String(actor.tp);
            default:      return String(actor[field] !== undefined ? actor[field] : '');
          }
        }
        // var:ID
        var varMatch = expr.match(/^var:(\d+)$/);
        if (varMatch && typeof $gameVariables !== 'undefined') {
          return String($gameVariables.value(parseInt(varMatch[1])));
        }
        // switch:ID
        var swMatch = expr.match(/^switch:(\d+)$/);
        if (swMatch && typeof $gameSwitches !== 'undefined') {
          return $gameSwitches.value(parseInt(swMatch[1])) ? 'ON' : 'OFF';
        }
        // gold
        if (expr === 'gold' && typeof $gameParty !== 'undefined') {
          return String($gameParty.gold());
        }
        // config.KEY
        var cfgMatch = expr.match(/^config\.(\w+)$/);
        if (cfgMatch && typeof ConfigManager !== 'undefined') {
          var v = ConfigManager[cfgMatch[1]];
          return typeof v === 'boolean' ? (v ? 'ON' : 'OFF') : String(v !== undefined ? v : '');
        }
      } catch (e) {}
      return match;
    });
  }

  //===========================================================================
  // Window_CustomCommand — Window_Command 상속
  //===========================================================================
  function Window_CustomCommand() {
    this.initialize.apply(this, arguments);
  }

  Window_CustomCommand.prototype = Object.create(Window_Command.prototype);
  Window_CustomCommand.prototype.constructor = Window_CustomCommand;

  Window_CustomCommand.prototype.initialize = function (x, y, winDef) {
    this._winDef = winDef || {};
    this._customClassName = 'Window_CS_' + (winDef && winDef.id ? winDef.id : 'unknown');
    Window_Command.prototype.initialize.call(this, x, y);
  };

  Window_CustomCommand.prototype.windowWidth = function () {
    return this._winDef.width || 240;
  };

  Window_CustomCommand.prototype.windowHeight = function () {
    if (this._winDef.height) return this._winDef.height;
    return this.fittingHeight(this.numVisibleRows());
  };

  Window_CustomCommand.prototype.numVisibleRows = function () {
    var cmds = this._winDef.commands || [];
    var cols = this._winDef.maxCols || 1;
    return Math.ceil(cmds.length / cols);
  };

  Window_CustomCommand.prototype.maxCols = function () {
    return this._winDef.maxCols || 1;
  };

  Window_CustomCommand.prototype.makeCommandList = function () {
    var cmds = this._winDef.commands || [];
    for (var i = 0; i < cmds.length; i++) {
      var cmd = cmds[i];
      var isEnabled;
      if (typeof cmd.enabledCondition === 'string' && cmd.enabledCondition) {
        try { isEnabled = !!(new Function('return ' + cmd.enabledCondition)()); }
        catch(e) { isEnabled = true; }
      } else {
        isEnabled = cmd.enabled !== false;
      }
      this.addCommand(cmd.name, cmd.symbol, isEnabled);
    }
  };

  window.Window_CustomCommand = Window_CustomCommand;

  //===========================================================================
  // Window_CustomDisplay — Window_Base 상속
  //===========================================================================
  function Window_CustomDisplay() {
    this.initialize.apply(this, arguments);
  }

  Window_CustomDisplay.prototype = Object.create(Window_Base.prototype);
  Window_CustomDisplay.prototype.constructor = Window_CustomDisplay;

  Window_CustomDisplay.prototype.initialize = function (x, y, width, height, winDef) {
    this._winDef = winDef || {};
    this._customClassName = 'Window_CS_' + (winDef && winDef.id ? winDef.id : 'unknown');
    Window_Base.prototype.initialize.call(this, x, y, width, height);
    this.refresh();
  };

  Window_CustomDisplay.prototype.refresh = function () {
    if (!this.contents) return;
    this.contents.clear();
    var elements = this._winDef.elements || [];
    for (var i = 0; i < elements.length; i++) {
      this.drawElement(elements[i]);
    }
  };

  Window_CustomDisplay.prototype.drawElement = function (elem) {
    if (!elem || !elem.type) return;
    var actor = null;
    if (typeof $gameParty !== 'undefined' && $gameParty.leader) {
      actor = $gameParty.leader();
    }
    if (!actor && typeof $gameActors !== 'undefined' && $gameActors.actor) {
      actor = $gameActors.actor(1);
    }

    var x = elem.x || 0;
    var y = elem.y || 0;
    var w = elem.width || 200;
    var h = elem.height || this.lineHeight();

    var align = elem.align || 'left';
    switch (elem.type) {
      case 'label':
      case 'text':
        this.drawTextEx(elem.content || '', x, y);
        break;
      case 'actorFace':
        if (actor) this.drawActorFace(actor, x, y, w, h);
        break;
      case 'actorName':
        if (actor) this.drawActorName(actor, x, y, w);
        break;
      case 'actorClass':
        if (actor) this.drawActorClass(actor, x, y, w);
        break;
      case 'actorLevel':
        if (actor) this.drawActorLevel(actor, x, y);
        break;
      case 'actorHp':
        if (actor) this.drawActorHp(actor, x, y, w);
        break;
      case 'actorMp':
        if (actor) this.drawActorMp(actor, x, y, w);
        break;
      case 'actorTp':
        if (actor) this.drawActorTp(actor, x, y, w);
        break;
      case 'actorIcons':
        if (actor) this.drawActorIcons(actor, x, y);
        break;
      case 'gold':
        if (typeof $gameParty !== 'undefined' && typeof TextManager !== 'undefined') {
          this.drawCurrencyValue($gameParty.gold(), TextManager.currencyUnit, x, y, w);
        }
        break;
      case 'variable': {
        var varVal = typeof $gameVariables !== 'undefined' ? $gameVariables.value(elem.varId || 0) : 0;
        this.drawText(String(varVal) + (elem.suffix || ''), x, y, w, align);
        break;
      }
      case 'configValue': {
        var cfgVal = typeof ConfigManager !== 'undefined' && elem.configKey ? ConfigManager[elem.configKey] : 0;
        if (cfgVal === undefined) cfgVal = 0;
        // boolean 값은 on/off로 표시
        var cfgStr = typeof cfgVal === 'boolean' ? (cfgVal ? 'ON' : 'OFF') : String(cfgVal) + (elem.suffix || '');
        this.drawText(cfgStr, x, y, w, align);
        break;
      }
      case 'image':
        if (typeof ImageManager !== 'undefined' && elem.imageName) {
          var folder = elem.imageFolder || 'img/system/';
          var bitmap = ImageManager.loadBitmap(folder, elem.imageName);
          var self = this;
          bitmap.addLoadListener(function () {
            var sw = elem.srcWidth || bitmap.width;
            var sh = elem.srcHeight || bitmap.height;
            self.contents.blt(bitmap, 0, 0, sw, sh, x, y, w, h);
          });
        }
        break;
      case 'separator':
        var lineY = y + this.lineHeight() / 2 - 1;
        this.contents.paintOpacity = 48;
        this.contents.fillRect(x, lineY, w, 2, this.normalColor());
        this.contents.paintOpacity = 255;
        break;
    }
  };

  window.Window_CustomDisplay = Window_CustomDisplay;

  //===========================================================================
  // Window_CustomActorList — Window_Selectable 상속, 파티 멤버 목록
  //===========================================================================
  function Window_CustomActorList() {
    this.initialize.apply(this, arguments);
  }

  Window_CustomActorList.prototype = Object.create(Window_Selectable.prototype);
  Window_CustomActorList.prototype.constructor = Window_CustomActorList;

  Window_CustomActorList.prototype.initialize = function(x, y, winDef) {
    this._winDef = winDef || {};
    this._customClassName = 'Window_CS_' + (winDef && winDef.id ? winDef.id : 'actorList');
    this._formationMode = false;
    this._pendingIndex = -1;
    var w = this._winDef.width || 576;
    var h = this._winDef.height || 624;
    Window_Selectable.prototype.initialize.call(this, x, y, w, h);
    this.loadImages();
    this.refresh();
  };

  Window_CustomActorList.prototype.maxItems = function() {
    return typeof $gameParty !== 'undefined' ? $gameParty.size() : 0;
  };

  Window_CustomActorList.prototype.numVisibleRows = function() {
    return this._winDef.numVisibleRows || 4;
  };

  Window_CustomActorList.prototype.itemHeight = function() {
    var clientHeight = this.height - this.padding * 2;
    return Math.floor(clientHeight / this.numVisibleRows());
  };

  Window_CustomActorList.prototype.loadImages = function() {
    if (typeof $gameParty === 'undefined' || typeof ImageManager === 'undefined') return;
    var self = this;
    $gameParty.members().forEach(function(actor) {
      var bitmap = ImageManager.reserveFace(actor.faceName());
      if (bitmap && bitmap.addLoadListener) {
        bitmap.addLoadListener(function() { self.refresh(); });
      }
    }, this);
  };

  Window_CustomActorList.prototype.drawItem = function(index) {
    this.drawItemBackground(index);
    this.drawItemImage(index);
    this.drawItemStatus(index);
  };

  Window_CustomActorList.prototype.drawItemBackground = function(index) {
    if (index === this._pendingIndex) {
      var rect = this.itemRect(index);
      var color = this.pendingColor();
      this.changePaintOpacity(false);
      this.contents.fillRect(rect.x, rect.y, rect.width, rect.height, color);
      this.changePaintOpacity(true);
    }
  };

  Window_CustomActorList.prototype.drawItemImage = function(index) {
    if (typeof $gameParty === 'undefined') return;
    var actor = $gameParty.members()[index];
    if (!actor) return;
    var rect = this.itemRect(index);
    this.changePaintOpacity(actor.isBattleMember());
    this.drawActorFace(actor, rect.x + 1, rect.y + 1, Window_Base._faceWidth, Window_Base._faceHeight);
    this.changePaintOpacity(true);
  };

  Window_CustomActorList.prototype.drawItemStatus = function(index) {
    if (typeof $gameParty === 'undefined') return;
    var actor = $gameParty.members()[index];
    if (!actor) return;
    var rect = this.itemRect(index);
    var x = rect.x + 162;
    var y = rect.y + rect.height / 2 - this.lineHeight() * 1.5;
    var width = rect.width - x - this.textPadding();
    this.drawActorSimpleStatus(actor, x, y, width);
  };

  Window_CustomActorList.prototype.processOk = function() {
    if (typeof $gameParty !== 'undefined') {
      var actor = $gameParty.members()[this.index()];
      if (actor) $gameParty.setMenuActor(actor);
    }
    Window_Selectable.prototype.processOk.call(this);
  };

  Window_CustomActorList.prototype.isCurrentItemEnabled = function() {
    if (this._formationMode) {
      if (typeof $gameParty === 'undefined') return false;
      var actor = $gameParty.members()[this.index()];
      return !!(actor && actor.isFormationChangeOk());
    }
    return true;
  };

  Window_CustomActorList.prototype.selectLast = function() {
    if (typeof $gameParty === 'undefined') return;
    var actor = $gameParty.menuActor ? $gameParty.menuActor() : null;
    if (actor) this.select(actor.index());
    else this.select(0);
  };

  Window_CustomActorList.prototype.formationMode = function() {
    return this._formationMode;
  };

  Window_CustomActorList.prototype.setFormationMode = function(mode) {
    this._formationMode = mode;
  };

  Window_CustomActorList.prototype.pendingIndex = function() {
    return this._pendingIndex;
  };

  Window_CustomActorList.prototype.setPendingIndex = function(index) {
    var last = this._pendingIndex;
    this._pendingIndex = index;
    if (this._pendingIndex !== last) {
      this.redrawItem(this._pendingIndex);
      this.redrawItem(last);
    }
  };

  window.Window_CustomActorList = Window_CustomActorList;

  //===========================================================================
  // Window_CustomOptions — Window_Command 상속, 옵션 설정 창
  //===========================================================================
  function Window_CustomOptions() {
    this.initialize.apply(this, arguments);
  }

  Window_CustomOptions.prototype = Object.create(Window_Command.prototype);
  Window_CustomOptions.prototype.constructor = Window_CustomOptions;

  Window_CustomOptions.prototype.initialize = function(x, y, winDef) {
    this._winDef = winDef || {};
    this._customClassName = 'Window_CS_' + (winDef && winDef.id ? winDef.id : 'options');
    Window_Command.prototype.initialize.call(this, x, y);
  };

  Window_CustomOptions.prototype.windowWidth = function() {
    return this._winDef.width || 400;
  };

  Window_CustomOptions.prototype.windowHeight = function() {
    if (this._winDef.height) return this._winDef.height;
    var opts = this._winDef.options || [];
    return this.fittingHeight(Math.max(opts.length, 1));
  };

  Window_CustomOptions.prototype.numVisibleRows = function() {
    var opts = this._winDef.options || [];
    return opts.length || 1;
  };

  Window_CustomOptions.prototype.makeCommandList = function() {
    var opts = this._winDef.options || [];
    for (var i = 0; i < opts.length; i++) {
      this.addCommand(opts[i].name, opts[i].symbol);
    }
  };

  Window_CustomOptions.prototype.statusWidth = function() {
    return 120;
  };

  Window_CustomOptions.prototype.drawItem = function(index) {
    var rect = this.itemRectForText(index);
    var sw = this.statusWidth();
    var titleWidth = rect.width - sw;
    this.resetTextColor();
    this.changePaintOpacity(this.isCommandEnabled(index));
    this.drawText(this.commandName(index), rect.x, rect.y, titleWidth, 'left');
    this.drawText(this.statusText(index), titleWidth, rect.y, sw, 'right');
    this.changePaintOpacity(true);
  };

  Window_CustomOptions.prototype.statusText = function(index) {
    var symbol = this.commandSymbol(index);
    var value = this.getConfigValue(symbol);
    if (this.isVolumeSymbol(symbol)) {
      return (value || 0) + '%';
    }
    return value ? 'ON' : 'OFF';
  };

  Window_CustomOptions.prototype.isVolumeSymbol = function(symbol) {
    var opts = this._winDef.options || [];
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].symbol === symbol) return opts[i].optionType === 'volume';
    }
    return symbol && symbol.indexOf('Volume') >= 0;
  };

  Window_CustomOptions.prototype.getConfigValue = function(symbol) {
    return typeof ConfigManager !== 'undefined' ? ConfigManager[symbol] : undefined;
  };

  Window_CustomOptions.prototype.setConfigValue = function(symbol, value) {
    if (typeof ConfigManager !== 'undefined') ConfigManager[symbol] = value;
  };

  Window_CustomOptions.prototype.changeValue = function(symbol, value) {
    var last = this.getConfigValue(symbol);
    if (last !== value) {
      this.setConfigValue(symbol, value);
      this.redrawItem(this.findSymbol(symbol));
      if (typeof SoundManager !== 'undefined') SoundManager.playCursor();
    }
  };

  Window_CustomOptions.prototype.volumeOffset = function() {
    return 20;
  };

  // processOk 완전 오버라이드 — 창 닫지 않고 값만 변경
  Window_CustomOptions.prototype.processOk = function() {
    var symbol = this.commandSymbol(this.index());
    var value = this.getConfigValue(symbol);
    if (this.isVolumeSymbol(symbol)) {
      value = ((value || 0) + this.volumeOffset());
      if (value > 100) value = 0;
    } else {
      value = !value;
    }
    this.changeValue(symbol, value);
  };

  Window_CustomOptions.prototype.cursorRight = function(wrap) {
    var symbol = this.commandSymbol(this.index());
    var value = this.getConfigValue(symbol);
    if (this.isVolumeSymbol(symbol)) {
      value = Math.min(100, (value || 0) + this.volumeOffset());
      this.changeValue(symbol, value);
    } else {
      this.changeValue(symbol, true);
    }
  };

  Window_CustomOptions.prototype.cursorLeft = function(wrap) {
    var symbol = this.commandSymbol(this.index());
    var value = this.getConfigValue(symbol);
    if (this.isVolumeSymbol(symbol)) {
      value = Math.max(0, (value || 0) - this.volumeOffset());
      this.changeValue(symbol, value);
    } else {
      this.changeValue(symbol, false);
    }
  };

  window.Window_CustomOptions = Window_CustomOptions;

  //===========================================================================
  // Widget_Base — 위젯 트리 기본 클래스
  //===========================================================================
  function Widget_Base() {}
  Widget_Base.prototype.initialize = function(def, parentWidget) {
    this._def = def || {};
    this._id = def.id || '';
    this._x = def.x || 0;
    this._y = def.y || 0;
    this._width = def.width || 100;
    this._height = def.height || 36;
    this._visible = def.visible !== false;
    this._children = [];
    this._parent = parentWidget || null;
    this._displayObject = null;
  };
  Widget_Base.prototype.displayObject = function() { return this._displayObject; };
  Widget_Base.prototype.addChildWidget = function(child) {
    this._children.push(child);
    child._parent = this;
    if (this._displayObject && child.displayObject()) {
      this._displayObject.addChild(child.displayObject());
    }
  };
  Widget_Base.prototype.update = function() {
    for (var i = 0; i < this._children.length; i++) {
      this._children[i].update();
    }
  };
  Widget_Base.prototype.refresh = function() {
    for (var i = 0; i < this._children.length; i++) {
      this._children[i].refresh();
    }
  };
  Widget_Base.prototype.findWidget = function(id) {
    if (this._id === id) return this;
    for (var i = 0; i < this._children.length; i++) {
      var found = this._children[i].findWidget(id);
      if (found) return found;
    }
    return null;
  };
  Widget_Base.prototype.collectFocusable = function(out) {
    for (var i = 0; i < this._children.length; i++) {
      this._children[i].collectFocusable(out);
    }
  };
  Widget_Base.prototype.destroy = function() {
    for (var i = 0; i < this._children.length; i++) {
      this._children[i].destroy();
    }
    this._children = [];
  };
  window.Widget_Base = Widget_Base;

  //===========================================================================
  // Widget_Panel — 패널 (windowed 또는 투명 컨테이너)
  //===========================================================================
  function Widget_Panel() {}
  Widget_Panel.prototype = Object.create(Widget_Base.prototype);
  Widget_Panel.prototype.constructor = Widget_Panel;
  Widget_Panel.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._windowed = def.windowed !== false;
    if (this._windowed) {
      var padding = def.padding;
      var win = new Window_Base(this._x, this._y, this._width, this._height || 400);
      if (padding !== undefined) win._padding = padding;
      if (def.backOpacity !== undefined) win.backOpacity = def.backOpacity;
      win._customClassName = 'Window_CS_' + this._id;
      this._displayObject = win;
      this._padding = win._padding;
    } else {
      var container = new Sprite();
      container.x = this._x;
      container.y = this._y;
      this._displayObject = container;
      this._padding = 0;
    }
  };
  Widget_Panel.prototype.addChildWidget = function(child) {
    this._children.push(child);
    child._parent = this;
    if (child.displayObject()) {
      var childObj = child.displayObject();
      if (this._windowed) {
        childObj.x += this._padding;
        childObj.y += this._padding;
      }
      // Window_Base 자식은 씬에서 addWindow로 별도 추가 — 여기서는 위치 오프셋만 적용
      if (childObj instanceof Window_Base) {
        childObj.x += this._x;
        childObj.y += this._y;
      } else if (this._displayObject) {
        this._displayObject.addChild(childObj);
      }
    }
  };
  window.Widget_Panel = Widget_Panel;

  //===========================================================================
  // Widget_Label — 텍스트 라벨 (템플릿 지원)
  //===========================================================================
  function Widget_Label() {}
  Widget_Label.prototype = Object.create(Widget_Base.prototype);
  Widget_Label.prototype.constructor = Widget_Label;
  Widget_Label.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._template = def.text || '';
    this._align = def.align || 'left';
    this._fontSize = def.fontSize || 28;
    var sprite = new Sprite();
    sprite.x = this._x;
    sprite.y = this._y;
    var bitmap = new Bitmap(this._width, this._height);
    bitmap.fontSize = this._fontSize;
    sprite.bitmap = bitmap;
    this._sprite = sprite;
    this._bitmap = bitmap;
    this._displayObject = sprite;
    this.refresh();
  };
  Widget_Label.prototype.refresh = function() {
    if (!this._bitmap) return;
    this._bitmap.clear();
    var text = resolveTemplate(this._template);
    this._bitmap.drawText(text, 0, 0, this._width, this._height, this._align);
    Widget_Base.prototype.refresh.call(this);
  };
  Widget_Label.prototype.update = function() {
    if (this._updateCount === undefined) this._updateCount = 0;
    if (++this._updateCount % 60 === 0) this.refresh();
    Widget_Base.prototype.update.call(this);
  };
  window.Widget_Label = Widget_Label;

  //===========================================================================
  // Widget_Image — 이미지 표시
  //===========================================================================
  function Widget_Image() {}
  Widget_Image.prototype = Object.create(Widget_Base.prototype);
  Widget_Image.prototype.constructor = Widget_Image;
  Widget_Image.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    var sprite = new Sprite();
    sprite.x = this._x;
    sprite.y = this._y;
    this._displayObject = sprite;
    if (def.imageName && typeof ImageManager !== 'undefined') {
      var folder = def.imageFolder || 'img/system/';
      var bitmap = ImageManager.loadBitmap(folder, def.imageName);
      var self = this;
      bitmap.addLoadListener(function() {
        var drawW = self._width || bitmap.width;
        var drawH = self._height || bitmap.height;
        var bmp = new Bitmap(drawW, drawH);
        bmp.blt(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, drawW, drawH);
        sprite.bitmap = bmp;
      });
    }
  };
  window.Widget_Image = Widget_Image;

  //===========================================================================
  // Widget_ActorFace — 액터 얼굴 이미지
  //===========================================================================
  function Widget_ActorFace() {}
  Widget_ActorFace.prototype = Object.create(Widget_Base.prototype);
  Widget_ActorFace.prototype.constructor = Widget_ActorFace;
  Widget_ActorFace.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._actorIndex = def.actorIndex || 0;
    var sprite = new Sprite();
    sprite.x = this._x;
    sprite.y = this._y;
    var bitmap = new Bitmap(this._width || 144, this._height || 144);
    sprite.bitmap = bitmap;
    this._sprite = sprite;
    this._bitmap = bitmap;
    this._displayObject = sprite;
    this.refresh();
  };
  Widget_ActorFace.prototype.refresh = function() {
    if (!this._bitmap) return;
    this._bitmap.clear();
    var actor = null;
    if (typeof $gameParty !== 'undefined') {
      actor = $gameParty.members()[this._actorIndex];
    }
    if (actor) {
      var faceName = actor.faceName();
      var faceIndex = actor.faceIndex();
      if (faceName && typeof ImageManager !== 'undefined') {
        var bitmap = ImageManager.loadFace(faceName);
        var self = this;
        var w = this._width || 144;
        var h = this._height || 144;
        bitmap.addLoadListener(function() {
          self._bitmap.clear();
          var pw = Window_Base._faceWidth || 144;
          var ph = Window_Base._faceHeight || 144;
          var sw = Math.min(w, pw);
          var sh = Math.min(h, ph);
          var sx = (faceIndex % 4) * pw + (pw - sw) / 2;
          var sy = Math.floor(faceIndex / 4) * ph + (ph - sh) / 2;
          self._bitmap.blt(bitmap, sx, sy, sw, sh, 0, 0, w, h);
        });
      }
    }
    Widget_Base.prototype.refresh.call(this);
  };
  window.Widget_ActorFace = Widget_ActorFace;

  //===========================================================================
  // Widget_Gauge — HP/MP/TP 게이지
  //===========================================================================
  function Widget_Gauge() {}
  Widget_Gauge.prototype = Object.create(Widget_Base.prototype);
  Widget_Gauge.prototype.constructor = Widget_Gauge;
  Widget_Gauge.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._gaugeType = def.gaugeType || 'hp';
    this._actorIndex = def.actorIndex || 0;
    var sprite = new Sprite();
    sprite.x = this._x;
    sprite.y = this._y;
    var bitmap = new Bitmap(this._width, this._height || 36);
    sprite.bitmap = bitmap;
    this._sprite = sprite;
    this._bitmap = bitmap;
    this._displayObject = sprite;
    this.refresh();
  };
  Widget_Gauge.prototype.refresh = function() {
    if (!this._bitmap) return;
    this._bitmap.clear();
    var actor = null;
    if (typeof $gameParty !== 'undefined') {
      actor = $gameParty.members()[this._actorIndex];
    }
    if (actor) {
      var w = this._width;
      var h = this._height || 36;
      var label = '', cur = 0, max = 1;
      switch (this._gaugeType) {
        case 'hp': label='HP'; cur=actor.hp; max=actor.mhp; break;
        case 'mp': label='MP'; cur=actor.mp; max=actor.mmp; break;
        case 'tp': label='TP'; cur=actor.tp; max=actor.maxTp(); break;
      }
      var rate = max > 0 ? cur / max : 0;
      var gaugeH = 6;
      var gaugeY = h - gaugeH - 2;
      this._bitmap.fillRect(0, gaugeY, w, gaugeH, '#202020');
      var color = this._gaugeType === 'hp' ? '#20c020' : (this._gaugeType === 'mp' ? '#2040c0' : '#c08020');
      this._bitmap.fillRect(0, gaugeY, Math.floor(w * rate), gaugeH, color);
      this._bitmap.fontSize = 20;
      this._bitmap.textColor = '#ffffff';
      this._bitmap.drawText(label, 0, 0, 60, h - gaugeH - 4, 'left');
      this._bitmap.drawText(cur + '/' + max, 60, 0, w - 60, h - gaugeH - 4, 'right');
    }
    Widget_Base.prototype.refresh.call(this);
  };
  Widget_Gauge.prototype.update = function() {
    if (this._updateCount === undefined) this._updateCount = 0;
    if (++this._updateCount % 60 === 0) this.refresh();
    Widget_Base.prototype.update.call(this);
  };
  window.Widget_Gauge = Widget_Gauge;

  //===========================================================================
  // Widget_Separator — 구분선
  //===========================================================================
  function Widget_Separator() {}
  Widget_Separator.prototype = Object.create(Widget_Base.prototype);
  Widget_Separator.prototype.constructor = Widget_Separator;
  Widget_Separator.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    var sprite = new Sprite();
    sprite.x = this._x;
    sprite.y = this._y;
    var h = this._height || 4;
    var bitmap = new Bitmap(this._width, h);
    var lineY = Math.floor(h / 2) - 1;
    bitmap.paintOpacity = 64;
    bitmap.fillRect(0, lineY, this._width, 2, '#ffffff');
    bitmap.paintOpacity = 255;
    sprite.bitmap = bitmap;
    this._displayObject = sprite;
  };
  window.Widget_Separator = Widget_Separator;

  //===========================================================================
  // Widget_ActorList — 파티 멤버 선택 위젯 (focusable)
  //===========================================================================
  function Widget_ActorList() {}
  Widget_ActorList.prototype = Object.create(Widget_Base.prototype);
  Widget_ActorList.prototype.constructor = Widget_ActorList;
  Widget_ActorList.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._handlersDef = def.handlers || {};
    var win = new Window_CustomActorList(this._x, this._y, def);
    win._customClassName = 'Widget_CS_' + this._id;
    win.deactivate();
    this._window = win;
    this._displayObject = win;
  };
  Widget_ActorList.prototype.collectFocusable = function(out) {
    out.push(this);
  };
  Widget_ActorList.prototype.activate = function() {
    if (this._window) {
      this._window.activate();
      this._window.selectLast();
    }
  };
  Widget_ActorList.prototype.deactivate = function() {
    if (this._window) {
      this._window.deactivate();
      this._window.deselect();
    }
  };
  Widget_ActorList.prototype.setHandler = function(symbol, fn) {
    if (this._window) this._window.setHandler(symbol, fn);
  };
  Widget_ActorList.prototype.setCancelHandler = function(fn) {
    if (this._window) this._window.setHandler('cancel', fn);
  };
  Widget_ActorList.prototype.setFormationMode = function(mode) {
    if (this._window) this._window.setFormationMode(mode);
  };
  Widget_ActorList.prototype.setPendingIndex = function(index) {
    if (this._window) this._window.setPendingIndex(index);
  };
  Widget_ActorList.prototype.pendingIndex = function() {
    return this._window ? this._window.pendingIndex() : -1;
  };
  Widget_ActorList.prototype.index = function() {
    return this._window ? this._window.index() : -1;
  };
  Widget_ActorList.prototype.refresh = function() {
    if (this._window) this._window.refresh();
  };
  window.Widget_ActorList = Widget_ActorList;

  //===========================================================================
  // Widget_Options — 옵션 설정 위젯 (focusable)
  //===========================================================================
  function Widget_Options() {}
  Widget_Options.prototype = Object.create(Widget_Base.prototype);
  Widget_Options.prototype.constructor = Widget_Options;
  Widget_Options.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    var win = new Window_CustomOptions(this._x, this._y, def);
    win._customClassName = 'Widget_CS_' + this._id;
    win.deactivate();
    this._window = win;
    this._displayObject = win;
  };
  Widget_Options.prototype.collectFocusable = function(out) {
    out.push(this);
  };
  Widget_Options.prototype.activate = function() {
    if (this._window) {
      this._window.activate();
      if (this._window.index() < 0) this._window.select(0);
    }
  };
  Widget_Options.prototype.deactivate = function() {
    if (this._window) this._window.deactivate();
  };
  Widget_Options.prototype.setHandler = function(symbol, fn) {
    if (this._window) this._window.setHandler(symbol, fn);
  };
  Widget_Options.prototype.setCancelHandler = function(fn) {
    if (this._window) this._window.setHandler('cancel', fn);
  };
  window.Widget_Options = Widget_Options;

  //===========================================================================
  // Widget_Button — 버튼 (focusable)
  //===========================================================================
  function Widget_Button() {}
  Widget_Button.prototype = Object.create(Widget_Base.prototype);
  Widget_Button.prototype.constructor = Widget_Button;
  Widget_Button.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._label = def.label || def.name || 'Button';
    this._handlerDef = def.action || null;
    var btnDef = {
      id: def.id, width: def.width,
      commands: [{ name: this._label, symbol: 'ok', enabled: true }],
      maxCols: 1
    };
    if (def.height) btnDef.height = def.height;
    var win = new Window_CustomCommand(this._x, this._y, btnDef);
    win._customClassName = 'Widget_CS_' + this._id;
    win.deactivate();
    this._window = win;
    this._displayObject = win;
  };
  Widget_Button.prototype.collectFocusable = function(out) {
    out.push(this);
  };
  Widget_Button.prototype.activate = function() {
    if (this._window) { this._window.activate(); this._window.select(0); }
  };
  Widget_Button.prototype.deactivate = function() {
    if (this._window) this._window.deactivate();
  };
  Widget_Button.prototype.setOkHandler = function(fn) {
    if (this._window) this._window.setHandler('ok', fn);
  };
  Widget_Button.prototype.setCancelHandler = function(fn) {
    if (this._window) this._window.setHandler('cancel', fn);
  };
  window.Widget_Button = Widget_Button;

  //===========================================================================
  // Widget_List — 커맨드 리스트 (focusable)
  //===========================================================================
  function Widget_List() {}
  Widget_List.prototype = Object.create(Widget_Base.prototype);
  Widget_List.prototype.constructor = Widget_List;
  Widget_List.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._items = def.items || def.commands || [];
    this._handlersDef = def.handlers || {};
    var listDef = {
      id: def.id, width: def.width,
      commands: this._items,
      maxCols: def.maxCols || 1
    };
    if (def.height) listDef.height = def.height;
    var win = new Window_CustomCommand(this._x, this._y, listDef);
    win._customClassName = 'Widget_CS_' + this._id;
    win.deactivate();
    this._window = win;
    this._displayObject = win;
  };
  Widget_List.prototype.collectFocusable = function(out) {
    out.push(this);
  };
  Widget_List.prototype.activate = function() {
    if (this._window) { this._window.activate(); this._window.select(0); }
  };
  Widget_List.prototype.deactivate = function() {
    if (this._window) this._window.deactivate();
  };
  Widget_List.prototype.setHandler = function(symbol, fn) {
    if (this._window) this._window.setHandler(symbol, fn);
  };
  Widget_List.prototype.setCancelHandler = function(fn) {
    if (this._window) this._window.setHandler('cancel', fn);
  };
  Widget_List.prototype.update = function() {
    var items = this._items;
    var hasCondition = items && items.some(function(item) {
      return typeof item.enabledCondition === 'string' && item.enabledCondition;
    });
    if (hasCondition) {
      if (this._updateCount === undefined) this._updateCount = 0;
      if (++this._updateCount % 60 === 0) {
        if (this._window) this._window.refresh();
      }
    }
    Widget_Base.prototype.update.call(this);
  };
  window.Widget_List = Widget_List;

  //===========================================================================
  // NavigationManager — 위젯 간 포커스 관리
  //===========================================================================
  function NavigationManager() {}
  NavigationManager.prototype.initialize = function(config) {
    config = config || {};
    this._defaultFocusId = config.defaultFocus || null;
    this._cancelWidgetId = config.cancelWidget || null;
    this._focusOrderIds = config.focusOrder || [];
    this._focusables = [];
    this._activeIndex = -1;
    this._scene = null;
  };
  NavigationManager.prototype.setScene = function(scene) {
    this._scene = scene;
  };
  NavigationManager.prototype.buildFocusList = function(rootWidget) {
    var all = [];
    rootWidget.collectFocusable(all);
    var self = this;
    if (self._focusOrderIds.length > 0) {
      var ordered = [];
      self._focusOrderIds.forEach(function(id) {
        for (var i = 0; i < all.length; i++) {
          if (all[i]._id === id) { ordered.push(all[i]); break; }
        }
      });
      all.forEach(function(w) {
        if (ordered.indexOf(w) === -1) ordered.push(w);
      });
      self._focusables = ordered;
    } else {
      self._focusables = all;
    }
  };
  NavigationManager.prototype.start = function() {
    if (this._focusables.length === 0) return;
    var startIdx = 0;
    if (this._defaultFocusId) {
      for (var i = 0; i < this._focusables.length; i++) {
        if (this._focusables[i]._id === this._defaultFocusId) { startIdx = i; break; }
      }
    }
    this._activateAt(startIdx);
  };
  NavigationManager.prototype._activateAt = function(idx) {
    if (idx < 0 || idx >= this._focusables.length) return;
    if (this._activeIndex >= 0 && this._focusables[this._activeIndex]) {
      this._focusables[this._activeIndex].deactivate();
    }
    this._activeIndex = idx;
    this._focusables[idx].activate();
  };
  NavigationManager.prototype.focusWidget = function(id) {
    for (var i = 0; i < this._focusables.length; i++) {
      if (this._focusables[i]._id === id) { this._activateAt(i); return; }
    }
  };
  NavigationManager.prototype.focusNext = function() {
    var next = (this._activeIndex + 1) % this._focusables.length;
    this._activateAt(next);
  };
  NavigationManager.prototype.focusPrev = function() {
    var prev = (this._activeIndex - 1 + this._focusables.length) % this._focusables.length;
    this._activateAt(prev);
  };
  NavigationManager.prototype.update = function() {
    if (this._focusables.length <= 1) return;
    if (Input.isTriggered('pagedown')) {
      this.focusNext();
    } else if (Input.isTriggered('pageup')) {
      this.focusPrev();
    }
  };
  window.NavigationManager = NavigationManager;

  //===========================================================================
  // Scene_CustomUI — Scene_MenuBase 상속
  //===========================================================================
  function Scene_CustomUI() {
    this.initialize.apply(this, arguments);
  }

  Scene_CustomUI.prototype = Object.create(Scene_MenuBase.prototype);
  Scene_CustomUI.prototype.constructor = Scene_CustomUI;

  Scene_CustomUI.prototype.initialize = function () {
    Scene_MenuBase.prototype.initialize.call(this);
    this._sceneId = '';
    this._prepareData = {};
    this._customWindows = {};
    this._pendingPersonalAction = null;
    this._personalOriginWidget = null;
  };

  Scene_CustomUI.prototype.prepare = function () {
    var args = Array.prototype.slice.call(arguments);
    var sceneDef = this._getSceneDef();
    var prepareArgs = sceneDef && sceneDef.prepareArgs || [];
    this._prepareData = {};
    for (var i = 0; i < prepareArgs.length; i++) {
      if (i < args.length) {
        this._prepareData[prepareArgs[i]] = args[i];
      }
    }
  };

  Scene_CustomUI.prototype._getSceneDef = function () {
    var scenes = _scenesData.scenes || {};
    return scenes[this._sceneId] || null;
  };

  Scene_CustomUI.prototype.create = function () {
    Scene_MenuBase.prototype.create.call(this);
    var sceneDef = this._getSceneDef();
    if (!sceneDef) return;

    // 포맷 감지: root 키 또는 formatVersion >= 2이면 위젯 트리 경로
    if (sceneDef.root || (sceneDef.formatVersion && sceneDef.formatVersion >= 2)) {
      this._createWidgetTree(sceneDef);
    } else {
      this._createLegacyWindows(sceneDef);
    }
  };

  Scene_CustomUI.prototype._createLegacyWindows = function(sceneDef) {
    var windows = sceneDef.windows || [];
    var overrides = _configData.overrides || {};

    for (var i = 0; i < windows.length; i++) {
      var winDef = windows[i];
      var x = winDef.x || 0;
      var y = winDef.y || 0;
      var w = winDef.width || 240;
      var h = winDef.height;
      var customClassName = 'Window_CS_' + winDef.id;

      var ov = overrides[customClassName];
      if (ov) {
        if (ov.x !== undefined) x = ov.x;
        if (ov.y !== undefined) y = ov.y;
        if (ov.width !== undefined) w = ov.width;
        if (ov.height !== undefined) h = ov.height;
      }

      var win;
      if (winDef.windowType === 'command') {
        win = new Window_CustomCommand(x, y, winDef);
      } else {
        win = new Window_CustomDisplay(x, y, w, h || 400, winDef);
      }

      this._customWindows[winDef.id] = win;
      this.addWindow(win);
    }

    this._setupHandlers(sceneDef);
  };

  Scene_CustomUI.prototype._createWidgetTree = function(sceneDef) {
    this._rootWidget = null;
    this._widgetMap = {};
    this._navManager = null;

    if (!sceneDef.root) return;

    this._rootWidget = this._buildWidget(sceneDef.root, null);
    if (!this._rootWidget) return;

    // 위젯 맵 구축 (id → 위젯)
    var self = this;
    function buildMap(widget) {
      if (widget._id) self._widgetMap[widget._id] = widget;
      for (var i = 0; i < widget._children.length; i++) {
        buildMap(widget._children[i]);
      }
    }
    buildMap(this._rootWidget);

    // Window_Base 타입 위젯은 addWindow, 그 외 루트는 addChild
    for (var id in this._widgetMap) {
      var w = this._widgetMap[id];
      var obj = w.displayObject();
      if (obj && obj instanceof Window_Base) {
        this.addWindow(obj);
      }
    }
    var rootObj = this._rootWidget.displayObject();
    if (rootObj && !(rootObj instanceof Window_Base)) {
      this.addChild(rootObj);
    }

    // 핸들러 설정
    this._setupWidgetHandlers(this._rootWidget);

    // NavigationManager
    if (sceneDef.navigation) {
      this._navManager = new NavigationManager();
      this._navManager.initialize(sceneDef.navigation);
      this._navManager.setScene(this);
      this._navManager.buildFocusList(this._rootWidget);
    }
  };

  Scene_CustomUI.prototype._buildWidget = function(def, parentWidget) {
    if (!def || !def.type) return null;
    var widget = null;
    switch (def.type) {
      case 'panel':     widget = new Widget_Panel();     break;
      case 'label':     widget = new Widget_Label();     break;
      case 'image':     widget = new Widget_Image();     break;
      case 'actorFace': widget = new Widget_ActorFace(); break;
      case 'gauge':     widget = new Widget_Gauge();     break;
      case 'separator': widget = new Widget_Separator(); break;
      case 'button':    widget = new Widget_Button();    break;
      case 'list':      widget = new Widget_List();      break;
      case 'actorList': widget = new Widget_ActorList(); break;
      case 'options':   widget = new Widget_Options();   break;
      default:          return null;
    }
    widget.initialize(def, parentWidget);

    // 자식 위젯 재귀 빌드 (panel 타입만 children 가짐)
    if (def.children && def.children.length) {
      for (var i = 0; i < def.children.length; i++) {
        var child = this._buildWidget(def.children[i], widget);
        if (child) widget.addChildWidget(child);
      }
    }
    return widget;
  };

  Scene_CustomUI.prototype._setupWidgetHandlers = function(rootWidget) {
    var self = this;
    function traverse(widget) {
      if (widget instanceof Widget_List) {
        var handlersDef = widget._handlersDef || {};
        for (var symbol in handlersDef) {
          (function(sym, handler, w) {
            w.setHandler(sym, function() {
              self._executeWidgetHandler(handler, w);
            });
          })(symbol, handlersDef[symbol], widget);
        }
        widget.setCancelHandler(function() {
          self._executeWidgetHandler({ action: 'cancel' }, widget);
        });
      } else if (widget instanceof Widget_ActorList) {
        (function(w) {
          w.setHandler('ok', function() {
            self._onActorListOk(w);
          });
          w.setCancelHandler(function() {
            self._onActorListCancel(w);
          });
        })(widget);
      } else if (widget instanceof Widget_Options) {
        (function(w) {
          w.setCancelHandler(function() { self._onOptionsCancel(w); });
        })(widget);
      } else if (widget instanceof Widget_Button) {
        var handlerDef = widget._handlerDef;
        if (handlerDef) {
          (function(handler, w) {
            w.setOkHandler(function() {
              self._executeWidgetHandler(handler, w);
            });
          })(handlerDef, widget);
        }
        widget.setCancelHandler(function() {
          self._executeWidgetHandler({ action: 'cancel' }, widget);
        });
      }
      for (var i = 0; i < widget._children.length; i++) {
        traverse(widget._children[i]);
      }
    }
    traverse(rootWidget);
  };

  Scene_CustomUI.prototype._executeWidgetHandler = function(handler, widget) {
    if (!handler || !handler.action) return;
    switch (handler.action) {
      case 'gotoScene': {
        var SceneCtor = window[handler.target];
        if (SceneCtor) SceneManager.push(SceneCtor);
        break;
      }
      case 'popScene':
        this.popScene();
        break;
      case 'callCommonEvent': {
        var eventId = parseInt(handler.eventId || handler.target, 10);
        if (eventId && typeof $gameTemp !== 'undefined') {
          $gameTemp.reserveCommonEvent(eventId);
          SceneManager.goto(Scene_Map);
        }
        break;
      }
      case 'customScene': {
        var target = handler.target || '';
        var csName = target.startsWith('Scene_CS_') ? target : 'Scene_CS_' + target;
        var CSCtor = window[csName];
        if (CSCtor) SceneManager.push(CSCtor);
        break;
      }
      case 'focusWidget': {
        if (this._navManager && handler.target) {
          this._navManager.focusWidget(handler.target);
        }
        break;
      }
      case 'refreshWidgets': {
        if (this._rootWidget) this._rootWidget.refresh();
        break;
      }
      case 'activateWindow': {
        if (this._customWindows && this._customWindows[handler.target]) {
          if (widget && widget._window) widget._window.deactivate();
          this._customWindows[handler.target].activate();
          this._customWindows[handler.target].select(0);
        }
        break;
      }
      case 'script': {
        if (handler.code) {
          try {
            var fn = new Function(handler.code);
            fn.call(this);
          } catch (e) {
            console.error('[CustomScene] script error:', e);
          }
          if (this._rootWidget) this._rootWidget.refresh();
          if (widget && widget.activate) widget.activate();
        }
        break;
      }
      case 'selectActor': {
        var actorWidget = this._widgetMap && this._widgetMap[handler.widget];
        if (actorWidget) {
          this._pendingPersonalAction = handler.thenAction || null;
          this._personalOriginWidget = widget;
          actorWidget.setFormationMode(false);
          if (this._navManager) this._navManager.focusWidget(handler.widget);
        }
        break;
      }
      case 'formation': {
        var actorWidget2 = this._widgetMap && this._widgetMap[handler.widget];
        if (actorWidget2) {
          actorWidget2.setFormationMode(true);
          actorWidget2.setPendingIndex(-1);
          if (this._navManager) this._navManager.focusWidget(handler.widget);
        }
        break;
      }
      case 'cancel': {
        var navMgr = this._navManager;
        if (navMgr && navMgr._cancelWidgetId) {
          var cancelWidget = this._widgetMap[navMgr._cancelWidgetId];
          if (cancelWidget && cancelWidget !== widget) {
            navMgr.focusWidget(navMgr._cancelWidgetId);
            return;
          }
        }
        this.popScene();
        break;
      }
    }
  };

  Scene_CustomUI.prototype._onActorListOk = function(widget) {
    var win = widget._window;
    var index = win.index();
    if (win.formationMode()) {
      var pendingIndex = win.pendingIndex();
      if (pendingIndex >= 0) {
        $gameParty.swapOrder(index, pendingIndex);
        win.setPendingIndex(-1);
        win.redrawItem(index);
        win.activate();
      } else {
        win.setPendingIndex(index);
        win.activate();
      }
    } else {
      var action = this._pendingPersonalAction;
      if (action) {
        this._pendingPersonalAction = null;
        this._executeWidgetHandler(action, widget);
      }
    }
  };

  Scene_CustomUI.prototype._onOptionsCancel = function(widget) {
    if (typeof ConfigManager !== 'undefined' && typeof ConfigManager.save === 'function') {
      ConfigManager.save();
    }
    this.popScene();
  };

  Scene_CustomUI.prototype._onActorListCancel = function(widget) {
    var win = widget._window;
    if (win.formationMode() && win.pendingIndex() >= 0) {
      win.setPendingIndex(-1);
      win.activate();
    } else {
      win.deselect();
      var originId = this._personalOriginWidget ? this._personalOriginWidget._id : null;
      if (!originId && this._navManager && this._navManager._cancelWidgetId) {
        originId = this._navManager._cancelWidgetId;
      }
      if (originId && this._navManager) {
        this._navManager.focusWidget(originId);
      } else {
        this.popScene();
      }
    }
  };

  Scene_CustomUI.prototype.start = function () {
    Scene_MenuBase.prototype.start.call(this);
    var sceneDef = this._getSceneDef();
    if (!sceneDef) return;

    // 위젯 트리 경로
    if (this._navManager) {
      this._navManager.start();
      return;
    }

    // 레거시 경로
    var links = sceneDef.windowLinks || {};
    for (var winId in links) {
      if (links[winId].activateDefault && this._customWindows[winId]) {
        this._customWindows[winId].activate();
        this._customWindows[winId].select(0);
      }
    }
  };

  Scene_CustomUI.prototype.update = function() {
    Scene_MenuBase.prototype.update.call(this);
    if (this._navManager) this._navManager.update();
    if (this._rootWidget) this._rootWidget.update();
  };

  Scene_CustomUI.prototype._setupHandlers = function (sceneDef) {
    var windows = sceneDef.windows || [];
    var self = this;

    for (var i = 0; i < windows.length; i++) {
      var winDef = windows[i];
      if (winDef.windowType !== 'command') continue;

      var cmdWin = this._customWindows[winDef.id];
      if (!cmdWin) continue;

      var handlers = winDef.handlers || {};
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
      case 'gotoScene': {
        var SceneCtor = window[handler.target];
        if (SceneCtor) {
          SceneManager.push(SceneCtor);
        }
        break;
      }
      case 'popScene':
        this.popScene();
        break;
      case 'callCommonEvent': {
        var eventId = parseInt(handler.eventId || handler.target, 10);
        if (eventId && typeof $gameTemp !== 'undefined') {
          $gameTemp.reserveCommonEvent(eventId);
          SceneManager.goto(Scene_Map);
        }
        break;
      }
      case 'customScene': {
        var target = handler.target || '';
        var csName = target.startsWith('Scene_CS_') ? target : 'Scene_CS_' + target;
        var CSCtor = window[csName];
        if (CSCtor) {
          SceneManager.push(CSCtor);
        }
        break;
      }
      case 'activateWindow': {
        var targetWinId = handler.target;
        if (this._customWindows[targetWinId]) {
          if (cmdWin) cmdWin.deactivate();
          this._customWindows[targetWinId].activate();
          this._customWindows[targetWinId].select(0);
        }
        break;
      }
      case 'script': {
        if (handler.code) {
          try {
            var fn = new Function(handler.code);
            fn.call(this);
          } catch (e) {
            console.error('[CustomScene] script error:', e);
          }
          // display 창 갱신 후 커맨드 창 재활성화
          this._refreshDisplayWindows();
          if (cmdWin) cmdWin.activate();
        }
        break;
      }
    }
  };

  Scene_CustomUI.prototype._refreshDisplayWindows = function () {
    var sceneDef = this._getSceneDef();
    if (!sceneDef) return;
    var windows = sceneDef.windows || [];
    for (var i = 0; i < windows.length; i++) {
      if (windows[i].windowType === 'display') {
        var win = this._customWindows[windows[i].id];
        if (win && win.refresh) win.refresh();
      }
    }
  };

  window.Scene_CustomUI = Scene_CustomUI;

  //===========================================================================
  // 커스텀 씬 등록
  //===========================================================================
  function registerCustomScenes() {
    var scenes = _scenesData.scenes || {};
    for (var sceneId in scenes) {
      var sceneDef = scenes[sceneId];
      var className = 'Scene_CS_' + sceneId;

      // 이미 등록된 경우 스킵하지 않음 (재로드 시 갱신을 위해 덮어씀)
      var SceneCtor = (function (sid) {
        function CustomScene() {
          Scene_CustomUI.call(this);
        }
        CustomScene.prototype = Object.create(Scene_CustomUI.prototype);
        CustomScene.prototype.constructor = CustomScene;
        CustomScene.prototype.initialize = function () {
          Scene_CustomUI.prototype.initialize.call(this);
          this._sceneId = sid;
        };
        // constructor.name을 설정 (디버깅 + UI에디터 식별용)
        try {
          Object.defineProperty(CustomScene, 'name', {
            value: 'Scene_CS_' + sid,
            configurable: true,
          });
        } catch (e) {
          // IE 등 일부 환경에서 실패할 수 있음
        }
        return CustomScene;
      })(sceneId);

      window[className] = SceneCtor;
    }
  }

  //===========================================================================
  // 씬 리다이렉트 — SceneManager.goto/push 후킹
  //===========================================================================
  function installSceneRedirects(redirects) {
    // 기존 패치 제거
    if (SceneManager._csOrigGoto) {
      SceneManager.goto = SceneManager._csOrigGoto;
      delete SceneManager._csOrigGoto;
    }
    if (SceneManager._csOrigPush) {
      SceneManager.push = SceneManager._csOrigPush;
      delete SceneManager._csOrigPush;
    }

    if (!redirects || Object.keys(redirects).length === 0) return;

    SceneManager._csOrigGoto = SceneManager.goto;
    SceneManager._csOrigPush = SceneManager.push;

    function resolve(SceneCtor) {
      if (!SceneCtor) return SceneCtor;
      var name = SceneCtor.name || '';
      var target = redirects[name];
      if (target) {
        var RedirCtor = window[target];
        if (RedirCtor) return RedirCtor;
      }
      return SceneCtor;
    }

    SceneManager.goto = function (SceneCtor) {
      return SceneManager._csOrigGoto.call(this, resolve(SceneCtor));
    };
    SceneManager.push = function (SceneCtor) {
      return SceneManager._csOrigPush.call(this, resolve(SceneCtor));
    };
  }

  function reloadCustomScenes() {
    _scenesData = loadJSON('data/UIEditorScenes.json');
    _configData = loadJSON('data/UIEditorConfig.json');
    registerCustomScenes();
    installSceneRedirects(_configData.sceneRedirects || {});
  }

  // 초기 등록
  registerCustomScenes();
  installSceneRedirects(_configData.sceneRedirects || {});

  // 외부 인터페이스
  window.__customSceneEngine = {
    reloadCustomScenes: reloadCustomScenes,
    updateSceneRedirects: function (redirects) {
      installSceneRedirects(redirects || {});
    },
  };
})();
