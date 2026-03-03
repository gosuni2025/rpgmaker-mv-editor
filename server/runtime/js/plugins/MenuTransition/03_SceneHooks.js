    // ── 커스텀 씬 감지 헬퍼 ──────────────────────────────────────────────────

    function _isCustomUIClass(sceneClass) {
        return typeof Scene_CustomUI !== 'undefined' &&
            typeof sceneClass === 'function' &&
            (sceneClass === Scene_CustomUI || sceneClass.prototype instanceof Scene_CustomUI);
    }

    function _isCustomUIInstance(scene) {
        return typeof Scene_CustomUI !== 'undefined' && scene instanceof Scene_CustomUI;
    }

    // ── SceneManager.snapForBackground ────────────────────────────────────────

    var _origSnapForBg = SceneManager.snapForBackground;
    SceneManager.snapForBackground = function () {
        _origSnapForBg.call(this);

        var cap = _hasPostProcess() ? PostProcess._captureCanvas : null;
        if (cap && cap.width > 0) {
            var copy = document.createElement('canvas');
            copy.width  = cap.width;
            copy.height = cap.height;
            copy.getContext('2d').drawImage(cap, 0, 0);
            _srcCanvas = copy;
        } else if (!cap) {
            // PostProcess 없는 경우 폴백: SceneManager._backgroundBitmap 캔버스 사용
            var bgBmp = SceneManager._backgroundBitmap;
            if (bgBmp && bgBmp._canvas && bgBmp.width > 0) {
                var copy2 = document.createElement('canvas');
                copy2.width  = bgBmp.width;
                copy2.height = bgBmp.height;
                copy2.getContext('2d').drawImage(bgBmp._canvas, 0, 0);
                _srcCanvas = copy2;
            }
        }
        _clearEffect();
    };

    // ── SceneManager.push 가로채기 ────────────────────────────────────────────

    var _origPush = SceneManager.push;
    SceneManager.push = function (sceneClass) {
        var isMenu = typeof sceneClass === 'function' &&
            (sceneClass === Scene_MenuBase || sceneClass.prototype instanceof Scene_MenuBase ||
             _isCustomUIClass(sceneClass));

        if (isMenu && _phase === 0) {
            _phase               = 2;
            _bgBlurT             = 0;
            _bgBlurDir           = 1;
            _bgElapsed           = 0;
            _bgBitmap            = null;
            _suppressGameFadeOut = true;

            var sc = SceneManager._scene;
            if (sc && sc.menuCalling !== undefined) sc.menuCalling = false;

            _origPush.call(this, sceneClass);
            return;
        }

        _origPush.call(this, sceneClass);
    };

    // ── Scene_Base 페이드 억제 ────────────────────────────────────────────────

    var _SB_startFadeOut = Scene_Base.prototype.startFadeOut;
    Scene_Base.prototype.startFadeOut = function (duration, white) {
        if (_suppressGameFadeOut &&
                !(this instanceof Scene_MenuBase) && !_isCustomUIInstance(this)) {
            _suppressGameFadeOut = false;
            return;
        }
        _SB_startFadeOut.call(this, duration, white);
    };

    var _SB_startFadeIn = Scene_Base.prototype.startFadeIn;
    Scene_Base.prototype.startFadeIn = function (duration, white) {
        if (_suppressGameFadeIn &&
                !(this instanceof Scene_MenuBase) && !_isCustomUIInstance(this)) {
            _suppressGameFadeIn = false;
            return;
        }
        _SB_startFadeIn.call(this, duration, white);
    };

