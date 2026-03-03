  // ══════════════════════════════════════════════════════════════════
  // Scene_Shop
  // ══════════════════════════════════════════════════════════════════
  var _Scene_Shop_prepare = Scene_Shop.prototype.prepare;
  Scene_Shop.prototype.prepare = function (goods, purchaseOnly, stockKey, stocks) {
    _Scene_Shop_prepare.call(this, goods, purchaseOnly);
    this._stockKey   = stockKey || null;
    this._stockArray = stocks   || null;
  };

  var _Scene_Shop_createBuyWindow = Scene_Shop.prototype.createBuyWindow;
  Scene_Shop.prototype.createBuyWindow = function () {
    _Scene_Shop_createBuyWindow.call(this);
    if (this._stockKey) {
      this._buyWindow.setStockData(this._stockKey, this._stockArray);
      this._buyWindow.refresh();
    }
  };

  // maxBuy: 재고 상한 반영
  var _Scene_Shop_maxBuy = Scene_Shop.prototype.maxBuy;
  Scene_Shop.prototype.maxBuy = function () {
    var max = _Scene_Shop_maxBuy.call(this);
    if (this._stockKey && this._buyWindow) {
      var idx   = this._buyWindow.getItemDataIndex(this._item);
      var stock = this._buyWindow.getStock(idx);
      if (stock !== -1) max = Math.min(max, stock);
    }
    return max;
  };

  // 구매 시 재고 감소
  var _Scene_Shop_doBuy = Scene_Shop.prototype.doBuy;
  Scene_Shop.prototype.doBuy = function (number) {
    var item = this._buyWindow.item();
    var idx  = this._buyWindow.getItemDataIndex(item);
    _Scene_Shop_doBuy.call(this, number);
    if (this._stockKey && idx >= 0) {
      var stocks = $gameSystem._shopStock[this._stockKey];
      if (stocks && stocks[idx] !== undefined && stocks[idx] !== -1) {
        stocks[idx] = Math.max(0, stocks[idx] - number);
        this._buyWindow.refresh();
      }
    }
  };

  // Scene_Shop.onBuyOk: numberWindow에 재고 전달
  var _Scene_Shop_onBuyOk = Scene_Shop.prototype.onBuyOk;
  Scene_Shop.prototype.onBuyOk = function () {
    _Scene_Shop_onBuyOk.call(this);
    if (this._stockKey && this._buyWindow) {
      var idx   = this._buyWindow.getItemDataIndex(this._item);
      var stock = this._buyWindow.getStock(idx);
      this._numberWindow._shopStock = (stock === -1) ? undefined : stock;
      this._numberWindow.refresh();
    }
  };

