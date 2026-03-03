
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

  // detail 패널용 표현식 헬퍼 — label/textArea/list의 text/dataScript에서 호출
  QS._getSelectedQuest = function() {
    var questId = window._qs_currentQuestId || null;
    return questId ? getQuestData(questId) : null;
  };
  QS._getSelectedQuestTitle = function() {
    var q = QS._getSelectedQuest();
    return q ? (q.title || q.id) : '';
  };
  QS._getSelectedQuestMeta = function() {
    var q = QS._getSelectedQuest();
    if (!q) return '';
    var meta = [];
    if (q.difficulty) meta.push('난이도: ' + q.difficulty);
    if (q.requester)  meta.push('의뢰: '   + q.requester);
    if (q.location)   meta.push('장소: '   + q.location);
    return meta.join('   ');
  };
  QS._getSelectedQuestDesc = function() {
    var q = QS._getSelectedQuest();
    return q ? (q.description || '') : '';
  };
  QS._buildObjectiveItems = function() {
    var questId = window._qs_currentQuestId || null;
    if (!questId) return [];
    var q = getQuestData(questId);
    var entry = $gameSystem.getQuestEntry(questId);
    if (!q || !entry) return [];
    var items = [];
    q.objectives.forEach(function(obj) {
      var oe = entry.objectives[obj.id];
      if (!oe || oe.status === 'hidden') return;
      var icon  = { completed: '✓', failed: '✗', active: '○' }[oe.status] || '○';
      var color = { completed: '#8f8', failed: '#f88', active: '#ddd' }[oe.status] || '#ddd';
      var optStr = obj.optional ? ' (선택)' : '';
      var progStr = '';
      if (obj.type === 'kill' || obj.type === 'collect' || obj.type === 'gold') {
        var target = obj.config.count || obj.config.amount || 1;
        progStr = ' [' + (oe.progress || 0) + '/' + target + ']';
      }
      items.push({ name: icon + ' ' + obj.text + optStr + progStr,
        symbol: obj.id, enabled: false, textColor: color });
    });
    return items;
  };
  QS._buildRewardItems = function() {
    var questId = window._qs_currentQuestId || null;
    if (!questId) return [];
    var q = getQuestData(questId);
    var entry = $gameSystem.getQuestEntry(questId);
    if (!q || !entry || entry.status === 'completed') return [];
    if (!q.rewards || q.rewards.length === 0) return [];
    return q.rewards.map(function(r) {
      var text = '';
      switch (r.type) {
        case 'gold':   text = (r.amount || 0) + 'G'; break;
        case 'exp':    text = (r.amount || 0) + ' EXP'; break;
        case 'item':   text = '아이템 ID:' + r.itemId + ' x' + (r.count || 1); break;
        case 'weapon': text = '무기 ID:'   + r.itemId + ' x' + (r.count || 1); break;
        case 'armor':  text = '방어구 ID:' + r.itemId + ' x' + (r.count || 1); break;
      }
      return { name: '• ' + text, symbol: r.type, enabled: false };
    });
  };
  QS._getSelectedQuestRewardsLabel = function() {
    var questId = window._qs_currentQuestId || null;
    if (!questId) return '';
    var q = getQuestData(questId);
    var entry = $gameSystem.getQuestEntry(questId);
    if (!q || !entry || entry.status === 'completed') return '';
    return (q.rewards && q.rewards.length > 0) ? '[ 보상 ]' : '';
  };
  QS._getSelectedQuestStatusOk = function() {
    var entry = $gameSystem.getQuestEntry(window._qs_currentQuestId);
    return (entry && entry.status === 'completed') ? '★ 완료됨' : '';
  };
  QS._getSelectedQuestStatusFail = function() {
    var entry = $gameSystem.getQuestEntry(window._qs_currentQuestId);
    return (entry && entry.status === 'failed') ? '✗ 실패' : '';
  };
