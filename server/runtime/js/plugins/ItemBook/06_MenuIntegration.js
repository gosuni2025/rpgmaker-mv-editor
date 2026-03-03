    //-------------------------------------------------------------------------
    // 메뉴 통합
    //-------------------------------------------------------------------------
    if (showInMenu) {
        var _makeCommandList = Window_MenuCommand.prototype.makeCommandList;
        Window_MenuCommand.prototype.makeCommandList = function() {
            _makeCommandList.call(this);
            this.addCommand(menuText, 'itemBook');
        };

        var _createCommandWindow = Scene_Menu.prototype.createCommandWindow;
        Scene_Menu.prototype.createCommandWindow = function() {
            _createCommandWindow.call(this);
            this._commandWindow.setHandler('itemBook', this.commandItemBook.bind(this));
        };

        Scene_Menu.prototype.commandItemBook = function() {
            openItemBook();
        };
    }

    //-------------------------------------------------------------------------
    // CustomSceneEngine 통합
    //-------------------------------------------------------------------------
    if (hasCSEngine()) {

        // menu_v2 cmd_main에 항목 추가
        if (showInMenu) {
            window.__customSceneEngine.addMenuCommand(
                'menu_v2', 'cmd_main',
                { name: menuText, symbol: 'itemBook', enabled: true },
                { action: 'gotoScene', target: 'Scene_CS_item_book' },
                { index: -1 }
            );
        }
    }

