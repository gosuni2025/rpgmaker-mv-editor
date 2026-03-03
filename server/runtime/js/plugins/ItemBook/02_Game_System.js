    //-------------------------------------------------------------------------
    // Game_System — 도감 데이터 관리
    //-------------------------------------------------------------------------
    Game_System.prototype.clearItemBook = function() {
        this._itemBookFlags = [[], [], []]; // [0]=item [1]=weapon [2]=armor
    };

    Game_System.prototype._itemBookTypeIndex = function(type) {
        return type === 'item' ? 0 : type === 'weapon' ? 1 : type === 'armor' ? 2 : -1;
    };

    Game_System.prototype.addToItemBook = function(type, dataId) {
        if (!this._itemBookFlags) this.clearItemBook();
        var i = this._itemBookTypeIndex(type);
        if (i >= 0) this._itemBookFlags[i][dataId] = true;
    };

    Game_System.prototype.removeFromItemBook = function(type, dataId) {
        if (!this._itemBookFlags) return;
        var i = this._itemBookTypeIndex(type);
        if (i >= 0) this._itemBookFlags[i][dataId] = false;
    };

    Game_System.prototype.completeItemBook = function() {
        var i;
        this.clearItemBook();
        for (i = 1; i < $dataItems.length;   i++) this._itemBookFlags[0][i] = true;
        for (i = 1; i < $dataWeapons.length;  i++) this._itemBookFlags[1][i] = true;
        for (i = 1; i < $dataArmors.length;   i++) this._itemBookFlags[2][i] = true;
    };

    Game_System.prototype.isInItemBook = function(item) {
        if (!this._itemBookFlags || !item) return false;
        var i = DataManager.isItem(item) ? 0 : DataManager.isWeapon(item) ? 1 : DataManager.isArmor(item) ? 2 : -1;
        return i >= 0 ? !!this._itemBookFlags[i][item.id] : false;
    };

    // 아이템 획득 시 자동 등록
    var _gainItem = Game_Party.prototype.gainItem;
    Game_Party.prototype.gainItem = function(item, amount, includeEquip) {
        _gainItem.call(this, item, amount, includeEquip);
        if (item && amount > 0) {
            var type = DataManager.isItem(item) ? 'item' : DataManager.isWeapon(item) ? 'weapon' : 'armor';
            $gameSystem.addToItemBook(type, item.id);
        }
    };

