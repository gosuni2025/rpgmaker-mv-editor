//=============================================================================
// PuzzleIce.js — 얼음 미끄럼 퍼즐 미니게임
//=============================================================================
/*:
 * @plugindesc 얼음 미끄럼 퍼즐 (포켓몬 얼음 동굴 스타일)
 * @author Claude
 *
 * @help
 * 포켓몬 얼음 동굴 스타일의 얼음 미끄럼 퍼즐입니다.
 *
 * 【사용법】
 * - 맵의 리전 ID = 1 인 타일이 얼음 타일입니다.
 * - 플레이어가 얼음 위에서 방향키를 누르면 벽 또는 이동불가
 *   오브젝트에 닿을 때까지 미끄러집니다.
 * - 노트에 <ice_rock>을 가진 우선순위=1 이벤트가 바위 역할을 합니다.
 * - 노트에 <ice_goal>을 가진 이벤트 위치가 목표 지점입니다.
 *
 * 【플러그인 커맨드】
 *   PUZZLE_ICE_INIT switchId
 *     퍼즐 초기화. switchId: 완료 시 ON할 스위치 번호.
 *     현재 플레이어 위치를 시작 위치로 저장합니다.
 *
 *   PUZZLE_ICE_RESET
 *     플레이어를 시작 위치로 되돌립니다.
 */

(function () {
  'use strict';

  //===========================================================================
  // IcePuzzle 객체
  //===========================================================================
  var IcePuzzle = {
    _active: false,
    _switchId: 0,
    _startX: 0,
    _startY: 0,
    _sliding: false,
    _slideDir: 0,
    _completed: false,

    /**
     * 얼음 타일 여부: 리전 ID = 1
     */
    isIceTile: function (x, y) {
      return $gameMap.regionId(x, y) === 1;
    },

    /**
     * 목표 타일 여부: <ice_goal> note를 가진 이벤트가 (x,y)에 있으면 true
     */
    isGoalTile: function (x, y) {
      return $gameMap.events().some(function (ev) {
        return ev.x === x && ev.y === y && ev.event().note.indexOf('<ice_goal>') >= 0;
      });
    },

    /**
     * 이동 불가 바위 이벤트 여부: <ice_rock> note
     */
    isRockAt: function (x, y) {
      return $gameMap.events().some(function (ev) {
        return ev.x === x && ev.y === y &&
               ev.event().note.indexOf('<ice_rock>') >= 0 &&
               ev.priorityType() === 1;
      });
    },

    /**
     * 퍼즐 초기화
     */
    init: function (switchId) {
      this._active = true;
      this._switchId = switchId;
      this._startX = $gamePlayer.x;
      this._startY = $gamePlayer.y;
      this._sliding = false;
      this._slideDir = 0;
      this._completed = false;
    },

    /**
     * 퍼즐 비활성화
     */
    deactivate: function () {
      this._active = false;
      this._sliding = false;
      this._completed = false;
    },

    /**
     * 리셋: 플레이어를 시작 위치로 이동
     */
    reset: function () {
      if (!this._active) return;
      this._sliding = false;
      $gamePlayer.reserveTransfer(
        $gameMap.mapId(),
        this._startX,
        this._startY,
        2,  // direction down
        0   // fade black
      );
    },

    /**
     * 목표 도달 체크
     */
    checkGoal: function () {
      if (!this._active || this._completed) return;
      if (this.isGoalTile($gamePlayer.x, $gamePlayer.y)) {
        this._completed = true;
        this._sliding = false;
        if (this._switchId > 0) {
          $gameSwitches.setValue(this._switchId, true);
        }
        // 완료 메시지 표시
        $gameMessage.add('\\c[4]★ 목표 지점에 도달했습니다! ★\\c[0]');
        $gameMessage.add('얼음 미끄럼 퍼즐을 완료했습니다!');
      }
    }
  };

  // 전역으로 노출 (디버그 용도)
  window.IcePuzzle = IcePuzzle;

  //===========================================================================
  // 플러그인 커맨드
  //===========================================================================
  var _Game_Interpreter_pluginCommand =
    Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command === 'PUZZLE_ICE_INIT') {
      var switchId = parseInt(args[0]) || 0;
      IcePuzzle.init(switchId);
    } else if (command === 'PUZZLE_ICE_RESET') {
      IcePuzzle.reset();
    }
  };

  //===========================================================================
  // Game_Player.prototype.moveByInput — 입력 가로채기
  //===========================================================================
  var _Game_Player_moveByInput = Game_Player.prototype.moveByInput;
  Game_Player.prototype.moveByInput = function () {
    // 퍼즐 비활성 시 기존 동작
    if (!IcePuzzle._active) {
      _Game_Player_moveByInput.call(this);
      return;
    }
    // 슬라이딩 중 입력 무시
    if (IcePuzzle._sliding) return;
    // 이동 중 입력 무시
    if (this.isMoving()) return;
    // 메시지 표시 중 무시
    if ($gameMessage.isBusy()) return;

    var dir = Input.dir4;
    if (dir === 0) return;

    if (this.canPass(this._x, this._y, dir)) {
      this.moveStraight(dir);
    } else {
      this.setMovementSuccess(false);
    }
  };

  //===========================================================================
  // Game_Player.prototype.moveStraight — 이동 후 얼음 체크
  //===========================================================================
  var _Game_Player_moveStraight = Game_Player.prototype.moveStraight;
  Game_Player.prototype.moveStraight = function (d) {
    var wasSliding = IcePuzzle._sliding;
    _Game_Player_moveStraight.call(this, d);
    if (IcePuzzle._active && this.isMovementSucceeded() && !wasSliding) {
      // 새 위치가 얼음이면 슬라이드 시작
      if (IcePuzzle.isIceTile(this._x, this._y)) {
        IcePuzzle._sliding = true;
        IcePuzzle._slideDir = d;
      }
    }
  };

  //===========================================================================
  // Game_Player.prototype.update — 슬라이드 지속 처리
  //===========================================================================
  var _Game_Player_update = Game_Player.prototype.update;
  Game_Player.prototype.update = function (sceneActive) {
    _Game_Player_update.call(this, sceneActive);
    if (!IcePuzzle._active || !IcePuzzle._sliding) return;
    if (this.isMoving()) return;
    if ($gameMessage.isBusy()) return;

    var dir = IcePuzzle._slideDir;
    if (this.canPass(this._x, this._y, dir)) {
      _Game_Player_moveStraight.call(this, dir);
      if (!this.isMovementSucceeded()) {
        // moveStraight 내부에서 이동 실패 (edge case)
        IcePuzzle._sliding = false;
        IcePuzzle.checkGoal();
        return;
      }
      // 이동 후 얼음이 아니면 슬라이드 종료
      if (!IcePuzzle.isIceTile(this._x, this._y)) {
        IcePuzzle._sliding = false;
        IcePuzzle.checkGoal();
      }
    } else {
      // 이동 불가 → 슬라이드 종료
      IcePuzzle._sliding = false;
      IcePuzzle.checkGoal();
    }
  };

  //===========================================================================
  // 맵 이탈 시 비활성화
  //===========================================================================
  var _Scene_Map_terminate = Scene_Map.prototype.terminate;
  Scene_Map.prototype.terminate = function () {
    _Scene_Map_terminate.call(this);
    IcePuzzle.deactivate();
  };

  //===========================================================================
  // 세이브/로드 대응: IcePuzzle 상태 직렬화
  //===========================================================================
  var _DataManager_makeSaveContents = DataManager.makeSaveContents;
  DataManager.makeSaveContents = function () {
    var contents = _DataManager_makeSaveContents.call(this);
    contents.icePuzzle = {
      active: IcePuzzle._active,
      switchId: IcePuzzle._switchId,
      startX: IcePuzzle._startX,
      startY: IcePuzzle._startY,
      completed: IcePuzzle._completed
    };
    return contents;
  };

  var _DataManager_extractSaveContents = DataManager.extractSaveContents;
  DataManager.extractSaveContents = function (contents) {
    _DataManager_extractSaveContents.call(this, contents);
    if (contents.icePuzzle) {
      var s = contents.icePuzzle;
      IcePuzzle._active = s.active || false;
      IcePuzzle._switchId = s.switchId || 0;
      IcePuzzle._startX = s.startX || 0;
      IcePuzzle._startY = s.startY || 0;
      IcePuzzle._sliding = false;  // 로드 후 슬라이드는 항상 리셋
      IcePuzzle._completed = s.completed || false;
    }
  };

})();
