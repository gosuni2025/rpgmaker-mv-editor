  function resolveTemplate(text) {
    if (!text || typeof text !== 'string') return text || ''; var result = ''; var i = 0;
    while (i < text.length) {
      if (text[i] !== '{') { result += text[i++]; continue; }
      var depth = 1, j = i + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++;
      }
      if (depth !== 0) { result += text[i++]; continue; }
      var expr = text.slice(i + 1, j - 1); result += _evalTemplateExpr(expr); i = j;
    }
    return result;
  }
  function _evalTemplateExpr(expr) {
    var actorMatch = expr.match(/^actor\[([^\]]+)\]\.(\w+)$/);
    if (actorMatch && typeof $gameParty !== 'undefined') {
      try {
        var members = $gameParty.members(); var idxExpr = actorMatch[1];
        var idx = /^\d+$/.test(idxExpr) ? parseInt(idxExpr) : (function() {
          try { var c = (SceneManager._scene && SceneManager._scene._ctx) || {};
                return Number(new Function('$ctx', 'return (' + idxExpr + ')')(c)) || 0;
          } catch(e) { return 0; }
        })(); var field = actorMatch[2]; var actor = members[idx]; if (!actor) return '';
        switch (field) {
          case 'name':  return actor.name(); case 'class': return actor.currentClass() ? actor.currentClass().name : '';
          case 'level': return String(actor.level); case 'hp':    return String(actor.hp); case 'mhp':   return String(actor.mhp); case 'mp':    return String(actor.mp);
          case 'mmp':   return String(actor.mmp); case 'tp':    return String(actor.tp); default:      return String(actor[field] !== undefined ? actor[field] : '');
        }
      } catch(e) { return ''; }
    }
    var varMatch = expr.match(/^var:(\d+)$/); if (varMatch && typeof $gameVariables !== 'undefined') return String($gameVariables.value(parseInt(varMatch[1])));
    var swMatch = expr.match(/^switch:(\d+)$/); if (swMatch && typeof $gameSwitches !== 'undefined') return $gameSwitches.value(parseInt(swMatch[1])) ? 'ON' : 'OFF';
    if (expr === 'gold' && typeof $gameParty !== 'undefined') return String($gameParty.gold());
    if (expr === 'mapName') {
      if (typeof MinimapManager !== 'undefined' && typeof MinimapManager.getMapName === 'function') return MinimapManager.getMapName();
      if (typeof $dataMapInfos !== 'undefined' && typeof $gameMap !== 'undefined') {
        var info = $dataMapInfos[$gameMap.mapId()]; return info ? (info.name || '') : '';
      }
      return '';
    }
    var cfgMatch = expr.match(/^config\.(\w+)$/);
    if (cfgMatch && typeof ConfigManager !== 'undefined') {
      var v = ConfigManager[cfgMatch[1]]; return typeof v === 'boolean' ? (v ? 'ON' : 'OFF') : String(v !== undefined ? v : '');
    }
    try {
      var $ctx = (SceneManager._scene && SceneManager._scene._ctx) || {}; var val = new Function('$ctx', 'return (' + expr + ')')($ctx); return val == null ? '' : String(val);
    } catch (e) {}
    return '';
  }
  Object.defineProperty(window, '$ctx', {
    get: function() { return (SceneManager._scene && SceneManager._scene._ctx) || {}; },
    configurable: true,
  });
