/*:
 * @plugindesc 유연한 퀘스트 시스템 v1.1.0
 * 적 처치, 아이템 수집, 위치 도달 등 다양한 조건을 자동으로 추적합니다.
 * UI는 CustomSceneEngine 위젯 시스템으로 구동됩니다.
 * @author RPGMaker MV Web Editor
 *
 * @param journalKey
 * @text 저널 여는 키
 * @desc 퀘스트 저널을 여는 키보드 단축키 (빈 칸이면 비활성)
 * @default J
 *
 * @param showTracker
 * @text 맵 추적창 표시
 * @desc 맵 화면에 현재 추적 퀘스트 창을 표시할지 여부
 * @type boolean
 * @default true
 *
 * @param trackerX
 * @text 추적창 X
 * @type number
 * @default 0
 *
 * @param trackerY
 * @text 추적창 Y
 * @type number
 * @default 0
 *
 * @param trackerWidth
 * @text 추적창 너비
 * @type number
 * @default 300
 *
 * @param autoGiveRewards
 * @text 보상 자동 지급
 * @desc 퀘스트 완료 시 보상을 자동으로 지급할지 여부
 * @type boolean
 * @default true
 *
 * @help
 * ============================================================================
 * QuestSystem.js — 유연한 퀘스트 시스템
 * ============================================================================
 *
 * 퀘스트 데이터는 data/Quests.json 파일에서 로드됩니다.
 * 에디터의 데이터베이스 → 퀘스트 탭에서 편집할 수 있습니다.
 *
 * UI는 data/UIEditorScenes.json의 'questJournal' / 'questTracker' 씬을
 * CustomSceneEngine이 렌더링합니다.
 *
 * ── 플러그인 커맨드 ──────────────────────────────────────────────────────────
 *
 * QuestSystem open               # 퀘스트 저널 열기
 * QuestSystem add <questId>      # 퀘스트를 'known' 상태로 추가
 * QuestSystem start <questId>    # 퀘스트를 'active' 상태로 시작
 * QuestSystem complete <questId> # 퀘스트 강제 완료 (보상 자동 지급)
 * QuestSystem fail <questId>     # 퀘스트 실패 처리
 * QuestSystem remove <questId>   # 퀘스트 상태 초기화 (히든)
 * QuestSystem track <questId>    # 지정 퀘스트를 맵 추적창에 표시
 * QuestSystem untrack            # 추적 퀘스트 해제
 *
 * QuestSystem completeObjective <questId> <objId>  # 목표 수동 완료
 * QuestSystem failObjective <questId> <objId>      # 목표 실패
 * QuestSystem showObjective <questId> <objId>      # 숨겨진 목표 표시
 *
 * ── 퀘스트 상태 ──────────────────────────────────────────────────────────────
 *   hidden    — 아직 알려지지 않음 (기본)
 *   known     — 존재는 알지만 미수락
 *   active    — 진행 중
 *   completed — 완료
 *   failed    — 실패
 *
 * ── 목표 타입 ─────────────────────────────────────────────────────────────────
 *   kill      — 적 ID N마리 처치 (자동 추적)
 *   collect   — 아이템 N개 보유 (자동 추적)
 *   gold      — 골드 N 이상 보유 (자동 추적)
 *   variable  — 변수 X가 조건 충족 (자동 추적)
 *   switch    — 스위치 X가 ON/OFF (자동 추적)
 *   reach     — 맵 X의 위치에 도달 (자동 추적)
 *   talk      — 맵 X의 이벤트와 대화 (자동 추적)
 *   manual    — 플러그인 커맨드로 수동 완료
 */

(function () {
  'use strict';

  var params = PluginManager.parameters('QuestSystem');
  var journalKey = String(params['journalKey'] || 'J');
  var showTracker = String(params['showTracker']) !== 'false';
  var trackerX = Number(params['trackerX'] || 0);
  var trackerY = Number(params['trackerY'] || 0);
  var trackerWidth = Number(params['trackerWidth'] || 300);
  var autoGiveRewards = String(params['autoGiveRewards']) !== 'false';

  // ============================================================
  // 데이터 로드
  // ============================================================

  var _questDb = null;

  function loadQuestDb() {
    if (_questDb) return _questDb;
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'data/Quests.json', false);
      xhr.send();
      if (xhr.status >= 200 && xhr.status < 300) {
        _questDb = JSON.parse(xhr.responseText);
      }
    } catch (e) {
      console.warn('[QuestSystem] data/Quests.json 로드 실패:', e);
    }
    if (!_questDb) _questDb = { categories: [], quests: [] };
    return _questDb;
  }

  function getQuestData(questId) {
    var db = loadQuestDb();
    return db.quests.find(function (q) { return q.id === questId; }) || null;
  }

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

  // dataScript 빌더 — Widget_List(dataScript) 에서 호출
  QS._buildCategoryItems = function () {
    var db = loadQuestDb();
    var items = [{ name: '전체', symbol: '__all__', enabled: true }];
    db.categories.forEach(function (cat) {
      items.push({ name: cat.name, symbol: cat.id, enabled: true });
    });
    return items;
  };

  QS._buildQuestItems = function () {
    var db = loadQuestDb();
    var state = $gameSystem.questState();
    var cat = window._qs_currentCategory || '__all__';
    var statusColor = { active: '#6af', completed: '#8f8', failed: '#f88', known: '#fa8' };
    var items = [];
    db.quests.forEach(function (q) {
      var entry = state.quests[q.id];
      if (!entry || entry.status === 'hidden') return;
      if (cat !== '__all__' && q.category !== cat) return;
      items.push({ name: q.title || q.id, symbol: q.id, enabled: true,
        textColor: statusColor[entry.status] || '#ddd' });
    });
    if (items.length === 0) {
      items.push({ name: '(퀘스트 없음)', symbol: '__no_quests__', enabled: false });
    }
    return items;
  };

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

  // ── 퀘스트 상세창 ───────────────────────────────────────────────
  function _Window_QuestDetail(x, y, w, h) {
    this.initialize.apply(this, arguments);
  }
  _Window_QuestDetail.prototype = Object.create(Window_Base.prototype);
  _Window_QuestDetail.prototype.constructor = _Window_QuestDetail;
  _Window_QuestDetail.prototype.initialize = function (x, y, w, h) {
    Window_Base.prototype.initialize.call(this, x, y, w, h);
    this._quest = null;
    this.refresh();
  };
  _Window_QuestDetail.prototype.setQuest = function (quest) {
    if (this._quest !== quest) {
      this._quest = quest;
      this.refresh();
    }
  };
  _Window_QuestDetail.prototype.refresh = function () {
    this.contents.clear();
    var quest = this._quest;
    if (!quest) return;
    var entry = $gameSystem.getQuestEntry(quest.id);
    if (!entry) return;

    var lh = this.lineHeight();
    var y = 0;

    // 제목
    this.changeTextColor(this.systemColor());
    this.drawText(quest.title || quest.id, 0, y, this.contentsWidth(), 'left');
    this.resetTextColor();
    y += lh;

    // 메타 정보
    var meta = [];
    if (quest.difficulty) meta.push('난이도: ' + quest.difficulty);
    if (quest.requester) meta.push('의뢰: ' + quest.requester);
    if (quest.location) meta.push('장소: ' + quest.location);
    if (meta.length > 0) {
      this.changeTextColor('#aaa');
      this.drawText(meta.join('   '), 0, y, this.contentsWidth(), 'left');
      this.resetTextColor();
      y += lh;
    }

    // 구분선
    this.contents.fillRect(0, y + lh / 2 - 1, this.contentsWidth(), 1, '#555');
    y += lh;

    // 설명
    if (quest.description) {
      quest.description.split('\n').forEach(function (line) {
        this.drawTextEx(line, 0, y);
        y += lh;
      }, this);
      y += 4;
    }

    // 목표
    this.changeTextColor(this.systemColor());
    this.drawText('[ 목표 ]', 0, y, this.contentsWidth(), 'left');
    this.resetTextColor();
    y += lh;

    quest.objectives.forEach(function (obj) {
      var oe = entry.objectives[obj.id];
      if (!oe || oe.status === 'hidden') return;
      var statusIcon = { completed: '✓', failed: '✗', active: '○' }[oe.status] || '○';
      var statusColor = { completed: '#8f8', failed: '#f88', active: '#ddd' }[oe.status] || '#ddd';
      var optStr = obj.optional ? ' (선택)' : '';
      var progressStr = '';
      if (obj.type === 'kill' || obj.type === 'collect' || obj.type === 'gold') {
        var target = obj.config.count || obj.config.amount || 1;
        progressStr = ' [' + (oe.progress || 0) + '/' + target + ']';
      }
      this.changeTextColor(statusColor);
      this.drawText('  ' + statusIcon + ' ' + obj.text + optStr + progressStr,
        0, y, this.contentsWidth(), 'left');
      this.resetTextColor();
      y += lh;
    }, this);

    // 보상 (미완료 시에만)
    if (entry.status !== 'completed' && quest.rewards && quest.rewards.length > 0) {
      y += 4;
      this.changeTextColor(this.systemColor());
      this.drawText('[ 보상 ]', 0, y, this.contentsWidth(), 'left');
      this.resetTextColor();
      y += lh;

      quest.rewards.forEach(function (r) {
        var text = '';
        switch (r.type) {
          case 'gold':   text = (r.amount || 0) + 'G'; break;
          case 'exp':    text = (r.amount || 0) + ' EXP'; break;
          case 'item':   text = '아이템 ID:' + r.itemId + ' x' + (r.count || 1); break;
          case 'weapon': text = '무기 ID:' + r.itemId + ' x' + (r.count || 1); break;
          case 'armor':  text = '방어구 ID:' + r.itemId + ' x' + (r.count || 1); break;
        }
        this.drawText('  • ' + text, 0, y, this.contentsWidth(), 'left');
        y += lh;
      }, this);
    }

    // 완료/실패 표시
    if (entry.status === 'completed') {
      y += 4;
      this.changeTextColor('#8f8');
      this.drawText('★ 완료됨', 0, y, this.contentsWidth(), 'center');
      this.resetTextColor();
    } else if (entry.status === 'failed') {
      y += 4;
      this.changeTextColor('#f88');
      this.drawText('✗ 실패', 0, y, this.contentsWidth(), 'center');
      this.resetTextColor();
    }
  };

  // ── 추적창 ──────────────────────────────────────────────────────
  function _Window_QuestTracker(x, y, w) {
    this.initialize.apply(this, arguments);
  }
  _Window_QuestTracker.prototype = Object.create(Window_Base.prototype);
  _Window_QuestTracker.prototype.constructor = _Window_QuestTracker;
  _Window_QuestTracker.prototype.initialize = function (x, y, w) {
    var h = this.fittingHeight(8);
    Window_Base.prototype.initialize.call(this, x, y, w, h);
    this.opacity = 180;
    this.refresh();
  };
  _Window_QuestTracker.prototype.refresh = function () {
    this.contents.clear();
    var trackedId = $gameSystem.questState().trackedQuest;
    if (!trackedId) {
      this.height = 0;
      return;
    }
    var quest = getQuestData(trackedId);
    var entry = $gameSystem.getQuestEntry(trackedId);
    if (!quest || !entry || entry.status !== 'active') {
      this.height = 0;
      return;
    }

    var lh = this.lineHeight();
    var y = 0;

    this.changeTextColor(this.systemColor());
    this.drawText(quest.title, 0, y, this.contentsWidth(), 'left');
    this.resetTextColor();
    y += lh;

    quest.objectives.forEach(function (obj) {
      var oe = entry.objectives[obj.id];
      if (!oe || oe.status === 'hidden' || oe.status === 'completed') return;
      var progressStr = '';
      if (obj.type === 'kill' || obj.type === 'collect' || obj.type === 'gold') {
        var target = obj.config.count || obj.config.amount || 1;
        progressStr = ' (' + (oe.progress || 0) + '/' + target + ')';
      }
      this.drawText('○ ' + obj.text + progressStr, 0, y, this.contentsWidth(), 'left');
      y += lh;
    }, this);

    var newHeight = this.standardPadding() * 2 + y;
    if (this.height !== newHeight) {
      this.height = newHeight;
    }
  };

  // ============================================================
  // 커스텀 위젯 구현
  // ============================================================

  // ── Widget_QuestDetail — 퀘스트 상세 위젯 ───────────────────────
  function Widget_QuestDetail() {}
  Widget_QuestDetail.prototype = Object.create(Widget_Base.prototype);
  Widget_QuestDetail.prototype.constructor = Widget_QuestDetail;

  Widget_QuestDetail.prototype.initialize = function (def, parentWidget) {
    Widget_Base.prototype.initialize.call(this, def, parentWidget);
    this._quest = null;
    var win = new _Window_QuestDetail(this._x, this._y, this._width, this._height);
    this._window = win;
    this._displayObject = win;
  };

  Widget_QuestDetail.prototype.setQuest = function (quest) {
    this._quest = quest;
    if (this._window) this._window.setQuest(quest);
  };

  Widget_QuestDetail.prototype.refresh = function () {
    if (this._window && this._window.refresh) this._window.refresh();
    Widget_Base.prototype.refresh.call(this);
  };

  // 선택 퀘스트 변경 감지 — window._qs_currentQuestId 읽기
  Widget_QuestDetail.prototype.update = function () {
    Widget_Base.prototype.update.call(this);
    var questId = window._qs_currentQuestId || null;
    var db = loadQuestDb();
    var quest = null;
    if (questId) {
      for (var i = 0; i < db.quests.length; i++) {
        if (db.quests[i].id === questId) { quest = db.quests[i]; break; }
      }
    }
    if (quest !== this._quest) {
      this.setQuest(quest);
    }
  };

  // ── Widget_QuestTracker — 맵 추적 위젯 (오버레이 전용) ────────────
  function Widget_QuestTracker() {}
  Widget_QuestTracker.prototype = Object.create(Widget_Base.prototype);
  Widget_QuestTracker.prototype.constructor = Widget_QuestTracker;

  Widget_QuestTracker.prototype.initialize = function (def, parentWidget) {
    // 플러그인 파라미터로 위치/너비 오버라이드
    var d = {
      id: def.id, type: def.type,
      x: trackerX, y: trackerY,
      width: trackerWidth, height: def.height || 200
    };
    Widget_Base.prototype.initialize.call(this, d, parentWidget);
    var win = new _Window_QuestTracker(this._x, this._y, this._width);
    this._window = win;
    this._displayObject = win;
  };

  Widget_QuestTracker.prototype.refresh = function () {
    if (this._window && this._window.refresh) this._window.refresh();
    Widget_Base.prototype.refresh.call(this);
  };

  Widget_QuestTracker.prototype.update = function () {
    Widget_Base.prototype.update.call(this);
    // 30프레임마다 자동 갱신
    if (this._updateCount === undefined) this._updateCount = 0;
    if (++this._updateCount % 30 === 0) {
      this.refresh();
    }
  };

  // ============================================================
  // 위젯 등록 (CustomSceneEngine)
  // ============================================================

  if (window.__customSceneEngine && window.Widget_Base) {
    window.__customSceneEngine.registerWidget('questDetail', Widget_QuestDetail);
    window.__customSceneEngine.registerWidget('questTracker', Widget_QuestTracker);
  } else {
    console.warn('[QuestSystem] CustomSceneEngine를 찾을 수 없음 — Quest Journal UI가 비활성화됩니다.');
  }

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

  var _Scene_Map_terminate = Scene_Map.prototype.terminate;
  Scene_Map.prototype.terminate = function () {
    _Scene_Map_terminate.call(this);
    if (window.OverlayManager) {
      OverlayManager.hide('questTracker');
    }
  };

  var _Scene_Map_updateScene = Scene_Map.prototype.updateScene;
  Scene_Map.prototype.updateScene = function () {
    _Scene_Map_updateScene.call(this);
    if (!SceneManager.isSceneChanging() && journalKey) {
      if (Input.isTriggered(journalKey.toLowerCase()) || Input.isTriggered(journalKey.toUpperCase())) {
        QS._openJournal();
      }
    }
  };

  // ============================================================
  // 스크립트 전역 노출
  // ============================================================

  window.QS = QS;

})();
