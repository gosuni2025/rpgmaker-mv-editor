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
      xhr.open('GET', 'data/UIEditorConfig.json?_=' + Date.now(), false);
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
      xhr.open('GET', 'data/UIEditorSkins.json?_=' + Date.now(), false);
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
  function findSkinEntry(skinName, defaultKey) {
    if (!Array.isArray(_skins.skins)) return null;
    var name = skinName || (defaultKey && _skins[defaultKey]) || _skins.defaultSkin;
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
  // 창별 테마 스킨 항목 취득 헬퍼
  // windowskin은 항상 원본 'Window' 이미지(textColor 팔레트용)로 유지하고,
  // 커스텀 스킨 이미지는 _themeSkin에 분리 저장하여 렌더링에만 사용한다.
  //===========================================================================
  function getThemeSkinEntry(win) {
    var className = win.constructor && win.constructor.name;
    var skinId = className ? ((_config.overrides || {})[className] || {}).skinId : undefined;
    if (skinId) return findSkinEntryById(skinId);
    var themeSkinName = skinNameFromBitmap(win._themeSkin);
    return findSkinEntry(themeSkinName, 'defaultFrameSkin');
  }

  /** 커서 전용 스킨 항목 취득 — defaultCursorSkin 폴백 */
  function getThemeCursorEntry(win) {
    var className = win.constructor && win.constructor.name;
    var skinId = className ? ((_config.overrides || {})[className] || {}).skinId : undefined;
    if (skinId) return findSkinEntryById(skinId);
    var themeSkinName = skinNameFromBitmap(win._themeSkin);
    return findSkinEntry(themeSkinName, 'defaultCursorSkin');
  }

  /** 렌더링용 스킨 비트맵 반환 (_themeSkin 우선, 없으면 _windowskin) */
  function getRenderSkin(win) {
    return win._themeSkin || win._windowskin;
  }

  //===========================================================================
  // 이미지 모드 — 렌더링 방식별 blt 헬퍼
  //===========================================================================
  function drawImageMode(bitmap, src, mode, w, h) {
    var iw = src.width, ih = src.height;
    if (iw <= 0 || ih <= 0) return;
    if (mode === 'stretch') {
      // 늘림: 이미지를 창 크기로 강제 늘림
      bitmap.blt(src, 0, 0, iw, ih, 0, 0, w, h);
    } else if (mode === 'tile') {
      // 타일 반복: 이미지를 패턴처럼 반복
      for (var ty = 0; ty < h; ty += ih) {
        for (var tx = 0; tx < w; tx += iw) {
          var tw = Math.min(iw, w - tx);
          var th = Math.min(ih, h - ty);
          bitmap.blt(src, 0, 0, tw, th, tx, ty, tw, th);
        }
      }
    } else if (mode === 'fit') {
      // 비율 맞춤: 비율 유지하며 창 안에 맞춤 (빈 가장자리 생길 수 있음)
      var fitScale = Math.min(w / iw, h / ih);
      var fitW = Math.floor(iw * fitScale), fitH = Math.floor(ih * fitScale);
      var fitX = Math.floor((w - fitW) / 2), fitY = Math.floor((h - fitH) / 2);
      bitmap.blt(src, 0, 0, iw, ih, fitX, fitY, fitW, fitH);
    } else if (mode === 'cover') {
      // 비율 채움: 비율 유지하며 꽉 채움 (가장자리 잘릴 수 있음)
      var covScale = Math.max(w / iw, h / ih);
      var covSW = Math.floor(w / covScale), covSH = Math.floor(h / covScale);
      var covSX = Math.floor((iw - covSW) / 2), covSY = Math.floor((ih - covSH) / 2);
      bitmap.blt(src, covSX, covSY, covSW, covSH, 0, 0, w, h);
    } else {
      // center (기본): 원본 크기로 중앙 배치, 창 밖 영역 클리핑
      var ox = Math.floor((w - iw) / 2), oy = Math.floor((h - ih) / 2);
      var sx = 0, sy = 0, sw = iw, sh = ih;
      var dx = ox, dy = oy, dw = iw, dh = ih;
      if (dx < 0) { sx -= dx; sw += dx; dw += dx; dx = 0; }
      if (dy < 0) { sy -= dy; sh += dy; dh += dy; dy = 0; }
      if (dx + dw > w) { sw -= (dx + dw - w); dw = w - dx; }
      if (dy + dh > h) { sh -= (dy + dh - h); dh = h - dy; }
      if (sw > 0 && sh > 0 && dw > 0 && dh > 0) bitmap.blt(src, sx, sy, sw, sh, dx, dy, dw, dh);
    }
  }

  //===========================================================================
  // Window — fill 영역 커스터마이징 (_refreshBack 오버라이드)
  //===========================================================================
  var _Window_refreshBack = Window.prototype._refreshBack;
  Window.prototype._refreshBack = function () {
    var className = this.constructor && this.constructor.name;
    var ov = (_config.overrides || {})[className];
    // 이미지 모드 처리
    if (ov && ov.windowStyle === 'image') {
      var m = this._margin;
      var w = this._width - m * 2, h = this._height - m * 2;
      if (w <= 0 || h <= 0) return;
      // imageFile이 없으면 "No Image" 안내 표시
      if (!ov.imageFile) {
        var noBitmap = new Bitmap(w, h);
        this._windowBackSprite.bitmap = noBitmap;
        this._windowBackSprite.setFrame(0, 0, w, h);
        this._windowBackSprite.move(m, m);
        noBitmap.fillRect(0, 0, w, h, '#1a1a1a');
        var fs = Math.max(10, Math.min(18, Math.floor(h / 5)));
        noBitmap.fontSize = fs;
        noBitmap.textColor = '#555555';
        noBitmap.drawText('No Image', 0, Math.floor((h - fs) / 2), w, fs + 4, 'center');
        return;
      }
      // _themeSkin이 imageFile과 다르면 (모드 전환 직후 등) 다시 로드
      if (!this._themeSkin ||
          (this._themeSkin._url && this._themeSkin._url.indexOf(ov.imageFile) === -1)) {
        this._themeSkin = ImageManager.loadSystem(ov.imageFile);
      }
      var src = this._themeSkin;
      if (!src || !src.isReady()) {
        if (src) src.addLoadListener(this._refreshAllParts.bind(this));
        return;
      }
      var bitmap = new Bitmap(w, h);
      this._windowBackSprite.bitmap = bitmap;
      this._windowBackSprite.setFrame(0, 0, w, h);
      this._windowBackSprite.move(m, m);
      drawImageMode(bitmap, src, ov.imageRenderMode || 'center', w, h);
      var tone = this._colorTone;
      if (tone) bitmap.adjustTone(tone[0], tone[1], tone[2]);
      return;
    }
    var entry = getThemeSkinEntry(this);
    // 스킨 항목이 없으면 원본 호출
    if (!entry) {
      return _Window_refreshBack.call(this);
    }
    // 스킨 파일이 Window.png가 아닌 경우 _themeSkin 자동 로드
    var entryFile = entry.file || 'Window';
    if (entryFile !== 'Window') {
      if (!this._themeSkin ||
          (this._themeSkin._url && this._themeSkin._url.indexOf(entryFile) === -1)) {
        this._themeSkin = ImageManager.loadSystem(entryFile);
      }
    }
    var renderSkin = getRenderSkin(this);
    // renderSkin 미로드 시 원본 렌더링 fallback + 로드 완료 후 재렌더링
    if (!renderSkin || !renderSkin.isReady()) {
      if (renderSkin) renderSkin.addLoadListener(this._refreshAllParts.bind(this));
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
    bitmap.blt(renderSkin, fill.x, fill.y, fill.w, fill.h, 0, 0, w, h);
    var tone = this._colorTone;
    bitmap.adjustTone(tone[0], tone[1], tone[2]);
  };

  //===========================================================================
  // Window — 9-slice 프레임 커스터마이징 (_refreshFrame 오버라이드)
  //===========================================================================
  var _Window_refreshFrame = Window.prototype._refreshFrame;
  Window.prototype._refreshFrame = function () {
    var className = this.constructor && this.constructor.name;
    var ov = (_config.overrides || {})[className];
    // 이미지 모드: 프레임 그리지 않음 (빈 비트맵)
    if (ov && ov.windowStyle === 'image') {
      var w = this._width, h = this._height;
      if (w > 0 && h > 0) {
        this._windowFrameSprite.bitmap = new Bitmap(w, h);
        this._windowFrameSprite.setFrame(0, 0, w, h);
      }
      return;
    }
    var entry = getThemeSkinEntry(this);
    // 스킨 항목이 없으면 원본 호출
    if (!entry) {
      return _Window_refreshFrame.call(this);
    }
    // 스킨 파일이 Window.png가 아닌 경우 _themeSkin 자동 로드
    var entryFile = entry.file || 'Window';
    if (entryFile !== 'Window') {
      if (!this._themeSkin ||
          (this._themeSkin._url && this._themeSkin._url.indexOf(entryFile) === -1)) {
        this._themeSkin = ImageManager.loadSystem(entryFile);
      }
    }
    var renderSkin = getRenderSkin(this);
    // renderSkin 미로드 시 원본 렌더링 fallback + 로드 완료 후 재렌더링
    if (!renderSkin || !renderSkin.isReady()) {
      if (renderSkin) renderSkin.addLoadListener(this._refreshAllParts.bind(this));
      return _Window_refreshFrame.call(this);
    }
    var f = getFrameInfo(entry);
    var w = this._width;
    var h = this._height;
    if (w <= 0 || h <= 0) return;
    var bitmap = new Bitmap(w, h);
    this._windowFrameSprite.bitmap = bitmap;
    this._windowFrameSprite.setFrame(0, 0, w, h);
    var skin = renderSkin;
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
  };

  //===========================================================================
  // Window — 커서 9-slice 커스터마이징 (_refreshCursor 오버라이드)
  //===========================================================================
  var _Window_refreshCursor = Window.prototype._refreshCursor;
  Window.prototype._refreshCursor = function () {
    var entry = getThemeCursorEntry(this);
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
    var bitmap = getRenderSkin(this);
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

  /** 런타임에서 _ov 업데이트 (에디터 원본값 가져오기 시 사용) */
  window._uiThemeUpdateOv = function(className, prop, value) {
    if (!_ov[className]) _ov[className] = { className: className };
    _ov[className][prop] = value;
  };

  /** 런타임에서 _ov 항목 삭제 (RMMV 기본값으로 리셋 시 사용) */
  window._uiThemeClearOv = function(className) {
    delete _ov[className];
  };

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
    var skinFile = (entry && entry.file) ? entry.file : skinId;
    // textColor 팔레트용 windowskin은 항상 원본 'Window' 이미지 유지
    this.windowskin = ImageManager.loadSystem('Window');
    // 커스텀 스킨 이미지를 _themeSkin에 별도 보관 (렌더링용)
    this._themeSkin = (skinFile !== 'Window') ? ImageManager.loadSystem(skinFile) : null;
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
    if (ov.windowskinName !== undefined || ov.imageFile !== undefined) {
      cls.prototype.loadWindowskin = function () {
        // textColor 팔레트용 windowskin은 항상 원본 'Window' 이미지 유지
        this.windowskin = ImageManager.loadSystem('Window');
        // image 모드는 imageFile, frame/default 모드는 windowskinName 사용
        var skinFile = ov.windowStyle === 'image' ? ov.imageFile : ov.windowskinName;
        this._themeSkin = skinFile && skinFile !== 'Window'
          ? ImageManager.loadSystem(skinFile) : null;
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

    // 오버라이드 적용 전 RMMV 원본값 보존 (최초 1회)
    if (!win._uiThemeOriginal) {
      win._uiThemeOriginal = { x: win.x, y: win.y, width: win.width, height: win.height };
    }

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

    // 등장 효과 시작
    if (Array.isArray(ov.entrances) && ov.entrances.length > 0) {
      startEntranceAnimation(win, ov.entrances, className);
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
      // RMMV 원본값 보존 (오버라이드 적용 전, 최초 1회)
      if (!this._uiThemeOriginal) {
        this._uiThemeOriginal = { x: this.x, y: this.y, width: this.width, height: this.height };
      }
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
      if (!this._uiThemeOriginal) {
        this._uiThemeOriginal = { x: this.x, y: this.y, width: this.width, height: this.height };
      }
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
      if (!this._uiThemeOriginal) {
        this._uiThemeOriginal = { x: this.x, y: this.y, width: this.width, height: this.height };
      }
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

  //===========================================================================
  // 창 등장 효과 (Entrance Animation)
  //===========================================================================

  /** 이징 함수 */
  function uiEase(t, easing) {
    t = Math.max(0, Math.min(1, t));
    switch (easing) {
      case 'linear':   return t;
      case 'easeIn':   return t * t;
      case 'easeInOut':return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
      case 'bounce':
        if (t < 1 / 2.75)       return 7.5625 * t * t;
        else if (t < 2 / 2.75)  return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        else if (t < 2.5 / 2.75)return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        else                     return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
      default: /* easeOut */     return 1 - (1 - t) * (1 - t);
    }
  }

  /** 등장 애니메이션 시작 — applyLayout 후 호출 */
  function startEntranceAnimation(win, entrances, className) {
    if (!entrances || entrances.length === 0) return;

    // zoom / bounce / rotate 효과가 있으면 창 중심 pivot 설정
    var needPivot = entrances.some(function (e) {
      return e.type === 'zoom' || e.type === 'rotate' || e.type === 'bounce' ||
             e.type === 'rotateX' || e.type === 'rotateY';
    });
    var pivotX = 0, pivotY = 0;
    var originalX = win.x, originalY = win.y;
    if (needPivot && win.pivot) {
      pivotX = Math.floor((win.width || 0) / 2);
      pivotY = Math.floor((win.height || 0) / 2);
      win.pivot.x = pivotX;
      win.pivot.y = pivotY;
      // pivot 변경 시 화면 위치 보정
      win.x = originalX + pivotX;
      win.y = originalY + pivotY;
    }

    win._uiEntrance = {
      effects: entrances,
      elapsed: 0,
      screenX: originalX,          // 원래 화면 좌표 (slide 기준)
      screenY: originalY,
      baseX: win.x,                // pivot 보정 후 x
      baseY: win.y,
      baseAlpha: win.alpha !== undefined ? win.alpha : 1,
      pivotX: pivotX,
      pivotY: pivotY,
      className: className,
    };
    _applyEntranceFrame(win, 0);
  }

  /** 매 프레임 등장 상태 계산 및 적용 */
  function _applyEntranceFrame(win, elapsed) {
    var state = win._uiEntrance;
    if (!state) return;

    var effects = state.effects;
    // slide 계산은 pivot 보정 전 화면 좌표 기준
    var totalX = state.screenX, totalY = state.screenY;
    var totalAlpha = 1;
    var totalScaleX = 1, totalScaleY = 1;
    var totalRotation = 0, totalRotationX = 0, totalRotationY = 0;
    var sw = (typeof Graphics !== 'undefined' ? Graphics.width : 816);
    var sh = (typeof Graphics !== 'undefined' ? Graphics.height : 624);

    for (var i = 0; i < effects.length; i++) {
      var eff = effects[i];
      var delay = eff.delay || 0;
      var localElapsed = elapsed - delay;
      var p = localElapsed <= 0 ? 0 : uiEase(Math.min(localElapsed / eff.duration, 1), eff.easing);

      switch (eff.type) {
        case 'fade': case 'fadeIn':
          totalAlpha *= p;
          break;
        case 'fadeOut':
          totalAlpha *= (1 - p);
          break;
        // 화면 크기 기준: win.width/height 의존 제거
        case 'slideLeft':
          totalX = state.screenX - (1 - p) * (state.screenX + sw);
          break;
        case 'slideRight':
          totalX = state.screenX + (1 - p) * sw;
          break;
        case 'slideTop':
          totalY = state.screenY - (1 - p) * (state.screenY + sh);
          break;
        case 'slideBottom':
          totalY = state.screenY + (1 - p) * sh;
          break;
        case 'zoom':
        case 'bounce': {
          var from = (eff.fromScale !== undefined ? eff.fromScale : 0);
          var s = from + p * (1 - from);
          totalScaleX *= s; totalScaleY *= s;
          break;
        }
        case 'rotate': {
          var angle = (eff.fromAngle !== undefined ? eff.fromAngle : 180);
          totalRotation += angle * (1 - p) * Math.PI / 180;
          break;
        }
        case 'rotateX': {
          var angle = (eff.fromAngle !== undefined ? eff.fromAngle : 90);
          totalRotationX += angle * (1 - p) * Math.PI / 180;
          break;
        }
        case 'rotateY': {
          var angle = (eff.fromAngle !== undefined ? eff.fromAngle : 90);
          totalRotationY += angle * (1 - p) * Math.PI / 180;
          break;
        }
      }
    }

    // 전체 alpha — win.alpha로 컨텐츠 포함 모든 자식에 적용
    win.alpha = state.baseAlpha * totalAlpha;
    // 위치: pivot 보정 복원
    win.x = Math.round(totalX) + state.pivotX;
    win.y = Math.round(totalY) + state.pivotY;
    if (win.scale) { win.scale.x = totalScaleX; win.scale.y = totalScaleY; }
    win.rotation = totalRotation;
    if (win.rotationX !== undefined) win.rotationX = totalRotationX;
    if (win.rotationY !== undefined) win.rotationY = totalRotationY;
  }

  /** 등장 애니메이션이 완전히 끝났는지 확인 */
  function _isEntranceDone(elapsed, effects) {
    for (var i = 0; i < effects.length; i++) {
      if (elapsed < (effects[i].delay || 0) + effects[i].duration) return false;
    }
    return true;
  }

  /** Window_Base.prototype.update 훅 — 매 프레임 등장/퇴장 애니메이션 처리 */
  var _WB_update = Window_Base.prototype.update;
  Window_Base.prototype.update = function () {
    _WB_update.call(this);

    // ── 퇴장 ──
    if (this._uiExit) {
      var xs = this._uiExit;
      xs.elapsed += 1000 / 60;
      if (_isEntranceDone(xs.elapsed, xs.effects)) {
        this.alpha = 0;
        this.rotation = 0;
        if (this.rotationX !== undefined) this.rotationX = 0;
        if (this.rotationY !== undefined) this.rotationY = 0;
        this._uiExit = null;
      } else {
        _applyExitFrame(this, xs.elapsed);
      }
    }

    // ── 등장 ──
    if (!this._uiEntrance) return;
    var state = this._uiEntrance;
    state.elapsed += 1000 / 60;
    if (_isEntranceDone(state.elapsed, state.effects)) {
      // 최종값으로 정리 + pivot 복원
      if (this.pivot && state.pivotX) {
        this.pivot.x = 0; this.pivot.y = 0;
        this.x = state.screenX;
        this.y = state.screenY;
      } else {
        this.x = state.baseX;
        this.y = state.baseY;
      }
      this.alpha = state.baseAlpha;
      if (this.scale) { this.scale.x = 1; this.scale.y = 1; }
      this.rotation = 0;
      if (this.rotationX !== undefined) this.rotationX = 0;
      if (this.rotationY !== undefined) this.rotationY = 0;
      this._uiEntrance = null;
    } else {
      _applyEntranceFrame(this, state.elapsed);
    }
  };

  //===========================================================================
  // 퇴장 애니메이션 (exit)
  //===========================================================================

  /** 창의 현재 화면 좌표 취득 (pivot 보정 포함) */
  function getWinScreenX(win) { return win.x - (win.pivot ? win.pivot.x : 0); }
  function getWinScreenY(win) { return win.y - (win.pivot ? win.pivot.y : 0); }

  /** 퇴장 애니메이션 시작 */
  function startExitAnimation(win, exits, className) {
    if (!exits || exits.length === 0) return;

    var needPivot = exits.some(function (e) {
      return e.type === 'zoom' || e.type === 'rotate' || e.type === 'bounce' ||
             e.type === 'rotateX' || e.type === 'rotateY';
    });
    var pivotX = 0, pivotY = 0;
    var screenX = getWinScreenX(win);
    var screenY = getWinScreenY(win);
    if (needPivot && win.pivot) {
      pivotX = Math.floor((win.width || 0) / 2);
      pivotY = Math.floor((win.height || 0) / 2);
      win.pivot.x = pivotX;
      win.pivot.y = pivotY;
      win.x = screenX + pivotX;
      win.y = screenY + pivotY;
    }

    win._uiEntrance = null; // 등장 중이었으면 취소
    win._uiExit = {
      effects: exits,
      elapsed: 0,
      screenX: screenX,
      screenY: screenY,
      baseAlpha: win.alpha !== undefined ? win.alpha : 1,
      pivotX: pivotX,
      pivotY: pivotY,
      className: className,
    };
    _applyExitFrame(win, 0);
  }

  /** 퇴장 프레임 적용 (등장의 반대 방향) */
  function _applyExitFrame(win, elapsed) {
    var state = win._uiExit;
    if (!state) return;

    var effects = state.effects;
    var totalX = state.screenX, totalY = state.screenY;
    var totalAlpha = 1;
    var totalScaleX = 1, totalScaleY = 1;
    var totalRotation = 0, totalRotationX = 0, totalRotationY = 0;
    var sw = (typeof Graphics !== 'undefined' ? Graphics.width : 816);
    var sh = (typeof Graphics !== 'undefined' ? Graphics.height : 624);

    for (var i = 0; i < effects.length; i++) {
      var eff = effects[i];
      var delay = eff.delay || 0;
      var localElapsed = elapsed - delay;
      // p: 0=시작(원래 상태) → 1=끝(사라진 상태)
      var p = localElapsed <= 0 ? 0 : uiEase(Math.min(localElapsed / eff.duration, 1), eff.easing);

      switch (eff.type) {
        case 'fade': case 'fadeOut':
          totalAlpha *= (1 - p);
          break;
        case 'fadeIn':
          totalAlpha *= p;
          break;
        case 'slideLeft':
          totalX = state.screenX - p * (state.screenX + sw);
          break;
        case 'slideRight':
          totalX = state.screenX + p * sw;
          break;
        case 'slideTop':
          totalY = state.screenY - p * (state.screenY + sh);
          break;
        case 'slideBottom':
          totalY = state.screenY + p * sh;
          break;
        case 'zoom':
        case 'bounce': {
          var to = (eff.fromScale !== undefined ? eff.fromScale : 0);
          var s = 1 - p * (1 - to);
          totalScaleX *= s; totalScaleY *= s;
          break;
        }
        case 'rotate': {
          var angle = (eff.fromAngle !== undefined ? eff.fromAngle : 180);
          totalRotation += angle * p * Math.PI / 180;
          break;
        }
        case 'rotateX': {
          var angle = (eff.fromAngle !== undefined ? eff.fromAngle : 90);
          totalRotationX += angle * p * Math.PI / 180;
          break;
        }
        case 'rotateY': {
          var angle = (eff.fromAngle !== undefined ? eff.fromAngle : 90);
          totalRotationY += angle * p * Math.PI / 180;
          break;
        }
      }
    }

    win.alpha = state.baseAlpha * totalAlpha;
    win.x = Math.round(totalX) + state.pivotX;
    win.y = Math.round(totalY) + state.pivotY;
    if (win.scale) { win.scale.x = totalScaleX; win.scale.y = totalScaleY; }
    win.rotation = totalRotation;
    if (win.rotationX !== undefined) win.rotationX = totalRotationX;
    if (win.rotationY !== undefined) win.rotationY = totalRotationY;
  }

  //===========================================================================
  // 씬 퇴장 시 exit 애니메이션 자동 실행
  //===========================================================================

  /** 씬 컨테이너에서 Window_Base 인스턴스 수집 */
  function collectSceneWindows(scene) {
    var wins = [];
    function traverse(obj) {
      if (!obj || !obj.children) return;
      for (var i = 0; i < obj.children.length; i++) {
        var child = obj.children[i];
        if (child instanceof Window_Base) wins.push(child);
        traverse(child);
      }
    }
    traverse(scene);
    return wins;
  }

  /** 씬에 exit 애니메이션 시작, 최대 duration 반환 (ms) */
  function startSceneExitAnimations(scene) {
    var wins = collectSceneWindows(scene);
    var maxMs = 0;
    wins.forEach(function (win) {
      var className = win.constructor && win.constructor.name;
      var ov = (_config.overrides || {})[className];
      if (ov && Array.isArray(ov.exits) && ov.exits.length > 0) {
        startExitAnimation(win, ov.exits, className);
        var dur = ov.exits.reduce(function (acc, e) {
          return Math.max(acc, (e.delay || 0) + e.duration);
        }, 0);
        maxMs = Math.max(maxMs, dur);
      }
    });
    return maxMs;
  }

  var _SBase_stop = Scene_Base.prototype.stop;
  Scene_Base.prototype.stop = function () {
    _SBase_stop.call(this);
    var maxMs = startSceneExitAnimations(this);
    if (maxMs > 0) {
      this._uiExiting = true;
      this._uiExitMaxMs = maxMs;
      this._uiExitElapsed = 0;
    }
  };

  var _SBase_isBusy = Scene_Base.prototype.isBusy;
  Scene_Base.prototype.isBusy = function () {
    if (this._uiExiting) return true;
    return _SBase_isBusy.call(this);
  };

  var _SBase_update = Scene_Base.prototype.update;
  Scene_Base.prototype.update = function () {
    _SBase_update.call(this);
    if (this._uiExiting) {
      this._uiExitElapsed += 1000 / 60;
      if (this._uiExitElapsed >= this._uiExitMaxMs) {
        this._uiExiting = false;
      }
    }
  };

  //===========================================================================
  // postMessage — 에디터에서 미리보기 트리거
  //===========================================================================
  window.addEventListener('message', function (e) {
    var data = e.data;
    if (!data || !data.type) return;

    if (data.type === 'previewEntrance') {
      var scene = typeof SceneManager !== 'undefined' ? SceneManager._scene : null;
      if (!scene) return;
      collectSceneWindows(scene).forEach(function (win) {
        var className = win.constructor && win.constructor.name;
        if (data.className && className !== data.className) return;
        var ov = (data.override && data.override.className === className)
          ? data.override : (_config.overrides || {})[className];
        if (!ov || !Array.isArray(ov.entrances) || ov.entrances.length === 0) return;
        // 기존 애니메이션/pivot 초기화
        if (win._uiEntrance && win.pivot) {
          win.pivot.x = 0; win.pivot.y = 0;
          win.x = win._uiEntrance.screenX;
          win.y = win._uiEntrance.screenY;
        }
        win._uiEntrance = null;
        win._uiExit = null;
        win.alpha = 1;
        if (win.scale) { win.scale.x = 1; win.scale.y = 1; }
        win.rotation = 0;
        startEntranceAnimation(win, ov.entrances, className);
      });
      return;
    }

    if (data.type === 'previewExit') {
      var scene = typeof SceneManager !== 'undefined' ? SceneManager._scene : null;
      if (!scene) return;
      collectSceneWindows(scene).forEach(function (win) {
        var className = win.constructor && win.constructor.name;
        if (data.className && className !== data.className) return;
        var ov = (data.override && data.override.className === className)
          ? data.override : (_config.overrides || {})[className];
        if (!ov || !Array.isArray(ov.exits) || ov.exits.length === 0) return;
        win._uiEntrance = null;
        startExitAnimation(win, ov.exits, className);
      });
      return;
    }
  });

})();
