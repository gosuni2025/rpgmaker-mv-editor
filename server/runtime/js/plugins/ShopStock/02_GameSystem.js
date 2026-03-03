  // ══════════════════════════════════════════════════════════════════
  // $gameSystem 초기화
  // ══════════════════════════════════════════════════════════════════
  var _Game_System_initialize = Game_System.prototype.initialize;
  Game_System.prototype.initialize = function () {
    _Game_System_initialize.call(this);
    this._shopGoods  = {}; // { key: [[type,id,priceType,price], ...] }
    this._shopStock  = {}; // { key: [stock0, stock1, ...] }
  };

