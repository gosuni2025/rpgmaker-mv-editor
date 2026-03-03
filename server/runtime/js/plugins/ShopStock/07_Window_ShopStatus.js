  // ══════════════════════════════════════════════════════════════════
  // Window_ShopStatus
  // ══════════════════════════════════════════════════════════════════

  // refresh: 구매 불가 이유(색상 텍스트)를 상단에 표시 후 파티 정보 출력
  Window_ShopStatus.prototype.refresh = function () {
    this.contents.clear();
    if (!this._item) return;

    var reason = null;
    var scene = SceneManager._scene;
    if (scene && scene._buyWindow) {
      var bw  = scene._buyWindow;
      var idx = bw._data ? bw._data.indexOf(this._item) : -1;
      if (idx >= 0) {
        var stock = bw.getStock ? bw.getStock(idx) : -1;
        if (stock === 0) {
          reason = SOLD_OUT_STATUS_TEXT;
        } else if (bw.price && bw.price(this._item) > $gameParty.gold()) {
          reason = NO_FUNDS_TEXT;
        }
      }
    }

    var x       = this.textPadding();
    var yOffset = 0;
    if (reason) {
      this.changeTextColor(reason === SOLD_OUT_STATUS_TEXT ? SOLD_OUT_COLOR : NO_FUNDS_COLOR);
      this.drawText(reason, x, 0, this.contentsWidth() - x);
      this.resetTextColor();
      yOffset = this.lineHeight();
    }

    this.drawPossession(x, yOffset);
    if (this.isEquipItem()) {
      this.drawEquipInfo(x, yOffset + this.lineHeight() * 2);
    }
  };

