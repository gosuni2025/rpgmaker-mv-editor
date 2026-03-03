
  // ============================================================
  // 자동 추적 훅
  // ============================================================

  var _Game_BattlerBase_die = Game_BattlerBase.prototype.die;
  Game_BattlerBase.prototype.die = function () {
    _Game_BattlerBase_die.call(this);
    if (this instanceof Game_Enemy) {
      var enemyId = this.enemyId();
      QS.getActiveObjectivesOfType('kill').forEach(function (item) {
        if ((item.obj.config.enemyId || 0) !== enemyId) return;
        item.oe.progress = (item.oe.progress || 0) + 1;
        var target = item.obj.config.count || 1;
        if (item.oe.progress >= target) {
          item.oe.status = 'completed';
          QS.checkQuestAutoComplete(item.questId);
        }
      });
      QS.refreshTracker();
    }
  };

  var _Game_Party_gainItem = Game_Party.prototype.gainItem;
  Game_Party.prototype.gainItem = function (item, amount, includeEquip) {
    _Game_Party_gainItem.call(this, item, amount, includeEquip);
    if (!item) return;
    var itemType = null;
    if ($dataItems && $dataItems.indexOf && $dataItems.indexOf(item) >= 0) itemType = 'item';
    else if (DataManager.isItem(item)) itemType = 'item';
    else if (DataManager.isWeapon(item)) itemType = 'weapon';
    else if (DataManager.isArmor(item)) itemType = 'armor';
    if (!itemType) return;

    var currentAmount = this.numItems(item);
    QS.getActiveObjectivesOfType('collect').forEach(function (entry) {
      var cfg = entry.obj.config;
      if (cfg.itemType !== itemType) return;
      if ((cfg.itemId || 0) !== item.id) return;
      entry.oe.progress = currentAmount;
      var target = cfg.count || 1;
      if (currentAmount >= target) {
        if (entry.oe.status === 'active') {
          entry.oe.status = 'completed';
          QS.checkQuestAutoComplete(entry.questId);
        }
      } else {
        if (entry.oe.status === 'completed') entry.oe.status = 'active';
      }
    });

    QS._checkGoldObjectives();
    QS.refreshTracker();
  };

  var _Game_Party_gainGold = Game_Party.prototype.gainGold;
  Game_Party.prototype.gainGold = function (amount) {
    _Game_Party_gainGold.call(this, amount);
    QS._checkGoldObjectives();
    QS.refreshTracker();
  };

  QS._checkGoldObjectives = function () {
    var gold = $gameParty.gold();
    QS.getActiveObjectivesOfType('gold').forEach(function (item) {
      var target = item.obj.config.amount || 0;
      item.oe.progress = gold;
      if (gold >= target) {
        if (item.oe.status === 'active') {
          item.oe.status = 'completed';
          QS.checkQuestAutoComplete(item.questId);
        }
      } else {
        if (item.oe.status === 'completed') item.oe.status = 'active';
      }
    });
  };

  var _Game_Variables_setValue = Game_Variables.prototype.setValue;
  Game_Variables.prototype.setValue = function (variableId, value) {
    _Game_Variables_setValue.call(this, variableId, value);
    QS.getActiveObjectivesOfType('variable').forEach(function (item) {
      var cfg = item.obj.config;
      if ((cfg.variableId || 0) !== variableId) return;
      var target = cfg.value || 0;
      var op = cfg.operator || '>=';
      var current = $gameVariables.value(variableId);
      var met = false;
      switch (op) {
        case '>=': met = current >= target; break;
        case '==': met = current === target; break;
        case '<=': met = current <= target; break;
        case '>':  met = current >  target; break;
        case '<':  met = current <  target; break;
        case '!=': met = current !== target; break;
      }
      item.oe.progress = current;
      if (met) {
        if (item.oe.status === 'active') {
          item.oe.status = 'completed';
          QS.checkQuestAutoComplete(item.questId);
        }
      } else {
        if (item.oe.status === 'completed') item.oe.status = 'active';
      }
    });
    QS.refreshTracker();
  };

  var _Game_Switches_setValue = Game_Switches.prototype.setValue;
  Game_Switches.prototype.setValue = function (switchId, value) {
    _Game_Switches_setValue.call(this, switchId, value);
    QS.getActiveObjectivesOfType('switch').forEach(function (item) {
      var cfg = item.obj.config;
      if ((cfg.switchId || 0) !== switchId) return;
      var wantOn = cfg.switchValue !== false;
      var met = (value === wantOn);
      item.oe.progress = met ? 1 : 0;
      if (met) {
        if (item.oe.status === 'active') {
          item.oe.status = 'completed';
          QS.checkQuestAutoComplete(item.questId);
        }
      } else {
        if (item.oe.status === 'completed') item.oe.status = 'active';
      }
    });
    QS.refreshTracker();
  };

  var _Scene_Map_update = Scene_Map.prototype.update;
  Scene_Map.prototype.update = function () {
    _Scene_Map_update.call(this);
    if (Graphics.frameCount % 10 === 0) {
      QS._checkReachObjectives();
    }
  };

  QS._checkReachObjectives = function () {
    if (!$gamePlayer || !$gameMap) return;
    var mapId = $gameMap.mapId();
    var px = $gamePlayer.x;
    var py = $gamePlayer.y;
    QS.getActiveObjectivesOfType('reach').forEach(function (item) {
      var cfg = item.obj.config;
      if ((cfg.mapId || 0) !== mapId) return;
      var dx = (cfg.x || 0) - px;
      var dy = (cfg.y || 0) - py;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var radius = cfg.radius || 1;
      if (dist <= radius) {
        item.oe.status = 'completed';
        QS.checkQuestAutoComplete(item.questId);
      }
    });
  };

  var _Game_Event_start = Game_Event.prototype.start;
  Game_Event.prototype.start = function () {
    _Game_Event_start.call(this);
    if (!$gameMap) return;
    var mapId = $gameMap.mapId();
    var eventId = this._eventId;
    QS.getActiveObjectivesOfType('talk').forEach(function (item) {
      var cfg = item.obj.config;
      if ((cfg.mapId || 0) !== mapId) return;
      if ((cfg.eventId || 0) !== eventId) return;
      item.oe.status = 'completed';
      QS.checkQuestAutoComplete(item.questId);
    });
    QS.refreshTracker();
  };
