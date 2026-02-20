/*:
 * @plugindesc [v1.1] 텍스트 로그 - 메시지 대사 기록을 스크롤하며 볼 수 있는 창
 * @author RPG Maker MV Web Editor
 *
 * @param menuName
 * @text 메뉴 이름
 * @type string
 * @desc 메인 메뉴에 표시될 이름
 * @default 텍스트 로그
 *
 * @param maxLines
 * @text 최대 라인 수
 * @type number
 * @min 50
 * @max 5000
 * @desc 이 수를 초과하면 오래된 로그가 삭제됩니다.
 * @default 300
 *
 * @param entryGap
 * @text 항목 간격
 * @type number
 * @min 0
 * @max 30
 * @desc 로그 항목 사이의 여백 (픽셀)
 * @default 6
 *
 * @param showFace
 * @text 얼굴 이미지 표시
 * @type boolean
 * @on 표시
 * @off 숨김
 * @desc 로그에 캐릭터 얼굴 이미지를 표시합니다.
 * @default true
 *
 * @param faceSize
 * @text 얼굴 이미지 크기
 * @type number
 * @min 32
 * @max 144
 * @desc 로그에 표시되는 얼굴 이미지 크기 (픽셀, 원본 144px 기준으로 축소)
 * @default 100
 *
 * @param bgOpacity
 * @text 항목 배경 불투명도
 * @type number
 * @min 0
 * @max 255
 * @desc 각 로그 항목 배경 박스 불투명도 (0=완전투명, 255=완전불투명)
 * @default 160
 *
 * @param scrollSpeed
 * @text 마우스 휠 속도
 * @type number
 * @min 1
 * @max 20
 * @desc 마우스 휠 스크롤 배율
 * @default 4
 *
 * @help
 * ============================================================================
 * 텍스트 로그 플러그인 v1.0
 * ============================================================================
 * 게임 내 메시지 창의 대사를 자동으로 기록하여 다시 볼 수 있습니다.
 *
 * [접근 방법]
 * - 메인 메뉴에서 "텍스트 로그" 항목 선택
 *
 * [스크롤 조작]
 * - 마우스 휠
 * - 터치 드래그
 * - ↑ / ↓ 방향키 (라인 단위)
 * - PageUp / PageDown (페이지 단위)
 *
 * [닫기]
 * - ESC 키 또는 오른쪽 클릭
 *
 * [저장/불러오기]
 * - 로그 기록은 세이브 파일에 자동으로 저장/복원됩니다.
 * - 새 게임 시작 시 로그가 초기화됩니다.
 * ============================================================================
 */

(function () {
    'use strict';

    var params      = PluginManager.parameters('TextLog');
    var MENU_NAME   = String(params['menuName']   || '텍스트 로그');
    var MAX_LINES   = parseInt(params['maxLines'])   || 300;
    var ENTRY_GAP   = parseInt(params['entryGap'])   || 6;
    var SHOW_FACE   = String(params['showFace'])  !== 'false';
    var FACE_SIZE   = parseInt(params['faceSize'])   || 100;
    var BG_OPACITY  = parseInt(params['bgOpacity'])  || 160;
    var SCROLL_SPEED = parseInt(params['scrollSpeed']) || 4;

    var ENTRY_PAD = 10;  // 항목 내부 패딩
    var TITLE_H   = 40;  // 창 내부 제목 영역 높이

    // =========================================================================
    // TextLogManager — 로그 데이터 관리
    // =========================================================================
    var TextLogManager = {
        _list: [],
        _lineSum: 0,

        // 항목 추가 (최대 라인 초과 시 오래된 것 삭제)
        add: function (entry) {
            this._list.push(entry);
            this._lineSum += entry.lc;
            while (this._lineSum > MAX_LINES && this._list.length > 1) {
                this._lineSum -= this._list.shift().lc;
            }
        },

        list:  function () { return this._list; },
        clear: function () { this._list = []; this._lineSum = 0; },

        save: function () {
            return { list: this._list, sum: this._lineSum };
        },
        load: function (d) {
            if (d) { this._list = d.list || []; this._lineSum = d.sum || 0; }
        }
    };

    // =========================================================================
    // 세이브/로드 통합
    // =========================================================================
    var _makeSave = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function () {
        var c = _makeSave.call(this);
        c._textLog = TextLogManager.save();
        return c;
    };

    var _extractSave = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function (c) {
        _extractSave.call(this, c);
        TextLogManager.load(c._textLog);
    };

    // 새 게임 시작 시 로그 초기화
    var _setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function () {
        _setupNewGame.call(this);
        TextLogManager.clear();
    };

    // =========================================================================
    // Window_Message 후킹 — 메시지 시작 시 로그에 기록
    // =========================================================================
    var _startMessage = Window_Message.prototype.startMessage;
    Window_Message.prototype.startMessage = function () {
        var txt = $gameMessage.allText();
        if (txt && txt.trim().length > 0) {
            // speakerName은 MV 1.6+ 또는 일부 플러그인에서만 존재
            var spk = (typeof $gameMessage.speakerName === 'function')
                        ? ($gameMessage.speakerName() || '') : '';
            var fn  = $gameMessage.faceName()   || '';
            var fi  = $gameMessage.faceIndex()  || 0;
            var bg  = $gameMessage.background() || 0;

            // 라인 수 추정 (이스케이프 코드 제거 후 줄 수)
            var stripped = txt
                .replace(/\x1b[A-Za-z]+\[[^\]]*\]/g, '')
                .replace(/\x1b./g, '');
            var lc = stripped.split('\n').length + (spk ? 1 : 0);

            TextLogManager.add({ spk: spk, txt: txt, fn: fn, fi: fi, bg: bg, lc: Math.max(lc, 1) });
        }
        _startMessage.call(this);
    };

    // =========================================================================
    // Window_TextLog — 가상 스크롤 로그 창
    // =========================================================================
    function Window_TextLog() { this.initialize.apply(this, arguments); }
    Window_TextLog.prototype = Object.create(Window_Base.prototype);
    Window_TextLog.prototype.constructor = Window_TextLog;

    Window_TextLog.prototype.initialize = function (x, y, w, h) {
        Window_Base.prototype.initialize.call(this, x, y, w, h);
        this._sy      = 0;      // 현재 스크롤 Y
        this._layouts = [];     // 각 항목의 { y, h }
        this._total   = 0;      // 전체 콘텐츠 높이
        this._vel     = 0;      // 드래그 관성 속도
        this.refresh();
    };

    // 창 내부 표시 가능 높이 (padding + 제목 영역 제외)
    Window_TextLog.prototype.innerH = function () {
        return this.height - this.standardPadding() * 2 - TITLE_H;
    };

    Window_TextLog.prototype.maxSY = function () {
        return Math.max(0, this._total - this.innerH());
    };

    // ── 항목 높이 계산 (calcTextHeight로 정확하게) ──────────────────────────
    Window_TextLog.prototype.entryH = function (e) {
        var hasFace = SHOW_FACE && e.fn;
        // escape code 변환 후 실제 줄 수를 calcTextHeight로 측정
        var converted  = this.convertEscapeCharacters(e.txt);
        var textState  = { index: 0, text: converted };
        var textH = this.calcTextHeight(textState, true);
        if (e.spk) textH += this.lineHeight();
        var height = textH + ENTRY_PAD * 2;
        if (hasFace) height = Math.max(height, FACE_SIZE + ENTRY_PAD * 2);
        return height;
    };

    // ── 레이아웃 빌드 (각 항목의 y 위치, h 계산) ────────────────────────────
    Window_TextLog.prototype.buildLayouts = function () {
        var list = TextLogManager.list();
        this._layouts = [];
        var y = ENTRY_GAP;
        for (var i = 0; i < list.length; i++) {
            var h = this.entryH(list[i]);
            this._layouts.push({ y: y, h: h });
            y += h + ENTRY_GAP;
        }
        this._total = y;
    };

    // ── 새로고침 (레이아웃 재계산 + 맨 아래로 스크롤) ───────────────────────
    Window_TextLog.prototype.refresh = function () {
        this.buildLayouts();
        this._sy = this.maxSY();
        this.redraw();
    };

    // ── 현재 스크롤 위치에 보이는 항목만 렌더링 ─────────────────────────────
    Window_TextLog.prototype.redraw = function () {
        if (!this.contents) return;
        this.contents.clear();

        // 제목 표시 (고정)
        this.changeTextColor(this.systemColor());
        this.drawText(MENU_NAME, 0, 0, this.contentsWidth(), 'center');
        this.resetTextColor();
        this.resetFontSettings();

        // 구분선
        var ctx = this.contents._context;
        if (ctx) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, TITLE_H - 6);
            ctx.lineTo(this.contentsWidth(), TITLE_H - 6);
            ctx.stroke();
            ctx.restore();
        }

        var list = TextLogManager.list();
        var top  = this._sy;
        var bot  = this._sy + this.innerH();

        for (var i = 0; i < this._layouts.length; i++) {
            var l = this._layouts[i];
            if (l.y + l.h > top && l.y < bot) {
                this.drawEntry(list[i], TITLE_H + l.y - this._sy, l.h);
            }
        }
        this.drawScrollBar();

        // ExtendedText가 drawTextEx 중 _etAnimSegs에 추가한 shake/hologram 세그먼트를 초기화.
        // 세그먼트는 그 시점의 y 좌표를 기억하므로, 스크롤 후 redraw하면 좌표가 달라져
        // 엉뚱한 위치에 흰 글자가 계속 흔들리며 남는 버그가 발생함.
        this._etAnimSegs  = [];
        this._etEffectStack = [];
    };

    // ── 스크롤바 ────────────────────────────────────────────────────────────
    Window_TextLog.prototype.drawScrollBar = function () {
        if (this._total <= this.innerH()) return;
        var bw   = 5;
        var bx   = this.contentsWidth() - bw - 1;
        var avail = this.innerH() - 8;
        var hh   = Math.max(24, avail * (this.innerH() / this._total));
        var ratio = this.maxSY() > 0 ? (this._sy / this.maxSY()) : 0;
        var hy   = TITLE_H + 4 + (avail - hh) * ratio;
        this.contents.fillRect(bx, TITLE_H + 4, bw, avail, 'rgba(255,255,255,0.1)');
        this.contents.fillRect(bx, hy,           bw, hh,    'rgba(255,255,255,0.55)');
    };

    // ── 항목 하나 렌더링 ─────────────────────────────────────────────────────
    Window_TextLog.prototype.drawEntry = function (e, dy, bh) {
        var w       = this.contentsWidth();
        var hasFace = SHOW_FACE && e.fn;

        // 배경 박스
        var alpha = BG_OPACITY / 255;
        this.contents.fillRect(0, dy, w, bh, 'rgba(0,0,0,' + (alpha * 0.85).toFixed(3) + ')');

        // 테두리 (canvas context 직접 접근)
        var ctx = this.contents._context;
        if (ctx) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth   = 1;
            ctx.strokeRect(0.5, dy + 0.5, w - 1, bh - 1);
            ctx.restore();
        }

        var tx = ENTRY_PAD;
        var tw = w - ENTRY_PAD * 2;

        if (hasFace) {
            var fy = dy + Math.floor((bh - FACE_SIZE) / 2);
            this.drawFace(e.fn, e.fi, tx, fy, FACE_SIZE, FACE_SIZE);
            tx += FACE_SIZE + 12;
            tw  = w - tx - ENTRY_PAD;
        }

        var cy = dy + ENTRY_PAD;

        // 화자 이름
        if (e.spk) {
            this.changeTextColor(this.systemColor());
            this.drawText(e.spk, tx, cy, tw);
            this.resetTextColor();
            cy += this.lineHeight();
        }

        // 대사 텍스트 (escape code 포함 렌더링)
        this.drawTextEx(e.txt, tx, cy);
        this.resetFontSettings();
    };

    // ── update ──────────────────────────────────────────────────────────────
    Window_TextLog.prototype.update = function () {
        // ExtendedText.update가 _etAnimSegs 좌표로 그리기 전에 미리 비워서
        // 로그 창에서 shake/hologram 애니메이션이 잘못된 위치에 그려지지 않도록 억제
        this._etAnimSegs    = [];
        this._etEffectStack = [];
        Window_Base.prototype.update.call(this);
        this._handleKeyScroll();
        this._handleInertia();
    };

    Window_TextLog.prototype._handleKeyScroll = function () {
        var lh   = this.lineHeight();
        var ph   = Math.floor(this.innerH() * 0.9);
        var max  = this.maxSY();
        var prev = this._sy;
        if (Input.isRepeated('up'))        this._sy -= lh;
        if (Input.isRepeated('down'))      this._sy += lh;
        if (Input.isTriggered('pageup'))   this._sy -= ph;
        if (Input.isTriggered('pagedown')) this._sy += ph;
        this._sy = Math.max(0, Math.min(this._sy, max));
        if (this._sy !== prev) this.redraw();
    };

    Window_TextLog.prototype._handleInertia = function () {
        if (Math.abs(this._vel) < 0.5) { this._vel = 0; return; }
        var prev = this._sy;
        this._sy = Math.max(0, Math.min(this._sy + this._vel, this.maxSY()));
        this._vel *= 0.88;
        if (this._sy !== prev) this.redraw();
        if (this._sy <= 0 || this._sy >= this.maxSY()) this._vel = 0;
    };

    // Scene에서 휠/드래그 값을 주입하는 인터페이스
    Window_TextLog.prototype.scrollBy = function (dy) {
        var prev = this._sy;
        this._sy = Math.max(0, Math.min(this._sy + dy, this.maxSY()));
        if (this._sy !== prev) this.redraw();
    };

    // =========================================================================
    // Scene_TextLog — 전체 화면 로그 씬
    // =========================================================================
    function Scene_TextLog() { this.initialize.apply(this, arguments); }
    Scene_TextLog.prototype = Object.create(Scene_Base.prototype);
    Scene_TextLog.prototype.constructor = Scene_TextLog;

    Scene_TextLog.prototype.initialize = function () {
        Scene_Base.prototype.initialize.call(this);
        this._touchPrevY = null;
        this._wheelHandler = null;
    };

    Scene_TextLog.prototype.create = function () {
        Scene_Base.prototype.create.call(this);
        this._createBackground();
        this.createWindowLayer();
        this._createWindows();
    };

    // window 이벤트로 직접 휠을 받아야 함
    // (TouchCameraControl.js가 3D 모드에서 TouchInput.wheelY를 소비하기 때문)
    Scene_TextLog.prototype.start = function () {
        Scene_Base.prototype.start.call(this);
        var self = this;
        this._wheelHandler = function (event) {
            event.preventDefault();
            if (self._log) {
                self._log.scrollBy(event.deltaY * 0.5);
                self._log._vel = 0;
            }
        };
        window.addEventListener('wheel', this._wheelHandler, { passive: false });
    };

    Scene_TextLog.prototype.terminate = function () {
        Scene_Base.prototype.terminate.call(this);
        if (this._wheelHandler) {
            window.removeEventListener('wheel', this._wheelHandler);
            this._wheelHandler = null;
        }
    };

    Scene_TextLog.prototype._createBackground = function () {
        // 직전 씬 스냅샷
        var bg = new Sprite(SceneManager.backgroundBitmap());
        this.addChild(bg);
        // 반투명 오버레이
        var dim = new Sprite(new Bitmap(Graphics.boxWidth, Graphics.boxHeight));
        dim.bitmap.fillAll('rgba(0,0,0,0.55)');
        this.addChild(dim);
    };

    Scene_TextLog.prototype._createWindows = function () {
        var mg = 16;
        var bw = Graphics.boxWidth;
        var bh = Graphics.boxHeight;

        // 창 하나로 통합 (제목은 창 내부 상단에 고정 표시)
        this._log = new Window_TextLog(
            mg,
            mg,
            bw - mg * 2,
            bh - mg * 2
        );
        this.addWindow(this._log);
    };

    Scene_TextLog.prototype.update = function () {
        Scene_Base.prototype.update.call(this);
        this._processDragScroll();

        if (this.isActive() && (Input.isTriggered('cancel') || TouchInput.isCancelled())) {
            SoundManager.playCancel();
            this.popScene();
        }
    };

    Scene_TextLog.prototype._processDragScroll = function () {
        if (TouchInput.isPressed()) {
            if (this._touchPrevY !== null) {
                var dy = this._touchPrevY - TouchInput.y;
                if (dy !== 0) {
                    this._log.scrollBy(dy);
                    this._log._vel = dy;
                }
            }
            this._touchPrevY = TouchInput.y;
        } else {
            this._touchPrevY = null;
        }
    };

    // =========================================================================
    // Scene_Menu 통합 — 메뉴에 "텍스트 로그" 항목 추가
    // =========================================================================
    var _addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
    Window_MenuCommand.prototype.addOriginalCommands = function () {
        _addOriginalCommands.call(this);
        this.addCommand(MENU_NAME, 'textLog', true);
    };

    var _createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function () {
        _createCommandWindow.call(this);
        this._commandWindow.setHandler('textLog', this.commandTextLog.bind(this));
    };

    Scene_Menu.prototype.commandTextLog = function () {
        SceneManager.push(Scene_TextLog);
    };

})();
