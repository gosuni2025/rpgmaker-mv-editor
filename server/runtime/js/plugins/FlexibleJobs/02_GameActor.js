
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
    var cd   = Note.cls(classId);
    var reqs = cd.unlockReqs;
    var iReqs = cd.itemReqs || [];
    if (!reqs.length && !iReqs.length) return true;  // 조건 없으면 기본 해금
    var classOk = reqs.every(function (r) { return this.fjClassLevel(r.cid) >= r.lv; }, this);
    var itemOk  = iReqs.every(function (ir) {
      var item = $dataItems && $dataItems[ir.id];
      return item && $gameParty.hasItem(item);
    });
    var ok = classOk && itemOk;
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
