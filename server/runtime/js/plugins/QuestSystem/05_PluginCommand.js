
  // ============================================================
  // 플러그인 커맨드
  // ============================================================

  var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command !== 'QuestSystem') return;
    var action = args[0];
    var questId = args[1];
    var objId = args[2];
    switch (action) {
      case 'open':
        QS._openJournal();
        break;
      case 'add':
        QS.addQuest(questId);
        break;
      case 'start':
        QS.startQuest(questId);
        break;
      case 'complete':
        QS.completeQuest(questId);
        break;
      case 'fail':
        QS.failQuest(questId);
        break;
      case 'remove':
        QS.removeQuest(questId);
        break;
      case 'track':
        QS.trackQuest(questId);
        break;
      case 'untrack':
        QS.trackQuest(null);
        break;
      case 'completeObjective':
        QS.completeObjective(questId, objId);
        break;
      case 'failObjective':
        QS.failObjective(questId, objId);
        break;
      case 'showObjective':
        QS.showObjective(questId, objId);
        break;
    }
  };

  QS._openJournal = function () {
    var SceneCS = window['Scene_CS_questJournal'];
    if (SceneCS) SceneManager.push(SceneCS);
  };
