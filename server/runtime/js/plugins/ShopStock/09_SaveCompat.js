  // ══════════════════════════════════════════════════════════════════
  // 구버전 세이브 호환: 필드 누락 시 보완
  // ══════════════════════════════════════════════════════════════════
  var _extractSaveContents = DataManager.extractSaveContents;
  DataManager.extractSaveContents = function (contents) {
    _extractSaveContents.call(this, contents);
    if (!$gameSystem._shopGoods) $gameSystem._shopGoods = {};
    if (!$gameSystem._shopStock) $gameSystem._shopStock = {};
  };

