//=============================================================================
// FlexibleJobs.js
//=============================================================================
/*:
 * @plugindesc 유연한 직업 시스템 — 멀티슬롯 직업, 독립 레벨, JP 스킬 습득
 * @author gosuni2025
 *
 * @param subClassSlots
 * @text 서브클래스 슬롯 수
 * @type number
 * @min 0
 * @max 5
 * @default 2
 *
 * @param subStatRate
 * @text 서브클래스 스탯 기여율 (%)
 * @type number
 * @min 0
 * @max 100
 * @default 50
 *
 * @param subExpRate
 * @text 서브클래스 EXP 배분율 (%)
 * @desc 전투 EXP 중 각 서브클래스에 배분되는 비율
 * @type number
 * @min 0
 * @max 100
 * @default 50
 *
 * @param jpPerBattle
 * @text 전투당 JP 획득량
 * @type number
 * @min 0
 * @default 10
 *
 * @param jpPerLevel
 * @text 레벨업당 JP 획득량
 * @type number
 * @min 0
 * @default 50
 *
 * @param jpName
 * @text JP 표시명
 * @default JP
 *
 * @param cmdClassChange
 * @text 전직 메뉴 이름
 * @default 전직
 *
 * @param cmdSkillLearn
 * @text 스킬 습득 메뉴 이름
 * @default 스킬 습득
 *
 * @help
 * FlexibleJobs.js
 *
 * ■ 개요
 *   주직업 1개 + 서브클래스 N개 슬롯을 지원합니다.
 *   각 직업은 독립된 레벨, EXP, JP를 보유합니다.
 *
 * ■ 스킬 습득 방식
 *   1. 레벨 자동 습득 — 직업 장착 중 레벨 달성 시 자동으로 사용 가능
 *                       <Portable> 태그 추가 시 직업을 바꿔도 영구 유지
 *   2. JP 소모 습득   — JP를 소비하여 스킬을 영구 습득 (어느 직업에서도 사용 가능)
 *
 * ■ 클래스 노트태그
 *   <Unlock Requires>
 *   Class x Lv y
 *   </Unlock Requires>
 *     클래스 x를 레벨 y 이상 달성해야 이 직업이 해금됩니다.
 *     여러 줄 작성 가능, 모든 조건을 충족해야 합니다.
 *
 *   <Primary Only>   주직업 슬롯에만 배치 가능
 *   <Sub Only>       서브클래스 슬롯에만 배치 가능
 *   <JP Rate: x>     이 직업 장착 시 JP 획득률 (기본 100)
 *
 * ■ 스킬 노트태그
 *   <Learn Level: x>  해당 직업 레벨 x 달성 시 자동 습득
 *   <Learn JP: x>     JP x 소모로 영구 습득 (스킬 습득 화면에서 구입)
 *   <Portable>        레벨 자동 습득 스킬을 직업 변경 후에도 유지
 *
 * ■ 플러그인 커맨드
 *   OpenClassChange              전직 화면 열기
 *   OpenSkillLearn               스킬 습득 화면 열기
 *   GainJP actorId amount        액터에게 JP 지급 (현재 주직업 귀속)
 *   UnlockClass actorId classId  직업 강제 해금
 */

(function () {
  'use strict';

  //===========================================================================
  // 파라미터
  //===========================================================================
  var p = PluginManager.parameters('FlexibleJobs');
  var SUB_SLOTS = Math.max(0, parseInt(p['subClassSlots'] || 2));
  var SUB_RATE  = Math.min(1, Math.max(0, parseInt(p['subStatRate'] || 50) / 100));
  var SUB_EXP   = Math.min(1, Math.max(0, parseInt(p['subExpRate']  || 50) / 100));
  var JP_BATTLE = parseInt(p['jpPerBattle']  || 10);
  var JP_LEVEL  = parseInt(p['jpPerLevel']   || 50);
  var JP_NAME   = String(p['jpName']         || 'JP');
  var CMD_CLASS = String(p['cmdClassChange'] || '전직');
  var CMD_LEARN = String(p['cmdSkillLearn']  || '스킬 습득');

  //===========================================================================
  // 노트태그 파서
  //===========================================================================
  var Note = {
    _cc: {},
    _sc: {},

    cls: function (id) {
      if (this._cc[id]) return this._cc[id];
      var obj = $dataClasses && $dataClasses[id];
      if (!obj) return (this._cc[id] = { unlockReqs: [], jpRate: 100, primaryOnly: false, subOnly: false });
      var note = obj.note || '';
      var d = {
        primaryOnly: /<Primary Only>/i.test(note),
        subOnly    : /<Sub Only>/i.test(note),
        jpRate     : 100,
        unlockReqs : []
      };
      var m = note.match(/<JP Rate:\s*(\d+)>/i);
      if (m) d.jpRate = parseInt(m[1]);
      var block = note.match(/<Unlock Requires>([\s\S]*?)<\/Unlock Requires>/i);
      if (block) {
        block[1].split('\n').forEach(function (line) {
          var lm = line.match(/Class\s+(\d+)\s+Lv\s+(\d+)/i);
          if (lm) d.unlockReqs.push({ cid: +lm[1], lv: +lm[2] });
        });
      }
      return (this._cc[id] = d);
    },

    skill: function (id) {
      if (this._sc[id]) return this._sc[id];
      var obj = $dataSkills && $dataSkills[id];
      if (!obj) return (this._sc[id] = { learnLv: null, learnJp: null, portable: false });
      var note = obj.note || '';
      var d = {
        portable: /<Portable>/i.test(note),
        learnLv : null,
        learnJp : null
      };
      var lm = note.match(/<Learn Level:\s*(\d+)>/i);
      if (lm) d.learnLv = +lm[1];
      var jm = note.match(/<Learn JP:\s*(\d+)>/i);
      if (jm) d.learnJp = +jm[1];
      return (this._sc[id] = d);
    },

    clear: function () { this._cc = {}; this._sc = {}; }
  };

  //===========================================================================
  // Game_Actor 확장
  //===========================================================================

  // ── 초기화 ──────────────────────────────────────────────────────────────
  var _initMembers = Game_Actor.prototype.initMembers;
  Game_Actor.prototype.initMembers = function () {
    _initMembers.call(this);
    this._fjJp       = {};   // { classId: number }  직업별 JP
    this._fjSubIds   = [];   // 서브클래스 ID 배열 (0 = 비어있음)
    this._fjUnlocked = [];   // 해금된 classId 목록
    this._fjLearnedSk = [];  // JP 소모로 영구 습득한 스킬 ID
    this._fjPortable  = [];  // <Portable> 태그로 영구 보유하게 된 스킬 ID
  };

  var _setup = Game_Actor.prototype.setup;
  Game_Actor.prototype.setup = function (actorId) {
    _setup.call(this, actorId);
    this._fjSubIds   = new Array(SUB_SLOTS).fill(0);
    this._fjUnlocked = [this._classId];
    if (!this._fjJp) this._fjJp = {};
  };

  // ── 서브클래스 접근 ──────────────────────────────────────────────────────
  Game_Actor.prototype.fjSubIds = function () {
    if (!this._fjSubIds) this._fjSubIds = new Array(SUB_SLOTS).fill(0);
    return this._fjSubIds;
  };

  // 현재 장착 중인 모든 직업 ID (주직업 + 서브, 0 제외)
  Game_Actor.prototype.fjActiveClassIds = function () {
    var res = [this._classId];
    this.fjSubIds().forEach(function (id) { if (id > 0) res.push(id); });
    return res;
  };

  // ── 직업별 레벨 조회 ─────────────────────────────────────────────────────
  // 주직업은 _level, 서브클래스는 _exp[classId]에서 역산
  Game_Actor.prototype.fjClassLevel = function (classId) {
    if (classId === this._classId) return this._level;
    var exp = (this._exp && this._exp[classId]) || 0;
    // 현재 classId를 임시 교체해 expForLevel 공식 활용
    var origId = this._classId;
    this._classId = classId;
    var lv = 1;
    var max = this.maxLevel();
    while (lv < max && exp >= this.expForLevel(lv + 1)) lv++;
    this._classId = origId;
    return lv;
  };

  // ── JP ───────────────────────────────────────────────────────────────────
  Game_Actor.prototype.fjJp = function (classId) {
    if (!this._fjJp) this._fjJp = {};
    return this._fjJp[classId || this._classId] || 0;
  };

  Game_Actor.prototype.fjGainJp = function (amount, classId) {
    if (!this._fjJp) this._fjJp = {};
    classId = classId || this._classId;
    var rate = Note.cls(classId).jpRate;
    this._fjJp[classId] = (this._fjJp[classId] || 0) + Math.round(amount * rate / 100);
  };

  Game_Actor.prototype.fjUseJp = function (amount, classId) {
    if (!this._fjJp) this._fjJp = {};
    classId = classId || this._classId;
    this._fjJp[classId] = Math.max(0, (this._fjJp[classId] || 0) - amount);
  };

  // ── JP 스킬 습득 ─────────────────────────────────────────────────────────
  Game_Actor.prototype.fjCanLearnByJp = function (skillId, classId) {
    classId = classId || this._classId;
    var sd = Note.skill(skillId);
    if (sd.learnJp === null) return false;
    if ((this._fjLearnedSk || []).indexOf(skillId) >= 0) return false;
    return this.fjJp(classId) >= sd.learnJp;
  };

  Game_Actor.prototype.fjLearnByJp = function (skillId, classId) {
    classId = classId || this._classId;
    var sd = Note.skill(skillId);
    if (sd.learnJp === null) return;
    this.fjUseJp(sd.learnJp, classId);
    if (!this._fjLearnedSk) this._fjLearnedSk = [];
    if (this._fjLearnedSk.indexOf(skillId) < 0) this._fjLearnedSk.push(skillId);
    this.refresh();
  };

  // ── 레벨업 — JP 지급 + Portable 스킬 갱신 ──────────────────────────────
  var _levelUp = Game_Actor.prototype.levelUp;
  Game_Actor.prototype.levelUp = function () {
    _levelUp.call(this);   // 원본: _level++, 레벨 습득 스킬 learnSkill 호출
    this.fjGainJp(JP_LEVEL, this._classId);
    this._fjScanPortable(this._classId, this._level);
  };

  // learnSkill 오버라이드 — Portable 태그 있으면 영구 목록에 추가
  var _learnSkill = Game_Actor.prototype.learnSkill;
  Game_Actor.prototype.learnSkill = function (skillId) {
    _learnSkill.call(this, skillId);
    if (Note.skill(skillId).portable) {
      if (!this._fjPortable) this._fjPortable = [];
      if (this._fjPortable.indexOf(skillId) < 0) this._fjPortable.push(skillId);
    }
  };

  // 직업의 현재 레벨까지 Portable 스킬을 영구 목록에 추가
  Game_Actor.prototype._fjScanPortable = function (classId, level) {
    var cls = $dataClasses[classId];
    if (!cls || !cls.learnings) return;
    if (!this._fjPortable) this._fjPortable = [];
    cls.learnings.forEach(function (l) {
      if (l.level <= level && Note.skill(l.skillId).portable) {
        if (this._fjPortable.indexOf(l.skillId) < 0) this._fjPortable.push(l.skillId);
      }
    }, this);
  };

  // ── skills() 오버라이드 ───────────────────────────────────────────────────
  Game_Actor.prototype.skills = function () {
    var ids = [];

    // 1. 현재 장착 직업(주 + 서브)의 레벨 달성 스킬
    this.fjActiveClassIds().forEach(function (classId) {
      var cls = $dataClasses[classId];
      if (!cls || !cls.learnings) return;
      var lv = this.fjClassLevel(classId);
      cls.learnings.forEach(function (l) {
        if (l.level <= lv && ids.indexOf(l.skillId) < 0) ids.push(l.skillId);
      });
    }, this);

    // 2. Portable 영구 스킬 (다른 직업에서 습득한 것 포함)
    (this._fjPortable || []).forEach(function (id) {
      if (ids.indexOf(id) < 0) ids.push(id);
    });

    // 3. JP 영구 습득 스킬
    (this._fjLearnedSk || []).forEach(function (id) {
      if (ids.indexOf(id) < 0) ids.push(id);
    });

    return ids.sort(function (a, b) { return a - b; })
              .map(function (id) { return $dataSkills[id]; })
              .filter(Boolean);
  };

  Game_Actor.prototype.isLearnedSkill = function (skillId) {
    if ((this._fjLearnedSk || []).indexOf(skillId) >= 0) return true;
    if ((this._fjPortable  || []).indexOf(skillId) >= 0) return true;
    return this.fjActiveClassIds().some(function (classId) {
      var cls = $dataClasses[classId];
      if (!cls || !cls.learnings) return false;
      var lv = this.fjClassLevel(classId);
      return cls.learnings.some(function (l) { return l.skillId === skillId && l.level <= lv; });
    }, this);
  };

  // ── 스탯 계산 — 서브클래스 기여율 적용 ──────────────────────────────────
  var _paramBase = Game_Actor.prototype.paramBase;
  Game_Actor.prototype.paramBase = function (paramId) {
    var base = _paramBase.call(this, paramId);
    this.fjSubIds().forEach(function (subId) {
      if (subId <= 0) return;
      var cls = $dataClasses[subId];
      if (!cls) return;
      var lv = this.fjClassLevel(subId);
      base += Math.floor(cls.params[paramId][lv] * SUB_RATE);
    }, this);
    return base;
  };

  // ── EXP 배분 — 서브클래스에도 독립 EXP 지급 ─────────────────────────────
  var _gainExp = Game_Actor.prototype.gainExp;
  Game_Actor.prototype.gainExp = function (exp) {
    // 주직업: 원본 그대로 처리
    _gainExp.call(this, exp);
    // 서브클래스: 별도 EXP 배분
    if (SUB_EXP <= 0) return;
    var subExp = Math.round(exp * this.finalExpRate() * SUB_EXP);
    if (subExp <= 0) return;
    this.fjSubIds().forEach(function (subId) {
      if (subId > 0) this._fjGainSubExp(subId, subExp);
    }, this);
  };

  Game_Actor.prototype._fjGainSubExp = function (classId, exp) {
    if (!this._exp) this._exp = {};
    var prevLv = this.fjClassLevel(classId);
    this._exp[classId] = (this._exp[classId] || 0) + exp;
    var newLv = this.fjClassLevel(classId);
    if (newLv > prevLv) {
      // 레벨업 횟수만큼 JP 지급 + Portable 스킬 갱신
      this.fjGainJp(JP_LEVEL * (newLv - prevLv), classId);
      this._fjScanPortable(classId, newLv);
    }
  };

  // ── 언락 시스템 ──────────────────────────────────────────────────────────
  Game_Actor.prototype.fjIsUnlocked = function (classId) {
    if (!this._fjUnlocked) this._fjUnlocked = [];
    if (this._fjUnlocked.indexOf(classId) >= 0) return true;
    var reqs = Note.cls(classId).unlockReqs;
    if (!reqs.length) return true;  // 조건 없으면 기본 해금
    var ok = reqs.every(function (r) { return this.fjClassLevel(r.cid) >= r.lv; }, this);
    if (ok) this._fjUnlocked.push(classId);
    return ok;
  };

  Game_Actor.prototype.fjUnlockClass = function (classId) {
    if (!this._fjUnlocked) this._fjUnlocked = [];
    if (this._fjUnlocked.indexOf(classId) < 0) this._fjUnlocked.push(classId);
  };

  // 슬롯 종류에 따라 선택 가능한 직업 목록 반환
  Game_Actor.prototype.fjAvailableClasses = function (forPrimary) {
    var res = [];
    for (var id = 1; id < $dataClasses.length; id++) {
      var cls = $dataClasses[id];
      if (!cls || !cls.name) continue;
      if (!this.fjIsUnlocked(id)) continue;
      var cd = Note.cls(id);
      if (forPrimary && cd.subOnly) continue;
      if (!forPrimary && cd.primaryOnly) continue;
      res.push(id);
    }
    return res;
  };

  // ── 전직 ─────────────────────────────────────────────────────────────────
  // 원본 changeClass(keepExp=true)를 활용해 직업별 EXP를 독립 유지
  Game_Actor.prototype.fjChangePrimary = function (classId) {
    if (!classId || classId === this._classId) return;
    this.changeClass(classId, true);
    this.fjUnlockClass(classId);
    this._fjScanPortable(classId, this._level);
  };

  Game_Actor.prototype.fjSetSub = function (slot, classId) {
    if (!this._fjSubIds) this._fjSubIds = new Array(SUB_SLOTS).fill(0);
    if (slot < 0 || slot >= SUB_SLOTS) return;
    this._fjSubIds[slot] = classId || 0;
    if (classId) {
      this.fjUnlockClass(classId);
      this._fjScanPortable(classId, this.fjClassLevel(classId));
    }
    this.refresh();
  };

  //===========================================================================
  // 전투 JP 획득
  //===========================================================================
  var _gainExp_BM = BattleManager.gainExp;
  BattleManager.gainExp = function () {
    _gainExp_BM.call(this);
    $gameParty.allMembers().forEach(function (actor) {
      actor.fjGainJp(JP_BATTLE);
    });
  };

  //===========================================================================
  // 메뉴 통합
  //===========================================================================
  var _addOriginalCmds = Window_MenuCommand.prototype.addOriginalCommands;
  Window_MenuCommand.prototype.addOriginalCommands = function () {
    _addOriginalCmds.call(this);
    this.addCommand(CMD_CLASS, 'fjClassChange', true);
    this.addCommand(CMD_LEARN, 'fjSkillLearn',  true);
  };

  var _createCmdWindow = Scene_Menu.prototype.createCommandWindow;
  Scene_Menu.prototype.createCommandWindow = function () {
    _createCmdWindow.call(this);
    this._commandWindow.setHandler('fjClassChange', this.onFjClassChange.bind(this));
    this._commandWindow.setHandler('fjSkillLearn',  this.onFjSkillLearn.bind(this));
  };
  Scene_Menu.prototype.onFjClassChange = function () { SceneManager.push(Scene_ClassChange); };
  Scene_Menu.prototype.onFjSkillLearn  = function () { SceneManager.push(Scene_SkillLearn);  };

  //===========================================================================
  // Scene_ClassChange — 전직 화면
  //===========================================================================
  function Scene_ClassChange() { this.initialize.apply(this, arguments); }
  Scene_ClassChange.prototype = Object.create(Scene_MenuBase.prototype);
  Scene_ClassChange.prototype.constructor = Scene_ClassChange;

  Scene_ClassChange.prototype.initialize = function () {
    Scene_MenuBase.prototype.initialize.call(this);
  };

  Scene_ClassChange.prototype.create = function () {
    Scene_MenuBase.prototype.create.call(this);

    this._helpWindow = new Window_Help(2);
    this.addWindow(this._helpWindow);

    var wy = this._helpWindow.height;
    this._slotWindow = new Window_ClassSlot(0, wy);
    this._slotWindow.setHandler('ok',     this.onSlotOk.bind(this));
    this._slotWindow.setHandler('cancel', this.popScene.bind(this));
    this.addWindow(this._slotWindow);

    var ly = wy + this._slotWindow.height;
    var lh = Graphics.boxHeight - ly;
    var lw = Math.floor(Graphics.boxWidth / 2);
    this._listWindow = new Window_ClassList(0, ly, lw, lh);
    this._listWindow.setHandler('ok',     this.onListOk.bind(this));
    this._listWindow.setHandler('cancel', this.onListCancel.bind(this));
    this._listWindow.setHelpWindow(this._helpWindow);
    this._listWindow.hide();
    this.addWindow(this._listWindow);

    this._statusWindow = new Window_ClassStatus(lw, ly, Graphics.boxWidth - lw, lh);
    this._statusWindow.hide();
    this.addWindow(this._statusWindow);

    this._slotWindow.setActor($gameParty.menuActor());
    this._slotWindow.activate();
  };

  Scene_ClassChange.prototype.onSlotOk = function () {
    var actor = $gameParty.menuActor();
    this._currentSlot = this._slotWindow.index();
    var forPrimary = (this._currentSlot === 0);
    this._listWindow.setup(actor, forPrimary);
    this._listWindow.show();
    this._listWindow.activate();
    this._statusWindow.show();
  };

  Scene_ClassChange.prototype.onListOk = function () {
    var actor   = $gameParty.menuActor();
    var classId = this._listWindow.selectedId();
    if (classId) {
      if (this._currentSlot === 0) {
        actor.fjChangePrimary(classId);
      } else {
        actor.fjSetSub(this._currentSlot - 1, classId);
      }
      SoundManager.playEquip();
      this._slotWindow.refresh();
    }
    this.onListCancel();
  };

  Scene_ClassChange.prototype.onListCancel = function () {
    this._listWindow.hide();
    this._statusWindow.hide();
    this._slotWindow.activate();
  };

  //===========================================================================
  // Window_ClassSlot — 주직업 + 서브 슬롯 목록
  //===========================================================================
  function Window_ClassSlot(x, y) { this.initialize.apply(this, arguments); }
  Window_ClassSlot.prototype = Object.create(Window_Selectable.prototype);
  Window_ClassSlot.prototype.constructor = Window_ClassSlot;

  Window_ClassSlot.prototype.initialize = function (x, y) {
    var h = this.fittingHeight(1 + SUB_SLOTS);
    Window_Selectable.prototype.initialize.call(this, x, y, Graphics.boxWidth, h);
    this._actor = null;
  };

  Window_ClassSlot.prototype.setActor = function (actor) {
    this._actor = actor;
    this.refresh();
  };

  Window_ClassSlot.prototype.maxItems = function () { return 1 + SUB_SLOTS; };

  Window_ClassSlot.prototype.drawItem = function (index) {
    var actor = this._actor;
    if (!actor) return;
    var rect = this.itemRectForText(index);
    var label, classId, lv;
    if (index === 0) {
      label   = '주직업';
      classId = actor._classId;
      lv      = actor._level;
    } else {
      label   = '서브 ' + index;
      classId = actor.fjSubIds()[index - 1];
      lv      = classId > 0 ? actor.fjClassLevel(classId) : 0;
    }
    var cls  = classId > 0 ? $dataClasses[classId] : null;
    var name = cls ? cls.name + '  Lv.' + lv : '없음';
    this.changeTextColor(this.systemColor());
    this.drawText(label, rect.x, rect.y, 80);
    this.resetTextColor();
    this.drawText(name, rect.x + 90, rect.y, rect.width - 90);
  };

  Window_ClassSlot.prototype.refresh = function () {
    this.contents.clear();
    for (var i = 0; i < this.maxItems(); i++) this.drawItem(i);
  };

  //===========================================================================
  // Window_ClassList — 전직 가능 직업 목록
  //===========================================================================
  function Window_ClassList(x, y, w, h) { this.initialize.apply(this, arguments); }
  Window_ClassList.prototype = Object.create(Window_Selectable.prototype);
  Window_ClassList.prototype.constructor = Window_ClassList;

  Window_ClassList.prototype.initialize = function (x, y, w, h) {
    Window_Selectable.prototype.initialize.call(this, x, y, w, h);
    this._actor = null;
    this._data  = [];
  };

  Window_ClassList.prototype.setup = function (actor, forPrimary) {
    this._actor = actor;
    this._data  = actor.fjAvailableClasses(forPrimary);
    this.refresh();
    this.select(0);
  };

  Window_ClassList.prototype.maxItems  = function () { return this._data.length; };
  Window_ClassList.prototype.selectedId = function () { return this._data[this.index()] || 0; };

  Window_ClassList.prototype.drawItem = function (index) {
    var classId = this._data[index];
    var cls     = $dataClasses[classId];
    if (!cls) return;
    var rect = this.itemRectForText(index);
    var lv   = this._actor.fjClassLevel(classId);
    this.drawText(cls.name, rect.x, rect.y, rect.width - 80);
    this.changeTextColor(this.systemColor());
    this.drawText('Lv.' + lv, rect.x + rect.width - 80, rect.y, 80, 'right');
    this.resetTextColor();
  };

  Window_ClassList.prototype.updateHelp = function () {
    var id  = this.selectedId();
    var cls = id ? $dataClasses[id] : null;
    this._helpWindow.setText(cls ? (cls.description || cls.name) : '');
  };

  Window_ClassList.prototype.refresh = function () {
    this.contents.clear();
    for (var i = 0; i < this.maxItems(); i++) this.drawItem(i);
  };

  //===========================================================================
  // Window_ClassStatus — 선택 직업 상세 (JP, 레벨)
  //===========================================================================
  function Window_ClassStatus(x, y, w, h) { this.initialize.apply(this, arguments); }
  Window_ClassStatus.prototype = Object.create(Window_Base.prototype);
  Window_ClassStatus.prototype.constructor = Window_ClassStatus;

  Window_ClassStatus.prototype.initialize = function (x, y, w, h) {
    Window_Base.prototype.initialize.call(this, x, y, w, h);
    this._actor = null;
    this._classId = 0;
  };

  Window_ClassStatus.prototype.setup = function (actor, classId) {
    this._actor   = actor;
    this._classId = classId;
    this.refresh();
  };

  Window_ClassStatus.prototype.refresh = function () {
    this.contents.clear();
    var cls = this._classId ? $dataClasses[this._classId] : null;
    if (!cls || !this._actor) return;
    var lh = this.lineHeight();
    var lv = this._actor.fjClassLevel(this._classId);
    var jp = this._actor.fjJp(this._classId);
    this.drawText(cls.name, 0, 0, this.contentsWidth());
    this.changeTextColor(this.systemColor());
    this.drawText('Lv',   0, lh,     40); this.resetTextColor();
    this.drawText(lv,    44, lh,     60, 'right');
    this.changeTextColor(this.systemColor());
    this.drawText(JP_NAME, 0, lh * 2, 40); this.resetTextColor();
    this.drawText(jp,    44, lh * 2, 60, 'right');
  };

  //===========================================================================
  // Scene_SkillLearn — JP 스킬 습득 화면
  //===========================================================================
  function Scene_SkillLearn() { this.initialize.apply(this, arguments); }
  Scene_SkillLearn.prototype = Object.create(Scene_MenuBase.prototype);
  Scene_SkillLearn.prototype.constructor = Scene_SkillLearn;

  Scene_SkillLearn.prototype.initialize = function () {
    Scene_MenuBase.prototype.initialize.call(this);
  };

  Scene_SkillLearn.prototype.create = function () {
    Scene_MenuBase.prototype.create.call(this);

    this._helpWindow = new Window_Help(2);
    this.addWindow(this._helpWindow);

    var sy = this._helpWindow.height;
    this._statusWindow = new Window_SkillLearnStatus(0, sy);
    this.addWindow(this._statusWindow);

    var ly = sy + this._statusWindow.height;
    this._listWindow = new Window_SkillLearnList(0, ly, Graphics.boxWidth, Graphics.boxHeight - ly);
    this._listWindow.setHelpWindow(this._helpWindow);
    this._listWindow.setHandler('ok',     this.onLearnOk.bind(this));
    this._listWindow.setHandler('cancel', this.popScene.bind(this));
    this.addWindow(this._listWindow);

    var actor = $gameParty.menuActor();
    this._statusWindow.setActor(actor);
    this._listWindow.setActor(actor);
  };

  Scene_SkillLearn.prototype.onLearnOk = function () {
    var actor   = $gameParty.menuActor();
    var skillId = this._listWindow.selectedId();
    if (skillId && actor.fjCanLearnByJp(skillId)) {
      actor.fjLearnByJp(skillId);
      SoundManager.playEquip();
      this._statusWindow.refresh();
      this._listWindow.refresh();
    } else {
      SoundManager.playBuzzer();
    }
    this._listWindow.activate();
  };

  //===========================================================================
  // Window_SkillLearnStatus — 액터명 + 현재 JP 표시
  //===========================================================================
  function Window_SkillLearnStatus(x, y) { this.initialize.apply(this, arguments); }
  Window_SkillLearnStatus.prototype = Object.create(Window_Base.prototype);
  Window_SkillLearnStatus.prototype.constructor = Window_SkillLearnStatus;

  Window_SkillLearnStatus.prototype.initialize = function (x, y) {
    Window_Base.prototype.initialize.call(this, x, y, Graphics.boxWidth, this.fittingHeight(1));
    this._actor = null;
  };

  Window_SkillLearnStatus.prototype.setActor = function (actor) {
    this._actor = actor;
    this.refresh();
  };

  Window_SkillLearnStatus.prototype.refresh = function () {
    this.contents.clear();
    if (!this._actor) return;
    var cls  = $dataClasses[this._actor._classId];
    var name = this._actor.name() + (cls ? '  [' + cls.name + ']' : '');
    var jp   = this._actor.fjJp();
    var hw   = Math.floor(this.contentsWidth() / 2);
    this.drawText(name, 0, 0, hw);
    this.changeTextColor(this.systemColor());
    this.drawText(JP_NAME, hw, 0, 60);
    this.resetTextColor();
    this.drawText(jp, hw + 64, 0, 100, 'right');
  };

  //===========================================================================
  // Window_SkillLearnList — JP로 구입 가능한 스킬 목록
  //===========================================================================
  function Window_SkillLearnList(x, y, w, h) { this.initialize.apply(this, arguments); }
  Window_SkillLearnList.prototype = Object.create(Window_Selectable.prototype);
  Window_SkillLearnList.prototype.constructor = Window_SkillLearnList;

  Window_SkillLearnList.prototype.initialize = function (x, y, w, h) {
    Window_Selectable.prototype.initialize.call(this, x, y, w, h);
    this._actor = null;
    this._data  = [];
  };

  Window_SkillLearnList.prototype.setActor = function (actor) {
    this._actor = actor;
    this.refresh();
    this.select(0);
    this.activate();
  };

  // 현재 장착 직업(주 + 서브)의 learnings 중 <Learn JP> 태그가 있는 스킬 수집
  Window_SkillLearnList.prototype._buildData = function () {
    if (!this._actor) { this._data = []; return; }
    var res  = [];
    var seen = {};
    this._actor.fjActiveClassIds().forEach(function (classId) {
      var cls = $dataClasses[classId];
      if (!cls || !cls.learnings) return;
      cls.learnings.forEach(function (l) {
        if (!seen[l.skillId] && Note.skill(l.skillId).learnJp !== null) {
          res.push(l.skillId);
          seen[l.skillId] = true;
        }
      });
    });
    this._data = res;
  };

  Window_SkillLearnList.prototype.maxItems   = function () { return this._data.length; };
  Window_SkillLearnList.prototype.selectedId = function () { return this._data[this.index()] || 0; };

  Window_SkillLearnList.prototype.isCurrentItemEnabled = function () {
    return !!this._actor && this._actor.fjCanLearnByJp(this.selectedId());
  };

  Window_SkillLearnList.prototype.drawItem = function (index) {
    var skillId = this._data[index];
    var skill   = $dataSkills[skillId];
    if (!skill || !this._actor) return;
    var rect    = this.itemRectForText(index);
    var sd      = Note.skill(skillId);
    var learned = (this._actor._fjLearnedSk || []).indexOf(skillId) >= 0;
    var afford  = this._actor.fjJp() >= sd.learnJp;

    if      (learned) this.changeTextColor(this.textColor(8));   // 회색: 이미 습득
    else if (!afford) this.changeTextColor(this.textColor(18));  // 빨강: JP 부족
    else              this.resetTextColor();

    this.drawText(skill.name, rect.x, rect.y, rect.width - 130);
    var label = learned ? '습득 완료' : (sd.learnJp + ' ' + JP_NAME);
    this.drawText(label, rect.x + rect.width - 130, rect.y, 130, 'right');
    this.resetTextColor();
  };

  Window_SkillLearnList.prototype.updateHelp = function () {
    var id    = this.selectedId();
    var skill = id ? $dataSkills[id] : null;
    this._helpWindow.setItem(skill);
  };

  Window_SkillLearnList.prototype.refresh = function () {
    this._buildData();
    this.contents.clear();
    for (var i = 0; i < this.maxItems(); i++) this.drawItem(i);
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
        SceneManager.push(Scene_ClassChange);
        break;
      case 'OpenSkillLearn':
        if (args[0]) {
          actor = $gameActors.actor(+args[0]);
          if (actor) $gameParty.setMenuActor(actor);
        }
        SceneManager.push(Scene_SkillLearn);
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

})();
