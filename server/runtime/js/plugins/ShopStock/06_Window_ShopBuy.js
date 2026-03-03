  // ══════════════════════════════════════════════════════════════════
  // Window_ShopBuy
  // ══════════════════════════════════════════════════════════════════
  Window_ShopBuy.prototype.setStockData = function (stockKey, stocks) {
    this._stockKey = stockKey;
    // $gameSystem._shopStock を直接参照 (同期用)
    this._stocks = $gameSystem._shopStock[stockKey] || stocks || [];
  };

  Window_ShopBuy.prototype.getItemDataIndex = function (item) {
    return this._data.indexOf(item);
  };

  Window_ShopBuy.prototype.getStock = function (index) {
    if (!this._stocks) return -1;
    var s = this._stocks[index];
    return s !== undefined ? s : -1;
  };

  // isEnabled: 재고 0이면 비활성
  var _Window_ShopBuy_isEnabled = Window_ShopBuy.prototype.isEnabled;
  Window_ShopBuy.prototype.isEnabled = function (item) {
    if (!_Window_ShopBuy_isEnabled.call(this, item)) return false;
    return this.getStock(this._data.indexOf(item)) !== 0;
  };

  // drawItem: 아이템명 | 가격 | 재고
  Window_ShopBuy.prototype.drawItem = function (index) {
    var item = this._data[index];
    var rect = this.itemRect(index);
    var priceWidth = 96;
    var stockWidth = 72;
    rect.width -= this.textPadding();

    this.changePaintOpacity(this.isEnabled(item));

    this.drawItemName(item, rect.x, rect.y, rect.width - priceWidth - stockWidth);
    this.drawText(this._price[index], rect.x + rect.width - priceWidth - stockWidth, rect.y, priceWidth, 'right');

    var stock = this.getStock(index);
    if (stock !== -1) {
      if (stock === 0)     this.changeTextColor(SOLD_OUT_COLOR);
      else if (stock <= 3) this.changeTextColor(LOW_STOCK_COLOR);
      else                 this.changeTextColor(this.normalColor());
      this.drawText(stock === 0 ? SOLD_OUT_TEXT : STOCK_PREFIX + ' ' + stock, rect.x + rect.width - stockWidth, rect.y, stockWidth, 'right');
      this.resetTextColor();
    }

    this.changePaintOpacity(true);
  };

