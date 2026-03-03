  // ══════════════════════════════════════════════════════════════════
  // ShopStockManager - 공개 API
  // ══════════════════════════════════════════════════════════════════
  var ShopStockManager = {};
  window.ShopStockManager = ShopStockManager;

  ShopStockManager.makeKey = function (mapId, eventId, cmdIdx) {
    return mapId + '_' + eventId + '_' + cmdIdx;
  };

  /** 재고 증가 (amount 음수 가능) */
  ShopStockManager.addStock = function (key, itemIdx, amount) {
    var stocks = $gameSystem._shopStock[key];
    if (!stocks || stocks[itemIdx] === undefined || stocks[itemIdx] === -1) return;
    stocks[itemIdx] = Math.max(0, stocks[itemIdx] + amount);
  };

  /** 재고 절대값 설정 (-1 = 무제한으로 변경) */
  ShopStockManager.setStock = function (key, itemIdx, amount) {
    var stocks = $gameSystem._shopStock[key];
    if (!stocks || stocks[itemIdx] === undefined) return;
    stocks[itemIdx] = amount < 0 ? -1 : amount;
  };

  /**
   * 상품 추가 (첫 방문 이후에만 동작)
   * @param {string} key
   * @param {number} type      0=아이템, 1=무기, 2=방어구
   * @param {number} itemId
   * @param {number} priceType 0=표준, 1=지정
   * @param {number} price
   * @param {number} stock     -1=무제한
   */
  ShopStockManager.addItem = function (key, type, itemId, priceType, price, stock) {
    var goods  = $gameSystem._shopGoods[key];
    var stocks = $gameSystem._shopStock[key];
    if (!goods || !stocks) return; // 미방문 상점은 조작 불가

    var stockVal = (stock === undefined || stock === null) ? -1 : stock;

    // 이미 동일 상품 있으면 재고만 업데이트
    for (var i = 0; i < goods.length; i++) {
      if (goods[i][0] === type && goods[i][1] === itemId) {
        stocks[i] = stockVal;
        return;
      }
    }
    goods.push([type, itemId, priceType || 0, price || 0]);
    stocks.push(stockVal);
  };

  /**
   * 상품 제거
   * @param {string} key
   * @param {number} itemIdx 0부터 시작하는 인덱스
   */
  ShopStockManager.removeItem = function (key, itemIdx) {
    var goods  = $gameSystem._shopGoods[key];
    var stocks = $gameSystem._shopStock[key];
    if (!goods || !stocks || itemIdx < 0 || itemIdx >= goods.length) return;
    goods.splice(itemIdx, 1);
    stocks.splice(itemIdx, 1);
  };

