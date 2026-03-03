
  // ============================================================
  // $gameSystem 확장 — 퀘스트 상태 저장
  // ============================================================

  var _initGameSystem = Game_System.prototype.initialize;
  Game_System.prototype.initialize = function () {
    _initGameSystem.call(this);
    this._questSystem = { quests: {}, trackedQuest: null };
  };

  Game_System.prototype.questState = function () {
    if (!this._questSystem) {
      this._questSystem = { quests: {}, trackedQuest: null };
    }
    return this._questSystem;
  };

  Game_System.prototype.getQuestEntry = function (questId) {
    var state = this.questState();
    if (!state.quests[questId]) {
      var data = getQuestData(questId);
      if (!data) return null;
      var objStates = {};
      data.objectives.forEach(function (obj) {
        objStates[obj.id] = {
          status: obj.hidden ? 'hidden' : 'active',
          progress: 0,
        };
      });
      state.quests[questId] = {
        status: 'hidden',
        objectives: objStates,
      };
    }
    return state.quests[questId];
  };

  Game_System.prototype.getQuestStatus = function (questId) {
    var entry = this.getQuestEntry(questId);
    return entry ? entry.status : 'hidden';
  };

  Game_System.prototype.setQuestStatus = function (questId, status) {
    var entry = this.getQuestEntry(questId);
    if (!entry) return;
    entry.status = status;
  };

  Game_System.prototype.getObjectiveEntry = function (questId, objId) {
    var entry = this.getQuestEntry(questId);
    if (!entry) return null;
    var numId = Number(objId);
    if (!entry.objectives[numId]) {
      entry.objectives[numId] = { status: 'hidden', progress: 0 };
    }
    return entry.objectives[numId];
  };
