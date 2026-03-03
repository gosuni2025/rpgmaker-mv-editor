
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
