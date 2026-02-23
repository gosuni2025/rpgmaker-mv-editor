/*:
 * @plugindesc [v1.0] 대사창 커스터마이징 - 크기, 위치, 폰트, 투명도 설정
 * @author RPG Maker MV Web Editor
 *
 * @param windowWidth
 * @text 창 너비
 * @type number
 * @min 0
 * @max 816
 * @default 0
 * @desc 0 이면 화면 너비(816)와 동일
 *
 * @param windowRows
 * @text 표시 행수
 * @type number
 * @min 1
 * @max 8
 * @default 4
 * @desc 대사창에 표시되는 텍스트 줄 수
 *
 * @param fontSize
 * @text 폰트 크기
 * @type number
 * @min 8
 * @max 72
 * @default 28
 *
 * @param padding
 * @text 내부 여백
 * @type number
 * @min 0
 * @max 40
 * @default 18
 * @desc 창 테두리와 텍스트 사이 여백
 *
 * @param opacity
 * @text 창 프레임 투명도
 * @type number
 * @min 0
 * @max 255
 * @default 255
 *
 * @param backOpacity
 * @text 배경 투명도
 * @type number
 * @min 0
 * @max 255
 * @default 192
 *
 * @param windowX
 * @text 창 X 위치
 * @type string
 * @default auto
 * @desc "auto" 이면 창 너비 기준 중앙 정렬. 숫자 입력 시 해당 좌표.
 *
 * @param windowY
 * @text 창 Y 위치
 * @type string
 * @default auto
 * @desc "auto" 이면 메시지의 positionType(상/중/하) 기반. 숫자 입력 시 직접 지정.
 *
 * @command width
 * @text 창 너비 변경
 * @desc 0 이면 화면 너비와 동일
 * @arg value
 * @type number
 * @min 0
 * @default 0
 *
 * @command rows
 * @text 표시 행수 변경
 * @arg value
 * @type number
 * @min 1
 * @max 8
 * @default 4
 *
 * @command fontSize
 * @text 폰트 크기 변경
 * @arg value
 * @type number
 * @min 8
 * @max 72
 * @default 28
 *
 * @command padding
 * @text 내부 여백 변경
 * @arg value
 * @type number
 * @min 0
 * @max 40
 * @default 18
 *
 * @command opacity
 * @text 프레임 투명도 변경
 * @arg value
 * @type number
 * @min 0
 * @max 255
 * @default 255
 *
 * @command backOpacity
 * @text 배경 투명도 변경
 * @arg value
 * @type number
 * @min 0
 * @max 255
 * @default 192
 *
 * @command position
 * @text 창 위치 지정
 * @desc x, y 중 "auto" 이면 기본 동작 유지
 * @arg x
 * @type string
 * @default auto
 * @arg y
 * @type string
 * @default auto
 *
 * @command reset
 * @text 설정 초기화
 * @desc 모든 설정을 플러그인 기본값으로 되돌립니다.
 *
 * @help
 * ============================================================================
 * 대사창 커스터마이징 플러그인 v1.0
 * ============================================================================
 * 플러그인 파라미터로 기본 외관을 설정하고,
 * 플러그인 커맨드로 이벤트 중 동적으로 변경할 수 있습니다.
 * 변경 사항은 세이브/로드 시 유지됩니다.
 *
 * [플러그인 커맨드]
 *   MessageWindow width 600        (창 너비, 0 = 화면 너비)
 *   MessageWindow rows 3           (표시 행수)
 *   MessageWindow fontSize 24      (폰트 크기)
 *   MessageWindow padding 12       (내부 여백)
 *   MessageWindow opacity 200      (프레임 투명도 0~255)
 *   MessageWindow backOpacity 128  (배경 투명도 0~255)
 *   MessageWindow position 100 400 (X Y 직접 지정)
 *   MessageWindow position auto auto (자동으로 복귀)
 *   MessageWindow reset            (모든 설정 초기화)
 * ============================================================================
 */

(function () {
    'use strict';

    var PLUGIN_NAME = 'MessageWindowCustom';
    var params = PluginManager.parameters(PLUGIN_NAME);

    function parseIntParam(val, def) {
        var n = parseInt(val, 10);
        return isNaN(n) ? def : n;
    }

    function parseXYParam(str, def) {
        var s = String(str || '').trim();
        if (!s || s === 'auto') return def;
        var n = parseInt(s, 10);
        return isNaN(n) ? def : n;
    }

    var DEFAULT_CONFIG = {
        windowWidth:  parseIntParam(params['windowWidth'],  0),
        windowRows:   parseIntParam(params['windowRows'],   4),
        fontSize:     parseIntParam(params['fontSize'],     28),
        padding:      parseIntParam(params['padding'],      18),
        opacity:      parseIntParam(params['opacity'],      255),
        backOpacity:  parseIntParam(params['backOpacity'],  192),
        windowX:      parseXYParam(params['windowX'],  null),
        windowY:      parseXYParam(params['windowY'],  null)
    };

    // $gameSystem에 설정 저장 (세이브/로드 연동)
    function getConfig() {
        if (!$gameSystem) return DEFAULT_CONFIG;
        if (!$gameSystem._msgWinConfig) {
            $gameSystem._msgWinConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }
        return $gameSystem._msgWinConfig;
    }

    // ============================================================
    // Window_Message 오버라이드
    // ============================================================

    Window_Message.prototype.windowWidth = function () {
        var cfg = getConfig();
        return (cfg.windowWidth > 0) ? cfg.windowWidth : Graphics.boxWidth;
    };

    Window_Message.prototype.numVisibleRows = function () {
        return getConfig().windowRows;
    };

    Window_Message.prototype.standardFontSize = function () {
        return getConfig().fontSize;
    };

    Window_Message.prototype.standardPadding = function () {
        return getConfig().padding;
    };

    // 위치 결정: 기존 positionType 로직 실행 후 커스텀 X/Y 덮어쓰기
    var _updatePlacement = Window_Message.prototype.updatePlacement;
    Window_Message.prototype.updatePlacement = function () {
        _updatePlacement.call(this);
        var cfg = getConfig();
        if (cfg.windowX !== null && cfg.windowX !== undefined) {
            this.x = cfg.windowX;
        } else {
            this.x = (Graphics.boxWidth - this.width) / 2;
        }
        if (cfg.windowY !== null && cfg.windowY !== undefined) {
            this.y = cfg.windowY;
            this._goldWindow.y = (this.y > 0) ? 0 : (Graphics.boxHeight - this._goldWindow.height);
        }
    };

    // 메시지 시작 시 크기/투명도 적용
    var _startMessage = Window_Message.prototype.startMessage;
    Window_Message.prototype.startMessage = function () {
        var cfg = getConfig();
        var newWidth  = (cfg.windowWidth > 0) ? cfg.windowWidth : Graphics.boxWidth;
        var newHeight = this.fittingHeight(cfg.windowRows);
        if (this.width !== newWidth || this.height !== newHeight) {
            this.width  = newWidth;
            this.height = newHeight;
            this.createContents();
        }
        this.opacity      = cfg.opacity;
        this.backOpacity  = cfg.backOpacity;
        _startMessage.call(this);
    };

    // ============================================================
    // 플러그인 커맨드
    // ============================================================

    var _pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _pluginCommand.call(this, command, args);
        if (command !== 'MessageWindow') return;

        var cfg   = getConfig();
        var sub   = String(args[0] || '').trim();
        var val1  = String(args[1] || '').trim();
        var val2  = String(args[2] || '').trim();

        switch (sub) {
            case 'width':
                cfg.windowWidth = Math.max(0, parseInt(val1, 10) || 0);
                break;
            case 'rows':
                cfg.windowRows = Math.min(8, Math.max(1, parseInt(val1, 10) || 4));
                break;
            case 'fontSize':
                cfg.fontSize = Math.min(72, Math.max(8, parseInt(val1, 10) || 28));
                break;
            case 'padding':
                cfg.padding = Math.min(40, Math.max(0, parseInt(val1, 10) || 18));
                break;
            case 'opacity':
                cfg.opacity = Math.min(255, Math.max(0, parseInt(val1, 10)));
                break;
            case 'backOpacity':
                cfg.backOpacity = Math.min(255, Math.max(0, parseInt(val1, 10)));
                break;
            case 'position':
                cfg.windowX = (val1 === 'auto' || val1 === '') ? null : (parseInt(val1, 10) || 0);
                cfg.windowY = (val2 === 'auto' || val2 === '') ? null : (parseInt(val2, 10) || 0);
                break;
            case 'reset':
                $gameSystem._msgWinConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                break;
        }
    };

})();
