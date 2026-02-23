/*:
 * @plugindesc [v1.1] 대사창 커스터마이징 - 크기, 위치, 폰트, 투명도, 색조, 스킨 설정
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
 * @text 창 전체 투명도
 * @type number
 * @min 0
 * @max 255
 * @default 255
 * @desc 창 전체(테두리+배경)의 투명도
 *
 * @param frameOpacity
 * @text 테두리 투명도
 * @type number
 * @min 0
 * @max 255
 * @default 255
 * @desc 테두리(frame)만의 투명도. 배경 투명도와 독립 설정.
 *
 * @param backOpacity
 * @text 배경 투명도
 * @type number
 * @min 0
 * @max 255
 * @default 192
 *
 * @param toneR
 * @text 배경 색조 R
 * @type number
 * @min -255
 * @max 255
 * @default 0
 * @desc 배경(채우기)의 빨강 색조. -255~255
 *
 * @param toneG
 * @text 배경 색조 G
 * @type number
 * @min -255
 * @max 255
 * @default 0
 * @desc 배경(채우기)의 초록 색조. -255~255
 *
 * @param toneB
 * @text 배경 색조 B
 * @type number
 * @min -255
 * @max 255
 * @default 0
 * @desc 배경(채우기)의 파랑 색조. -255~255
 *
 * @param windowskinName
 * @text 윈도우 스킨
 * @type file
 * @dir img/system/
 * @default Window
 * @desc img/system/ 폴더 내 스킨 이미지 파일명 (확장자 제외)
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
 * @text 창 전체 투명도 변경
 * @arg value
 * @type number
 * @min 0
 * @max 255
 * @default 255
 *
 * @command frameOpacity
 * @text 테두리 투명도 변경
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
 * @command tone
 * @text 배경 색조 변경
 * @desc 배경(채우기)의 RGB 색조를 변경합니다. -255~255
 * @arg r
 * @type number
 * @min -255
 * @max 255
 * @default 0
 * @arg g
 * @type number
 * @min -255
 * @max 255
 * @default 0
 * @arg b
 * @type number
 * @min -255
 * @max 255
 * @default 0
 *
 * @command skin
 * @text 윈도우 스킨 변경
 * @desc img/system/ 폴더 내 파일명 (확장자 제외). "Window" 이면 기본 스킨.
 * @arg name
 * @type string
 * @default Window
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
 * 대사창 커스터마이징 플러그인 v1.1
 * ============================================================================
 * 플러그인 파라미터로 기본 외관을 설정하고,
 * 플러그인 커맨드로 이벤트 중 동적으로 변경할 수 있습니다.
 * 변경 사항은 세이브/로드 시 유지됩니다.
 *
 * [플러그인 커맨드]
 *   MessageWindow width 600          (창 너비, 0 = 화면 너비)
 *   MessageWindow rows 3             (표시 행수)
 *   MessageWindow fontSize 24        (폰트 크기)
 *   MessageWindow padding 12         (내부 여백)
 *   MessageWindow opacity 200        (창 전체 투명도 0~255)
 *   MessageWindow frameOpacity 128   (테두리만 투명도 0~255)
 *   MessageWindow backOpacity 128    (배경 투명도 0~255)
 *   MessageWindow tone 0 -50 100     (배경 색조 R G B, -255~255)
 *   MessageWindow skin MyWindow      (img/system/MyWindow.png 사용)
 *   MessageWindow skin Window        (기본 스킨으로 복귀)
 *   MessageWindow position 100 400   (X Y 직접 지정)
 *   MessageWindow position auto auto (자동으로 복귀)
 *   MessageWindow reset              (모든 설정 초기화)
 *
 * [배경 색조(tone) 사용 예]
 *   MessageWindow tone 100 0 0        (붉은 색조)
 *   MessageWindow tone 0 0 100        (푸른 색조)
 *   MessageWindow tone -100 -100 -100 (어둡게)
 *
 * ============================================================================
 * 커스텀 윈도우 스킨 제작 방법
 * ============================================================================
 *
 * 스킨 이미지는 img/system/ 폴더에 PNG 파일로 저장합니다.
 * (플러그인 매니저에서 windowskinName 파라미터 옆 📂 버튼으로 폴더 열기)
 *
 * 파일 크기: 192 x 192 픽셀
 *
 * 레이아웃 (각 셀 = 96x96):
 *
 *   ┌──────────┬──────────┐
 *   │  배경    │  테두리  │  ← 행 0 (y: 0~95)
 *   │  패턴    │  (frame) │
 *   │  96x96   │  96x96   │
 *   ├──────────┼──────────┤
 *   │  배경    │  커서 /  │  ← 행 1 (y: 96~191)
 *   │  채우기  │  화살표  │
 *   │  96x96   │  96x96   │
 *   └──────────┴──────────┘
 *   x: 0~95   x: 96~191
 *
 * [좌측 열 — 배경 영역 (x: 0~95)]
 *   - 행 0 (y: 0~95):  창 전체에 타일링되는 배경 패턴 (9-slice stretch)
 *   - 행 1 (y: 96~191): 배경 채우기 색 (단색 또는 그라디언트로 타일링)
 *
 * [우측 열 — 테두리/UI 영역 (x: 96~191)]
 *   - 행 0 (y: 0~95):  9-slice 테두리
 *       * 모서리: 각 24x24 (좌상/우상/좌하/우하)
 *       * 가장자리: 가로/세로 24px 스트립 (stretch)
 *   - 행 1 (y: 96~191): 커서 / 스크롤 화살표 / 일시정지 아이콘
 *       * 커서: (96, 96) ~ (143, 143) 범위
 *       * 화살표/일시정지: 우측 하단 영역
 *
 * [제작 순서]
 *   1. 포토샵/GIMP/Aseprite 등에서 192x192 PNG 생성
 *   2. 좌상단(0,0): 배경 타일 패턴 그리기 (기본 Window.png 참고)
 *   3. 우상단(96,0): 테두리 9-slice 그리기
 *      - 테두리 두께 = 24px (모서리 24x24, 가장자리 stretch)
 *   4. 투명도(alpha) 활용 가능 — 반투명 테두리/배경 제작 가능
 *   5. img/system/ 폴더에 저장 후 skin 커맨드로 적용:
 *      MessageWindow skin 파일명 (확장자 제외)
 *
 * [팁]
 *   - 기본 Window.png를 복사해서 수정하는 것이 가장 빠릅니다.
 *   - tone 커맨드와 함께 사용하면 스킨 색조를 동적으로 변경 가능합니다.
 *   - backOpacity로 배경 투명도를 조절하면 배경 이미지가 비쳐 보입니다.
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
        windowWidth:    parseIntParam(params['windowWidth'],   0),
        windowRows:     parseIntParam(params['windowRows'],    4),
        fontSize:       parseIntParam(params['fontSize'],      28),
        padding:        parseIntParam(params['padding'],       18),
        opacity:        parseIntParam(params['opacity'],       255),
        frameOpacity:   parseIntParam(params['frameOpacity'],  255),
        backOpacity:    parseIntParam(params['backOpacity'],   192),
        toneR:          parseIntParam(params['toneR'],         0),
        toneG:          parseIntParam(params['toneG'],         0),
        toneB:          parseIntParam(params['toneB'],         0),
        windowskinName: String(params['windowskinName'] || 'Window'),
        windowX:        parseXYParam(params['windowX'], null),
        windowY:        parseXYParam(params['windowY'], null)
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

    // loadWindowskin: 스킨 이름이 변경된 경우 해당 이미지 로드
    var _loadWindowskin = Window_Message.prototype.loadWindowskin;
    Window_Message.prototype.loadWindowskin = function () {
        var cfg = getConfig();
        var skinName = (cfg.windowskinName && cfg.windowskinName !== '') ? cfg.windowskinName : 'Window';
        this.windowskin = ImageManager.loadSystem(skinName);
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

    // 메시지 시작 시 크기/투명도/색조/스킨 적용
    var _startMessage = Window_Message.prototype.startMessage;
    Window_Message.prototype.startMessage = function () {
        var cfg = getConfig();

        // 크기 변경
        var newWidth  = (cfg.windowWidth > 0) ? cfg.windowWidth : Graphics.boxWidth;
        var newHeight = this.fittingHeight(cfg.windowRows);
        if (this.width !== newWidth || this.height !== newHeight) {
            this.width  = newWidth;
            this.height = newHeight;
            this.createContents();
        }

        // 투명도
        this.opacity     = cfg.opacity;
        this.backOpacity = cfg.backOpacity;

        // 테두리 투명도 (frameSprite에 직접 적용)
        if (this._windowFrameSprite) {
            this._windowFrameSprite.alpha = cfg.frameOpacity / 255;
        }

        // 배경 색조
        this.setTone(cfg.toneR, cfg.toneG, cfg.toneB);

        // 스킨
        var skinName = (cfg.windowskinName && cfg.windowskinName !== '') ? cfg.windowskinName : 'Window';
        if (!this.windowskin || this.windowskin.name !== skinName) {
            this.windowskin = ImageManager.loadSystem(skinName);
        }

        _startMessage.call(this);
    };

    // ============================================================
    // 플러그인 커맨드
    // ============================================================

    var _pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _pluginCommand.call(this, command, args);
        if (command !== 'MessageWindow') return;

        var cfg  = getConfig();
        var sub  = String(args[0] || '').trim();
        var val1 = String(args[1] || '').trim();
        var val2 = String(args[2] || '').trim();
        var val3 = String(args[3] || '').trim();

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
            case 'frameOpacity':
                cfg.frameOpacity = Math.min(255, Math.max(0, parseInt(val1, 10)));
                break;
            case 'backOpacity':
                cfg.backOpacity = Math.min(255, Math.max(0, parseInt(val1, 10)));
                break;
            case 'tone':
                cfg.toneR = Math.min(255, Math.max(-255, parseInt(val1, 10) || 0));
                cfg.toneG = Math.min(255, Math.max(-255, parseInt(val2, 10) || 0));
                cfg.toneB = Math.min(255, Math.max(-255, parseInt(val3, 10) || 0));
                break;
            case 'skin':
                cfg.windowskinName = val1 || 'Window';
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
