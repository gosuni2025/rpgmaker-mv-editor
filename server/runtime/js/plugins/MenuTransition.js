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

    // ── Three.js 2-pass Gaussian Blur ─────────────────────────────────────────
    // PostProcess._composer.renderer (THREE.WebGLRenderer) 로 렌더링.
    // flipY=false → readRenderTargetPixels 에서 Y flip 불필요.

    var _BLUR_VS = [
        'varying vec2 vUv;',
        'void main() {',
        '    vUv = uv;',
        '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
    ].join('\n');

    // 25-tap 가우시안: sigma = blurPx / 3.5, ±12 샘플
    var _BLUR_H_FS = [
        'uniform sampler2D tDiffuse;',
        'uniform float sigma;',
        'uniform float stepX;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 c = vec4(0.0); float t = 0.0;',
        '    for (int i = -12; i <= 12; i++) {',
        '        float w = exp(-float(i * i) / (2.0 * sigma * sigma));',
        '        c += texture2D(tDiffuse, vUv + vec2(float(i) * stepX, 0.0)) * w;',
        '        t += w;',
        '    }',
        '    gl_FragColor = c / t;',
        '}'
    ].join('\n');

    var _BLUR_V_FS = [
        'uniform sampler2D tDiffuse;',
        'uniform float sigma;',
        'uniform float stepY;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 c = vec4(0.0); float t = 0.0;',
        '    for (int i = -12; i <= 12; i++) {',
        '        float w = exp(-float(i * i) / (2.0 * sigma * sigma));',
        '        c += texture2D(tDiffuse, vUv + vec2(0.0, float(i) * stepY)) * w;',
        '        t += w;',
        '    }',
        '    gl_FragColor = c / t;',
        '}'
    ].join('\n');

    function blurBitmapThreeJS(srcBitmap, blurPx) {
        var renderer = PostProcess._composer && PostProcess._composer.renderer;
        if (!renderer) {
            console.warn('[MT] renderer 없음 → 블러 스킵');
            return null;
        }

        var w = srcBitmap.width, h = srcBitmap.height;
        if (!w || !h) return null;

        // flipY=false: canvas top → GPU bottom → readback 시 y=0 = canvas top (flip 불필요)
        var srcTex = new THREE.CanvasTexture(srcBitmap._canvas);
        srcTex.flipY = false;
        srcTex.minFilter = THREE.LinearFilter;
        srcTex.magFilter = THREE.LinearFilter;
        srcTex.needsUpdate = true;

        var rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
        var rt1 = new THREE.WebGLRenderTarget(w, h, rtOpts);
        var rt2 = new THREE.WebGLRenderTarget(w, h, rtOpts);

        var sigma = Math.max(1.0, blurPx / 3.5);

        // Pass 1: 수평 블러
        var hMat = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: srcTex },
                sigma:    { value: sigma },
                stepX:    { value: 1.0 / w }
            },
            vertexShader:   _BLUR_VS,
            fragmentShader: _BLUR_H_FS,
            depthTest: false, depthWrite: false
        });
        var fsq = new FullScreenQuad(hMat);
        renderer.setRenderTarget(rt1);
        renderer.clear();
        fsq.render(renderer);

        // Pass 2: 수직 블러
        var vMat = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: rt1.texture },
                sigma:    { value: sigma },
                stepY:    { value: 1.0 / h }
            },
            vertexShader:   _BLUR_VS,
            fragmentShader: _BLUR_V_FS,
            depthTest: false, depthWrite: false
        });
        fsq.material = vMat;
        renderer.setRenderTarget(rt2);
        renderer.clear();
        fsq.render(renderer);
        renderer.setRenderTarget(null);

        // 픽셀 읽기 (flipY=false → y=0 이 canvas 상단, Y flip 불필요)
        var pixels = new Uint8Array(w * h * 4);
        renderer.readRenderTargetPixels(rt2, 0, 0, w, h, pixels);

        var dst = new Bitmap(w, h);
        var imgData = dst._context.createImageData(w, h);
        imgData.data.set(pixels);
        dst._context.putImageData(imgData, 0, 0);
        dst._setDirty();

        // 정리
        rt1.dispose(); rt2.dispose();
        srcTex.dispose(); hMat.dispose(); vMat.dispose(); fsq.dispose();

        return dst;
    }

    // ── 후처리 비트맵 생성 ────────────────────────────────────────────────────
    // blur: Three.js 렌더 패스, overlay: canvas 2D fillRect

    function buildProcessedBitmap(rawBitmap) {
        var w = rawBitmap.width, h = rawBitmap.height;
        if (!w || !h) return null;

        // --- 블러 강도 결정 ---
        var blurPx = 0;
        switch (Cfg.effect) {
            case 'blur+overlay': case 'blurOnly':
                blurPx = Cfg.blur;
                break;
            case 'desaturate':
                blurPx = (Cfg.blur * 0.4) | 0;
                break;
            case 'frosted':
                blurPx = Math.max(Cfg.blur, 14);
                break;
        }

        // --- Three.js blur ---
        var blurredBitmap = (blurPx > 0) ? blurBitmapThreeJS(rawBitmap, blurPx) : null;
        var srcBitmap = blurredBitmap || rawBitmap;

        // --- dst 에 복사 + 오버레이 ---
        var dst = new Bitmap(w, h);
        var ctx = dst._context;

        // desaturate: CSS saturate 필터 (blur 와 달리 간단한 색상 변환이므로 canvas filter 사용)
        if (Cfg.effect === 'desaturate') {
            var tmp = document.createElement('canvas');
            tmp.width = w; tmp.height = h;
            var tctx = tmp.getContext('2d');
            tctx.filter = 'saturate(15%)';
            tctx.drawImage(srcBitmap._canvas, 0, 0);
            tctx.filter = 'none';
            ctx.drawImage(tmp, 0, 0);
        } else {
            ctx.drawImage(srcBitmap._canvas, 0, 0);
        }

        // 오버레이 색상 (canvas 2D fillRect — filter 불필요)
        var a = Cfg.overlayAlpha / 255;
        switch (Cfg.effect) {
            case 'blur+overlay': case 'overlayOnly': case 'desaturate':
                if (a > 0) {
                    ctx.fillStyle = 'rgba(' + Cfg.overlayColor + ',' + a.toFixed(3) + ')';
                    ctx.fillRect(0, 0, w, h);
                }
                break;
            case 'frosted':
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(0, 0, w, h);
                break;
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
        // _SMB_create 내부에서 createBackground()가 호출되므로
        // 반드시 먼저 초기화해야 함
        this._mtDurationMs  = Cfg.duration * (1000 / 60); // 프레임 → ms 변환
        this._mtStartTime   = null;   // 첫 _updateMT 호출 시 기록
        this._mtClosing     = false;
        this._mtCloseTime   = null;   // 닫기 시작 시각
        this._mtCloseFrom   = 255;    // 닫기 시작 시점의 overlay opacity
        this._mtDone        = false;
        this._mtCloseCb     = null;
        _SMB_create.call(this);
    };

    // startFadeIn 오버라이드: MT 애니메이션이 열기를 담당하므로
    // Scene_MenuBase 의 검은 화면 fade-in 을 1프레임으로 단축.
    var _SMB_startFadeIn = Scene_MenuBase.prototype.startFadeIn;
    Scene_MenuBase.prototype.startFadeIn = function (duration, white) {
        if (this._mtOverlay && !this._mtClosing) {
            _SMB_startFadeIn.call(this, 1, white);
        } else {
            _SMB_startFadeIn.call(this, duration, white);
        }
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
