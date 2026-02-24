/*:
 * @plugindesc [MenuTransition] 메뉴/UI 씬 배경 전환 효과 애니메이션
 * @author RPG Maker MV Web Editor
 *
 * @help
 * 메뉴·아이템·스킬 등 UI 씬이 열릴 때 배경이 부드럽게 전환됩니다.
 * PostProcess.js 이후에 로드해야 합니다.
 *
 * === 효과 종류 (effect) ===
 *   blur+overlay   : 가우시안 블러 + 어두운 오버레이 (기본값)
 *   blurOnly       : 블러만
 *   overlayOnly    : 선명한 배경 + 어둡게
 *   desaturate     : 채도 제거 + 약한 블러 + 어두운 오버레이
 *   frosted        : 강한 블러 + 밝은 반투명 오버레이 (iOS 스타일)
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
 * @option desaturate
 * @option frosted
 * @default blur+overlay
 *
 * @param blur
 * @text 블러 강도 (px)
 * @type number
 * @min 0
 * @max 30
 * @default 12
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
 * @default 120
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
        blur:         Number(params.blur)         || 12,
        overlayColor: String(params.overlayColor  || '0,0,0'),
        overlayAlpha: Number(params.overlayAlpha) >= 0 ? Number(params.overlayAlpha) : 120,
        duration:     Number(params.duration)     || 20,
        easing:       String(params.easing        || 'easeOut'),
        closeAnim:    String(params.closeAnim) !== 'false'
    };

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

    // ── 후처리 비트맵 생성 ────────────────────────────────────────────────────
    // rawBitmap 을 받아 CSS filter + 오버레이를 적용한 새 Bitmap 반환.

    function buildProcessedBitmap(rawBitmap) {
        var w = rawBitmap.width, h = rawBitmap.height;
        if (!w || !h) return null;

        var dst    = new Bitmap(w, h);
        var ctx    = dst._context;
        var srcCvs = rawBitmap._canvas;

        // --- CSS filter 결정 ---
        var filterStr = '';
        switch (Cfg.effect) {
            case 'blur+overlay':
            case 'blurOnly':
                if (Cfg.blur > 0) filterStr = 'blur(' + Cfg.blur + 'px)';
                break;
            case 'desaturate':
                // 채도 제거 + 약한 블러
                filterStr = 'saturate(15%)' +
                    (Cfg.blur > 0 ? ' blur(' + (Cfg.blur * 0.4 | 0) + 'px)' : '');
                break;
            case 'frosted':
                filterStr = 'blur(' + Math.max(Cfg.blur, 14) + 'px) brightness(1.05)';
                break;
            case 'overlayOnly':
                filterStr = '';
                break;
        }

        // --- 그리기 (blur 엣지 번짐 방지: 약간 크게 drawImage) ---
        if (filterStr) {
            ctx.filter = filterStr;
            var ex = Cfg.blur * 2;
            ctx.drawImage(srcCvs, -ex, -ex, w + ex * 2, h + ex * 2);
            ctx.filter = 'none';
        } else {
            ctx.drawImage(srcCvs, 0, 0);
        }

        // --- 오버레이 ---
        var a = Cfg.overlayAlpha / 255;
        switch (Cfg.effect) {
            case 'blur+overlay':
            case 'overlayOnly':
            case 'desaturate':
                if (a > 0) {
                    ctx.fillStyle = 'rgba(' + Cfg.overlayColor + ',' + a.toFixed(3) + ')';
                    ctx.fillRect(0, 0, w, h);
                }
                break;
            case 'frosted':
                // 밝은 반투명 오버레이
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(0, 0, w, h);
                break;
            // blurOnly: 오버레이 없음
        }

        dst._setDirty();
        return dst;
    }

    // ── Scene_MenuBase 오버라이드 ─────────────────────────────────────────────
    // 주의: SceneManager.updateMain의 while 루프가 한 프레임에 최대 15회 update()를
    // 호출하므로 프레임 카운트 방식은 animation이 즉시 완료되어버림.
    // 반드시 Date.now() 기반 wall-clock 타이밍을 사용해야 함.

    var _SMB_create = Scene_MenuBase.prototype.create;
    Scene_MenuBase.prototype.create = function () {
        _SMB_create.call(this);
        this._mtDurationMs  = Cfg.duration * (1000 / 60); // 프레임 → ms 변환
        this._mtStartTime   = null;   // 첫 _updateMT 호출 시 기록
        this._mtClosing     = false;
        this._mtCloseTime   = null;   // 닫기 시작 시각
        this._mtCloseFrom   = 255;    // 닫기 시작 시점의 overlay opacity
        this._mtDone        = false;
        this._mtCloseCb     = null;
    };

    // createBackground: 원본 스프라이트(불투명) + 후처리 스프라이트(opacity 0→255)
    Scene_MenuBase.prototype.createBackground = function () {
        var raw = SceneManager.backgroundBitmap();
        this._backgroundSprite = new Sprite();
        this._backgroundSprite.bitmap = raw;
        this.addChild(this._backgroundSprite);

        if (raw && raw.width > 0) {
            var processed = buildProcessedBitmap(raw);
            if (processed) {
                this._mtOverlay = new Sprite();
                this._mtOverlay.bitmap = processed;
                this._mtOverlay.opacity = 0;
                this.addChild(this._mtOverlay);
            }
        }
    };

    var _SMB_update = Scene_MenuBase.prototype.update;
    Scene_MenuBase.prototype.update = function () {
        _SMB_update.call(this);
        this._updateMT();
    };

    Scene_MenuBase.prototype._updateMT = function () {
        var spr = this._mtOverlay;
        if (!spr) return;

        var now = Date.now();

        if (!this._mtClosing) {
            // ── 열기 애니메이션: wall-clock 기반
            if (!this._mtStartTime) this._mtStartTime = now;
            var t = Math.min(1, (now - this._mtStartTime) / this._mtDurationMs);
            spr.opacity = Math.round(applyEase(t) * 255);
        } else {
            // ── 닫기 애니메이션: 시작 시각 기록 후 역방향
            if (!this._mtCloseTime) {
                this._mtCloseTime = now;
                this._mtCloseFrom = spr.opacity;
            }
            var tc = Math.min(1, (now - this._mtCloseTime) / this._mtDurationMs);
            spr.opacity = Math.round((1 - applyEase(tc)) * this._mtCloseFrom);
            if (tc >= 1 && !this._mtDone) {
                this._mtDone = true;
                if (this._mtCloseCb) {
                    var cb = this._mtCloseCb;
                    this._mtCloseCb = null;
                    cb();
                }
            }
        }
    };

    // ── SceneManager.pop 오버라이드 (닫기 애니메이션) ────────────────────────
    // pop() 호출 시 Scene_MenuBase 계열이면 닫기 애니메이션 먼저 실행 후 실제 pop.

    if (Cfg.closeAnim && typeof SceneManager !== 'undefined') {
        var _pop = SceneManager.pop;
        SceneManager.pop = function () {
            var scene = this._scene;
            if (scene instanceof Scene_MenuBase &&
                    scene._mtDurationMs > 0 && !scene._mtClosing) {
                scene._active    = false;   // 입력 비활성화 (씬은 계속 update)
                scene._mtClosing = true;
                var mgr = this;
                scene._mtCloseCb = function () { _pop.call(mgr); };
            } else {
                _pop.call(this);
            }
        };
    }

})();
