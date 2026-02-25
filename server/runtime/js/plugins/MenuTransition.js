/*:
 * @plugindesc [MenuTransition] 메뉴/UI 씬 배경 전환 효과 애니메이션
 * @author RPG Maker MV Web Editor
 *
 * @help
 * 메뉴·아이템·스킬 등 UI 씬이 열릴 때 배경이 부드럽게 블러+페이드됩니다.
 *
 * 렌더링 방식:
 *   - Scene_Map.terminate() → SceneManager.snapForBackground() 시점에
 *     PostProcess._captureCanvas(직전 프레임 맵 화면)를 ctx.filter:blur로 처리
 *   - Scene_MenuBase.createBackground()에서 블러된 비트맵을 배경으로 사용
 *   - 오버레이 Sprite(검은 반투명)를 씬에 추가하여 opacity 애니메이션
 *
 * === 효과 종류 (effect) ===
 *   blur+overlay   : 블러 + 어두운 오버레이 (기본값)
 *   blurOnly       : 블러만
 *   overlayOnly    : 블러 없이 어둡게만
 *
 * === 이징 (easing) ===
 *   easeOut / easeIn / easeInOut / linear
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
 * @default 20
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

    // overlayColor → 'r,g,b' 형식 검증
    var _overlayCSS = (function () {
        var parts = Cfg.overlayColor.split(',').map(function (s) {
            return Math.max(0, Math.min(255, Number(s) || 0));
        });
        while (parts.length < 3) parts.push(0);
        return parts[0] + ',' + parts[1] + ',' + parts[2];
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

    var _MT_phase      = 0;   // 0=비활성, 1=열기, 2=열림, 3=닫기
    var _MT_t          = 0;
    var _MT_startTime  = 0;
    var _MT_durationMs = 0;
    var _MT_closeCb    = null;
    var _MT_animRafId  = null;

    // ── 애니메이션 타이머 ─────────────────────────────────────────────────────

    function MT_tick() {
        _MT_animRafId = null;
        if (_MT_phase === 0) return;

        var now     = Date.now();
        var elapsed = now - _MT_startTime;
        var raw     = Math.min(1, elapsed / Math.max(1, _MT_durationMs));

        if (_MT_phase === 1) {
            _MT_t = applyEase(raw);
            if (raw < 1) {
                _MT_animRafId = requestAnimationFrame(MT_tick);
            } else {
                _MT_t = 1;
                _MT_phase = 2;
            }
        } else if (_MT_phase === 3) {
            _MT_t = applyEase(1 - raw);
            if (raw < 1) {
                _MT_animRafId = requestAnimationFrame(MT_tick);
            } else {
                _MT_t = 0;
                _MT_phase = 0;
                if (_MT_closeCb) { var cb = _MT_closeCb; _MT_closeCb = null; cb(); }
            }
        }
    }

    function MT_startOpen(durationMs) {
        if (_MT_animRafId) cancelAnimationFrame(_MT_animRafId);
        _MT_durationMs = durationMs;
        _MT_startTime  = Date.now();
        _MT_phase      = 1;
        _MT_t          = 0;
        _MT_animRafId  = requestAnimationFrame(MT_tick);
    }

    function MT_startClose(durationMs, cb) {
        if (_MT_phase === 0) { if (cb) cb(); return; }
        if (_MT_animRafId) cancelAnimationFrame(_MT_animRafId);
        _MT_durationMs = durationMs;
        _MT_startTime  = Date.now();
        _MT_phase      = 3;
        _MT_closeCb    = cb || null;
        _MT_animRafId  = requestAnimationFrame(MT_tick);
    }

    // ── 디버그용: canvas를 /tmp/rpgmaker-snapshots 에 저장 ────────────────────

    function MT_saveCanvasPng(canvas, name) {
        try {
            var dataUrl = canvas.toDataURL('image/png');
            fetch('/api/debug/save-snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: dataUrl, name: name })
            })
            .then(function (r) { return r.json(); })
            .then(function (j) { console.log('[MenuTransition] 스냅샷 저장됨:', j.path); })
            .catch(function (e) { console.warn('[MenuTransition] 스냅샷 저장 실패:', e); });
        } catch (e) {
            console.warn('[MenuTransition] toDataURL 실패:', e);
        }
    }

    // ── SceneManager.snapForBackground 오버라이드 ─────────────────────────────
    // Scene_Map.terminate()에서 호출됨.
    // PostProcess.js가 이미 _captureCanvas 기반으로 오버라이드하므로,
    // 여기서는 그 비트맵에 블러 처리를 추가만 함.

    var _origSnapForBg = SceneManager.snapForBackground;
    SceneManager.snapForBackground = function () {
        _origSnapForBg.call(this);  // PostProcess 오버라이드 포함, _backgroundBitmap 설정됨

        // 디버그: 원본 canvas 저장
        var src = (typeof PostProcess !== 'undefined' && PostProcess._captureCanvas &&
                   PostProcess._captureCanvas.width > 0)
                  ? PostProcess._captureCanvas
                  : (this._backgroundBitmap && this._backgroundBitmap._canvas);

        if (!src) {
            console.warn('[MenuTransition] snapForBackground: 소스 canvas 없음');
            return;
        }

        MT_saveCanvasPng(src, 'mt-snapshot-raw.png');

        var useBlur = Cfg.blur > 0 && Cfg.effect !== 'overlayOnly';
        if (!useBlur) {
            console.log('[MenuTransition] snapForBackground: 블러 없음 (effect=' + Cfg.effect + ')');
            return;
        }

        var blurPx = Math.max(1, Math.round(Cfg.blur / 100 * 20));
        try {
            var tmp = document.createElement('canvas');
            tmp.width  = src.width;
            tmp.height = src.height;
            var ctx = tmp.getContext('2d');
            ctx.filter = 'blur(' + blurPx + 'px)';
            ctx.drawImage(src, 0, 0);

            MT_saveCanvasPng(tmp, 'mt-snapshot-blurred.png');

            var bmp = new Bitmap(src.width, src.height);
            bmp._context.drawImage(tmp, 0, 0);
            bmp._setDirty();
            this._backgroundBitmap = bmp;
            console.log('[MenuTransition] snapForBackground: 블러 처리 완료', src.width + 'x' + src.height, 'blur=' + blurPx + 'px');
        } catch (e) {
            console.warn('[MenuTransition] snapForBackground: 블러 처리 실패', e);
        }
    };

    // ── Scene_MenuBase 오버라이드 ─────────────────────────────────────────────

    var _SMB_create = Scene_MenuBase.prototype.create;
    Scene_MenuBase.prototype.create = function () {
        _SMB_create.call(this);

        // 오버레이 Sprite 추가 (overlay 효과용)
        var useOverlay = Cfg.overlayAlpha > 0 && Cfg.effect !== 'blurOnly';
        if (useOverlay) {
            this._mtOverlaySprite = new Sprite();
            this._mtOverlaySprite.bitmap = new Bitmap(Graphics.boxWidth, Graphics.boxHeight);
            this._mtOverlaySprite.bitmap.fillAll('rgba(' + _overlayCSS + ',1)');
            this._mtOverlaySprite.opacity = 0;
            // windowLayer 아래, backgroundSprite 위에 삽입
            var insertIdx = this.children.indexOf(this._windowLayer);
            if (insertIdx >= 0) {
                this.addChildAt(this._mtOverlaySprite, insertIdx);
            } else {
                this.addChild(this._mtOverlaySprite);
            }
        }

        MT_startOpen(Cfg.duration * (1000 / 60));
        console.log('[MenuTransition] Scene_MenuBase.create: 전환 시작 duration=' + Cfg.duration + 'f');
    };

    // startFadeIn: MT가 열기 애니메이션을 담당 → 페이드인 즉시 완료
    var _SMB_startFadeIn = Scene_MenuBase.prototype.startFadeIn;
    Scene_MenuBase.prototype.startFadeIn = function (duration, white) {
        if (_MT_phase === 1 || _MT_phase === 2) {
            _SMB_startFadeIn.call(this, 1, white);
        } else {
            _SMB_startFadeIn.call(this, duration, white);
        }
    };

    // update: 오버레이 opacity 애니메이션
    var _SMB_update = Scene_MenuBase.prototype.update;
    Scene_MenuBase.prototype.update = function () {
        _SMB_update.call(this);
        if (this._mtOverlaySprite) {
            this._mtOverlaySprite.opacity = Math.round(_MT_t * Cfg.overlayAlpha);
        }
    };

    // ── SceneManager.pop 오버라이드 (닫기 애니메이션) ────────────────────────

    if (Cfg.closeAnim) {
        var _pop = SceneManager.pop;
        SceneManager.pop = function () {
            var scene = this._scene;
            if (scene instanceof Scene_MenuBase && _MT_phase !== 3) {
                scene._active = false;
                var mgr = this;
                MT_startClose(Cfg.duration * (1000 / 60), function () {
                    _pop.call(mgr);
                });
            } else {
                _pop.call(this);
            }
        };
    }

})();
