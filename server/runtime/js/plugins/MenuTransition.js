/*:
 * @plugindesc [MenuTransition] 메뉴/UI 씬 배경 전환 효과 (canvas blur 애니메이션)
 * @author RPG Maker MV Web Editor
 *
 * @help
 * 메뉴·아이템·스킬 등 UI 씬이 열릴 때 지정한 전환 효과로 맵 화면이 변화하며
 * 메뉴 UI가 표시됩니다. 메뉴를 닫으면 PostProcess 셰이더로 역방향 효과를 해제합니다.
 *
 * 렌더링 방식:
 *   열기: snapForBackground 스냅샷에 canvas 2D 효과 적용 (0→최대)
 *   닫기: PostProcess.setTransitionEffect()로 동일 효과 적용 (최대→0)
 *         라이브 게임이 효과 뒤에서 실행 → 부활 글리치가 가려짐
 *
 * 타이밍 방식:
 *   - Scene_MenuBase.update() / Scene_Base.update() 호출마다 프레임 카운터 증가
 *   - 게임 루프가 블로킹되면 애니메이션도 일시정지 → 재개 시 이어서 진행
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

    // overlayColor 'r,g,b' → [r, g, b]
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

    // ── 상태 ─────────────────────────────────────────────────────────────────

    var _phase   = 0;   // 0=비활성, 1=열기, 2=열림
    var _t       = 0;
    var _elapsed = 0;

    var _srcCanvas = null;  // 스냅샷 캔버스 (열기 애니메이션용)

    var _suppressNextFadeOut = false;
    var _suppressNextFadeIn  = false;

    // 닫기 PostProcess 상태
    var _mapBlurPending = false;  // 다음 씬 start()에서 효과 시작
    var _mapBlurStartT  = 1;      // 닫힐 때의 _t (시작 강도)
    var _mapBlurPhase   = false;  // 게임씬에서 효과 페이드 중

    // ── PostProcess transition effect 헬퍼 (닫기용) ───────────────────────────

    // t: 0~1 (1=최대 강도, 0=효과 없음)
    // PostProcess 없을 때는 blur CSS fallback
    function _applyTransitionEffect(t) {
        if (typeof PostProcess !== 'undefined' && PostProcess.setTransitionEffect) {
            if (t <= 0.001) {
                PostProcess.clearTransitionEffects();
                return;
            }
            var type = Cfg.transitionEffect || 'blur';
            if (type === 'blur') {
                PostProcess.setTransitionBlur(t * Cfg.blur / 100 * 20);
            } else {
                PostProcess.setTransitionEffect(type, t);
                if (type === 'ripple') PostProcess.setTransitionRippleTime(t);
            }
        } else {
            // PostProcess 없을 때 CSS blur fallback
            var px = t > 0.001 ? t * Cfg.blur / 100 * 20 : 0;
            var canvas = Graphics._canvas;
            if (canvas) canvas.style.filter = px > 0 ? 'blur(' + px.toFixed(2) + 'px)' : '';
        }
    }

    // ── PostProcess.menuBgHook: 메뉴 씬 렌더링 중 bloom만 비활성화 ─────────────

    function _setMenuBgHook(active) {
        if (typeof PostProcess === 'undefined') return;
        if (active) {
            PostProcess.menuBgHook = {
                preRender: function (renderer, composer) {
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
            };
        } else {
            PostProcess.menuBgHook = null;
        }
    }

    // ── 열기 애니메이션 ───────────────────────────────────────────────────────

    function startOpen() {
        _elapsed = 0;
        _phase = 1;
        _t = 0;
        _mapBlurPending = false;
        _applyTransitionEffect(0);  // 혹시 남아있는 PostProcess 효과 제거
        _setMenuBgHook(true);
    }

    // ── 배경 비트맵 업데이트 (열기 — canvas 2D 효과) ─────────────────────────

    // 효과별 CSS filter 문자열 반환 (null이면 filter 없음)
    function _openCssFilter(type, t) {
        var blurPx = (t * Cfg.blur / 100 * 20).toFixed(2);
        switch (type) {
            case 'blur':         return 'blur(' + blurPx + 'px)';
            case 'zoomBlur':     return 'blur(' + (t * Cfg.blur / 100 * 10).toFixed(2) + 'px)';
            case 'desaturation': return 'grayscale(' + (t * 100).toFixed(0) + '%)';
            case 'sepia':        return 'sepia(' + (t * 100).toFixed(0) + '%)';
            case 'ripple':       return 'blur(' + (t * Cfg.blur / 100 * 8).toFixed(2) + 'px)';
            case 'whirl':        return 'blur(' + (t * Cfg.blur / 100 * 8).toFixed(2) + 'px)';
            case 'dissolve':     return 'blur(' + (t * Cfg.blur / 100 * 5).toFixed(2) + 'px)';
            default:             return null;
        }
    }

    function updateBgBitmap(bitmap, t) {
        if (!_srcCanvas || !bitmap) return;
        var w = bitmap.width, h = bitmap.height;
        if (w <= 0 || h <= 0) return;

        var ctx = bitmap._context;
        ctx.clearRect(0, 0, w, h);

        var type = Cfg.transitionEffect || 'blur';

        if (t > 0.001) {
            if (type === 'brightness') {
                // 흰색 오버레이 강도 증가 (화이트아웃)
                ctx.drawImage(_srcCanvas, 0, 0, w, h);
                ctx.globalAlpha = t;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.globalAlpha = 1;

            } else if (type === 'pixelation') {
                // 저해상도 캔버스에 그린 뒤 확대 (nearest neighbor)
                var scale = Math.max(1, Math.round(t * 20));
                var sw = Math.max(1, Math.floor(w / scale));
                var sh = Math.max(1, Math.floor(h / scale));
                var offCanvas = document.createElement('canvas');
                offCanvas.width = sw;
                offCanvas.height = sh;
                offCanvas.getContext('2d').drawImage(_srcCanvas, 0, 0, sw, sh);
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(offCanvas, 0, 0, sw, sh, 0, 0, w, h);
                ctx.imageSmoothingEnabled = true;

            } else if (type === 'scanline') {
                // 원본 그린 후 가로 줄 오버레이
                ctx.drawImage(_srcCanvas, 0, 0, w, h);
                ctx.globalAlpha = t * 0.6;
                ctx.fillStyle = '#000000';
                for (var sy = 0; sy < h; sy += 4) ctx.fillRect(0, sy, w, 2);
                ctx.globalAlpha = 1;

            } else if (type === 'chromatic') {
                // R/G/B 채널을 다른 위치에 합성 (색수차 근사)
                var cOff = Math.round(t * 10);
                ctx.drawImage(_srcCanvas, 0, 0, w, h);
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = t * 0.35;
                ctx.drawImage(_srcCanvas,  cOff, 0, w, h);
                ctx.drawImage(_srcCanvas, -cOff, 0, w, h);
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'source-over';

            } else {
                // CSS filter 기반 효과 (blur, zoomBlur, desaturation, sepia, ripple, whirl, dissolve 등)
                var f = _openCssFilter(type, t);
                if (f) ctx.filter = f;
                ctx.drawImage(_srcCanvas, 0, 0, w, h);
                ctx.filter = 'none';
            }
        } else {
            ctx.drawImage(_srcCanvas, 0, 0, w, h);
        }

        // 어두운 오버레이 (overlayAlpha > 0일 때)
        if (Cfg.overlayAlpha > 0 && t > 0.001) {
            var oa = (Cfg.overlayAlpha / 255) * t;
            ctx.fillStyle = 'rgba(' + _overlayRGB[0] + ',' + _overlayRGB[1] + ',' + _overlayRGB[2] + ',' + oa + ')';
            ctx.fillRect(0, 0, w, h);
        }

        bitmap._setDirty();
    }

    // ── SceneManager.snapForBackground 오버라이드 ─────────────────────────────

    var _origSnapForBg = SceneManager.snapForBackground;
    SceneManager.snapForBackground = function () {
        _origSnapForBg.call(this);

        var cap = (typeof PostProcess !== 'undefined') ? PostProcess._captureCanvas : null;
        if (!cap || cap.width <= 0) {
            console.warn('[MenuTransition] 스냅샷 실패: PostProcess._captureCanvas 없음');
            _srcCanvas = null;
            return;
        }

        var copy = document.createElement('canvas');
        copy.width  = cap.width;
        copy.height = cap.height;
        copy.getContext('2d').drawImage(cap, 0, 0);
        _srcCanvas = copy;
    };

    // ── Scene_MenuBase 오버라이드 ─────────────────────────────────────────────

    var _SMB_create = Scene_MenuBase.prototype.create;
    Scene_MenuBase.prototype.create = function () {
        _SMB_create.call(this);
        if (!_srcCanvas) return;
        startOpen();
    };

    var _SMB_terminate = Scene_MenuBase.prototype.terminate;
    Scene_MenuBase.prototype.terminate = function () {
        _SMB_terminate.call(this);
        _setMenuBgHook(false);
    };

    // startFadeIn: 열기 애니메이션이 담당 → 즉시 완료
    var _SMB_startFadeIn = Scene_MenuBase.prototype.startFadeIn;
    Scene_MenuBase.prototype.startFadeIn = function (duration, white) {
        if (_phase === 1 || _phase === 2) {
            _SMB_startFadeIn.call(this, 1, white);
        } else {
            _SMB_startFadeIn.call(this, duration, white);
        }
    };

    // startFadeOut: 닫기 시 즉시 완료 → 바로 씬 전환
    var _SMB_startFadeOut = Scene_MenuBase.prototype.startFadeOut;
    Scene_MenuBase.prototype.startFadeOut = function (duration, white) {
        if (_suppressNextFadeOut) {
            _suppressNextFadeOut = false;
            return;
        }
        _SMB_startFadeOut.call(this, duration, white);
    };

    // 복귀씬 페이드인 억제 (PostProcess 효과가 전환 담당)
    var _SB_startFadeIn = Scene_Base.prototype.startFadeIn;
    Scene_Base.prototype.startFadeIn = function (duration, white) {
        if (_suppressNextFadeIn) {
            _suppressNextFadeIn = false;
            return;
        }
        _SB_startFadeIn.call(this, duration, white);
    };

    // 메뉴씬 update: 열기 애니메이션 (canvas 2D)
    var _SMB_update = Scene_MenuBase.prototype.update;
    Scene_MenuBase.prototype.update = function () {
        _SMB_update.call(this);

        if (_phase === 0 || !this._backgroundSprite) return;

        if (_phase === 1) {
            _elapsed++;
            var raw = Math.min(1, _elapsed / Cfg.duration);
            _t = applyEase(raw);
            if (raw >= 1) { _t = 1; _phase = 2; }
        }

        var bmp = this._backgroundSprite.bitmap;
        if (bmp) updateBgBitmap(bmp, _t);
    };

    // ── Scene_Base 오버라이드 (닫기 PostProcess 효과 페이드) ──────────────────

    var _SB_start = Scene_Base.prototype.start;
    Scene_Base.prototype.start = function () {
        _SB_start.call(this);
        if (_mapBlurPending && !(this instanceof Scene_MenuBase)) {
            _mapBlurPending = false;
            _mapBlurPhase = true;
            _elapsed = 0;
            _t = _mapBlurStartT;
            _applyTransitionEffect(_mapBlurStartT);
        }
    };

    var _SB_update = Scene_Base.prototype.update;
    Scene_Base.prototype.update = function () {
        _SB_update.call(this);
        if (!_mapBlurPhase) return;

        _elapsed++;
        var raw = Math.min(1, _elapsed / Cfg.duration);
        _t = _mapBlurStartT * applyEase(1 - raw);
        _applyTransitionEffect(_t);

        if (raw >= 1) {
            _applyTransitionEffect(0);
            _mapBlurPhase = false;
            _srcCanvas = null;
        }
    };

    // ── SceneManager.pop 오버라이드 (닫기) ───────────────────────────────────

    if (Cfg.closeAnim) {
        var _origPop = SceneManager.pop;
        SceneManager.pop = function () {
            var scene = this._scene;
            if (scene instanceof Scene_MenuBase && _phase !== 0) {
                _mapBlurStartT       = _t;
                _suppressNextFadeOut = true;
                _suppressNextFadeIn  = true;
                _mapBlurPending      = true;
                _setMenuBgHook(false);
                _phase = 0;
            }
            _origPop.call(this);
        };
    }

})();
