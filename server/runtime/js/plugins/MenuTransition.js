/*:
 * @plugindesc [MenuTransition] 메뉴/UI 씬 배경 전환 효과 (PostProcess 셰이더)
 * @author RPG Maker MV Web Editor
 *
 * @help
 * 메뉴·아이템·스킬 등 UI 씬이 열릴 때 PostProcess 셰이더로 맵 화면에 효과를 적용한 뒤
 * 스냅샷을 찍어 배경으로 사용합니다. 메뉴를 닫으면 역방향 효과로 자연스럽게 해제됩니다.
 *
 * 렌더링 방식:
 *   열기: SceneManager.push 가로채기 → PostProcess로 효과 0→최대 적용 (게임씬에서)
 *         효과 최대 시점에 스냅샷 → 메뉴 배경으로 표시 (정적 이미지)
 *   닫기: 게임씬 복귀 시 PostProcess 효과 최대→0 페이드 아웃
 *         라이브 게임이 뒤에서 실행되므로 "부활 글리치" 가려짐
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

    // _phase: 0=비활성, 1=열기 사전 애니메이션(게임씬), 2=메뉴 열림
    var _phase   = 0;
    var _t       = 0;
    var _elapsed = 0;

    var _pendingPushClass = null;   // push 지연 중인 씬 클래스
    var _srcCanvas        = null;   // 스냅샷 캔버스 (메뉴 배경용)

    // 페이드 억제 플래그
    var _suppressMenuFadeIn  = false;  // 메뉴 열릴 때 fade-in 억제
    var _suppressMenuFadeOut = false;  // 메뉴 닫힐 때 fade-out 억제
    var _suppressGameFadeOut = false;  // 게임씬 종료 시 fade-out 억제
    var _suppressGameFadeIn  = false;  // 게임씬 복귀 시 fade-in 억제

    // 닫기 PostProcess 상태
    var _mapBlurPending = false;
    var _mapBlurStartT  = 1;
    var _mapBlurPhase   = false;

    // ── DEBUG ─────────────────────────────────────────────────────────────────
    var _dbgFrame = 0;
    var _MT_LOG = true;  // 로그 끄려면 false로
    function _log() {
        if (!_MT_LOG) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[MT f' + _dbgFrame + ']');
        console.log.apply(console, args);
    }

    // ── PostProcess 유틸 ──────────────────────────────────────────────────────

    function _hasPostProcess() {
        return typeof PostProcess !== 'undefined' && !!PostProcess.clearTransitionEffects;
    }

    // t: 0=효과 없음, 1=최대 강도
    function _applyEffect(t) {
        if (!_hasPostProcess()) return;
        _log('_applyEffect(' + t.toFixed(3) + ')');
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

    // ── 배경 비트맵: 스냅샷 + 오버레이 ──────────────────────────────────────
    // PostProcess로 효과가 적용된 상태에서 스냅샷을 찍었으므로
    // 추가 canvas 2D 효과 없이 그대로 그리면 됨

    function _drawBgBitmap(bitmap) {
        if (!_srcCanvas || !bitmap) return;
        var w = bitmap.width, h = bitmap.height;
        if (w <= 0 || h <= 0) return;

        var ctx = bitmap._context;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(_srcCanvas, 0, 0, w, h);

        if (Cfg.overlayAlpha > 0) {
            ctx.fillStyle = 'rgba(' + _overlayRGB[0] + ',' + _overlayRGB[1] + ',' +
                            _overlayRGB[2] + ',' + (Cfg.overlayAlpha / 255).toFixed(3) + ')';
            ctx.fillRect(0, 0, w, h);
        }

        bitmap._setDirty();
    }

    // ── SceneManager.snapForBackground: 스냅샷 복사 → PostProcess 초기화 ────

    var _origSnapForBg = SceneManager.snapForBackground;
    SceneManager.snapForBackground = function () {
        _log('snapForBackground phase=' + _phase + ' pending=' + _mapBlurPending + ' startT=' + _mapBlurStartT);
        _origSnapForBg.call(this);

        // PostProcess._captureCanvas: 마지막 렌더 프레임 (최대 효과 상태)
        var cap = _hasPostProcess() ? PostProcess._captureCanvas : null;
        if (cap && cap.width > 0) {
            var copy = document.createElement('canvas');
            copy.width  = cap.width;
            copy.height = cap.height;
            copy.getContext('2d').drawImage(cap, 0, 0);
            _srcCanvas = copy;
        }

        // 열기 시: 스냅샷에 효과가 구워졌으므로 PostProcess 효과 해제
        // 닫기 시(_mapBlurPending=true): 로딩 프레임 중에도 blur를 유지해야 하므로 최대값으로 설정
        if (_mapBlurPending) {
            _log('snapForBg close-path → applyEffect(' + _mapBlurStartT + ')');
            _applyEffect(_mapBlurStartT);
        } else {
            _log('snapForBg open-path → applyEffect(0)');
            _applyEffect(0);
        }
    };

    // ── SceneManager.push 가로채기: 메뉴씬 열기 전 PostProcess 애니메이션 ───

    var _origPush = SceneManager.push;
    SceneManager.push = function (sceneClass) {
        // 열기 애니메이션 중 중복 push 무시
        if (_phase === 1) return;

        var isMenu = typeof sceneClass === 'function' &&
            (sceneClass === Scene_MenuBase || sceneClass.prototype instanceof Scene_MenuBase);

        if (_hasPostProcess() && isMenu && _phase === 0) {
            _phase            = 1;
            _elapsed          = 0;
            _t                = 0;
            _pendingPushClass = sceneClass;
            _mapBlurPending   = false;
            _applyEffect(0);

            // Scene_Map의 menuCalling 플래그 초기화 (반복 호출 방지)
            var sc = SceneManager._scene;
            if (sc && sc.menuCalling !== undefined) sc.menuCalling = false;
            return;
        }

        _origPush.call(this, sceneClass);
    };

    // ── Scene_Base.prototype.update: 열기 사전 + 닫기 PostProcess 애니메이션 ─

    var _SB_update = Scene_Base.prototype.update;
    Scene_Base.prototype.update = function () {
        _dbgFrame++;
        _SB_update.call(this);
        if (this instanceof Scene_MenuBase) return;

        // Phase 1: PostProcess 0→최대, 완료 시 실제 push 실행
        if (_phase === 1) {
            _elapsed++;
            var rawOpen = Math.min(1, _elapsed / Cfg.duration);
            _t = applyEase(rawOpen);
            _applyEffect(_t);

            if (rawOpen >= 1) {
                _t = 1;
                _applyEffect(1);
                _suppressMenuFadeIn  = true;
                _suppressGameFadeOut = true;
                _origPush.call(SceneManager, _pendingPushClass);
                _pendingPushClass = null;
                _phase = 2;
                _log('phase1 완료 → push, _t=1');
            }
            return;
        }

        // 닫기: PostProcess 최대→0
        if (_mapBlurPhase) {
            _elapsed++;
            var rawClose = Math.min(1, _elapsed / Cfg.duration);
            _t = _mapBlurStartT * applyEase(1 - rawClose);
            if (_elapsed <= 3 || rawClose >= 1) {
                _log('closeAnim elapsed=' + _elapsed + ' rawClose=' + rawClose.toFixed(3) + ' _t=' + _t.toFixed(3));
            }
            _applyEffect(_t);

            if (rawClose >= 1) {
                _applyEffect(0);
                _mapBlurPhase = false;
                _srcCanvas    = null;
                _t            = 0;
                _log('closeAnim 완료');
            }
        }
    };

    // ── Scene_Base.prototype.startFadeOut: 게임씬 닫힐 때 억제 ───────────────

    var _SB_startFadeOut = Scene_Base.prototype.startFadeOut;
    Scene_Base.prototype.startFadeOut = function (duration, white) {
        if (_suppressGameFadeOut && !(this instanceof Scene_MenuBase)) {
            _suppressGameFadeOut = false;
            return;  // 억제 — PostProcess가 시각적 전환 담당
        }
        _SB_startFadeOut.call(this, duration, white);
    };

    // ── Scene_Base.prototype.start: 닫기 PostProcess 시작 ────────────────────

    var _SB_start = Scene_Base.prototype.start;
    Scene_Base.prototype.start = function () {
        var sceneName = this.constructor ? this.constructor.name : '?';
        _log('scene.start [' + sceneName + '] pending=' + _mapBlurPending + ' isMenuBase=' + (this instanceof Scene_MenuBase));
        _SB_start.call(this);
        if (_mapBlurPending && !(this instanceof Scene_MenuBase)) {
            _mapBlurPending = false;
            _mapBlurPhase   = true;
            _elapsed        = 0;
            _t              = _mapBlurStartT;
            _log('closeAnim 시작 → applyEffect(' + _mapBlurStartT + ')');
            _applyEffect(_mapBlurStartT);
        }
    };

    // ── Scene_Base.prototype.startFadeIn: 게임씬 복귀 시 억제 ────────────────

    var _SB_startFadeIn = Scene_Base.prototype.startFadeIn;
    Scene_Base.prototype.startFadeIn = function (duration, white) {
        if (_suppressGameFadeIn && !(this instanceof Scene_MenuBase)) {
            _suppressGameFadeIn = false;
            return;  // 억제 — PostProcess가 시각적 전환 담당
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

        // _phase === 2: 스냅샷을 배경 비트맵에 1회 그리기
        if (_phase === 2 && !this._bgReady &&
                this._backgroundSprite && this._backgroundSprite.bitmap) {
            _drawBgBitmap(this._backgroundSprite.bitmap);
            this._bgReady = true;
        }
    };

    var _SMB_terminate = Scene_MenuBase.prototype.terminate;
    Scene_MenuBase.prototype.terminate = function () {
        _SMB_terminate.call(this);
        _setMenuBgHook(false);
        this._bgReady = false;
        _phase = 0;
    };

    // 메뉴 열릴 때 fade-in: 즉시 완료 (PostProcess가 열기 담당)
    var _SMB_startFadeIn = Scene_MenuBase.prototype.startFadeIn;
    Scene_MenuBase.prototype.startFadeIn = function (duration, white) {
        if (_suppressMenuFadeIn) {
            _suppressMenuFadeIn = false;
            _SMB_startFadeIn.call(this, 1, white);  // 즉시 완료
            return;
        }
        _SMB_startFadeIn.call(this, duration, white);
    };

    // 메뉴 닫힐 때 fade-out: 억제 (즉시 씬 전환)
    var _SMB_startFadeOut = Scene_MenuBase.prototype.startFadeOut;
    Scene_MenuBase.prototype.startFadeOut = function (duration, white) {
        if (_suppressMenuFadeOut) {
            _suppressMenuFadeOut = false;
            return;
        }
        _SMB_startFadeOut.call(this, duration, white);
    };

    // ── SceneManager.pop 오버라이드: 닫기 PostProcess 트리거 ─────────────────

    if (Cfg.closeAnim) {
        var _origPop = SceneManager.pop;
        SceneManager.pop = function () {
            var isMenu = SceneManager._scene instanceof Scene_MenuBase;
            _log('SceneManager.pop isMenu=' + isMenu + ' _phase=' + _phase + ' _t=' + _t.toFixed(3));
            if (isMenu && _phase !== 0) {
                _mapBlurStartT       = _t;
                _suppressMenuFadeOut = true;
                _suppressGameFadeIn  = true;
                _mapBlurPending      = true;
                _phase               = 0;
                _log('pop → pending=true startT=' + _mapBlurStartT.toFixed(3));
            } else {
                _log('pop → 조건 불만족 (건너뜀)');
            }
            _origPop.call(this);
        };
    }

})();
