    //=========================================================================
    // Scene_ItemBook
    //
    //  ┌────────────┐ ┌─────────────────────────────┐
    //  │ 001 [i] 이름│ │  stats / description (토글) │
    //  │ 002 [i] 이름│ │                             │
    //  │  ...       │ │                             │
    //  │            │ │  ─────────────────────────  │
    //  └────────────┘ │  [ 결정 ] 설명 보기          │
    //                 └─────────────────────────────┘
    //=========================================================================
    function Scene_ItemBook() { this.initialize.apply(this, arguments); }
    Scene_ItemBook.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_ItemBook.prototype.constructor = Scene_ItemBook;

    Scene_ItemBook.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);
    };

    Scene_ItemBook.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);

        var lw = 240;
        var rw = Graphics.boxWidth - lw;

        this._indexWindow  = new Window_ItemBookIndex(0, 0, lw, Graphics.boxHeight);
        this._statusWindow = new Window_ItemBookStatus(lw, 0, rw, Graphics.boxHeight);

        this._indexWindow.setHandler('cancel', this.popScene.bind(this));
        this._indexWindow.setHandler('ok', this.onIndexOk.bind(this));
        this._indexWindow.setStatusWindow(this._statusWindow);

        this.addWindow(this._indexWindow);
        this.addWindow(this._statusWindow);
    };

    Scene_ItemBook.prototype.onIndexOk = function() {
        this._statusWindow.toggleView();
        this._indexWindow.activate();
    };

