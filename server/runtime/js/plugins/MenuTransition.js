/*:
 * @plugindesc [MenuTransition] 메뉴/UI 씬 배경 전환 효과 애니메이션
 * @author RPG Maker MV Web Editor
 *
 * @help
 * 메뉴·아이템·스킬 등 UI 씬이 열릴 때 배경이 부드럽게 블러+페이드됩니다.
 * RendererStrategy.render 를 후킹하여 실제 렌더 출력에 GPU 블러를 적용합니다.
 *
 * === 효과 종류 (effect) ===
 *   blur+overlay   : 가우시안 블러 + 어두운 오버레이 (기본값)
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

    // overlayColor → [r, g, b] (0-1)
    var _overlayRGB = (function () {
        var parts = Cfg.overlayColor.split(',').map(function (s) { return Math.max(0, Math.min(255, Number(s) || 0)) / 255; });
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

    // ── GLSL Shaders ──────────────────────────────────────────────────────────

    var _VS = [
        'varying vec2 vUv;',
        'void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
    ].join('\n');

    var _COPY_FS = [
        'uniform sampler2D tDiffuse; varying vec2 vUv;',
        'void main() { gl_FragColor = texture2D(tDiffuse, vUv); }'
    ].join('\n');

    // 41-tap 가우시안 블러 (±20 샘플)
    var _BLUR_H_FS = [
        'uniform sampler2D tDiffuse; uniform float sigma; uniform float stepX; varying vec2 vUv;',
        'void main() {',
        '    vec4 c = vec4(0.0); float t = 0.0;',
        '    for (int i = -20; i <= 20; i++) {',
        '        float w = exp(-float(i*i)/(2.0*sigma*sigma));',
        '        float u = clamp(vUv.x + float(i)*stepX, 0.0, 1.0);',
        '        c += texture2D(tDiffuse, vec2(u, vUv.y)) * w; t += w;',
        '    }',
        '    gl_FragColor = c / t;',
        '}'
    ].join('\n');

    var _BLUR_V_FS = [
        'uniform sampler2D tDiffuse; uniform float sigma; uniform float stepY; varying vec2 vUv;',
        'void main() {',
        '    vec4 c = vec4(0.0); float t = 0.0;',
        '    for (int i = -20; i <= 20; i++) {',
        '        float w = exp(-float(i*i)/(2.0*sigma*sigma));',
        '        float v = clamp(vUv.y + float(i)*stepY, 0.0, 1.0);',
        '        c += texture2D(tDiffuse, vec2(vUv.x, v)) * w; t += w;',
        '    }',
        '    gl_FragColor = c / t;',
        '}'
    ].join('\n');

    // 최종 합성: 블러 결과 + 오버레이
    var _COMPOSITE_FS = [
        'uniform sampler2D tDiffuse;',
        'uniform float blurMix;',    // 0=원본, 1=완전블러
        'uniform float overlayAlpha;', // 0-1
        'uniform vec3 overlayColor;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 c = texture2D(tDiffuse, vUv);',
        // blurMix: 블러 텍스처를 원본에 알파 블렌딩 (blurMix=1 이면 완전 블러)
        // overlayAlpha: 위에 추가로 어두운 오버레이
        '    vec3 col = c.rgb;',
        '    col = mix(col, overlayColor, overlayAlpha);',
        '    gl_FragColor = vec4(col, 1.0);',
        '}'
    ].join('\n');

    // ── 렌더 훅 전역 상태 ────────────────────────────────────────────────────

    var _hookInstalled = false;
    var _origRSRender  = null;

    // 메뉴 블러 상태 (0=비활성, 1=열기 중, 2=열려있음, 3=닫기 중)
    var _MT_phase     = 0;
    var _MT_startTime = 0;
    var _MT_t         = 0;   // 현재 진행 (0→1)
    var _MT_closeCb   = null;

    // 배경 스프라이트 참조 (UI 분리 렌더용)
    var _MT_bgSprite   = null;   // Scene_MenuBase._backgroundSprite 참조
    var _MT_bgCaptured = false;  // 배경 블러 완료 여부
    var _MT_bgTex      = null;   // THREE.CanvasTexture (배경 캔버스)

    // Three.js 리소스
    var _MT_captureRT = null;  // 원본 렌더 캡처
    var _MT_blurRT1   = null;  // 소형 텍스처 A
    var _MT_blurRT2   = null;  // 소형 텍스처 B
    var _MT_outputRT  = null;  // 블러 결과 (원본 사이즈)

    var _MT_fsq       = null;
    var _MT_hMat      = null;
    var _MT_vMat      = null;
    var _MT_copyMat   = null;
    var _MT_compMat   = null;  // composite material

    // ── GPU 리소스 초기화/해제 ────────────────────────────────────────────────

    function MT_initResources(renderer, w, h) {
        var rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };

        // 1/8 다운스케일 — 실효 블러 반경 ≈ sigma_small * sqrt(passes) * 8 전체픽셀
        // SCALE=32 는 26×20px → 전체 평균색(회색)이 되므로 SCALE=8 사용
        var SCALE = 8;
        var sw = Math.max(1, Math.round(w / SCALE));
        var sh = Math.max(1, Math.round(h / SCALE));

        function needsNew(rt, pw, ph) { return !rt || rt.width !== pw || rt.height !== ph; }

        if (needsNew(_MT_captureRT, w, h)) {
            if (_MT_captureRT) _MT_captureRT.dispose();
            _MT_captureRT = new THREE.WebGLRenderTarget(w, h, rtOpts);
        }
        if (needsNew(_MT_blurRT1, sw, sh)) {
            if (_MT_blurRT1) _MT_blurRT1.dispose();
            _MT_blurRT1 = new THREE.WebGLRenderTarget(sw, sh, rtOpts);
        }
        if (needsNew(_MT_blurRT2, sw, sh)) {
            if (_MT_blurRT2) _MT_blurRT2.dispose();
            _MT_blurRT2 = new THREE.WebGLRenderTarget(sw, sh, rtOpts);
        }
        if (needsNew(_MT_outputRT, w, h)) {
            if (_MT_outputRT) _MT_outputRT.dispose();
            _MT_outputRT = new THREE.WebGLRenderTarget(w, h, rtOpts);
        }

        if (!_MT_fsq) {
            _MT_fsq = new FullScreenQuad(new THREE.MeshBasicMaterial());
        }

        var sigma = 5.0;  // 소형 텍스처에서의 sigma → full-res ≈ sigma * sqrt(passes) * SCALE

        if (!_MT_copyMat) {
            _MT_copyMat = new THREE.ShaderMaterial({
                uniforms: { tDiffuse: { value: null } },
                vertexShader: _VS, fragmentShader: _COPY_FS,
                depthTest: false, depthWrite: false
            });
        }
        if (!_MT_hMat) {
            _MT_hMat = new THREE.ShaderMaterial({
                uniforms: { tDiffuse: { value: null }, sigma: { value: sigma }, stepX: { value: 1.0 / sw } },
                vertexShader: _VS, fragmentShader: _BLUR_H_FS,
                depthTest: false, depthWrite: false
            });
        } else {
            _MT_hMat.uniforms.sigma.value = sigma;
            _MT_hMat.uniforms.stepX.value = 1.0 / sw;
        }
        if (!_MT_vMat) {
            _MT_vMat = new THREE.ShaderMaterial({
                uniforms: { tDiffuse: { value: null }, sigma: { value: sigma }, stepY: { value: 1.0 / sh } },
                vertexShader: _VS, fragmentShader: _BLUR_V_FS,
                depthTest: false, depthWrite: false
            });
        } else {
            _MT_vMat.uniforms.sigma.value = sigma;
            _MT_vMat.uniforms.stepY.value = 1.0 / sh;
        }
        if (!_MT_compMat) {
            _MT_compMat = new THREE.ShaderMaterial({
                uniforms: {
                    tDiffuse:     { value: null },
                    blurMix:      { value: 0 },
                    overlayAlpha: { value: 0 },
                    overlayColor: { value: new THREE.Vector3(_overlayRGB[0], _overlayRGB[1], _overlayRGB[2]) }
                },
                vertexShader: _VS, fragmentShader: _COMPOSITE_FS,
                depthTest: false, depthWrite: false
            });
        }
    }

    // captureRT → blurRT1/2 (PASSES회 H+V) → outputRT
    function MT_applyBlur(renderer, PASSES) {
        var sw = _MT_blurRT1.width, sh = _MT_blurRT1.height;

        // 1. captureRT → blurRT1 (다운스케일)
        _MT_copyMat.uniforms.tDiffuse.value = _MT_captureRT.texture;
        _MT_fsq.material = _MT_copyMat;
        renderer.setRenderTarget(_MT_blurRT1);
        renderer.clear();
        _MT_fsq.render(renderer);

        // 2. 소형 텍스처에서 PASSES회 H+V 블러 (ping-pong blurRT1 ↔ blurRT2)
        for (var p = 0; p < PASSES; p++) {
            // H: blurRT1 → blurRT2
            _MT_hMat.uniforms.tDiffuse.value = _MT_blurRT1.texture;
            _MT_hMat.uniforms.stepX.value = 1.0 / sw;
            _MT_fsq.material = _MT_hMat;
            renderer.setRenderTarget(_MT_blurRT2);
            renderer.clear();
            _MT_fsq.render(renderer);

            // V: blurRT2 → blurRT1
            _MT_vMat.uniforms.tDiffuse.value = _MT_blurRT2.texture;
            _MT_vMat.uniforms.stepY.value = 1.0 / sh;
            _MT_fsq.material = _MT_vMat;
            renderer.setRenderTarget(_MT_blurRT1);
            renderer.clear();
            _MT_fsq.render(renderer);
        }
        // 결과: blurRT1

        // 3. blurRT1 → outputRT (업스케일)
        _MT_copyMat.uniforms.tDiffuse.value = _MT_blurRT1.texture;
        _MT_fsq.material = _MT_copyMat;
        renderer.setRenderTarget(_MT_outputRT);
        renderer.clear();
        _MT_fsq.render(renderer);
    }

    // ── 배경 캔버스 캡처 & 블러 (1회) ────────────────────────────────────────
    // Scene_MenuBase._backgroundSprite.bitmap 은 이미 게임 월드 스냅샷.
    // 이것을 GPU에 업로드 → 블러 → _MT_outputRT 에 저장.

    function MT_captureBackground(renderer) {
        var bmp    = _MT_bgSprite && _MT_bgSprite.bitmap;
        var canvas = bmp && (bmp._canvas || bmp.canvas);
        if (!canvas) return;

        if (!_MT_bgTex) {
            _MT_bgTex = new THREE.CanvasTexture(canvas);
        }
        _MT_bgTex.needsUpdate = true;

        // 캔버스 → _MT_captureRT (풀해상도)
        _MT_copyMat.uniforms.tDiffuse.value = _MT_bgTex;
        _MT_fsq.material = _MT_copyMat;
        renderer.setRenderTarget(_MT_captureRT);
        renderer.clear();
        _MT_fsq.render(renderer);

        // 블러 적용 → _MT_outputRT
        if (Cfg.effect !== 'overlayOnly' && Cfg.blur > 0) {
            MT_applyBlur(renderer, Math.max(1, Math.round(Cfg.blur / 20)));
        }

        _MT_bgCaptured = true;
    }

    // ── RendererStrategy.render 후킹 ─────────────────────────────────────────
    // ThreeRendererStrategy.js 의 color matrix 후킹과 동일한 패턴.
    // setRenderTarget(null) 를 가로채 → 오프스크린 RT에 렌더 → 블러+오버레이 합성 → 화면 출력.

    function MT_installHook() {
        if (_hookInstalled) return;
        _hookInstalled = true;

        _origRSRender = RendererStrategy.render;
        RendererStrategy.render = function (rendererObj, stage) {
            // MT 비활성: 원본 렌더 그대로
            if (_MT_phase === 0 || _MT_t <= 0) {
                _origRSRender.call(this, rendererObj, stage);
                return;
            }

            var renderer = rendererObj && rendererObj.renderer;
            if (!renderer) {
                _origRSRender.call(this, rendererObj, stage);
                return;
            }

            var w = rendererObj._width;
            var h = rendererObj._height;
            MT_initResources(renderer, w, h);

            // ── 최초 1회: 배경 캔버스 캡처 & 블러 ──────────────────────────
            if (!_MT_bgCaptured) {
                MT_captureBackground(renderer);
            }

            // 배경 캡처 실패 시 폴백 (전체 프레임 캡처 방식)
            if (!_MT_bgCaptured) {
                var origSetRT = renderer.setRenderTarget.bind(renderer);
                renderer.setRenderTarget = function (target) {
                    origSetRT(target === null ? _MT_captureRT : target);
                };
                _origRSRender.call(this, rendererObj, stage);
                renderer.setRenderTarget = origSetRT;

                var needBlurFb = (Cfg.effect !== 'overlayOnly') && (Cfg.blur > 0);
                if (needBlurFb) MT_applyBlur(renderer, Math.max(1, Math.round(Cfg.blur / 20)));

                var tfb = _MT_t;
                var oafb = (Cfg.effect === 'blurOnly') ? 0 : (Cfg.overlayAlpha / 255 * tfb);
                _MT_compMat.uniforms.tDiffuse.value     = needBlurFb ? _MT_outputRT.texture : _MT_captureRT.texture;
                _MT_compMat.uniforms.blurMix.value      = tfb;
                _MT_compMat.uniforms.overlayAlpha.value = oafb;
                _MT_fsq.material = _MT_compMat;
                renderer.setRenderTarget(null);
                _MT_fsq.render(renderer);
                return;
            }

            // ── 정상 경로: 블러 배경 + UI 분리 렌더 ────────────────────────
            var t  = _MT_t;
            var needBlur = (Cfg.effect !== 'overlayOnly') && (Cfg.blur > 0);
            var bgTex = needBlur ? _MT_outputRT.texture : _MT_captureRT.texture;
            var oa = (Cfg.effect === 'blurOnly') ? 0 : (Cfg.overlayAlpha / 255 * t);

            // 1. 블러된 배경 → 화면 (클리어 후 그리기)
            _MT_compMat.uniforms.tDiffuse.value     = bgTex;
            _MT_compMat.uniforms.blurMix.value      = t;
            _MT_compMat.uniforms.overlayAlpha.value = oa;
            _MT_fsq.material = _MT_compMat;
            renderer.setRenderTarget(null);
            _MT_fsq.render(renderer);

            // 2. 배경 스프라이트 숨기고 UI만 위에 렌더 (화면 클리어 없이)
            if (_MT_bgSprite) _MT_bgSprite.visible = false;
            renderer.autoClear = false;
            _origRSRender.call(this, rendererObj, stage);
            renderer.autoClear = true;
            if (_MT_bgSprite) _MT_bgSprite.visible = true;
        };
    }

    // ── 애니메이션 타이머 (requestAnimationFrame 기반) ───────────────────────

    var _MT_animRafId = null;
    var _MT_durationMs = 0;

    function MT_tick() {
        _MT_animRafId = null;
        if (_MT_phase === 0) return;

        var now = Date.now();
        var elapsed = now - _MT_startTime;
        var raw = Math.min(1, elapsed / Math.max(1, _MT_durationMs));

        if (_MT_phase === 1) {
            // 열기
            _MT_t = applyEase(raw);
            if (raw < 1) {
                _MT_animRafId = requestAnimationFrame(MT_tick);
            } else {
                _MT_t = 1;
                _MT_phase = 2;
            }
        } else if (_MT_phase === 3) {
            // 닫기
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

    // ── Scene_MenuBase 오버라이드 ─────────────────────────────────────────────

    var _SMB_create = Scene_MenuBase.prototype.create;
    Scene_MenuBase.prototype.create = function () {
        MT_installHook();
        _SMB_create.call(this);
        // createBackground() 이후에 _backgroundSprite 가 설정됨
        _MT_bgSprite   = this._backgroundSprite || null;
        _MT_bgCaptured = false;
        if (_MT_bgTex) { _MT_bgTex.dispose(); _MT_bgTex = null; }
        MT_startOpen(Cfg.duration * (1000 / 60));
    };

    // startFadeIn: MT가 열기 애니메이션을 담당 → 검은 화면 페이드인 즉시 완료
    var _SMB_startFadeIn = Scene_MenuBase.prototype.startFadeIn;
    Scene_MenuBase.prototype.startFadeIn = function (duration, white) {
        if (_MT_phase === 1 || _MT_phase === 2) {
            _SMB_startFadeIn.call(this, 1, white);
        } else {
            _SMB_startFadeIn.call(this, duration, white);
        }
    };

    // ── SceneManager.pop 오버라이드 (닫기 애니메이션) ────────────────────────

    if (Cfg.closeAnim && typeof SceneManager !== 'undefined') {
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
