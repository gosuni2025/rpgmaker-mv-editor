
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
      var currentId  = forPrimary
        ? actor._classId
        : (actor.fjSubIds()[FJ._slot - 1] || 0);
      var result = [];
      FJ._classData = [];
      for (var id = 1; id < $dataClasses.length; id++) {
        var cls = $dataClasses[id];
        if (!cls || !cls.name) continue;
        var cd = Note.cls(id);
        if (forPrimary && cd.subOnly) continue;
        if (!forPrimary && cd.primaryOnly) continue;
        var unlocked  = actor.fjIsUnlocked(id);
        var isCurrent = (id === currentId);
        var slv       = actor.fjClassLevel(id);
        var subText   = unlocked
          ? ('\x1bC[6]Lv.' + slv + (isCurrent ? '  \x1bC[14]장착 중\x1bC[0]' : '') + '\x1bC[0]')
          : FJ._lockReason(id, actor);
        result.push({
          name     : (isCurrent ? '★ ' : '') + cls.name,
          symbol   : 'cls_' + id,
          enabled  : unlocked && !isCurrent,
          iconIndex: cls.iconIndex || 0,
          subText  : subText
        });
        FJ._classData.push(id);
      }
      return result;
    },

    _lockReason: function (classId, actor) {
      var cd = Note.cls(classId);
      var parts = [];
      cd.unlockReqs.forEach(function (r) {
        var cls = $dataClasses[r.cid];
        var have = actor.fjClassLevel(r.cid);
        var nm   = cls ? cls.name : ('직업' + r.cid);
        var ok   = have >= r.lv;
        parts.push(nm + ' Lv.' + r.lv + (ok ? '\x1bC[14]✓\x1bC[0]' : '(\x1bC[2]' + have + '/' + r.lv + '\x1bC[0])'));
      });
      (cd.itemReqs || []).forEach(function (ir) {
        var item = $dataItems && $dataItems[ir.id];
        var nm   = item ? item.name : ('아이템' + ir.id);
        var has  = item && $gameParty.hasItem(item);
        parts.push(nm + (has ? '\x1bC[14]✓\x1bC[0]' : '\x1bC[2](미보유)\x1bC[0]'));
      });
      return '\x1bC[8]' + (parts.length ? parts.join(' / ') : '해금 불가') + '\x1bC[0]';
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
