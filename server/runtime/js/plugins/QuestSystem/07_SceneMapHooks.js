
  // ============================================================
  // 조건 체크 스크립트 헬퍼
  // ============================================================

  window.QuestSystem = {
    status: function (questId) { return $gameSystem.getQuestStatus(questId); },
    isActive: function (questId) { return $gameSystem.getQuestStatus(questId) === 'active'; },
    isCompleted: function (questId) { return $gameSystem.getQuestStatus(questId) === 'completed'; },
    isFailed: function (questId) { return $gameSystem.getQuestStatus(questId) === 'failed'; },
    isKnown: function (questId) {
      var s = $gameSystem.getQuestStatus(questId);
      return s === 'known' || s === 'active' || s === 'completed';
    },
    start: function (questId) { QS.startQuest(questId); },
    complete: function (questId) { QS.completeQuest(questId); },
    open: function () { QS._openJournal(); },
  };


  // ── 추적창 데이터 빌더 ──────────────────────────────────────────
  QS._buildTrackerItems = function () {
    var trackedId = $gameSystem.questState().trackedQuest;
    if (!trackedId) return [];
    var quest = getQuestData(trackedId);
    var entry = $gameSystem.getQuestEntry(trackedId);
    if (!quest || !entry || entry.status !== 'active') return [];
    var items = [];
    items.push({ name: quest.title, symbol: 'tracker_title', enabled: false, textColor: '#e8d080' });
    quest.objectives.forEach(function (obj) {
      var oe = entry.objectives[obj.id];
      if (!oe || oe.status === 'hidden' || oe.status === 'completed') return;
      var progressStr = '';
      if (obj.type === 'kill' || obj.type === 'collect' || obj.type === 'gold') {
        var target = obj.config.count || obj.config.amount || 1;
        progressStr = ' (' + (oe.progress || 0) + '/' + target + ')';
      }
      items.push({ name: '○ ' + obj.text + progressStr, symbol: 'obj_' + obj.id, enabled: false });
    });
    return items;
  };

  // ============================================================
  // Scene_Map 훅 — 추적창 오버레이 + 단축키
  // ============================================================

  var _Scene_Map_start = Scene_Map.prototype.start;
  Scene_Map.prototype.start = function () {
    _Scene_Map_start.call(this);
    if (showTracker && window.OverlayManager) {
      OverlayManager.show('questTracker');
    }
  };

  // stop(): SceneManager.push (저널/메뉴 등) 시 호출 — terminate()와 달리 맵 복귀 시 start() 재호출됨
  var _Scene_Map_stop = Scene_Map.prototype.stop;
  Scene_Map.prototype.stop = function () {
    _Scene_Map_stop.call(this);
    if (window.OverlayManager) {
      OverlayManager.hide('questTracker');
    }
  };

  var _Scene_Map_terminate = Scene_Map.prototype.terminate;
  Scene_Map.prototype.terminate = function () {
    _Scene_Map_terminate.call(this);
    if (window.OverlayManager) {
      OverlayManager.hide('questTracker');
    }
  };

  // OverlayManager.show/hide 훅 — 다른 오버레이(메뉴 등) 등장 시 트래커 숨김
  if (showTracker && window.OverlayManager) {
    var _OM_show_qs = OverlayManager.show;
    OverlayManager.show = function (sceneId, args) {
      _OM_show_qs.call(this, sceneId, args);
      if (sceneId !== 'questTracker') {
        var trackerInst = this._instances['questTracker'];
        if (trackerInst) trackerInst.scene.visible = false;
      }
    };
    var _OM_hide_qs = OverlayManager.hide;
    OverlayManager.hide = function (sceneId) {
      _OM_hide_qs.call(this, sceneId);
      if (sceneId !== 'questTracker') {
        var anyOtherVisible = false;
        for (var id in this._instances) {
          if (id !== 'questTracker' && this._instances[id].scene.visible) {
            anyOtherVisible = true;
            break;
          }
        }
        if (!anyOtherVisible && SceneManager._scene instanceof Scene_Map) {
          var trackerInst = this._instances['questTracker'];
          if (trackerInst) trackerInst.scene.visible = true;
        }
      }
    };
  }

  var _Scene_Map_updateScene = Scene_Map.prototype.updateScene;
  Scene_Map.prototype.updateScene = function () {
    _Scene_Map_updateScene.call(this);
    if (!SceneManager.isSceneChanging() && journalKey) {
      if (Input.isTriggered(_QS_JOURNAL_KEY)) {
        QS._openJournal();
      }
    }
  };

  // ============================================================
  // 스크립트 전역 노출
  // ============================================================

  window.QS = QS;
