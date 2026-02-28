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
    // 중첩 중괄호 지원: {(function(){...})()} 패턴 처리
    var result = '';
    var i = 0;
    while (i < text.length) {
      if (text[i] !== '{') { result += text[i++]; continue; }
      var depth = 1, j = i + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      if (depth !== 0) { result += text[i++]; continue; }
      var expr = text.slice(i + 1, j - 1);
      result += _evalTemplateExpr(expr);
      i = j;
    }
    return result;
  }
  function _evalTemplateExpr(expr) {
      try {
        // actor[N].field (N은 숫자 리터럴 또는 $ctx.actorIndex 등 JS 식)
        var actorMatch = expr.match(/^actor\[([^\]]+)\]\.(\w+)$/);
        if (actorMatch && typeof $gameParty !== 'undefined') {
          var members = $gameParty.members();
          var idxExpr = actorMatch[1];
          var idx = /^\d+$/.test(idxExpr) ? parseInt(idxExpr) : (function() {
            try { var c = (SceneManager._scene && SceneManager._scene._ctx) || {};
                  return Number(new Function('$ctx', 'return (' + idxExpr + ')')(c)) || 0;
            } catch(e) { return 0; }
          })();
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
        // mapName
        if (expr === 'mapName') {
          if (typeof MinimapManager !== 'undefined' && typeof MinimapManager.getMapName === 'function') {
            return MinimapManager.getMapName();
          }
          if (typeof $dataMapInfos !== 'undefined' && typeof $gameMap !== 'undefined') {
            var info = $dataMapInfos[$gameMap.mapId()];
            return info ? (info.name || '') : '';
          }
          return '';
        }
        // config.KEY
        var cfgMatch = expr.match(/^config\.(\w+)$/);
        if (cfgMatch && typeof ConfigManager !== 'undefined') {
          var v = ConfigManager[cfgMatch[1]];
          return typeof v === 'boolean' ? (v ? 'ON' : 'OFF') : String(v !== undefined ? v : '');
        }
        // $ctx — 씬 컨텍스트 단축어 (안전한 처리)
        if (/^\$ctx\b/.test(expr)) {
          try {
            var ctx = (SceneManager._scene && SceneManager._scene._ctx) || {};
            var result = new Function('$ctx', 'return (' + expr + ')')(ctx);
            return result === null || result === undefined ? '' : String(result);
          } catch(e) { return ''; }
        }
        // 임의 JS 표현식 폴백
        try {
          var val = new Function('return (' + expr + ')')();
          return val === null || val === undefined ? '' : String(val);
        } catch (e) {}
        return '';
      } catch (e) {}
      return '';
  }

  //===========================================================================
  // $ctx — 현재 씬 컨텍스트 전역 단축어
  //===========================================================================
  Object.defineProperty(window, '$ctx', {
    get: function() { return (SceneManager._scene && SceneManager._scene._ctx) || {}; },
    configurable: true,
  });

  //===========================================================================
  // CSHelper — 이미지/데이터 접근 헬퍼
  //===========================================================================
  var CSHelper = {
    /** 파티 멤버의 페이스 Bitmap 반환 */
    actorFace: function(actorIndex) {
      if (typeof $gameParty === 'undefined') return null;
      var actor = $gameParty.members()[actorIndex || 0];
      return actor ? ImageManager.loadFace(actor.faceName()) : null;
    },
    /** 파티 멤버의 페이스 소스 직사각형 {x,y,w,h} */
    actorFaceSrcRect: function(actorIndex) {
      if (typeof $gameParty === 'undefined') return null;
      var actor = $gameParty.members()[actorIndex || 0];
      if (!actor) return null;
      var i = actor.faceIndex();
      return { x: i % 4 * 144, y: Math.floor(i / 4) * 144, w: 144, h: 144 };
    },
    /** 파티 멤버의 캐릭터 스프라이트 Bitmap 반환 */
    actorCharacter: function(actorIndex) {
      if (typeof $gameParty === 'undefined') return null;
      var actor = $gameParty.members()[actorIndex || 0];
      return actor ? ImageManager.loadCharacter(actor.characterName()) : null;
    },
    /** 파티 멤버의 캐릭터 스프라이트 소스 직사각형 {x,y,w,h} */
    actorCharacterSrcRect: function(actorIndex) {
      if (typeof $gameParty === 'undefined') return null;
      var actor = $gameParty.members()[actorIndex || 0];
      if (!actor) return null;
      var charName  = actor.characterName();
      var charIndex = actor.characterIndex();
      var bitmap    = ImageManager.loadCharacter(charName);
      var isBig     = ImageManager.isBigCharacter(charName);
      var cw, ch, sx, sy;
      if (isBig) {
        cw = Math.floor(bitmap.width  / 3);
        ch = Math.floor(bitmap.height / 4);
        sx = cw; sy = 0;
      } else {
        cw = Math.floor(bitmap.width  / 12);
        ch = Math.floor(bitmap.height / 8);
        sx = (charIndex % 4 * 3 + 1) * cw;
        sy = Math.floor(charIndex / 4) * 4 * ch;
      }
      return { x: sx, y: sy, w: cw, h: ch };
    },
    /** 적 배틀러 Bitmap 반환 (SV/FV 자동 분기) */
    enemyBattler: function(enemy) {
      if (!enemy) return null;
      return (typeof $gameSystem !== 'undefined' && $gameSystem.isSideView())
        ? ImageManager.loadSvEnemy(enemy.battlerName, enemy.battlerHue)
        : ImageManager.loadEnemy(enemy.battlerName, enemy.battlerHue);
    },
    /** 임의 폴더/파일의 Bitmap 반환 */
    bitmap: function(folder, name) {
      return ImageManager.loadBitmap(folder, name);
    },
  };
  window.CSHelper = CSHelper;

  //===========================================================================
  // 외부 플러그인 위젯 레지스트리
  //===========================================================================
  var _widgetRegistry = {};

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

  Window_CustomCommand.prototype.drawItem = function(index) {
    var cmd = this._winDef.commands && this._winDef.commands[index];
    var rect = this.itemRectForText(index);
    this.resetTextColor();
    if (cmd && cmd.textColor) this.changeTextColor(cmd.textColor);
    this.changePaintOpacity(this.isCommandEnabled(index));
    this.drawText(this.commandName(index), rect.x, rect.y, rect.width, 'left');
    if (cmd && cmd.textColor) this.resetTextColor();
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
  // Window_RowSelector — Window_Selectable 상속, 범용 N행 선택 창
  //===========================================================================
  function Window_RowSelector() {
    this.initialize.apply(this, arguments);
  }

  Window_RowSelector.prototype = Object.create(Window_Selectable.prototype);
  Window_RowSelector.prototype.constructor = Window_RowSelector;

  // padding 커스터마이징 지원 (transparent 모드에서 padding:0 으로 커서 정렬)
  Window_RowSelector.prototype.standardPadding = function() {
    if (this._winDef && this._winDef.padding !== undefined) return this._winDef.padding;
    return Window_Selectable.prototype.standardPadding.call(this);
  };

  Window_RowSelector.prototype.initialize = function(x, y, winDef) {
    this._winDef = winDef || {};
    this._customClassName = 'Window_CS_' + (winDef && winDef.id ? winDef.id : 'rowSelector');
    this._formationMode = false;
    this._pendingIndex = -1;
    this._numRows = this._winDef.numRows;  // number | 'party' | undefined
    var w = this._winDef.width || 576;
    var h = this._winDef.height || 624;
    Window_Selectable.prototype.initialize.call(this, x, y, w, h);
    if (this._winDef.transparent) this.setBackgroundType(2);
    this.refresh();
  };

  Window_RowSelector.prototype.maxItems = function() {
    var nr = this._numRows;
    if (nr === 'party') return typeof $gameParty !== 'undefined' ? $gameParty.size() : 0;
    return (typeof nr === 'number' && nr > 0) ? nr : (typeof $gameParty !== 'undefined' ? $gameParty.size() : 0);
  };

  Window_RowSelector.prototype.numVisibleRows = function() {
    return this.maxItems() || 1;
  };

  Window_RowSelector.prototype.itemHeight = function() {
    var clientHeight = this.height - this.padding * 2;
    return Math.floor(clientHeight / this.numVisibleRows());
  };

  Window_RowSelector.prototype.drawItem = function(index) {
    // pendingIndex 배경만 표시 (얼굴/상태 표시 없음 — 개별 위젯으로 구성)
    if (index === this._pendingIndex) {
      var rect = this.itemRect(index);
      var color = this.pendingColor();
      this.changePaintOpacity(false);
      this.contents.fillRect(rect.x, rect.y, rect.width, rect.height, color);
      this.changePaintOpacity(true);
    }
  };

  Window_RowSelector.prototype.processOk = function() {
    Window_Selectable.prototype.processOk.call(this);
  };

  Window_RowSelector.prototype.isCurrentItemEnabled = function() {
    if (this._formationMode) {
      if (typeof $gameParty === 'undefined') return false;
      var actor = $gameParty.members()[this.index()];
      return !!(actor && actor.isFormationChangeOk());
    }
    return true;
  };

  Window_RowSelector.prototype.selectLast = function() {
    var nr = this._numRows;
    if (nr === 'party' || nr === undefined) {
      // 파티 모드: menuActor 기반 선택
      if (typeof $gameParty !== 'undefined') {
        var actor = $gameParty.menuActor ? $gameParty.menuActor() : null;
        if (actor) { this.select(actor.index()); return; }
      }
    }
    this.select(0);
  };

  Window_RowSelector.prototype.formationMode = function() {
    return this._formationMode;
  };

  Window_RowSelector.prototype.setFormationMode = function(mode) {
    this._formationMode = mode;
  };

  Window_RowSelector.prototype.pendingIndex = function() {
    return this._pendingIndex;
  };

  Window_RowSelector.prototype.setPendingIndex = function(index) {
    var last = this._pendingIndex;
    this._pendingIndex = index;
    if (this._pendingIndex !== last) {
      this.redrawItem(this._pendingIndex);
      this.redrawItem(last);
    }
  };

  // backward compat alias
  window.Window_CustomActorList = Window_RowSelector;
  window.Window_RowSelector = Window_RowSelector;

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
  // Window_ButtonRow — 투명 배경, 커서만 표시하는 1행 선택 창 (Widget_Button 전용)
  //===========================================================================
  function Window_ButtonRow(x, y, w, h) {
    this.initialize.apply(this, arguments);
  }
  Window_ButtonRow.prototype = Object.create(Window_Selectable.prototype);
  Window_ButtonRow.prototype.constructor = Window_ButtonRow;
  Window_ButtonRow.prototype.initialize = function(x, y, w, h) {
    Window_Selectable.prototype.initialize.call(this, x, y, w, h);
    this._leftHandler = null;
    this._rightHandler = null;
    // 창 테두리/배경 제거 — 커서 하이라이트만 표시
    this.opacity = 0;
    this.backOpacity = 0;
  };
  Window_ButtonRow.prototype.standardPadding = function() { return 0; };
  Window_ButtonRow.prototype.maxItems = function() { return 1; };
  Window_ButtonRow.prototype.itemHeight = function() { return this.height; };
  Window_ButtonRow.prototype.drawItem = function(index) { /* 자식 위젯이 렌더링 */ };
  Window_ButtonRow.prototype.setLeftHandler = function(fn) { this._leftHandler = fn; };
  Window_ButtonRow.prototype.setRightHandler = function(fn) { this._rightHandler = fn; };
  Window_ButtonRow.prototype.processHandling = function() {
    Window_Selectable.prototype.processHandling.call(this);
    if (this.isOpenAndActive()) {
      if (Input.isRepeated('left') && this._leftHandler) this._leftHandler();
      if (Input.isRepeated('right') && this._rightHandler) this._rightHandler();
    }
  };
  // inactive 시 커서를 즉시 숨김 (매 프레임 보장)
  Window_ButtonRow.prototype._updateCursor = function() {
    if (!this.active) {
      if (this._windowCursorSprite) this._windowCursorSprite.alpha = 0;
      return;
    }
    Window_Selectable.prototype._updateCursor.call(this);
  };
  // OK 소리 억제 — config 액션 핸들러에서 값 적용 후 playCursor로 대체
  Window_ButtonRow.prototype.playOkSound = function() { /* suppressed */ };
  window.Window_ButtonRow = Window_ButtonRow;

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
      if (child._decoSprite) this._displayObject.addChild(child._decoSprite);
      this._displayObject.addChild(child.displayObject());
    }
  };

  // ── 배경/테두리 장식 헬퍼 ─────────────────────────────────────────────────
  function _decoRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
  Widget_Base.prototype._drawDecoBg = function(bmp, w, h, def) {
    var color = def.bgColor;
    if (!color) return;
    var r = def.borderRadius || 0;
    var ctx = bmp._context;
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = color;
    if (r > 0) { _decoRoundRect(ctx, 0, 0, w, h, r); ctx.fill(); }
    else { ctx.fillRect(0, 0, w, h); }
    ctx.restore();
    bmp._setDirty();
  };
  Widget_Base.prototype._drawDecoBorder = function(bmp, w, h, def) {
    var bw = def.borderWidth;
    if (!bw || bw <= 0) return;
    var color = def.borderColor || '#ffffff';
    var r = def.borderRadius || 0;
    var ctx = bmp._context;
    if (!ctx) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = bw;
    var half = bw / 2;
    if (r > 0) {
      var ri = Math.max(0, r - half);
      _decoRoundRect(ctx, half, half, w - bw, h - bw, ri);
      ctx.stroke();
    } else {
      ctx.strokeRect(half, half, w - bw, h - bw);
    }
    ctx.restore();
    bmp._setDirty();
  };
  // Window 기반 위젯(Panel/Button 등)용: 별도 장식 스프라이트 생성
  // Window 스타일 적용 헬퍼 — windowed=false면 투명(프레임 없음), 아니면 windowStyle/frame/image 적용
  Widget_Base.prototype._applyWindowStyle = function(win, def) {
    if (def.windowed === false) {
      win.setBackgroundType(2);
      return;
    }
    if (def.windowStyle && def.windowStyle !== 'default') {
      var csOv = { windowStyle: def.windowStyle };
      if (def.windowStyle === 'frame') {
        if (def.windowskinName) csOv.windowskinName = def.windowskinName;
        if (def.skinId) csOv.skinId = def.skinId;
        if (def.colorTone) csOv.colorTone = def.colorTone;
      } else if (def.windowStyle === 'image') {
        if (def.imageFile) {
          csOv.imageFile = def.imageFile;
          win._themeSkin = ImageManager.loadSystem(def.imageFile);
        }
        if (def.imageRenderMode) csOv.imageRenderMode = def.imageRenderMode;
      }
      if (typeof window._uiThemeSetWindowOverride === 'function') {
        window._uiThemeSetWindowOverride(win._customClassName, csOv);
      }
    }
    if (def.backOpacity !== undefined) win.backOpacity = def.backOpacity;
  };

  Widget_Base.prototype._createDecoSprite = function(def, w, h) {
    var hasBg = !!def.bgColor;
    var hasBorder = !!(def.borderWidth && def.borderWidth > 0);
    if (!hasBg && !hasBorder) { this._decoSprite = null; return; }
    var sprite = new Sprite();
    sprite.x = def.x || 0;
    sprite.y = def.y || 0;
    var bmp = new Bitmap(Math.max(1, w), Math.max(1, h));
    if (hasBg) this._drawDecoBg(bmp, w, h, def);
    if (hasBorder) this._drawDecoBorder(bmp, w, h, def);
    if (def.bgAlpha !== undefined) sprite.opacity = Math.round(def.bgAlpha * 255);
    sprite.bitmap = bmp;
    this._decoSprite = sprite;
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
  window.Widget_Base   = Widget_Base;
  window.Widget_Panel  = Widget_Panel;
  window.Widget_Label  = Widget_Label;

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
      win._customClassName = 'Window_CS_' + this._id;
      this._applyWindowStyle(win, def);
      if (def.bgAlpha !== undefined) win.opacity = Math.round(def.bgAlpha * 255);
      this._displayObject = win;
      this._padding = win._padding;
      this._createDecoSprite(def, this._width, this._height || 400);
    } else {
      var container = new Sprite();
      container.x = this._x;
      container.y = this._y;
      if (def.bgAlpha !== undefined) container.opacity = Math.round(def.bgAlpha * 255);
      this._displayObject = container;
      this._padding = 0;
      // 비-windowed: 장식 스프라이트를 컨테이너의 첫 자식으로 추가 (배경층)
      this._createDecoSprite(def, this._width, this._height || 400);
      if (this._decoSprite) {
        this._decoSprite.x = 0; this._decoSprite.y = 0;
        this._displayObject.addChild(this._decoSprite);
        this._decoSprite = null;
      }
    }
  };
  Widget_Panel.prototype.addChildWidget = function(child) {
    this._children.push(child);
    child._parent = this;
    if (child.displayObject()) {
      var childObj = child.displayObject();
      // Window_Base 자식은 씬에서 addWindow로 별도 추가 — 부모 패널의 화면 절대 위치만 반영
      // (windowed 여부에 상관없이 padding 오프셋을 추가하지 않아야 위치가 일정함)
      if (childObj instanceof Window_Base) {
        childObj.x += this._x;
        childObj.y += this._y;
        if (child._decoSprite) { child._decoSprite.x += this._x; child._decoSprite.y += this._y; }
      } else if (this._displayObject) {
        if (child._decoSprite) this._displayObject.addChild(child._decoSprite);
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
    this._vAlign = def.verticalAlign || 'middle';
    this._fontSize = def.fontSize || 28;
    this._color = def.color || '#ffffff';
    var sprite = new Sprite();
    sprite.x = this._x;
    sprite.y = this._y;
    if (def.bgAlpha !== undefined) sprite.opacity = Math.round(def.bgAlpha * 255);
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
    var text = resolveTemplate(this._template);
    if (text === this._lastText && this._align === this._lastAlign && this._vAlign === this._lastVAlign) return;
    this._lastText = text;
    this._lastAlign = this._align;
    this._lastVAlign = this._vAlign;
    this._bitmap.clear();
    this._drawDecoBg(this._bitmap, this._width, this._height, this._def);
    this._bitmap.textColor = this._color;
    var textH = this._fontSize + 8;
    var ty;
    if (this._vAlign === 'top') {
      ty = 0;
    } else if (this._vAlign === 'bottom') {
      ty = this._height - textH;
    } else {
      ty = Math.floor((this._height - textH) / 2);
    }
    this._bitmap.drawText(text, 0, ty, this._width, textH, this._align);
    this._drawDecoBorder(this._bitmap, this._width, this._height, this._def);
    Widget_Base.prototype.refresh.call(this);
  };
  Widget_Label.prototype.update = function() {
    this.refresh();
    Widget_Base.prototype.update.call(this);
  };
  window.Widget_Label = Widget_Label;

  //===========================================================================
  // Widget_TextArea — 멀티라인 텍스트 (템플릿 지원, \n 개행)
  //===========================================================================
  function Widget_TextArea() {}
  Widget_TextArea.prototype = Object.create(Widget_Base.prototype);
  Widget_TextArea.prototype.constructor = Widget_TextArea;
  Widget_TextArea.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._template = def.text || '';
    this._align = def.align || 'left';
    this._vAlign = def.verticalAlign || 'top';
    this._fontSize = def.fontSize || 20;
    this._color = def.color || '#dddddd';
    this._lineHeight = def.lineHeight || (this._fontSize + 8);
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
  Widget_TextArea.prototype.refresh = function() {
    if (!this._bitmap) return;
    var text = resolveTemplate(this._template);
    if (text === this._lastText && this._align === this._lastAlign && this._vAlign === this._lastVAlign) return;
    this._lastText = text;
    this._lastAlign = this._align;
    this._lastVAlign = this._vAlign;
    this._bitmap.clear();
    this._bitmap.fontSize = this._fontSize;
    this._bitmap.textColor = this._color;
    var lh = this._lineHeight;
    var lines = text ? text.split('\n') : [];
    var totalH = Math.min(lines.length, Math.floor(this._height / lh)) * lh;
    var startY;
    if (this._vAlign === 'middle') {
      startY = Math.floor((this._height - totalH) / 2);
    } else if (this._vAlign === 'bottom') {
      startY = this._height - totalH;
    } else {
      startY = 0;
    }
    for (var i = 0; i < lines.length; i++) {
      var y = startY + i * lh;
      if (y + lh > this._height) break;
      this._bitmap.drawText(lines[i], 0, y, this._width, lh, this._align);
    }
    Widget_Base.prototype.refresh.call(this);
  };
  Widget_TextArea.prototype.update = function() {
    this.refresh();
    Widget_Base.prototype.update.call(this);
  };
  window.Widget_TextArea = Widget_TextArea;

  //===========================================================================
  // Widget_Image — 이미지 표시
  //
  //  신규: bitmapExpr / srcRectExpr / fitMode
  //    bitmapExpr  {string} — Bitmap을 반환하는 JS 표현식
  //                예) "CSHelper.actorFace(0)"
  //                    "CSHelper.enemyBattler($ctx.enemy)"
  //                    "ImageManager.loadBitmap('img/system/','Arrow')"
  //    srcRectExpr {string} — {x,y,w,h} 를 반환하는 JS 표현식 (생략 시 전체)
  //                예) "CSHelper.actorFaceSrcRect(0)"
  //    fitMode     {string} — 'stretch'(기본) | 'contain' | 'none'
  //
  //  하위호환: imageSource:'actorFace'|'actorCharacter'|'file' 도 계속 동작.
  //===========================================================================
  function Widget_Image() {}
  Widget_Image.prototype = Object.create(Widget_Base.prototype);
  Widget_Image.prototype.constructor = Widget_Image;

  Widget_Image.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._imageSource    = def.imageSource    || 'file';
    this._actorIndex     = def.actorIndex     || 0;
    this._actorIndexExpr = def.actorIndexExpr || null;
    this._bitmapExpr     = def.bitmapExpr     || null;
    this._srcRectExpr = def.srcRectExpr || null;
    this._fitMode     = def.fitMode     || 'stretch';
    this._lastBitmap  = null;
    var sprite = new Sprite();
    sprite.x = this._x;
    sprite.y = this._y;
    if (def.bgAlpha !== undefined) sprite.opacity = Math.round(def.bgAlpha * 255);
    // 하위호환 타입 (actorFace/actorCharacter): 빈 bitmap 미리 할당
    if (!this._bitmapExpr && this._imageSource !== 'file') {
      var bmp = new Bitmap(this._width || 144, this._height || 144);
      sprite.bitmap = bmp;
      this._bitmap = bmp;
    }
    this._displayObject = sprite;
    this.refresh();
  };

  Widget_Image.prototype.refresh = function() {
    var sprite = this._displayObject;
    if (!sprite) return;
    if (this._bitmapExpr) {
      this._refreshFromExpr(sprite);
    } else {
      switch (this._imageSource) {
        case 'actorFace':      this._refreshActorFace(sprite);      break;
        case 'actorCharacter': this._refreshActorCharacter(sprite); break;
        default:               this._refreshFile(sprite);           break;
      }
    }
    Widget_Base.prototype.refresh.call(this);
  };

  // bitmapExpr 기반 렌더링
  Widget_Image.prototype._refreshFromExpr = function(sprite) {
    var bitmap;
    try { bitmap = new Function('return (' + this._bitmapExpr + ')')(); }
    catch(e) { console.error('[Widget_Image] bitmapExpr error:', e); return; }
    if (!bitmap) { sprite.bitmap = null; this._lastBitmap = null; return; }
    if (bitmap === this._lastBitmap) return; // 동일 bitmap이면 재렌더 불필요
    this._lastBitmap = bitmap;
    var self     = this;
    var w        = this._width  || 100;
    var h        = this._height || 100;
    var srcExpr  = this._srcRectExpr;
    var fitMode  = this._fitMode;
    bitmap.addLoadListener(function() {
      var srcRect = null;
      if (srcExpr) { try { srcRect = new Function('return (' + srcExpr + ')')(); } catch(e) {} }
      var sx = srcRect ? srcRect.x : 0;
      var sy = srcRect ? srcRect.y : 0;
      var sw = srcRect ? srcRect.w : bitmap.width;
      var sh = srcRect ? srcRect.h : bitmap.height;
      if (!sw || !sh) return;
      var bmp = new Bitmap(w, h);
      if (fitMode === 'contain') {
        var scale = Math.min(w / sw, h / sh);
        var dw = Math.floor(sw * scale);
        var dh = Math.floor(sh * scale);
        bmp.blt(bitmap, sx, sy, sw, sh,
          Math.floor((w - dw) / 2), Math.floor((h - dh) / 2), dw, dh);
      } else if (fitMode === 'none') {
        bmp.blt(bitmap, sx, sy, Math.min(sw, w), Math.min(sh, h), 0, 0);
      } else { // stretch
        bmp.blt(bitmap, sx, sy, sw, sh, 0, 0, w, h);
      }
      sprite.bitmap = bmp;
    });
  };

  // 하위호환: file 모드
  Widget_Image.prototype._refreshFile = function(sprite) {
    var def = this._def;
    var w = this._width;
    var h = this._height || 100;
    if (!def.imageName) {
      if (!this._bitmap) {
        this._bitmap = new Bitmap(w, h);
        sprite.bitmap = this._bitmap;
      }
      this._bitmap.clear();
      this._bitmap.fillRect(0, 0, w, h, def.bgColor || '#ffffff');
      this._drawDecoBorder(this._bitmap, w, h, def);
      return;
    }
    if (typeof ImageManager === 'undefined') return;
    var folder = def.imageFolder || 'img/system/';
    var bitmap = ImageManager.loadBitmap(folder, def.imageName);
    var self = this;
    bitmap.addLoadListener(function() {
      var drawW = self._width || bitmap.width;
      var drawH = self._height || bitmap.height;
      var bmp = new Bitmap(drawW, drawH);
      self._drawDecoBg(bmp, drawW, drawH, def);
      bmp.blt(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, drawW, drawH);
      self._drawDecoBorder(bmp, drawW, drawH, def);
      sprite.bitmap = bmp;
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
  // 하위호환: actorFace — 내부적으로 CSHelper 위임
  Widget_Image.prototype._refreshActorFace = function(sprite) {
    var aidx = this._resolveActorIndex();
    var bitmap = CSHelper.actorFace(aidx);
    if (!bitmap) return;
    var srcRect = CSHelper.actorFaceSrcRect(aidx);
    if (bitmap === this._lastBitmap && sprite.bitmap) return;
    this._lastBitmap = bitmap;
    var self = this;
    var w = this._width || 144, h = this._height || 144;
    bitmap.addLoadListener(function() {
      if (!self._bitmap) { self._bitmap = new Bitmap(w, h); sprite.bitmap = self._bitmap; }
      self._bitmap.clear();
      if (srcRect) {
        self._bitmap.blt(bitmap, srcRect.x, srcRect.y, srcRect.w, srcRect.h, 0, 0, w, h);
      } else {
        self._bitmap.blt(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, w, h);
      }
    });
  };

  // 하위호환: actorCharacter — 내부적으로 CSHelper 위임
  Widget_Image.prototype._refreshActorCharacter = function(sprite) {
    var aidx = this._resolveActorIndex();
    var bitmap = CSHelper.actorCharacter(aidx);
    if (!bitmap) return;
    if (bitmap === this._lastBitmap && sprite.bitmap) return;
    this._lastBitmap = bitmap;
    var self = this;
    var w = this._width || 48, h = this._height || 48;
    bitmap.addLoadListener(function() {
      var srcRect = CSHelper.actorCharacterSrcRect(aidx);
      if (!self._bitmap) { self._bitmap = new Bitmap(w, h); sprite.bitmap = self._bitmap; }
      self._bitmap.clear();
      if (srcRect) {
        self._bitmap.blt(bitmap, srcRect.x, srcRect.y, srcRect.w, srcRect.h, 0, 0, w, h);
      } else {
        self._bitmap.blt(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, w, h);
      }
    });
  };

  Widget_Image.prototype.update = function() {
    if (this._updateCount === undefined) this._updateCount = 0;
    ++this._updateCount;
    var needRefresh = this._bitmapExpr
      ? (this._updateCount % 10 === 0)   // expr 모드: 10프레임마다 체크 (빠른 반응)
      : (this._actorIndexExpr            // actorIndexExpr: 30프레임마다 (actor 전환 반응)
          ? (this._updateCount % 30 === 0)
          : (this._imageSource !== 'file' && this._updateCount % 60 === 0));
    if (needRefresh) this.refresh();
    Widget_Base.prototype.update.call(this);
  };

  window.Widget_Image = Widget_Image;

  //===========================================================================
  // Widget_Gauge — HP/MP/TP 게이지
  //===========================================================================
  function Widget_Gauge() {}
  Widget_Gauge.prototype = Object.create(Widget_Base.prototype);
  Widget_Gauge.prototype.constructor = Widget_Gauge;
  Widget_Gauge.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._valueExpr      = def.valueExpr      || null;
    this._maxExpr        = def.maxExpr        || null;
    this._labelExpr      = def.labelExpr      || null;
    this._gaugeType      = def.gaugeType      || 'hp';
    this._actorIndex     = def.actorIndex     || 0;
    this._actorIndexExpr = def.actorIndexExpr || null;
    this._gaugeRenderMode = def.gaugeRenderMode || 'palette';
    this._gaugeSkinId = def.gaugeSkinId || null;
    this._showLabel = def.showLabel !== false;
    this._showValue = def.showValue !== false;
    this._skinData = null;
    this._skinBitmap = null;
    this._windowSkin = null;
    var sprite = new Sprite();
    sprite.x = this._x;
    sprite.y = this._y;
    if (def.bgAlpha !== undefined) sprite.opacity = Math.round(def.bgAlpha * 255);
    var bitmap = new Bitmap(this._width, this._height || 36);
    sprite.bitmap = bitmap;
    this._sprite = sprite;
    this._bitmap = bitmap;
    this._displayObject = sprite;
    // 스킨 ID가 있으면 (이미지/팔레트 공통) 스킨 이미지 로드
    if (this._gaugeSkinId && typeof UIEditorSkins !== 'undefined') {
      var skinEntry = UIEditorSkins.find(function(s) { return s.name === this._gaugeSkinId; }.bind(this));
      if (skinEntry) {
        this._skinData = skinEntry;
        // gaugeFile 우선, 없으면 스킨 file, 없으면 스킨 name
        this._skinBitmap = ImageManager.loadSystem(skinEntry.gaugeFile || skinEntry.file || skinEntry.name);
      }
    }
    // 스킨 없는 팔레트 모드 폴백: Window.png
    if (!this._skinData) {
      this._windowSkin = ImageManager.loadSystem('Window');
    }
    this.refresh();
  };
  Widget_Gauge.prototype.refresh = function() {
    if (!this._bitmap) return;
    var w = this._width;
    var h = this._height || 36;
    var barH = Math.max(6, Math.round(h * 0.35));
    var barY = h - barH;
    this._bitmap.clear();
    this._drawDecoBg(this._bitmap, w, h, this._def);
    var label = '', cur = 0, max = 1;
    var hasValue = false;
    if (this._valueExpr) {
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
          case 'hp': label='HP'; cur=actor.hp; max=actor.mhp; break;
          case 'mp': label='MP'; cur=actor.mp; max=actor.mmp; break;
          case 'tp': label='TP'; cur=actor.tp; max=actor.maxTp(); break;
        }
        hasValue = true;
      }
    }
    if (hasValue) {
      var rate = max > 0 ? cur / max : 0;
      // 이미지 기반 게이지 렌더링
      if (this._gaugeRenderMode === 'image' && this._skinData && this._skinBitmap && this._skinBitmap.isReady()) {
        var sd = this._skinData;
        var bgX = sd.gaugeBgX || 0, bgY = sd.gaugeBgY || 0;
        var bgW = sd.gaugeBgW || 0, bgH = sd.gaugeBgH || 0;
        var fX = sd.gaugeFillX || 0, fY = sd.gaugeFillY || 0;
        var fW = sd.gaugeFillW || 0, fH = sd.gaugeFillH || 0;
        var fillDir = sd.gaugeFillDir || 'horizontal';
        // 배경 (bar 영역)
        if (bgW > 0 && bgH > 0) {
          this._bitmap.blt(this._skinBitmap, bgX, bgY, bgW, bgH, 0, barY, w, barH);
        }
        // 채움 (rate에 따라 클리핑)
        if (fW > 0 && fH > 0) {
          if (fillDir === 'horizontal') {
            var fillW = Math.floor(w * rate);
            var srcFillW = Math.floor(fW * rate);
            if (fillW > 0) this._bitmap.blt(this._skinBitmap, fX, fY, srcFillW, fH, 0, barY, fillW, barH);
          } else {
            var fillH = Math.floor(barH * rate);
            var srcFillH = Math.floor(fH * rate);
            if (fillH > 0) this._bitmap.blt(this._skinBitmap, fX, fY + fH - srcFillH, fW, srcFillH, 0, barY + barH - fillH, w, fillH);
          }
        }
      } else if (this._gaugeRenderMode === 'palette' && this._skinData && this._skinBitmap && this._skinBitmap.isReady()) {
        // 팔레트 모드 — 스킨 이미지에서 색상 샘플링 → gradientFillRect
        var sd2 = this._skinData;
        var bgX2 = sd2.gaugeBgX || 0, bgY2 = sd2.gaugeBgY || 0;
        var bgW2 = sd2.gaugeBgW || 0, bgH2 = sd2.gaugeBgH || 0;
        var fX2 = sd2.gaugeFillX || 0, fY2 = sd2.gaugeFillY || 0;
        var fW2 = sd2.gaugeFillW || 0, fH2 = sd2.gaugeFillH || 0;
        var fillDir2 = sd2.gaugeFillDir || 'horizontal';
        // 배경 blt (bar 영역)
        if (bgW2 > 0 && bgH2 > 0) {
          this._bitmap.blt(this._skinBitmap, bgX2, bgY2, bgW2, bgH2, 0, barY, w, barH);
        }
        // fill 영역에서 색상 샘플링 (horizontal: 좌/우 픽셀, vertical: 상/하 픽셀)
        var color1P, color2P;
        if (fW2 > 0 && fH2 > 0) {
          var midY2 = fY2 + Math.floor(fH2 / 2);
          var midX2 = fX2 + Math.floor(fW2 / 2);
          if (fillDir2 === 'vertical') {
            color1P = this._skinBitmap.getPixel(midX2, fY2);
            color2P = this._skinBitmap.getPixel(midX2, fY2 + fH2 - 1);
          } else {
            color1P = this._skinBitmap.getPixel(fX2, midY2);
            color2P = this._skinBitmap.getPixel(fX2 + fW2 - 1, midY2);
          }
        }
        if (!color1P) color1P = '#20c020';
        if (!color2P) color2P = '#60e060';
        if (fillDir2 === 'vertical') {
          var fillH3 = Math.floor(barH * rate);
          if (fillH3 > 0) this._bitmap.gradientFillRect(0, barY + barH - fillH3, w, fillH3, color1P, color2P, true);
        } else {
          var fillW3 = Math.floor(w * rate);
          if (fillW3 > 0) this._bitmap.gradientFillRect(0, barY, fillW3, barH, color1P, color2P);
        }
      } else {
        // 팔레트 폴백 — 스킨 없을 때 Window.png textColor 기반 그라디언트
        var color1, color2, bgColor;
        if (this._windowSkin && this._windowSkin.isReady()) {
          var ws = this._windowSkin;
          // textColor(n): px = 96+(n%8)*12+6, py = 144+floor(n/8)*12+6
          bgColor = ws.getPixel(96 + (19 % 8) * 12 + 6, 144 + Math.floor(19 / 8) * 12 + 6);
          switch (this._gaugeType) {
            case 'hp':
              color1 = ws.getPixel(96 + (20 % 8) * 12 + 6, 144 + Math.floor(20 / 8) * 12 + 6);
              color2 = ws.getPixel(96 + (21 % 8) * 12 + 6, 144 + Math.floor(21 / 8) * 12 + 6);
              break;
            case 'mp':
              color1 = ws.getPixel(96 + (22 % 8) * 12 + 6, 144 + Math.floor(22 / 8) * 12 + 6);
              color2 = ws.getPixel(96 + (23 % 8) * 12 + 6, 144 + Math.floor(23 / 8) * 12 + 6);
              break;
            case 'tp':
              color1 = ws.getPixel(96 + (28 % 8) * 12 + 6, 144 + Math.floor(28 / 8) * 12 + 6);
              color2 = ws.getPixel(96 + (29 % 8) * 12 + 6, 144 + Math.floor(29 / 8) * 12 + 6);
              break;
            default:
              color1 = '#20c020'; color2 = '#60e060';
          }
        } else {
          bgColor = '#202020';
          switch (this._gaugeType) {
            case 'hp': color1 = '#20c020'; color2 = '#60e060'; break;
            case 'mp': color1 = '#2040c0'; color2 = '#4080e0'; break;
            case 'tp': color1 = '#c08020'; color2 = '#e0c040'; break;
            default:   color1 = '#20c020'; color2 = '#60e060'; break;
          }
        }
        this._bitmap.fillRect(0, barY, w, barH, bgColor || '#202020');
        var fillW2 = Math.floor(w * rate);
        if (fillW2 > 0) {
          this._bitmap.gradientFillRect(0, barY, fillW2, barH, color1, color2);
        }
      }
    }
    // label / value 텍스트 표시
    if (hasValue) {
      var textColor = (this._windowSkin && this._windowSkin.isReady())
        ? this._windowSkin.getPixel(96 + (0 % 8) * 12 + 6, 144 + Math.floor(0 / 8) * 12 + 6)
        : '#ffffff';
      var textSize = Math.max(12, Math.round((h - barH) * 0.75));
      this._bitmap.fontSize = textSize;
      if (this._showLabel && label) {
        this._bitmap.textColor = textColor;
        this._bitmap.drawText(label, 2, 0, Math.floor(w * 0.4), h - barH, 'left');
      }
      if (this._showValue) {
        var valStr = String(cur) + '/' + String(max);
        this._bitmap.textColor = textColor;
        this._bitmap.drawText(valStr, 0, 0, w - 2, h - barH, 'right');
      }
    }
    this._drawDecoBorder(this._bitmap, w, h, this._def);
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
    if (def.bgAlpha !== undefined) sprite.opacity = Math.round(def.bgAlpha * 255);
    var h = this._height || 4;
    var bitmap = new Bitmap(this._width, h);
    this._drawDecoBg(bitmap, this._width, h, def);
    var lineY = Math.floor(h / 2) - 1;
    bitmap.paintOpacity = 64;
    bitmap.fillRect(0, lineY, this._width, 2, '#ffffff');
    bitmap.paintOpacity = 255;
    this._drawDecoBorder(bitmap, this._width, h, def);
    sprite.bitmap = bitmap;
    this._displayObject = sprite;
  };
  window.Widget_Separator = Widget_Separator;

  //===========================================================================
  // Widget_Background — 씬 배경 (맵 스크린샷) 위젯
  //===========================================================================
  function Widget_Background() {}
  Widget_Background.prototype = Object.create(Widget_Base.prototype);
  Widget_Background.prototype.constructor = Widget_Background;
  Widget_Background.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    var sprite = new Sprite();
    sprite.x = this._x;
    sprite.y = this._y;
    sprite.bitmap = SceneManager.backgroundBitmap();
    this._displayObject = sprite;
  };
  window.Widget_Background = Widget_Background;

  //===========================================================================
  // Widget_Icons — 범용 아이콘 배열 표시 위젯
  //   iconsExpr {string} — JS 식, 아이콘 ID(숫자) 배열 반환
  //                        예) "$gameParty.members()[$ctx.actorIndex].allIcons()"
  //   maxCols   {number} — 행당 최대 아이콘 수 (기본 10)
  //   iconSize  {number} — 아이콘 1개 크기 px (기본 Window_Base._iconWidth 또는 32)
  //   iconGap   {number} — 아이콘 간격 px (기본 2)
  //===========================================================================
  function Widget_Icons() {}
  Widget_Icons.prototype = Object.create(Widget_Base.prototype);
  Widget_Icons.prototype.constructor = Widget_Icons;
  Widget_Icons.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._iconsExpr = def.iconsExpr || null;
    this._maxCols   = def.maxCols   || 10;
    this._iconSize  = def.iconSize  || (typeof Window_Base !== 'undefined' && Window_Base._iconWidth) || 32;
    this._iconGap   = def.iconGap   !== undefined ? def.iconGap : 2;
    var h = this._height || (this._iconSize + this._iconGap);
    var bitmap = new Bitmap(this._width, h);
    this._bitmap = bitmap;
    var sprite = new Sprite(bitmap);
    sprite.x = this._x;
    sprite.y = this._y;
    if (def.bgAlpha !== undefined) sprite.opacity = Math.round(def.bgAlpha * 255);
    this._displayObject = sprite;
    this.refresh();
  };
  Widget_Icons.prototype._getIcons = function() {
    if (!this._iconsExpr) return [];
    try {
      var c = (SceneManager._scene && SceneManager._scene._ctx) || {};
      var result = new Function('$ctx', 'return (' + this._iconsExpr + ')')(c);
      return Array.isArray(result) ? result : [];
    } catch(e) { return []; }
  };
  Widget_Icons.prototype.refresh = function() {
    if (!this._bitmap) return;
    var w = this._width;
    var h = this._bitmap.height;
    this._bitmap.clear();
    this._drawDecoBg(this._bitmap, w, h, this._def);
    var icons = this._getIcons();
    if (!icons.length) { this._drawDecoBorder(this._bitmap, w, h, this._def); return; }
    var iconSet = ImageManager.loadSystem('IconSet');
    var iconSize = this._iconSize;
    var gap = this._iconGap;
    var maxCols = this._maxCols;
    var iconW = typeof Window_Base !== 'undefined' ? Window_Base._iconWidth  : 32;
    var iconH = typeof Window_Base !== 'undefined' ? Window_Base._iconHeight : 32;
    var cols = 16; // IconSet.png 열 수
    var bmp = this._bitmap;
    var def = this._def;
    iconSet.addLoadListener(function() {
      bmp.clear();
      for (var i = 0; i < icons.length; i++) {
        var iconIndex = icons[i];
        if (!iconIndex) continue;
        var col = i % maxCols;
        var row = Math.floor(i / maxCols);
        var sx = (iconIndex % cols) * iconW;
        var sy = Math.floor(iconIndex / cols) * iconH;
        var dx = col * (iconSize + gap);
        var dy = row * (iconSize + gap);
        bmp.blt(iconSet, sx, sy, iconW, iconH, dx, dy, iconSize, iconSize);
      }
    });
    this._drawDecoBorder(this._bitmap, w, h, this._def);
  };
  Widget_Icons.prototype.update = function() {
    if (this._updateCount === undefined) this._updateCount = 0;
    if (++this._updateCount % 30 === 0) this.refresh();
    Widget_Base.prototype.update.call(this);
  };
  window.Widget_Icons = Widget_Icons;

  //===========================================================================
  // Widget_RowSelector — 범용 N행 선택 위젯 (focusable)
  //===========================================================================
  function Widget_RowSelector() {}
  Widget_RowSelector.prototype = Object.create(Widget_Base.prototype);
  Widget_RowSelector.prototype.constructor = Widget_RowSelector;
  Widget_RowSelector.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._handlersDef = def.handlers || {};
    var win = new Window_RowSelector(this._x, this._y, def);
    win._customClassName = 'Widget_CS_' + this._id;
    win.deactivate();
    this._applyWindowStyle(win, def);
    if (def.windowed !== false && def.bgAlpha !== undefined) win.opacity = Math.round(def.bgAlpha * 255);
    this._window = win;
    this._displayObject = win;
    this._createDecoSprite(def, this._width, this._height || 400);
  };
  Widget_RowSelector.prototype.collectFocusable = function(out) {
    out.push(this);
  };
  Widget_RowSelector.prototype.activate = function() {
    if (this._window) {
      this._window.activate();
      this._window.selectLast();
    }
  };
  Widget_RowSelector.prototype.deactivate = function() {
    if (this._window) {
      this._window.deactivate();
      this._window.deselect();
    }
  };
  Widget_RowSelector.prototype.setHandler = function(symbol, fn) {
    if (this._window) this._window.setHandler(symbol, fn);
  };
  Widget_RowSelector.prototype.setCancelHandler = function(fn) {
    if (this._window) this._window.setHandler('cancel', fn);
  };
  Widget_RowSelector.prototype.setFormationMode = function(mode) {
    if (this._window) this._window.setFormationMode(mode);
  };
  Widget_RowSelector.prototype.setPendingIndex = function(index) {
    if (this._window) this._window.setPendingIndex(index);
  };
  Widget_RowSelector.prototype.pendingIndex = function() {
    return this._window ? this._window.pendingIndex() : -1;
  };
  Widget_RowSelector.prototype.index = function() {
    return this._window ? this._window.index() : -1;
  };
  Widget_RowSelector.prototype.refresh = function() {
    if (this._window) this._window.refresh();
  };
  Widget_RowSelector.prototype.handlesUpDown = function() { return true; };
  // backward compat alias
  window.Widget_ActorList = Widget_RowSelector;
  window.Widget_RowSelector = Widget_RowSelector;

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
    this._applyWindowStyle(win, def);
    if (def.windowed !== false && def.bgAlpha !== undefined) win.opacity = Math.round(def.bgAlpha * 255);
    this._window = win;
    this._displayObject = win;
    this._createDecoSprite(def, this._width, def.height || 400);
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
    if (this._window) { this._window.deactivate(); this._window.deselect(); }
  };
  Widget_Options.prototype.setHandler = function(symbol, fn) {
    if (this._window) this._window.setHandler(symbol, fn);
  };
  Widget_Options.prototype.setCancelHandler = function(fn) {
    if (this._window) this._window.setHandler('cancel', fn);
  };
  Widget_Options.prototype.handlesUpDown = function() { return true; };
  window.Widget_Options = Widget_Options;

  //===========================================================================
  // Widget_Button — 버튼 (focusable)
  //===========================================================================
  function Widget_Button() {}
  Widget_Button.prototype = Object.create(Widget_Base.prototype);
  Widget_Button.prototype.constructor = Widget_Button;
  Widget_Button.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._label = def.label !== undefined ? def.label : (def.name || 'Button');
    this._handlerDef = def.action || null;
    this._leftHandlerDef = def.leftAction || null;
    this._rightHandlerDef = def.rightAction || null;
    var hasChildren = !!(def.children && def.children.length > 0);
    var win;
    if (hasChildren || this._label === '') {
      // 자식 위젯이 텍스트 렌더링 — 커서/하이라이트만 제공
      win = new Window_ButtonRow(this._x, this._y, this._width, this._height || 52);
    } else {
      var btnDef = {
        id: def.id, width: def.width,
        commands: [{ name: this._label, symbol: 'ok', enabled: true }],
        maxCols: 1
      };
      if (def.height) btnDef.height = def.height;
      win = new Window_CustomCommand(this._x, this._y, btnDef);
    }
    win._customClassName = 'Widget_CS_' + this._id;
    win.deactivate();
    this._applyWindowStyle(win, def);
    if (def.windowed !== false && def.bgAlpha !== undefined) win.opacity = Math.round(def.bgAlpha * 255);
    this._window = win;
    this._displayObject = win;
    this._createDecoSprite(def, this._width, this._height || 52);
  };
  Widget_Button.prototype.collectFocusable = function(out) {
    out.push(this);
  };
  Widget_Button.prototype.activate = function() {
    if (this._window) { this._window.activate(); this._window.select(0); }
  };
  Widget_Button.prototype.deactivate = function() {
    if (this._window) { this._window.deactivate(); this._window.deselect(); }
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
    this._dataScript = def.dataScript || null;
    this._onCursorDef = def.onCursor || null;
    this._autoHeight = def.autoHeight || false;
    this._focusable = (def.focusable !== false); // false로 명시하면 NavigationManager 포커스 제외
    var listDef = {
      id: def.id, width: def.width,
      commands: this._items,
      maxCols: def.maxCols || 1
    };
    if (def.height) listDef.height = def.height;
    var win = new Window_CustomCommand(this._x, this._y, listDef);
    win._customClassName = 'Widget_CS_' + this._id;
    win.deactivate();
    win.deselect(); // Window_Command.initialize가 select(0)을 호출하므로 명시적으로 해제
    if (this._autoHeight) {
      win.height = 0; // 초기 빈 윈도우 flash 방지
      console.log('[CSE] Widget_List autoHeight init, id=' + def.id + ', height set to 0');
    }
    if (!this._focusable) {
      // updateCursor: RPG Maker MV 레벨 커서 rect 0으로 설정
      win.updateCursor = function() { this.setCursorRect(0, 0, 0, 0); };
      // _updateCursor: rpg_core.js 저수준 — 매 프레임 _windowCursorSprite.visible = isOpen() 강제 설정하므로 반드시 override
      win._updateCursor = function() { if (this._windowCursorSprite) this._windowCursorSprite.visible = false; };
      console.log('[CSE] Widget_List focusable=false, updateCursor override, id=' + def.id);
    }
    this._applyWindowStyle(win, def);
    if (def.windowed !== false && def.bgAlpha !== undefined) win.opacity = Math.round(def.bgAlpha * 255);
    this._window = win;
    this._displayObject = win;
    this._createDecoSprite(def, this._width, def.height || 400);
    // onCursor — 커서 이동 시 코드 실행
    if (this._onCursorDef && this._onCursorDef.code) {
      var onCursorCode = this._onCursorDef.code;
      win.callUpdateHelp = function() {
        try {
          var scene = SceneManager._scene;
          if (scene) { var fn = new Function(onCursorCode); fn.call(scene); }
        } catch(e) {
          console.error('[Widget_List] onCursor error:', e);
        }
      };
    }
  };
  Widget_List.prototype._rebuildFromScript = function() {
    if (!this._dataScript || !this._window) return;
    try {
      var items = (new Function('return (' + this._dataScript + ')'))();
      if (!Array.isArray(items)) items = [];
      this._window._winDef.commands = items;
      if (this._autoHeight) {
        this._window.height = items.length > 0 ? this._window.fittingHeight(items.length) : 0;
      }
      if (this._window.refresh) this._window.refresh();
      // 빈 목록이거나 비활성이면 커서 숨김
      if (items.length === 0 || !this._window.active) {
        this._window.deselect();
        // height=0일 때 커서 스프라이트가 창 밖으로 삐져나오는 문제 방지
        if (this._window._windowCursorSprite) this._window._windowCursorSprite.visible = false;
      }
    } catch(e) {
      console.error('[Widget_List] dataScript error:', e);
    }
  };
  Widget_List.prototype.collectFocusable = function(out) {
    if (this._focusable !== false) out.push(this);
  };
  Widget_List.prototype.activate = function() {
    if (this._dataScript) this._rebuildFromScript();
    if (this._window) {
      this._window.activate();
      var maxItems = this._window.maxItems();
      if (maxItems > 0) {
        var restore = (this._lastIndex !== undefined && this._lastIndex >= 0 && this._lastIndex < maxItems)
          ? this._lastIndex : 0;
        this._window.select(restore);
      } else {
        this._window.deselect();
      }
    }
  };
  Widget_List.prototype.deactivate = function() {
    if (this._window) {
      this._lastIndex = this._window.index();
      this._window.deactivate();
      this._window.deselect();
    }
  };
  Widget_List.prototype.refresh = function() {
    if (this._dataScript) this._rebuildFromScript();
    Widget_Base.prototype.refresh.call(this);
  };
  Widget_List.prototype.setHandler = function(symbol, fn) {
    if (this._window) this._window.setHandler(symbol, fn);
  };
  Widget_List.prototype.setCancelHandler = function(fn) {
    if (this._window) this._window.setHandler('cancel', fn);
  };
  Widget_List.prototype.update = function() {
    if (this._updateCount === undefined) this._updateCount = 0;
    ++this._updateCount;
    if (this._dataScript) {
      if (this._updateCount % 6 === 0) this._rebuildFromScript();
    } else {
      var items = this._items;
      var hasCondition = items && items.some(function(item) {
        return typeof item.enabledCondition === 'string' && item.enabledCondition;
      });
      if (hasCondition && this._updateCount % 60 === 0) {
        if (this._window) this._window.refresh();
      }
    }
    Widget_Base.prototype.update.call(this);
  };
  Widget_List.prototype.handlesUpDown = function() { return true; };
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
    this._upDownNavigation = config.upDownNavigation || false;
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
    if (typeof SoundManager !== 'undefined') SoundManager.playCursor();
    this._activateAt(next);
  };
  NavigationManager.prototype.focusPrev = function() {
    var prev = (this._activeIndex - 1 + this._focusables.length) % this._focusables.length;
    if (typeof SoundManager !== 'undefined') SoundManager.playCursor();
    this._activateAt(prev);
  };
  NavigationManager.prototype.update = function() {
    if (this._focusables.length <= 1) return;
    if (this._upDownNavigation) {
      var activeWidget = this._focusables[this._activeIndex];
      var delegated = activeWidget && typeof activeWidget.handlesUpDown === 'function' && activeWidget.handlesUpDown();
      if (!delegated) {
        if (Input.isRepeated('down')) this.focusNext();
        else if (Input.isRepeated('up')) this.focusPrev();
      }
    } else {
      if (Input.isTriggered('pagedown')) this.focusNext();
      else if (Input.isTriggered('pageup')) this.focusPrev();
    }
  };
  window.NavigationManager = NavigationManager;

  //===========================================================================
  // Scene_CustomUI — Scene_Base 상속 (배경은 Widget_Background 위젯으로 처리)
  //===========================================================================
  function Scene_CustomUI() {
    this.initialize.apply(this, arguments);
  }

  Scene_CustomUI.prototype = Object.create(Scene_Base.prototype);
  Scene_CustomUI.prototype.constructor = Scene_CustomUI;

  Scene_CustomUI.prototype.initialize = function () {
    Scene_Base.prototype.initialize.call(this);
    this._sceneId = '';
    this._prepareData = {};
    this._ctx = {};
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
    Scene_Base.prototype.create.call(this);
    this.createWindowLayer();
    var sceneDef = this._getSceneDef();
    if (!sceneDef) return;

    // _ctx 초기화: initCtx (씬 정의) → prepareData (prepare() 인자) 순서로 덮어쓰기
    var initCtx = sceneDef.initCtx || {};
    for (var ick in initCtx) {
      var ickExpr = initCtx[ick];
      if (typeof ickExpr === 'string') {
        try { this._ctx[ick] = new Function('return (' + ickExpr + ')')(); }
        catch(e) { this._ctx[ick] = ickExpr; }
      } else {
        this._ctx[ick] = ickExpr;
      }
    }
    for (var pk in this._prepareData) {
      this._ctx[pk] = this._prepareData[pk];
    }

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

    // 비-Window 루트(배경 스프라이트 등)는 windowLayer보다 먼저(뒤에) 렌더링되어야 함
    // → addChildAt(rootObj, 0) 으로 index 0에 삽입하여 windowLayer 아래에 그려지게 함
    var rootObj = this._rootWidget.displayObject();
    if (rootObj && !(rootObj instanceof Window_Base)) {
      this.addChildAt(rootObj, 0);
    }
    // Window_Base 타입 위젯의 decoSprite를 먼저 추가 (window layer 아래)
    for (var id in this._widgetMap) {
      var w = this._widgetMap[id];
      if (w._decoSprite && w.displayObject() instanceof Window_Base) {
        this.addChild(w._decoSprite);
      }
    }
    // Window_Base 타입 위젯은 addWindow
    for (var id2 in this._widgetMap) {
      var w2 = this._widgetMap[id2];
      var obj = w2.displayObject();
      if (obj && obj instanceof Window_Base) {
        this.addWindow(obj);
      }
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
    // 외부 플러그인이 registerWidget으로 등록한 타입 먼저 확인
    if (_widgetRegistry[def.type]) {
      widget = new _widgetRegistry[def.type]();
    } else {
      switch (def.type) {
        case 'panel':       widget = new Widget_Panel();       break;
        case 'label':       widget = new Widget_Label();       break;
        case 'textArea':    widget = new Widget_TextArea();    break;
        case 'image':       widget = new Widget_Image();       break;
        case 'gauge':       widget = new Widget_Gauge();       break;
        case 'separator':   widget = new Widget_Separator();   break;
        case 'icons':       widget = new Widget_Icons();       break;
        case 'button':      widget = new Widget_Button();      break;
        case 'list':        widget = new Widget_List();        break;
        case 'rowSelector':
        case 'actorList':   widget = new Widget_RowSelector(); break;
        case 'options':     widget = new Widget_Options();     break;
        case 'background':  widget = new Widget_Background();  break;
        default:            return null;
      }
    }
    widget.initialize(def, parentWidget);

    // 자식 위젯 재귀 빌드
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
        // cancel이 handlersDef에 없을 때만 기본 핸들러 설정
        if (!handlersDef['cancel']) {
          widget.setCancelHandler(function() {
            self._executeWidgetHandler({ action: 'cancel' }, widget);
          });
        }
      } else if (widget instanceof Widget_RowSelector) {
        (function(w) {
          w.setHandler('ok', function() {
            self._onRowSelectorOk(w);
          });
          w.setCancelHandler(function() {
            self._onRowSelectorCancel(w);
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
        var leftDef = widget._leftHandlerDef;
        if (leftDef && widget._window && widget._window.setLeftHandler) {
          (function(handler, w) {
            w._window.setLeftHandler(function() {
              self._executeWidgetHandler(handler, w);
            });
          })(leftDef, widget);
        }
        var rightDef = widget._rightHandlerDef;
        if (rightDef && widget._window && widget._window.setRightHandler) {
          (function(handler, w) {
            w._window.setRightHandler(function() {
              self._executeWidgetHandler(handler, w);
            });
          })(rightDef, widget);
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
        var gotoTarget = handler.target || '';
        var gotoCsId = gotoTarget.startsWith('Scene_CS_') ? gotoTarget.replace('Scene_CS_', '') : '';
        if (gotoCsId && OverlayManager._isOverlaySce(gotoCsId)) {
          OverlayManager.show(gotoCsId);
        } else {
          var SceneCtor = window[gotoTarget];
          if (SceneCtor) SceneManager.push(SceneCtor);
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
        var csCsId = target.startsWith('Scene_CS_') ? target.replace('Scene_CS_', '') : target;
        if (OverlayManager._isOverlaySce(csCsId)) {
          OverlayManager.show(csCsId);
        } else {
          var csName = target.startsWith('Scene_CS_') ? target : 'Scene_CS_' + target;
          var CSCtor = window[csName];
          if (CSCtor) SceneManager.push(CSCtor);
        }
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
          if (handler.thenAction) {
            this._executeWidgetHandler(handler.thenAction, widget);
          } else {
            if (widget && widget.activate) widget.activate();
          }
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
      case 'toggleConfig': {
        var cfgKey = handler.configKey;
        if (cfgKey !== undefined && typeof ConfigManager !== 'undefined') {
          var prev = ConfigManager[cfgKey];
          ConfigManager[cfgKey] = !prev;

          if (prev !== ConfigManager[cfgKey] && typeof SoundManager !== 'undefined') SoundManager.playCursor();
        }
        if (widget && widget.activate) widget.activate();
        break;
      }
      case 'incrementConfig': {
        var cfgKey2 = handler.configKey;
        if (cfgKey2 !== undefined && typeof ConfigManager !== 'undefined') {
          var cur = ConfigManager[cfgKey2] !== undefined ? ConfigManager[cfgKey2] : 100;
          var step = handler.step || 20;
          var next = cur + step > 100 ? 0 : cur + step;
          if (cur !== next) {
            ConfigManager[cfgKey2] = next;
  
            if (typeof SoundManager !== 'undefined') SoundManager.playCursor();
          }
        }
        if (widget && widget.activate) widget.activate();
        break;
      }
      case 'decrementConfig': {
        var cfgKey3 = handler.configKey;
        if (cfgKey3 !== undefined && typeof ConfigManager !== 'undefined') {
          var cur2 = ConfigManager[cfgKey3] !== undefined ? ConfigManager[cfgKey3] : 100;
          var step2 = handler.step || 20;
          var next2 = Math.max(0, cur2 - step2);
          if (cur2 !== next2) {
            ConfigManager[cfgKey3] = next2;
  
            if (typeof SoundManager !== 'undefined') SoundManager.playCursor();
          }
        }
        if (widget && widget.activate) widget.activate();
        break;
      }
      case 'saveConfig': {
        if (typeof ConfigManager !== 'undefined' && typeof ConfigManager.save === 'function') {
          ConfigManager.save();
        }
        if (handler.thenAction) {
          this._executeWidgetHandler(handler.thenAction, widget);
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

  Scene_CustomUI.prototype._onRowSelectorOk = function(widget) {
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
      var handlersDef = widget._handlersDef || {};
      if (handlersDef['ok']) {
        this._executeWidgetHandler(handlersDef['ok'], widget);
        return;
      }
      // source==='party' (numRows==='party' or undefined) 일 때 menuActor 설정
      var nr = win._numRows;
      if ((nr === 'party' || nr === undefined) && typeof $gameParty !== 'undefined') {
        var actor = $gameParty.members()[index];
        if (actor) $gameParty.setMenuActor(actor);
      }
      var action = this._pendingPersonalAction;
      if (action) {
        this._pendingPersonalAction = null;
        this._executeWidgetHandler(action, widget);
      }
    }
  };
  // backward compat
  Scene_CustomUI.prototype._onActorListOk = Scene_CustomUI.prototype._onRowSelectorOk;

  Scene_CustomUI.prototype.terminate = function() {
    Scene_Base.prototype.terminate.call(this);
    var sceneDef = this._getSceneDef();
    if (sceneDef && sceneDef.saveConfigOnExit) {
      if (typeof ConfigManager !== 'undefined' && typeof ConfigManager.save === 'function') {
        ConfigManager.save();
      }
    }
  };

  Scene_CustomUI.prototype._onOptionsCancel = function(widget) {
    if (typeof ConfigManager !== 'undefined' && typeof ConfigManager.save === 'function') {
      ConfigManager.save();
    }
    this.popScene();
  };

  Scene_CustomUI.prototype._onRowSelectorCancel = function(widget) {
    var win = widget._window;
    if (win.formationMode() && win.pendingIndex() >= 0) {
      win.setPendingIndex(-1);
      win.activate();
    } else {
      var handlersDef = widget._handlersDef || {};
      if (handlersDef['cancel']) {
        win.deselect();
        this._executeWidgetHandler(handlersDef['cancel'], widget);
        return;
      }
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
  // backward compat
  Scene_CustomUI.prototype._onActorListCancel = Scene_CustomUI.prototype._onRowSelectorCancel;

  Scene_CustomUI.prototype.start = function () {
    Scene_Base.prototype.start.call(this);
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
    Scene_Base.prototype.update.call(this);
    if (this._navManager) this._navManager.update();
    if (this._rootWidget) this._rootWidget.update();
    // 씬 레벨 keyHandlers: pageup/pagedown/cancel 등 임의 키 처리
    var sceneDef = this._getSceneDef();
    var keyHandlers = sceneDef && sceneDef.keyHandlers;
    if (keyHandlers) {
      var keys = Object.keys(keyHandlers);
      for (var ki = 0; ki < keys.length; ki++) {
        var key = keys[ki];
        if (Input.isTriggered(key)) {
          this._executeWidgetHandler(keyHandlers[key], null);
          break;
        }
      }
    }
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
        var gotoTarget2 = handler.target || '';
        var gotoCsId2 = gotoTarget2.startsWith('Scene_CS_') ? gotoTarget2.replace('Scene_CS_', '') : '';
        if (gotoCsId2 && OverlayManager._isOverlaySce(gotoCsId2)) {
          OverlayManager.show(gotoCsId2);
        } else {
          var SceneCtor2 = window[gotoTarget2];
          if (SceneCtor2) SceneManager.push(SceneCtor2);
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
        var csCsId2 = target.startsWith('Scene_CS_') ? target.replace('Scene_CS_', '') : target;
        if (OverlayManager._isOverlaySce(csCsId2)) {
          OverlayManager.show(csCsId2);
        } else {
          var csName2 = target.startsWith('Scene_CS_') ? target : 'Scene_CS_' + target;
          var CSCtor2 = window[csName2];
          if (CSCtor2) SceneManager.push(CSCtor2);
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
  var _activeRedirects = {}; // 현재 활성화된 redirects (reloadCustomScenes가 덮어쓰지 않도록 별도 보관)

  function installSceneRedirects(redirects) {
    _activeRedirects = redirects || {};
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
    // 파일에 저장된 sceneRedirects가 있으면 그것을 사용, 없으면 메모리의 _activeRedirects 유지
    var fileRedirects = _configData.sceneRedirects;
    if (fileRedirects && Object.keys(fileRedirects).length > 0) {
      installSceneRedirects(fileRedirects);
    } else {
      installSceneRedirects(_activeRedirects);
    }
  }

  //===========================================================================
  // Scene_OverlayUI — OverlayManager가 관리하는 오버레이 씬
  //===========================================================================
  function Scene_OverlayUI() {
    this.initialize.apply(this, arguments);
  }

  Scene_OverlayUI.prototype = Object.create(Scene_CustomUI.prototype);
  Scene_OverlayUI.prototype.constructor = Scene_OverlayUI;

  // 오버레이에서 popScene → OverlayManager.hide (SceneManager 스택과 무관)
  Scene_OverlayUI.prototype.popScene = function () {
    OverlayManager.hide(this._sceneId);
  };

  //===========================================================================
  // OverlayManager — 씬 스택과 독립적인 오버레이 레이어 관리
  //===========================================================================
  var OverlayManager = {
    _instances: {}, // sceneId -> { container, scene }

    show: function (sceneId, args) {
      var inst = this._instances[sceneId];
      if (!inst) {
        inst = this._create(sceneId, args);
        if (!inst) return;
        this._instances[sceneId] = inst;
      }
      inst.scene.visible = true;
    },

    hide: function (sceneId) {
      var inst = this._instances[sceneId];
      if (inst) inst.scene.visible = false;
    },

    toggle: function (sceneId) {
      var inst = this._instances[sceneId];
      if (!inst || !inst.scene.visible) this.show(sceneId);
      else this.hide(sceneId);
    },

    isVisible: function (sceneId) {
      var inst = this._instances[sceneId];
      return !!(inst && inst.scene.visible);
    },

    destroy: function (sceneId) {
      var inst = this._instances[sceneId];
      if (inst) {
        if (inst.scene.parent) inst.scene.parent.removeChild(inst.scene);
        delete this._instances[sceneId];
      }
    },

    update: function () {
      // 씬 전환 감지 — overlay를 항상 현재 씬에 부착
      var currentScene = SceneManager._scene;
      for (var id in this._instances) {
        var inst = this._instances[id];
        if (currentScene && inst.scene.parent !== currentScene) {
          currentScene.addChild(inst.scene);
        }
        if (inst.scene.visible) {
          if (inst.scene.update) inst.scene.update();
        }
      }
    },

    _isOverlaySce: function (sceneId) {
      var scenes = _scenesData.scenes || {};
      var def = scenes[sceneId];
      return !!(def && def.overlay);
    },

    _create: function (sceneId, args) {
      if (!this._isOverlaySce(sceneId)) return null;

      var currentScene = SceneManager._scene;
      if (!currentScene) return null;

      var scene = new Scene_OverlayUI();
      scene._sceneId = sceneId;
      if (args && scene.prepare) scene.prepare.apply(scene, args);
      scene.create();
      // Scene_OverlayUI(Stage)는 _threeObj를 가지므로 직접 addChild
      currentScene.addChild(scene);
      if (scene.start) scene.start();

      return { scene: scene };
    },
  };

  window.OverlayManager = OverlayManager;

  //===========================================================================
  // SceneManager.update 훅 — 오버레이 업데이트
  //===========================================================================
  var _SceneManager_update = SceneManager.update;
  SceneManager.update = function () {
    _SceneManager_update.call(this);
    OverlayManager.update();
  };

  //===========================================================================
  // 플러그인 커맨드: OVERLAY SHOW/HIDE/TOGGLE/DESTROY <sceneId>
  //===========================================================================
  var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command.toUpperCase() === 'OVERLAY') {
      var action = (args[0] || '').toUpperCase();
      var sceneId = args[1] || '';
      switch (action) {
        case 'SHOW':    OverlayManager.show(sceneId);    break;
        case 'HIDE':    OverlayManager.hide(sceneId);    break;
        case 'TOGGLE':  OverlayManager.toggle(sceneId);  break;
        case 'DESTROY': OverlayManager.destroy(sceneId); break;
      }
    }
  };

  //===========================================================================
  // 초기 등록
  //===========================================================================
  registerCustomScenes();
  installSceneRedirects(_configData.sceneRedirects || {});

  //===========================================================================
  // addMenuCommand 헬퍼 — 씬 정의의 list 위젯에 항목/핸들러 동적 추가
  //===========================================================================
  function findWidgetDefById(node, id) {
    if (!node) return null;
    if (node.id === id) return node;
    var children = node.children || [];
    for (var i = 0; i < children.length; i++) {
      var found = findWidgetDefById(children[i], id);
      if (found) return found;
    }
    return null;
  }

  function addMenuCommand(sceneId, widgetId, item, handlerDef, options) {
    var scenes = _scenesData.scenes || {};
    var scene = scenes[sceneId];
    if (!scene || !scene.root) return false;
    var widgetDef = findWidgetDefById(scene.root, widgetId);
    if (!widgetDef) return false;
    if (!widgetDef.items) widgetDef.items = widgetDef.commands || [];
    var exists = widgetDef.items.some(function(it) { return it.symbol === item.symbol; });
    if (!exists) {
      var idx = options != null && options.index != null ? options.index : null;
      if (idx !== null) {
        var len = widgetDef.items.length;
        widgetDef.items.splice(idx < 0 ? Math.max(0, len + idx) : idx, 0, item);
      } else {
        widgetDef.items.push(item);
      }
    }
    if (handlerDef) {
      if (!widgetDef.handlers) widgetDef.handlers = {};
      if (!widgetDef.handlers[item.symbol]) widgetDef.handlers[item.symbol] = handlerDef;
    }
    return true;
  }

  // 외부 인터페이스
  window.__customSceneEngine = {
    reloadCustomScenes: reloadCustomScenes,
    updateSceneRedirects: function (redirects) {
      installSceneRedirects(redirects || {});
    },
    overlayManager: OverlayManager,
    /**
     * 외부 플러그인이 커스텀 위젯 타입을 등록합니다.
     * @param {string} type - 위젯 타입 식별자 (예: 'minimap')
     * @param {Function} WidgetClass - Widget_Base를 상속하는 생성자 함수
     */
    registerWidget: function (type, WidgetClass) {
      _widgetRegistry[type] = WidgetClass;
    },
    /**
     * 씬의 list 위젯에 메뉴 항목을 동적으로 추가합니다 (JSON 파일 수정 없음).
     * @param {string} sceneId    - 씬 ID (예: 'menu_v2')
     * @param {string} widgetId   - list 위젯 ID (예: 'cmd_main')
     * @param {Object} item       - { name, symbol, enabled }
     * @param {Object} handlerDef - { action, target } 또는 null
     * @param {Object} [options]  - { index: -1 } — 삽입 위치 (음수: 뒤에서, -1=마지막 앞)
     */
    addMenuCommand: addMenuCommand,
  };
})();
