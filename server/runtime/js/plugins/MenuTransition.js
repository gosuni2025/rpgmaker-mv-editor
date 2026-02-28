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
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 전환 효과 종류
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *  blur         가우시안 블러.
 *               관련 파라미터: blur_amount
 *
 *  zoomBlur     블러 + 줌 인.
 *               관련 파라미터: zoomBlur_amount, zoomBlur_zoom
 *
 *  desaturation 채도 감소 → 흑백.
 *               관련 파라미터: desaturation_amount
 *
 *  sepia        세피아 색조.
 *               관련 파라미터: sepia_amount
 *
 *  brightness   화이트아웃 (점점 밝아짐).
 *               관련 파라미터: brightness_amount
 *
 *  darkness     블랙아웃 (점점 어두워짐).
 *               관련 파라미터: darkness_amount
 *
 *  contrast     대비 증가.
 *               관련 파라미터: contrast_amount
 *
 *  hue          색조 회전.
 *               관련 파라미터: hue_amount
 *
 *  invert       색상 반전.
 *               관련 파라미터: invert_amount
 *
 *  pixelation   픽셀화 (화면이 블록으로 뭉개짐).
 *               관련 파라미터: pixelation_amount
 *
 *  zoom         줌 인 (블러 없음).
 *               관련 파라미터: zoom_amount
 *
 *  chromatic    색수차 (R/B 채널 좌우 분리).
 *               관련 파라미터: chromatic_offset, chromatic_alpha
 *
 *  vignette     비네트 (주변부가 점점 어두워짐).
 *               관련 파라미터: vignette_amount, vignette_range
 *
 *  scanline     스캔라인 (CRT 모니터 효과).
 *               관련 파라미터: scanline_opacity, scanline_desaturation
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 공통 파라미터
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  overlayColor  배경 오버레이 색상 (R,G,B). 기본 0,0,0 (검정).
 *  overlayAlpha  오버레이 불투명도 (0=비활성, 255=완전 불투명).
 *  duration      전환 시간 (프레임, 60fps 기준). 40 ≒ 0.67초.
 *  easing        가속도 곡선.
 *  closeAnim     닫기 시 역방향 애니메이션 사용 여부.
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
 * @param blur_amount
 * @text [blur] 블러 강도 (100=최대 20px)
 * @type number
 * @min 0
 * @max 100
 * @default 80
 *
 * @param zoomBlur_amount
 * @text [zoomBlur] 블러 강도 (100=최대 20px)
 * @type number
 * @min 0
 * @max 100
 * @default 80
 *
 * @param zoomBlur_zoom
 * @text [zoomBlur] 줌 배율 (100=최대 30% 확대)
 * @type number
 * @min 0
 * @max 100
 * @default 50
 *
 * @param desaturation_amount
 * @text [desaturation] 채도 감소량 (100=완전 흑백)
 * @type number
 * @min 0
 * @max 100
 * @default 100
 *
 * @param sepia_amount
 * @text [sepia] 세피아 강도 (100=완전 세피아)
 * @type number
 * @min 0
 * @max 100
 * @default 100
 *
 * @param brightness_amount
 * @text [brightness] 밝기 증가량 (100=+300%)
 * @type number
 * @min 0
 * @max 100
 * @default 80
 *
 * @param darkness_amount
 * @text [darkness] 어두움 강도 (100=-90% 밝기)
 * @type number
 * @min 0
 * @max 100
 * @default 80
 *
 * @param contrast_amount
 * @text [contrast] 대비 증가량 (100=+400%)
 * @type number
 * @min 0
 * @max 100
 * @default 70
 *
 * @param hue_amount
 * @text [hue] 색조 회전 각도 (100=360° 회전)
 * @type number
 * @min 0
 * @max 100
 * @default 60
 *
 * @param invert_amount
 * @text [invert] 반전 강도 (100=완전 반전)
 * @type number
 * @min 0
 * @max 100
 * @default 100
 *
 * @param pixelation_amount
 * @text [pixelation] 최대 픽셀 블록 크기 (100=50px)
 * @type number
 * @min 0
 * @max 100
 * @default 80
 *
 * @param zoom_amount
 * @text [zoom] 최대 줌 배율 (100=60% 확대)
 * @type number
 * @min 0
 * @max 100
 * @default 60
 *
 * @param chromatic_offset
 * @text [chromatic] R/B 채널 오프셋 (100=28px)
 * @type number
 * @min 0
 * @max 100
 * @default 80
 *
 * @param chromatic_alpha
 * @text [chromatic] 채널 알파 강도 (100=60%)
 * @type number
 * @min 0
 * @max 100
 * @default 70
 *
 * @param vignette_amount
 * @text [vignette] 주변 어둠 강도 (100=최대)
 * @type number
 * @min 0
 * @max 100
 * @default 80
 *
 * @param vignette_range
 * @text [vignette] 비네트 범위 (0=넓게, 100=좁게 집중)
 * @type number
 * @min 0
 * @max 100
 * @default 50
 *
 * @param scanline_opacity
 * @text [scanline] 가로줄 불투명도 (100=70%)
 * @type number
 * @min 0
 * @max 100
 * @default 70
 *
 * @param scanline_desaturation
 * @text [scanline] 채도 감소량 (100=80%)
 * @type number
 * @min 0
 * @max 100
 * @default 60
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
 * @text 전환 시간 (프레임 수, 60fps 기준)
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

    function _p(key, def) {
        var v = Number(params[key]);
        return (params[key] !== undefined && !isNaN(v)) ? v : def;
    }

    var Cfg = {
        transitionEffect: String(params.transitionEffect || 'blur'),
        // 효과별 파라미터
        blur_amount:              _p('blur_amount',              80),
        zoomBlur_amount:          _p('zoomBlur_amount',          80),
        zoomBlur_zoom:            _p('zoomBlur_zoom',            50),
        desaturation_amount:      _p('desaturation_amount',     100),
        sepia_amount:             _p('sepia_amount',            100),
        brightness_amount:        _p('brightness_amount',        80),
        darkness_amount:          _p('darkness_amount',          80),
        contrast_amount:          _p('contrast_amount',          70),
        hue_amount:               _p('hue_amount',               60),
        invert_amount:            _p('invert_amount',           100),
        pixelation_amount:        _p('pixelation_amount',        80),
        zoom_amount:              _p('zoom_amount',              60),
        chromatic_offset:         _p('chromatic_offset',         80),
        chromatic_alpha:          _p('chromatic_alpha',          70),
        vignette_amount:          _p('vignette_amount',          80),
        vignette_range:           _p('vignette_range',           50),
        scanline_opacity:         _p('scanline_opacity',         70),
        scanline_desaturation:    _p('scanline_desaturation',    60),
        // 공통
        overlayColor: String(params.overlayColor || '0,0,0'),
        overlayAlpha: _p('overlayAlpha', 100),
        duration:     _p('duration',      40) || 40,
        easing:       String(params.easing || 'easeOut'),
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

    var _phase     = 0;       // 0=비활성, 2=메뉴 열림
    var _srcCanvas = null;    // 스냅샷 캔버스 (메뉴 배경용)

    var _bgBlurT      = 0;    // 현재 효과 진행값 (0~1)
    var _bgBlurStartT = 1;    // 닫기 시작 시점의 값
    var _bgBlurDir    = 0;    // 0=정지, 1=열기(증가), -1=닫기(감소)
    var _bgElapsed    = 0;    // 진행 프레임
    var _bgBitmap     = null; // 현재 배경 비트맵 참조

    var _suppressMenuFadeOut = false;
    var _suppressGameFadeOut = false;
    var _suppressGameFadeIn  = false;

    // ── PostProcess 유틸 ──────────────────────────────────────────────────────

    function _hasPostProcess() {
        return typeof PostProcess !== 'undefined' && !!PostProcess.clearTransitionEffects;
    }

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

    // ── CSS filter 문자열 생성 (단일 파라미터 효과) ───────────────────────────

    function _canvasFilter(t) {
        if (t <= 0.001) return '';
        switch (Cfg.transitionEffect) {
            case 'blur':
                return 'blur(' + (t * (Cfg.blur_amount / 100) * 20).toFixed(1) + 'px)';
            case 'desaturation':
                return 'saturate(' + ((1 - t * (Cfg.desaturation_amount / 100)) * 100).toFixed(1) + '%)';
            case 'sepia':
                return 'sepia(' + (t * (Cfg.sepia_amount / 100) * 100).toFixed(1) + '%)';
            case 'brightness':
                return 'brightness(' + (100 + t * (Cfg.brightness_amount / 100) * 300).toFixed(1) + '%)';
            case 'darkness':
                return 'brightness(' + ((1 - t * (Cfg.darkness_amount / 100) * 0.9) * 100).toFixed(1) + '%)';
            case 'contrast':
                return 'contrast(' + (100 + t * (Cfg.contrast_amount / 100) * 400).toFixed(1) + '%)';
            case 'hue':
                return 'hue-rotate(' + (t * (Cfg.hue_amount / 100) * 360).toFixed(1) + 'deg)';
            case 'invert':
                return 'invert(' + (t * (Cfg.invert_amount / 100) * 100).toFixed(1) + '%)';
            default:
                return '';
        }
    }

    // ── 특수 효과: 픽셀화 ─────────────────────────────────────────────────────

    function _drawPixelation(ctx, w, h, t) {
        var maxBlock  = Math.max(2, Math.round((Cfg.pixelation_amount / 100) * 50));
        var blockSize = Math.max(1, Math.round(t * maxBlock));
        var sw = Math.max(1, Math.floor(w / blockSize));
        var sh = Math.max(1, Math.floor(h / blockSize));
        var small = document.createElement('canvas');
        small.width = sw; small.height = sh;
        var sctx = small.getContext('2d');
        sctx.imageSmoothingEnabled = true;
        sctx.drawImage(_srcCanvas, 0, 0, sw, sh);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(small, 0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
    }

    // ── 특수 효과: 줌 인 ─────────────────────────────────────────────────────

    function _drawZoom(ctx, w, h, t) {
        var scale = 1 + t * (Cfg.zoom_amount / 100) * 0.6;
        var dx = (w * (1 - scale)) / 2;
        var dy = (h * (1 - scale)) / 2;
        ctx.drawImage(_srcCanvas, dx, dy, w * scale, h * scale);
    }

    // ── 특수 효과: 줌 블러 ────────────────────────────────────────────────────

    function _drawZoomBlur(ctx, w, h, t) {
        var blurPx = t * (Cfg.zoomBlur_amount / 100) * 20;
        var scale  = 1 + t * (Cfg.zoomBlur_zoom  / 100) * 0.3;
        var dx = (w * (1 - scale)) / 2;
        var dy = (h * (1 - scale)) / 2;
        if (blurPx > 0.1) ctx.filter = 'blur(' + blurPx.toFixed(1) + 'px)';
        ctx.drawImage(_srcCanvas, dx, dy, w * scale, h * scale);
        if (blurPx > 0.1) ctx.filter = 'none';
    }

    // ── 특수 효과: 색수차 ─────────────────────────────────────────────────────

    function _drawChromatic(ctx, w, h, t) {
        var offset  = Math.round(t * (Cfg.chromatic_offset / 100) * 28);
        var chAlpha = t * (Cfg.chromatic_alpha / 100) * 0.6;

        ctx.drawImage(_srcCanvas, 0, 0, w, h);
        if (offset < 1) return;

        var offR = document.createElement('canvas');
        offR.width = w; offR.height = h;
        var ctxR = offR.getContext('2d');
        ctxR.drawImage(_srcCanvas, 0, 0, w, h);
        ctxR.globalCompositeOperation = 'multiply';
        ctxR.fillStyle = '#ff0000';
        ctxR.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = chAlpha;
        ctx.drawImage(offR, -offset, 0, w, h);

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

        var amt   = Cfg.vignette_amount / 100;
        var range = Cfg.vignette_range  / 100;  // 0=넓게, 1=좁게
        var cx    = w / 2, cy = h / 2;
        var maxR  = Math.sqrt(cx * cx + cy * cy);
        var inner = maxR * Math.max(0.01, 1 - t * amt * (0.5 + range * 0.5));
        var dark  = Math.min(0.99, t * amt * 1.2);
        var grad  = ctx.createRadialGradient(cx, cy, inner, cx, cy, maxR);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,' + dark.toFixed(2) + ')');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    // ── 특수 효과: 스캔라인 ───────────────────────────────────────────────────

    function _drawScanline(ctx, w, h, t) {
        var satDrop = t * (Cfg.scanline_desaturation / 100) * 0.8;
        if (satDrop > 0.001) ctx.filter = 'saturate(' + ((1 - satDrop) * 100).toFixed(1) + '%)';
        ctx.drawImage(_srcCanvas, 0, 0, w, h);
        if (satDrop > 0.001) ctx.filter = 'none';

        ctx.globalAlpha = t * (Cfg.scanline_opacity / 100) * 0.7;
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

    // ── Scene_CustomUI 오버라이드 ─────────────────────────────────────────────

    if (typeof Scene_CustomUI !== 'undefined') {
        var _SCU_create = Scene_CustomUI.prototype.create;
        Scene_CustomUI.prototype.create = function () {
            _SCU_create.call(this);
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

})();
