//=============================================================================
// CustomSceneEngine.js
//=============================================================================
/*:
 * @plugindesc 커스텀 씬 엔진 - UIScenes/ 디렉터리에서 씬을 동적으로 생성
 * @author UI Editor
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

  /** 404/오류 시 null 반환 (loadJSON과 달리 {} 반환 안 함) */
  function loadJSONSafe(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url + '?_=' + Date.now(), false);
      xhr.send();
      if (xhr.status === 200 || xhr.status === 0) {
        return JSON.parse(xhr.responseText);
      }
    } catch (e) {}
    return null;
  }

  /**
   * 씬 데이터 로드: UIScenes/_index.json → 씬별 파일 로드
   * _index.json 이 없으면 빈 씬 목록 반환 (씬 미등록 상태)
   */
  function loadScenesData() {
    var index = loadJSONSafe('data/UIScenes/_index.json');
    if (!index || !Array.isArray(index)) return { scenes: {} };
    var scenes = {};
    for (var i = 0; i < index.length; i++) {
      var scene = loadJSONSafe('data/UIScenes/' + index[i] + '.json');
      if (scene && scene.id) scenes[scene.id] = scene;
    }
    return { scenes: scenes };
  }

  _scenesData = loadScenesData();
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
        // 임의 JS 표현식 폴백 — $ctx 주입
        try {
          var $ctx = (SceneManager._scene && SceneManager._scene._ctx) || {};
          var val = new Function('$ctx', 'return (' + expr + ')')($ctx);
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
    // ── 세이브파일 헬퍼 ────────────────────────────────────────────────────────
    /** 최대 세이브 슬롯 수 */
    savefileCount: function() {
      return (typeof DataManager !== 'undefined') ? DataManager.maxSavefiles() : 0;
    },
    /** 지정 슬롯의 세이브 정보 객체 {title, characters, playtime, timestamp} 반환. 없으면 null */
    savefileInfo: function(fileId) {
      return (typeof DataManager !== 'undefined') ? DataManager.loadSavefileInfo(fileId) : null;
    },
    /** 지정 슬롯이 유효한(데이터 있는) 슬롯인지 여부 */
    savefileValid: function(fileId) {
      return (typeof DataManager !== 'undefined') ? DataManager.isThisGameFile(fileId) : false;
    },
    /** 마지막으로 접근한 세이브 슬롯 ID (1~) */
    lastSavefileId: function() {
      return (typeof DataManager !== 'undefined' && DataManager.lastAccessedSavefileId())
        ? DataManager.lastAccessedSavefileId() : 1;
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
      var name = resolveTemplate(cmd.name);
      this.addCommand(name, cmd.symbol, isEnabled, cmd.ext !== undefined ? cmd.ext : null);
    }
  };

  Window_CustomCommand.prototype.itemHeight = function() {
    return this._winDef.rowHeight || this.lineHeight();
  };

  Window_CustomCommand.prototype.drawItem = function(index) {
    var cmd = this._winDef.commands && this._winDef.commands[index];
    var rect = this.itemRectForText(index);
    var rh   = this._winDef.rowHeight || this.lineHeight();
    var lh   = this.lineHeight();
    var hasSub = cmd && cmd.subText;
    // 세로 중앙 정렬: 서브텍스트 있으면 2줄, 없으면 1줄 (rect.y 미만 방지)
    var nameY = Math.max(rect.y, rect.y + Math.floor((rh - lh * (hasSub ? 2 : 1)) / 2));

    this.resetTextColor();
    if (cmd && cmd.textColor) this.changeTextColor(cmd.textColor);
    this.changePaintOpacity(this.isCommandEnabled(index));

    // cols 배열 모드 — 슬롯명/아이템명처럼 한 줄 다중 컬럼 렌더링
    if (cmd && cmd.cols && cmd.cols.length > 0) {
      var cx = rect.x;
      var colIw = Window_Base._iconWidth || 32;
      for (var ci = 0; ci < cmd.cols.length; ci++) {
        var col = cmd.cols[ci];
        this.resetTextColor();
        if (col.color !== undefined) this.changeTextColor(this.textColor(col.color));
        this.changePaintOpacity(this.isCommandEnabled(index));
        var textX = cx;
        if (col.iconIndex) {
          this.drawIcon(col.iconIndex, textX, nameY + Math.floor((lh - colIw) / 2));
          textX += colIw + 4;
        }
        this.drawTextEx(col.text || '', textX, nameY);
        if (col.width !== undefined) {
          cx += col.width;
        } else {
          break; // 마지막 컬럼: 남은 너비 사용 후 종료
        }
      }
      this.resetTextColor();
      return;
    }

    // 아이콘 렌더링
    var x = rect.x;
    var iconIdx = cmd && cmd.iconIndex;
    if (iconIdx) {
      var iw = Window_Base._iconWidth || 32;
      this.drawIcon(iconIdx, x, nameY + Math.floor((lh - iw) / 2));
      x += iw + 4;
    }

    // numberText (우측, 아이템 수량 등) — rightText와 달리 이름과 같은 줄에 표시
    var numStr = (cmd && cmd.numberText !== undefined && cmd.numberText !== null)
      ? String(cmd.numberText) : null;
    var nameWidth = rect.width - (x - rect.x);
    if (numStr !== null) {
      var numW = this.textWidth(numStr) + 16;
      this.drawText(numStr, rect.x, nameY, rect.width, 'right');
      nameWidth -= numW;
    }

    // 이름 (numberText 있으면 width 제한 drawText, 없으면 drawTextEx로 \C[N] 지원)
    if (numStr !== null) {
      this.drawText(this.commandName(index), x, nameY, nameWidth, 'left');
    } else {
      this.drawTextEx(this.commandName(index), x, nameY);
    }

    // 서브텍스트 (두 번째 줄, 회색)
    if (hasSub) {
      if (!cmd.textColor) this.changeTextColor(this.textColor(8));
      this.drawTextEx(cmd.subText, x, nameY + lh);
      this.resetTextColor();
    }

    // 우측 정렬 텍스트 (rightTextColorIndex 있으면 nameY에, 없으면 행 하단에)
    if (cmd && cmd.rightText) {
      this.resetTextColor();
      if (cmd.rightTextColorIndex !== undefined) {
        // 스킬 MP/TP 코스트 등 — 이름과 같은 줄에 색상 표시
        this.changeTextColor(this.textColor(cmd.rightTextColorIndex));
        this.changePaintOpacity(this.isCommandEnabled(index));
        this.drawText(cmd.rightText, rect.x, nameY, rect.width, 'right');
        this.resetTextColor();
      } else {
        // 기존 동작: 행 하단에 표시 (세이브/로드 플레이타임 등)
        this.changePaintOpacity(this.isCommandEnabled(index));
        this.drawText(cmd.rightText, rect.x, rect.y + rect.height - lh, rect.width, 'right');
      }
    }

    // 캐릭터 스프라이트 배열 [[charName, charIndex, x, y], ...]  (x,y는 rect 기준 상대좌표)
    if (cmd && cmd.characters && cmd.characters.length > 0) {
      this.changePaintOpacity(this.isCommandEnabled(index));
      for (var ci = 0; ci < cmd.characters.length; ci++) {
        var cd = cmd.characters[ci];
        if (cd && cd.length >= 4) {
          this.drawCharacter(cd[0], cd[1], rect.x + cd[2], rect.y + cd[3]);
        }
      }
    }

    // 임의 Bitmap 이미지 배열 [{ bitmapExpr, srcRect, x, y, w, h }, ...]  (x,y는 rect 기준 상대좌표)
    if (cmd && cmd.images && cmd.images.length > 0) {
      this.changePaintOpacity(this.isCommandEnabled(index));
      for (var ii = 0; ii < cmd.images.length; ii++) {
        var imgDef = cmd.images[ii];
        if (!imgDef || !imgDef.bitmapExpr) continue;
        var bitmap = null;
        try { bitmap = new Function('return (' + imgDef.bitmapExpr + ')')(); } catch(e) {}
        if (!bitmap || !bitmap.width) continue;
        var ix = rect.x + (imgDef.x || 0);
        var iy = rect.y + (imgDef.y || 0);
        var iw = imgDef.w !== undefined ? imgDef.w : bitmap.width;
        var ih = imgDef.h !== undefined ? imgDef.h : bitmap.height;
        if (imgDef.srcRect) {
          var sr = imgDef.srcRect;
          this.contents.blt(bitmap, sr.x, sr.y, sr.w, sr.h, ix, iy, iw, ih);
        } else {
          this.contents.blt(bitmap, 0, 0, bitmap.width, bitmap.height, ix, iy, iw, ih);
        }
      }
    }

    if (cmd && cmd.textColor) this.resetTextColor();
  };

  /** 현재 선택 항목의 data 필드 반환 (dataScript에서 {data: item} 형태로 설정한 원본 객체) */
  Window_CustomCommand.prototype.item = function() {
    var cmd = this._winDef.commands && this._winDef.commands[this.index()];
    return (cmd && cmd.data !== undefined) ? cmd.data : null;
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
  // Widget_Scene — 씬을 위젯으로 포함 (씬 안에 씬)
  //  sceneId:      UIScenes에 등록된 씬 ID
  //  instanceCtx:  씬 _ctx에 임시 주입할 키-값 오브젝트
  //  width/height: 씬 루트의 크기 (지정 시 루트 def를 오버라이드)
  //===========================================================================
  function Widget_Scene() {}
  Widget_Scene.prototype = Object.create(Widget_Base.prototype);
  Widget_Scene.prototype.constructor = Widget_Scene;

  Widget_Scene.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._instanceCtx = def.instanceCtx || {};
    this._sceneId = def.sceneId || '';
    this._subRoot = null;

    var container = new Sprite();
    container.x = this._x;
    container.y = this._y;
    this._displayObject = container;

    var subSceneDef = (_scenesData.scenes || _scenesData)[this._sceneId];
    if (!subSceneDef || !subSceneDef.root) return;

    // 루트 def 복제 후 위치/크기 오버라이드
    var rootDef = JSON.parse(JSON.stringify(subSceneDef.root));
    rootDef.x = 0;
    rootDef.y = 0;
    if (def.width  !== undefined) rootDef.width  = def.width;
    if (def.height !== undefined) rootDef.height = def.height;

    var self = this;
    this._withCtx(function() {
      var scene = SceneManager._scene;
      if (!scene || !scene._buildWidget) return;
      var root = scene._buildWidget(rootDef, null);
      if (!root) return;
      self._subRoot = root;
      var dobj = root.displayObject();
      if (dobj && !(dobj instanceof Window_Base)) {
        container.addChild(dobj);
      }
    });
  };

  // instanceCtx를 씬 _ctx에 임시 주입 (JS 단일 스레드이므로 동기 실행 시 안전)
  Widget_Scene.prototype._withCtx = function(fn) {
    var scene = SceneManager._scene;
    if (!scene || !scene._ctx) { fn(); return; }
    var ctx = scene._ctx;
    var ic = this._instanceCtx;
    var saved = {};
    Object.keys(ic).forEach(function(k) { saved[k] = ctx[k]; ctx[k] = ic[k]; });
    try { fn(); } finally {
      Object.keys(saved).forEach(function(k) { ctx[k] = saved[k]; });
    }
  };

  Widget_Scene.prototype.refresh = function() {
    if (!this._subRoot) return;
    var self = this;
    this._withCtx(function() { self._subRoot.refresh(); });
  };

  // Widget_Scene은 _children 대신 _subRoot를 통해 Window_Base 자손을 수집합니다.
  Widget_Scene.prototype._collectWindowDescendants = function(out) {
    if (!this._subRoot) return;
    if (this._subRoot.displayObject() instanceof Window_Base) out.push(this._subRoot);
    this._subRoot._collectWindowDescendants(out);
  };

  Widget_Scene.prototype.update = function() {
    this._syncWindowDescendants(); // container Sprite 이동 → 내부 Window_Base 자손 위치 동기화
    if (!this._subRoot) return;
    var self = this;
    this._withCtx(function() { self._subRoot.update(); });
  };

  Widget_Scene.prototype.findWidget = function(id) {
    if (this._id === id) return this;
    if (this._subRoot) return this._subRoot.findWidget(id);
    return null;
  };

  Widget_Scene.prototype.destroy = function() {
    if (this._subRoot) { this._subRoot.destroy(); this._subRoot = null; }
    Widget_Base.prototype.destroy.call(this);
  };

  window.Widget_Scene = Widget_Scene;

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
  //===========================================================================
  // WidgetAnimator — 위젯 등장/퇴장 애니메이션 공유 모듈
  //===========================================================================
  var WidgetAnimator = (function() {
    var _tasks = []; // [{obj, props, frame, duration, delay, easing, onComplete}, ...]

    function easeFunc(name, t) {
      t = Math.min(Math.max(t, 0), 1);
      switch (name) {
        case 'easeIn':    return t * t;
        case 'easeInOut': return t < 0.5 ? 2*t*t : 1-2*(1-t)*(1-t);
        case 'linear':    return t;
        case 'bounce': {
          if      (t < 1/2.75)  { return 7.5625*t*t; }
          else if (t < 2/2.75)  { t -= 1.5/2.75;  return 7.5625*t*t+0.75; }
          else if (t < 2.5/2.75){ t -= 2.25/2.75; return 7.5625*t*t+0.9375; }
          else                  { t -= 2.625/2.75; return 7.5625*t*t+0.984375; }
        }
        default: return 1-(1-t)*(1-t); // easeOut
      }
    }

    function applyTask(task, t) {
      var e = easeFunc(task.easing || 'easeOut', t);
      var obj = task.obj, p = task.props;
      if (p.x        !== undefined) obj.x        = p.x.from        + (p.x.to        - p.x.from)        * e;
      if (p.y        !== undefined) obj.y        = p.y.from        + (p.y.to        - p.y.from)        * e;
      if (p.opacity  !== undefined) obj.opacity  = Math.round(p.opacity.from  + (p.opacity.to  - p.opacity.from)  * e);
      if (p.scaleY   !== undefined && obj.scale)  obj.scale.y = p.scaleY.from  + (p.scaleY.to  - p.scaleY.from)  * e;
      if (p.scaleX   !== undefined && obj.scale)  obj.scale.x = p.scaleX.from  + (p.scaleX.to  - p.scaleX.from)  * e;
      if (p.rotation !== undefined) obj.rotation = p.rotation.from + (p.rotation.to - p.rotation.from) * e;
      if (p.openness !== undefined && obj.openness !== undefined) {
        obj.openness = Math.round(p.openness.from + (p.openness.to - p.openness.from) * e);
      }
    }

    /**
     * 단일 effect 정의 + displayObject + isEnter → props (없으면 null)
     * 신 형식(UIWindowEntranceEffect): fadeIn/fadeOut/slideTop/slideBottom 등
     * 구 형식(WidgetAnimDef): fade/slideUp/slideDown 등 — 하위 호환
     */
    function buildPropsForEffect(eff, obj, isEnter) {
      var type = (eff && eff.type) || 'none';
      if (type === 'none') return null;
      var origX  = obj.x  || 0;
      var origY  = obj.y  || 0;
      var origOp = (obj.opacity !== undefined) ? obj.opacity : 255;
      var w = obj.width  || 0;
      var h = obj.height || 0;
      var offset, fromScale, fromAngle;
      switch (type) {
        case 'fade': case 'fadeIn':
          return { opacity: isEnter ? {from:0,to:origOp} : {from:origOp,to:0} };
        case 'fadeOut':
          return { opacity: isEnter ? {from:origOp,to:0} : {from:0,to:origOp} };
        case 'slideDown': case 'slideBottom':
          offset = eff.offset !== undefined ? eff.offset : Math.max(h, 40);
          return {
            y:       isEnter ? {from:origY-offset,to:origY} : {from:origY,to:origY+offset},
            opacity: isEnter ? {from:0,to:origOp} : {from:origOp,to:0},
          };
        case 'slideUp': case 'slideTop':
          offset = eff.offset !== undefined ? eff.offset : Math.max(h, 40);
          return {
            y:       isEnter ? {from:origY+offset,to:origY} : {from:origY,to:origY-offset},
            opacity: isEnter ? {from:0,to:origOp} : {from:origOp,to:0},
          };
        case 'slideLeft':
          offset = eff.offset !== undefined ? eff.offset : Math.max(w, 40);
          return {
            x:       isEnter ? {from:origX+offset,to:origX} : {from:origX,to:origX-offset},
            opacity: isEnter ? {from:0,to:origOp} : {from:origOp,to:0},
          };
        case 'slideRight':
          offset = eff.offset !== undefined ? eff.offset : Math.max(w, 40);
          return {
            x:       isEnter ? {from:origX-offset,to:origX} : {from:origX,to:origX+offset},
            opacity: isEnter ? {from:0,to:origOp} : {from:origOp,to:0},
          };
        case 'openness':
          if (typeof obj.openness !== 'undefined') {
            return { openness: isEnter ? {from:0,to:255} : {from:255,to:0} };
          }
          return {
            scaleY: isEnter ? {from:0,to:1} : {from:1,to:0},
            y:      isEnter ? {from:origY+h/2,to:origY} : {from:origY,to:origY+h/2},
          };
        case 'zoom':
          fromScale = eff.fromScale !== undefined ? eff.fromScale : 0.5;
          return {
            scaleX:  isEnter ? {from:fromScale,to:1} : {from:1,to:fromScale},
            scaleY:  isEnter ? {from:fromScale,to:1} : {from:1,to:fromScale},
            opacity: isEnter ? {from:0,to:origOp} : {from:origOp,to:0},
          };
        case 'bounce':
          fromScale = eff.fromScale !== undefined ? eff.fromScale : 0;
          return {
            scaleX:  isEnter ? {from:fromScale,to:1} : {from:1,to:fromScale},
            scaleY:  isEnter ? {from:fromScale,to:1} : {from:1,to:fromScale},
            opacity: isEnter ? {from:0,to:origOp} : {from:origOp,to:0},
          };
        case 'rotate':
          fromAngle = eff.fromAngle !== undefined ? eff.fromAngle : 180;
          return {
            rotation: isEnter ? {from:fromAngle*Math.PI/180,to:0} : {from:0,to:fromAngle*Math.PI/180},
            opacity:  isEnter ? {from:0,to:origOp} : {from:origOp,to:0},
          };
        case 'rotateX':
          return {
            scaleY:  isEnter ? {from:0,to:1} : {from:1,to:0},
            opacity: isEnter ? {from:0,to:origOp} : {from:origOp,to:0},
          };
        case 'rotateY':
          return {
            scaleX:  isEnter ? {from:0,to:1} : {from:1,to:0},
            opacity: isEnter ? {from:0,to:origOp} : {from:origOp,to:0},
          };
        default:
          return null;
      }
    }

    return {
      /**
       * obj에 애니메이션을 재생합니다.
       * @param {Object}        obj        - displayObject (Sprite, Window_Base 등)
       * @param {Object|Array}  animDef    - UIWindowEntranceEffect[] (신 형식, ms 단위) 또는
       *                                    { type, duration?, delay?, offset? } (구 형식, 프레임 단위)
       * @param {boolean}       isEnter    - true: 등장, false: 퇴장
       * @param {Function|null} onComplete - 완료 콜백 (선택)
       */
      play: function(obj, animDef, isEnter, onComplete) {
        if (!obj) { if (onComplete) onComplete(); return; }
        this.clear(obj);
        var isNew = Array.isArray(animDef);
        var effects = isNew ? animDef : (animDef ? [animDef] : []);
        var valid = effects.filter(function(e) { return e && e.type && e.type !== 'none'; });
        if (valid.length === 0) { if (onComplete) onComplete(); return; }

        // onComplete는 가장 늦게 끝나는 task에 연결
        var maxEnd = -1, maxIdx = 0;
        for (var i = 0; i < valid.length; i++) {
          var dur0 = valid[i].duration !== undefined ? valid[i].duration : (isNew ? 300 : 15);
          var del0 = valid[i].delay || 0;
          if (dur0 + del0 > maxEnd) { maxEnd = dur0 + del0; maxIdx = i; }
        }

        for (var j = 0; j < valid.length; j++) {
          var eff = valid[j];
          var props = buildPropsForEffect(eff, obj, isEnter);
          if (!props) continue;
          var duration = eff.duration !== undefined ? eff.duration : (isNew ? 300 : 15);
          var frames   = isNew ? Math.max(1, Math.round(duration / 1000 * 60)) : Math.max(1, duration);
          var delay    = eff.delay || 0;
          var delayF   = isNew ? Math.max(0, Math.round(delay / 1000 * 60)) : Math.max(0, delay);
          var easing   = eff.easing || 'easeOut';
          if (j === 0 && delayF === 0) applyTask({obj:obj, props:props, easing:easing}, 0);
          _tasks.push({
            obj: obj, props: props,
            frame: 0, duration: frames, delay: delayF,
            easing: easing,
            onComplete: j === maxIdx ? (onComplete || null) : null,
          });
        }
      },
      /** 특정 obj의 진행 중인 애니메이션을 취소합니다. */
      clear: function(obj) {
        _tasks = _tasks.filter(function(t) { return t.obj !== obj; });
      },
      /** obj가 현재 애니메이션 중인지 반환합니다. */
      isActive: function(obj) {
        return _tasks.some(function(t) { return t.obj === obj; });
      },
      /** 매 프레임 호출 — 진행 중인 모든 애니메이션을 업데이트합니다. */
      update: function() {
        if (!_tasks.length) return;
        var done = [];
        for (var i = 0; i < _tasks.length; i++) {
          var task = _tasks[i];
          if (task.delay > 0) { task.delay--; continue; }
          task.frame++;
          applyTask(task, task.frame / task.duration);
          if (task.frame >= task.duration) done.push(i);
        }
        for (var j = done.length - 1; j >= 0; j--) {
          var cb = _tasks[done[j]].onComplete;
          _tasks.splice(done[j], 1);
          if (cb) cb();
        }
      },
    };
  })();
  window.WidgetAnimator = WidgetAnimator;

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
    // 방향키 네비게이션 타겟 파싱
    var nt = def.navUp || def.navDown || def.navLeft || def.navRight;
    this._navTargets = nt ? {
      up: def.navUp || null, down: def.navDown || null,
      left: def.navLeft || null, right: def.navRight || null,
    } : null;
    // 라이프사이클 스크립트 파싱
    var rawScripts = def.scripts;
    if (rawScripts) {
      var compiled = {};
      var keys = ['onCreate', 'onUpdate', 'onRefresh', 'onDestroy'];
      for (var si = 0; si < keys.length; si++) {
        var key = keys[si];
        var code = rawScripts[key];
        if (code && code.trim()) {
          try { compiled[key] = new Function('$ctx', code); }
          catch(e) { console.error('[Widget] script compile error "' + key + '" (' + (def.id||'') + '):', e); }
        }
      }
      this._scripts = Object.keys(compiled).length ? compiled : null;
    } else {
      this._scripts = null;
    }
  };
  Widget_Base.prototype.displayObject = function() { return this._displayObject; };
  Widget_Base.prototype._runScript = function(name) {
    if (!this._scripts || !this._scripts[name]) return;
    try {
      var scene = SceneManager._scene;
      var $ctx = scene ? (scene._ctx || {}) : {};
      this._scripts[name].call(scene, $ctx);
    } catch(e) {
      console.error('[Widget] script "' + name + '" error (' + this._id + '):', e);
    }
  };
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
  /**
   * 등장 애니메이션을 재생합니다.
   * @param {Object} [fallbackDef] - 위젯 def에 enterAnimation이 없을 때 사용할 animDef
   */
  Widget_Base.prototype.playEnterAnim = function(fallbackDef) {
    var animDef = (this._def && this._def.enterAnimation !== undefined)
      ? this._def.enterAnimation : fallbackDef;
    var isEmpty = !animDef || (Array.isArray(animDef) ? animDef.length === 0 : animDef.type === 'none');
    if (isEmpty) return;
    var obj = this.displayObject();
    if (!obj) return;
    WidgetAnimator.play(obj, animDef, true, null);
    // Window_Base 자손들은 PIXI 계층 밖이므로 opacity/position이 자동 전파되지 않음 → 직접 적용
    var wins = [];
    this._collectWindowDescendants(wins);
    for (var i = 0; i < wins.length; i++) {
      var wo = wins[i].displayObject();
      if (wo && !WidgetAnimator.isActive(wo)) WidgetAnimator.play(wo, animDef, true, null);
    }
  };

  /**
   * 퇴장 애니메이션을 재생합니다.
   * @param {Object}   [fallbackDef] - 위젯 def에 exitAnimation이 없을 때 사용할 animDef
   * @param {Function} [onComplete]  - 애니메이션 완료 콜백
   * @returns {boolean} 애니메이션이 시작되었으면 true (false면 즉시 완료)
   */
  Widget_Base.prototype.playExitAnim = function(fallbackDef, onComplete) {
    var animDef = (this._def && this._def.exitAnimation !== undefined)
      ? this._def.exitAnimation : fallbackDef;
    var isEmpty = !animDef || (Array.isArray(animDef) ? animDef.length === 0 : animDef.type === 'none');
    if (isEmpty) {
      if (onComplete) onComplete();
      return false;
    }
    var obj = this.displayObject();
    if (!obj) { if (onComplete) onComplete(); return false; }
    WidgetAnimator.play(obj, animDef, false, onComplete);
    // Window_Base 자손들에게도 퇴장 애니메이션 적용 (씬 전환 콜백은 첫 obj에 연결됨)
    var wins = [];
    this._collectWindowDescendants(wins);
    for (var i = 0; i < wins.length; i++) {
      var wo = wins[i].displayObject();
      if (wo && !WidgetAnimator.isActive(wo)) WidgetAnimator.play(wo, animDef, false, null);
    }
    return true;
  };

  /**
   * displayObject(x/y)가 변경됐을 때 그 델타를 Window_Base 자손 위젯에 전파합니다.
   * addWindow로 씬에 직접 추가된 Window_Base는 PIXI 계층 밖이라 부모 이동을 자동으로
   * 따르지 않으므로, 매 프레임 delta를 계산해 절대좌표를 보정합니다.
   */
  Widget_Base.prototype._collectWindowDescendants = function(out) {
    for (var i = 0; i < this._children.length; i++) {
      var child = this._children[i];
      if (child.displayObject() instanceof Window_Base) out.push(child);
      child._collectWindowDescendants(out);
    }
  };

  Widget_Base.prototype._syncWindowDescendants = function() {
    var obj = this._displayObject;
    if (!obj) return;
    var cx = obj.x, cy = obj.y;
    if (this._prevDispX === undefined) {
      this._prevDispX = cx; this._prevDispY = cy; return;
    }
    var dx = cx - this._prevDispX, dy = cy - this._prevDispY;
    if (dx === 0 && dy === 0) return;
    this._prevDispX = cx; this._prevDispY = cy;
    var wins = [];
    this._collectWindowDescendants(wins);
    for (var i = 0; i < wins.length; i++) {
      var wo = wins[i].displayObject();
      wo.x += dx; wo.y += dy;
      if (wins[i]._decoSprite) { wins[i]._decoSprite.x += dx; wins[i]._decoSprite.y += dy; }
    }
  };

  Widget_Base.prototype.update = function() {
    this._syncWindowDescendants();
    if (this._scripts) this._runScript('onUpdate');
    for (var i = 0; i < this._children.length; i++) {
      this._children[i].update();
    }
  };
  Widget_Base.prototype.refresh = function() {
    if (this._scripts) this._runScript('onRefresh');
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
    // 명시적으로 focusable=true 설정된 비인터랙티브 위젯 지원
    if (this._def && this._def.focusable === true) out.push(this);
    for (var i = 0; i < this._children.length; i++) {
      this._children[i].collectFocusable(out);
    }
  };
  // 기본 activate/deactivate — 인터랙티브 위젯이 override. 비인터랙티브 위젯이 focusable=true일 때 crash 방지
  Widget_Base.prototype.activate = function() {};
  Widget_Base.prototype.deactivate = function() {};
  Widget_Base.prototype.destroy = function() {
    if (this._scripts) this._runScript('onDestroy');
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
        if (child._rowOverlay) { child._rowOverlay.x += this._x; child._rowOverlay.y += this._y; }
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
    this._useTextEx = def.useTextEx === true;
    if (this._useTextEx) {
      // Window_Base 기반: drawTextEx로 \c[N] 색상 코드 지원
      var win = new Window_Base(this._x, this._y, this._width, this._height);
      win._padding = 0;
      win.opacity = 0;
      win.backOpacity = 0;
      win.createContents();
      if (def.fontSize) win.contents.fontSize = def.fontSize;
      this._win = win;
      this._displayObject = win;
    } else {
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
    }
    this.refresh();
  };
  Widget_Label.prototype.refresh = function() {
    if (this._useTextEx) {
      if (!this._win) return;
      var text = resolveTemplate(this._template);
      if (text === this._lastText) return;
      this._lastText = text;
      this._win.contents.clear();
      var lh = this._win.lineHeight();
      var ty = (this._vAlign === 'top') ? 0 :
               (this._vAlign === 'bottom') ? Math.max(0, this._height - lh) :
               Math.floor((this._height - lh) / 2);
      this._win.drawTextEx(text, 0, ty);
      Widget_Base.prototype.refresh.call(this);
      return;
    }
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
    this._iconIndexExpr  = def.iconIndexExpr  || null;
    this._bitmapExpr     = def.bitmapExpr     || null;
    this._srcRectExpr = def.srcRectExpr || null;
    this._fitMode     = def.fitMode     || 'stretch';
    this._lastBitmap  = null;
    var sprite = new Sprite();
    sprite.x = this._x;
    sprite.y = this._y;
    if (def.bgAlpha !== undefined) sprite.opacity = Math.round(def.bgAlpha * 255);
    // 하위호환 타입 (actorFace/actorCharacter): 빈 bitmap 미리 할당
    if (!this._bitmapExpr && this._imageSource !== 'file' && this._imageSource !== 'icon') {
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
        case 'icon':           this._refreshIcon(sprite);           break;
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

  // icon 모드: IconSet에서 아이콘 1개를 렌더링
  Widget_Image.prototype._refreshIcon = function(sprite) {
    var iconIdx = 0;
    if (this._iconIndexExpr) {
      try {
        var $ctx = (SceneManager._scene && SceneManager._scene._ctx) || {};
        iconIdx = Number(new Function('$ctx', 'return (' + this._iconIndexExpr + ')')($ctx)) || 0;
      } catch(e) {}
    }
    if (iconIdx === this._lastIconIdx && sprite.bitmap) return;
    this._lastIconIdx = iconIdx;
    var iconSet = ImageManager.loadSystem('IconSet');
    var w = this._width  || 32;
    var h = this._height || 32;
    var self = this;
    iconSet.addLoadListener(function() {
      var pw = (typeof Window_Base !== 'undefined' && Window_Base._iconWidth)  || 32;
      var ph = (typeof Window_Base !== 'undefined' && Window_Base._iconHeight) || 32;
      var cols = Math.floor(iconSet.width / pw);
      var sx = (iconIdx % cols) * pw;
      var sy = Math.floor(iconIdx / cols) * ph;
      if (!self._bitmap || self._bitmap.width !== w || self._bitmap.height !== h) {
        self._bitmap = new Bitmap(w, h);
        sprite.bitmap = self._bitmap;
      }
      self._bitmap.clear();
      self._bitmap.blt(iconSet, sx, sy, pw, ph, 0, 0, w, h);
    });
  };

  Widget_Image.prototype.update = function() {
    if (this._updateCount === undefined) this._updateCount = 0;
    ++this._updateCount;
    var needRefresh = this._bitmapExpr
      ? (this._updateCount % 10 === 0)   // expr 모드: 10프레임마다 체크 (빠른 반응)
      : (this._iconIndexExpr             // icon 모드: 10프레임마다 (아이콘 변경 반응)
          ? (this._updateCount % 10 === 0)
          : (this._actorIndexExpr        // actorIndexExpr: 30프레임마다 (actor 전환 반응)
              ? (this._updateCount % 30 === 0)
              : (this._imageSource !== 'file' && this._updateCount % 60 === 0)));
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
    // children이 있으면 자식 label 위젯이 텍스트를 담당 → 내장 렌더링 비활성
    var hasChildren = def.children && def.children.length > 0;
    this._showLabel = !hasChildren && def.showLabel !== false;
    this._showValue = !hasChildren && def.showValue !== false;
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
    if (def.bgAlpha !== undefined) sprite.opacity = Math.round(def.bgAlpha * 255);
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
  // Widget_ShopNumber — 상점 수량 입력 위젯 (Window_ShopNumber 래퍼, focusable)
  //===========================================================================
  function Widget_ShopNumber() {}
  Widget_ShopNumber.prototype = Object.create(Widget_Base.prototype);
  Widget_ShopNumber.prototype.constructor = Widget_ShopNumber;
  Widget_ShopNumber.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._handlersDef = def.handlers || {};
    var h = def.height || 400;
    var win = new Window_ShopNumber(this._x, this._y, h);
    win._customClassName = 'Widget_CS_' + this._id;
    win.deactivate();
    this._applyWindowStyle(win, def);
    this._window = win;
    this._displayObject = win;
  };
  Widget_ShopNumber.prototype.collectFocusable = function(out) {
    out.push(this);
  };
  Widget_ShopNumber.prototype.activate = function() {
    if (this._window) this._window.activate();
  };
  Widget_ShopNumber.prototype.deactivate = function() {
    if (this._window) this._window.deactivate();
  };
  Widget_ShopNumber.prototype.setup = function(item, max, price) {
    if (!this._window) return;
    this._window.setup(item, Math.max(1, Math.floor(max)), price);
    if (typeof TextManager !== 'undefined') {
      this._window.setCurrencyUnit(TextManager.currencyUnit);
    }
  };
  Widget_ShopNumber.prototype.number = function() {
    return this._window ? this._window.number() : 0;
  };
  Widget_ShopNumber.prototype.setHandler = function(symbol, fn) {
    if (this._window) this._window.setHandler(symbol, fn);
  };
  Widget_ShopNumber.prototype.setCancelHandler = function(fn) {
    if (this._window) this._window.setHandler('cancel', fn);
  };
  window.Widget_ShopNumber = Widget_ShopNumber;

  //===========================================================================
  // Widget_TextList — Window_CustomCommand 기반 텍스트 커맨드 리스트 (focusable)
  //   itemScene 없는 순수 텍스트/아이콘 텍스트 메뉴. sugar syntax.
  //   Widget_List를 상속.
  //===========================================================================
  function Widget_TextList() {}
  Widget_TextList.prototype = Object.create(Widget_Base.prototype);
  Widget_TextList.prototype.constructor = Widget_TextList;
  Widget_TextList.prototype.initialize = function(def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._items = def.items || def.commands || [];
    this._handlersDef = def.handlers || {};
    this._dataScript = def.dataScript || null;
    this._onCursorDef = def.onCursor || null;
    this._autoHeight = def.autoHeight || false;
    this._autoRefresh = (def.autoRefresh !== false); // false로 명시하면 6프레임 자동 rebuild 비활성화
    this._focusable = (def.focusable !== false); // false로 명시하면 NavigationManager 포커스 제외
    this._itemSceneId = def.itemScene || null;  // itemScene 모드
    this._rowWidgets = [];  // itemScene 모드 행 Widget_Scene 목록
    this._rowOverlay = null; // itemScene 모드 오버레이 컨테이너 Sprite
    var listDef = {
      id: def.id, width: def.width,
      commands: this._items,
      maxCols: def.maxCols || 1,
      rowHeight: def.rowHeight || 0,
    };
    if (def.height) listDef.height = def.height;
    var win = new Window_CustomCommand(this._x, this._y, listDef);
    win._customClassName = 'Widget_CS_' + this._id;
    // itemScene 모드: 윈도우 배경/프레임 숨김, 텍스트 렌더링 비활성 (커서/스크롤만 활용)
    if (this._itemSceneId) {
      win.setBackgroundType(2);
      win.drawItem = function() {}; // 스프라이트 오버레이가 그리므로 window 텍스트 렌더링 스킵
    }
    win.deactivate();
    win.deselect(); // Window_Command.initialize가 select(0)을 호출하므로 명시적으로 해제
    if (this._autoHeight) {
      if (this._dataScript) {
        win.height = 0; // dataScript 결과가 나오기 전 빈 윈도우 flash 방지
      } else {
        // 정적 items인 경우 초기화 즉시 높이 계산
        var itemCount = this._items.length;
        win.height = itemCount > 0 ? win.fittingHeight(itemCount) : 0;
      }
    }
    if (!this._focusable) {
      // updateCursor: RPG Maker MV 레벨 커서 rect 0으로 설정
      win.updateCursor = function() { this.setCursorRect(0, 0, 0, 0); };
      // _updateCursor: rpg_core.js 저수준 — 매 프레임 _windowCursorSprite.visible = isOpen() 강제 설정하므로 반드시 override
      win._updateCursor = function() { if (this._windowCursorSprite) this._windowCursorSprite.visible = false; };
      console.log('[CSE] Widget_List focusable=false, updateCursor override, id=' + def.id);
    }
    if (!this._itemSceneId) {
      // itemScene 모드가 아닐 때만 UITheme 윈도우 스타일 적용
      this._applyWindowStyle(win, def);
      if (def.windowed !== false && def.bgAlpha !== undefined) win.opacity = Math.round(def.bgAlpha * 255);
    }
    this._window = win;
    this._displayObject = win;
    this._createDecoSprite(def, this._width, def.height || 400);
    // onCursor — 커서 이동 시 코드 실행
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
    // itemScene 모드: 오버레이 Sprite 생성
    if (this._itemSceneId) {
      var overlay = new Sprite();
      overlay.x = this._x + (win._padding || win.standardPadding());
      overlay.y = this._y + (win._padding || win.standardPadding());
      this._rowOverlay = overlay;
    }
  };
  Widget_TextList.prototype._rebuildFromScript = function() {
    if (!this._dataScript || !this._window) return;
    try {
      var items = (new Function('return (' + this._dataScript + ')'))();
      if (!Array.isArray(items)) items = [];
      this._window._winDef.commands = items;
      if (this._autoHeight) {
        this._window.height = items.length > 0 ? this._window.fittingHeight(items.length) : 0;
      }
      if (this._window.refresh) this._window.refresh();
      // itemScene 모드: 행 Sprite 재구성
      if (this._itemSceneId) this._rebuildRows();
      // 빈 목록이거나 비활성이면 커서 숨김
      if (items.length === 0 || !this._window.active) {
        // deselect() = select(-1) → callUpdateHelp() 발화로 onCursor 코드가 실행되어
        // 다른 위젯의 상태(FJ._curClassId 등)를 리셋하는 부작용을 방지하기 위해
        // 비활성 창은 callUpdateHelp 없이 직접 _index를 -1로 설정
        if (!this._window.active) {
          this._window._index = -1;
          this._window.updateCursor();
        } else {
          this._window.deselect();
        }
        // height=0일 때 커서 스프라이트가 창 밖으로 삐져나오는 문제 방지
        if (this._window._windowCursorSprite) this._window._windowCursorSprite.visible = false;
      }
    } catch(e) {
      console.error('[Widget_List] dataScript error:', e);
    }
  };

  /**
   * itemScene 모드: 현재 commands를 기반으로 행 Widget_Scene을 재생성.
   * 각 행 씬의 _ctx에는 rowData(행 객체)의 모든 키를 flat하게 주입한다.
   */
  Widget_TextList.prototype._rebuildRows = function() {
    if (!this._itemSceneId || !this._rowOverlay) return;
    var scene = SceneManager._scene;
    if (!scene || !scene._buildWidget) return;
    var subSceneDef = (_scenesData.scenes || {})[this._itemSceneId];
    if (!subSceneDef || !subSceneDef.root) return;

    // 기존 행 위젯 destroy
    for (var di = 0; di < this._rowWidgets.length; di++) {
      if (this._rowWidgets[di]) this._rowWidgets[di].destroy();
    }
    this._rowWidgets = [];
    // 오버레이의 기존 자식 제거
    while (this._rowOverlay.children.length > 0) {
      this._rowOverlay.removeChildAt(0);
    }

    var win = this._window;
    var commands = (win._winDef && win._winDef.commands) || [];
    var itemW = win.itemWidth ? win.itemWidth() : (this._width - (win._padding || win.standardPadding()) * 2);
    var itemH = win.itemHeight ? win.itemHeight() : win.lineHeight();

    for (var i = 0; i < commands.length; i++) {
      var rowData = commands[i] || {};
      // instanceCtx: rowData의 모든 key를 flat하게 주입 ($ctx.name, $ctx.iconIndex 등으로 접근)
      var instanceCtx = {};
      for (var k in rowData) {
        if (Object.prototype.hasOwnProperty.call(rowData, k)) instanceCtx[k] = rowData[k];
      }

      // 행 씬 루트 def 복제 후 width/height 동적 설정
      var rootDef = JSON.parse(JSON.stringify(subSceneDef.root));
      rootDef.x = 0;
      rootDef.y = 0;
      rootDef.width = itemW;
      rootDef.height = itemH;
      // fillWidth: true인 자식의 width를 itemW로 설정
      (function patchFillWidth(node, w) {
        var children = node.children || [];
        for (var ci = 0; ci < children.length; ci++) {
          if (children[ci].fillWidth) children[ci].width = w;
          patchFillWidth(children[ci], w);
        }
      })(rootDef, itemW);

      // Widget_Scene 방식으로 행 위젯 생성
      var rowWidget = {
        _subRoot: null,
        _instanceCtx: instanceCtx,
        _scene: scene,
        destroy: function() { if (this._subRoot) { this._subRoot.destroy(); this._subRoot = null; } },
        _withCtx: function(fn) {
          var c = this._scene && this._scene._ctx;
          if (!c) { fn(); return; }
          var ic = this._instanceCtx;
          var sv = {};
          Object.keys(ic).forEach(function(key) { sv[key] = c[key]; c[key] = ic[key]; });
          try { fn(); } finally { Object.keys(sv).forEach(function(key) { c[key] = sv[key]; }); }
        }
      };
      var rowContainer = new Sprite();
      rowWidget._container = rowContainer;

      // _ctx에 instanceCtx 주입한 상태로 위젯 빌드
      rowWidget._withCtx(function() {
        var built = scene._buildWidget(rootDef, null);
        if (built) {
          rowWidget._subRoot = built;
          var dobj = built.displayObject();
          if (dobj && !(dobj instanceof Window_Base)) {
            rowContainer.addChild(dobj);
          }
        }
      });

      // 행 위치: padding은 오버레이 자체가 offset하므로 itemRect 기준 (padding 미포함)
      var rect = win.itemRect(i);
      rowContainer.x = rect.x;
      rowContainer.y = rect.y;
      // disabled 표시
      rowContainer.opacity = (rowData.enabled === false) ? 160 : 255;

      this._rowOverlay.addChild(rowContainer);
      this._rowWidgets.push(rowWidget);
    }
  };

  /** itemScene 모드: 스크롤에 따라 행 Sprite y 위치를 갱신 */
  Widget_TextList.prototype._updateRowPositions = function() {
    if (!this._rowWidgets.length || !this._window) return;
    var win = this._window;
    var commands = (win._winDef && win._winDef.commands) || [];
    for (var i = 0; i < this._rowWidgets.length; i++) {
      var rw = this._rowWidgets[i];
      if (!rw || !rw._container) continue;
      var rect = win.itemRect(i);
      rw._container.x = rect.x;
      rw._container.y = rect.y;
      // enabled 상태도 반영
      var rowData = commands[i] || {};
      rw._container.opacity = (rowData.enabled === false) ? 160 : 255;
    }
  };
  Widget_TextList.prototype.collectFocusable = function(out) {
    if (this._focusable !== false) out.push(this);
  };
  Widget_TextList.prototype.activate = function() {
    if (this._dataScript) this._rebuildFromScript();
    if (this._window) {
      this._window.activate();
      var maxItems = this._window.maxItems();
      if (maxItems > 0) {
        var restore = (this._lastIndex !== undefined && this._lastIndex >= 0 && this._lastIndex < maxItems)
          ? this._lastIndex : 0;
        // 첫 활성화 시 initialIndexExpr 평가하여 초기 선택 위치 설정
        if (!this._hasActivated && this._def && this._def.initialIndexExpr) {
          try {
            var initIdx = Number(new Function('return (' + this._def.initialIndexExpr + ')')());
            if (!isNaN(initIdx) && initIdx >= 0 && initIdx < maxItems) restore = initIdx;
          } catch(e) {}
        }
        this._hasActivated = true;
        this._window.select(restore);
      } else {
        this._window.deselect();
      }
    }
  };
  Widget_TextList.prototype.deactivate = function() {
    if (this._window) {
      this._lastIndex = this._window.index();
      this._window.deactivate();
      this._window.deselect();
    }
  };
  Widget_TextList.prototype.refresh = function() {
    if (this._dataScript) this._rebuildFromScript();
    else if (this._itemSceneId) this._rebuildRows();
    Widget_Base.prototype.refresh.call(this);
  };
  Widget_TextList.prototype.setHandler = function(symbol, fn) {
    if (this._window) this._window.setHandler(symbol, fn);
  };
  Widget_TextList.prototype.setCancelHandler = function(fn) {
    if (this._window) this._window.setHandler('cancel', fn);
  };
  Widget_TextList.prototype.update = function() {
    if (this._updateCount === undefined) this._updateCount = 0;
    ++this._updateCount;
    if (this._dataScript && this._autoRefresh !== false) {
      if (this._updateCount % 6 === 0) this._rebuildFromScript();
    } else if (!this._dataScript) {
      var items = this._items;
      var hasCondition = items && items.some(function(item) {
        return typeof item.enabledCondition === 'string' && item.enabledCondition;
      });
      if (hasCondition && this._updateCount % 60 === 0) {
        if (this._window) this._window.refresh();
      }
    }
    // itemScene 모드: 매 프레임 행 위치 갱신 (스크롤 반영)
    if (this._itemSceneId && this._rowWidgets.length > 0) {
      this._updateRowPositions();
      // 행 위젯들의 update 호출 (라벨 텍스트 갱신 등) — rowData ctx 주입 상태에서 실행
      for (var ri = 0; ri < this._rowWidgets.length; ri++) {
        (function(rw) {
          if (!rw || !rw._subRoot) return;
          rw._withCtx(function() { rw._subRoot.update(); });
        })(this._rowWidgets[ri]);
      }
    }
    Widget_Base.prototype.update.call(this);
  };
  Widget_TextList.prototype.handlesUpDown = function() { return true; };
  Widget_TextList.prototype.destroy = function() {
    if (this._itemSceneId) {
      for (var di = 0; di < this._rowWidgets.length; di++) {
        if (this._rowWidgets[di]) this._rowWidgets[di].destroy();
      }
      this._rowWidgets = [];
    }
    Widget_Base.prototype.destroy.call(this);
  };
  window.Widget_TextList = Widget_TextList;

  //===========================================================================
  // Widget_List — Sprite 기반 씬 렌더링 리스트 (itemScene 사용, focusable)
  //   Widget_TextList를 상속. itemScene 없이 사용하면 Widget_TextList와 동일 동작.
  //===========================================================================
  function Widget_List() {}
  Widget_List.prototype = Object.create(Widget_TextList.prototype);
  Widget_List.prototype.constructor = Widget_List;

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
    this._pendingNavDir = null;
    this._navPrevDir = null;
    this._navRepeatTimer = 0;
    // keydown 직접 감지 — Input.isPressed 실패 대비
    var self = this;
    var keyDirMap = { 38:'up', 40:'down', 37:'left', 39:'right',
                      87:'up', 83:'down', 65:'left', 68:'right' };
    this._keydownHandler = function(e) {
      var dir = keyDirMap[e.keyCode];
      if (dir) { self._pendingNavDir = dir; }
    };
    document.addEventListener('keydown', this._keydownHandler);
  };
  NavigationManager.prototype.dispose = function() {
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
      this._keydownHandler = null;
    }
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
      this._focusables[this._activeIndex]._runScript('onBlur');
    }
    this._activeIndex = idx;
    this._focusables[idx].activate();
    this._focusables[idx]._runScript('onFocus');
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
    if (this._focusables.length === 0) return;
    var activeWidget = this._activeIndex >= 0 ? this._focusables[this._activeIndex] : null;

    // ── 방향키 명시적 네비게이션 (navUp/navDown/navLeft/navRight) ──
    // Input.isPressed 기반 자체 repeat: isRepeated의 pressedTime 타이밍 문제를 우회
    var DIRS = ['up', 'down', 'left', 'right'];
    var dirPressed = null;
    for (var di = 0; di < DIRS.length; di++) {
      if (Input.isPressed(DIRS[di])) { dirPressed = DIRS[di]; break; }
    }
    // _pendingNavDir: keydown 이벤트로 즉시 감지한 방향 (isPressed 실패 대비)
    if (!dirPressed && this._pendingNavDir) {
      dirPressed = this._pendingNavDir;
    }
    this._pendingNavDir = null;

    var doMove = false;
    if (dirPressed) {
      if (this._navPrevDir !== dirPressed) {
        this._navPrevDir = dirPressed;
        this._navRepeatTimer = 0;
        doMove = true;
      } else {
        this._navRepeatTimer++;
        var wait = Input.keyRepeatWait || 24;
        var interval = Input.keyRepeatInterval || 6;
        if (this._navRepeatTimer >= wait && (this._navRepeatTimer - wait) % interval === 0) {
          doMove = true;
        }
      }
    } else {
      this._navPrevDir = null;
      this._navRepeatTimer = 0;
    }

    if (doMove && activeWidget && activeWidget._def) {
      var def = activeWidget._def;
      var navTarget = null;
      if      (dirPressed === 'up')    navTarget = def.navUp    || null;
      else if (dirPressed === 'down')  navTarget = def.navDown  || null;
      else if (dirPressed === 'left')  navTarget = def.navLeft  || null;
      else if (dirPressed === 'right') navTarget = def.navRight || null;
      if (navTarget) {
        if (typeof SoundManager !== 'undefined') SoundManager.playCursor();
        this.focusWidget(navTarget);
        return;
      }
    }

    if (this._focusables.length <= 1) return;
    if (this._upDownNavigation) {
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
    if (!sceneDef) { console.warn('[CSE] sceneDef not found for:', this._sceneId); return; }

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

    // itemScene 모드 Widget_List의 _rowOverlay를 windowLayer 위에 addChild
    for (var id3 in this._widgetMap) {
      var w3 = this._widgetMap[id3];
      if (w3 instanceof Widget_List && w3._rowOverlay) {
        this.addChild(w3._rowOverlay);
        // 초기 행 생성 (dataScript가 있으면 _rebuildFromScript에서 처리)
        if (!w3._dataScript) w3._rebuildRows();
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

    // onCreate 스크립트 실행 (위젯 트리 구축 + 핸들러 설정 완료 후)
    for (var oid in this._widgetMap) {
      this._widgetMap[oid]._runScript('onCreate');
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
        case 'textList':    widget = new Widget_TextList();    break;
        case 'rowSelector':
        case 'actorList':   widget = new Widget_RowSelector(); break;
        case 'scene':       widget = new Widget_Scene();       break;
        case 'options':     widget = new Widget_Options();     break;
        case 'background':  widget = new Widget_Background();  break;
        case 'shopNumber':  widget = new Widget_ShopNumber();  break;
        default:            return null;
      }
    }
    widget.initialize(def, parentWidget);

    // visible: false 처리 — 초기 숨김 위젯
    if (def.visible === false) {
      var dObj = widget.displayObject();
      if (dObj) dObj.visible = false;
    }

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
      if (widget instanceof Widget_TextList) {
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
      } else if (widget instanceof Widget_ShopNumber) {
        var snHandlers = widget._handlersDef || {};
        (function(w, handlers) {
          if (handlers['ok']) {
            w.setHandler('ok', function() { self._executeWidgetHandler(handlers['ok'], w); });
          }
          var cancelH = handlers['cancel'] || { action: 'cancel' };
          w.setCancelHandler(function() { self._executeWidgetHandler(cancelH, w); });
        })(widget, snHandlers);
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
            var $ctx = this._ctx;
            var fn = new Function('$ctx', handler.code);
            fn.call(this, $ctx);
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
      case 'useItem': {
        // itemExpr/userExpr 기반 (스킬 씬 등) — 선결 처리
        if (handler.itemExpr) {
          var useSkill = null, useUser = null;
          try { useSkill = new Function('$ctx', 'return (' + handler.itemExpr + ')')(this._ctx); } catch(e) {}
          try { useUser  = new Function('$ctx', 'return (' + handler.userExpr  + ')')(this._ctx); } catch(e) {}
          if (!useSkill || !useUser) { if (widget && widget.activate) widget.activate(); break; }
          if (!useUser.canUse(useSkill)) {
            if (typeof SoundManager !== 'undefined') SoundManager.playBuzzer();
            if (widget && widget.activate) widget.activate();
            break;
          }
          if (handler.setLastSkill && typeof useUser.setLastMenuSkill === 'function') {
            useUser.setLastMenuSkill(useSkill);
          }
          var skillAction = new Game_Action(useUser);
          skillAction.setItemObject(useSkill);
          if (skillAction.isForFriend() && handler.actorWidget) {
            // 아군 대상 → 파티원 선택
            this._ctx._pendingUseItem = useSkill;
            this._ctx._pendingUseItemUser = useUser;
            this._pendingPersonalAction = { action: 'applyItemToActor', itemListWidget: null };
            this._personalOriginWidget = widget;
            // skill_list 숨기기 + actor_select/actor_panels 표시를 위한 상태 저장
            this._pendingItemListWidgetId = widget ? widget._id : null;
            this._pendingActorWidgetId = handler.actorWidget || null;
            if (widget && widget.displayObject()) widget.displayObject().visible = false;
            if (widget && widget._rowOverlay) widget._rowOverlay.visible = false;
            // actorPanelsWidget 표시 (menu_v2 party_panel 패턴)
            if (handler.actorPanelsWidget) {
              this._pendingActorPanelsWidgetId = handler.actorPanelsWidget;
              var apwShowNew = this._widgetMap[handler.actorPanelsWidget];
              if (apwShowNew && apwShowNew.displayObject()) apwShowNew.displayObject().visible = true;
            }
            var sawUI = this._widgetMap[handler.actorWidget];
            if (sawUI) {
              if (sawUI.displayObject()) sawUI.displayObject().visible = true;
              sawUI.setFormationMode(false);
              if (this._navManager) this._navManager.focusWidget(handler.actorWidget);
            }
          } else {
            // 즉시 사용 (전체/자신/비대상)
            if (typeof SoundManager !== 'undefined') {
              DataManager.isSkill(useSkill) ? SoundManager.playUseSkill() : SoundManager.playUseItem();
            }
            useUser.useItem(useSkill);
            var sa2 = new Game_Action(useUser);
            sa2.setItemObject(useSkill);
            var sa2Targets = sa2.isForAll() ? $gameParty.members() : [useUser];
            sa2Targets.forEach(function(t) { sa2.apply(t); });
            sa2.applyGlobal();
            if (typeof $gameTemp !== 'undefined' && $gameTemp.isCommonEventReserved()) {
              SceneManager.goto(Scene_Map);
            } else {
              if (this._rootWidget) this._rootWidget.refresh();
              if (widget && widget.activate) widget.activate();
            }
          }
          break;
        }
        // 기존 방식 (itemListWidget)
        var ilId = handler.itemListWidget;
        var ilWidget = this._widgetMap && this._widgetMap[ilId];
        if (!ilWidget || !ilWidget._window) break;
        var useItem = ilWidget._window.item();
        if (!useItem) break;
        if (!$gameParty.canUse(useItem)) {
          if (typeof SoundManager !== 'undefined') SoundManager.playBuzzer();
          if (ilWidget.activate) ilWidget.activate();
          break;
        }
        $gameParty.setLastItem(useItem);
        var useAction = new Game_Action($gameParty.leader());
        useAction.setItemObject(useItem);
        if (useAction.isForFriend() && handler.actorWidget) {
          // 아군 대상 → 파티원 선택
          this._ctx._pendingUseItem = useItem;
          this._pendingPersonalAction = { action: 'applyItemToActor', itemListWidget: ilId, actorPanelsWidget: handler.actorPanelsWidget };
          this._personalOriginWidget = ilWidget;
          // itemListWidget 숨기기 (아군 대상 선택 중에는 목록 비표시)
          if (ilWidget.displayObject()) ilWidget.displayObject().visible = false;
          if (ilWidget._rowOverlay) ilWidget._rowOverlay.visible = false;
          this._pendingItemListWidgetId = ilId;
          // actorPanelsWidget 표시
          if (handler.actorPanelsWidget) {
            this._pendingActorPanelsWidgetId = handler.actorPanelsWidget;
            var apwShow = this._widgetMap[handler.actorPanelsWidget];
            if (apwShow && apwShow.displayObject()) apwShow.displayObject().visible = true;
          }
          this._pendingActorWidgetId = handler.actorWidget || null;
          var awUI = this._widgetMap[handler.actorWidget];
          if (awUI) {
            // 윈도우 표시 (이전에 숨겼을 수 있으므로 명시적으로 복원)
            if (awUI.displayObject()) awUI.displayObject().visible = true;
            awUI.setFormationMode(false);
            if (this._navManager) this._navManager.focusWidget(handler.actorWidget);
          }
        } else {
          // 즉시 사용 (전체/자신/비대상)
          this._applyItemToAll(useItem);
          if (this._rootWidget) this._rootWidget.refresh();
          if (ilWidget.activate) ilWidget.activate();
        }
        break;
      }
      case 'applyItemToActor': {
        // _onRowSelectorOk → _pendingPersonalAction 으로 호출됨
        var pendingItem = this._ctx._pendingUseItem;
        if (!pendingItem) break;
        var pendingUser = this._ctx._pendingUseItemUser || null;
        var targetActor = typeof $gameParty !== 'undefined' && $gameParty.menuActor
          ? $gameParty.menuActor() : null;
        if (!targetActor) break;
        this._applyItemTo(pendingItem, targetActor, pendingUser);
        delete this._ctx._pendingUseItem;
        delete this._ctx._pendingUseItemUser;
        // actorWidget 윈도우 숨기기 (deactivate만으로는 _updateCursor가 매 프레임 커서를 복원함)
        var awDoneId = this._pendingActorWidgetId;
        if (awDoneId) {
          var awDone = this._widgetMap[awDoneId];
          if (awDone) {
            if (awDone.deactivate) awDone.deactivate();
            if (awDone.displayObject()) awDone.displayObject().visible = false;
          }
          this._pendingActorWidgetId = null;
        }
        // actorPanelsWidget 숨기기 + itemListWidget 복원
        var apwHideId = handler.actorPanelsWidget || this._pendingActorPanelsWidgetId;
        if (apwHideId) {
          var apwHide = this._widgetMap[apwHideId];
          if (apwHide && apwHide.displayObject()) apwHide.displayObject().visible = false;
          this._pendingActorPanelsWidgetId = null;
        }
        var ilRestoreId = handler.itemListWidget || this._pendingItemListWidgetId;
        if (ilRestoreId) {
          var ilRestore = this._widgetMap[ilRestoreId];
          if (ilRestore && ilRestore.displayObject()) ilRestore.displayObject().visible = true;
          if (ilRestore && ilRestore._rowOverlay) ilRestore._rowOverlay.visible = true;
          this._pendingItemListWidgetId = null;
        }
        if (this._rootWidget) this._rootWidget.refresh();
        var retId = handler.itemListWidget;
        if (retId && this._navManager) {
          this._navManager.focusWidget(retId);
        } else if (this._personalOriginWidget && this._navManager) {
          this._navManager.focusWidget(this._personalOriginWidget._id);
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

  // 아이템을 특정 파티원 1명에게 적용 (user: 사용자 actor, 기본=leader)
  Scene_CustomUI.prototype._applyItemTo = function(item, actor, user) {
    var effectUser = user || $gameParty.leader();
    if (typeof SoundManager !== 'undefined') {
      DataManager.isSkill(item) ? SoundManager.playUseSkill() : SoundManager.playUseItem();
    }
    effectUser.useItem(item); // 아이템 소비 (수량 감소, MP 소비 등)
    var action = new Game_Action(effectUser);
    action.setItemObject(item);
    action.apply(actor);
    action.applyGlobal();
    if (typeof $gameTemp !== 'undefined' && $gameTemp.isCommonEventReserved()) {
      SceneManager.goto(Scene_Map);
    }
  };

  // 아이템을 전체/자신/비대상에게 적용
  Scene_CustomUI.prototype._applyItemToAll = function(item) {
    if (typeof SoundManager !== 'undefined') {
      DataManager.isSkill(item) ? SoundManager.playUseSkill() : SoundManager.playUseItem();
    }
    $gameParty.leader().useItem(item);
    var action = new Game_Action($gameParty.leader());
    action.setItemObject(item);
    var targets = action.isForAll() ? $gameParty.members() : [$gameParty.leader()];
    targets.forEach(function(actor) { action.apply(actor); });
    action.applyGlobal();
    if (typeof $gameTemp !== 'undefined' && $gameTemp.isCommonEventReserved()) {
      SceneManager.goto(Scene_Map);
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

  /**
   * 퇴장 애니메이션이 있는 위젯들의 애니메이션을 모두 완료한 후 씬을 전환합니다.
   * enterAnimation 없이 exitAnimation만 있어도 동작합니다.
   */
  Scene_CustomUI.prototype.popScene = function() {
    if (this._exitAnimating) return; // 이미 진행 중

    var self = this;
    var sceneDef = this._getSceneDef();
    var sceneExitAnim = sceneDef && sceneDef.exitAnimation;
    var widgetMap = this._widgetMap || {};
    var ids = Object.keys(widgetMap);

    // exitAnimation이 있는 위젯 수집 (위젯 개별 설정 우선, 없으면 씬 레벨 fallback)
    var animTargets = [];
    for (var i = 0; i < ids.length; i++) {
      var w = widgetMap[ids[i]];
      var def = (w._def && w._def.exitAnimation !== undefined) ? w._def.exitAnimation : sceneExitAnim;
      if (def && def.type !== 'none') {
        var obj = w.displayObject();
        if (obj) animTargets.push({ obj: obj, animDef: def });
      }
    }

    if (animTargets.length === 0) {
      Scene_Base.prototype.popScene.call(this);
      return;
    }

    this._exitAnimating = true;
    var remaining = animTargets.length;
    function onOne() {
      remaining--;
      if (remaining <= 0) {
        self._exitAnimating = false;
        Scene_Base.prototype.popScene.call(self);
      }
    }
    for (var j = 0; j < animTargets.length; j++) {
      WidgetAnimator.play(animTargets[j].obj, animTargets[j].animDef, false, onOne);
    }
  };

  Scene_CustomUI.prototype.terminate = function() {
    Scene_Base.prototype.terminate.call(this);
    if (this._navManager && this._navManager.dispose) this._navManager.dispose();
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
      // actorWidget 윈도우 숨기기
      if (this._pendingActorWidgetId) {
        var awCancel = this._widgetMap[this._pendingActorWidgetId];
        if (awCancel) {
          if (awCancel.deactivate) awCancel.deactivate();
          if (awCancel.displayObject()) awCancel.displayObject().visible = false;
        }
        this._pendingActorWidgetId = null;
      }
      // actorPanelsWidget 숨기기 + itemListWidget 복원
      if (this._pendingActorPanelsWidgetId) {
        var apwCancel = this._widgetMap[this._pendingActorPanelsWidgetId];
        if (apwCancel && apwCancel.displayObject()) apwCancel.displayObject().visible = false;
        this._pendingActorPanelsWidgetId = null;
      }
      if (this._pendingItemListWidgetId) {
        var ilCancel = this._widgetMap[this._pendingItemListWidgetId];
        if (ilCancel && ilCancel.displayObject()) ilCancel.displayObject().visible = true;
        if (ilCancel && ilCancel._rowOverlay) ilCancel._rowOverlay.visible = true;
        this._pendingItemListWidgetId = null;
      }
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

    // 등장 애니메이션 — 씬 레벨 fallback으로 widgetMap 전체 위젯에 적용
    var sceneEnterAnim = sceneDef.enterAnimation || null;
    var widgetMap = this._widgetMap || {};
    for (var wid in widgetMap) {
      widgetMap[wid].playEnterAnim(sceneEnterAnim);
    }

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
    WidgetAnimator.update();
    if (!this._navManager && !this._navManagerWarnOnce) {
      this._navManagerWarnOnce = true;
      console.warn('[Scene_CustomUI] _navManager is null on update!');
    }
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
            var $ctx = this._ctx;
            var fn = new Function('$ctx', handler.code);
            fn.call(this, $ctx);
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
  // Scene_CSBattle — Scene_Battle 기반 커스텀 UI 버전
  //   createPartyCommandWindow / createActorCommandWindow 만 위젯으로 대체
  //   나머지 배틀 로직 및 창(BattleLog, BattleStatus, Skill, Item, Actor, Enemy 등)은 원본 유지
  //===========================================================================
  function Scene_CSBattle() {
    this.initialize.apply(this, arguments);
  }
  Scene_CSBattle.prototype = Object.create(Scene_Battle.prototype);
  Scene_CSBattle.prototype.constructor = Scene_CSBattle;

  Scene_CSBattle.prototype.initialize = function() {
    Scene_Battle.prototype.initialize.call(this);
    this._sceneId = 'battle';
    this._ctx = {};
    this._battleWidgets = []; // 생성한 위젯 목록 (update/destroy용)
  };

  Scene_CSBattle.prototype._getSceneDef = function() {
    var scenes = _scenesData.scenes || {};
    return scenes['battle'] || null;
  };

  // 위젯 def 트리에서 id로 검색
  Scene_CSBattle.prototype._findWidgetDef = function(node, id) {
    if (!node) return null;
    if (node.id === id) return node;
    var children = node.children || [];
    for (var i = 0; i < children.length; i++) {
      var found = this._findWidgetDef(children[i], id);
      if (found) return found;
    }
    return null;
  };

  // 위젯에서 Window를 추출해 addWindow, 위젯을 _battleWidgets에 등록
  Scene_CSBattle.prototype._addBattleWidget = function(widget) {
    if (!widget) return null;
    this._battleWidgets.push(widget);
    var obj = widget.displayObject ? widget.displayObject() : null;
    if (obj && obj instanceof Window_Base) {
      this.addWindow(obj);
    }
    return obj instanceof Window_Base ? obj : null;
  };

  // list 위젯 생성 — 성공 시 Window_CustomCommand 반환, 실패 시 null
  Scene_CSBattle.prototype._buildListWidget = function(id) {
    var sceneDef = this._getSceneDef();
    var def = sceneDef && this._findWidgetDef(sceneDef.root, id);
    if (!def) return null;
    var widget = new Widget_List();
    widget.initialize(def, null);
    return this._addBattleWidget(widget) ? widget : null;
  };

  // ── createPartyCommandWindow override ──────────────────────────────────────
  Scene_CSBattle.prototype.createPartyCommandWindow = function() {
    var widget = this._buildListWidget('partyCommand');
    if (widget) {
      var win = widget._window;
      // Window_PartyCommand.setup() 호환 메서드 주입
      win.setup = function() {
        this.refresh();
        this.select(0);
        this.activate();
        this.open();
      };
      this._partyCommandWindow = win;
    } else {
      // 폴백: 원본 Window_PartyCommand
      this._partyCommandWindow = new Window_PartyCommand();
      this.addWindow(this._partyCommandWindow);
    }
    this._partyCommandWindow.setHandler('fight',  this.commandFight.bind(this));
    this._partyCommandWindow.setHandler('escape', this.commandEscape.bind(this));
    this._partyCommandWindow.deselect();
  };

  // ── createActorCommandWindow override ──────────────────────────────────────
  Scene_CSBattle.prototype.createActorCommandWindow = function() {
    var widget = this._buildListWidget('actorCommand');
    if (widget) {
      var win = widget._window;
      var actorWidget = widget;
      // Window_ActorCommand.setup(actor) 호환 메서드 주입
      win.setup = function(actor) {
        // dataScript가 BattleManager.actor()를 참조하므로 rebuild
        if (actorWidget._rebuildFromScript) actorWidget._rebuildFromScript();
        this.select(0);
        this.activate();
        this.open();
      };
      this._actorCommandWindow = win;
    } else {
      // 폴백: 원본 Window_ActorCommand
      this._actorCommandWindow = new Window_ActorCommand();
      this.addWindow(this._actorCommandWindow);
    }
    this._actorCommandWindow.setHandler('attack', this.commandAttack.bind(this));
    this._actorCommandWindow.setHandler('skill',  this.commandSkill.bind(this));
    this._actorCommandWindow.setHandler('guard',  this.commandGuard.bind(this));
    this._actorCommandWindow.setHandler('item',   this.commandItem.bind(this));
    this._actorCommandWindow.setHandler('cancel', this.selectPreviousCommand.bind(this));
  };

  // ── commandSkill override: dataScript ext로 stypeId 취득 ───────────────────
  Scene_CSBattle.prototype.commandSkill = function() {
    var actor = BattleManager.actor();
    var stypeId = 1;
    if (this._actorCommandWindow && typeof this._actorCommandWindow.currentExt === 'function') {
      var ext = this._actorCommandWindow.currentExt();
      if (typeof ext === 'number') stypeId = ext;
    }
    this._ctx.lastActorCommand = 'skill';
    this._skillWindow.setActor(actor);
    this._skillWindow.setStypeId(stypeId);
    this._skillWindow.refresh();
    this._skillWindow.show();
    this._skillWindow.activate();
  };

  // ── commandItem override: lastActorCommand 기록 ────────────────────────────
  Scene_CSBattle.prototype.commandItem = function() {
    this._ctx.lastActorCommand = 'item';
    this._itemWindow.refresh();
    this._itemWindow.show();
    this._itemWindow.activate();
  };

  // ── onActorCancel / onEnemyCancel: lastActorCommand 기반 ───────────────────
  Scene_CSBattle.prototype.onActorCancel = function() {
    this._actorWindow.hide();
    var last = this._ctx.lastActorCommand;
    if (last === 'skill') {
      this._skillWindow.show();
      this._skillWindow.activate();
    } else if (last === 'item') {
      this._itemWindow.show();
      this._itemWindow.activate();
    } else {
      this._actorCommandWindow.activate();
    }
  };

  Scene_CSBattle.prototype.onEnemyCancel = function() {
    this._enemyWindow.hide();
    var last = this._ctx.lastActorCommand || 'attack';
    if (last === 'attack') {
      this._actorCommandWindow.activate();
    } else if (last === 'skill') {
      this._skillWindow.show();
      this._skillWindow.activate();
    } else if (last === 'item') {
      this._itemWindow.show();
      this._itemWindow.activate();
    }
  };

  // ── commandAttack override: lastActorCommand 기록 ─────────────────────────
  Scene_CSBattle.prototype.commandAttack = function() {
    this._ctx.lastActorCommand = 'attack';
    BattleManager.inputtingAction().setAttack();
    this.selectEnemySelection();
  };

  // ── update: 위젯 업데이트 추가 ────────────────────────────────────────────
  Scene_CSBattle.prototype.update = function() {
    Scene_Battle.prototype.update.call(this);
    for (var i = 0; i < this._battleWidgets.length; i++) {
      this._battleWidgets[i].update();
    }
  };

  window.Scene_CSBattle = Scene_CSBattle;

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
    _scenesData = loadScenesData();
    _configData = loadJSON('data/UIEditorConfig.json');
    registerCustomScenes();
    // noRedirect URL 파라미터가 있으면 씬 리다이렉트 비활성화
    if (_noSceneRedirect) {
      installSceneRedirects({});
      return;
    }
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
  // URL 파라미터 — noRedirect=1 이면 씬 리다이렉트 전체 비활성화
  //===========================================================================
  var _noSceneRedirect = (new URLSearchParams(location.search)).has('noRedirect');

  //===========================================================================
  // 초기 등록
  //===========================================================================
  registerCustomScenes();
  installSceneRedirects(_noSceneRedirect ? {} : (_configData.sceneRedirects || {}));

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

  // ── UI 씬 테스트 모드: ?uiTestScene=Scene_CS_xxx 파라미터로 자동 진입 ──
  // 에디터의 "현재 UI를 테스트" 버튼이 /game/index_3d.html?uiTestScene=... 로 열 때 사용
  (function() {
    var params = new URLSearchParams(window.location.search);
    var testScene = params.get('uiTestScene');
    if (!testScene) return;

    var _origBootStart = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
      Scene_Base.prototype.start.call(this);
      SoundManager.preloadImportantSounds();
      DataManager.setupNewGame();
      var SceneCtor = window[testScene];
      if (SceneCtor) {
        SceneManager.goto(SceneCtor);
      } else {
        _origBootStart.call(this);
      }
      this.updateDocumentTitle();
    };
  })();
})();
