/*:
 * @plugindesc [v1.0] 비주얼 노벨 모드 - 화면 상단부터 텍스트를 누적 출력하는 VN 스타일 메시지 시스템
 * @author RPG Maker MV Web Editor
 *
 * @param overlayOpacity
 * @text 배경 어둡기
 * @type number
 * @min 0
 * @max 200
 * @desc 배경 오버레이 불투명도 (0=투명, 200=완전불투명)
 * @default 120
 *
 * @param transitionFrames
 * @text 트랜지션 프레임 수
 * @type number
 * @min 4
 * @max 120
 * @desc 진입/탈출 시 페이드 프레임 수
 * @default 24
 *
 * @param textAreaX
 * @text 텍스트 영역 X
 * @type number
 * @min 0
 * @max 200
 * @desc 텍스트 영역 좌측 여백 (픽셀)
 * @default 60
 *
 * @param textAreaY
 * @text 텍스트 영역 Y (시작 위치)
 * @type number
 * @min 0
 * @max 400
 * @desc 텍스트 영역 상단 여백 (픽셀)
 * @default 40
 *
 * @param textAreaWidth
 * @text 텍스트 영역 폭
 * @type number
 * @min 200
 * @max 816
 * @desc 텍스트 영역 폭 (픽셀)
 * @default 700
 *
 * @param textAreaHeight
 * @text 텍스트 영역 높이
 * @type number
 * @min 100
 * @max 600
 * @desc 텍스트 영역 높이 (픽셀)
 * @default 520
 *
 * @param choiceStyle
 * @text 선택지 스타일
 * @type select
 * @option RPG Maker 기본 선택지
 * @value default
 * @option 비주얼 노벨 인라인 선택지
 * @value inline
 * @desc 선택지 표시 방식
 * @default inline
 *
 * @param speakerColor
 * @text 화자명 색상
 * @type string
 * @desc 화자명 텍스트 색상 (CSS 색상값)
 * @default #ffe066
 *
 * @param choiceIndicator
 * @text 선택지 커서 기호
 * @type string
 * @desc 현재 선택된 항목 앞에 표시할 기호
 * @default >
 *
 * @param autoExitDelay
 * @text 자동 탈출 딜레이 (프레임)
 * @type number
 * @min 0
 * @max 300
 * @desc 마지막 메시지 후 VN 모드를 자동으로 탈출하기까지 대기 프레임 수 (0=즉시)
 * @default 30
 *
 * @param showScrollBar
 * @text 스크롤바 표시
 * @type boolean
 * @on 표시
 * @off 숨김
 * @desc 텍스트 영역 우측에 스크롤바를 표시합니다.
 * @default false
 *
 * @help
 * ============================================================================
 * 비주얼 노벨 모드 플러그인 v1.0
 * ============================================================================
 * 화면 전체를 덮는 반투명 오버레이 위에서, 화면 상단부터 텍스트를 누적하여
 * 출력하는 비주얼 노벨 스타일 메시지 시스템입니다.
 *
 * [플러그인 커맨드]
 *   VisualNovel enter       — VN 모드 진입
 *   VisualNovel exit        — VN 모드 강제 탈출
 *   VisualNovel choiceStyle default   — 선택지를 기본 방식으로 변경
 *   VisualNovel choiceStyle inline    — 선택지를 인라인 방식으로 변경
 *
 * [동작 설명]
 * - VN 모드 진입 후, 텍스트 표시 명령어를 실행하면 화면 상단부터 대사가 쌓입니다.
 * - 텍스트가 화면을 넘으면 자동으로 스크롤합니다.
 * - 모든 메시지 출력이 끝나면 자동으로 VN 모드를 탈출합니다.
 * - 선택지 명령어 중에는 자동 탈출하지 않습니다.
 *
 * [인라인 선택지 조작]
 * - ↑/↓ 키 또는 터치/클릭으로 선택
 * - Enter/OK/Z 키로 결정
 * - ESC/X 키로 취소 (취소 가능 시)
 *
 * [TextLog 연동]
 * - TextLog.js가 함께 로드되어 있으면 선택 결과가 로그에도 기록됩니다.
 * ============================================================================
 */

(function () {
    'use strict';

    var params = PluginManager.parameters('VisualNovelMode');
    var OVERLAY_OPACITY  = parseInt(params['overlayOpacity'])   || 120;
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

    var ENTRY_GAP   = 6;
    var ENTRY_PAD   = 4;

    // =========================================================================
    // VNManager — VN 모드 전역 상태
    // =========================================================================
    var VNManager = {
        _active:      false,
        _choiceStyle: CHOICE_STYLE,

        isActive:        function () { return this._active; },
        enter:           function () { this._active = true; },
        exit:            function () { this._active = false; },
        getChoiceStyle:  function () { return this._choiceStyle; },
        setChoiceStyle:  function (s) {
            if (s === 'default' || s === 'inline') this._choiceStyle = s;
        }
    };

    // =========================================================================
    // 플러그인 커맨드
    // =========================================================================
    var _pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _pluginCommand.call(this, command, args);
        if (command !== 'VisualNovel') return;
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

    // =========================================================================
    // Window_VNText — VN 모드 텍스트 누적 출력 창
    // =========================================================================
    function Window_VNText() { this.initialize.apply(this, arguments); }
    Window_VNText.prototype = Object.create(Window_Base.prototype);
    Window_VNText.prototype.constructor = Window_VNText;

    Window_VNText.prototype.initialize = function () {
        Window_Base.prototype.initialize.call(this, TEXT_AREA_X, TEXT_AREA_Y, TEXT_AREA_W, TEXT_AREA_H);
        this.opacity     = 0;   // 창 테두리/배경 숨김 (오버레이 Sprite가 배경 담당)
        this.backOpacity = 0;
        this._entries    = [];  // { spk, txt } | { type:'choice', choices, sel, cancelIndex }
        this._layouts    = [];
        this._totalH     = 0;
        this._scrollY    = 0;
        this._vel        = 0;
        this._touchPrevY = null;
        // 인라인 선택지 상태
        this._choiceActive  = false;
        this._choiceIndex   = 0;
        this._cancelIndex   = -1;
        this._choiceResult  = -1;
        this.contents.clear();
    };

    // ── 항목 추가 ────────────────────────────────────────────────────────────
    Window_VNText.prototype.addEntry = function (spk, txt) {
        this._entries.push({ spk: spk, txt: txt });
        this._rebuildAndScroll();
    };

    Window_VNText.prototype.addChoiceEntry = function (choices, defaultIdx, cancelIdx) {
        this._entries.push({ type: 'choice', choices: choices, sel: defaultIdx, cancelIndex: cancelIdx });
        this._choiceActive = true;
        this._choiceIndex  = (defaultIdx >= 0) ? defaultIdx : 0;
        this._cancelIndex  = cancelIdx;
        this._choiceResult = -1;
        this._rebuildAndScroll();
    };

    Window_VNText.prototype.isChoiceActive  = function () { return this._choiceActive; };
    Window_VNText.prototype.getChoiceResult = function () { return this._choiceResult; };

    // ── 레이아웃 빌드 ────────────────────────────────────────────────────────
    Window_VNText.prototype._buildLayouts = function () {
        var lh = this.lineHeight();
        this._layouts = [];
        var y = ENTRY_GAP;
        for (var i = 0; i < this._entries.length; i++) {
            var e = this._entries[i];
            var h;
            if (e.type === 'choice') {
                h = e.choices.length * lh + ENTRY_PAD * 2;
            } else {
                var conv = this.convertEscapeCharacters(e.txt || '');
                var ts   = { index: 0, text: conv };
                var textH = this.calcTextHeight(ts, true);
                if (e.spk) textH += lh;
                h = textH + ENTRY_PAD;
            }
            this._layouts.push({ y: y, h: h });
            y += h + ENTRY_GAP;
        }
        this._totalH = y;
    };

    Window_VNText.prototype._innerH = function () {
        return this.height - this.standardPadding() * 2;
    };

    Window_VNText.prototype._innerW = function () {
        return this.width - this.standardPadding() * 2;
    };

    Window_VNText.prototype._maxScrollY = function () {
        return Math.max(0, this._totalH - this._innerH());
    };

    Window_VNText.prototype._rebuildAndScroll = function () {
        // 관성 즉시 초기화 — vel이 남아 있으면 다음 프레임에 스크롤이 위로 튀어오름
        this._vel = 0;
        // 새 항목 추가 전에 이미 맨 아래에 있었는지 기록
        var prevMax = this._maxScrollY();
        var wasAtBottom = (prevMax <= 0) || (this._scrollY >= prevMax - 2);
        this._buildLayouts();
        if (wasAtBottom) {
            // 맨 아래에 있었으면 새 maxScrollY로 따라감 (새 내용 보이도록)
            this._scrollY = this._maxScrollY();
        }
        // else: 위로 스크롤해서 읽던 중이면 위치 유지
        this._redraw();
    };

    // ── 렌더링 ───────────────────────────────────────────────────────────────
    Window_VNText.prototype._redraw = function () {
        if (!this.contents) return;
        this.contents.clear();
        var top = this._scrollY;
        var bot = this._scrollY + this._innerH();
        var lh  = this.lineHeight();
        var iw  = this._innerW();

        for (var i = 0; i < this._layouts.length; i++) {
            var l  = this._layouts[i];
            if (l.y + l.h < top || l.y > bot) continue;
            var dy = l.y - this._scrollY;
            var e  = this._entries[i];
            if (e.type === 'choice') {
                // 선택지: 마지막 항목이면 현재 선택 인덱스 사용
                var activeSel = (i === this._entries.length - 1 && this._choiceActive)
                    ? this._choiceIndex : (e.sel !== undefined ? e.sel : -1);
                this._drawChoiceEntry(e, dy, lh, iw, activeSel);
            } else {
                this._drawTextEntry(e, dy, lh, iw);
            }
        }
        this._drawScrollBar();

        // ExtendedText 애니메이션 세그먼트 초기화 (TextLog와 동일한 이슈 방지)
        this._etAnimSegs    = [];
        this._etEffectStack = [];
    };

    Window_VNText.prototype._drawTextEntry = function (e, dy, lh, iw) {
        var cy = dy + ENTRY_PAD;
        if (e.spk) {
            var prevColor = this.contents.textColor;
            this.contents.textColor = SPEAKER_COLOR;
            this.drawText(e.spk, 0, cy, iw);
            this.contents.textColor = prevColor;
            cy += lh;
        }
        this.drawTextEx(e.txt || '', 0, cy);
        this.resetFontSettings();
    };

    Window_VNText.prototype._drawChoiceEntry = function (e, dy, lh, iw, activeSel) {
        for (var j = 0; j < e.choices.length; j++) {
            var cy = dy + ENTRY_PAD + j * lh;
            var isCurrent = (activeSel === j);
            var prefix    = isCurrent ? (CHOICE_IND + ' ') : '  ';
            this.contents.textColor = isCurrent ? '#ffffff' : '#999999';
            this.drawText(prefix + e.choices[j], 0, cy, iw);
        }
        this.contents.textColor = '#ffffff';
        this.resetFontSettings();
    };

    Window_VNText.prototype._drawScrollBar = function () {
        if (!SHOW_SCROLL_BAR) return;
        var innerH = this._innerH();
        if (this._totalH <= innerH) return;
        var bw    = 4;
        var bx    = this.contentsWidth() - bw - 1;
        var avail = innerH - 8;
        var hh    = Math.max(20, avail * (innerH / this._totalH));
        var ratio = this._maxScrollY() > 0 ? (this._scrollY / this._maxScrollY()) : 0;
        var hy    = 4 + (avail - hh) * ratio;
        this.contents.fillRect(bx, 4,  bw, avail, 'rgba(255,255,255,0.1)');
        this.contents.fillRect(bx, hy, bw, hh,    'rgba(255,255,255,0.5)');
    };

    // ── 스크롤 ───────────────────────────────────────────────────────────────
    Window_VNText.prototype.scrollBy = function (dy) {
        var prev = this._scrollY;
        this._scrollY = Math.max(0, Math.min(this._scrollY + dy, this._maxScrollY()));
        if (this._scrollY !== prev) this._redraw();
    };

    // ── 선택지 조작 ──────────────────────────────────────────────────────────
    Window_VNText.prototype.moveChoiceUp = function () {
        if (!this._choiceActive) return;
        var last = this._entries[this._entries.length - 1];
        if (!last || last.type !== 'choice') return;
        this._choiceIndex = (this._choiceIndex - 1 + last.choices.length) % last.choices.length;
        this._redraw();
    };

    Window_VNText.prototype.moveChoiceDown = function () {
        if (!this._choiceActive) return;
        var last = this._entries[this._entries.length - 1];
        if (!last || last.type !== 'choice') return;
        this._choiceIndex = (this._choiceIndex + 1) % last.choices.length;
        this._redraw();
    };

    Window_VNText.prototype.confirmChoice = function () {
        if (!this._choiceActive) return;
        var last = this._entries[this._entries.length - 1];
        if (!last || last.type !== 'choice') return;
        last.sel           = this._choiceIndex;
        this._choiceResult = this._choiceIndex;
        this._choiceActive = false;
        // 선택 결과를 텍스트 항목으로 추가 (로그/표시용)
        var choiceText = last.choices[this._choiceResult] || '';
        this._entries.push({ spk: '', txt: '  ' + CHOICE_IND + ' ' + choiceText, _choiceLog: choiceText });
        this._rebuildAndScroll();
    };

    Window_VNText.prototype.cancelChoice = function () {
        if (!this._choiceActive) return;
        if (this._cancelIndex < 0) return;  // 취소 불가
        var last = this._entries[this._entries.length - 1];
        if (!last || last.type !== 'choice') return;
        last.sel           = this._cancelIndex;
        this._choiceResult = this._cancelIndex;
        this._choiceActive = false;
        var choiceText = (this._cancelIndex < last.choices.length)
            ? last.choices[this._cancelIndex] : '(취소)';
        this._entries.push({ spk: '', txt: '  ' + CHOICE_IND + ' ' + choiceText, _choiceLog: choiceText });
        this._rebuildAndScroll();
    };

    // ── 터치로 선택지 클릭 ────────────────────────────────────────────────────
    Window_VNText.prototype._handleChoiceTouch = function () {
        if (!this._choiceActive) return;
        var idx = this._entries.length - 1;
        if (idx < 0) return;
        var l    = this._layouts[idx];
        var e    = this._entries[idx];
        if (!l || !e || e.type !== 'choice') return;

        var lh   = this.lineHeight();
        var pad  = this.standardPadding();
        var baseY = this.y + pad + l.y - this._scrollY + ENTRY_PAD;
        var tx = TouchInput.x;
        var ty = TouchInput.y;

        // 창 X 범위 체크
        if (tx < this.x || tx > this.x + this.width) return;

        for (var j = 0; j < e.choices.length; j++) {
            var cy = baseY + j * lh;
            if (ty >= cy && ty < cy + lh) {
                if (this._choiceIndex === j) {
                    this.confirmChoice();
                } else {
                    this._choiceIndex = j;
                    this._redraw();
                }
                return;
            }
        }
    };

    // ── update ───────────────────────────────────────────────────────────────
    Window_VNText.prototype.update = function () {
        // ExtendedText 애니메이션 억제
        this._etAnimSegs    = [];
        this._etEffectStack = [];
        Window_Base.prototype.update.call(this);
        this._handleInertia();
        this._handleTouchScroll();
        if (this._choiceActive) {
            if (Input.isRepeated('up'))      this.moveChoiceUp();
            if (Input.isRepeated('down'))    this.moveChoiceDown();
            if (Input.isTriggered('ok'))     this.confirmChoice();
            if (Input.isTriggered('cancel')) this.cancelChoice();
            if (TouchInput.isTriggered())    this._handleChoiceTouch();
        }
    };

    Window_VNText.prototype._handleInertia = function () {
        if (Math.abs(this._vel) < 0.5) { this._vel = 0; return; }
        this.scrollBy(this._vel);
        this._vel *= 0.88;
        if (this._scrollY <= 0 || this._scrollY >= this._maxScrollY()) this._vel = 0;
    };

    Window_VNText.prototype._handleTouchScroll = function () {
        if (this._choiceActive) return;  // 선택지 중에는 터치 스크롤 대신 선택지 처리
        if (TouchInput.isPressed()) {
            if (this._touchPrevY !== null) {
                var dy = this._touchPrevY - TouchInput.y;
                if (Math.abs(dy) > 0) {
                    this.scrollBy(dy);
                    this._vel = dy;
                }
            }
            this._touchPrevY = TouchInput.y;
        } else {
            this._touchPrevY = null;
        }
    };

    // =========================================================================
    // VNController — Scene_Map에서 VN 오버레이 관리
    // =========================================================================
    function VNController(scene) {
        this._scene      = scene;
        this._state      = 'closed';  // 'opening' | 'open' | 'closing' | 'closed'
        this._alpha      = 0;
        this._autoTimer  = -1;

        // 반투명 어두운 오버레이 Sprite
        this._overlay = new Sprite(new Bitmap(Graphics.boxWidth, Graphics.boxHeight));
        this._overlay.bitmap.fillAll('rgba(0,0,0,' + (OVERLAY_OPACITY / 255).toFixed(3) + ')');
        this._overlay.opacity = 0;
        this._overlay.visible = false;

        // 텍스트 창
        this._textWin = new Window_VNText();
        this._textWin.opacity        = 0;
        this._textWin.backOpacity    = 0;
        this._textWin.contentsOpacity = 0;

        scene.addChild(this._overlay);
        scene.addWindow(this._textWin);
    }

    VNController.prototype.open = function () {
        this._overlay.visible = true;
        this._state = 'opening';
        this._autoTimer = -1;
    };

    VNController.prototype.close = function () {
        this._state = 'closing';
        this._autoTimer = -1;
    };

    VNController.prototype.isOpen = function () {
        return this._state === 'open' || this._state === 'opening';
    };

    VNController.prototype.addMessage = function (spk, txt) {
        this._textWin.addEntry(spk, txt);
        this._autoTimer = -1;
    };

    VNController.prototype.scheduleAutoExit = function () {
        if (AUTO_EXIT_DELAY <= 0) {
            VNManager.exit();
            this.close();
        } else {
            this._autoTimer = AUTO_EXIT_DELAY;
        }
    };

    VNController.prototype.cancelAutoExit = function () {
        this._autoTimer = -1;
    };

    VNController.prototype.getTextWindow = function () {
        return this._textWin;
    };

    VNController.prototype.update = function () {
        var step = 255 / TRANS_FRAMES;

        if (this._state === 'opening') {
            this._alpha = Math.min(255, this._alpha + step);
            this._overlay.opacity         = Math.round(this._alpha);
            this._textWin.contentsOpacity = Math.round(this._alpha);
            if (this._alpha >= 255) {
                this._alpha = 255;
                this._state = 'open';
            }
        } else if (this._state === 'closing') {
            this._alpha = Math.max(0, this._alpha - step);
            this._overlay.opacity         = Math.round(this._alpha);
            this._textWin.contentsOpacity = Math.round(this._alpha);
            if (this._alpha <= 0) {
                this._alpha = 0;
                this._state = 'closed';
                this._overlay.visible = false;
            }
        }

        // 자동 탈출 타이머
        if (this._autoTimer > 0) {
            this._autoTimer--;
            if (this._autoTimer === 0) {
                this._autoTimer = -1;
                VNManager.exit();
                this.close();
            }
        }
    };

    // =========================================================================
    // Scene_Map 확장 — VNController 생성 및 update
    // =========================================================================
    var _SceneMap_createDisplayObjects = Scene_Map.prototype.createDisplayObjects;
    Scene_Map.prototype.createDisplayObjects = function () {
        _SceneMap_createDisplayObjects.call(this);
        this._vnCtrl = new VNController(this);
        if (VNManager.isActive()) this._vnCtrl.open();
    };

    var _SceneMap_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _SceneMap_update.call(this);
        if (this._vnCtrl) this._vnCtrl.update();
    };

    // 씬 종료 시 휠 이벤트 정리 (start/terminate에서 처리)
    var _vnWheelHandler = null;

    var _SceneMap_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function () {
        _SceneMap_start.call(this);
        var self = this;
        _vnWheelHandler = function (e) {
            if (!VNManager.isActive()) return;
            var ctrl = self._vnCtrl;
            if (!ctrl) return;
            var tw = ctrl.getTextWindow();
            if (tw && !tw.isChoiceActive()) {
                e.preventDefault();
                tw.scrollBy(e.deltaY * 0.5);
                tw._vel = 0;
            }
        };
        window.addEventListener('wheel', _vnWheelHandler, { passive: false });
    };

    var _SceneMap_terminate = Scene_Map.prototype.terminate;
    Scene_Map.prototype.terminate = function () {
        _SceneMap_terminate.call(this);
        if (_vnWheelHandler) {
            window.removeEventListener('wheel', _vnWheelHandler);
            _vnWheelHandler = null;
        }
    };

    // =========================================================================
    // Window_Message 확장 — VN 모드 시 창 숨김 + 텍스트를 VNLayer로
    // =========================================================================
    var _WM_startMessage = Window_Message.prototype.startMessage;
    Window_Message.prototype.startMessage = function () {
        if (VNManager.isActive()) {
            var spk = (typeof $gameMessage.speakerName === 'function')
                        ? ($gameMessage.speakerName() || '') : '';
            var txt = $gameMessage.allText();
            var s   = SceneManager._scene;
            if (s && s._vnCtrl) {
                s._vnCtrl.addMessage(spk, txt);
                s._vnCtrl.cancelAutoExit();
            }
        }
        _WM_startMessage.call(this);
    };

    // VN 모드에서 Window_Message를 화면 밖으로
    var _WM_updatePlacement = Window_Message.prototype.updatePlacement;
    Window_Message.prototype.updatePlacement = function () {
        _WM_updatePlacement.call(this);
        if (VNManager.isActive()) {
            this.y = Graphics.boxHeight + 200;
        }
    };

    // 메시지 종료 후 자동 탈출 스케줄
    var _WM_terminateMessage = Window_Message.prototype.terminateMessage;
    Window_Message.prototype.terminateMessage = function () {
        _WM_terminateMessage.call(this);
        if (!VNManager.isActive()) return;
        if ($gameMessage.isChoice() || $gameMessage.isNumberInput() || $gameMessage.isItemChoice()) return;
        if (!$gameMessage.isBusy()) {
            var s = SceneManager._scene;
            if (s && s._vnCtrl) s._vnCtrl.scheduleAutoExit();
        }
    };

    // 선택지/숫자입력 시작 전 자동 탈출 취소
    var _WM_startInput = Window_Message.prototype.startInput;
    Window_Message.prototype.startInput = function () {
        if (VNManager.isActive()) {
            var s = SceneManager._scene;
            if (s && s._vnCtrl) s._vnCtrl.cancelAutoExit();
        }
        return _WM_startInput.call(this);
    };

    // =========================================================================
    // 선택지 분기 — 인라인 vs 기본
    // =========================================================================
    var _WCL_start = Window_ChoiceList.prototype.start;
    Window_ChoiceList.prototype.start = function () {
        if (VNManager.isActive() && VNManager.getChoiceStyle() === 'inline') {
            this._vnInline = true;
            this._setupVNInline();
        } else {
            this._vnInline = false;
            _WCL_start.call(this);
        }
    };

    Window_ChoiceList.prototype._setupVNInline = function () {
        var s   = SceneManager._scene;
        var tw  = s && s._vnCtrl ? s._vnCtrl.getTextWindow() : null;
        if (!tw) {
            this._vnInline = false;
            _WCL_start.call(this);
            return;
        }

        var choices   = $gameMessage.choices();
        var defIdx    = $gameMessage.choiceDefaultType();
        var cancelIdx = $gameMessage.choiceCancelType();

        tw.addChoiceEntry(choices, defIdx >= 0 ? defIdx : 0, cancelIdx);
        this._vnTextWin = tw;

        // 이 창은 보이지 않음
        this.deactivate();
        this.close();
    };

    var _WCL_update = Window_ChoiceList.prototype.update;
    Window_ChoiceList.prototype.update = function () {
        if (this._vnInline) {
            this._updateVNInline();
            return;
        }
        _WCL_update.call(this);
    };

    Window_ChoiceList.prototype._updateVNInline = function () {
        // Window_Base.update만 (렌더링은 Window_VNText가 담당)
        Window_Base.prototype.update.call(this);
        var tw = this._vnTextWin;
        if (tw && !tw.isChoiceActive()) {
            // 선택 완료
            var result = tw.getChoiceResult();
            if (result < 0) result = 0;

            // TextLog에 선택 기록
            var entries = tw._entries;
            var lastLog = entries[entries.length - 1];
            if (lastLog && lastLog._choiceLog) {
                if (typeof TextLogManager !== 'undefined') {
                    TextLogManager.add({
                        spk: '[선택]',
                        txt: lastLog._choiceLog,
                        fn: '', fi: 0, bg: 0, lc: 1
                    });
                }
            }

            $gameMessage.onChoice(result);
            this._messageWindow.terminateMessage();
            this.close();
            this._vnInline  = false;
            this._vnTextWin = null;

            // 선택 후 자동 탈출 스케줄
            if (VNManager.isActive() && !$gameMessage.isBusy()) {
                var s = SceneManager._scene;
                if (s && s._vnCtrl) s._vnCtrl.scheduleAutoExit();
            }
        }
    };

    // =========================================================================
    // 기본 선택지 방식일 때 선택 결과 로그+VN창 기록
    // =========================================================================
    var _GM_onChoice = Game_Message.prototype.onChoice;
    Game_Message.prototype.onChoice = function (n) {
        if (VNManager.isActive() && VNManager.getChoiceStyle() === 'default') {
            var choices   = this._choices || [];
            var chosen    = (n >= 0 && n < choices.length) ? choices[n] : ('선택 ' + n);
            if (typeof TextLogManager !== 'undefined') {
                TextLogManager.add({ spk: '[선택]', txt: chosen, fn: '', fi: 0, bg: 0, lc: 1 });
            }
            var s = SceneManager._scene;
            if (s && s._vnCtrl) {
                s._vnCtrl.addMessage('[선택]', '  ' + CHOICE_IND + ' ' + chosen);
            }
        }
        _GM_onChoice.call(this, n);
    };

})();
