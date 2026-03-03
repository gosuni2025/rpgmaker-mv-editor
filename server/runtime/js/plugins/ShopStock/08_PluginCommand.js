  // ══════════════════════════════════════════════════════════════════
  // 플러그인 커맨드
  // ══════════════════════════════════════════════════════════════════
  var _pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _pluginCommand.call(this, command, args);
    if (command !== 'ShopStock') return;

    var sub    = args[0];
    var mapId  = $gameMap.mapId();

    switch (sub) {
      case 'addStock': {
        // addStock <eventId> <cmdIdx> <itemIdx> <amount>
        var key = ShopStockManager.makeKey(mapId, Number(args[1]), Number(args[2]));
        ShopStockManager.addStock(key, Number(args[3]), Number(args[4]));
        break;
      }
      case 'setStock': {
        // setStock <eventId> <cmdIdx> <itemIdx> <amount>
        var key = ShopStockManager.makeKey(mapId, Number(args[1]), Number(args[2]));
        ShopStockManager.setStock(key, Number(args[3]), Number(args[4]));
        break;
      }
      case 'addItem': {
        // addItem <eventId> <cmdIdx> <type> <itemId> <priceType> <price> <stock>
        var key = ShopStockManager.makeKey(mapId, Number(args[1]), Number(args[2]));
        ShopStockManager.addItem(
          key,
          Number(args[3]),
          Number(args[4]),
          Number(args[5]) || 0,
          Number(args[6]) || 0,
          args[7] !== undefined ? Number(args[7]) : -1
        );
        break;
      }
      case 'removeItem': {
        // removeItem <eventId> <cmdIdx> <itemIdx>
        var key = ShopStockManager.makeKey(mapId, Number(args[1]), Number(args[2]));
        ShopStockManager.removeItem(key, Number(args[3]));
        break;
      }
    }
  };

