/*:
 * @plugindesc UI 테마 — data/UIEditorConfig.json 으로 게임 UI 전체 커스터마이징
 * @author RPG Maker MV Web Editor
 *
 * @help UITheme.js
 *
 * RPG Maker MV 웹 에디터의 UI 에디터 기능과 연동합니다.
 * data/UIEditorConfig.json 의 설정을 읽어 게임 내 모든 Window의
 * 스타일(폰트, 투명도, 색조, 스킨)과 배치(위치, 크기)를 변경합니다.
 *
 * ● 기본 동작
 *   설정 파일이 없거나 overrides가 비어있으면 RPG Maker MV 원본과
 *   완전히 동일하게 동작합니다.
 *
 * ● 호환성
 *   RPG Maker MV 1.6.x 이상, NW.js 및 웹 브라우저 배포 모두 지원.
 *   이 플러그인은 에디터에서 자동으로 관리됩니다.
 */

(function () {
  'use strict';

  //===========================================================================
  // UIEditorConfig.json 로드 (window 레이아웃 오버라이드)
  // UIEditorSkins.json 로드 (스킨 정의: defaultSkin, cornerSize)
  // 동기 XHR: NW.js(로컬 파일) + 브라우저(서버) 양쪽 호환
  //===========================================================================
  var _config = {};
  (function () {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'data/UIEditorConfig.json', false);
      xhr.send();
      if (xhr.status === 200 || xhr.status === 0) {
        _config = JSON.parse(xhr.responseText);
      }
    } catch (e) {
      // 파일 없음 → 기본값 사용
    }
  })();

  var _skins = {};
  (function () {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'data/UIEditorSkins.json', false);
      xhr.send();
      if (xhr.status === 200 || xhr.status === 0) {
        _skins = JSON.parse(xhr.responseText);
      }
    } catch (e) {
      // 파일 없음 → 기본값 사용
    }
  })();

  /** 스킨 bitmap URL에서 스킨 이름 추출 (img/system/ 이후 경로, 확장자 제거) */
  function skinNameFromBitmap(bitmap) {
    if (!bitmap || !bitmap.url) return null;
    // img/system/ 이후 전체 경로 추출 (경로 포함 스킨 이름 지원)
    var m = bitmap.url.match(/img\/system\/(.+?)(?:\.(?:png|webp))?(?:\?.*)?$/i);
    if (m) return m[1];
    // fallback: 파일명만
    var m2 = bitmap.url.match(/([^/\\]+?)(?:\.(?:png|webp))?(?:\?.*)?$/i);
    return m2 ? m2[1] : null;
  }

  /** 스킨 파일 경로로 사전 항목 취득 (file 필드 또는 name 매칭, 없으면 null) */
  function findSkinEntry(skinName) {
    if (!Array.isArray(_skins.skins)) return null;
    var name = skinName || _skins.defaultSkin;
    if (!name) return null;
    return _skins.skins.filter(function (s) { return (s.file || s.name) === name; })[0] || null;
  }

  /** 스킨 ID로 사전 항목 취득 (name 필드 정확 매칭, 없으면 null) */
  function findSkinEntryById(id) {
    if (!Array.isArray(_skins.skins)) return null;
    if (!id) return null;
    return _skins.skins.filter(function (s) { return s.name === id; })[0] || null;
  }

  /** fill 영역 정보 취득 (entry 객체 직접 전달, 없으면 MV 기본값 0,0,96,96) */
  function getFillRect(entryOrId) {
    var entry = typeof entryOrId === 'string' ? findSkinEntryById(entryOrId) : entryOrId;
    if (!entry) return { x: 0, y: 0, w: 96, h: 96 };
    return {
      x: entry.fillX !== undefined ? entry.fillX : 0,
      y: entry.fillY !== undefined ? entry.fillY : 0,
      w: entry.fillW !== undefined ? entry.fillW : 96,
      h: entry.fillH !== undefined ? entry.fillH : 96,
    };
  }

  /** 프레임 영역 정보 취득 (entry 객체 직접 전달, 없으면 MV 기본값 x:96,y:0,w:96,h:96,cs:24) */
  function getFrameInfo(entryOrId) {
    var entry = typeof entryOrId === 'string' ? findSkinEntryById(entryOrId) : entryOrId;
    if (!entry) return { x: 96, y: 0, w: 96, h: 96, cs: 24 };
    return {
      x:  entry.frameX      !== undefined ? entry.frameX      : 96,
      y:  entry.frameY      !== undefined ? entry.frameY      : 0,
      w:  entry.frameW      !== undefined ? entry.frameW      : 96,
      h:  entry.frameH      !== undefined ? entry.frameH      : 96,
      cs: entry.cornerSize  !== undefined ? entry.cornerSize  : 24,
    };
  }

  //===========================================================================
  // Window — fill 영역 커스터마이징 (_refreshBack 오버라이드)
  //===========================================================================
  var _Window_refreshBack = Window.prototype._refreshBack;
  Window.prototype._refreshBack = function () {
    var skinName = skinNameFromBitmap(this._windowskin);
    // skinId 확인: config override에 skinId가 있으면 ID로 정확 매칭, 없으면 파일 경로로 매칭
    var className = this.constructor && this.constructor.name;
    var skinId = className ? ((_config.overrides || {})[className] || {}).skinId : undefined;
    var entry = skinId ? findSkinEntryById(skinId) : findSkinEntry(skinName);
    // 스킨 항목이 없으면 원본 호출
    if (!entry) {
      return _Window_refreshBack.call(this);
    }
    var fill = getFillRect(entry);
    var m = this._margin;
    var w = this._width - m * 2;
    var h = this._height - m * 2;
    if (w <= 0 || h <= 0) return;
    var bitmap = new Bitmap(w, h);
    this._windowBackSprite.bitmap = bitmap;
    this._windowBackSprite.setFrame(0, 0, w, h);
    this._windowBackSprite.move(m, m);
    if (this._windowskin) {
      bitmap.blt(this._windowskin, fill.x, fill.y, fill.w, fill.h, 0, 0, w, h);
      var tone = this._colorTone;
      bitmap.adjustTone(tone[0], tone[1], tone[2]);
    }
  };

  //===========================================================================
  // Window — 9-slice 프레임 커스터마이징 (_refreshFrame 오버라이드)
  //===========================================================================
  var _Window_refreshFrame = Window.prototype._refreshFrame;
  Window.prototype._refreshFrame = function () {
    var skinName = skinNameFromBitmap(this._windowskin);
    // skinId 확인: config override에 skinId가 있으면 ID로 정확 매칭, 없으면 파일 경로로 매칭
    var className = this.constructor && this.constructor.name;
    var skinId = className ? ((_config.overrides || {})[className] || {}).skinId : undefined;
    var entry = skinId ? findSkinEntryById(skinId) : findSkinEntry(skinName);
    // 스킨 항목이 없으면 원본 호출
    if (!entry) {
      return _Window_refreshFrame.call(this);
    }
    var f = getFrameInfo(entry);
    var w = this._width;
    var h = this._height;
    if (w <= 0 || h <= 0) return;
    var bitmap = new Bitmap(w, h);
    this._windowFrameSprite.bitmap = bitmap;
    this._windowFrameSprite.setFrame(0, 0, w, h);
    if (this._windowskin) {
      var skin = this._windowskin;
      var fx = f.x, fy = f.y, fw = f.w, fh = f.h, cs = f.cs;
      // top / bottom edges
      bitmap.blt(skin, fx + cs,      fy,           fw - cs * 2, cs,      cs,      0,      w - cs * 2, cs);
      bitmap.blt(skin, fx + cs,      fy + fh - cs, fw - cs * 2, cs,      cs,      h - cs, w - cs * 2, cs);
      // left / right edges
      bitmap.blt(skin, fx,           fy + cs,      cs,          fh - cs * 2, 0,      cs,      cs,          h - cs * 2);
      bitmap.blt(skin, fx + fw - cs, fy + cs,      cs,          fh - cs * 2, w - cs, cs,      cs,          h - cs * 2);
      // corners
      bitmap.blt(skin, fx,           fy,           cs, cs, 0,      0,      cs, cs);
      bitmap.blt(skin, fx + fw - cs, fy,           cs, cs, w - cs, 0,      cs, cs);
      bitmap.blt(skin, fx,           fy + fh - cs, cs, cs, 0,      h - cs, cs, cs);
      bitmap.blt(skin, fx + fw - cs, fy + fh - cs, cs, cs, w - cs, h - cs, cs, cs);
    }
  };

  //===========================================================================
  // Window — 커서 9-slice 커스터마이징 (_refreshCursor 오버라이드)
  //===========================================================================
  var _Window_refreshCursor = Window.prototype._refreshCursor;
  Window.prototype._refreshCursor = function () {
    var skinName = skinNameFromBitmap(this._windowskin);
    var className = this.constructor && this.constructor.name;
    var skinId = className ? ((_config.overrides || {})[className] || {}).skinId : undefined;
    var entry = skinId ? findSkinEntryById(skinId) : findSkinEntry(skinName);
    if (!entry || entry.cursorX === undefined) { return _Window_refreshCursor.call(this); }

    var pad = this._padding;
    var ox = this.origin ? this.origin.x : 0;
    var oy = this.origin ? this.origin.y : 0;
    var cp = entry.cursorPadding !== undefined ? entry.cursorPadding : 2;
    var x = this._cursorRect.x + pad - ox - Math.floor(cp / 2);
    var y = this._cursorRect.y + pad - oy - Math.floor(cp / 2);
    var w = this._cursorRect.width + cp;
    var h = this._cursorRect.height + cp;
    if (w <= 0 || h <= 0) return;

    var p  = entry.cursorX;
    var q  = entry.cursorY;
    var nw = entry.cursorW;
    var nh = entry.cursorH;
    var m  = entry.cursorCornerSize !== undefined ? entry.cursorCornerSize : 4;

    var renderMode = entry.cursorRenderMode || 'nineSlice';
    var bitmap = this._windowskin;
    if (!bitmap || !bitmap.isReady() || nw <= 0 || nh <= 0) return;
    if (!this._windowCursorSprite) return;

    this._windowCursorSprite.bitmap = new Bitmap(w, h);
    var dest = this._windowCursorSprite.bitmap;

    if (renderMode === 'stretch') {
      dest.blt(bitmap, p, q, nw, nh, 0, 0, w, h);
    } else if (renderMode === 'tile') {
      for (var ty = 0; ty < h; ty += nh) {
        for (var tx = 0; tx < w; tx += nw) {
          var tw = Math.min(nw, w - tx);
          var th = Math.min(nh, h - ty);
          dest.blt(bitmap, p, q, tw, th, tx, ty, tw, th);
        }
      }
    } else {
      // nineSlice (기본)
      if (m <= 0) m = 4;
      for (var i = 0; i < 9; i++) {
        var col = i % 3, row = Math.floor(i / 3);
        var sx = col === 0 ? p : col === 2 ? p + nw - m : p + m;
        var sy = row === 0 ? q : row === 2 ? q + nh - m : q + m;
        var sw = col === 0 || col === 2 ? m : nw - m * 2;
        var sh = row === 0 || row === 2 ? m : nh - m * 2;
        var dx = col === 0 ? 0 : col === 2 ? w - m : m;
        var dy = row === 0 ? 0 : row === 2 ? h - m : m;
        var dw = col === 0 || col === 2 ? m : w - m * 2;
        var dh = row === 0 || row === 2 ? m : h - m * 2;
        if (sw > 0 && sh > 0 && dw > 0 && dh > 0) {
          dest.blt(bitmap, sx, sy, sw, sh, dx, dy, dw, dh);
        }
      }
    }

    // 색조 적용
    var tr = entry.cursorToneR || 0, tg = entry.cursorToneG || 0, tb = entry.cursorToneB || 0;
    if (tr !== 0 || tg !== 0 || tb !== 0) { dest.adjustTone(tr, tg, tb); }

    var blendModeMap = { normal: 0, add: 1, multiply: 2, screen: 3 };
    this._windowCursorSprite.blendMode = blendModeMap[entry.cursorBlendMode || 'normal'] || 0;
    this._windowCursorSprite.setFrame(0, 0, w, h);
    this._windowCursorSprite.move(x, y);
    // alpha는 _updateCursor에서 매 프레임 갱신하므로 여기서는 초기값만 설정
    this._windowCursorSprite.alpha = (entry.cursorOpacity !== undefined ? entry.cursorOpacity : 192) / 255;
    // _cursorEntry 캐싱: _updateCursor 오버라이드에서 참조
    this._uiThemeCursorEntry = entry;
  };

  //===========================================================================
  // Window — 커서 업데이트 오버라이드 (opacity / blink 커스터마이징)
  //===========================================================================
  var _Window_updateCursor = Window.prototype._updateCursor;
  Window.prototype._updateCursor = function () {
    var entry = this._uiThemeCursorEntry;
    if (!entry || entry.cursorX === undefined) { return _Window_updateCursor.call(this); }
    var maxOpacity = entry.cursorOpacity !== undefined ? entry.cursorOpacity : 192;
    var blink = entry.cursorBlink !== false; // 기본 true
    var blinkCount = this._animationCount % 40;
    var opacity = this.contentsOpacity * (maxOpacity / 255);
    if (blink && this.active) {
      if (blinkCount < 20) {
        opacity -= blinkCount * 8 * (maxOpacity / 255);
      } else {
        opacity -= (40 - blinkCount) * 8 * (maxOpacity / 255);
      }
    }
    this._windowCursorSprite.alpha = Math.max(0, opacity) / 255;
    this._windowCursorSprite.visible = this.isOpen();
  };

  var _ov = _config.overrides || {};

  /** 전역(Global) 설정값 취득 */
  function G(key, defaultVal) {
    var g = _ov['Global'];
    return (g && g[key] !== undefined) ? g[key] : defaultVal;
  }

  /** 클래스별 오버라이드 존재 여부 확인 */
  function hasOv(className) {
    return !!_ov[className];
  }

  /** 클래스별 오버라이드에서 값 취득 */
  function OV(className, key) {
    return (_ov[className] || {})[key];
  }

  /** 클래스 내 요소 오버라이드 취득 */
  function getElem(className, elemType) {
    var classOv = _ov[className];
    if (!classOv || !classOv.elements) return null;
    return classOv.elements[elemType] || null;
  }

  /**
   * 요소 draw 메서드 오버라이드 설치
   * argX/Y/W/H: arguments 배열에서 x/y/width/height의 인덱스 (null = 오버라이드 안 함)
   */
  function wrapDraw(cls, className, methodName, elemType, argX, argY, argW, argH) {
    var elemCfg = getElem(className, elemType);
    if (!elemCfg) return;
    var orig = cls.prototype[methodName];
    if (!orig) return;
    cls.prototype[methodName] = function () {
      var args = Array.prototype.slice.call(arguments);
      if (elemCfg.x !== undefined && argX !== null) args[argX] = elemCfg.x;
      if (elemCfg.y !== undefined && argY !== null) args[argY] = elemCfg.y;
      if (elemCfg.width !== undefined && argW !== null) args[argW] = elemCfg.width;
      if (elemCfg.height !== undefined && argH !== null) args[argH] = elemCfg.height;
      return orig.apply(this, args);
    };
  }

  //===========================================================================
  // Window_Base — 전역 스타일 (모든 Window에 적용)
  //===========================================================================

  Window_Base.prototype.standardFontSize = function () {
    return G('fontSize', 28);
  };

  Window_Base.prototype.standardPadding = function () {
    return G('padding', 18);
  };

  Window_Base.prototype.standardBackOpacity = function () {
    return G('backOpacity', 192);
  };

  Window_Base.prototype.loadWindowskin = function () {
    var skinId = _skins.defaultSkin || G('windowskin', 'Window');
    var entry = findSkinEntryById(skinId) || findSkinEntry(skinId);
    var skin = (entry && entry.file) ? entry.file : skinId;
    this.windowskin = ImageManager.loadSystem(skin);
  };

  // 전역 colorTone / opacity
  var _WB_initialize = Window_Base.prototype.initialize;
  Window_Base.prototype.initialize = function (x, y, width, height) {
    _WB_initialize.call(this, x, y, width, height);
    var tone = G('colorTone', null);
    if (Array.isArray(tone)) {
      this.setTone(tone[0] || 0, tone[1] || 0, tone[2] || 0);
    }
    var op = G('opacity', null);
    if (op !== null) this.opacity = op;
  };

  //===========================================================================
  // 헬퍼 — 클래스 프로토타입 스타일 오버라이드
  //
  // windowWidth / windowHeight : Scene이 생성 시 호출하는 메서드 오버라이드
  // fontSize / backOpacity     : standardXxx() 메서드 오버라이드
  // opacity / colorTone        : initialize 훅으로 인스턴스에 적용
  //===========================================================================
  function applyStyle(cls, className) {
    if (!cls || !hasOv(className)) return;
    var ov = _ov[className];

    if (ov.width !== undefined) {
      cls.prototype.windowWidth = function () { return ov.width; };
    }
    if (ov.height !== undefined) {
      cls.prototype.windowHeight = function () { return ov.height; };
    }
    if (ov.fontSize !== undefined) {
      cls.prototype.standardFontSize = function () { return ov.fontSize; };
    }
    if (ov.backOpacity !== undefined) {
      cls.prototype.standardBackOpacity = function () { return ov.backOpacity; };
    }
    if (ov.padding !== undefined) {
      cls.prototype.standardPadding = function () { return ov.padding; };
    }
    if (ov.windowskinName !== undefined) {
      cls.prototype.loadWindowskin = function () {
        this.windowskin = ImageManager.loadSystem(ov.windowskinName);
      };
    }
    if (ov.opacity !== undefined || ov.colorTone) {
      var _orig = cls.prototype.initialize;
      cls.prototype.initialize = function () {
        _orig.apply(this, arguments);
        if (ov.opacity !== undefined) this.opacity = ov.opacity;
        if (Array.isArray(ov.colorTone)) {
          this.setTone(ov.colorTone[0] || 0, ov.colorTone[1] || 0, ov.colorTone[2] || 0);
        }
      };
    }
  }

  //===========================================================================
  // 헬퍼 — Scene.create() 이후 인스턴스에 위치/크기 적용
  //
  // Scene이 Window를 생성한 뒤 x/y를 덮어쓰는 경우를 처리.
  // width/height 도 보정 (windowWidth()가 없는 pass-through 창 대응).
  //===========================================================================
  function applyLayout(win, className) {
    if (!win || !hasOv(className)) return;
    var ov = _ov[className];

    if (ov.x !== undefined) win.x = ov.x;
    if (ov.y !== undefined) win.y = ov.y;

    var needResize = false;
    if (ov.width !== undefined && win.width !== ov.width) {
      win.width = ov.width;
      needResize = true;
    }
    if (ov.height !== undefined && win.height !== ov.height) {
      win.height = ov.height;
      needResize = true;
    }
    if (needResize) {
      if (win.createContents) win.createContents();
      if (win.refresh) win.refresh();
    }
  }

  //===========================================================================
  // 클래스별 스타일 적용
  //===========================================================================
  applyStyle(Window_Gold,         'Window_Gold');
  applyStyle(Window_Help,         'Window_Help');
  applyStyle(Window_MenuCommand,  'Window_MenuCommand');
  applyStyle(Window_MenuStatus,   'Window_MenuStatus');
  applyStyle(Window_ItemCategory, 'Window_ItemCategory');
  applyStyle(Window_ItemList,     'Window_ItemList');
  applyStyle(Window_SkillType,    'Window_SkillType');
  applyStyle(Window_SkillStatus,  'Window_SkillStatus');
  applyStyle(Window_SkillList,    'Window_SkillList');
  applyStyle(Window_EquipStatus,  'Window_EquipStatus');
  applyStyle(Window_EquipCommand, 'Window_EquipCommand');
  applyStyle(Window_EquipSlot,    'Window_EquipSlot');
  applyStyle(Window_EquipItem,    'Window_EquipItem');
  applyStyle(Window_Status,       'Window_Status');
  applyStyle(Window_Options,      'Window_Options');
  applyStyle(Window_SavefileList, 'Window_SavefileList');
  applyStyle(Window_ShopCommand,  'Window_ShopCommand');
  applyStyle(Window_ShopBuy,      'Window_ShopBuy');
  applyStyle(Window_ShopSell,     'Window_ShopSell');
  applyStyle(Window_ShopNumber,   'Window_ShopNumber');
  applyStyle(Window_ShopStatus,   'Window_ShopStatus');
  applyStyle(Window_NameEdit,     'Window_NameEdit');
  applyStyle(Window_NameInput,    'Window_NameInput');
  applyStyle(Window_Message,      'Window_Message');
  applyStyle(Window_ScrollText,   'Window_ScrollText');
  applyStyle(Window_MapName,      'Window_MapName');
  applyStyle(Window_BattleLog,    'Window_BattleLog');
  applyStyle(Window_PartyCommand, 'Window_PartyCommand');
  applyStyle(Window_ActorCommand, 'Window_ActorCommand');
  applyStyle(Window_BattleStatus, 'Window_BattleStatus');
  applyStyle(Window_BattleActor,  'Window_BattleActor');
  applyStyle(Window_BattleEnemy,  'Window_BattleEnemy');
  applyStyle(Window_TitleCommand, 'Window_TitleCommand');
  applyStyle(Window_GameEnd,      'Window_GameEnd');

  // Graphics 기반 기본값을 가지는 클래스 — windowWidth/Height 원본 보존하면서 오버라이드
  // (applyStyle에서 이미 처리하지 않은 경우에만 아래 기본값 주입)
  if (!OV('Window_MenuStatus', 'width')) {
    Window_MenuStatus.prototype.windowWidth = function () {
      return Graphics.boxWidth - 240;
    };
  }
  if (!OV('Window_MenuStatus', 'height')) {
    Window_MenuStatus.prototype.windowHeight = function () {
      return Graphics.boxHeight;
    };
  }
  if (!OV('Window_ItemCategory', 'width')) {
    Window_ItemCategory.prototype.windowWidth = function () {
      return Graphics.boxWidth;
    };
  }
  if (!OV('Window_BattleStatus', 'width')) {
    Window_BattleStatus.prototype.windowWidth = function () {
      return Graphics.boxWidth - 192;
    };
  }
  if (!OV('Window_BattleEnemy', 'width')) {
    Window_BattleEnemy.prototype.windowWidth = function () {
      return Graphics.boxWidth - 192;
    };
  }
  if (!OV('Window_Message', 'width')) {
    Window_Message.prototype.windowWidth = function () {
      return Graphics.boxWidth;
    };
  }
  if (!OV('Window_BattleLog', 'width')) {
    Window_BattleLog.prototype.windowWidth = function () {
      return Graphics.boxWidth;
    };
  }

  //===========================================================================
  // 위치 오버라이드 — updatePlacement() 보유 클래스
  // (updatePlacement 내부에서 x/y를 계산하므로 그 뒤에 덮어씀)
  //===========================================================================

  // Window_Options — 기본: 화면 중앙
  if (hasOv('Window_Options')) {
    var _WOpt_up = Window_Options.prototype.updatePlacement;
    Window_Options.prototype.updatePlacement = function () {
      _WOpt_up.call(this);
      var x = OV('Window_Options', 'x'), y = OV('Window_Options', 'y');
      if (x !== undefined) this.x = x;
      if (y !== undefined) this.y = y;
    };
  }

  // Window_TitleCommand — 기본: 수평 중앙, 하단 96px
  if (hasOv('Window_TitleCommand')) {
    var _WTC_up = Window_TitleCommand.prototype.updatePlacement;
    Window_TitleCommand.prototype.updatePlacement = function () {
      _WTC_up.call(this);
      var x = OV('Window_TitleCommand', 'x'), y = OV('Window_TitleCommand', 'y');
      if (x !== undefined) this.x = x;
      if (y !== undefined) this.y = y;
    };
  }

  // Window_GameEnd — 기본: 화면 중앙
  if (hasOv('Window_GameEnd')) {
    var _WGE_up = Window_GameEnd.prototype.updatePlacement;
    Window_GameEnd.prototype.updatePlacement = function () {
      _WGE_up.call(this);
      var x = OV('Window_GameEnd', 'x'), y = OV('Window_GameEnd', 'y');
      if (x !== undefined) this.x = x;
      if (y !== undefined) this.y = y;
    };
  }

  //===========================================================================
  // 위치/크기 오버라이드 — Scene.create() 훅
  // Scene이 Window를 생성하고 x/y를 결정한 뒤 applyLayout으로 덮어씀.
  //===========================================================================

  // Scene_Map
  var _SMap_create = Scene_Map.prototype.create;
  Scene_Map.prototype.create = function () {
    _SMap_create.call(this);
    applyLayout(this._mapNameWindow, 'Window_MapName');
  };

  // Scene_Menu
  var _SMenu_create = Scene_Menu.prototype.create;
  Scene_Menu.prototype.create = function () {
    _SMenu_create.call(this);
    applyLayout(this._goldWindow,    'Window_Gold');
    applyLayout(this._commandWindow, 'Window_MenuCommand');
    applyLayout(this._statusWindow,  'Window_MenuStatus');
  };

  // Scene_Item
  var _SItem_create = Scene_Item.prototype.create;
  Scene_Item.prototype.create = function () {
    _SItem_create.call(this);
    applyLayout(this._helpWindow,     'Window_Help');
    applyLayout(this._categoryWindow, 'Window_ItemCategory');
    applyLayout(this._itemWindow,     'Window_ItemList');
  };

  // Scene_Skill
  var _SSk_create = Scene_Skill.prototype.create;
  Scene_Skill.prototype.create = function () {
    _SSk_create.call(this);
    applyLayout(this._helpWindow,      'Window_Help');
    applyLayout(this._skillTypeWindow, 'Window_SkillType');
    applyLayout(this._statusWindow,    'Window_SkillStatus');
    applyLayout(this._itemWindow,      'Window_SkillList');
  };

  // Scene_Equip
  var _SEq_create = Scene_Equip.prototype.create;
  Scene_Equip.prototype.create = function () {
    _SEq_create.call(this);
    applyLayout(this._helpWindow,    'Window_Help');
    applyLayout(this._statusWindow,  'Window_EquipStatus');
    applyLayout(this._commandWindow, 'Window_EquipCommand');
    applyLayout(this._slotWindow,    'Window_EquipSlot');
    applyLayout(this._itemWindow,    'Window_EquipItem');
  };

  // Scene_Status
  var _SSt_create = Scene_Status.prototype.create;
  Scene_Status.prototype.create = function () {
    _SSt_create.call(this);
    applyLayout(this._statusWindow, 'Window_Status');
  };

  // Scene_Options
  var _SOpt_create = Scene_Options.prototype.create;
  Scene_Options.prototype.create = function () {
    _SOpt_create.call(this);
    applyLayout(this._optionsWindow, 'Window_Options');
  };

  // Scene_File (공통 — Save/Load 양쪽에 _helpWindow, _listWindow 존재)
  var _SF_create = Scene_File.prototype.create;
  Scene_File.prototype.create = function () {
    _SF_create.call(this);
    applyLayout(this._helpWindow, 'Window_Help');
    applyLayout(this._listWindow, 'Window_SavefileList');
  };

  // Scene_Shop
  var _SSh_create = Scene_Shop.prototype.create;
  Scene_Shop.prototype.create = function () {
    _SSh_create.call(this);
    applyLayout(this._helpWindow,    'Window_Help');
    applyLayout(this._goldWindow,    'Window_Gold');
    applyLayout(this._commandWindow, 'Window_ShopCommand');
    applyLayout(this._buyWindow,     'Window_ShopBuy');
    applyLayout(this._sellWindow,    'Window_ShopSell');
    applyLayout(this._numberWindow,  'Window_ShopNumber');
    applyLayout(this._statusWindow,  'Window_ShopStatus');
  };

  // Scene_Name
  var _SNm_create = Scene_Name.prototype.create;
  Scene_Name.prototype.create = function () {
    _SNm_create.call(this);
    applyLayout(this._editWindow,  'Window_NameEdit');
    applyLayout(this._inputWindow, 'Window_NameInput');
  };

  // Scene_GameEnd
  var _SGE_create = Scene_GameEnd.prototype.create;
  Scene_GameEnd.prototype.create = function () {
    _SGE_create.call(this);
    applyLayout(this._commandWindow, 'Window_GameEnd');
  };

  // Scene_Battle
  var _SBt_create = Scene_Battle.prototype.create;
  Scene_Battle.prototype.create = function () {
    _SBt_create.call(this);
    applyLayout(this._logWindow,          'Window_BattleLog');
    applyLayout(this._partyCommandWindow, 'Window_PartyCommand');
    applyLayout(this._actorCommandWindow, 'Window_ActorCommand');
    applyLayout(this._statusWindow,       'Window_BattleStatus');
    applyLayout(this._actorWindow,        'Window_BattleActor');
    applyLayout(this._enemyWindow,        'Window_BattleEnemy');
    applyLayout(this._skillWindow,        'Window_BattleSkill');
    applyLayout(this._itemWindow,         'Window_BattleItem');
    applyLayout(this._helpWindow,         'Window_Help');
  };

  //===========================================================================
  // 요소 오버라이드 — 각 Window 내 draw 메서드 위치/크기 커스터마이징
  //
  // drawActorFace(actor, faceName, faceIndex, x, y, width, height) → argX=3
  // drawActorName/Class/Nickname(actor, x, y, width)               → argX=1
  // drawActorLevel(actor, x, y)                                    → argX=1
  // drawActorIcons/Hp/Mp/Tp(actor, x, y, width)                    → argX=1
  // drawSimpleStatus(actor, x, y, width)                           → argX=1
  //
  // perActor 창(BattleStatus, MenuStatus)은 y를 오버라이드하지 않음
  // (y는 행 인덱스에 따라 자동 계산됨)
  //===========================================================================

  // ── Window_Status (single layout) ─────────────────────────────────────────
  wrapDraw(Window_Status, 'Window_Status', 'drawActorName',     'actorName',     1, 2, 3, null);
  wrapDraw(Window_Status, 'Window_Status', 'drawActorClass',    'actorClass',    1, 2, 3, null);
  wrapDraw(Window_Status, 'Window_Status', 'drawActorNickname', 'actorNickname', 1, 2, 3, null);
  wrapDraw(Window_Status, 'Window_Status', 'drawActorFace',     'actorFace',     3, 4, 5, 6);
  wrapDraw(Window_Status, 'Window_Status', 'drawActorLevel',    'actorLevel',    1, 2, null, null);
  wrapDraw(Window_Status, 'Window_Status', 'drawActorIcons',    'actorIcons',    1, 2, 3, null);
  wrapDraw(Window_Status, 'Window_Status', 'drawActorHp',       'actorHp',       1, 2, 3, null);
  wrapDraw(Window_Status, 'Window_Status', 'drawActorMp',       'actorMp',       1, 2, 3, null);

  // ── Window_BattleStatus (perActor — y 오버라이드 안 함) ──────────────────
  wrapDraw(Window_BattleStatus, 'Window_BattleStatus', 'drawActorName',  'actorName',  1, null, 3, null);
  wrapDraw(Window_BattleStatus, 'Window_BattleStatus', 'drawActorIcons', 'actorIcons', 1, null, 3, null);
  wrapDraw(Window_BattleStatus, 'Window_BattleStatus', 'drawActorHp',    'actorHp',    1, null, 3, null);
  wrapDraw(Window_BattleStatus, 'Window_BattleStatus', 'drawActorMp',    'actorMp',    1, null, 3, null);
  wrapDraw(Window_BattleStatus, 'Window_BattleStatus', 'drawActorTp',    'actorTp',    1, null, 3, null);

  // ── Window_MenuStatus (perActor — y 오버라이드 안 함) ────────────────────
  wrapDraw(Window_MenuStatus, 'Window_MenuStatus', 'drawActorFace',    'actorFace',    3, null, 5, 6);
  wrapDraw(Window_MenuStatus, 'Window_MenuStatus', 'drawSimpleStatus', 'simpleStatus', 1, null, 3, null);

})();
