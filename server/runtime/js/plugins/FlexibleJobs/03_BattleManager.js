
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
