    //=========================================================================
    // Scene_Battle
    //=========================================================================
    var _Scene_Battle_createSpriteset = Scene_Battle.prototype.createSpriteset;
    Scene_Battle.prototype.createSpriteset = function () {
        _Scene_Battle_createSpriteset.call(this);
        this._turnOrderBar = new Sprite_TurnOrderBar();
        this.addChild(this._turnOrderBar);
    };

    //=========================================================================
    // 플러그인 커맨드
    //=========================================================================
    var _pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _pluginCommand.call(this, command, args);
        if (command !== 'TurnOrderDisplay') return;

        var sub = (args[0] || '').toLowerCase();
        var val = (args[1] || '');
        var n;

        switch (sub) {
            case 'show':      Config.visible = true;  break;
            case 'hide':      Config.visible = false; break;
            case 'direction':
                if (val === 'horizontal' || val === 'vertical') Config.direction = val;
                break;
            case 'position':  Config.position = val;  break;
            case 'iconsize':
                n = parseInt(val, 10);
                if (!isNaN(n) && n >= 20) Config.iconSize = n;
                break;
            case 'indicator': Config.indicatorStyle = val; break;
            case 'clip':      Config.clipShape = val;       break;
            case 'curves':
                Config.showCurves   = (val === 'on' || val === 'true'); break;
            case 'tentacle':
                Config.showTentacle = (val === 'on' || val === 'true'); break;
        }
    };

