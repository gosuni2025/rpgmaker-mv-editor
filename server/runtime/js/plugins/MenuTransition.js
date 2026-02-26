/*:
 * @plugindesc [MenuTransition] 메뉴/UI 씬 배경 전환 효과 (PostProcess 셰이더)
 * @author RPG Maker MV Web Editor
 *
 * @help
 * 메뉴·아이템·스킬 등 UI 씬이 열릴 때 맵 화면에 blur를 적용하면서
 * 동시에 메뉴 UI가 등장합니다. 메뉴를 닫으면 UI 사라짐과 동시에 blur가 해제됩니다.
 *
 * 렌더링 방식:
 *   열기: 메뉴씬 push → 배경 스냅샷(blur=0) → 배경에 canvas blur 0→최대 적용
 *         동시에 메뉴 UI fade-in (Cfg.duration 프레임)
 *   닫기: 메뉴 UI fade-out + 배경 canvas blur 최대→0 동시 진행
 *         게임씬 복귀 시 blur 없는 상태로 자연스럽게 전환
 *
 * === 전환 효과 종류 (transitionEffect) ===
 *   blur        : 가우시안 블러 (기본값)
 *   zoomBlur    : 방사형 줌 블러
 *   desaturation: 채도 감소 (흑백)
 *   sepia       : 세피아 색조
 *   brightness  : 화이트아웃 (밝아짐)
 *   ripple      : 물결 왜곡
 *   whirl       : 소용돌이
 *   pixelation  : 픽셀화
 *   chromatic   : 색수차
 *   dissolve    : 노이즈 페이드
 *   scanline    : 스캔라인 페이드
 *
 * @param transitionEffect
 * @text 전환 효과 종류
 * @type select
 * @option blur
 * @option zoomBlur
 * @option desaturation
 * @option sepia
 * @option brightness
 * @option ripple
 * @option whirl
 * @option pixelation
 * @option chromatic
 * @option dissolve
 * @option scanline
 * @default blur
 *
 * @param blur
 * @text 블러 강도 (0-100) [blur/zoomBlur 효과에 사용]
 * @type number
 * @min 0
 * @max 100
 * @default 40
 *
 * @param overlayColor
 * @text 오버레이 색상 (R,G,B)
 * @type string
 * @default 0,0,0
 *
 * @param overlayAlpha
 * @text 오버레이 불투명도 (0-255, 0이면 비활성)
 * @type number
 * @min 0
 * @max 255
 * @default 100
 *
 * @param duration
 * @text 전환 시간 (게임 루프 프레임 수, 60fps 기준)
 * @type number
 * @min 1
 * @max 120
 * @default 40
 *
 * @param easing
 * @text 이징
 * @type select
 * @option easeOut
 * @option easeIn
 * @option easeInOut
 * @option linear
 * @default easeOut
 *
 * @param closeAnim
 * @text 닫기 애니메이션 활성화
 * @type boolean
 * @default true
 */

(function () {
    'use strict';

    var params = PluginManager.parameters('MenuTransition');

    var Cfg = {
        transitionEffect: String(params.transitionEffect || 'blur'),
        blur:         Number(params.blur)         >= 0 ? Number(params.blur) : 40,
        overlayColor: String(params.overlayColor  || '0,0,0'),
        overlayAlpha: Number(params.overlayAlpha) >= 0 ? Number(params.overlayAlpha) : 100,
        duration:     Number(params.duration)     || 40,
        easing:       String(params.easing        || 'easeOut'),
        closeAnim:    String(params.closeAnim) !== 'false'
    };

    var _overlayRGB = (function () {
        var parts = Cfg.overlayColor.split(',').map(function (s) {
            return Math.max(0, Math.min(255, Number(s) || 0));
        });
        while (parts.length < 3) parts.push(0);
        return parts;
    })();

    // ── Easing ────────────────────────────────────────────────────────────────

    var EasingFn = {
        linear:    function (t) { return t; },
        easeIn:    function (t) { return t * t; },
        easeOut:   function (t) { return t * (2 - t); },
        easeInOut: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
    };

    function applyEase(t) {
        t = Math.min(1, Math.max(0, t));
        return (EasingFn[Cfg.easing] || EasingFn.easeOut)(t);
    }

    // ── 상태 변수 ─────────────────────────────────────────────────────────────

    // _phase: 0=비활성, 2=메뉴 열림
    var _phase     = 0;
    var _srcCanvas = null;   // 스냅샷 캔버스 (메뉴 배경용)

    // 배경 blur 애니메이션 상태 (canvas filter로 처리)
    var _bgBlurT      = 0;    // 현재 blur 진행값 (0~1)
    var _bgBlurStartT = 1;    // 닫기 시작 시점의 blur 값
    var _bgBlurDir    = 0;    // 0=정지, 1=열기(증가), -1=닫기(감소)
    var _bgElapsed    = 0;    // 진행 프레임
    var _bgBitmap     = null; // 현재 배경 비트맵 참조

    // 페이드 억제 플래그
    var _suppressMenuFadeOut = false;  // 메뉴 닫힐 때 fade-out을 duration으로 제어
    var _suppressGameFadeOut = false;  // 게임씬 종료 시 fade-out 억제
    var _suppressGameFadeIn  = false;  // 게임씬 복귀 시 fade-in 억제

    // ── PostProcess 유틸 ──────────────────────────────────────────────────────

    function _hasPostProcess() {
        return typeof PostProcess !== 'undefined' && !!PostProcess.clearTransitionEffects;
    }

    function _applyEffect(t) {
        if (!_hasPostProcess()) return;
        if (t <= 0.001) {
            PostProcess.clearTransitionEffects();
            return;
        }
        var type = Cfg.transitionEffect || 'blur';
        if (type === 'blur') {
            PostProcess.setTransitionBlur(t * (Cfg.blur / 100) * 20);
        } else {
            PostProcess.setTransitionEffect(type, t);
            if (type === 'ripple') PostProcess.setTransitionRippleTime(t);
        }
    }

    // ── Bloom 비활성화 훅 (메뉴 씬 중) ───────────────────────────────────────

    function _setMenuBgHook(active) {
        if (typeof PostProcess === 'undefined') return;
        PostProcess.menuBgHook = active ? {
            preRender: function () {
                if (PostProcess._bloomPass) {
                    PostProcess._bloomPass._mt_was = PostProcess._bloomPass.enabled;
                    PostProcess._bloomPass.enabled = false;
                }
            },
            postRender: function () {
                if (PostProcess._bloomPass && '_mt_was' in PostProcess._bloomPass) {
                    PostProcess._bloomPass.enabled = PostProcess._bloomPass._mt_was;
                    delete PostProcess._bloomPass._mt_was;
                }
            }
        } : null;
    }

    // ── canvas filter 문자열 생성 ─────────────────────────────────────────────
    // transitionEffect에 따라 적절한 canvas CSS filter 반환

    function _canvasFilter(t) {
        if (t <= 0.001) return '';
        var type = Cfg.transitionEffect || 'blur';
        switch (type) {
            case 'desaturation':
                return 'saturate(' + ((1 - t) * 100).toFixed(1) + '%)';
            case 'sepia':
                return 'sepia(' + (t * 100).toFixed(1) + '%)';
            case 'brightness':
                return 'brightness(' + (100 + t * 200).toFixed(1) + '%)';
            default:
                // blur, zoomBlur, chromatic 등 나머지는 blur로
                return 'blur(' + (t * (Cfg.blur / 100) * 20).toFixed(1) + 'px)';
        }
    }

    // ── 배경 비트맵: 스냅샷 + canvas blur + 오버레이 ─────────────────────────

    function _drawBgBitmap(bitmap, blurT) {
        if (!_srcCanvas || !bitmap) return;
        var w = bitmap.width, h = bitmap.height;
        if (w <= 0 || h <= 0) return;

        var ctx = bitmap._context;
        ctx.clearRect(0, 0, w, h);

        var filter = _canvasFilter(blurT || 0);
        if (filter) ctx.filter = filter;
        ctx.drawImage(_srcCanvas, 0, 0, w, h);
        if (filter) ctx.filter = 'none';

        if (Cfg.overlayAlpha > 0) {
            var alpha = (Cfg.overlayAlpha / 255) * (blurT || 0);
            if (alpha > 0.001) {
                ctx.fillStyle = 'rgba(' + _overlayRGB[0] + ',' + _overlayRGB[1] + ',' +
                                _overlayRGB[2] + ',' + alpha.toFixed(3) + ')';
                ctx.fillRect(0, 0, w, h);
            }
        }

        bitmap._setDirty();
    }

    // ── SceneManager.snapForBackground: 스냅샷 복사 ──────────────────────────

    var _origSnapForBg = SceneManager.snapForBackground;
    SceneManager.snapForBackground = function () {
        _origSnapForBg.call(this);

        // PostProcess._captureCanvas: 마지막 렌더 프레임 (blur 없는 원본)
        var cap = _hasPostProcess() ? PostProcess._captureCanvas : null;
        if (cap && cap.width > 0) {
            var copy = document.createElement('canvas');
            copy.width  = cap.width;
            copy.height = cap.height;
            copy.getContext('2d').drawImage(cap, 0, 0);
            _srcCanvas = copy;
        }

        // PostProcess 효과는 항상 0 (blur는 canvas filter로 처리)
        _applyEffect(0);
    };

    // ── SceneManager.push 가로채기: 즉시 push + canvas blur 애니메이션 시작 ─

    var _origPush = SceneManager.push;
    SceneManager.push = function (sceneClass) {
        var isMenu = typeof sceneClass === 'function' &&
            (sceneClass === Scene_MenuBase || sceneClass.prototype instanceof Scene_MenuBase);

        if (_hasPostProcess() && isMenu && _phase === 0) {
            _phase           = 2;
            _bgBlurT         = 0;
            _bgBlurDir       = 1;
            _bgElapsed       = 0;
            _bgBitmap        = null;
            _suppressGameFadeOut = true;

            // Scene_Map의 menuCalling 플래그 초기화 (반복 호출 방지)
            var sc = SceneManager._scene;
            if (sc && sc.menuCalling !== undefined) sc.menuCalling = false;

            _origPush.call(this, sceneClass);  // 즉시 push
            return;
        }

        _origPush.call(this, sceneClass);
    };

    // ── Scene_Base.prototype.startFadeOut: 게임씬 닫힐 때 억제 ───────────────

    var _SB_startFadeOut = Scene_Base.prototype.startFadeOut;
    Scene_Base.prototype.startFadeOut = function (duration, white) {
        if (_suppressGameFadeOut && !(this instanceof Scene_MenuBase)) {
            _suppressGameFadeOut = false;
            return;
        }
        _SB_startFadeOut.call(this, duration, white);
    };

    // ── Scene_Base.prototype.startFadeIn: 게임씬 복귀 시 억제 ────────────────

    var _SB_startFadeIn = Scene_Base.prototype.startFadeIn;
    Scene_Base.prototype.startFadeIn = function (duration, white) {
        if (_suppressGameFadeIn && !(this instanceof Scene_MenuBase)) {
            _suppressGameFadeIn = false;
            return;
        }
        _SB_startFadeIn.call(this, duration, white);
    };

    // ── Scene_MenuBase 오버라이드 ─────────────────────────────────────────────

    var _SMB_create = Scene_MenuBase.prototype.create;
    Scene_MenuBase.prototype.create = function () {
        _SMB_create.call(this);
        _setMenuBgHook(true);
    };

    var _SMB_update = Scene_MenuBase.prototype.update;
    Scene_MenuBase.prototype.update = function () {
        _SMB_update.call(this);

        // 배경 비트맵 참조 최초 설정
        if (!_bgBitmap && this._backgroundSprite && this._backgroundSprite.bitmap) {
            _bgBitmap = this._backgroundSprite.bitmap;
            _drawBgBitmap(_bgBitmap, _bgBlurT);
        }

        // blur 애니메이션 진행
        if (_bgBlurDir !== 0 && _bgBitmap) {
            _bgElapsed++;
            var raw = Math.min(1, _bgElapsed / Cfg.duration);
            if (_bgBlurDir === 1) {
                _bgBlurT = applyEase(raw);
            } else {
                _bgBlurT = _bgBlurStartT * applyEase(1 - raw);
            }
            _drawBgBitmap(_bgBitmap, _bgBlurT);
            if (raw >= 1) {
                _bgBlurDir = 0;
            }
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

    // 메뉴 열릴 때 fade-in: blur와 동시에 Cfg.duration 프레임으로
    var _SMB_startFadeIn = Scene_MenuBase.prototype.startFadeIn;
    Scene_MenuBase.prototype.startFadeIn = function (duration, white) {
        if (_bgBlurDir === 1) {
            // 열기 중: blur와 동시에 같은 duration으로 fade-in
            _SMB_startFadeIn.call(this, Cfg.duration, white);
            return;
        }
        _SMB_startFadeIn.call(this, duration, white);
    };

    // 메뉴 닫힐 때 fade-out: blur 감소와 동시에 Cfg.duration 프레임으로
    var _SMB_startFadeOut = Scene_MenuBase.prototype.startFadeOut;
    Scene_MenuBase.prototype.startFadeOut = function (duration, white) {
        if (_suppressMenuFadeOut) {
            _suppressMenuFadeOut = false;
            _SMB_startFadeOut.call(this, Cfg.duration, white);  // blur와 동기화
            return;
        }
        _SMB_startFadeOut.call(this, duration, white);
    };

    // ── SceneManager.pop 오버라이드: 닫기 blur 애니메이션 트리거 ─────────────

    if (Cfg.closeAnim) {
        var _origPop = SceneManager.pop;
        SceneManager.pop = function () {
            var isMenu = SceneManager._scene instanceof Scene_MenuBase;
            if (isMenu && _phase !== 0) {
                _bgBlurStartT        = _bgBlurT;  // 현재 blur 값에서 시작
                _suppressMenuFadeOut = true;       // fade-out을 Cfg.duration으로 제어
                _suppressGameFadeIn  = true;
                _bgBlurDir           = -1;
                _bgElapsed           = 0;
                _phase               = 0;
            }
            _origPop.call(this);
        };
    }

    // ── PostProcess._createComposer / _createComposer2D 훅 ────────────────────
    // 게임씬 복귀 시 composer가 재생성될 때 transition pass를 0으로 유지

    function _afterComposerCreated() {
        _applyEffect(0);
    }
    if (typeof PostProcess !== 'undefined') {
        if (PostProcess._createComposer) {
            var _origCreateComposer = PostProcess._createComposer;
            PostProcess._createComposer = function () {
                _origCreateComposer.apply(this, arguments);
                _afterComposerCreated();
            };
        }
        if (PostProcess._createComposer2D) {
            var _origCreateComposer2D = PostProcess._createComposer2D;
            PostProcess._createComposer2D = function () {
                _origCreateComposer2D.apply(this, arguments);
                _afterComposerCreated();
            };
        }
    }

})();
