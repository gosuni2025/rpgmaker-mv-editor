    // =========================================================================
    // Scene_Menu 통합 — 메뉴에 "텍스트 로그" 항목 추가
    // =========================================================================
    var _addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
    Window_MenuCommand.prototype.addOriginalCommands = function () {
        _addOriginalCommands.call(this);
        this.addCommand(MENU_NAME, 'textLog', true);
    };

    var _createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function () {
        _createCommandWindow.call(this);
        this._commandWindow.setHandler('textLog', this.commandTextLog.bind(this));
    };

    Scene_Menu.prototype.commandTextLog = function () {
        SceneManager.push(Scene_TextLog);
    };

    // 다른 플러그인(VisualNovelMode 등)에서 접근할 수 있도록 전역 노출
    window.TextLogManager = TextLogManager;

