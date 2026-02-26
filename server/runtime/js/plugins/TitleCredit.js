/*:
 * @pluginname 타이틀 크레딧
 * @plugindesc 타이틀 화면에 Credit 버튼 추가
 * @author gosuni2025
 *
 * @param textFile
 * @text 크레딧 파일 경로
 * @desc 프로젝트 루트 기준 크레딧 텍스트 파일의 상대 경로
 * @type textfile
 * @default data/Credits.txt
 *
 * @help
 * 타이틀 화면에 "크레딧" 버튼을 추가합니다.
 * 사용된 에셋의 저작권/라이선스 정보를 표시합니다.
 *
 * textFile 파라미터에 지정한 파일에서 크레딧 내용을 읽어 표시합니다.
 * 기본값: data/Credits.txt
 *
 * 파일 형식:
 *   [섹션명]          → 시스템 색상으로 표시
 *   - 타이틀 -        → 시스템 색상, 중앙 정렬
 *   @link URL          → 파란색 링크 (결정 버튼으로 브라우저 열기)
 *   @link URL 표시텍스트 → URL을 숨기고 표시텍스트만 표시
 *   @license 텍스트    → 초록색으로 표시
 *   빈 줄              → 간격 추가
 *   일반 텍스트        → 기본 색상으로 표시
 *
 * 조작:
 *   ↑↓ 방향키 : 줄 이동
 *   결정 (Z/Enter) : 링크 열기 (링크 줄에서만)
 *   취소 (X/Esc)   : 돌아가기
 *   터치 드래그    : 스크롤
 *   터치 탭        : 링크 열기 / 커서 이동
 */

(function() {

    var _parameters = PluginManager.parameters('TitleCredit');
    var _creditTextFile = (_parameters['textFile'] || 'data/Credits.txt').trim();

    function openURL(url) {
        try {
            require('nw.gui').Shell.openExternal(url);
        } catch (e) {
            window.open(url, '_blank');
        }
    }

    //=========================================================================
    // Window_TitleCommand - "크레딧" 커맨드 추가
    //=========================================================================

    var _orig_makeCommandList = Window_TitleCommand.prototype.makeCommandList;
    Window_TitleCommand.prototype.makeCommandList = function() {
        _orig_makeCommandList.call(this);
        this.addCommand('크레딧', 'credit');
    };

    //=========================================================================
    // Scene_Title - Credit 핸들러 등록
    //=========================================================================

    var _orig_createCommandWindow = Scene_Title.prototype.createCommandWindow;
    Scene_Title.prototype.createCommandWindow = function() {
        _orig_createCommandWindow.call(this);
        this._commandWindow.setHandler('credit', this.commandCredit.bind(this));
    };

    Scene_Title.prototype.commandCredit = function() {
        this._commandWindow.close();
        SceneManager.push(Scene_Credit);
    };

    //=========================================================================
    // Scene_Credit - 크레딧 화면
    //=========================================================================

    function Scene_Credit() {
        this.initialize.apply(this, arguments);
    }

    Scene_Credit.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_Credit.prototype.constructor = Scene_Credit;

    Scene_Credit.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);
    };

    Scene_Credit.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        this._creditWindow = new Window_Credit();
        this.addWindow(this._creditWindow);
        this._setupTouchHandlers();
    };

    Scene_Credit.prototype.terminate = function() {
        Scene_MenuBase.prototype.terminate.call(this);
        this._removeTouchHandlers();
    };

    Scene_Credit.prototype._setupTouchHandlers = function() {
        var self = this;
        var canvas = document.getElementById('GameCanvas') || document.querySelector('canvas');
        if (!canvas) return;
        this._touchCanvas = canvas;
        this._onTouchStart = function(e) { self._handleTouchStart(e); };
        this._onTouchMove  = function(e) { self._handleTouchMove(e); };
        this._onTouchEnd   = function(e) { self._handleTouchEnd(e); };
        canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
        canvas.addEventListener('touchmove',  this._onTouchMove,  { passive: false });
        canvas.addEventListener('touchend',   this._onTouchEnd,   { passive: false });
    };

    Scene_Credit.prototype._removeTouchHandlers = function() {
        var canvas = this._touchCanvas;
        if (!canvas) return;
        canvas.removeEventListener('touchstart', this._onTouchStart);
        canvas.removeEventListener('touchmove',  this._onTouchMove);
        canvas.removeEventListener('touchend',   this._onTouchEnd);
    };

    // 터치 좌표 → 게임 캔버스 좌표 변환
    Scene_Credit.prototype._touchToCanvas = function(touch) {
        var canvas = this._touchCanvas;
        var rect = canvas.getBoundingClientRect();
        var scaleX = Graphics.width  / rect.width;
        var scaleY = Graphics.height / rect.height;
        return {
            x: (touch.clientX - rect.left) * scaleX,
            y: (touch.clientY - rect.top)  * scaleY
        };
    };

    Scene_Credit.prototype._handleTouchStart = function(e) {
        var w = this._creditWindow;
        if (!w._loaded) return;
        e.preventDefault();
        var touch = e.touches[0];
        var pos = this._touchToCanvas(touch);
        this._touchStartY = pos.y;
        this._touchLastY  = pos.y;
        this._touchMoved  = false;
    };

    Scene_Credit.prototype._handleTouchMove = function(e) {
        var w = this._creditWindow;
        if (!w._loaded) return;
        e.preventDefault();
        var touch = e.touches[0];
        var pos = this._touchToCanvas(touch);
        var dy = pos.y - this._touchLastY;
        this._touchLastY = pos.y;

        if (Math.abs(pos.y - this._touchStartY) > 8) {
            this._touchMoved = true;
        }

        if (this._touchMoved) {
            var maxScroll = Math.max(0, w._footerY + w.lineHeight() - w.contentsHeight());
            w.origin.y = Math.max(0, Math.min(maxScroll, w.origin.y - dy));
            w.refresh();
        }
    };

    Scene_Credit.prototype._handleTouchEnd = function(e) {
        var w = this._creditWindow;
        if (!w._loaded) return;
        e.preventDefault();
        if (!this._touchMoved) {
            var touch = e.changedTouches[0];
            var pos = this._touchToCanvas(touch);
            this._handleTap(pos.x, pos.y);
        }
    };

    // 탭: 링크면 URL 열기, 일반 줄이면 커서 이동
    Scene_Credit.prototype._handleTap = function(cx, cy) {
        var w = this._creditWindow;
        if (cx < w.x || cx > w.x + w.width || cy < w.y || cy > w.y + w.height) return;
        var contentY = cy - w.y - w.padding + w.origin.y;
        var lh = w.lineHeight();
        var data = w._lineData;
        for (var i = 0; i < data.length; i++) {
            if (contentY >= data[i].y && contentY < data[i].y + lh) {
                if (data[i].type === 'link') {
                    w._cursorIndex = i;
                    w.refresh();
                    SoundManager.playOk();
                    openURL(data[i].url);
                } else {
                    w._cursorIndex = i;
                    SoundManager.playCursor();
                    w.refresh();
                }
                return;
            }
        }
    };

    Scene_Credit.prototype.update = function() {
        Scene_MenuBase.prototype.update.call(this);
        var w = this._creditWindow;
        if (!w._loaded) return;

        if (Input.isTriggered('cancel') || TouchInput.isCancelled()) {
            SoundManager.playCancel();
            SceneManager.pop();
            return;
        }

        if (Input.isRepeated('down')) {
            w.moveCursorDown();
        } else if (Input.isRepeated('up')) {
            w.moveCursorUp();
        }

        if (Input.isTriggered('ok')) {
            w.activateCurrentLink();
        }
    };

    //=========================================================================
    // Window_Credit - 크레딧 내용 표시 (커서 이동 + 링크 열기)
    //=========================================================================

    function Window_Credit() {
        this.initialize.apply(this, arguments);
    }

    Window_Credit.prototype = Object.create(Window_Base.prototype);
    Window_Credit.prototype.constructor = Window_Credit;

    Window_Credit.prototype.initialize = function() {
        var width = Graphics.boxWidth - 100;
        var height = Graphics.boxHeight - 100;
        var x = (Graphics.boxWidth - width) / 2;
        var y = (Graphics.boxHeight - height) / 2;
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this._loaded = false;
        this._lineData = [];   // [{y, type, text, url}, ...]
        this._cursorIndex = 0;
        this._footerY = 0;
        this.loadCredits();
    };

    Window_Credit.prototype.loadCredits = function() {
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', _creditTextFile);
        xhr.overrideMimeType('text/plain; charset=utf-8');
        xhr.onload = function() {
            self._init(xhr.status < 400 ? xhr.responseText : '');
        };
        xhr.onerror = function() { self._init(''); };
        xhr.send();
    };

    Window_Credit.prototype._init = function(text) {
        this._parseText(text);
        this._loaded = true;
        this.refresh();
    };

    // 텍스트를 줄 데이터 배열로 파싱
    // 빈 줄은 y 오프셋만 증가 (커서 이동 대상에서 제외)
    Window_Credit.prototype._parseText = function(text) {
        var lh = this.lineHeight();
        var lines = text ? text.split('\n') : [];
        var data = [];
        var y = 0;
        var m;

        for (var i = 0; i < lines.length; i++) {
            var raw = lines[i];

            if (raw.trim() === '') {
                y += Math.floor(lh / 2);
                continue;
            }

            var entry = { y: y, type: 'text', text: raw, url: '' };

            if (/^-\s+.+\s+-$/.test(raw.trim())) {
                entry.type = 'title';
                entry.text = raw.trim();
            } else if (/^\[.+\]$/.test(raw.trim())) {
                entry.type = 'section';
                entry.text = raw.trim();
            } else if ((m = raw.match(/^@link\s+(\S+)(?:\s+(.+))?/))) {
                entry.type = 'link';
                entry.url  = m[1].trim();
                entry.text = m[2] ? m[2].trim() : m[1].trim();
            } else if ((m = raw.match(/^@license\s+(.+)/))) {
                entry.type = 'license';
                entry.text = 'License: ' + m[1].trim();
            }

            data.push(entry);
            y += lh;
        }

        this._lineData = data;
        this._footerY  = y + Math.floor(lh / 2);
    };

    Window_Credit.prototype.refresh = function() {
        this.contents.clear();
        var lh = this.lineHeight();
        var cw = this.contentsWidth();
        var data = this._lineData;

        if (!data.length) {
            this.resetTextColor();
            this.drawText('크레딧 정보가 없습니다.', 0, 0, cw, 'center');
            this.changeTextColor(this.textColor(8));
            this.drawText('취소 버튼으로 돌아가기', 0, lh * 2, cw, 'center');
            return;
        }

        for (var i = 0; i < data.length; i++) {
            var line      = data[i];
            var isCursor  = (i === this._cursorIndex);
            var isLink    = (line.type === 'link');

            // 커서 배경 하이라이트
            if (isCursor) {
                var bg = isLink
                    ? 'rgba(20, 80, 220, 0.45)'
                    : 'rgba(255, 255, 255, 0.10)';
                this.contents.fillRect(0, line.y, cw, lh, bg);
            }

            // 커서 마커 (링크: ▶ 파란색, 일반: ▷ 흰색)
            var prefix = isCursor ? (isLink ? '▶ ' : '▷ ') : '';

            switch (line.type) {
                case 'title':
                    this.changeTextColor(this.systemColor());
                    this.drawText(line.text, 0, line.y, cw, 'center');
                    break;
                case 'section':
                    this.changeTextColor(this.systemColor());
                    this.drawText(prefix + line.text, 0, line.y, cw);
                    break;
                case 'link':
                    // 선택 중: textColor(6) = 밝은 파란색, 비선택: textColor(4) = 파란색
                    this.changeTextColor(isCursor ? this.textColor(6) : this.textColor(4));
                    this.drawText(prefix + line.text, 0, line.y, cw);
                    break;
                case 'license':
                    this.changeTextColor(this.textColor(3));
                    this.drawText(prefix + line.text, 0, line.y, cw);
                    break;
                default:
                    this.resetTextColor();
                    this.drawText(prefix + line.text, 0, line.y, cw);
            }
        }

        // 조작 안내 (커서 이동 범위 밖)
        this.changeTextColor(this.textColor(8));
        this.drawText('↑↓/드래그: 이동   결정/탭: 링크 열기   취소: 뒤로', 0, this._footerY, cw, 'center');
    };

    Window_Credit.prototype.moveCursorDown = function() {
        if (this._cursorIndex < this._lineData.length - 1) {
            this._cursorIndex++;
            SoundManager.playCursor();
            this._updateScroll();
            this.refresh();
        }
    };

    Window_Credit.prototype.moveCursorUp = function() {
        if (this._cursorIndex > 0) {
            this._cursorIndex--;
            SoundManager.playCursor();
            this._updateScroll();
            this.refresh();
        }
    };

    // 커서가 창 밖으로 나가면 스크롤 조정
    Window_Credit.prototype._updateScroll = function() {
        var line = this._lineData[this._cursorIndex];
        if (!line) return;
        var lh   = this.lineHeight();
        var visH = this.contentsHeight();

        if (line.y < this.origin.y) {
            this.origin.y = line.y;
        } else if (line.y + lh > this.origin.y + visH) {
            this.origin.y = line.y + lh - visH;
        }
    };

    // 현재 커서가 링크 줄이면 URL 열기
    Window_Credit.prototype.activateCurrentLink = function() {
        var line = this._lineData[this._cursorIndex];
        if (line && line.type === 'link' && line.url) {
            SoundManager.playOk();
            openURL(line.url);
        }
    };

    window.Scene_Credit = Scene_Credit;

})();
