
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
      // 아이템 소지 해금 조건 <Requires Item: X>
      d.itemReqs = [];
      var itemMatches = note.match(/<Requires Item:\s*(\d+)>/ig) || [];
      itemMatches.forEach(function (m) {
        var im = m.match(/(\d+)/);
        if (im) d.itemReqs.push({ id: +im[1] });
      });
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
