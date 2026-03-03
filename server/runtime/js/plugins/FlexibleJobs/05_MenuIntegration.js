
  //===========================================================================
  // 메뉴 통합
  //===========================================================================
  var _addOriginalCmds = Window_MenuCommand.prototype.addOriginalCommands;
  Window_MenuCommand.prototype.addOriginalCommands = function () {
    _addOriginalCmds.call(this);
    var ok = !MENU_SWITCH || ($gameSwitches && $gameSwitches.value(MENU_SWITCH));
    if (ok) {
      this.addCommand(CMD_CLASS, 'fjClassChange', true);
      this.addCommand(CMD_LEARN, 'fjSkillLearn',  true);
    }
  };

  var _createCmdWindow = Scene_Menu.prototype.createCommandWindow;
  Scene_Menu.prototype.createCommandWindow = function () {
    _createCmdWindow.call(this);
    this._commandWindow.setHandler('fjClassChange', this.onFjClassChange.bind(this));
    this._commandWindow.setHandler('fjSkillLearn',  this.onFjSkillLearn.bind(this));
  };

  Scene_Menu.prototype.onFjClassChange = function () {
    FJ._slot = 0; FJ._curClassId = 0; FJ._actorIdx = 0;
    var SceneCC = window['Scene_CS_fj_classChange'];
    if (SceneCC) { SceneManager.push(SceneCC); } else { this.activateMenuWindow(); }
  };

  Scene_Menu.prototype.onFjSkillLearn = function () {
    FJ._curSkillId = 0; FJ._actorIdx = 0;
    var SceneSL = window['Scene_CS_fj_skillLearn'];
    if (SceneSL) { SceneManager.push(SceneSL); } else { this.activateMenuWindow(); }
  };

  //===========================================================================
  // 플러그인 커맨드
  //===========================================================================
  var _pluginCmd = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _pluginCmd.call(this, command, args);
    var actor;
    switch (command) {
      case 'OpenClassChange':
        FJ._slot = 0; FJ._curClassId = 0;
        FJ._actorIdx = Math.max(0, $gameParty.members().indexOf($gameParty.menuActor()));
        var SceneCC = window['Scene_CS_fj_classChange'];
        if (SceneCC) SceneManager.push(SceneCC);
        break;
      case 'OpenSkillLearn':
        if (args[0]) {
          actor = $gameActors.actor(+args[0]);
          if (actor) $gameParty.setMenuActor(actor);
        }
        FJ._curSkillId = 0;
        FJ._actorIdx = Math.max(0, $gameParty.members().indexOf($gameParty.menuActor()));
        var SceneSL = window['Scene_CS_fj_skillLearn'];
        if (SceneSL) SceneManager.push(SceneSL);
        break;
      case 'GainJP':
        actor = $gameActors.actor(+args[0]);
        if (actor) actor.fjGainJp(+args[1] || 0);
        break;
      case 'UnlockClass':
        actor = $gameActors.actor(+args[0]);
        if (actor) actor.fjUnlockClass(+args[1]);
        break;
    }
  };

  //===========================================================================
  // DataManager — 데이터 재로드 시 노트태그 캐시 초기화
  //===========================================================================
  var _onLoad = DataManager.onLoad;
  DataManager.onLoad = function (object) {
    _onLoad.call(this, object);
    Note.clear();
  };
