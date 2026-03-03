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

