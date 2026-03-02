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
  // JSON 로드 헬퍼 — 동기 XHR (NW.js + 브라우저 양쪽 호환)
  //===========================================================================
  function loadJson(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url + '?_=' + Date.now(), false);
      xhr.send();
      if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
    } catch (e) {}
    return {};
  }

  var _config = loadJson('data/UIEditorConfig.json');
  var _skins  = loadJson('data/UIEditorSkins.json');
  var _fonts  = loadJson('data/UIEditorFonts.json');

  /** 스킨 bitmap URL에서 스킨 이름 추출 (img/system/ 이후 경로, 확장자 제거) */
  function skinNameFromBitmap(bitmap) {
    if (!bitmap || !bitmap.url) return null;
    var m = bitmap.url.match(/img\/system\/(.+?)(?:\.(?:png|webp))?(?:\?.*)?$/i);
    if (m) return m[1];
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
    if (!Array.isArray(_skins.skins) || !id) return null;
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
  //===========================================================================
  function _winClassName(win) {
    return win._customClassName || (win.constructor && win.constructor.name);
  }

  function getThemeSkinEntry(win) {
    var skinId = (_ov[_winClassName(win)] || {}).skinId;
    if (skinId) return findSkinEntryById(skinId);
    return findSkinEntry(skinNameFromBitmap(win._themeSkin), 'defaultFrameSkin');
  }

  /** 커서 전용 스킨 항목 취득 — defaultCursorSkin 폴백 */
  function getThemeCursorEntry(win) {
    var skinId = (_ov[_winClassName(win)] || {}).skinId;
    if (skinId) return findSkinEntryById(skinId);
    return findSkinEntry(skinNameFromBitmap(win._themeSkin), 'defaultCursorSkin');
  }

  /** 렌더링용 스킨 비트맵 반환 (_themeSkin 우선, 없으면 _windowskin) */
  function getRenderSkin(win) {
    return win._themeSkin || win._windowskin;
  }

  //===========================================================================
  // _themeSkin 자동 로드 헬퍼 (refreshBack/refreshFrame 공통)
  //===========================================================================
  function _ensureThemeSkin(win, entryFile) {
    if (entryFile !== 'Window') {
      if (!win._themeSkin ||
          (win._themeSkin._url && win._themeSkin._url.indexOf(entryFile) === -1)) {
        win._themeSkin = ImageManager.loadSystem(entryFile);
      }
    }
  }

  //===========================================================================
  // 이미지 모드 — 렌더링 방식별 blt 헬퍼
  //===========================================================================
  function drawImageMode(bitmap, src, mode, w, h) {
    var iw = src.width, ih = src.height;
    if (iw <= 0 || ih <= 0) return;
    if (mode === 'stretch') {
      bitmap.blt(src, 0, 0, iw, ih, 0, 0, w, h);
    } else if (mode === 'tile') {
      for (var ty = 0; ty < h; ty += ih) {
        for (var tx = 0; tx < w; tx += iw) {
          var tw = Math.min(iw, w - tx);
          var th = Math.min(ih, h - ty);
          bitmap.blt(src, 0, 0, tw, th, tx, ty, tw, th);
        }
      }
    } else if (mode === 'fit') {
      var fitScale = Math.min(w / iw, h / ih);
      var fitW = Math.floor(iw * fitScale), fitH = Math.floor(ih * fitScale);
      bitmap.blt(src, 0, 0, iw, ih, Math.floor((w - fitW) / 2), Math.floor((h - fitH) / 2), fitW, fitH);
    } else if (mode === 'cover') {
      var covScale = Math.max(w / iw, h / ih);
      var covSW = Math.floor(w / covScale), covSH = Math.floor(h / covScale);
      bitmap.blt(src, Math.floor((iw - covSW) / 2), Math.floor((ih - covSH) / 2), covSW, covSH, 0, 0, w, h);
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
    var className = _winClassName(this);
    var ov = (_config.overrides || {})[className];
    // 이미지 모드 처리
    if (ov && ov.windowStyle === 'image') {
      var m = this._margin;
      var w = this._width - m * 2, h = this._height - m * 2;
      if (w <= 0 || h <= 0) return;
      if (!ov.imageFile) {
        var old = this._windowBackSprite._bitmap; if (old && old.destroy) old.destroy();
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
      if (!this._themeSkin ||
          (this._themeSkin._url && this._themeSkin._url.indexOf(ov.imageFile) === -1)) {
        this._themeSkin = ImageManager.loadSystem(ov.imageFile);
      }
      var src = this._themeSkin;
      if (!src || !src.isReady()) {
        if (src) src.addLoadListener(this._refreshAllParts.bind(this));
        return;
      }
      var old2 = this._windowBackSprite._bitmap; if (old2 && old2.destroy) old2.destroy();
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
    if (!entry) { return _Window_refreshBack.call(this); }
    _ensureThemeSkin(this, entry.file || 'Window');
    var renderSkin = getRenderSkin(this);
    if (!renderSkin || !renderSkin.isReady()) {
      if (renderSkin) renderSkin.addLoadListener(this._refreshAllParts.bind(this));
      return _Window_refreshBack.call(this);
    }
    var fill = getFillRect(entry);
    var m = this._margin;
    var w = this._width - m * 2;
    var h = this._height - m * 2;
    if (w <= 0 || h <= 0) return;
    var old3 = this._windowBackSprite._bitmap; if (old3 && old3.destroy) old3.destroy();
    var bitmap = new Bitmap(w, h);
    this._windowBackSprite.bitmap = bitmap;
    this._windowBackSprite.setFrame(0, 0, w, h);
    this._windowBackSprite.move(m, m);
    bitmap.blt(renderSkin, fill.x, fill.y, fill.w, fill.h, 0, 0, w, h);
    var tone = this._colorTone;
    bitmap.adjustTone(tone[0], tone[1], tone[2]);
  };

  //===========================================================================
  // Window — 9-slice プレーム커스터마이징 (_refreshFrame 오버라이드)
  //===========================================================================
  var _Window_refreshFrame = Window.prototype._refreshFrame;
  Window.prototype._refreshFrame = function () {
    var className = _winClassName(this);
    var ov = (_config.overrides || {})[className];
    // 이미지 모드: 프레임 그리지 않음 (빈 비트맵)
    if (ov && ov.windowStyle === 'image') {
      var w = this._width, h = this._height;
      if (w > 0 && h > 0) {
        var oldF1 = this._windowFrameSprite._bitmap; if (oldF1 && oldF1.destroy) oldF1.destroy();
        this._windowFrameSprite.bitmap = new Bitmap(w, h);
        this._windowFrameSprite.setFrame(0, 0, w, h);
      }
      return;
    }
    var entry = getThemeSkinEntry(this);
    if (!entry) { return _Window_refreshFrame.call(this); }
    _ensureThemeSkin(this, entry.file || 'Window');
    var renderSkin = getRenderSkin(this);
    if (!renderSkin || !renderSkin.isReady()) {
      if (renderSkin) renderSkin.addLoadListener(this._refreshAllParts.bind(this));
      return _Window_refreshFrame.call(this);
    }
    var f = getFrameInfo(entry);
    var w = this._width;
    var h = this._height;
    if (w <= 0 || h <= 0) return;
    var oldF2 = this._windowFrameSprite._bitmap; if (oldF2 && oldF2.destroy) oldF2.destroy();
    var bitmap = new Bitmap(w, h);
    this._windowFrameSprite.bitmap = bitmap;
    this._windowFrameSprite.setFrame(0, 0, w, h);
    var skin = renderSkin;
    var fx = f.x, fy = f.y, fw = f.w, fh = f.h, cs = f.cs;
    // top / bottom edges
    bitmap.blt(skin, fx + cs,      fy,           fw - cs * 2, cs,          cs,      0,      w - cs * 2, cs);
    bitmap.blt(skin, fx + cs,      fy + fh - cs, fw - cs * 2, cs,          cs,      h - cs, w - cs * 2, cs);
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
    if (this._cursorRect.width <= 0 || this._cursorRect.height <= 0) return;

    var p  = entry.cursorX;
    var q  = entry.cursorY;
    var nw = entry.cursorW;
    var nh = entry.cursorH;
    var m  = entry.cursorCornerSize !== undefined ? entry.cursorCornerSize : 4;

    var renderMode = entry.cursorRenderMode || 'nineSlice';
    var bitmap = getRenderSkin(this);
    if (!bitmap || !bitmap.isReady() || nw <= 0 || nh <= 0) return;
    if (!this._windowCursorSprite) return;

    var oldC = this._windowCursorSprite._bitmap; if (oldC && oldC.destroy) oldC.destroy();
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
        if (sw > 0 && sh > 0 && dw > 0 && dh > 0) dest.blt(bitmap, sx, sy, sw, sh, dx, dy, dw, dh);
      }
    }

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
    var blink = entry.cursorBlink !== false;
    var blinkCount = this._animationCount % 40;
    var opacity = this.contentsOpacity * (maxOpacity / 255);
    if (blink && this.active) {
      opacity -= (blinkCount < 20 ? blinkCount : 40 - blinkCount) * 8 * (maxOpacity / 255);
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
  function hasOv(className) { return !!_ov[className]; }

  /** 클래스별 오버라이드에서 값 취득 */
  function OV(className, key) { return (_ov[className] || {})[key]; }

  /** 런타임에서 _ov 업데이트 (에디터 원본값 가져오기 시 사용) */
  window._uiThemeUpdateOv = function(className, prop, value) {
    if (!_ov[className]) _ov[className] = { className: className };
    _ov[className][prop] = value;
  };

  /**
   * 창의 Three.js 오브젝트 전체 레이어 설정.
   * layer=0: OrthographicCamera(기본 UI), layer=1: UI PerspectiveCamera(3D 회전 효과)
   */
  function _setWindowLayer(win, layer) {
    if (win && win._threeObj && win._threeObj.traverse) {
      win._threeObj.traverse(function(child) { child.layers.set(layer); });
    }
  }
  window._uiSetWindowLayer = _setWindowLayer;

  /**
   * Perspective 카메라로 렌더링되는 창의 화면 좌표를 창 로컬 좌표로 역변환.
   * rotationX/Y가 있는 창의 마우스/터치 히트 테스트에 사용.
   */
  function _uiPerspScreenToLocal(win, sx, sy) {
    var threeObj = win && win._threeObj;
    var cam = window.Mode3D && Mode3D._uiPerspCamera;
    if (!threeObj || !cam || typeof THREE === 'undefined') return null;

    var w = Graphics.width || 816;
    var h = Graphics.height || 624;
    var ndcX = (sx / w) * 2 - 1;
    var ndcY = 1 - (sy / h) * 2;

    if (!_uiPerspScreenToLocal._rc) {
      _uiPerspScreenToLocal._rc  = new THREE.Raycaster();
      _uiPerspScreenToLocal._pl  = new THREE.Plane();
      _uiPerspScreenToLocal._n   = new THREE.Vector3();
      _uiPerspScreenToLocal._pt  = new THREE.Vector3();
      _uiPerspScreenToLocal._hit = new THREE.Vector3();
    }
    var rc  = _uiPerspScreenToLocal._rc;
    var pl  = _uiPerspScreenToLocal._pl;
    var n   = _uiPerspScreenToLocal._n;
    var pt  = _uiPerspScreenToLocal._pt;
    var hit = _uiPerspScreenToLocal._hit;

    rc.setFromCamera({ x: ndcX, y: ndcY }, cam);
    threeObj.updateMatrixWorld(true);
    n.set(0, 0, 1).transformDirection(threeObj.matrixWorld);
    threeObj.getWorldPosition(pt);
    pl.setFromNormalAndCoplanarPoint(n, pt);
    if (!rc.ray.intersectPlane(pl, hit)) return null;
    threeObj.worldToLocal(hit);
    return { x: hit.x, y: hit.y };
  }

  /**
   * Perspective 역변환 좌표로 hitTest + select/processOk 처리.
   */
  function _perspOnTouch(win, local, triggered) {
    var lastIndex = win.index();
    var hitIndex = win.hitTest(local.x, local.y);
    if (hitIndex >= 0) {
      if (hitIndex === win.index()) {
        if (triggered && win.isTouchOkEnabled()) win.processOk();
      } else if (win.isCursorMovable()) {
        win.select(hitIndex);
      }
    } else if (win._stayCount >= 10) {
      if (local.y < win.padding) {
        win.cursorUp();
      } else if (local.y >= win.height - win.padding) {
        win.cursorDown();
      }
    }
    if (win.index() !== lastIndex) SoundManager.playCursor();
  }

  /**
   * rotationX/Y가 있는 창에 Perspective 역변환 기반 히트 테스트를 적용.
   */
  function _applyPerspHitTest(win) {
    win.processTouch = function() {
      if (!this.isOpenAndActive()) {
        this._touching = false;
        return;
      }
      if (TouchInput.isTriggered()) {
        var local = _uiPerspScreenToLocal(this, TouchInput.x, TouchInput.y);
        if (local && local.x >= 0 && local.y >= 0 && local.x < this.width && local.y < this.height) {
          this._touching = true;
          _perspOnTouch(this, local, true);
        }
      } else if (TouchInput.isCancelled()) {
        if (this.isCancelEnabled()) this.processCancel();
      }
      if (this._touching) {
        if (TouchInput.isPressed()) {
          var local2 = _uiPerspScreenToLocal(this, TouchInput.x, TouchInput.y);
          if (local2) _perspOnTouch(this, local2, false);
        } else {
          this._touching = false;
        }
      }
    };

    var _origUpdate = win.update;
    win.update = function() {
      _origUpdate.call(this);
      _perspUpdateHoverDebug(this);
    };
  }

  // 마우스 이동 위치 별도 추적 (TouchInput._onMouseMove는 버튼 누름 상태에서만 업데이트됨)
  if (!window._uiPerspMouse) {
    window._uiPerspMouse = { x: 0, y: 0 };
    document.addEventListener('mousemove', function(e) {
      window._uiPerspMouse.x = Graphics.pageToCanvasX(e.pageX);
      window._uiPerspMouse.y = Graphics.pageToCanvasY(e.pageY);
    });
  }

  // 디버그 호버 박스 on/off 플래그 (콘솔에서 window._uiPerspHoverDebug = true 로 활성화)
  window._uiPerspHoverDebug = false;

  function _perspUpdateHoverDebug(win) {
    if (!window._uiPerspHoverDebug) {
      if (win._dbgHoverMesh) {
        win._threeObj.remove(win._dbgHoverMesh);
        win._dbgHoverMesh.geometry.dispose();
        win._dbgHoverMesh.material.dispose();
        win._dbgHoverMesh = null;
        win._dbgHoverIdx = undefined;
      }
      return;
    }
    if (!win._threeObj || typeof THREE === 'undefined') return;

    var local = null;
    if (win.isOpen()) {
      local = _uiPerspScreenToLocal(win, window._uiPerspMouse.x, window._uiPerspMouse.y);
    }
    var hitIdx = (local && local.x >= 0 && local.y >= 0 && local.x < win.width && local.y < win.height)
      ? win.hitTest(local.x, local.y) : -1;

    if (hitIdx === win._dbgHoverIdx) return;
    win._dbgHoverIdx = hitIdx;

    if (win._dbgHoverMesh) {
      win._threeObj.remove(win._dbgHoverMesh);
      win._dbgHoverMesh.geometry.dispose();
      win._dbgHoverMesh.material.dispose();
      win._dbgHoverMesh = null;
    }

    if (hitIdx < 0) return;

    var rect = win.itemRect(hitIdx);
    var geo = new THREE.PlaneGeometry(rect.width, rect.height);
    var mat = new THREE.MeshBasicMaterial({
      color: 0x00ff00, transparent: true, opacity: 0.5,
      depthTest: false, depthWrite: false, side: THREE.DoubleSide
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(rect.x + rect.width / 2, rect.y + rect.height / 2, 0.5);
    mesh.layers.set(1);
    mesh.renderOrder = 9000;
    win._threeObj.add(mesh);
    win._dbgHoverMesh = mesh;
  }

  /** _ov 항목 읽기 (preview.ts의 applyPropToWindow에서 사용) */
  window._uiGetOv = function(className) { return _ov[className] || {}; };

  /** 런타임에서 _ov 항목 삭제 (RMMV 기본값으로 리셋 시 사용) */
  window._uiThemeClearOv = function(className) { delete _ov[className]; };

  /** 모든 _ov 항목 삭제 (undo/redo 재적용 전 초기화용) */
  window._uiThemeClearAllOv = function() {
    Object.keys(_ov).forEach(function(k) { delete _ov[k]; });
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
      if (elemCfg.visible === false) return;
      var args = Array.prototype.slice.call(arguments);
      if (elemCfg.x !== undefined && argX !== null) args[argX] = elemCfg.x;
      if (elemCfg.y !== undefined && argY !== null) args[argY] = elemCfg.y;
      if (elemCfg.width !== undefined && argW !== null) args[argW] = elemCfg.width;
      if (elemCfg.height !== undefined && argH !== null) args[argH] = elemCfg.height;
      var prevFace = this.contents && this.contents.fontFace;
      if (elemCfg.fontFace && this.contents) this.contents.fontFace = elemCfg.fontFace;
      var result = orig.apply(this, args);
      if (elemCfg.fontFace && this.contents) this.contents.fontFace = prevFace;
      return result;
    };
  }

  //===========================================================================
  // Window_Base — 게이지 이미지 렌더링 (defaultGaugeSkin 지정 시)
  //===========================================================================
  function getGaugeSkinEntry() {
    var id = _skins.defaultGaugeSkin;
    if (!id) return null;
    return findSkinEntryById(id) || findSkinEntry(id);
  }

  var _WB_drawGauge = Window_Base.prototype.drawGauge;
  Window_Base.prototype.drawGauge = function (x, y, width, rate, color1, color2) {
    var entry = getGaugeSkinEntry();
    if (!entry) { _WB_drawGauge.call(this, x, y, width, rate, color1, color2); return; }
    var gaugeFileName = entry.gaugeFile || entry.file || entry.name;
    var gaugeBitmap = ImageManager.loadSystem(gaugeFileName);
    if (!gaugeBitmap || !gaugeBitmap.isReady()) {
      _WB_drawGauge.call(this, x, y, width, rate, color1, color2);
      return;
    }
    var bgX = entry.gaugeBgX || 0, bgY = entry.gaugeBgY || 0;
    var bgW = entry.gaugeBgW || 0, bgH = entry.gaugeBgH || 0;
    var fX  = entry.gaugeFillX || 0, fY  = entry.gaugeFillY || 0;
    var fW  = entry.gaugeFillW || 0, fH  = entry.gaugeFillH || 0;
    var dir = entry.gaugeFillDir || 'horizontal';
    var bmp = this.contents;
    if (bgW > 0 && bgH > 0) {
      bmp.blt(gaugeBitmap, bgX, bgY, bgW, bgH, x, y, width, bgH);
    }
    if (fW > 0 && fH > 0 && rate > 0) {
      if (dir === 'vertical') {
        var fillH = Math.floor(fH * rate);
        bmp.blt(gaugeBitmap, fX, fY + fH - fillH, fW, fillH, x, y + bgH - fillH, width, fillH);
      } else {
        bmp.blt(gaugeBitmap, fX, fY, Math.floor(fW * rate), fH, x, y, Math.floor(width * rate), fH);
      }
    }
  };

  //===========================================================================
  // Window_Base — 전역 스타일 (모든 Window에 적용)
  //===========================================================================

  Window_Base.prototype.standardFontSize   = function () { return G('fontSize',    28);  };
  Window_Base.prototype.standardPadding    = function () { return G('padding',     18);  };
  Window_Base.prototype.standardBackOpacity = function () { return G('backOpacity', 192); };

  // 현재 씬에 지정된 폰트 (Scene.create 시점에 설정)
  var _sceneFontFace = null;

  var _origStandardFontFace = Window_Base.prototype.standardFontFace;
  Window_Base.prototype.standardFontFace = function () {
    if (_sceneFontFace) return _sceneFontFace;
    if (_fonts.defaultFontFace) return _fonts.defaultFontFace;
    return _origStandardFontFace.call(this);
  };

  // Bitmap 기본 fontFace 오버라이드 — new Bitmap()으로 직접 그리는 플러그인(NPCNameDisplay 등)에도 적용
  var _origBitmapInit = Bitmap.prototype.initialize;
  Bitmap.prototype.initialize = function (width, height) {
    _origBitmapInit.call(this, width, height);
    var face = _sceneFontFace || _fonts.defaultFontFace;
    if (face) this.fontFace = face;
  };

  // 씬 시작 전(create) 씬별 폰트 설정 — Window들이 initialize되기 전에 적용해야 함
  var _origSceneBaseCreate = Scene_Base.prototype.create;
  Scene_Base.prototype.create = function () {
    _sceneFontFace = (_fonts.sceneFonts && _fonts.sceneFonts[this.constructor.name]) || null;
    _origSceneBaseCreate.call(this);
  };

  // 에디터 프리뷰에서 동적으로 폰트 설정 갱신 (refreshScene 전에 호출)
  window._uiThemeUpdateFonts = function(config) { if (config) _fonts = config; };

  // CustomSceneEngine 등에서 동적으로 창별 override 등록 (_customClassName key 사용)
  window._uiThemeSetWindowOverride = function(className, override) {
    if (!_config.overrides) _config.overrides = {};
    if (override !== null && override !== undefined) {
      _config.overrides[className] = override;
    } else {
      delete _config.overrides[className];
    }
  };

  Window_Base.prototype.loadWindowskin = function () {
    var skinId = _skins.defaultSkin || G('windowskin', 'Window');
    var entry = findSkinEntryById(skinId) || findSkinEntry(skinId);
    var skinFile = (entry && entry.file) ? entry.file : skinId;
    this.windowskin = ImageManager.loadSystem('Window');
    this._themeSkin = (skinFile !== 'Window') ? ImageManager.loadSystem(skinFile) : null;
  };

  // 전역 colorTone / opacity
  var _WB_initialize = Window_Base.prototype.initialize;
  Window_Base.prototype.initialize = function (x, y, width, height) {
    _WB_initialize.call(this, x, y, width, height);
    var tone = G('colorTone', null);
    if (Array.isArray(tone)) this.setTone(tone[0] || 0, tone[1] || 0, tone[2] || 0);
    var op = G('opacity', null);
    if (op !== null) this.opacity = op;
  };

  //===========================================================================
  // 헬퍼 — 클래스 프로토타입 스타일 오버라이드
  //===========================================================================
  function applyStyle(cls, className) {
    if (!cls || !hasOv(className)) return;
    var ov = _ov[className];

    if (ov.width     !== undefined) cls.prototype.windowWidth      = function () { return ov.width; };
    if (ov.height    !== undefined) cls.prototype.windowHeight     = function () { return ov.height; };
    if (ov.fontSize  !== undefined) cls.prototype.standardFontSize = function () { return ov.fontSize; };
    if (ov.fontFace  !== undefined) cls.prototype.standardFontFace = function () { return ov.fontFace; };
    if (ov.backOpacity !== undefined) cls.prototype.standardBackOpacity = function () { return ov.backOpacity; };
    if (ov.padding   !== undefined) cls.prototype.standardPadding  = function () { return ov.padding; };
    if (ov.windowskinName !== undefined || ov.imageFile !== undefined) {
      cls.prototype.loadWindowskin = function () {
        this.windowskin = ImageManager.loadSystem('Window');
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
  //===========================================================================
  function applyLayout(win, className) {
    if (!win || !hasOv(className)) return;
    var ov = _ov[className];

    if (!win._uiThemeOriginal) {
      win._uiThemeOriginal = { x: win.x, y: win.y, width: win.width, height: win.height };
    }

    if (ov.x !== undefined) win.x = ov.x;
    if (ov.y !== undefined) win.y = ov.y;

    var needResize = false;
    if (ov.width  !== undefined && win.width  !== ov.width)  { win.width  = ov.width;  needResize = true; }
    if (ov.height !== undefined && win.height !== ov.height) { win.height = ov.height; needResize = true; }
    if (needResize) {
      if (win.createContents) win.createContents();
      if (win.refresh) win.refresh();
    }

    if (ov.rotationX !== undefined) win.rotationX = ov.rotationX * Math.PI / 180;
    if (ov.rotationY !== undefined) win.rotationY = ov.rotationY * Math.PI / 180;
    if (ov.rotationZ !== undefined) win.rotation   = ov.rotationZ * Math.PI / 180;

    if (win.pivot) {
      var hasStaticRotXY = !!(ov.rotationX || ov.rotationY || ov.rotationZ);
      if (hasStaticRotXY) {
        var staticPv = _parsePivotAnchor(ov.animPivot || 'center', win.width, win.height);
        var ssx = ov.x !== undefined ? ov.x : win._uiThemeOriginal.x;
        var ssy = ov.y !== undefined ? ov.y : win._uiThemeOriginal.y;
        win.pivot.x = staticPv.x;
        win.pivot.y = staticPv.y;
        win.x = ssx + staticPv.x;
        win.y = ssy + staticPv.y;
      } else {
        win.pivot.x = 0;
        win.pivot.y = 0;
      }
    }

    var renderCam = ov.renderCamera;
    if (!renderCam && (ov.rotationX || ov.rotationY)) renderCam = 'perspective';
    _setWindowLayer(win, (renderCam || 'orthographic') === 'perspective' ? 1 : 0);

    if (ov.rotationX || ov.rotationY) _applyPerspHitTest(win);

    if (!window._uiEditorPreview && Array.isArray(ov.entrances) && ov.entrances.length > 0) {
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
  if (!OV('Window_MenuStatus',   'width'))  Window_MenuStatus.prototype.windowWidth    = function () { return Graphics.boxWidth - 240; };
  if (!OV('Window_MenuStatus',   'height')) Window_MenuStatus.prototype.windowHeight   = function () { return Graphics.boxHeight; };
  if (!OV('Window_ItemCategory', 'width'))  Window_ItemCategory.prototype.windowWidth  = function () { return Graphics.boxWidth; };
  if (!OV('Window_BattleStatus', 'width'))  Window_BattleStatus.prototype.windowWidth  = function () { return Graphics.boxWidth - 192; };
  if (!OV('Window_BattleEnemy',  'width'))  Window_BattleEnemy.prototype.windowWidth   = function () { return Graphics.boxWidth - 192; };
  if (!OV('Window_Message',      'width'))  Window_Message.prototype.windowWidth       = function () { return Graphics.boxWidth; };
  if (!OV('Window_BattleLog',    'width'))  Window_BattleLog.prototype.windowWidth     = function () { return Graphics.boxWidth; };

  //===========================================================================
  // 위치 오버라이드 — updatePlacement() 보유 클래스
  //===========================================================================
  function _wrapUpdatePlacement(cls, className) {
    if (!hasOv(className)) return;
    var _orig = cls.prototype.updatePlacement;
    cls.prototype.updatePlacement = function () {
      _orig.call(this);
      if (!this._uiThemeOriginal) {
        this._uiThemeOriginal = { x: this.x, y: this.y, width: this.width, height: this.height };
      }
      var x = OV(className, 'x'), y = OV(className, 'y');
      if (x !== undefined) this.x = x;
      if (y !== undefined) this.y = y;
    };
  }
  _wrapUpdatePlacement(Window_Options,      'Window_Options');
  _wrapUpdatePlacement(Window_TitleCommand, 'Window_TitleCommand');
  _wrapUpdatePlacement(Window_GameEnd,      'Window_GameEnd');

  //===========================================================================
  // 위치/크기 오버라이드 — Scene.create() 훅
  //===========================================================================
  function _hookSceneCreate(cls, fn) {
    var _orig = cls.prototype.create;
    cls.prototype.create = function () { _orig.call(this); fn.call(this); };
  }

  _hookSceneCreate(Scene_Map, function () {
    applyLayout(this._mapNameWindow, 'Window_MapName');
  });
  _hookSceneCreate(Scene_Menu, function () {
    applyLayout(this._goldWindow,    'Window_Gold');
    applyLayout(this._commandWindow, 'Window_MenuCommand');
    applyLayout(this._statusWindow,  'Window_MenuStatus');
  });
  _hookSceneCreate(Scene_Item, function () {
    applyLayout(this._helpWindow,     'Window_Help');
    applyLayout(this._categoryWindow, 'Window_ItemCategory');
    applyLayout(this._itemWindow,     'Window_ItemList');
  });
  _hookSceneCreate(Scene_Skill, function () {
    applyLayout(this._helpWindow,      'Window_Help');
    applyLayout(this._skillTypeWindow, 'Window_SkillType');
    applyLayout(this._statusWindow,    'Window_SkillStatus');
    applyLayout(this._itemWindow,      'Window_SkillList');
  });
  _hookSceneCreate(Scene_Equip, function () {
    applyLayout(this._helpWindow,    'Window_Help');
    applyLayout(this._statusWindow,  'Window_EquipStatus');
    applyLayout(this._commandWindow, 'Window_EquipCommand');
    applyLayout(this._slotWindow,    'Window_EquipSlot');
    applyLayout(this._itemWindow,    'Window_EquipItem');
  });
  _hookSceneCreate(Scene_Status, function () {
    applyLayout(this._statusWindow, 'Window_Status');
  });
  _hookSceneCreate(Scene_Options, function () {
    applyLayout(this._optionsWindow, 'Window_Options');
  });
  _hookSceneCreate(Scene_File, function () {
    applyLayout(this._helpWindow, 'Window_Help');
    applyLayout(this._listWindow, 'Window_SavefileList');
  });
  _hookSceneCreate(Scene_Shop, function () {
    applyLayout(this._helpWindow,    'Window_Help');
    applyLayout(this._goldWindow,    'Window_Gold');
    applyLayout(this._commandWindow, 'Window_ShopCommand');
    applyLayout(this._buyWindow,     'Window_ShopBuy');
    applyLayout(this._sellWindow,    'Window_ShopSell');
    applyLayout(this._numberWindow,  'Window_ShopNumber');
    applyLayout(this._statusWindow,  'Window_ShopStatus');
  });
  _hookSceneCreate(Scene_Name, function () {
    applyLayout(this._editWindow,  'Window_NameEdit');
    applyLayout(this._inputWindow, 'Window_NameInput');
  });
  _hookSceneCreate(Scene_GameEnd, function () {
    applyLayout(this._commandWindow, 'Window_GameEnd');
  });
  _hookSceneCreate(Scene_Battle, function () {
    applyLayout(this._logWindow,          'Window_BattleLog');
    applyLayout(this._partyCommandWindow, 'Window_PartyCommand');
    applyLayout(this._actorCommandWindow, 'Window_ActorCommand');
    applyLayout(this._statusWindow,       'Window_BattleStatus');
    applyLayout(this._actorWindow,        'Window_BattleActor');
    applyLayout(this._enemyWindow,        'Window_BattleEnemy');
    applyLayout(this._skillWindow,        'Window_BattleSkill');
    applyLayout(this._itemWindow,         'Window_BattleItem');
    applyLayout(this._helpWindow,         'Window_Help');
  });

  //===========================================================================
  // 요소 오버라이드 — 각 Window 내 draw 메서드 위치/크기 커스터마이징
  //===========================================================================

  // ── Window_Status (single layout) ─────────────────────────────────────────
  wrapDraw(Window_Status, 'Window_Status', 'drawActorName',     'actorName',     1, 2, 3, null);
  wrapDraw(Window_Status, 'Window_Status', 'drawActorClass',    'actorClass',    1, 2, 3, null);
  wrapDraw(Window_Status, 'Window_Status', 'drawActorNickname', 'actorNickname', 1, 2, 3, null);
  wrapDraw(Window_Status, 'Window_Status', 'drawActorFace',     'actorFace',     1, 2, 3, 4);
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
  wrapDraw(Window_MenuStatus, 'Window_MenuStatus', 'drawActorFace',    'actorFace',    1, null, 3, 4);
  wrapDraw(Window_MenuStatus, 'Window_MenuStatus', 'drawSimpleStatus', 'simpleStatus', 1, null, 3, null);

  // ── 제네릭 요소 fontFace 지원: createContents 훅 ──────────────────────────
  var ELEM_TYPE_TO_METHOD = {
    actorName: 'drawActorName', actorClass: 'drawActorClass',
    actorNickname: 'drawActorNickname', actorFace: 'drawActorFace',
    actorLevel: 'drawActorLevel', actorIcons: 'drawActorIcons',
    actorHp: 'drawActorHp', actorMp: 'drawActorMp', actorTp: 'drawActorTp',
    simpleStatus: 'drawSimpleStatus',
  };

  var _origWindowBaseCreateContents = Window_Base.prototype.createContents;
  Window_Base.prototype.createContents = function () {
    _origWindowBaseCreateContents.call(this);
    var classOv = _ov[this.constructor.name];
    if (!classOv || !classOv.elements) return;
    var self = this;
    Object.keys(classOv.elements).forEach(function (elemType) {
      var elemCfg = classOv.elements[elemType];
      if (!elemCfg || (!elemCfg.fontFace && elemCfg.visible !== false)) return;
      var methodName = ELEM_TYPE_TO_METHOD[elemType] || elemType;
      if (typeof self[methodName] !== 'function') return;
      if (self.hasOwnProperty(methodName)) return;
      var orig = self[methodName];
      self[methodName] = (function (fn, cfg) {
        return function () {
          if (cfg.visible === false) return;
          var prevFace = this.contents && this.contents.fontFace;
          if (cfg.fontFace && this.contents) this.contents.fontFace = cfg.fontFace;
          var r = fn.apply(this, arguments);
          if (cfg.fontFace && this.contents) this.contents.fontFace = prevFace;
          return r;
        };
      })(orig, elemCfg);
    });
  };

  //===========================================================================
  // 창 등장 효과 (Entrance Animation)
  //===========================================================================

  /** 이징 함수 */
  var _EASE_FNS = {
    linear:    function (t) { return t; },
    easeIn:    function (t) { return t * t; },
    easeInOut: function (t) { return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t); },
    bounce: function (t) {
      if (t < 1 / 2.75)        return 7.5625 * t * t;
      if (t < 2 / 2.75)        return 7.5625 * (t -= 1.5   / 2.75) * t + 0.75;
      if (t < 2.5 / 2.75)      return 7.5625 * (t -= 2.25  / 2.75) * t + 0.9375;
      return                           7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    },
  };
  function uiEase(t, easing) {
    t = Math.max(0, Math.min(1, t));
    var fn = _EASE_FNS[easing];
    return fn ? fn(t) : 1 - (1 - t) * (1 - t); // default: easeOut
  }

  /** animPivot 앵커명 → {x, y} 픽셀 좌표 변환 (w/h 기준) */
  var _ANCHOR_MAP = {
    'top-left':    [0,   0  ], 'top':    [0.5, 0  ], 'top-right':    [1,   0  ],
    'left':        [0,   0.5], 'center': [0.5, 0.5], 'right':        [1,   0.5],
    'bottom-left': [0,   1  ], 'bottom': [0.5, 1  ], 'bottom-right': [1,   1  ],
  };
  function _parsePivotAnchor(anchor, w, h) {
    var a = _ANCHOR_MAP[anchor] || [0.5, 0.5];
    return { x: Math.floor((w || 0) * a[0]), y: Math.floor((h || 0) * a[1]) };
  }

  /** pivot 설정 공통 헬퍼 (entrance/exit 공통) */
  function _setupAnimPivot(win, effects, className, screenX, screenY) {
    var needPivot = effects.some(function (e) {
      return e.type === 'zoom' || e.type === 'rotate' || e.type === 'bounce' ||
             e.type === 'rotateX' || e.type === 'rotateY';
    });
    var pivotX = 0, pivotY = 0;
    if (needPivot && win.pivot) {
      var pv = _parsePivotAnchor((_ov[className] && _ov[className].animPivot) || 'center', win.width, win.height);
      pivotX = pv.x; pivotY = pv.y;
      win.pivot.x = pivotX;
      win.pivot.y = pivotY;
      win.x = screenX + pivotX;
      win.y = screenY + pivotY;
    }
    return { pivotX: pivotX, pivotY: pivotY };
  }

  /** 등장 애니메이션 시작 — applyLayout 후 호출 */
  function startEntranceAnimation(win, entrances, className) {
    if (!entrances || entrances.length === 0) return;
    var originalX = win.x, originalY = win.y;
    var pv = _setupAnimPivot(win, entrances, className, originalX, originalY);
    win._uiEntrance = {
      effects: entrances, elapsed: 0,
      screenX: originalX, screenY: originalY,
      baseX: win.x, baseY: win.y,
      baseAlpha: win.alpha !== undefined ? win.alpha : 1,
      baseRotation: win.rotation || 0,
      baseRotationX: win.rotationX !== undefined ? win.rotationX : 0,
      baseRotationY: win.rotationY !== undefined ? win.rotationY : 0,
      pivotX: pv.pivotX, pivotY: pv.pivotY,
      className: className,
    };
    _applyEntranceFrame(win, 0);
  }

  /** Graphics サイズ取得 */
  function _gfxSize() {
    return {
      sw: typeof Graphics !== 'undefined' ? Graphics.width  : 816,
      sh: typeof Graphics !== 'undefined' ? Graphics.height : 624,
    };
  }

  /** 매 프레임 등장 상태 계산 및 적용 */
  function _applyEntranceFrame(win, elapsed) {
    var state = win._uiEntrance;
    if (!state) return;
    var effects = state.effects;
    var totalX = state.screenX, totalY = state.screenY;
    var totalAlpha = 1, totalScaleX = 1, totalScaleY = 1;
    var totalRotation = 0, totalRotationX = 0, totalRotationY = 0;
    var gs = _gfxSize();

    for (var i = 0; i < effects.length; i++) {
      var eff = effects[i];
      var localElapsed = elapsed - (eff.delay || 0);
      var p = localElapsed <= 0 ? 0 : uiEase(Math.min(localElapsed / eff.duration, 1), eff.easing);
      var angle;
      switch (eff.type) {
        case 'fade': case 'fadeIn':  totalAlpha *= p; break;
        case 'fadeOut':              totalAlpha *= (1 - p); break;
        case 'slideLeft':   totalX = state.screenX - (1 - p) * (state.screenX + gs.sw); break;
        case 'slideRight':  totalX = state.screenX + (1 - p) * gs.sw; break;
        case 'slideTop':    totalY = state.screenY - (1 - p) * (state.screenY + gs.sh); break;
        case 'slideBottom': totalY = state.screenY + (1 - p) * gs.sh; break;
        case 'zoom': case 'bounce': {
          var from = eff.fromScale !== undefined ? eff.fromScale : 0;
          var s = from + p * (1 - from);
          totalScaleX *= s; totalScaleY *= s; break;
        }
        case 'rotate':  angle = eff.fromAngle !== undefined ? eff.fromAngle : 180; totalRotation  += angle * (1 - p) * Math.PI / 180; break;
        case 'rotateX': angle = eff.fromAngle !== undefined ? eff.fromAngle : 90;  totalRotationX += angle * (1 - p) * Math.PI / 180; break;
        case 'rotateY': angle = eff.fromAngle !== undefined ? eff.fromAngle : 90;  totalRotationY += angle * (1 - p) * Math.PI / 180; break;
      }
    }

    win.alpha = state.baseAlpha * totalAlpha;
    win.x = Math.round(totalX) + state.pivotX;
    win.y = Math.round(totalY) + state.pivotY;
    if (win.scale) { win.scale.x = totalScaleX; win.scale.y = totalScaleY; }
    win.rotation = (state.baseRotation || 0) + totalRotation;
    if (win.rotationX !== undefined) win.rotationX = (state.baseRotationX || 0) + totalRotationX;
    if (win.rotationY !== undefined) win.rotationY = (state.baseRotationY || 0) + totalRotationY;
  }

  /** 등장/퇴장 애니메이션이 완전히 끝났는지 확인 */
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
        this.rotation = xs.baseRotation || 0;
        if (this.rotationX !== undefined) this.rotationX = xs.baseRotationX || 0;
        if (this.rotationY !== undefined) this.rotationY = xs.baseRotationY || 0;
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
      this.rotation = state.baseRotation || 0;
      if (this.rotationX !== undefined) this.rotationX = state.baseRotationX || 0;
      if (this.rotationY !== undefined) this.rotationY = state.baseRotationY || 0;
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
    var screenX = getWinScreenX(win);
    var screenY = getWinScreenY(win);
    var pv = _setupAnimPivot(win, exits, className, screenX, screenY);
    win._uiEntrance = null;
    win._uiExit = {
      effects: exits, elapsed: 0,
      screenX: screenX, screenY: screenY,
      baseAlpha: win.alpha !== undefined ? win.alpha : 1,
      baseRotation: win.rotation || 0,
      baseRotationX: win.rotationX !== undefined ? win.rotationX : 0,
      baseRotationY: win.rotationY !== undefined ? win.rotationY : 0,
      pivotX: pv.pivotX, pivotY: pv.pivotY,
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
    var totalAlpha = 1, totalScaleX = 1, totalScaleY = 1;
    var totalRotation = 0, totalRotationX = 0, totalRotationY = 0;
    var gs = _gfxSize();

    for (var i = 0; i < effects.length; i++) {
      var eff = effects[i];
      var localElapsed = elapsed - (eff.delay || 0);
      // p: 0=시작(원래 상태) → 1=끝(사라진 상태)
      var p = localElapsed <= 0 ? 0 : uiEase(Math.min(localElapsed / eff.duration, 1), eff.easing);
      var angle;
      switch (eff.type) {
        case 'fade': case 'fadeOut': totalAlpha *= (1 - p); break;
        case 'fadeIn':               totalAlpha *= p; break;
        case 'slideLeft':   totalX = state.screenX - p * (state.screenX + gs.sw); break;
        case 'slideRight':  totalX = state.screenX + p * gs.sw; break;
        case 'slideTop':    totalY = state.screenY - p * (state.screenY + gs.sh); break;
        case 'slideBottom': totalY = state.screenY + p * gs.sh; break;
        case 'zoom': case 'bounce': {
          var to = eff.fromScale !== undefined ? eff.fromScale : 0;
          var s = 1 - p * (1 - to);
          totalScaleX *= s; totalScaleY *= s; break;
        }
        case 'rotate':  angle = eff.fromAngle !== undefined ? eff.fromAngle : 180; totalRotation  += angle * p * Math.PI / 180; break;
        case 'rotateX': angle = eff.fromAngle !== undefined ? eff.fromAngle : 90;  totalRotationX += angle * p * Math.PI / 180; break;
        case 'rotateY': angle = eff.fromAngle !== undefined ? eff.fromAngle : 90;  totalRotationY += angle * p * Math.PI / 180; break;
      }
    }

    win.alpha = state.baseAlpha * totalAlpha;
    win.x = Math.round(totalX) + ((win.pivot && win.pivot.x) || 0);
    win.y = Math.round(totalY) + ((win.pivot && win.pivot.y) || 0);
    if (win.scale) { win.scale.x = totalScaleX; win.scale.y = totalScaleY; }
    win.rotation = (state.baseRotation || 0) + totalRotation;
    if (win.rotationX !== undefined) win.rotationX = (state.baseRotationX || 0) + totalRotationX;
    if (win.rotationY !== undefined) win.rotationY = (state.baseRotationY || 0) + totalRotationY;
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
      if (this._uiExitElapsed >= this._uiExitMaxMs) this._uiExiting = false;
    }
  };

  //===========================================================================
  // postMessage — 에디터에서 미리보기 트리거
  //===========================================================================
  window.addEventListener('message', function (e) {
    var data = e.data;
    if (!data || !data.type) return;
    var scene = typeof SceneManager !== 'undefined' ? SceneManager._scene : null;
    if (!scene) return;

    if (data.type === 'previewEntrance') {
      collectSceneWindows(scene).forEach(function (win) {
        var className = win.constructor && win.constructor.name;
        if (data.className && className !== data.className) return;
        var ov = (data.override && data.override.className === className)
          ? data.override : (_config.overrides || {})[className];
        if (!ov || !Array.isArray(ov.entrances) || ov.entrances.length === 0) return;
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
    } else if (data.type === 'previewExit') {
      collectSceneWindows(scene).forEach(function (win) {
        var className = win.constructor && win.constructor.name;
        if (data.className && className !== data.className) return;
        var ov = (data.override && data.override.className === className)
          ? data.override : (_config.overrides || {})[className];
        if (!ov || !Array.isArray(ov.exits) || ov.exits.length === 0) return;
        win._uiEntrance = null;
        startExitAnimation(win, ov.exits, className);
      });
    }
  });

  // CustomSceneEngine.js 등 외부에서 스킨 배열에 접근할 수 있도록 전역 노출
  window.UIEditorSkins = _skins.skins || [];

})();
