  function loadJSON(url, fallback) {
    if (fallback === undefined) fallback = {};
    try {
      var xhr = new XMLHttpRequest(); xhr.open('GET', url + '?_=' + Date.now(), false);
      xhr.send(); if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
    } catch (e) {}
    return fallback;
  }
  function loadJSONSafe(url) { return loadJSON(url, null); }
  function loadScenesData() {
    var index = loadJSONSafe('data/UIScenes/_index.json'); if (!index || !Array.isArray(index)) return { scenes: {} }; var scenes = {};
    for (var i = 0; i < index.length; i++) {
      var scene = loadJSONSafe('data/UIScenes/' + index[i] + '.json'); if (scene && scene.id) scenes[scene.id] = scene;
    }
    return { scenes: scenes };
  }
  _scenesData = loadScenesData(); _configData = loadJSON('data/UIEditorConfig.json');
