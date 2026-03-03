    //-------------------------------------------------------------------------
    // Plugin Command
    //-------------------------------------------------------------------------
    var _pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _pluginCommand.call(this, command, args);
        if (command !== 'ItemBook') return;
        switch (args[0]) {
        case 'open':        openItemBook(); break;
        case 'add':         $gameSystem.addToItemBook(args[1], Number(args[2])); break;
        case 'remove':      $gameSystem.removeFromItemBook(args[1], Number(args[2])); break;
        case 'complete':    $gameSystem.completeItemBook(); break;
        case 'clear':       $gameSystem.clearItemBook(); break;
        case 'addItem':     $gameSystem.addToItemBook('item',   Number(args[1])); break;
        case 'addWeapon':   $gameSystem.addToItemBook('weapon', Number(args[1])); break;
        case 'addArmor':    $gameSystem.addToItemBook('armor',  Number(args[1])); break;
        case 'removeItem':  $gameSystem.removeFromItemBook('item',   Number(args[1])); break;
        case 'removeWeapon':$gameSystem.removeFromItemBook('weapon', Number(args[1])); break;
        case 'removeArmor': $gameSystem.removeFromItemBook('armor',  Number(args[1])); break;
        }
    };

