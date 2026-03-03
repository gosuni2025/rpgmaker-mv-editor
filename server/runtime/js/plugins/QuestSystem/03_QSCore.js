
  // ============================================================
  // 퀘스트 조작 함수
  // ============================================================

  var QS = {};

  QS.addQuest = function (questId) {
    var entry = $gameSystem.getQuestEntry(questId);
    if (!entry) return;
    if (entry.status === 'hidden') entry.status = 'known';
    QS.refreshTracker();
  };

  QS.startQuest = function (questId) {
    var entry = $gameSystem.getQuestEntry(questId);
    if (!entry) return;
    entry.status = 'active';
    var data = getQuestData(questId);
    if (data) {
      data.objectives.forEach(function (obj) {
        var oe = entry.objectives[obj.id];
        if (!oe) oe = entry.objectives[obj.id] = { status: 'active', progress: 0 };
        if (!obj.hidden && oe.status === 'hidden') oe.status = 'active';
      });
    }
    QS.refreshTracker();
  };

  QS.completeQuest = function (questId) {
    var entry = $gameSystem.getQuestEntry(questId);
    if (!entry) return;
    entry.status = 'completed';
    if (autoGiveRewards) QS.giveRewards(questId);
    QS.refreshTracker();
  };

  QS.failQuest = function (questId) {
    var entry = $gameSystem.getQuestEntry(questId);
    if (!entry) return;
    entry.status = 'failed';
    QS.refreshTracker();
  };

  QS.removeQuest = function (questId) {
    var state = $gameSystem.questState();
    delete state.quests[questId];
    QS.refreshTracker();
  };

  QS.trackQuest = function (questId) {
    $gameSystem.questState().trackedQuest = questId || null;
    QS.refreshTracker();
  };

  QS.completeObjective = function (questId, objId) {
    var oe = $gameSystem.getObjectiveEntry(questId, Number(objId));
    if (!oe) return;
    oe.status = 'completed';
    QS.checkQuestAutoComplete(questId);
    QS.refreshTracker();
  };

  QS.failObjective = function (questId, objId) {
    var oe = $gameSystem.getObjectiveEntry(questId, Number(objId));
    if (!oe) return;
    oe.status = 'failed';
    QS.refreshTracker();
  };

  QS.showObjective = function (questId, objId) {
    var oe = $gameSystem.getObjectiveEntry(questId, Number(objId));
    if (!oe) return;
    if (oe.status === 'hidden') oe.status = 'active';
    QS.refreshTracker();
  };

  QS.giveRewards = function (questId) {
    var data = getQuestData(questId);
    if (!data || !data.rewards) return;
    data.rewards.forEach(function (r) {
      switch (r.type) {
        case 'gold':
          $gameParty.gainGold(r.amount || 0);
          break;
        case 'exp':
          $gameParty.members().forEach(function (actor) {
            actor.gainExp(r.amount || 0);
          });
          break;
        case 'item':
          var item = $dataItems[r.itemId || 1];
          if (item) $gameParty.gainItem(item, r.count || 1);
          break;
        case 'weapon':
          var weapon = $dataWeapons[r.itemId || 1];
          if (weapon) $gameParty.gainItem(weapon, r.count || 1);
          break;
        case 'armor':
          var armor = $dataArmors[r.itemId || 1];
          if (armor) $gameParty.gainItem(armor, r.count || 1);
          break;
      }
    });
  };

  QS.checkQuestAutoComplete = function (questId) {
    var entry = $gameSystem.getQuestEntry(questId);
    if (!entry || entry.status !== 'active') return;
    var data = getQuestData(questId);
    if (!data) return;
    var required = data.objectives.filter(function (o) { return !o.optional; });
    var allDone = required.every(function (o) {
      var oe = entry.objectives[o.id];
      return oe && oe.status === 'completed';
    });
    if (allDone) QS.completeQuest(questId);
  };

  QS.updateObjectiveProgress = function (questId, objId, progress) {
    var oe = $gameSystem.getObjectiveEntry(questId, Number(objId));
    if (!oe || oe.status !== 'active') return;
    oe.progress = progress;
    var data = getQuestData(questId);
    if (!data) return;
    var obj = data.objectives.find(function (o) { return o.id === Number(objId); });
    if (!obj) return;
    var target = obj.config.count || 1;
    if (progress >= target) {
      oe.status = 'completed';
      QS.checkQuestAutoComplete(questId);
    }
    QS.refreshTracker();
  };

  // 추적창 갱신 — OverlayManager 경유
  QS.refreshTracker = function () {
    if (!window.OverlayManager) return;
    var inst = OverlayManager._instances && OverlayManager._instances['questTracker'];
    if (!inst || !inst.scene.visible) return;
    if (inst.scene._rootWidget) inst.scene._rootWidget.refresh();
  };

  QS.getActiveObjectivesOfType = function (type) {
    var result = [];
    var state = $gameSystem.questState();
    var db = loadQuestDb();
    db.quests.forEach(function (qData) {
      var entry = state.quests[qData.id];
      if (!entry || entry.status !== 'active') return;
      qData.objectives.forEach(function (obj) {
        if (obj.type !== type) return;
        var oe = entry.objectives[obj.id];
        if (!oe || oe.status !== 'active') return;
        result.push({ questId: qData.id, obj: obj, oe: oe });
      });
    });
    return result;
  };
