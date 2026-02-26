/*:
 * @plugindesc [MenuTransition] 메뉴/UI 씬 배경 전환 효과 (Canvas 2D)
 * @author RPG Maker MV Web Editor
 *
 * @help
 * 메뉴·아이템·스킬 등 UI 씬이 열릴 때 맵 배경에 효과를 적용하면서
 * 동시에 메뉴 UI가 등장합니다. 메뉴를 닫으면 UI 사라짐과 동시에 효과가 해제됩니다.
 *
 * 렌더링 방식:
 *   열기: 메뉴씬 push → 배경 스냅샷(효과 없음) → Canvas 효과 0→최대 적용
 *         동시에 메뉴 UI fade-in (duration 프레임)
 *   닫기: 메뉴 UI fade-out + 배경 효과 최대→0 동시 진행
 *
 * === 전환 효과 종류 (transitionEffect) ===
 *   blur        : 가우시안 블러 (기본값)
 *   zoomBlur    : 블러 + 줌 인
 *   desaturation: 채도 감소 (흑백)
 *   sepia       : 세피아 색조
 *   brightness  : 화이트아웃 (밝아짐)
 *   darkness    : 블랙아웃 (어두워짐)
 *   contrast    : 대비 증가
 *   hue         : 색조 회전
 *   invert      : 색상 반전
 *   pixelation  : 픽셀화
 *   zoom        : 줌 인 (blur 없음)
 *   chromatic   : 색수차
 *   vignette    : 비네트 (주변부 어둠)
 *   scanline    : 스캔라인
 *
 * @param transitionEffect
 * @text 전환 효과 종류
 * @type select
 * @option blur
 * @option zoomBlur
 * @option desaturation
 * @option sepia
 * @option brightness
 * @option darkness
 * @option contrast
 * @option hue
 * @option invert
 * @option pixelation
 * @option zoom
 * @option chromatic
 * @option vignette
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

    // 배경 효과 애니메이션 상태
    var _bgBlurT      = 0;    // 현재 효과 진행값 (0~1)
    var _bgBlurStartT = 1;    // 닫기 시작 시점의 값
    var _bgBlurDir    = 0;    // 0=정지, 1=열기(증가), -1=닫기(감소)
    var _bgElapsed    = 0;    // 진행 프레임
    var _bgBitmap     = null; // 현재 배경 비트맵 참조

    // 페이드 억제 플래그
    var _suppressMenuFadeOut = false;
    var _suppressGameFadeOut = false;
    var _suppressGameFadeIn  = false;

    // ── PostProcess 유틸 ──────────────────────────────────────────────────────

    function _hasPostProcess() {
        return typeof PostProcess !== 'undefined' && !!PostProcess.clearTransitionEffects;
    }

    // canvas 버전: PostProcess transition 효과는 항상 클리어
    function _clearEffect() {
        if (_hasPostProcess()) PostProcess.clearTransitionEffects();
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

    // ── CSS filter 문자열 생성 ────────────────────────────────────────────────

    function _canvasFilter(t) {
        if (t <= 0.001) return '';
        switch (Cfg.transitionEffect) {
            case 'blur':
                return 'blur(' + (t * (Cfg.blur / 100) * 20).toFixed(1) + 'px)';
            case 'desaturation':
                return 'saturate(' + ((1 - t) * 100).toFixed(1) + '%)';
            case 'sepia':
                return 'sepia(' + (t * 100).toFixed(1) + '%)';
            case 'brightness':
                return 'brightness(' + (100 + t * 200).toFixed(1) + '%)';
            case 'darkness':
                return 'brightness(' + ((1 - t * 0.85) * 100).toFixed(1) + '%)';
            case 'contrast':
                return 'contrast(' + (100 + t * 250).toFixed(1) + '%)';
            case 'hue':
                return 'hue-rotate(' + (t * 180).toFixed(1) + 'deg)';
            case 'invert':
                return 'invert(' + (t * 100).toFixed(1) + '%)';
            default:
                return '';
        }
    }

    // ── 특수 효과: 픽셀화 ─────────────────────────────────────────────────────

    function _drawPixelation(ctx, w, h, t) {
        var blockSize = Math.max(1, Math.round(t * 32));
        var sw = Math.max(1, Math.floor(w / blockSize));
        var sh = Math.max(1, Math.floor(h / blockSize));
        var small = document.createElement('canvas');
        small.width  = sw;
        small.height = sh;
        var sctx = small.getContext('2d');
        sctx.imageSmoothingEnabled = true;
        sctx.drawImage(_srcCanvas, 0, 0, sw, sh);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(small, 0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
    }

    // ── 특수 효과: 줌 인 ─────────────────────────────────────────────────────

    function _drawZoom(ctx, w, h, t) {
        var scale = 1 + t * 0.3;
        var dx = (w * (1 - scale)) / 2;
        var dy = (h * (1 - scale)) / 2;
        ctx.drawImage(_srcCanvas, dx, dy, w * scale, h * scale);
    }

    // ── 특수 효과: 줌 블러 ────────────────────────────────────────────────────

    function _drawZoomBlur(ctx, w, h, t) {
        var blurPx = t * (Cfg.blur / 100) * 20;
        var scale  = 1 + t * 0.08;
        var dx = (w * (1 - scale)) / 2;
        var dy = (h * (1 - scale)) / 2;
        if (blurPx > 0.1) ctx.filter = 'blur(' + blurPx.toFixed(1) + 'px)';
        ctx.drawImage(_srcCanvas, dx, dy, w * scale, h * scale);
        if (blurPx > 0.1) ctx.filter = 'none';
    }

    // ── 특수 효과: 색수차 ─────────────────────────────────────────────────────

    function _drawChromatic(ctx, w, h, t) {
        var offset = Math.round(t * 14);

        // 원본
        ctx.drawImage(_srcCanvas, 0, 0, w, h);
        if (offset < 1) return;

        // 빨간 채널 — 왼쪽으로 오프셋
        var offR = document.createElement('canvas');
        offR.width = w; offR.height = h;
        var ctxR = offR.getContext('2d');
        ctxR.drawImage(_srcCanvas, 0, 0, w, h);
        ctxR.globalCompositeOperation = 'multiply';
        ctxR.fillStyle = '#ff0000';
        ctxR.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = t * 0.45;
        ctx.drawImage(offR, -offset, 0, w, h);

        // 파란 채널 — 오른쪽으로 오프셋
        var offB = document.createElement('canvas');
        offB.width = w; offB.height = h;
        var ctxB = offB.getContext('2d');
        ctxB.drawImage(_srcCanvas, 0, 0, w, h);
        ctxB.globalCompositeOperation = 'multiply';
        ctxB.fillStyle = '#0000ff';
        ctxB.fillRect(0, 0, w, h);
        ctx.drawImage(offB, offset, 0, w, h);

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    // ── 특수 효과: 비네트 ─────────────────────────────────────────────────────

    function _drawVignette(ctx, w, h, t) {
        ctx.drawImage(_srcCanvas, 0, 0, w, h);

        var cx    = w / 2;
        var cy    = h / 2;
        var maxR  = Math.sqrt(cx * cx + cy * cy);
        var inner = maxR * Math.max(0.01, 1 - t * 0.85);
        var grad  = ctx.createRadialGradient(cx, cy, inner, cx, cy, maxR);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,' + Math.min(0.95, t * 1.1).toFixed(2) + ')');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    // ── 특수 효과: 스캔라인 ───────────────────────────────────────────────────

    function _drawScanline(ctx, w, h, t) {
        if (t > 0.001) ctx.filter = 'saturate(' + ((1 - t * 0.7) * 100).toFixed(1) + '%)';
        ctx.drawImage(_srcCanvas, 0, 0, w, h);
        if (t > 0.001) ctx.filter = 'none';

        ctx.globalAlpha = t * 0.55;
        ctx.fillStyle = '#000000';
        for (var y = 0; y < h; y += 2) {
            ctx.fillRect(0, y, w, 1);
        }
        ctx.globalAlpha = 1;
    }

    // ── 배경 비트맵 그리기 ────────────────────────────────────────────────────

    function _drawBgBitmap(bitmap, blurT) {
        if (!_srcCanvas || !bitmap) return;
        var w = bitmap.width, h = bitmap.height;
        if (w <= 0 || h <= 0) return;

        var ctx  = bitmap._context;
        var type = Cfg.transitionEffect || 'blur';
        ctx.clearRect(0, 0, w, h);

        switch (type) {
            case 'pixelation': _drawPixelation(ctx, w, h, blurT); break;
            case 'zoom':       _drawZoom(ctx, w, h, blurT);       break;
            case 'zoomBlur':   _drawZoomBlur(ctx, w, h, blurT);   break;
            case 'chromatic':  _drawChromatic(ctx, w, h, blurT);  break;
            case 'vignette':   _drawVignette(ctx, w, h, blurT);   break;
            case 'scanline':   _drawScanline(ctx, w, h, blurT);   break;
            default: {
                var filter = _canvasFilter(blurT);
                if (filter) ctx.filter = filter;
                ctx.drawImage(_srcCanvas, 0, 0, w, h);
                if (filter) ctx.filter = 'none';
            }
        }

        // 오버레이
        if (Cfg.overlayAlpha > 0) {
            var alpha = (Cfg.overlayAlpha / 255) * blurT;
            if (alpha > 0.001) {
                ctx.fillStyle = 'rgba(' + _overlayRGB[0] + ',' + _overlayRGB[1] + ',' +
                                _overlayRGB[2] + ',' + alpha.toFixed(3) + ')';
                ctx.fillRect(0, 0, w, h);
            }
        }

        bitmap._setDirty();
    }

    // ── SceneManager.snapForBackground ────────────────────────────────────────

    var _origSnapForBg = SceneManager.snapForBackground;
    SceneManager.snapForBackground = function () {
        _origSnapForBg.call(this);

        // PostProcess._captureCanvas: 마지막 렌더 프레임 (효과 없는 원본)
        var cap = _hasPostProcess() ? PostProcess._captureCanvas : null;
        if (cap && cap.width > 0) {
            var copy = document.createElement('canvas');
            copy.width  = cap.width;
            copy.height = cap.height;
            copy.getContext('2d').drawImage(cap, 0, 0);
            _srcCanvas = copy;
        }

        _clearEffect();
    };

    // ── SceneManager.push 가로채기: 즉시 push + canvas 효과 애니메이션 시작 ─

    var _origPush = SceneManager.push;
    SceneManager.push = function (sceneClass) {
        var isMenu = typeof sceneClass === 'function' &&
            (sceneClass === Scene_MenuBase || sceneClass.prototype instanceof Scene_MenuBase);

        if (_hasPostProcess() && isMenu && _phase === 0) {
            _phase               = 2;
            _bgBlurT             = 0;
            _bgBlurDir           = 1;
            _bgElapsed           = 0;
            _bgBitmap            = null;
            _suppressGameFadeOut = true;

            // Scene_Map의 menuCalling 플래그 초기화 (반복 호출 방지)
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
        if (_suppressGameFadeOut && !(this instanceof Scene_MenuBase)) {
            _suppressGameFadeOut = false;
            return;
        }
        _SB_startFadeOut.call(this, duration, white);
    };

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

        // 효과 애니메이션 진행
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

    // 메뉴 열릴 때: 효과와 동시에 같은 duration으로 fade-in
    var _SMB_startFadeIn = Scene_MenuBase.prototype.startFadeIn;
    Scene_MenuBase.prototype.startFadeIn = function (duration, white) {
        if (_bgBlurDir === 1) {
            _SMB_startFadeIn.call(this, Cfg.duration, white);
            return;
        }
        _SMB_startFadeIn.call(this, duration, white);
    };

    // 메뉴 닫힐 때: 효과와 동시에 같은 duration으로 fade-out
    var _SMB_startFadeOut = Scene_MenuBase.prototype.startFadeOut;
    Scene_MenuBase.prototype.startFadeOut = function (duration, white) {
        if (_suppressMenuFadeOut) {
            _suppressMenuFadeOut = false;
            _SMB_startFadeOut.call(this, Cfg.duration, white);
            return;
        }
        _SMB_startFadeOut.call(this, duration, white);
    };

    // ── SceneManager.pop: 닫기 애니메이션 트리거 ─────────────────────────────

    if (Cfg.closeAnim) {
        var _origPop = SceneManager.pop;
        SceneManager.pop = function () {
            if (SceneManager._scene instanceof Scene_MenuBase && _phase !== 0) {
                _bgBlurStartT        = _bgBlurT;
                _suppressMenuFadeOut = true;
                _suppressGameFadeIn  = true;
                _bgBlurDir           = -1;
                _bgElapsed           = 0;
                _phase               = 0;
            }
            _origPop.call(this);
        };
    }

    // ── PostProcess composer 재생성 훅: transition 효과 항상 0 유지 ───────────

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

})();
