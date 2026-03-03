    //=========================================================================
    // Game_Interpreter - 플러그인 커맨드
    //=========================================================================

    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        switch (command) {
            case 'AutoSave':
                // 즉시 오토 세이브 실행
                DataManager.performAutosave();
                break;
            case 'AutoSaveEnable':
                // 맵 이동 시 자동 저장 활성화
                param_onMapTransfer = true;
                break;
            case 'AutoSaveDisable':
                // 맵 이동 시 자동 저장 비활성화
                param_onMapTransfer = false;
                break;
        }
    };

