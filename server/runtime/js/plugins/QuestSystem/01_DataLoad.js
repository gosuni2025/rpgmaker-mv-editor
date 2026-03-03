
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
