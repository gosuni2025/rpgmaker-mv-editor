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
 * @type string
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
    // raw 텍스트에서 escape/태그를 제외한 visible 글자 count개까지 슬라이스
    // =========================================================================
    function sliceRaw(text, count) {
        var i = 0, visible = 0;
        while (i < text.length) {
            if (visible >= count) break;
            var c = text[i];
            if (c === '\\') {
                // \C[n], \N[n], \V[n], \I[n] 또는 \. \! \{ \} 등
                i++;
                if (i < text.length) {
                    var n = text[i].toUpperCase();
                    if ('CNVI'.indexOf(n) >= 0 && i + 1 < text.length && text[i + 1] === '[') {
                        i += 2;
                        while (i < text.length && text[i] !== ']') i++;
                        if (i < text.length) i++;
                    } else {
                        i++;
                    }
                }
                // escape 코드는 visible 카운트 증가 안 함
            } else if (c === '<') {
                // ExtendedText 태그 <color ...> 등 통째로 건너뜀
                while (i < text.length && text[i] !== '>') i++;
                if (i < text.length) i++;
            } else {
                i++;
                visible++;
            }
        }
        return text.substring(0, i);
    }

    function countVisible(text) {
        var i = 0, count = 0;
        while (i < text.length) {
            var c = text[i];
            if (c === '\\') {
                i++;
                if (i < text.length) {
                    var n = text[i].toUpperCase();
                    if ('CNVI'.indexOf(n) >= 0 && i + 1 < text.length && text[i + 1] === '[') {
                        i += 2;
                        while (i < text.length && text[i] !== ']') i++;
                        if (i < text.length) i++;
                    } else { i++; }
                }
            } else if (c === '<') {
                while (i < text.length && text[i] !== '>') i++;
                if (i < text.length) i++;
            } else {
                i++; count++;
            }
        }
        return count;
    }

    // =========================================================================
    // Window_VNText
    // =========================================================================
    function Window_VNText() { this.initialize.apply(this, arguments); }
    Window_VNText.prototype = Object.create(Window_Base.prototype);
    Window_VNText.prototype.constructor = Window_VNText;

    Window_VNText.prototype.initialize = function () {
        Window_Base.prototype.initialize.call(this, TEXT_AREA_X, TEXT_AREA_Y, TEXT_AREA_W, TEXT_AREA_H);
        this.opacity     = 0;
        this.backOpacity = 0;
        this._entries    = [];
        this._layouts    = [];
        this._totalH     = 0;
        this._scrollY    = 0;
        this._vel        = 0;
        this._touchPrevY = null;

        // 타이프라이터 상태
        this._isTyping    = false;
        this._typeSpk     = '';
        this._typeFull    = '';   // 전체 raw 텍스트
        this._typeTotal   = 0;   // 총 visible 글자 수
        this._typeShown   = 0;   // 현재 표시된 visible 글자 수
        this._typeEntryIdx = -1;

        // 인라인 선택지 상태
        this._choiceActive  = false;
        this._choiceIndex   = 0;
        this._cancelIndex   = -1;
        this._choiceResult  = -1;

        this.contents.clear();
    };

    // ── 타이프라이터로 텍스트 추가 ────────────────────────────────────────────
    Window_VNText.prototype.startTyping = function (spk, txt) {
        // 이전 타이핑이 있으면 즉시 완료
        if (this._isTyping) this.skipTyping();

        this._typeSpk   = spk;
        this._typeFull  = txt;
        this._typeTotal = countVisible(txt);
        this._typeShown = 0;
        this._isTyping  = true;

        // entries에 빈 항목 먼저 추가 (점점 채워짐)
        this._entries.push({ spk: spk, txt: '' });
        this._typeEntryIdx = this._entries.length - 1;

        this._vel = 0;
        this._rebuildAndScroll();
    };

    // 타이핑 즉시 완료
    Window_VNText.prototype.skipTyping = function () {
        if (!this._isTyping) return;
        this._entries[this._typeEntryIdx].txt = this._typeFull;
        this._isTyping = false;
        this._vel = 0;
        this._rebuildAndScroll();
    };

    // 직접 즉시 추가 (선택 결과 등)
    Window_VNText.prototype.addEntry = function (spk, txt) {
        if (this._isTyping) this.skipTyping();
        this._entries.push({ spk: spk, txt: txt });
        this._vel = 0;
        this._rebuildAndScroll();
    };

    // 인라인 선택지 추가
    Window_VNText.prototype.addChoiceEntry = function (choices, defaultIdx, cancelIdx) {
        if (this._isTyping) this.skipTyping();
        this._entries.push({ type: 'choice', choices: choices, sel: defaultIdx, cancelIndex: cancelIdx });
        this._choiceActive = true;
        this._choiceIndex  = (defaultIdx >= 0) ? defaultIdx : 0;
        this._cancelIndex  = cancelIdx;
        this._choiceResult = -1;
        this._vel = 0;
        this._rebuildAndScroll();
    };

    Window_VNText.prototype.isChoiceActive  = function () { return this._choiceActive; };
    Window_VNText.prototype.getChoiceResult = function () { return this._choiceResult; };

    // ── 레이아웃 빌드 ─────────────────────────────────────────────────────────
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
                h = this.calcTextHeight(ts, true) + ENTRY_PAD;
                if (e.spk) h += lh;
            }
            this._layouts.push({ y: y, h: h });
            y += h + ENTRY_GAP;
        }
        this._totalH = y;
    };

    Window_VNText.prototype._innerH    = function () { return this.height - this.standardPadding() * 2; };
    Window_VNText.prototype._innerW    = function () { return this.width  - this.standardPadding() * 2; };
    Window_VNText.prototype._maxScrollY = function () { return Math.max(0, this._totalH - this._innerH()); };

    Window_VNText.prototype._rebuildAndScroll = function () {
        this._vel = 0;
        var wasAtBottom = (this._maxScrollY() <= 0) || (this._scrollY >= this._maxScrollY() - 2);
        this._buildLayouts();
        if (wasAtBottom) this._scrollY = this._maxScrollY();
        this._redraw();
    };

    // ── 렌더링 ──────────────────────────────────────────────────────────────
    Window_VNText.prototype._redraw = function () {
        if (!this.contents) return;
        this.contents.clear();
        var top = this._scrollY;
        var bot = this._scrollY + this._innerH();
        var lh  = this.lineHeight();
        var iw  = this._innerW();

        for (var i = 0; i < this._layouts.length; i++) {
            var l = this._layouts[i];
            if (l.y + l.h < top || l.y > bot) continue;
            var dy = l.y - this._scrollY;
            var e  = this._entries[i];
            if (e.type === 'choice') {
                var activeSel = (i === this._entries.length - 1 && this._choiceActive)
                    ? this._choiceIndex : (e.sel !== undefined ? e.sel : -1);
                this._drawChoiceEntry(e, dy, lh, iw, activeSel);
            } else {
                this._drawTextEntry(e, dy, lh, iw);
            }
        }

        if (SHOW_SCROLL_BAR) this._drawScrollBar();

        // ExtendedText 애니메이션 세그먼트 초기화 (TextLog와 동일한 처리)
        this._etAnimSegs    = [];
        this._etEffectStack = [];
    };

    Window_VNText.prototype._drawTextEntry = function (e, dy, lh, iw) {
        var cy = dy + ENTRY_PAD;
        if (e.spk) {
            var prev = this.contents.textColor;
            this.contents.textColor = SPEAKER_COLOR;
            this.drawText(e.spk, 0, cy, iw);
            this.contents.textColor = prev;
            cy += lh;
        }
        this.drawTextEx(e.txt || '', 0, cy);
        this.resetFontSettings();
    };

    Window_VNText.prototype._drawChoiceEntry = function (e, dy, lh, iw, activeSel) {
        for (var j = 0; j < e.choices.length; j++) {
            var cy     = dy + ENTRY_PAD + j * lh;
            var isCur  = (activeSel === j);
            var prefix = isCur ? (CHOICE_IND + ' ') : '  ';
            this.contents.textColor = isCur ? '#ffffff' : '#999999';
            this.drawText(prefix + e.choices[j], 0, cy, iw);
        }
        this.contents.textColor = '#ffffff';
        this.resetFontSettings();
    };

    Window_VNText.prototype._drawScrollBar = function () {
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
        var txt = last.choices[this._choiceResult] || '';
        this._entries.push({ spk: '', txt: '  ' + CHOICE_IND + ' ' + txt, _choiceLog: txt });
        this._vel = 0;
        this._rebuildAndScroll();
    };

    Window_VNText.prototype.cancelChoice = function () {
        if (!this._choiceActive || this._cancelIndex < 0) return;
        var last = this._entries[this._entries.length - 1];
        if (!last || last.type !== 'choice') return;
        last.sel           = this._cancelIndex;
        this._choiceResult = this._cancelIndex;
        this._choiceActive = false;
        var txt = (this._cancelIndex < last.choices.length) ? last.choices[this._cancelIndex] : '(취소)';
        this._entries.push({ spk: '', txt: '  ' + CHOICE_IND + ' ' + txt, _choiceLog: txt });
        this._vel = 0;
        this._rebuildAndScroll();
    };

    Window_VNText.prototype._handleChoiceTouch = function () {
        if (!this._choiceActive) return;
        var idx = this._entries.length - 1;
        if (idx < 0) return;
        var l = this._layouts[idx];
        var e = this._entries[idx];
        if (!l || !e || e.type !== 'choice') return;
        var lh   = this.lineHeight();
        var pad  = this.standardPadding();
        var baseY = this.y + pad + l.y - this._scrollY + ENTRY_PAD;
        var ty = TouchInput.y;
        var tx = TouchInput.x;
        if (tx < this.x || tx > this.x + this.width) return;
        for (var j = 0; j < e.choices.length; j++) {
            var cy = baseY + j * lh;
            if (ty >= cy && ty < cy + lh) {
                if (this._choiceIndex === j) { this.confirmChoice(); }
                else { this._choiceIndex = j; this._redraw(); }
                return;
            }
        }
    };

    // Window_Message의 pause를 해제하여 다음 메시지로 진행
    Window_VNText.prototype._sendOkToMessage = function () {
        var s  = SceneManager._scene;
        var mw = s && s._messageWindow;
        if (!mw || !mw.pause) return;
        mw.pause = false;
        mw._waitCount = 0;
        // textState를 null로 지워야 함:
        // pause=false만 설정하면 다음 프레임에 updateMessage()가 textState를 보고
        // onEndOfText() → startPause() → pause=true로 되돌려버림.
        // null로 설정하면 updateMessage()가 false 반환 → canStart()로 넘어가
        // 다음 메시지 블록의 startMessage()가 호출됨.
        mw._textState = null;
    };

    // ── update ───────────────────────────────────────────────────────────────
    Window_VNText.prototype.update = function () {
        // ExtendedText 애니메이션 억제
        this._etAnimSegs    = [];
        this._etEffectStack = [];
        Window_Base.prototype.update.call(this);

        // 타이프라이터 진행
        if (this._isTyping) {
            this._typeShown++;
            if (this._typeShown >= this._typeTotal) {
                // 완료
                this._entries[this._typeEntryIdx].txt = this._typeFull;
                this._isTyping = false;
            } else {
                this._entries[this._typeEntryIdx].txt = sliceRaw(this._typeFull, this._typeShown);
            }
            this._buildLayouts();
            this._scrollY = this._maxScrollY();  // 항상 맨 아래 추적
            this._redraw();
        }

        // 입력 처리
        if (this._choiceActive) {
            // 선택지 모드
            if (Input.isRepeated('up'))      this.moveChoiceUp();
            if (Input.isRepeated('down'))    this.moveChoiceDown();
            if (Input.isTriggered('ok'))     this.confirmChoice();
            if (Input.isTriggered('cancel')) this.cancelChoice();
            if (TouchInput.isTriggered())    this._handleChoiceTouch();
        } else {
            // 타이핑 중 또는 완료 후 클릭/OK
            var triggered = Input.isTriggered('ok') || TouchInput.isTriggered();
            if (triggered) {
                if (this._isTyping) {
                    this.skipTyping();  // 타이핑 즉시 완료
                } else {
                    this._sendOkToMessage();  // 다음 메시지로 진행
                }
            }
            // 스크롤 (선택지 없을 때만)
            this._handleInertia();
            this._handleTouchScroll();
        }
    };

    Window_VNText.prototype._handleInertia = function () {
        if (Math.abs(this._vel) < 0.5) { this._vel = 0; return; }
        this.scrollBy(this._vel);
        this._vel *= 0.88;
        if (this._scrollY <= 0 || this._scrollY >= this._maxScrollY()) this._vel = 0;
    };

    Window_VNText.prototype._handleTouchScroll = function () {
        if (TouchInput.isPressed()) {
            if (this._touchPrevY !== null) {
                var dy = this._touchPrevY - TouchInput.y;
                if (Math.abs(dy) > 2) {
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
    // VNController
    // =========================================================================
    function VNController(scene) {
        this._scene     = scene;
        this._state     = 'closed';
        this._alpha     = 0;
        this._autoTimer = -1;

        this._overlay = new Sprite(new Bitmap(Graphics.boxWidth, Graphics.boxHeight));
        this._overlay.bitmap.fillAll('rgba(0,0,0,' + (OVERLAY_OPACITY / 255).toFixed(3) + ')');
        this._overlay.opacity = 0;
        this._overlay.visible = false;

        this._textWin = new Window_VNText();
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

    VNController.prototype.getTextWindow = function () { return this._textWin; };

    VNController.prototype.startTyping = function (spk, txt) {
        this._textWin.startTyping(spk, txt);
        this._autoTimer = -1;
    };

    VNController.prototype.scheduleAutoExit = function () {
        if (AUTO_EXIT_DELAY <= 0) { VNManager.exit(); this.close(); }
        else { this._autoTimer = AUTO_EXIT_DELAY; }
    };

    VNController.prototype.cancelAutoExit = function () { this._autoTimer = -1; };

    VNController.prototype.update = function () {
        var step = 255 / TRANS_FRAMES;
        if (this._state === 'opening') {
            this._alpha = Math.min(255, this._alpha + step);
            this._overlay.opacity         = Math.round(this._alpha);
            this._textWin.contentsOpacity = Math.round(this._alpha);
            if (this._alpha >= 255) { this._alpha = 255; this._state = 'open'; }
        } else if (this._state === 'closing') {
            this._alpha = Math.max(0, this._alpha - step);
            this._overlay.opacity         = Math.round(this._alpha);
            this._textWin.contentsOpacity = Math.round(this._alpha);
            if (this._alpha <= 0) {
                this._alpha = 0; this._state = 'closed';
                this._overlay.visible = false;
            }
        }

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
    // Scene_Map 확장
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
            if (tw && !tw.isChoiceActive() && !tw._isTyping) {
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
    // Window_Message 확장
    // =========================================================================

    // VN 모드에서 Window_Message 자체 입력을 차단 → VN 창이 직접 pause 해제
    var _WM_isTriggered = Window_Message.prototype.isTriggered;
    Window_Message.prototype.isTriggered = function () {
        if (VNManager.isActive()) return false;
        return _WM_isTriggered.call(this);
    };

    var _WM_startMessage = Window_Message.prototype.startMessage;
    Window_Message.prototype.startMessage = function () {
        if (VNManager.isActive()) {
            var spk = (typeof $gameMessage.speakerName === 'function')
                        ? ($gameMessage.speakerName() || '') : '';
            var txt = $gameMessage.allText();
            var s = SceneManager._scene;
            if (s && s._vnCtrl) {
                s._vnCtrl.startTyping(spk, txt);
                s._vnCtrl.cancelAutoExit();
            }
            // Window_Message는 즉시 처리 (화면 밖에 있으므로 안 보임)
            this._showFast = true;
        }
        _WM_startMessage.call(this);
    };

    // VN 모드에서 Window_Message를 화면 밖으로
    var _WM_updatePlacement = Window_Message.prototype.updatePlacement;
    Window_Message.prototype.updatePlacement = function () {
        _WM_updatePlacement.call(this);
        if (VNManager.isActive()) this.y = Graphics.boxHeight + 200;
    };

    // 메시지 종료 후 자동 탈출 스케줄
    var _WM_terminateMessage = Window_Message.prototype.terminateMessage;
    Window_Message.prototype.terminateMessage = function () {
        _WM_terminateMessage.call(this);
        if (!VNManager.isActive()) return;
        if ($gameMessage.isChoice() || $gameMessage.isNumberInput() || $gameMessage.isItemChoice()) return;
        if (!$gameMessage.isBusy()) {
            var s = SceneManager._scene;
            if (s && s._vnCtrl) {
                var tw = s._vnCtrl.getTextWindow();
                // 타이핑이 끝난 후에 자동 탈출 스케줄
                if (tw && !tw._isTyping) {
                    s._vnCtrl.scheduleAutoExit();
                } else if (tw) {
                    // 타이핑 완료 후 자동 탈출 예약
                    tw._pendingAutoExit = true;
                }
            }
        }
    };

    // 타이핑 완료 감지 → 자동 탈출
    var _origSkipTyping = Window_VNText.prototype.skipTyping;
    Window_VNText.prototype.skipTyping = function () {
        _origSkipTyping.call(this);
        this._checkPendingAutoExit();
    };

    // _isTyping이 false가 된 후 pendingAutoExit 처리
    Window_VNText.prototype._checkPendingAutoExit = function () {
        if (!this._pendingAutoExit) return;
        this._pendingAutoExit = false;
        var s = SceneManager._scene;
        if (s && s._vnCtrl && VNManager.isActive()) {
            s._vnCtrl.scheduleAutoExit();
        }
    };

    // update에서 타이핑 완료 시점에도 체크
    var _origUpdate = Window_VNText.prototype.update;
    Window_VNText.prototype.update = function () {
        var wasTying = this._isTyping;
        _origUpdate.call(this);
        if (wasTying && !this._isTyping) {
            this._checkPendingAutoExit();
        }
    };

    // 선택지 시작 전 자동 탈출 취소
    var _WM_startInput = Window_Message.prototype.startInput;
    Window_Message.prototype.startInput = function () {
        if (VNManager.isActive()) {
            var s = SceneManager._scene;
            if (s && s._vnCtrl) s._vnCtrl.cancelAutoExit();
        }
        return _WM_startInput.call(this);
    };

    // =========================================================================
    // Window_ChoiceList 분기
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
        var s  = SceneManager._scene;
        var tw = s && s._vnCtrl ? s._vnCtrl.getTextWindow() : null;
        if (!tw) { this._vnInline = false; _WCL_start.call(this); return; }

        var choices   = $gameMessage.choices();
        var defIdx    = $gameMessage.choiceDefaultType();
        var cancelIdx = $gameMessage.choiceCancelType();

        tw.addChoiceEntry(choices, defIdx >= 0 ? defIdx : 0, cancelIdx);
        this._vnTextWin = tw;

        // 화면 밖으로 이동하되 active/open 유지 → isAnySubWindowActive()=true → Window_Message 대기
        this.x = -9999;
        this.y = -9999;
        this.activate();
        this.open();
        this.select(defIdx >= 0 ? defIdx : 0);
    };

    var _WCL_update = Window_ChoiceList.prototype.update;
    Window_ChoiceList.prototype.update = function () {
        if (this._vnInline) { this._updateVNInline(); return; }
        _WCL_update.call(this);
    };

    Window_ChoiceList.prototype._updateVNInline = function () {
        Window_Base.prototype.update.call(this);
        var tw = this._vnTextWin;
        if (!tw || tw.isChoiceActive()) return;  // 아직 선택 중

        // 선택 완료
        var result = tw.getChoiceResult();
        if (result < 0) result = 0;

        // TextLog에 선택 기록
        var entries = tw._entries;
        var lastLog = entries[entries.length - 1];
        if (lastLog && lastLog._choiceLog) {
            if (typeof TextLogManager !== 'undefined') {
                TextLogManager.add({ spk: '[선택]', txt: lastLog._choiceLog, fn: '', fi: 0, bg: 0, lc: 1 });
            }
        }

        $gameMessage.onChoice(result);
        this.deactivate();
        this.close();
        this._messageWindow.terminateMessage();
        this._vnInline  = false;
        this._vnTextWin = null;

        if (VNManager.isActive() && !$gameMessage.isBusy()) {
            var s = SceneManager._scene;
            if (s && s._vnCtrl) s._vnCtrl.scheduleAutoExit();
        }
    };

    // =========================================================================
    // 기본 선택지 방식일 때 선택 결과 로그+VN창 기록
    // =========================================================================
    var _GM_onChoice = Game_Message.prototype.onChoice;
    Game_Message.prototype.onChoice = function (n) {
        if (VNManager.isActive() && VNManager.getChoiceStyle() === 'default') {
            var choices = this._choices || [];
            var chosen  = (n >= 0 && n < choices.length) ? choices[n] : ('선택 ' + n);
            if (typeof TextLogManager !== 'undefined') {
                TextLogManager.add({ spk: '[선택]', txt: chosen, fn: '', fi: 0, bg: 0, lc: 1 });
            }
            var s = SceneManager._scene;
            if (s && s._vnCtrl) s._vnCtrl.getTextWindow().addEntry('[선택]', '  ' + CHOICE_IND + ' ' + chosen);
        }
        _GM_onChoice.call(this, n);
    };

})();
