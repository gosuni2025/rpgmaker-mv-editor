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

  // 동기 XHR (NW.js + 브라우저 양쪽 호환)
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
  var _ov     = _config.overrides || {};

  function skinNameFromBitmap(bitmap) {
    if (!bitmap || !bitmap.url) return null;
    var m = bitmap.url.match(/img\/system\/(.+?)(?:\.(?:png|webp))?(?:\?.*)?$/i);
    if (m) return m[1];
    var m2 = bitmap.url.match(/([^/\\]+?)(?:\.(?:png|webp))?(?:\?.*)?$/i);
    return m2 ? m2[1] : null;
  }

  function findSkinEntry(skinName, defaultKey) {
    if (!Array.isArray(_skins.skins)) return null;
    var name = skinName || (defaultKey && _skins[defaultKey]) || _skins.defaultSkin;
    if (!name) return null;
    return _skins.skins.filter(function (s) { return (s.file || s.name) === name; })[0] || null;
  }

  function findSkinEntryById(id) {
    if (!Array.isArray(_skins.skins) || !id) return null;
    return _skins.skins.filter(function (s) { return s.name === id; })[0] || null;
  }

  function getFillRect(entry) {
    if (typeof entry === 'string') entry = findSkinEntryById(entry);
    if (!entry) return { x: 0, y: 0, w: 96, h: 96 };
    return { x: entry.fillX || 0, y: entry.fillY || 0,
             w: entry.fillW !== undefined ? entry.fillW : 96,
             h: entry.fillH !== undefined ? entry.fillH : 96 };
  }

  function getFrameInfo(entry) {
    if (typeof entry === 'string') entry = findSkinEntryById(entry);
    if (!entry) return { x: 96, y: 0, w: 96, h: 96, cs: 24 };
    return { x: entry.frameX !== undefined ? entry.frameX : 96,
             y: entry.frameY || 0,
             w: entry.frameW !== undefined ? entry.frameW : 96,
             h: entry.frameH !== undefined ? entry.frameH : 96,
             cs: entry.cornerSize !== undefined ? entry.cornerSize : 24 };
  }

  function _winClassName(win) { return win._customClassName || (win.constructor && win.constructor.name); }

  function _skinEntry(win, defaultKey) {
    var skinId = (_ov[_winClassName(win)] || {}).skinId;
    if (skinId) return findSkinEntryById(skinId);
    return findSkinEntry(skinNameFromBitmap(win._themeSkin), defaultKey);
  }
  function getThemeSkinEntry(win)   { return _skinEntry(win, 'defaultFrameSkin'); }
  function getThemeCursorEntry(win) { return _skinEntry(win, 'defaultCursorSkin'); }
  function getRenderSkin(win)       { return win._themeSkin || win._windowskin; }

  function _ensureThemeSkin(win, entryFile) {
    if (entryFile !== 'Window' &&
        (!win._themeSkin || (win._themeSkin._url && win._themeSkin._url.indexOf(entryFile) === -1))) {
      win._themeSkin = ImageManager.loadSystem(entryFile);
    }
  }

  function drawImageMode(bitmap, src, mode, w, h) {
    var iw = src.width, ih = src.height;
    if (iw <= 0 || ih <= 0) return;
    if (mode === 'stretch') {
      bitmap.blt(src, 0, 0, iw, ih, 0, 0, w, h);
    } else if (mode === 'tile') {
      for (var ty = 0; ty < h; ty += ih)
        for (var tx = 0; tx < w; tx += iw)
          bitmap.blt(src, 0, 0, Math.min(iw, w-tx), Math.min(ih, h-ty), tx, ty, Math.min(iw, w-tx), Math.min(ih, h-ty));
    } else if (mode === 'fit') {
      var fs = Math.min(w/iw, h/ih), fw = Math.floor(iw*fs), fh = Math.floor(ih*fs);
      bitmap.blt(src, 0, 0, iw, ih, Math.floor((w-fw)/2), Math.floor((h-fh)/2), fw, fh);
    } else if (mode === 'cover') {
      var cs = Math.max(w/iw, h/ih), csw = Math.floor(w/cs), csh = Math.floor(h/cs);
      bitmap.blt(src, Math.floor((iw-csw)/2), Math.floor((ih-csh)/2), csw, csh, 0, 0, w, h);
    } else {
      // center: 원본 크기로 중앙 배치, 창 밖 영역 클리핑
      var ox = Math.floor((w-iw)/2), oy = Math.floor((h-ih)/2);
      var sx = 0, sy = 0, sw = iw, sh = ih, dx = ox, dy = oy, dw = iw, dh = ih;
      if (dx < 0) { sx -= dx; sw += dx; dw += dx; dx = 0; }
      if (dy < 0) { sy -= dy; sh += dy; dh += dy; dy = 0; }
      if (dx+dw > w) { sw -= (dx+dw-w); dw = w-dx; }
      if (dy+dh > h) { sh -= (dy+dh-h); dh = h-dy; }
      if (sw > 0 && sh > 0 && dw > 0 && dh > 0) bitmap.blt(src, sx, sy, sw, sh, dx, dy, dw, dh);
    }
  }

  function _destroyBmp(sp) { var o=sp._bitmap; if(o&&o.destroy) o.destroy(); }

  // entry 취득 + themeSkin 로드 + isReady 확인. 준비된 renderSkin 반환, 실패 시 null
  function _getSkinReady(win, entry) {
    _ensureThemeSkin(win, entry.file || 'Window');
    var sk = getRenderSkin(win);
    if (!sk || !sk.isReady()) { if (sk) sk.addLoadListener(win._refreshAllParts.bind(win)); return null; }
    return sk;
  }

  var _Window_refreshBack = Window.prototype._refreshBack;
  Window.prototype._refreshBack = function () {
    var ov = (_config.overrides || {})[_winClassName(this)];
    var m = this._margin, w = this._width-m*2, h = this._height-m*2;
    if (ov && ov.windowStyle === 'image') {
      if (w<=0||h<=0) return;
      _destroyBmp(this._windowBackSprite);
      if (!ov.imageFile) {
        var nb=new Bitmap(w,h);
        this._windowBackSprite.bitmap=nb; this._windowBackSprite.setFrame(0,0,w,h); this._windowBackSprite.move(m,m);
        nb.fillRect(0,0,w,h,'#1a1a1a');
        var fs=Math.max(10,Math.min(18,Math.floor(h/5)));
        nb.fontSize=fs; nb.textColor='#555555'; nb.drawText('No Image',0,Math.floor((h-fs)/2),w,fs+4,'center');
        return;
      }
      if (!this._themeSkin||(this._themeSkin._url&&this._themeSkin._url.indexOf(ov.imageFile)===-1))
        this._themeSkin=ImageManager.loadSystem(ov.imageFile);
      var src=this._themeSkin;
      if (!src||!src.isReady()) { if(src) src.addLoadListener(this._refreshAllParts.bind(this)); return; }
      var bmp=new Bitmap(w,h);
      this._windowBackSprite.bitmap=bmp; this._windowBackSprite.setFrame(0,0,w,h); this._windowBackSprite.move(m,m);
      drawImageMode(bmp,src,ov.imageRenderMode||'center',w,h);
      var t=this._colorTone; if(t) bmp.adjustTone(t[0],t[1],t[2]);
      return;
    }
    var entry=getThemeSkinEntry(this);
    if (!entry) { return _Window_refreshBack.call(this); }
    var sk=_getSkinReady(this,entry); if(!sk) { return _Window_refreshBack.call(this); }
    if (w<=0||h<=0) return;
    _destroyBmp(this._windowBackSprite);
    var fill=getFillRect(entry), bmp2=new Bitmap(w,h);
    this._windowBackSprite.bitmap=bmp2; this._windowBackSprite.setFrame(0,0,w,h); this._windowBackSprite.move(m,m);
    bmp2.blt(sk,fill.x,fill.y,fill.w,fill.h,0,0,w,h);
    var t2=this._colorTone; bmp2.adjustTone(t2[0],t2[1],t2[2]);
  };

  var _Window_refreshFrame = Window.prototype._refreshFrame;
  Window.prototype._refreshFrame = function () {
    var ov = (_config.overrides || {})[_winClassName(this)];
    var w = this._width, h = this._height;
    if (ov && ov.windowStyle === 'image') {
      if (w>0&&h>0) { _destroyBmp(this._windowFrameSprite); this._windowFrameSprite.bitmap=new Bitmap(w,h); this._windowFrameSprite.setFrame(0,0,w,h); }
      return;
    }
    var entry=getThemeSkinEntry(this);
    if (!entry) { return _Window_refreshFrame.call(this); }
    var sk=_getSkinReady(this,entry); if(!sk) { return _Window_refreshFrame.call(this); }
    if (w<=0||h<=0) return;
    _destroyBmp(this._windowFrameSprite);
    var bmp=new Bitmap(w,h);
    this._windowFrameSprite.bitmap=bmp; this._windowFrameSprite.setFrame(0,0,w,h);
    var f=getFrameInfo(entry),fx=f.x,fy=f.y,fw=f.w,fh=f.h,cs=f.cs;
    // top/bottom edges
    bmp.blt(sk,fx+cs,fy,fw-cs*2,cs,cs,0,w-cs*2,cs); bmp.blt(sk,fx+cs,fy+fh-cs,fw-cs*2,cs,cs,h-cs,w-cs*2,cs);
    // left/right edges
    bmp.blt(sk,fx,fy+cs,cs,fh-cs*2,0,cs,cs,h-cs*2); bmp.blt(sk,fx+fw-cs,fy+cs,cs,fh-cs*2,w-cs,cs,cs,h-cs*2);
    // corners
    bmp.blt(sk,fx,fy,cs,cs,0,0,cs,cs); bmp.blt(sk,fx+fw-cs,fy,cs,cs,w-cs,0,cs,cs);
    bmp.blt(sk,fx,fy+fh-cs,cs,cs,0,h-cs,cs,cs); bmp.blt(sk,fx+fw-cs,fy+fh-cs,cs,cs,w-cs,h-cs,cs,cs);
  };

  var _Window_refreshCursor = Window.prototype._refreshCursor;
  Window.prototype._refreshCursor = function () {
    var entry = getThemeCursorEntry(this);
    if (!entry || entry.cursorX === undefined) { return _Window_refreshCursor.call(this); }
    var pad = this._padding;
    var ox = this.origin ? this.origin.x : 0, oy = this.origin ? this.origin.y : 0;
    var cp = entry.cursorPadding !== undefined ? entry.cursorPadding : 2;
    var x = this._cursorRect.x + pad - ox - Math.floor(cp/2);
    var y = this._cursorRect.y + pad - oy - Math.floor(cp/2);
    var w = this._cursorRect.width + cp, h = this._cursorRect.height + cp;
    if (this._cursorRect.width <= 0 || this._cursorRect.height <= 0) return;
    var p = entry.cursorX, q = entry.cursorY, nw = entry.cursorW, nh = entry.cursorH;
    var m = entry.cursorCornerSize !== undefined ? entry.cursorCornerSize : 4;
    var bitmap = getRenderSkin(this);
    if (!bitmap || !bitmap.isReady() || nw <= 0 || nh <= 0 || !this._windowCursorSprite) return;
    _destroyBmp(this._windowCursorSprite);
    this._windowCursorSprite.bitmap = new Bitmap(w, h);
    var dest = this._windowCursorSprite.bitmap;
    var renderMode = entry.cursorRenderMode || 'nineSlice';
    if (renderMode === 'stretch') {
      dest.blt(bitmap, p, q, nw, nh, 0, 0, w, h);
    } else if (renderMode === 'tile') {
      for (var ty = 0; ty < h; ty += nh)
        for (var tx = 0; tx < w; tx += nw)
          dest.blt(bitmap, p, q, Math.min(nw,w-tx), Math.min(nh,h-ty), tx, ty, Math.min(nw,w-tx), Math.min(nh,h-ty));
    } else {
      // nineSlice (기본)
      if (m <= 0) m = 4;
      for (var i = 0; i < 9; i++) {
        var col = i%3, row = Math.floor(i/3);
        var sx = col===0 ? p : col===2 ? p+nw-m : p+m;
        var sy = row===0 ? q : row===2 ? q+nh-m : q+m;
        var sw = col===0||col===2 ? m : nw-m*2;
        var sh = row===0||row===2 ? m : nh-m*2;
        var dx = col===0 ? 0 : col===2 ? w-m : m;
        var dy = row===0 ? 0 : row===2 ? h-m : m;
        var dw = col===0||col===2 ? m : w-m*2;
        var dh = row===0||row===2 ? m : h-m*2;
        if (sw>0 && sh>0 && dw>0 && dh>0) dest.blt(bitmap, sx, sy, sw, sh, dx, dy, dw, dh);
      }
    }
    var tr = entry.cursorToneR||0, tg = entry.cursorToneG||0, tb = entry.cursorToneB||0;
    if (tr||tg||tb) dest.adjustTone(tr, tg, tb);
    var blendModeMap = { normal:0, add:1, multiply:2, screen:3 };
    this._windowCursorSprite.blendMode = blendModeMap[entry.cursorBlendMode||'normal'] || 0;
    this._windowCursorSprite.setFrame(0, 0, w, h);
    this._windowCursorSprite.move(x, y);
    // alpha は _updateCursor で毎フレーム更新
    this._windowCursorSprite.alpha = (entry.cursorOpacity !== undefined ? entry.cursorOpacity : 192) / 255;
    this._uiThemeCursorEntry = entry;
  };

  var _Window_updateCursor = Window.prototype._updateCursor;
  Window.prototype._updateCursor = function () {
    var entry = this._uiThemeCursorEntry;
    if (!entry || entry.cursorX === undefined) { return _Window_updateCursor.call(this); }
    var maxOp = entry.cursorOpacity !== undefined ? entry.cursorOpacity : 192;
    var blink = entry.cursorBlink !== false, bc = this._animationCount % 40;
    var opacity = this.contentsOpacity * (maxOp / 255);
    if (blink && this.active) opacity -= (bc < 20 ? bc : 40-bc) * 8 * (maxOp/255);
    this._windowCursorSprite.alpha   = Math.max(0, opacity) / 255;
    this._windowCursorSprite.visible = this.isOpen();
  };

  function G(key, def) { var g = _ov['Global']; return (g && g[key] !== undefined) ? g[key] : def; }
  function hasOv(cn)   { return !!_ov[cn]; }
  function OV(cn, key) { return (_ov[cn] || {})[key]; }

  window._uiThemeUpdateOv = function(cn, prop, val) {
    if (!_ov[cn]) _ov[cn] = { className: cn };
    _ov[cn][prop] = val;
  };

  function _setWindowLayer(win, layer) {
    if (win && win._threeObj && win._threeObj.traverse)
      win._threeObj.traverse(function(c) { c.layers.set(layer); });
  }
  window._uiSetWindowLayer = _setWindowLayer;

  // Perspective 카메라로 렌더링되는 창의 화면 좌표를 창 로컬 좌표로 역변환
  function _uiPerspScreenToLocal(win, sx, sy) {
    var threeObj = win && win._threeObj;
    var cam = window.Mode3D && Mode3D._uiPerspCamera;
    if (!threeObj || !cam || typeof THREE === 'undefined') return null;
    var ndcX = (sx / (Graphics.width||816)) * 2 - 1;
    var ndcY = 1 - (sy / (Graphics.height||624)) * 2;
    if (!_uiPerspScreenToLocal._rc) {
      _uiPerspScreenToLocal._rc  = new THREE.Raycaster();
      _uiPerspScreenToLocal._pl  = new THREE.Plane();
      _uiPerspScreenToLocal._n   = new THREE.Vector3();
      _uiPerspScreenToLocal._pt  = new THREE.Vector3();
      _uiPerspScreenToLocal._hit = new THREE.Vector3();
    }
    var rc = _uiPerspScreenToLocal._rc, pl = _uiPerspScreenToLocal._pl;
    var n  = _uiPerspScreenToLocal._n,  pt = _uiPerspScreenToLocal._pt, hit = _uiPerspScreenToLocal._hit;
    rc.setFromCamera({ x: ndcX, y: ndcY }, cam);
    threeObj.updateMatrixWorld(true);
    n.set(0, 0, 1).transformDirection(threeObj.matrixWorld);
    threeObj.getWorldPosition(pt);
    pl.setFromNormalAndCoplanarPoint(n, pt);
    if (!rc.ray.intersectPlane(pl, hit)) return null;
    threeObj.worldToLocal(hit);
    return { x: hit.x, y: hit.y };
  }

  function _perspOnTouch(win, local, triggered) {
    var li=win.index(), hi=win.hitTest(local.x,local.y);
    if (hi>=0) { if(hi===win.index()){if(triggered&&win.isTouchOkEnabled())win.processOk();}else if(win.isCursorMovable())win.select(hi); }
    else if (win._stayCount>=10) { if(local.y<win.padding)win.cursorUp();else if(local.y>=win.height-win.padding)win.cursorDown(); }
    if (win.index()!==li) SoundManager.playCursor();
  }

  function _applyPerspHitTest(win) {
    win.processTouch = function() {
      if (!this.isOpenAndActive()) { this._touching=false; return; }
      if (TouchInput.isTriggered()) {
        var l=_uiPerspScreenToLocal(this,TouchInput.x,TouchInput.y);
        if (l&&l.x>=0&&l.y>=0&&l.x<this.width&&l.y<this.height) { this._touching=true; _perspOnTouch(this,l,true); }
      } else if (TouchInput.isCancelled()) { if(this.isCancelEnabled())this.processCancel(); }
      if (this._touching) {
        if (TouchInput.isPressed()) { var l2=_uiPerspScreenToLocal(this,TouchInput.x,TouchInput.y); if(l2)_perspOnTouch(this,l2,false); }
        else this._touching=false;
      }
    };
    var _ou=win.update;
    win.update=function(){_ou.call(this);_perspUpdateHoverDebug(this);};
  }

  if (!window._uiPerspMouse) {
    window._uiPerspMouse = { x: 0, y: 0 };
    document.addEventListener('mousemove', function(e) {
      window._uiPerspMouse.x = Graphics.pageToCanvasX(e.pageX);
      window._uiPerspMouse.y = Graphics.pageToCanvasY(e.pageY);
    });
  }
  window._uiPerspHoverDebug = false;

  function _dbgMeshRemove(win) {
    if (!win._dbgHoverMesh) return;
    win._threeObj.remove(win._dbgHoverMesh);
    win._dbgHoverMesh.geometry.dispose(); win._dbgHoverMesh.material.dispose();
    win._dbgHoverMesh = null;
  }

  function _perspUpdateHoverDebug(win) {
    if (!window._uiPerspHoverDebug) { _dbgMeshRemove(win); win._dbgHoverIdx = undefined; return; }
    if (!win._threeObj || typeof THREE === 'undefined') return;
    var m = window._uiPerspMouse, local = win.isOpen() ? _uiPerspScreenToLocal(win, m.x, m.y) : null;
    var hitIdx = (local && local.x>=0 && local.y>=0 && local.x<win.width && local.y<win.height)
      ? win.hitTest(local.x, local.y) : -1;
    if (hitIdx === win._dbgHoverIdx) return;
    win._dbgHoverIdx = hitIdx; _dbgMeshRemove(win);
    if (hitIdx < 0) return;
    var rect = win.itemRect(hitIdx);
    var mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(rect.width, rect.height),
      new THREE.MeshBasicMaterial({ color:0x00ff00, transparent:true, opacity:0.5, depthTest:false, depthWrite:false, side:THREE.DoubleSide })
    );
    mesh.position.set(rect.x+rect.width/2, rect.y+rect.height/2, 0.5);
    mesh.layers.set(1); mesh.renderOrder = 9000;
    win._threeObj.add(mesh); win._dbgHoverMesh = mesh;
  }

  window._uiGetOv           = function(cn)   { return _ov[cn] || {}; };
  window._uiThemeClearOv    = function(cn)   { delete _ov[cn]; };
  window._uiThemeClearAllOv = function()     { Object.keys(_ov).forEach(function(k) { delete _ov[k]; }); };

  function getElem(cn, elemType) {
    var classOv = _ov[cn];
    return (classOv && classOv.elements) ? classOv.elements[elemType] || null : null;
  }

  function wrapDraw(cls, cn, method, elemType, argX, argY, argW, argH) {
    var cfg = getElem(cn, elemType);
    if (!cfg) return;
    var orig = cls.prototype[method];
    if (!orig) return;
    cls.prototype[method] = function () {
      if (cfg.visible === false) return;
      var args = Array.prototype.slice.call(arguments);
      if (cfg.x !== undefined && argX !== null) args[argX] = cfg.x;
      if (cfg.y !== undefined && argY !== null) args[argY] = cfg.y;
      if (cfg.width  !== undefined && argW !== null) args[argW] = cfg.width;
      if (cfg.height !== undefined && argH !== null) args[argH] = cfg.height;
      var pf = this.contents && this.contents.fontFace;
      if (cfg.fontFace && this.contents) this.contents.fontFace = cfg.fontFace;
      var r = orig.apply(this, args);
      if (cfg.fontFace && this.contents) this.contents.fontFace = pf;
      return r;
    };
  }

  var _WB_drawGauge = Window_Base.prototype.drawGauge;
  Window_Base.prototype.drawGauge = function (x, y, width, rate, color1, color2) {
    var gid=_skins.defaultGaugeSkin, entry=gid?(findSkinEntryById(gid)||findSkinEntry(gid)):null;
    if (!entry) { _WB_drawGauge.call(this, x, y, width, rate, color1, color2); return; }
    var gFile = entry.gaugeFile || entry.file || entry.name;
    var gb = ImageManager.loadSystem(gFile);
    if (!gb || !gb.isReady()) { _WB_drawGauge.call(this, x, y, width, rate, color1, color2); return; }
    var bgX=entry.gaugeBgX||0, bgY=entry.gaugeBgY||0, bgW=entry.gaugeBgW||0, bgH=entry.gaugeBgH||0;
    var fX=entry.gaugeFillX||0, fY=entry.gaugeFillY||0, fW=entry.gaugeFillW||0, fH=entry.gaugeFillH||0;
    var bmp = this.contents;
    if (bgW > 0 && bgH > 0) bmp.blt(gb, bgX, bgY, bgW, bgH, x, y, width, bgH);
    if (fW > 0 && fH > 0 && rate > 0) {
      if (entry.gaugeFillDir === 'vertical') {
        var fillH = Math.floor(fH*rate);
        bmp.blt(gb, fX, fY+fH-fillH, fW, fillH, x, y+bgH-fillH, width, fillH);
      } else {
        bmp.blt(gb, fX, fY, Math.floor(fW*rate), fH, x, y, Math.floor(width*rate), fH);
      }
    }
  };

  Window_Base.prototype.standardFontSize    = function () { return G('fontSize',    28);  };
  Window_Base.prototype.standardPadding     = function () { return G('padding',     18);  };
  Window_Base.prototype.standardBackOpacity = function () { return G('backOpacity', 192); };

  var _sceneFontFace = null;
  var _origSFF = Window_Base.prototype.standardFontFace;
  Window_Base.prototype.standardFontFace = function () {
    return _sceneFontFace || _fonts.defaultFontFace || _origSFF.call(this);
  };

  // new Bitmap()으로 직접 그리는 플러그인에도 폰트 적용
  var _origBitmapInit = Bitmap.prototype.initialize;
  Bitmap.prototype.initialize = function (w, h) {
    _origBitmapInit.call(this, w, h);
    var face = _sceneFontFace || _fonts.defaultFontFace;
    if (face) this.fontFace = face;
  };

  // Window들이 initialize되기 전에 씬별 폰트 적용
  var _origSBC = Scene_Base.prototype.create;
  Scene_Base.prototype.create = function () {
    _sceneFontFace = (_fonts.sceneFonts && _fonts.sceneFonts[this.constructor.name]) || null;
    _origSBC.call(this);
  };

  window._uiThemeUpdateFonts = function(cfg) { if (cfg) _fonts = cfg; };

  window._uiThemeSetWindowOverride = function(cn, override) {
    if (!_config.overrides) _config.overrides = {};
    if (override !== null && override !== undefined) _config.overrides[cn] = override;
    else delete _config.overrides[cn];
  };

  Window_Base.prototype.loadWindowskin = function () {
    var skinId = _skins.defaultSkin || G('windowskin', 'Window');
    var entry = findSkinEntryById(skinId) || findSkinEntry(skinId);
    var skinFile = (entry && entry.file) ? entry.file : skinId;
    this.windowskin = ImageManager.loadSystem('Window');
    this._themeSkin = (skinFile !== 'Window') ? ImageManager.loadSystem(skinFile) : null;
  };

  var _WB_initialize = Window_Base.prototype.initialize;
  Window_Base.prototype.initialize = function (x, y, w, h) {
    _WB_initialize.call(this, x, y, w, h);
    var tone = G('colorTone', null);
    if (Array.isArray(tone)) this.setTone(tone[0]||0, tone[1]||0, tone[2]||0);
    var op = G('opacity', null);
    if (op !== null) this.opacity = op;
  };

  function applyStyle(cls, cn) {
    if (!cls || !hasOv(cn)) return;
    var ov = _ov[cn], p = cls.prototype;
    if (ov.width       !== undefined) p.windowWidth        = function(){return ov.width;};
    if (ov.height      !== undefined) p.windowHeight       = function(){return ov.height;};
    if (ov.fontSize    !== undefined) p.standardFontSize   = function(){return ov.fontSize;};
    if (ov.fontFace    !== undefined) p.standardFontFace   = function(){return ov.fontFace;};
    if (ov.backOpacity !== undefined) p.standardBackOpacity= function(){return ov.backOpacity;};
    if (ov.padding     !== undefined) p.standardPadding    = function(){return ov.padding;};
    if (ov.windowskinName !== undefined || ov.imageFile !== undefined) {
      p.loadWindowskin = function() {
        this.windowskin = ImageManager.loadSystem('Window');
        var sf = ov.windowStyle==='image' ? ov.imageFile : ov.windowskinName;
        this._themeSkin = sf && sf!=='Window' ? ImageManager.loadSystem(sf) : null;
      };
    }
    if (ov.opacity !== undefined || ov.colorTone) {
      var _o = p.initialize;
      p.initialize = function() {
        _o.apply(this, arguments);
        if (ov.opacity!==undefined) this.opacity=ov.opacity;
        if (Array.isArray(ov.colorTone)) this.setTone(ov.colorTone[0]||0,ov.colorTone[1]||0,ov.colorTone[2]||0);
      };
    }
  }

  function applyLayout(win, cn) {
    if (!win || !hasOv(cn)) return;
    var ov = _ov[cn];
    if (!win._uiThemeOriginal) win._uiThemeOriginal = {x:win.x,y:win.y,width:win.width,height:win.height};
    if (ov.x!==undefined) win.x=ov.x; if (ov.y!==undefined) win.y=ov.y;
    var nr=false;
    if (ov.width !==undefined && win.width !==ov.width)  { win.width =ov.width;  nr=true; }
    if (ov.height!==undefined && win.height!==ov.height) { win.height=ov.height; nr=true; }
    if (nr) { if (win.createContents) win.createContents(); if (win.refresh) win.refresh(); }
    var D = Math.PI/180;
    if (ov.rotationX!==undefined) win.rotationX=ov.rotationX*D;
    if (ov.rotationY!==undefined) win.rotationY=ov.rotationY*D;
    if (ov.rotationZ!==undefined) win.rotation =ov.rotationZ*D;
    if (win.pivot) {
      if (ov.rotationX||ov.rotationY||ov.rotationZ) {
        var pv=_parsePivotAnchor(ov.animPivot||'center',win.width,win.height);
        win.pivot.x=pv.x; win.pivot.y=pv.y;
        win.x=(ov.x!==undefined?ov.x:win._uiThemeOriginal.x)+pv.x;
        win.y=(ov.y!==undefined?ov.y:win._uiThemeOriginal.y)+pv.y;
      } else { win.pivot.x=0; win.pivot.y=0; }
    }
    _setWindowLayer(win,(ov.renderCamera||(ov.rotationX||ov.rotationY?'perspective':'orthographic'))==='perspective'?1:0);
    if (ov.rotationX||ov.rotationY) _applyPerspHitTest(win);
    if (!window._uiEditorPreview && Array.isArray(ov.entrances) && ov.entrances.length>0)
      startEntranceAnimation(win,ov.entrances,cn);
  }

  ['Window_Gold','Window_Help','Window_MenuCommand','Window_MenuStatus','Window_ItemCategory',
   'Window_ItemList','Window_SkillType','Window_SkillStatus','Window_SkillList',
   'Window_EquipStatus','Window_EquipCommand','Window_EquipSlot','Window_EquipItem',
   'Window_Status','Window_Options','Window_SavefileList','Window_ShopCommand',
   'Window_ShopBuy','Window_ShopSell','Window_ShopNumber','Window_ShopStatus',
   'Window_NameEdit','Window_NameInput','Window_Message','Window_ScrollText',
   'Window_MapName','Window_BattleLog','Window_PartyCommand','Window_ActorCommand',
   'Window_BattleStatus','Window_BattleActor','Window_BattleEnemy','Window_TitleCommand','Window_GameEnd',
  ].forEach(function(cn) { applyStyle(window[cn], cn); });

  // Graphics 기반 기본값 — windowWidth/Height 원본 보존하면서 오버라이드
  if (!OV('Window_MenuStatus','width'))   Window_MenuStatus.prototype.windowWidth    = function(){return Graphics.boxWidth-240;};
  if (!OV('Window_MenuStatus','height'))  Window_MenuStatus.prototype.windowHeight   = function(){return Graphics.boxHeight;};
  if (!OV('Window_ItemCategory','width')) Window_ItemCategory.prototype.windowWidth  = function(){return Graphics.boxWidth;};
  if (!OV('Window_BattleStatus','width')) Window_BattleStatus.prototype.windowWidth  = function(){return Graphics.boxWidth-192;};
  if (!OV('Window_BattleEnemy','width'))  Window_BattleEnemy.prototype.windowWidth   = function(){return Graphics.boxWidth-192;};
  if (!OV('Window_Message','width'))      Window_Message.prototype.windowWidth       = function(){return Graphics.boxWidth;};
  if (!OV('Window_BattleLog','width'))    Window_BattleLog.prototype.windowWidth     = function(){return Graphics.boxWidth;};

  // updatePlacement 오버라이드 (Window_Options, Window_TitleCommand, Window_GameEnd)
  function _wupd(cls, cn) {
    if (!hasOv(cn)) return;
    var _o = cls.prototype.updatePlacement;
    cls.prototype.updatePlacement = function() {
      _o.call(this);
      if (!this._uiThemeOriginal)
        this._uiThemeOriginal = { x:this.x, y:this.y, width:this.width, height:this.height };
      var x=OV(cn,'x'), y=OV(cn,'y');
      if (x!==undefined) this.x=x; if (y!==undefined) this.y=y;
    };
  }
  _wupd(Window_Options,'Window_Options'); _wupd(Window_TitleCommand,'Window_TitleCommand'); _wupd(Window_GameEnd,'Window_GameEnd');

  // [SceneClass, [[winProp, WinClass], ...]]
  var SCENE_LAYOUTS = [
    [Scene_Map,     [['_mapNameWindow','Window_MapName']]],
    [Scene_Menu,    [['_goldWindow','Window_Gold'],['_commandWindow','Window_MenuCommand'],['_statusWindow','Window_MenuStatus']]],
    [Scene_Item,    [['_helpWindow','Window_Help'],['_categoryWindow','Window_ItemCategory'],['_itemWindow','Window_ItemList']]],
    [Scene_Skill,   [['_helpWindow','Window_Help'],['_skillTypeWindow','Window_SkillType'],['_statusWindow','Window_SkillStatus'],['_itemWindow','Window_SkillList']]],
    [Scene_Equip,   [['_helpWindow','Window_Help'],['_statusWindow','Window_EquipStatus'],['_commandWindow','Window_EquipCommand'],['_slotWindow','Window_EquipSlot'],['_itemWindow','Window_EquipItem']]],
    [Scene_Status,  [['_statusWindow','Window_Status']]],
    [Scene_Options, [['_optionsWindow','Window_Options']]],
    [Scene_File,    [['_helpWindow','Window_Help'],['_listWindow','Window_SavefileList']]],
    [Scene_Shop,    [['_helpWindow','Window_Help'],['_goldWindow','Window_Gold'],['_commandWindow','Window_ShopCommand'],['_buyWindow','Window_ShopBuy'],['_sellWindow','Window_ShopSell'],['_numberWindow','Window_ShopNumber'],['_statusWindow','Window_ShopStatus']]],
    [Scene_Name,    [['_editWindow','Window_NameEdit'],['_inputWindow','Window_NameInput']]],
    [Scene_GameEnd, [['_commandWindow','Window_GameEnd']]],
    [Scene_Battle,  [['_logWindow','Window_BattleLog'],['_partyCommandWindow','Window_PartyCommand'],['_actorCommandWindow','Window_ActorCommand'],['_statusWindow','Window_BattleStatus'],['_actorWindow','Window_BattleActor'],['_enemyWindow','Window_BattleEnemy'],['_skillWindow','Window_BattleSkill'],['_itemWindow','Window_BattleItem'],['_helpWindow','Window_Help']]],
  ];
  SCENE_LAYOUTS.forEach(function(pair) {
    var cls = pair[0], maps = pair[1], _orig = cls.prototype.create;
    cls.prototype.create = function() {
      _orig.call(this);
      for (var i=0; i<maps.length; i++) applyLayout(this[maps[i][0]], maps[i][1]);
    };
  });

  // [cls, className, method, elemType, argX, argY, argW, argH]
  [[Window_Status,'Window_Status','drawActorName','actorName',1,2,3,null],
   [Window_Status,'Window_Status','drawActorClass','actorClass',1,2,3,null],
   [Window_Status,'Window_Status','drawActorNickname','actorNickname',1,2,3,null],
   [Window_Status,'Window_Status','drawActorFace','actorFace',1,2,3,4],
   [Window_Status,'Window_Status','drawActorLevel','actorLevel',1,2,null,null],
   [Window_Status,'Window_Status','drawActorIcons','actorIcons',1,2,3,null],
   [Window_Status,'Window_Status','drawActorHp','actorHp',1,2,3,null],
   [Window_Status,'Window_Status','drawActorMp','actorMp',1,2,3,null],
   [Window_BattleStatus,'Window_BattleStatus','drawActorName','actorName',1,null,3,null],
   [Window_BattleStatus,'Window_BattleStatus','drawActorIcons','actorIcons',1,null,3,null],
   [Window_BattleStatus,'Window_BattleStatus','drawActorHp','actorHp',1,null,3,null],
   [Window_BattleStatus,'Window_BattleStatus','drawActorMp','actorMp',1,null,3,null],
   [Window_BattleStatus,'Window_BattleStatus','drawActorTp','actorTp',1,null,3,null],
   [Window_MenuStatus,'Window_MenuStatus','drawActorFace','actorFace',1,null,3,4],
   [Window_MenuStatus,'Window_MenuStatus','drawSimpleStatus','simpleStatus',1,null,3,null],
  ].forEach(function(a) { wrapDraw(a[0],a[1],a[2],a[3],a[4],a[5],a[6],a[7]); });

  var ELEM_TO_METHOD = {
    actorName:'drawActorName', actorClass:'drawActorClass', actorNickname:'drawActorNickname',
    actorFace:'drawActorFace', actorLevel:'drawActorLevel', actorIcons:'drawActorIcons',
    actorHp:'drawActorHp', actorMp:'drawActorMp', actorTp:'drawActorTp', simpleStatus:'drawSimpleStatus',
  };

  var _origWBCC = Window_Base.prototype.createContents;
  Window_Base.prototype.createContents = function () {
    _origWBCC.call(this);
    var classOv = _ov[this.constructor.name];
    if (!classOv || !classOv.elements) return;
    var self = this;
    Object.keys(classOv.elements).forEach(function (et) {
      var cfg = classOv.elements[et];
      if (!cfg || (!cfg.fontFace && cfg.visible !== false)) return;
      var mn = ELEM_TO_METHOD[et] || et;
      if (typeof self[mn] !== 'function' || self.hasOwnProperty(mn)) return;
      var orig = self[mn];
      self[mn] = (function (fn, c) {
        return function () {
          if (c.visible === false) return;
          var pf = this.contents && this.contents.fontFace;
          if (c.fontFace && this.contents) this.contents.fontFace = c.fontFace;
          var r = fn.apply(this, arguments);
          if (c.fontFace && this.contents) this.contents.fontFace = pf;
          return r;
        };
      })(orig, cfg);
    });
  };

  var _EASE_FNS = {
    linear:function(t){return t;}, easeIn:function(t){return t*t;},
    easeInOut:function(t){return t<0.5?2*t*t:1-2*(1-t)*(1-t);},
    bounce:function(t){
      if(t<1/2.75)  return 7.5625*t*t;
      if(t<2/2.75)  return 7.5625*(t-=1.5/2.75)*t+0.75;
      if(t<2.5/2.75)return 7.5625*(t-=2.25/2.75)*t+0.9375;
      return               7.5625*(t-=2.625/2.75)*t+0.984375;
    },
  };
  function uiEase(t,easing){t=Math.max(0,Math.min(1,t));var f=_EASE_FNS[easing];return f?f(t):1-(1-t)*(1-t);}

  var _AM={'top-left':[0,0],'top':[0.5,0],'top-right':[1,0],'left':[0,0.5],'center':[0.5,0.5],'right':[1,0.5],'bottom-left':[0,1],'bottom':[0.5,1],'bottom-right':[1,1]};
  function _parsePivotAnchor(anchor,w,h){var a=_AM[anchor]||[0.5,0.5];return{x:Math.floor((w||0)*a[0]),y:Math.floor((h||0)*a[1])};}

  function _setupAnimPivot(win, effects, cn, sx, sy) {
    var np=effects.some(function(e){return e.type==='zoom'||e.type==='rotate'||e.type==='bounce'||e.type==='rotateX'||e.type==='rotateY';}), px=0,py=0;
    if (np&&win.pivot) { var pv=_parsePivotAnchor((_ov[cn]&&_ov[cn].animPivot)||'center',win.width,win.height); px=pv.x;py=pv.y; win.pivot.x=px;win.pivot.y=py; win.x=sx+px;win.y=sy+py; }
    return {pivotX:px,pivotY:py};
  }

  function _makeAnimState(win, effects, cn, sx, sy, pv) {
    return {effects:effects,elapsed:0,screenX:sx,screenY:sy,baseX:win.x,baseY:win.y,
      baseAlpha:win.alpha!==undefined?win.alpha:1,baseRotation:win.rotation||0,
      baseRotationX:win.rotationX!==undefined?win.rotationX:0,
      baseRotationY:win.rotationY!==undefined?win.rotationY:0,
      pivotX:pv.pivotX,pivotY:pv.pivotY,className:cn};
  }

  function startEntranceAnimation(win, entrances, cn) {
    if (!entrances||!entrances.length) return;
    var pv=_setupAnimPivot(win,entrances,cn,win.x,win.y);
    win._uiEntrance=_makeAnimState(win,entrances,cn,win.x,win.y,pv);
    _applyEntranceFrame(win,0);
  }

  function _gfxW(){return typeof Graphics!=='undefined'?Graphics.width:816;} function _gfxH(){return typeof Graphics!=='undefined'?Graphics.height:624;}

  function _writeAnimResult(win, st, tX, tY, tA, tSX, tSY, tR, tRX, tRY, pvx, pvy) {
    win.alpha=st.baseAlpha*tA; win.x=Math.round(tX)+pvx; win.y=Math.round(tY)+pvy;
    if(win.scale){win.scale.x=tSX;win.scale.y=tSY;}
    win.rotation=(st.baseRotation||0)+tR;
    if(win.rotationX!==undefined)win.rotationX=(st.baseRotationX||0)+tRX;
    if(win.rotationY!==undefined)win.rotationY=(st.baseRotationY||0)+tRY;
  }

  function _applyEntranceFrame(win, elapsed) {
    var st=win._uiEntrance; if(!st) return;
    var tX=st.screenX,tY=st.screenY,tA=1,tSX=1,tSY=1,tR=0,tRX=0,tRY=0,sw=_gfxW(),sh=_gfxH();
    for(var i=0;i<st.effects.length;i++){
      var e=st.effects[i],le=elapsed-(e.delay||0),p=le<=0?0:uiEase(Math.min(le/e.duration,1),e.easing),fs,s,a;
      switch(e.type){
        case 'fade':case 'fadeIn': tA*=p; break; case 'fadeOut': tA*=(1-p); break;
        case 'slideLeft': tX=st.screenX-(1-p)*(st.screenX+sw); break; case 'slideRight': tX=st.screenX+(1-p)*sw; break;
        case 'slideTop':  tY=st.screenY-(1-p)*(st.screenY+sh); break; case 'slideBottom':tY=st.screenY+(1-p)*sh; break;
        case 'zoom':case 'bounce': fs=e.fromScale!==undefined?e.fromScale:0;s=fs+p*(1-fs);tSX*=s;tSY*=s; break;
        case 'rotate':  a=e.fromAngle!==undefined?e.fromAngle:180;tR +=a*(1-p)*Math.PI/180; break;
        case 'rotateX': a=e.fromAngle!==undefined?e.fromAngle:90; tRX+=a*(1-p)*Math.PI/180; break;
        case 'rotateY': a=e.fromAngle!==undefined?e.fromAngle:90; tRY+=a*(1-p)*Math.PI/180; break;
      }
    }
    _writeAnimResult(win,st,tX,tY,tA,tSX,tSY,tR,tRX,tRY,st.pivotX,st.pivotY);
  }

  function _applyExitFrame(win, elapsed) {
    var st=win._uiExit; if(!st) return;
    var tX=st.screenX,tY=st.screenY,tA=1,tSX=1,tSY=1,tR=0,tRX=0,tRY=0,sw=_gfxW(),sh=_gfxH();
    for(var i=0;i<st.effects.length;i++){
      // p: 0=시작(원래 상태) → 1=끝(사라진 상태)
      var e=st.effects[i],le=elapsed-(e.delay||0),p=le<=0?0:uiEase(Math.min(le/e.duration,1),e.easing),to,s,a;
      switch(e.type){
        case 'fade':case 'fadeOut': tA*=(1-p); break; case 'fadeIn': tA*=p; break;
        case 'slideLeft': tX=st.screenX-p*(st.screenX+sw); break; case 'slideRight': tX=st.screenX+p*sw; break;
        case 'slideTop':  tY=st.screenY-p*(st.screenY+sh); break; case 'slideBottom':tY=st.screenY+p*sh; break;
        case 'zoom':case 'bounce': to=e.fromScale!==undefined?e.fromScale:0;s=1-p*(1-to);tSX*=s;tSY*=s; break;
        case 'rotate':  a=e.fromAngle!==undefined?e.fromAngle:180;tR +=a*p*Math.PI/180; break;
        case 'rotateX': a=e.fromAngle!==undefined?e.fromAngle:90; tRX+=a*p*Math.PI/180; break;
        case 'rotateY': a=e.fromAngle!==undefined?e.fromAngle:90; tRY+=a*p*Math.PI/180; break;
      }
    }
    _writeAnimResult(win,st,tX,tY,tA,tSX,tSY,tR,tRX,tRY,(win.pivot&&win.pivot.x)||0,(win.pivot&&win.pivot.y)||0);
  }

  function _isAnimDone(elapsed, effects) {
    for (var i=0; i<effects.length; i++)
      if (elapsed < (effects[i].delay||0) + effects[i].duration) return false;
    return true;
  }

  function _resetAnimRot(win, st) {
    win.rotation=st.baseRotation||0;
    if(win.rotationX!==undefined)win.rotationX=st.baseRotationX||0;
    if(win.rotationY!==undefined)win.rotationY=st.baseRotationY||0;
  }

  var _WB_update = Window_Base.prototype.update;
  Window_Base.prototype.update = function () {
    _WB_update.call(this);
    if (this._uiExit) {
      var xs=this._uiExit; xs.elapsed+=1000/60;
      if (_isAnimDone(xs.elapsed,xs.effects)) { this.alpha=0; _resetAnimRot(this,xs); this._uiExit=null; }
      else _applyExitFrame(this,xs.elapsed);
    }
    if (!this._uiEntrance) return;
    var st=this._uiEntrance; st.elapsed+=1000/60;
    if (_isAnimDone(st.elapsed,st.effects)) {
      if (this.pivot&&st.pivotX) { this.pivot.x=0;this.pivot.y=0;this.x=st.screenX;this.y=st.screenY; }
      else { this.x=st.baseX;this.y=st.baseY; }
      this.alpha=st.baseAlpha; if(this.scale){this.scale.x=1;this.scale.y=1;}
      _resetAnimRot(this,st); this._uiEntrance=null;
    } else _applyEntranceFrame(this,st.elapsed);
  };

  function startExitAnimation(win, exits, cn) {
    if (!exits || exits.length === 0) return;
    var sx = win.x-(win.pivot?win.pivot.x:0), sy = win.y-(win.pivot?win.pivot.y:0);
    var pv = _setupAnimPivot(win, exits, cn, sx, sy);
    win._uiEntrance = null;
    win._uiExit = _makeAnimState(win, exits, cn, sx, sy, pv);
    _applyExitFrame(win, 0);
  }

  function collectSceneWindows(scene) {
    var wins=[];
    (function tr(obj) {
      if (!obj||!obj.children) return;
      for (var i=0;i<obj.children.length;i++) { var c=obj.children[i]; if(c instanceof Window_Base)wins.push(c); tr(c); }
    })(scene);
    return wins;
  }

  function startSceneExitAnimations(scene) {
    var maxMs=0;
    collectSceneWindows(scene).forEach(function(win) {
      var cn=win.constructor&&win.constructor.name, ov=(_config.overrides||{})[cn];
      if (ov&&Array.isArray(ov.exits)&&ov.exits.length>0) {
        startExitAnimation(win,ov.exits,cn);
        maxMs=Math.max(maxMs,ov.exits.reduce(function(a,e){return Math.max(a,(e.delay||0)+e.duration);},0));
      }
    });
    return maxMs;
  }

  var _SBase_stop = Scene_Base.prototype.stop;
  Scene_Base.prototype.stop = function () {
    _SBase_stop.call(this);
    var maxMs = startSceneExitAnimations(this);
    if (maxMs > 0) { this._uiExiting=true; this._uiExitMaxMs=maxMs; this._uiExitElapsed=0; }
  };

  var _SBase_isBusy = Scene_Base.prototype.isBusy;
  Scene_Base.prototype.isBusy = function () { return this._uiExiting || _SBase_isBusy.call(this); };

  var _SBase_update = Scene_Base.prototype.update;
  Scene_Base.prototype.update = function () {
    _SBase_update.call(this);
    if (this._uiExiting) {
      this._uiExitElapsed += 1000/60;
      if (this._uiExitElapsed >= this._uiExitMaxMs) this._uiExiting = false;
    }
  };

  window.addEventListener('message', function (e) {
    var data = e.data;
    if (!data || !data.type) return;
    var scene = typeof SceneManager !== 'undefined' ? SceneManager._scene : null;
    if (!scene) return;
    collectSceneWindows(scene).forEach(function (win) {
      var cn = win.constructor && win.constructor.name;
      if (data.className && cn !== data.className) return;
      var ov = (data.override && data.override.className === cn) ? data.override : (_config.overrides || {})[cn];
      if (data.type === 'previewEntrance') {
        if (!ov || !Array.isArray(ov.entrances) || ov.entrances.length === 0) return;
        if (win._uiEntrance && win.pivot) { win.pivot.x=0; win.pivot.y=0; win.x=win._uiEntrance.screenX; win.y=win._uiEntrance.screenY; }
        win._uiEntrance=null; win._uiExit=null; win.alpha=1;
        if (win.scale) { win.scale.x=1; win.scale.y=1; }
        win.rotation=0;
        startEntranceAnimation(win, ov.entrances, cn);
      } else if (data.type === 'previewExit') {
        if (!ov || !Array.isArray(ov.exits) || ov.exits.length === 0) return;
        win._uiEntrance=null;
        startExitAnimation(win, ov.exits, cn);
      }
    });
  });

  window.UIEditorSkins = _skins.skins || [];
})();
