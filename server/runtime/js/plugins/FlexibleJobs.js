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
 * @param menuSwitch
 * @text 메뉴 접근 스위치
 * @desc 이 스위치가 ON일 때만 메뉴에 전직/스킬습득 항목을 표시합니다. 0이면 항상 표시.
 * @type switch
 * @default 0
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
  var CMD_CLASS   = String(p['cmdClassChange'] || '전직');
  var CMD_LEARN   = String(p['cmdSkillLearn']  || '스킬 습득');
  var MENU_SWITCH = parseInt(p['menuSwitch'] || 0);

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
  // FJ 헬퍼 네임스페이스 — CustomSceneEngine dataScript/템플릿 바인딩용
  //===========================================================================
  window.FJ = {
    _actorIdx  : 0,
    _slot      : 0,      // 0=주직업, 1~N=서브슬롯
    _curClassId: 0,
    _curSkillId: 0,
    _classData : [],
    _skillData : [],

    actor: function () {
      return $gameParty.members()[FJ._actorIdx] || $gameParty.members()[0];
    },

    // ── dataScript 함수 ────────────────────────────────────────────────────

    actorItems: function () {
      return $gameParty.members().map(function (actor, i) {
        var cls = $dataClasses[actor._classId];
        return {
          name   : actor.name() + (cls ? '  [' + cls.name + ']' : ''),
          symbol : 'actor_' + i,
          enabled: true
        };
      });
    },

    slotItems: function () {
      var actor = FJ.actor();
      if (!actor) return [];
      var items = [];
      var pri = $dataClasses[actor._classId];
      items.push({
        name   : '주직업  ' + (pri ? pri.name + ' Lv.' + actor._level : '없음'),
        symbol : 'slot_0',
        enabled: true
      });
      var subs = actor.fjSubIds();
      for (var i = 0; i < subs.length; i++) {
        var subId = subs[i];
        var sub   = subId > 0 ? $dataClasses[subId] : null;
        var lv    = subId > 0 ? actor.fjClassLevel(subId) : 0;
        items.push({
          name   : '서브 ' + (i + 1) + '  ' + (sub ? sub.name + ' Lv.' + lv : '없음'),
          symbol : 'slot_' + (i + 1),
          enabled: true
        });
      }
      return items;
    },

    classItems: function () {
      var actor = FJ.actor();
      if (!actor) { FJ._classData = []; return []; }
      var forPrimary = (FJ._slot === 0);
      var ids        = actor.fjAvailableClasses(forPrimary);
      FJ._classData  = ids;
      var currentId  = forPrimary
        ? actor._classId
        : (actor.fjSubIds()[FJ._slot - 1] || 0);
      return ids.map(function (classId) {
        var cls = $dataClasses[classId];
        var slv = actor.fjClassLevel(classId);
        return {
          name   : (classId === currentId ? '★ ' : '') + cls.name + '  Lv.' + slv,
          symbol : 'cls_' + classId,
          enabled: true
        };
      });
    },

    skillItems: function () {
      var actor = FJ.actor();
      if (!actor) { FJ._skillData = []; return []; }
      var res = [], seen = {};
      actor.fjActiveClassIds().forEach(function (classId) {
        var cls = $dataClasses[classId];
        if (!cls || !cls.learnings) return;
        cls.learnings.forEach(function (l) {
          if (!seen[l.skillId] && Note.skill(l.skillId).learnJp !== null) {
            res.push(l.skillId);
            seen[l.skillId] = true;
          }
        });
      });
      FJ._skillData = res;
      var jp = actor.fjJp();
      return res.map(function (skillId) {
        var skill   = $dataSkills[skillId];
        var sd      = Note.skill(skillId);
        var learned = (actor._fjLearnedSk || []).indexOf(skillId) >= 0;
        var afford  = !learned && jp >= sd.learnJp;
        var costStr = learned ? '★ 습득 완료' : (sd.learnJp + ' ' + JP_NAME);
        return {
          name   : skill.name + '  ' + costStr,
          symbol : 'sk_' + skillId,
          enabled: afford
        };
      });
    },

    // ── 액터 정보 ─────────────────────────────────────────────────────────

    actorName: function () {
      var a = FJ.actor(); if (!a) return '';
      var c = $dataClasses[a._classId];
      return a.name() + (c ? '  [' + c.name + ']' : '');
    },

    actorJp: function () {
      var a = FJ.actor();
      return a ? (a.fjJp() + ' ' + JP_NAME) : '';
    },

    // ── 직업 상세 ─────────────────────────────────────────────────────────

    classDetailName: function () {
      if (!FJ._curClassId) return '직업을 선택하세요';
      var cls = $dataClasses[FJ._curClassId];
      return cls ? cls.name : '—';
    },

    classDetailLv: function () {
      if (!FJ._curClassId) return '';
      var a = FJ.actor(); if (!a) return '';
      return 'Lv. ' + a.fjClassLevel(FJ._curClassId);
    },

    classDetailJp: function () {
      if (!FJ._curClassId) return '';
      var a = FJ.actor(); if (!a) return '';
      return a.fjJp(FJ._curClassId) + ' ' + JP_NAME;
    },

    classDetailDesc: function () {
      if (!FJ._curClassId) return '';
      var cls = $dataClasses[FJ._curClassId];
      return cls ? (cls.description || '') : '';
    },

    classDetailExpBar: function () {
      if (!FJ._curClassId) return '';
      var a = FJ.actor(); if (!a) return '';
      var classId = FJ._curClassId;
      var lv  = a.fjClassLevel(classId);
      var exp = (a._exp && a._exp[classId]) || 0;
      var origId = a._classId;
      a._classId = classId;
      var curFloor  = a.expForLevel(lv);
      var nextFloor = a.expForLevel(lv + 1);
      a._classId = origId;
      if (nextFloor <= curFloor) return 'MAX';
      return (exp - curFloor) + ' / ' + (nextFloor - curFloor);
    },

    statCompare: function (paramId) {
      var a = FJ.actor(); if (!a || !FJ._curClassId) return '';
      var newCls = $dataClasses[FJ._curClassId];
      if (!newCls) return '';
      var newLv   = a.fjClassLevel(FJ._curClassId);
      var current = a.param(paramId);
      var diff;
      if (FJ._slot === 0) {
        var oldCls = $dataClasses[a._classId];
        var oldLv  = a._level;
        diff = newCls.params[paramId][newLv] - (oldCls ? oldCls.params[paramId][oldLv] : 0);
      } else {
        var curSubId   = a.fjSubIds()[FJ._slot - 1] || 0;
        var oldContrib = 0;
        if (curSubId > 0) {
          var oldSub = $dataClasses[curSubId];
          if (oldSub) oldContrib = Math.floor(oldSub.params[paramId][a.fjClassLevel(curSubId)] * SUB_RATE);
        }
        var newContrib = Math.floor(newCls.params[paramId][newLv] * SUB_RATE);
        diff = newContrib - oldContrib;
      }
      var after = current + diff;
      if (diff > 0) return current + ' → ' + after + '  (▲' + diff + ')';
      if (diff < 0) return current + ' → ' + after + '  (▼' + (-diff) + ')';
      return String(current);
    },

    // ── 스킬 상세 ─────────────────────────────────────────────────────────

    skillDetailName: function () {
      if (!FJ._curSkillId) return '스킬을 선택하세요';
      var sk = $dataSkills[FJ._curSkillId];
      return sk ? sk.name : '—';
    },

    skillDetailDesc: function () {
      if (!FJ._curSkillId) return '';
      var sk = $dataSkills[FJ._curSkillId];
      return sk ? (sk.description || '') : '';
    },

    skillDetailCost: function () {
      if (!FJ._curSkillId) return '';
      var sd = Note.skill(FJ._curSkillId);
      var a  = FJ.actor();
      if (!a || sd.learnJp === null) return '';
      var learned = (a._fjLearnedSk || []).indexOf(FJ._curSkillId) >= 0;
      if (learned) return '이미 습득한 스킬입니다.';
      var has = a.fjJp();
      var color = has >= sd.learnJp ? '' : '(부족)';
      return '필요 ' + JP_NAME + ': ' + sd.learnJp + '   보유: ' + has + ' ' + color;
    },

    // ── 전직 / 스킬 적용 ──────────────────────────────────────────────────

    applySlotChange: function () {
      var a = FJ.actor();
      if (!a || !FJ._curClassId) return false;
      if (FJ._slot === 0) {
        a.fjChangePrimary(FJ._curClassId);
      } else {
        a.fjSetSub(FJ._slot - 1, FJ._curClassId);
      }
      SoundManager.playEquip();
      return true;
    },

    applySkillLearn: function () {
      var a = FJ.actor();
      if (!a || !FJ._curSkillId) return false;
      if (!a.fjCanLearnByJp(FJ._curSkillId)) {
        SoundManager.playBuzzer();
        return false;
      }
      a.fjLearnByJp(FJ._curSkillId);
      SoundManager.playEquip();
      return true;
    }
  };

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

})();
