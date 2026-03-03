//=============================================================================
// TurnOrderDisplay.js
// 전투 씬 턴 순서 아이콘 바 표시 플러그인
//=============================================================================

/*:
 * @plugindesc 전투 화면 상단에 턴 순서 아이콘 바를 표시합니다.
 * @author Claude
 *
 * @param iconSize
 * @text 아이콘 크기 (px)
 * @type number
 * @min 20
 * @max 100
 * @default 52
 *
 * @param barY
 * @text 바 Y 위치 (px, 상단 기준)
 * @type number
 * @min 0
 * @max 200
 * @default 8
 *
 * @param nextScale
 * @text 다음 턴 아이콘 크기 비율
 * @type number
 * @decimals 2
 * @min 0.3
 * @max 1.0
 * @default 0.75
 *
 * @param === 레이아웃 ===
 * @default
 *
 * @param direction
 * @text 배치 방향
 * @type select
 * @option 가로
 * @value horizontal
 * @option 세로
 * @value vertical
 * @default horizontal
 *
 * @param position
 * @text 표시 위치
 * @type select
 * @option 상단 중앙
 * @value top-center
 * @option 상단 좌
 * @value top-left
 * @option 상단 우
 * @value top-right
 * @option 하단 중앙
 * @value bottom-center
 * @option 하단 좌
 * @value bottom-left
 * @option 하단 우
 * @value bottom-right
 * @option 좌측 중앙
 * @value left-center
 * @option 우측 중앙
 * @value right-center
 * @default top-center
 *
 * @param gap
 * @text 아이콘 간격 (px)
 * @type number
 * @min 0
 * @max 40
 * @default 4
 *
 * @param margin
 * @text 화면 여백 (px)
 * @type number
 * @min 0
 * @max 100
 * @default 8
 *
 * @param === 아이콘 ===
 * @default
 *
 * @param clipShape
 * @text 클리핑 도형
 * @type select
 * @option 원형
 * @value circle
 * @option 정사각형
 * @value square
 * @option 둥근 사각형
 * @value roundRect
 * @option 마름모
 * @value diamond
 * @default circle
 *
 * @param faceZoom
 * @text 얼굴 이미지 확대율
 * @desc 1.0=꽉 맞춤, 1.3=30% 확대 후 클리핑
 * @type number
 * @decimals 2
 * @min 0.8
 * @max 2.0
 * @default 1.2
 *
 * @param === 구분선 ===
 * @default
 *
 * @param dividerWidth
 * @text 구분선 두께 (px)
 * @desc 0이면 숨김
 * @type number
 * @min 0
 * @max 10
 * @default 2
 *
 * @param dividerColor
 * @text 구분선 색
 * @default rgba(200,200,200,0.6)
 *
 * @param dividerGap
 * @text 구분선 여백 (px)
 * @type number
 * @min 0
 * @max 30
 * @default 8
 *
 * @param === 인디케이터 ===
 * @default
 *
 * @param indicatorStyle
 * @text 인디케이터 모양
 * @type select
 * @option 없음
 * @value none
 * @option 삼각형
 * @value triangle
 * @option 점
 * @value dot
 * @option 바
 * @value bar
 * @default triangle
 *
 * @param indicatorColor
 * @text 인디케이터 색
 * @default #ffdd44
 *
 * @param === 행동 연결선 ===
 * @default
 *
 * @param showCurves
 * @text 행동 연결선 표시
 * @type boolean
 * @default true
 *
 * @param curveAttack
 * @text 물리공격 선 색
 * @default rgba(255,70,40,0.9)
 *
 * @param curveMagic
 * @text 마법 선 색
 * @default rgba(140,80,255,0.9)
 *
 * @param curveHeal
 * @text 회복/아군 선 색
 * @default rgba(60,210,120,0.9)
 *
 * @param curveItem
 * @text 아이템 선 색
 * @default rgba(255,200,50,0.9)
 *
 * @param curveOther
 * @text 기타 선 색
 * @default rgba(180,180,220,0.85)
 *
 * @param curveWidth
 * @text 선 두께 (px)
 * @type number
 * @min 1
 * @max 8
 * @default 2
 *
 * @param === 촉수 애니메이션 ===
 * @default
 *
 * @param showTentacle
 * @text 촉수 애니메이션
 * @type boolean
 * @default true
 *
 * @param tentacleCount
 * @text 촉수 수
 * @type number
 * @min 4
 * @max 24
 * @default 12
 *
 * @param tentacleLen
 * @text 촉수 최대 길이 (아이콘 크기 대비)
 * @type number
 * @decimals 2
 * @min 0.2
 * @max 1.5
 * @default 0.65
 *
 * @param tentacleColor
 * @text 촉수 색
 * @default #ffdd44
 *
 * @help
 * ============================================================
 * TurnOrderDisplay — 전투 턴 순서 표시 플러그인
 * ============================================================
 *
 * [아이콘 의미]
 *   완료(반투명) → 행동중(강조) → 대기 ▶ 다음 턴 예측(작게)
 *   예: A B C D E | a b c d e
 *
 * [플러그인 커맨드]
 *   TurnOrderDisplay show / hide
 *   TurnOrderDisplay direction horizontal / vertical
 *   TurnOrderDisplay position top-center
 *   TurnOrderDisplay iconSize 48
 *   TurnOrderDisplay indicator triangle / dot / bar / none
 *   TurnOrderDisplay clip circle / square / roundRect / diamond
 *   TurnOrderDisplay curves on / off
 *   TurnOrderDisplay tentacle on / off
 */

(function () {
    'use strict';
    console.log('[TOD] v7 loaded');

    //=========================================================================
    // 이번 턴에 행동 완료한 배틀러 직접 추적
    // BattleManager 추론(_actionBattlers) 대신 hook으로 정확히 기록
    //=========================================================================
    var _doneThisTurn = [];
    var _turnTransitionPending = false;
    var _inputPreviewOrder = null;
    var _enemyTargetPreview = null; // { enemyIndex: [target battlers] }

    // 랜덤 없이 결정적 속도 계산 (agi + 스킬속도 + 공격속도)
    function _calcSpeedDeterministic(battler) {
        var action = battler.currentAction();
        if (!action || !action.item()) return battler.agi;
        var speed = battler.agi;
        if (action.item()) speed += action.item().speed;
        if (action.isAttack && action.isAttack()) speed += battler.attackSpeed();
        return speed;
    }

    // 커맨드 입력 중 속도 미리보기 계산 (랜덤 없음 → 안정적 순서)
    function _recalcInputPreview() {
        var battlers = [];
        if (!BattleManager._surprise) battlers = battlers.concat($gameParty.members());
        if (!BattleManager._preemptive) battlers = battlers.concat($gameTroop.members());
        battlers.forEach(function (b, i) {
            b._speed = _calcSpeedDeterministic(b);
            b._sortIndex = i; // 안정 정렬용 원래 인덱스
        });
        battlers.sort(function (a, b) {
            return b._speed - a._speed || a._sortIndex - b._sortIndex;
        });
        _inputPreviewOrder = battlers.filter(function (b) {
            return b.isBattleMember() && b.isAlive();
        });
    }

    // startInput: 턴 종료 후 커맨드 입력 진입 시 턴 전환 애니메이션 트리거
    var _BM_startInput = BattleManager.startInput;
    BattleManager.startInput = function () {
        if (_doneThisTurn.length > 0) {
            _turnTransitionPending = true;
        }
        _doneThisTurn = [];
        _BM_startInput.call(this);
        // makeActions() 이후 초기 속도 미리보기 + 적 타겟 미리보기
        if (this._phase === 'input') {
            _recalcInputPreview();
            _calcEnemyTargets();
        }
    };

    function _calcEnemyTargets() {
        _enemyTargetPreview = {};
        $gameTroop.aliveMembers().forEach(function (enemy) {
            var action = enemy.currentAction();
            if (!action || !action.item()) return;
            var targets = action.makeTargets();
            // 중복 제거
            var unique = [];
            targets.forEach(function (t) {
                if (unique.indexOf(t) < 0) unique.push(t);
            });
            _enemyTargetPreview[enemy.index()] = {
                targets: unique,
                action: action
            };
        });
    }

    // selectNextCommand: 각 액터 커맨드 확정 시 속도 재계산
    var _BM_selectNextCommand = BattleManager.selectNextCommand;
    BattleManager.selectNextCommand = function () {
        _BM_selectNextCommand.call(this);
        if (this._phase === 'input') {
            _recalcInputPreview();
        }
    };

    // selectPreviousCommand: 커맨드 취소 시 속도 재계산
    var _BM_selectPreviousCommand = BattleManager.selectPreviousCommand;
    BattleManager.selectPreviousCommand = function () {
        _BM_selectPreviousCommand.call(this);
        if (this._phase === 'input') {
            _recalcInputPreview();
        }
    };

    var _BM_startTurn = BattleManager.startTurn;
    BattleManager.startTurn = function () {
        // input 미리보기 순서 + 속도 저장
        var savedOrder = _inputPreviewOrder ? _inputPreviewOrder.slice() : null;
        _inputPreviewOrder = null;
        _BM_startTurn.call(this); // makeActionOrders → makeSpeed 재랜덤
        // 미리보기 순서 그대로 적용 → 표시된 순서 = 실제 순서
        if (savedOrder) {
            var actionSet = this._actionBattlers;
            this._actionBattlers = savedOrder.filter(function (b) {
                return actionSet.indexOf(b) >= 0;
            });
            // 속도도 복원 (다른 코드가 speed() 참조할 수 있으므로)
            savedOrder.forEach(function (b) {
                b._speed = _calcSpeedDeterministic(b);
            });
        }
    };

    var _BM_endAction = BattleManager.endAction;
    BattleManager.endAction = function () {
        var subj = this._subject;
        if (subj && _doneThisTurn.indexOf(subj) < 0) {
            _doneThisTurn.push(subj);
        }
        _BM_endAction.call(this);
    };

    //=========================================================================
    // 설정
    //=========================================================================
    var _p = PluginManager.parameters('TurnOrderDisplay');

    var Config = {
        direction:      String(_p['direction']      || 'horizontal'),
        position:       String(_p['position']       || 'top-center'),
        iconSize:       parseInt(_p['iconSize']      || 52),
        barY:           parseInt(_p['barY']          || 8),
        gap:            parseInt(_p['gap']           || 4),
        margin:         parseInt(_p['margin']        || 8),
        nextScale:      parseFloat(_p['nextScale']   || 0.75),
        clipShape:      String(_p['clipShape']      || 'circle'),
        faceZoom:       parseFloat(_p['faceZoom']    || 1.2),
        dividerWidth:   parseInt(_p['dividerWidth']  || 2),
        dividerColor:   String(_p['dividerColor']   || 'rgba(200,200,200,0.6)'),
        dividerGap:     parseInt(_p['dividerGap']    || 8),
        indicatorStyle: String(_p['indicatorStyle'] || 'triangle'),
        indicatorColor: String(_p['indicatorColor'] || '#ffdd44'),
        showCurves:     String(_p['showCurves']     || 'true') !== 'false',
        curveAttack:    String(_p['curveAttack']    || 'rgba(255,70,40,0.9)'),
        curveMagic:     String(_p['curveMagic']     || 'rgba(140,80,255,0.9)'),
        curveHeal:      String(_p['curveHeal']      || 'rgba(60,210,120,0.9)'),
        curveItem:      String(_p['curveItem']      || 'rgba(255,200,50,0.9)'),
        curveOther:     String(_p['curveOther']     || 'rgba(180,180,220,0.85)'),
        curveWidth:     parseInt(_p['curveWidth']    || 2),
        showTentacle:   String(_p['showTentacle']   || 'true') !== 'false',
        tentacleCount:  parseInt(_p['tentacleCount'] || 12),
        tentacleLen:    parseFloat(_p['tentacleLen'] || 0.65),
        tentacleColor:  String(_p['tentacleColor']  || '#ffdd44'),
        visible:        true
    };

    window.TurnOrderDisplay = { Config: Config };

