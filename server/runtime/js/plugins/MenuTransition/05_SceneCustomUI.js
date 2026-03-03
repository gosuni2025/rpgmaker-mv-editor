    // ── Scene_CustomUI 오버라이드 ─────────────────────────────────────────────

    if (typeof Scene_CustomUI !== 'undefined') {
        var _SCU_create = Scene_CustomUI.prototype.create;
        Scene_CustomUI.prototype.create = function () {
            _SCU_create.call(this);
            // Scene_OverlayUI는 맵 위에 떠있는 오버레이 — 전체화면 배경 스프라이트 불필요
            if (typeof Scene_OverlayUI !== 'undefined' && this instanceof Scene_OverlayUI) return;
            _setMenuBgHook(true);
            // Scene_MenuBase.createBackground()에 해당: 맨 아래에 배경 스프라이트 추가
            this._backgroundSprite = new Sprite();
            this._backgroundSprite.bitmap = SceneManager.backgroundBitmap();
            this.addChildAt(this._backgroundSprite, 0);
        };

        var _SCU_update = Scene_CustomUI.prototype.update;
        Scene_CustomUI.prototype.update = function () {
            _SCU_update.call(this);

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

        var _SCU_terminate = Scene_CustomUI.prototype.terminate;
        Scene_CustomUI.prototype.terminate = function () {
            _SCU_terminate.call(this);
            _setMenuBgHook(false);
            _bgBitmap  = null;
            _bgBlurT   = 0;
            _bgBlurDir = 0;
            _phase     = 0;
            _srcCanvas = null;
        };

        var _SCU_startFadeIn = Scene_CustomUI.prototype.startFadeIn;
        Scene_CustomUI.prototype.startFadeIn = function (duration, white) {
            if (_bgBlurDir === 1) {
                _SCU_startFadeIn.call(this, Cfg.duration, white);
                return;
            }
            _SCU_startFadeIn.call(this, duration, white);
        };

        var _SCU_startFadeOut = Scene_CustomUI.prototype.startFadeOut;
        Scene_CustomUI.prototype.startFadeOut = function (duration, white) {
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
            _SCU_startFadeOut.call(this, duration, white);
        };
    }

    // ── 닫기 애니메이션 공통 트리거 ──────────────────────────────────────────

    function _triggerCloseAnim() {
        var isMenuScene = SceneManager._scene instanceof Scene_MenuBase ||
            _isCustomUIInstance(SceneManager._scene);
        if (isMenuScene && _phase !== 0) {
            _bgBlurStartT        = _bgBlurT;
            _suppressMenuFadeOut = true;
            _suppressGameFadeIn  = true;
            _bgBlurDir           = -1;
            _bgElapsed           = 0;
            _phase               = 0;
        }
    }

    // ── SceneManager.pop: 닫기 애니메이션 트리거 ─────────────────────────────

    if (Cfg.closeAnim) {
        var _origPop = SceneManager.pop;
        SceneManager.pop = function () {
            _triggerCloseAnim();
            _origPop.call(this);
        };

        // ── SceneManager.goto: 커스텀/메뉴 씬에서 goto로 빠져나갈 때도 처리 ──
        var _origGoto = SceneManager.goto;
        SceneManager.goto = function (sceneClass) {
            _triggerCloseAnim();
            _origGoto.call(this, sceneClass);
        };
    }

    // ── PostProcess composer 재생성 훅 ────────────────────────────────────────

    if (typeof PostProcess !== 'undefined') {
        if (PostProcess._createComposer) {
            var _origCreateComposer = PostProcess._createComposer;
            PostProcess._createComposer = function () {
                _origCreateComposer.apply(this, arguments);
                _clearEffect();
            };
        }
        if (PostProcess._createComposer2D) {
            var _origCreateComposer2D = PostProcess._createComposer2D;
            PostProcess._createComposer2D = function () {
                _origCreateComposer2D.apply(this, arguments);
                _clearEffect();
            };
        }
    }

