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
