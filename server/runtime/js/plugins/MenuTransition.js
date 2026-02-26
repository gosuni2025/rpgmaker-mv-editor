/*:
 * @plugindesc [MenuTransition] 메뉴/UI 씬 배경 전환 효과 (PostProcess 셰이더)
 * @author RPG Maker MV Web Editor
 *
 * @help
 * 메뉴·아이템·스킬 등 UI 씬이 열릴 때 PostProcess transition blur를 배경에 적용하면서
 * 동시에 메뉴 UI가 등장합니다. 메뉴를 닫으면 UI 사라짐과 동시에 blur가 해제됩니다.
 *
 * 렌더링 방식:
 *   열기: 배경(맵)에 PostProcess blur 0→최대 적용 + 메뉴 windowLayer opacity 0→255 동시
 *   닫기: PostProcess blur 최대→0 + windowLayer opacity 255→0 동시 진행
 *         isBusy()로 blur 완료 후 게임씬 복귀
 *
 * PostProcess의 transition pass는 UIRenderPass 이전에 위치하므로,
 * blur가 배경(맵)에만 걸리고 메뉴 UI 윈도우는 선명하게 유지됩니다.
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

    // 배경 blur 애니메이션 상태 (PostProcess로 처리)
    var _bgBlurT      = 0;    // 현재 blur 진행값 (0~1)
    var _bgBlurStartT = 1;    // 닫기 시작 시점의 blur 값
    var _bgBlurDir    = 0;    // 0=정지, 1=열기(증가), -1=닫기(감소)
    var _bgElapsed    = 0;    // 진행 프레임

    // 페이드 억제 플래그
    var _suppressGameFadeOut = false;  // 게임씬 종료 시 fade-out 억제
    var _suppressGameFadeIn  = false;  // 게임씬 복귀 시 fade-in 억제

    // 오버레이 스프라이트 참조
    var _overlaySprite = null;

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

    // ── SceneManager.snapForBackground ────────────────────────────────────────
    // PostProcess.js가 이미 _captureCanvas 기반으로 blur 없는 스냅샷을 올바르게 처리함.
    // this.snap()은 preserveDrawingBuffer=false로 검은 화면을 반환하므로 사용 금지.

    // ── SceneManager.push: 즉시 push + PostProcess blur 애니메이션 시작 ──────

    var _origPush = SceneManager.push;
    SceneManager.push = function (sceneClass) {
        var isMenu = typeof sceneClass === 'function' &&
            (sceneClass === Scene_MenuBase || sceneClass.prototype instanceof Scene_MenuBase);

        if (_hasPostProcess() && isMenu && _phase === 0) {
            _phase               = 2;
            _bgBlurT             = 0;
            _bgBlurDir           = 1;
            _bgElapsed           = 0;
            _suppressGameFadeOut = true;

            // Scene_Map의 menuCalling 플래그 초기화 (반복 호출 방지)
            var sc = SceneManager._scene;
            if (sc && sc.menuCalling !== undefined) sc.menuCalling = false;

            _origPush.call(this, sceneClass);
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

        // 열기: windowLayer를 투명에서 시작
        if (_bgBlurDir === 1 && this._windowLayer) {
            this._windowLayer.opacity = 0;
        }

        // 오버레이 스프라이트: windowLayer 앞, backgroundSprite 뒤에 추가
        if (Cfg.overlayAlpha > 0 && _bgBlurDir !== 0) {
            _overlaySprite = new ScreenSprite();
            _overlaySprite.setColor(_overlayRGB[0], _overlayRGB[1], _overlayRGB[2]);
            _overlaySprite.opacity = 0;
            if (this._windowLayer) {
                this.addChildAt(_overlaySprite, this.getChildIndex(this._windowLayer));
            } else {
                this.addChild(_overlaySprite);
            }
        }

        _setMenuBgHook(true);
    };

    var _SMB_update = Scene_MenuBase.prototype.update;
    Scene_MenuBase.prototype.update = function () {
        _SMB_update.call(this);

        if (_bgBlurDir !== 0) {
            _bgElapsed++;
            var raw = Math.min(1, _bgElapsed / Cfg.duration);
            if (_bgBlurDir === 1) {
                _bgBlurT = applyEase(raw);
            } else {
                _bgBlurT = _bgBlurStartT * applyEase(1 - raw);
            }

            // PostProcess transition blur 적용 (배경에만, UI는 선명 유지)
            _applyEffect(_bgBlurT);

            // windowLayer opacity 동기화 (메뉴 창 등장/소멸)
            if (this._windowLayer) {
                this._windowLayer.opacity = Math.round(_bgBlurT * 255);
            }

            // 오버레이 opacity 동기화
            if (_overlaySprite) {
                _overlaySprite.opacity = Math.round(_bgBlurT * Cfg.overlayAlpha);
            }

            if (raw >= 1) {
                _bgBlurDir = 0;
            }
        }
    };

    // blur 애니메이션 진행 중이면 busy → changeScene() 지연
    var _SMB_isBusy = Scene_MenuBase.prototype.isBusy;
    Scene_MenuBase.prototype.isBusy = function () {
        return _SMB_isBusy.call(this) || _bgBlurDir !== 0;
    };

    var _SMB_terminate = Scene_MenuBase.prototype.terminate;
    Scene_MenuBase.prototype.terminate = function () {
        _SMB_terminate.call(this);
        _setMenuBgHook(false);
        _applyEffect(0);
        _bgBlurT       = 0;
        _bgBlurDir     = 0;
        _phase         = 0;
        _overlaySprite = null;
    };

    // 열기 중: fade-in 억제 (windowLayer.opacity로 직접 제어)
    var _SMB_startFadeIn = Scene_MenuBase.prototype.startFadeIn;
    Scene_MenuBase.prototype.startFadeIn = function (duration, white) {
        if (_bgBlurDir === 1) {
            return;
        }
        _SMB_startFadeIn.call(this, duration, white);
    };

    // 닫기 중: fade-out 억제 (windowLayer.opacity로 직접 제어)
    var _SMB_startFadeOut = Scene_MenuBase.prototype.startFadeOut;
    Scene_MenuBase.prototype.startFadeOut = function (duration, white) {
        if (_bgBlurDir === -1) {
            return;
        }
        _SMB_startFadeOut.call(this, duration, white);
    };

    // ── SceneManager.pop: 닫기 blur 애니메이션 트리거 ────────────────────────

    if (Cfg.closeAnim) {
        var _origPop = SceneManager.pop;
        SceneManager.pop = function () {
            var isMenu = SceneManager._scene instanceof Scene_MenuBase;
            if (isMenu && _phase !== 0) {
                _bgBlurStartT       = _bgBlurT;
                _bgBlurDir          = -1;
                _bgElapsed          = 0;
                _suppressGameFadeIn = true;
                _phase              = 0;
            }
            _origPop.call(this);
        };
    }

    // ── PostProcess composer 재생성 훅 ────────────────────────────────────────
    // 화면 리사이즈, 2D↔3D 전환 시 transition pass가 초기화되므로 재적용

    function _afterComposerCreated() {
        if (_bgBlurDir !== 0 || _bgBlurT > 0.001) {
            _applyEffect(_bgBlurT);
        } else {
            _applyEffect(0);
        }
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
