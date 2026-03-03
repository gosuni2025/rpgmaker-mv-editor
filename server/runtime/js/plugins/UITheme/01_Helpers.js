
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
