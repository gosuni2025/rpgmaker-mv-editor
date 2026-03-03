/*:
 * @plugindesc [v1.1] 비주얼 노벨 모드 - 화면 상단부터 텍스트를 타이프라이터로 누적 출력
 * @author RPG Maker MV Web Editor
 *
 * @param overlayOpacity
 * @text 배경 어둡기
 * @type number
 * @min 0
 * @max 200
 * @default 120
 *
 * @param transitionFrames
 * @text 트랜지션 프레임 수
 * @type number
 * @min 4
 * @max 120
 * @default 24
 *
 * @param textAreaX
 * @text 텍스트 영역 X
 * @type number
 * @min 0
 * @max 200
 * @default 60
 *
 * @param textAreaY
 * @text 텍스트 영역 Y
 * @type number
 * @min 0
 * @max 400
 * @default 40
 *
 * @param textAreaWidth
 * @text 텍스트 영역 폭
 * @type number
 * @min 200
 * @max 816
 * @default 700
 *
 * @param textAreaHeight
 * @text 텍스트 영역 높이
 * @type number
 * @min 100
 * @max 600
 * @default 520
 *
 * @param choiceStyle
 * @text 선택지 스타일
 * @type select
 * @option RPG Maker 기본 선택지
 * @value default
 * @option 비주얼 노벨 인라인 선택지
 * @value inline
 * @default inline
 *
 * @param speakerColor
 * @text 화자명 색상
 * @type color
 * @default #ffe066
 *
 * @param choiceIndicator
 * @text 선택지 커서 기호
 * @type string
 * @default >
 *
 * @param autoExitDelay
 * @text 자동 탈출 딜레이 (프레임)
 * @type number
 * @min 0
 * @max 300
 * @default 30
 *
 * @param showScrollBar
 * @text 스크롤바 표시
 * @type boolean
 * @on 표시
 * @off 숨김
 * @default false
 *
 * @command enter
 * @text VN 모드 시작
 * @desc 비주얼 노벨 모드를 활성화합니다.
 *
 * @command exit
 * @text VN 모드 종료
 * @desc 비주얼 노벨 모드를 비활성화합니다.
 *
 * @command choiceStyle
 * @text 선택지 스타일 변경
 * @desc 선택지 스타일을 변경합니다.
 *
 * @arg style
 * @text 스타일
 * @type select
 * @option RPG Maker 기본 선택지
 * @value default
 * @option 비주얼 노벨 인라인 선택지
 * @value inline
 * @default inline
 *
 * @help
 * ============================================================================
 * 비주얼 노벨 모드 플러그인 v1.1
 * ============================================================================
 * [플러그인 커맨드]
 *   VisualNovel enter
 *   VisualNovel exit
 *   VisualNovel choiceStyle default
 *   VisualNovel choiceStyle inline
 *
 * [조작]
 * - 타이핑 중 클릭/OK → 현재 메시지 즉시 완성
 * - 타이핑 완료 후 클릭/OK → 다음 메시지로 진행
 * - 선택지: ↑↓키 또는 클릭으로 선택, OK/클릭으로 결정
 * ============================================================================
 */

(function () {
    'use strict';

    var params = PluginManager.parameters('VisualNovelMode');
    var OVERLAY_OPACITY  = parseInt(params['overlayOpacity'])   || 180;
    var TRANS_FRAMES     = Math.max(1, parseInt(params['transitionFrames']) || 24);
    var TEXT_AREA_X      = parseInt(params['textAreaX'])        || 60;
    var TEXT_AREA_Y      = parseInt(params['textAreaY'])        || 40;
    var TEXT_AREA_W      = parseInt(params['textAreaWidth'])    || 700;
    var TEXT_AREA_H      = parseInt(params['textAreaHeight'])   || 520;
    var CHOICE_STYLE     = String(params['choiceStyle'] || 'inline');
    var SPEAKER_COLOR    = String(params['speakerColor'] || '#ffe066');
    var CHOICE_IND       = String(params['choiceIndicator'] || '>');
    var AUTO_EXIT_DELAY  = parseInt(params['autoExitDelay']);
    if (isNaN(AUTO_EXIT_DELAY)) AUTO_EXIT_DELAY = 30;
    var SHOW_SCROLL_BAR  = String(params['showScrollBar']) !== 'false';

    var ENTRY_GAP = 6;
    var ENTRY_PAD = 4;

    // =========================================================================
    // VNManager
    // =========================================================================
    var VNManager = {
        _active:      false,
        _choiceStyle: CHOICE_STYLE,
        isActive:       function () { return this._active; },
        enter:          function () { this._active = true; },
        exit:           function () { this._active = false; },
        getChoiceStyle: function () { return this._choiceStyle; },
        setChoiceStyle: function (s) { if (s === 'default' || s === 'inline') this._choiceStyle = s; }
    };

    // =========================================================================
    // 플러그인 커맨드
    // =========================================================================
    var _pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _pluginCommand.call(this, command, args);
        var cmd = command.toLowerCase();
        if (cmd !== 'visualnovel' && cmd !== 'visualnovelmode') return;
        var sub = (args[0] || '').toLowerCase();
        if (sub === 'enter') {
            VNManager.enter();
            var s = SceneManager._scene;
            if (s && s._vnCtrl) s._vnCtrl.open();
        } else if (sub === 'exit') {
            VNManager.exit();
            var s = SceneManager._scene;
            if (s && s._vnCtrl) s._vnCtrl.close();
        } else if (sub === 'choicestyle') {
            VNManager.setChoiceStyle((args[1] || 'inline').toLowerCase());
        }
    };

