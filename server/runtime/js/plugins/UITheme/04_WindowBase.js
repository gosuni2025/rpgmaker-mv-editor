
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
