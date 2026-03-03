
  // ============================================================
  // Game_System — 세이브 데이터
  // ============================================================

  const _Game_System_initialize = Game_System.prototype.initialize;
  Game_System.prototype.initialize = function () {
    _Game_System_initialize.call(this);
    this._minimapFow        = {};
    this._minimapVisible    = CFG.showOnStart;
    this._minimapMarkers    = []; // [{id, x, y, color, shape}]
    this._minimapCustomName = null; // 커스텀 맵 이름 (null이면 실제 맵 이름 사용)
  };

  // ============================================================
  // Game_Player — 이동 시 탐험 처리
  // ============================================================

  const _Game_Player_increaseSteps = Game_Player.prototype.increaseSteps;
  Game_Player.prototype.increaseSteps = function () {
    _Game_Player_increaseSteps.call(this);
    MinimapManager.explore(this.x, this.y);
  };

  const _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
  Game_Player.prototype.performTransfer = function () {
    _Game_Player_performTransfer.call(this);
    MinimapManager._pendingExplore = true;
    MinimapManager._lastEventPos   = {};
    if (CFG.resetNameOnTransfer && $gameSystem) {
      $gameSystem._minimapCustomName = null;
    }
    MinimapManager._lastMapId = -1; // 맵 이름 강제 갱신
  };

  // ============================================================
  // Game_Interpreter — 플러그인 커맨드
  // ============================================================

  const _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command !== 'Minimap') return;
    const sub = (args[0] || '').toLowerCase();
    switch (sub) {
      case 'show':    MinimapManager.setVisible(true);  break;
      case 'hide':    MinimapManager.setVisible(false); break;
      case 'toggle':  MinimapManager.toggleVisible();   break;
      case 'clearfow':      MinimapManager.clearFow();                                    break;
      case 'revealall':     MinimapManager.revealAll();                                   break;
      case 'shape':         MinimapManager.setShape(args[1]);                             break;
      case 'rotation':      MinimapManager.setRotation(args[1]);                          break;
      case 'tilesize':      MinimapManager.setTileSize(args[1]);                          break;
      case 'addmarker':     MinimapManager.addMarker(args[1], args[2], args[3], args[4], args[5]); break;
      case 'removemarker':  MinimapManager.removeMarker(args[1]);                         break;
      case 'clearmarkers':  MinimapManager.clearMarkers();                                break;
      case 'setmapname':    MinimapManager.setMapName(args.slice(1).join(' '));            break;
      case 'resetmapname':  MinimapManager.resetMapName();                                break;
    }
  };

  // ============================================================
  // Scene_Map
  // ============================================================

  const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
  Scene_Map.prototype.createAllWindows = function () {
    _Scene_Map_createAllWindows.call(this);
    var savedVisible = ($gameSystem ? $gameSystem._minimapVisible : CFG.showOnStart);
    MinimapManager.createSprite(this);
    MinimapManager.setVisible(savedVisible);
  };

  const _Scene_Map_update = Scene_Map.prototype.update;
  Scene_Map.prototype.update = function () {
    _Scene_Map_update.call(this);
    MinimapManager.update();
  };

  const _Scene_Map_terminate = Scene_Map.prototype.terminate;
  Scene_Map.prototype.terminate = function () {
    _Scene_Map_terminate.call(this);
    MinimapManager.destroySprite();
  };
