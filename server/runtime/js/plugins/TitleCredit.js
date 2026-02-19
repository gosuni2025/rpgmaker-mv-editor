/*:
 * @pluginname 타이틀 크레딧
 * @plugindesc 타이틀 화면에 Credit 버튼 추가
 * @author gosuni2025
 *
 * @param textFile
 * @text 크레딧 파일 경로
 * @desc 프로젝트 루트 기준 크레딧 텍스트 파일의 상대 경로
 * @type string
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
 *   [섹션명]    → 시스템 색상으로 표시
 *   @link URL   → 파란색으로 표시
 *   @license 텍스트 → 초록색으로 표시
 *   빈 줄       → 간격 추가
 *   일반 텍스트  → 기본 색상으로 표시
 */

(function() {

    var _parameters = PluginManager.parameters('TitleCredit');
    var _creditTextFile = (_parameters['textFile'] || 'data/Credits.txt').trim();

    //=========================================================================
    // Window_TitleCommand - "크레딧" 커맨드 추가
    //=========================================================================

    var _Window_TitleCommand_makeCommandList = Window_TitleCommand.prototype.makeCommandList;
    Window_TitleCommand.prototype.makeCommandList = function() {
        _Window_TitleCommand_makeCommandList.call(this);
        this.addCommand('크레딧', 'credit');
    };

    //=========================================================================
    // Scene_Title - Credit 핸들러 등록
    //=========================================================================

    var _Scene_Title_createCommandWindow = Scene_Title.prototype.createCommandWindow;
    Scene_Title.prototype.createCommandWindow = function() {
        _Scene_Title_createCommandWindow.call(this);
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
        this.createCreditWindow();
    };

    Scene_Credit.prototype.createCreditWindow = function() {
        this._creditWindow = new Window_Credit();
        this.addWindow(this._creditWindow);
    };

    Scene_Credit.prototype.update = function() {
        Scene_MenuBase.prototype.update.call(this);
        if (Input.isTriggered('cancel') || TouchInput.isCancelled()) {
            SoundManager.playCancel();
            SceneManager.pop();
        }
        if (Input.isTriggered('ok') || TouchInput.isTriggered()) {
            if (this._creditWindow._touchCloseReady) {
                SoundManager.playCancel();
                SceneManager.pop();
            }
            this._creditWindow._touchCloseReady = true;
        }
    };

    //=========================================================================
    // Window_Credit - 크레딧 내용 표시
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
        this._touchCloseReady = false;
        this._creditText = null;
        this.loadCredits();
    };

    Window_Credit.prototype.loadCredits = function() {
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', _creditTextFile);
        xhr.overrideMimeType('text/plain; charset=utf-8');
        xhr.onload = function() {
            if (xhr.status < 400) {
                self._creditText = xhr.responseText;
            } else {
                self._creditText = '';
            }
            self.drawCredits();
        };
        xhr.onerror = function() {
            self._creditText = '';
            self.drawCredits();
        };
        xhr.send();
    };

    Window_Credit.prototype.drawCredits = function() {
        this.contents.clear();
        var text = this._creditText;
        if (text === null) return;

        if (!text) {
            this.resetTextColor();
            this.drawText('크레딧 정보가 없습니다.', 0, 0, this.contentsWidth(), 'center');
            return;
        }

        var lines = text.split('\n');
        var y = 0;
        var lineHeight = this.lineHeight();
        var contentWidth = this.contentsWidth();

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];

            if (line.trim() === '') {
                y += lineHeight / 2;
                continue;
            }

            // 타이틀 라인 (- 크레딧 - 같은 형식)
            if (/^-\s+.+\s+-$/.test(line.trim())) {
                this.changeTextColor(this.systemColor());
                this.drawText(line.trim(), 0, y, contentWidth, 'center');
                y += lineHeight;
                continue;
            }

            // [섹션명] → systemColor
            if (/^\[.+\]$/.test(line.trim())) {
                this.changeTextColor(this.systemColor());
                this.drawText(line.trim(), 0, y, contentWidth);
                y += lineHeight;
                continue;
            }

            // @link URL → 파란색
            var linkMatch = line.match(/^@link\s+(.+)/);
            if (linkMatch) {
                this.changeTextColor(this.textColor(4));
                this.drawText(linkMatch[1].trim(), 0, y, contentWidth);
                y += lineHeight;
                continue;
            }

            // @license 텍스트 → 초록색
            var licenseMatch = line.match(/^@license\s+(.+)/);
            if (licenseMatch) {
                this.changeTextColor(this.textColor(3));
                this.drawText('License: ' + licenseMatch[1].trim(), 0, y, contentWidth);
                y += lineHeight;
                continue;
            }

            // 일반 텍스트
            this.resetTextColor();
            this.drawText(line, 0, y, contentWidth);
            y += lineHeight;
        }

        // Footer
        y += lineHeight / 2;
        this.changeTextColor(this.textColor(8));
        this.drawText('아무 키나 눌러 돌아가기', 0, y, contentWidth, 'center');
    };

    window.Scene_Credit = Scene_Credit;

})();
