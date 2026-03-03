    //=========================================================================
    // Window_ItemBookIndex — 왼쪽 목록
    //=========================================================================
    function Window_ItemBookIndex() { this.initialize.apply(this, arguments); }
    Window_ItemBookIndex.prototype = Object.create(Window_Selectable.prototype);
    Window_ItemBookIndex.prototype.constructor = Window_ItemBookIndex;
    Window_ItemBookIndex.lastTopRow = 0;
    Window_ItemBookIndex.lastIndex  = 0;

    Window_ItemBookIndex.prototype.initialize = function(x, y, width, height) {
        Window_Selectable.prototype.initialize.call(this, x, y, width, height);
        this.refresh();
        this.setTopRow(Window_ItemBookIndex.lastTopRow);
        this.select(Window_ItemBookIndex.lastIndex);
        this.activate();
    };

    Window_ItemBookIndex.prototype.maxCols  = function() { return 1; };
    Window_ItemBookIndex.prototype.maxItems = function() { return this._list ? this._list.length : 0; };

    Window_ItemBookIndex.prototype.setStatusWindow = function(w) { this._statusWindow = w; this._updateRight(); };

    Window_ItemBookIndex.prototype.update = function() {
        Window_Selectable.prototype.update.call(this);
        this._updateRight();
    };

    Window_ItemBookIndex.prototype._updateRight = function() {
        var item = this._list ? this._list[this.index()] : null;
        if (this._statusWindow) this._statusWindow.setItem(item);
    };

    Window_ItemBookIndex.prototype.refresh = function() {
        var i, item;
        this._list = [];
        for (i = 1; i < $dataItems.length;   i++) {
            item = $dataItems[i];
            if (item && item.name && item.itypeId === 1 && item.meta.book !== 'no') this._list.push(item);
        }
        for (i = 1; i < $dataWeapons.length;  i++) {
            item = $dataWeapons[i];
            if (item && item.name && item.meta.book !== 'no') this._list.push(item);
        }
        for (i = 1; i < $dataArmors.length;   i++) {
            item = $dataArmors[i];
            if (item && item.name && item.meta.book !== 'no') this._list.push(item);
        }
        this.createContents();
        this.drawAllItems();
    };

    Window_ItemBookIndex.prototype.drawItem = function(index) {
        var item  = this._list[index];
        var rect  = this.itemRectForText(index);
        var known = $gameSystem.isInItemBook(item);
        var iw    = Window_Base._iconWidth; // 32
        var x = rect.x, y = rect.y;

        // 번호
        this.changeTextColor(this.textColor(7));
        this.drawText(('000' + (index + 1)).slice(-3), x, y, 36);
        x += 40;

        if (known) {
            this.drawIcon(item.iconIndex, x, y + 2);
            this.resetTextColor();
            this.drawText(item.name, x + iw + 4, y, rect.width - 40 - iw - 4);
        } else {
            this.changeTextColor(this.textColor(7));
            this.drawText(unknownData, x + iw + 4, y, rect.width - 40 - iw - 4);
        }
    };

    Window_ItemBookIndex.prototype.processCancel = function() {
        Window_Selectable.prototype.processCancel.call(this);
        Window_ItemBookIndex.lastTopRow = this.topRow();
        Window_ItemBookIndex.lastIndex  = this.index();
    };

