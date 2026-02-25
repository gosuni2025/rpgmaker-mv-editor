/*:
 * @plugindesc [MenuTransition] 메뉴/UI 씬 배경 전환 효과 (canvas blur 애니메이션)
 * @author RPG Maker MV Web Editor
 *
 * @help
 * 메뉴·아이템·스킬 등 UI 씬이 열릴 때 맵 화면이 점점 블러되면서
 * 어두워지는 애니메이션 후 메뉴 UI가 표시됩니다.
 *
 * 렌더링 방식:
 *   - Scene_Map.terminate() → snapForBackground 시점에 맵 스냅샷 취득
 *   - _backgroundSprite.bitmap에 매 프레임 canvas ctx.filter:blur로 그려
 *     블러 강도와 오버레이가 t(0→1)에 따라 점진적으로 강해짐
 *
 * === 효과 종류 (effect) ===
 *   blur+overlay   : 블러 + 어두운 오버레이 (기본값)
 *   blurOnly       : 블러만
 *   overlayOnly    : 블러 없이 어둡게만
 *
 * @param effect
 * @text 효과 종류
 * @type select
 * @option blur+overlay
 * @option blurOnly
 * @option overlayOnly
 * @default blur+overlay
 *
 * @param blur
 * @text 블러 강도 (0-100)
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
 * @text 오버레이 불투명도 (0-255)
 * @type number
 * @min 0
 * @max 255
 * @default 100
 *
 * @param duration
 * @text 전환 시간 (프레임, 60fps 기준)
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
        effect:       String(params.effect       || 'blur+overlay'),
        blur:         Number(params.blur)         >= 0 ? Number(params.blur) : 40,
        overlayColor: String(params.overlayColor  || '0,0,0'),
        overlayAlpha: Number(params.overlayAlpha) >= 0 ? Number(params.overlayAlpha) : 100,
        duration:     Number(params.duration)     || 20,
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

    var _phase      = 0;   // 0=비활성, 1=열기, 2=열림, 3=닫기
    var _t          = 0;
    var _startTime  = 0;
    var _durationMs = 0;
    var _closeCb    = null;
    var _rafId      = null;

    var _needsBlurredSnapshot = false;  // t=1 도달 시 블러 결과 저장 트리거
    var _srcCanvas = null;              // 스냅샷 캔버스 (PostProcess._captureCanvas 복사본)

    // ── 애니메이션 타이머 ─────────────────────────────────────────────────────

    function tick() {
        _rafId = null;
        if (_phase === 0) return;

        var raw = Math.min(1, (Date.now() - _startTime) / Math.max(1, _durationMs));

        if (_phase === 1) {
            _t = applyEase(raw);
            if (raw < 1) { _rafId = requestAnimationFrame(tick); }
            else { _t = 1; _phase = 2; _needsBlurredSnapshot = true; }
        } else if (_phase === 3) {
            _t = applyEase(1 - raw);
            if (raw < 1) { _rafId = requestAnimationFrame(tick); }
            else {
                _t = 0; _phase = 0;
                if (_closeCb) { var cb = _closeCb; _closeCb = null; cb(); }
            }
        }
    }

    function startOpen() {
        if (_rafId) cancelAnimationFrame(_rafId);
        _durationMs = Cfg.duration * (1000 / 60);
        _startTime  = Date.now();
        _phase = 1; _t = 0;
        _rafId = requestAnimationFrame(tick);
    }

    function startClose(cb) {
        if (_phase === 0) { if (cb) cb(); return; }
        if (_rafId) cancelAnimationFrame(_rafId);
        _durationMs = Cfg.duration * (1000 / 60);
        _startTime  = Date.now();
        _phase = 3; _closeCb = cb || null;
        _rafId = requestAnimationFrame(tick);
    }

    // ── 배경 비트맵 업데이트 (canvas ctx.filter 블러) ─────────────────────────

    function updateBgBitmap(bitmap, t) {
        if (!_srcCanvas || !bitmap) return;
        var w = bitmap.width, h = bitmap.height;
        if (w <= 0 || h <= 0) return;

        var ctx = bitmap._context;
        ctx.clearRect(0, 0, w, h);

        // 블러 적용 후 원본 드로우
        if (Cfg.effect !== 'overlayOnly' && Cfg.blur > 0 && t > 0.001) {
            var blurPx = t * Cfg.blur / 100 * 20;
            ctx.filter = 'blur(' + blurPx.toFixed(2) + 'px)';
        }
        ctx.drawImage(_srcCanvas, 0, 0, w, h);
        ctx.filter = 'none';

        // 오버레이
        if (Cfg.effect !== 'blurOnly' && t > 0.001) {
            var oa = (Cfg.overlayAlpha / 255) * t;
            ctx.fillStyle = 'rgba(' + _overlayRGB[0] + ',' + _overlayRGB[1] + ',' + _overlayRGB[2] + ',' + oa + ')';
            ctx.fillRect(0, 0, w, h);
        }

        bitmap._setDirty();
    }

    // ── 디버그: /tmp/rpgmaker-snapshots 에 PNG 저장 ───────────────────────────

    function saveCanvasPng(canvas, name) {
        try {
            var dataUrl = canvas.toDataURL('image/png');
            fetch('/api/debug/save-snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: dataUrl, name: name })
            })
            .then(function (r) { return r.json(); })
            .then(function (j) { console.log('[MenuTransition] 저장됨:', j.path); })
            .catch(function (e) { console.warn('[MenuTransition] 저장 실패:', e); });
        } catch (e) {
            console.warn('[MenuTransition] toDataURL 실패:', e);
        }
    }

    // ── SceneManager.snapForBackground 오버라이드 ─────────────────────────────
    // Scene_Map.terminate()에서 호출 → 이 시점의 _captureCanvas = 맵 화면

    var _origSnapForBg = SceneManager.snapForBackground;
    SceneManager.snapForBackground = function () {
        _origSnapForBg.call(this);

        var cap = (typeof PostProcess !== 'undefined') ? PostProcess._captureCanvas : null;
        if (!cap || cap.width <= 0) {
            console.warn('[MenuTransition] 스냅샷 실패: PostProcess._captureCanvas 없음');
            _srcCanvas = null;
            return;
        }

        // PostProcess._captureCanvas는 다음 프레임에서 덮어쓰일 수 있으므로 복사
        var copy = document.createElement('canvas');
        copy.width  = cap.width;
        copy.height = cap.height;
        copy.getContext('2d').drawImage(cap, 0, 0);
        _srcCanvas = copy;

        saveCanvasPng(_srcCanvas, 'mt-snapshot-raw');
        console.log('[MenuTransition] 스냅샷 취득:', cap.width + 'x' + cap.height);
    };

    // ── Scene_MenuBase 오버라이드 ─────────────────────────────────────────────

    var _SMB_create = Scene_MenuBase.prototype.create;
    Scene_MenuBase.prototype.create = function () {
        _SMB_create.call(this);
        if (!_srcCanvas) return;
        startOpen();
        console.log('[MenuTransition] 메뉴 열기 시작');
    };

    // startFadeIn: MT가 열기 애니메이션을 담당 → 페이드인 즉시 완료
    var _SMB_startFadeIn = Scene_MenuBase.prototype.startFadeIn;
    Scene_MenuBase.prototype.startFadeIn = function (duration, white) {
        if (_phase === 1 || _phase === 2) {
            _SMB_startFadeIn.call(this, 1, white);
        } else {
            _SMB_startFadeIn.call(this, duration, white);
        }
    };

    // update: 매 프레임 배경 비트맵 업데이트
    var _SMB_update = Scene_MenuBase.prototype.update;
    Scene_MenuBase.prototype.update = function () {
        _SMB_update.call(this);

        if (_phase !== 0 && this._backgroundSprite) {
            var bmp = this._backgroundSprite.bitmap;
            if (bmp) updateBgBitmap(bmp, _t);
        }

        // t=1 도달 시 블러 결과 스냅샷 저장 (1회)
        if (_needsBlurredSnapshot && this._backgroundSprite) {
            _needsBlurredSnapshot = false;
            var bmp2 = this._backgroundSprite.bitmap;
            if (bmp2 && bmp2._context) {
                saveCanvasPng(bmp2._context.canvas, 'mt-snapshot-blurred');
            }
        }
    };

    // ── SceneManager.pop 오버라이드 (닫기 애니메이션) ────────────────────────

    if (Cfg.closeAnim) {
        var _origPop = SceneManager.pop;
        SceneManager.pop = function () {
            if (_phase === 3) return;  // 닫기 애니메이션 진행 중 → 추가 pop 무시
            var scene = this._scene;
            if (scene instanceof Scene_MenuBase && _phase !== 0) {
                // _active = false를 설정하지 않음 → update()가 계속 실행되어
                // updateBgBitmap이 매 프레임 호출되고 닫기 애니메이션이 부드럽게 동작
                var mgr = this;
                startClose(function () {
                    _srcCanvas = null;
                    _origPop.call(mgr);
                });
            } else {
                _origPop.call(this);
            }
        };
    }

})();
