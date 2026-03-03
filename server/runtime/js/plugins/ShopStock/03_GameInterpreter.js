  // ══════════════════════════════════════════════════════════════════
  // command302 교체
  // ══════════════════════════════════════════════════════════════════
  Game_Interpreter.prototype.command302 = function () {
    if (!$gameParty.inBattle()) {
      var startIndex = this._index;
      var baseGoods = [this._params];
      while (this.nextEventCode() === 605) {
        this._index++;
        baseGoods.push(this.currentCommand().parameters);
      }

      var stockKey = ShopStockManager.makeKey($gameMap.mapId(), this._eventId, startIndex);

      // 처음 방문 시에만 이벤트 파라미터로 초기화
      if (!$gameSystem._shopGoods[stockKey]) {
        $gameSystem._shopGoods[stockKey] = baseGoods.map(function (g) {
          return [g[0], g[1], g[2], g[3]]; // type, id, priceType, price
        });
        $gameSystem._shopStock[stockKey] = baseGoods.map(function (g, i) {
          var sv = (i === 0) ? g[5] : g[4];
          return (typeof sv === 'number' && sv >= 0) ? sv : -1;
        });
      }

      var goods  = $gameSystem._shopGoods[stockKey];
      var stocks = $gameSystem._shopStock[stockKey];

      SceneManager.push(Scene_Shop);
      SceneManager.prepareNextScene(goods, this._params[4], stockKey, stocks);
    }
    return true;
  };

