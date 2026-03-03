  // Window_ShopNumber: 아이템 이름 옆에 재고 표시
  var _Window_ShopNumber_drawItemName = Window_ShopNumber.prototype.drawItemName;
  Window_ShopNumber.prototype.drawItemName = function (item, x, y, width) {
    if (this._shopStock !== undefined) {
      var stockWidth = 80;
      _Window_ShopNumber_drawItemName.call(this, item, x, y, width - stockWidth);
      var stock = this._shopStock;
      this.changeTextColor(stock <= 0 ? SOLD_OUT_COLOR : stock <= 3 ? LOW_STOCK_COLOR : this.normalColor());
      this.drawText(stock <= 0 ? SOLD_OUT_TEXT : STOCK_PREFIX + ' ' + stock, x, y, width, 'right');
      this.resetTextColor();
    } else {
      _Window_ShopNumber_drawItemName.call(this, item, x, y, width);
    }
  };

  // Window_ShopNumber: 도움말 줄을 위해 창 높이 1줄 확장
  Window_ShopNumber.prototype.windowHeight = function () {
    return this.fittingHeight(6);
  };

  // Window_ShopNumber: 도움말 텍스트 추가
  var _Window_ShopNumber_refresh = Window_ShopNumber.prototype.refresh;
  Window_ShopNumber.prototype.refresh = function () {
    _Window_ShopNumber_refresh.call(this);
    var prevSize = this.contents.fontSize;
    this.contents.fontSize = 14;
    this.changeTextColor(this.textColor(7));
    this.drawText('↑↓: ±1    ←→: ±10', 0, this.lineHeight() * 5, this.contentsWidth(), 'center');
    this.resetTextColor();
    this.contents.fontSize = prevSize;
  };

  // Window_ShopNumber: UP/DOWN ±1, LEFT/RIGHT ±10
  Window_ShopNumber.prototype.processNumberChange = function () {
    if (this.isOpenAndActive()) {
      if (Input.isRepeated('up'))    this.changeNumber(1);
      if (Input.isRepeated('down'))  this.changeNumber(-1);
      if (Input.isRepeated('right')) this.changeNumber(10);
      if (Input.isRepeated('left'))  this.changeNumber(-10);
    }
  };

