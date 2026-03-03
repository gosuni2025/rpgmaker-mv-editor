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
