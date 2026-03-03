    // ── Scene_MenuBase 오버라이드 ─────────────────────────────────────────────

    var _SMB_create = Scene_MenuBase.prototype.create;
    Scene_MenuBase.prototype.create = function () {
        _SMB_create.call(this);
        _setMenuBgHook(true);
    };

    var _SMB_update = Scene_MenuBase.prototype.update;
    Scene_MenuBase.prototype.update = function () {
        _SMB_update.call(this);

        if (!_bgBitmap && this._backgroundSprite && this._backgroundSprite.bitmap) {
            _bgBitmap = this._backgroundSprite.bitmap;
            _drawBgBitmap(_bgBitmap, _bgBlurT);
        }

        if (_bgBlurDir !== 0 && _bgBitmap) {
            _bgElapsed++;
            var raw = Math.min(1, _bgElapsed / Cfg.duration);
            _bgBlurT = (_bgBlurDir === 1)
                ? applyEase(raw)
                : _bgBlurStartT * applyEase(1 - raw);
            _drawBgBitmap(_bgBitmap, _bgBlurT);
            if (raw >= 1) _bgBlurDir = 0;
        }
    };

    var _SMB_terminate = Scene_MenuBase.prototype.terminate;
    Scene_MenuBase.prototype.terminate = function () {
        _SMB_terminate.call(this);
        _setMenuBgHook(false);
        _bgBitmap  = null;
        _bgBlurT   = 0;
        _bgBlurDir = 0;
        _phase     = 0;
        _srcCanvas = null;
    };

    var _SMB_startFadeIn = Scene_MenuBase.prototype.startFadeIn;
    Scene_MenuBase.prototype.startFadeIn = function (duration, white) {
        if (_bgBlurDir === 1) {
            _SMB_startFadeIn.call(this, Cfg.duration, white);
            return;
        }
        _SMB_startFadeIn.call(this, duration, white);
    };

    var _SMB_startFadeOut = Scene_MenuBase.prototype.startFadeOut;
    Scene_MenuBase.prototype.startFadeOut = function (duration, white) {
        if (_suppressMenuFadeOut) {
            _suppressMenuFadeOut = false;
            // 닫기 애니메이션 중: 화면을 검게 하지 않고 씬을 Cfg.duration 프레임 동안 유지
            // alpha=0 + fadeSign=1 → updateFade가 alpha를 0으로 유지 (검은 오버레이 없음)
            this.createFadeSprite(white);
            this._fadeSprite.alpha = 0;
            this._fadeDuration = Cfg.duration;
            this._fadeSign = 1;
            return;
        }
        _SMB_startFadeOut.call(this, duration, white);
    };

