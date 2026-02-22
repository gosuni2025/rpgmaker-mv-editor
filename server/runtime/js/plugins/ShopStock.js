/*:
 * @plugindesc 상점 재고 관리 - 상품별 재고, 동적 증감, 상품 추가/제거 지원
 * @author gosuni2025
 *
 * @command addStock
 * @text 재고 증감
 * @desc 상점 아이템의 재고를 증가하거나 감소합니다. 무제한(-1) 아이템은 변경되지 않습니다.
 *
 * @arg eventId
 * @text 이벤트 ID
 * @type number
 * @default 1
 *
 * @arg cmdIdx
 * @text 커맨드 인덱스
 * @desc 이벤트 리스트에서 상점의 처리(302) 커맨드가 위치한 인덱스
 * @type number
 * @default 0
 *
 * @arg itemIdx
 * @text 아이템 인덱스
 * @desc 상점 내 아이템 순서 (0부터 시작)
 * @type number
 * @default 0
 *
 * @arg amount
 * @text 수량
 * @desc 증가할 수량. 음수를 입력하면 감소합니다.
 * @type number
 * @default 1
 *
 * @command setStock
 * @text 재고 설정
 * @desc 상점 아이템의 재고를 지정한 값으로 설정합니다. -1을 입력하면 무제한이 됩니다.
 *
 * @arg eventId
 * @text 이벤트 ID
 * @type number
 * @default 1
 *
 * @arg cmdIdx
 * @text 커맨드 인덱스
 * @type number
 * @default 0
 *
 * @arg itemIdx
 * @text 아이템 인덱스
 * @type number
 * @default 0
 *
 * @arg amount
 * @text 재고 수량 (-1=무제한)
 * @type number
 * @default 10
 *
 * @command addItem
 * @text 상품 추가
 * @desc 상점에 새 상품을 동적으로 추가합니다. 상점을 한 번 열어야 효과가 적용됩니다.
 *
 * @arg eventId
 * @text 이벤트 ID
 * @type number
 * @default 1
 *
 * @arg cmdIdx
 * @text 커맨드 인덱스
 * @type number
 * @default 0
 *
 * @arg type
 * @text 종류
 * @type select
 * @option 아이템
 * @value 0
 * @option 무기
 * @value 1
 * @option 방어구
 * @value 2
 * @default 0
 *
 * @arg itemId
 * @text 아이템 ID
 * @type number
 * @default 1
 *
 * @arg priceType
 * @text 가격 타입
 * @type select
 * @option 표준 가격
 * @value 0
 * @option 지정 가격
 * @value 1
 * @default 0
 *
 * @arg price
 * @text 지정 가격
 * @desc 가격 타입이 "지정 가격"일 때만 사용됩니다.
 * @type number
 * @default 0
 *
 * @arg stock
 * @text 재고 (-1=무제한)
 * @type number
 * @default -1
 *
 * @command removeItem
 * @text 상품 제거
 * @desc 상점에서 특정 상품을 제거합니다. 상점을 한 번 열어야 효과가 적용됩니다.
 *
 * @arg eventId
 * @text 이벤트 ID
 * @type number
 * @default 1
 *
 * @arg cmdIdx
 * @text 커맨드 인덱스
 * @type number
 * @default 0
 *
 * @arg itemIdx
 * @text 아이템 인덱스
 * @desc 제거할 아이템의 순서 (0부터 시작)
 * @type number
 * @default 0
 *
 * @help
 * ───────────────────────────────────────────────────────────────────
 * 재고 파라미터 (이벤트 에디터 상점의 처리에서 설정)
 *   302 첫 번째 상품: params[5] = 재고 수량 (-1 = 무제한)
 *   605 추가 상품:    params[4] = 재고 수량 (-1 = 무제한)
 *
 * 재고/상품 목록은 $gameSystem에 저장 → 세이브/로드 자동 유지
 * 첫 방문 시 이벤트 파라미터로 초기화, 이후엔 저장된 상태 유지
 *
 * ───────────────────────────────────────────────────────────────────
 * 플러그인 커맨드 (현재 맵 기준, eventId/cmdIdx로 상점 식별)
 *
 * 재고 조작:
 *   ShopStock addStock  <eventId> <cmdIdx> <itemIdx> <amount>
 *   ShopStock setStock  <eventId> <cmdIdx> <itemIdx> <amount>
 *
 * 상품 추가:
 *   ShopStock addItem <eventId> <cmdIdx> <type> <itemId> <priceType> <price> <stock>
 *     type: 0=아이템 1=무기 2=방어구  priceType: 0=표준 1=지정  stock: -1=무제한
 *
 * 상품 제거:
 *   ShopStock removeItem <eventId> <cmdIdx> <itemIdx>
 *
 * ───────────────────────────────────────────────────────────────────
 * 스크립트 API
 *   ShopStockManager.addStock("1_5_3", 0, 10);
 *   ShopStockManager.setStock("1_5_3", 0, 5);
 *   ShopStockManager.addItem("1_5_3", 0, 1, 0, 0, 3);
 *   ShopStockManager.removeItem("1_5_3", 2);
 * ───────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

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

  // ══════════════════════════════════════════════════════════════════
  // $gameSystem 초기화
  // ══════════════════════════════════════════════════════════════════
  var _Game_System_initialize = Game_System.prototype.initialize;
  Game_System.prototype.initialize = function () {
    _Game_System_initialize.call(this);
    this._shopGoods  = {}; // { key: [[type,id,priceType,price], ...] }
    this._shopStock  = {}; // { key: [stock0, stock1, ...] }
  };

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

  // Window_ShopNumber: 아이템 이름 옆에 재고 표시
  var _Window_ShopNumber_drawItemName = Window_ShopNumber.prototype.drawItemName;
  Window_ShopNumber.prototype.drawItemName = function (item, x, y, width) {
    if (this._shopStock !== undefined) {
      var stockWidth = 80;
      _Window_ShopNumber_drawItemName.call(this, item, x, y, width - stockWidth);
      var stock = this._shopStock;
      this.changeTextColor(stock <= 0 ? this.deathColor() : stock <= 3 ? '#ffaa00' : this.normalColor());
      this.drawText('재고: ' + stock, x, y, width, 'right');
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
      if (stock === 0)     this.changeTextColor(this.deathColor());
      else if (stock <= 3) this.changeTextColor('#ffaa00');
      else                 this.changeTextColor(this.normalColor());
      this.drawText('재고: ' + stock, rect.x + rect.width - stockWidth, rect.y, stockWidth, 'right');
      this.resetTextColor();
    }

    this.changePaintOpacity(true);
  };

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
          reason = '품절입니다.';
        } else if (bw.price && bw.price(this._item) > $gameParty.gold()) {
          reason = '돈이 부족합니다.';
        }
      }
    }

    var x       = this.textPadding();
    var yOffset = 0;
    if (reason) {
      this.changeTextColor(reason === '품절입니다.' ? this.deathColor() : this.textColor(14));
      this.drawText(reason, x, 0, this.contentsWidth() - x);
      this.resetTextColor();
      yOffset = this.lineHeight();
    }

    this.drawPossession(x, yOffset);
    if (this.isEquipItem()) {
      this.drawEquipInfo(x, yOffset + this.lineHeight() * 2);
    }
  };

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

  // ══════════════════════════════════════════════════════════════════
  // 구버전 세이브 호환: 필드 누락 시 보완
  // ══════════════════════════════════════════════════════════════════
  var _extractSaveContents = DataManager.extractSaveContents;
  DataManager.extractSaveContents = function (contents) {
    _extractSaveContents.call(this, contents);
    if (!$gameSystem._shopGoods) $gameSystem._shopGoods = {};
    if (!$gameSystem._shopStock) $gameSystem._shopStock = {};
  };

})();
