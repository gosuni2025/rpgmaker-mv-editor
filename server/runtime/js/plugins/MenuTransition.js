/*:
 * @plugindesc [MenuTransition] 메뉴/UI 씬 배경 전환 효과 애니메이션
 * @author RPG Maker MV Web Editor
 *
 * @help
 * 메뉴·아이템·스킬 등 UI 씬이 열릴 때 배경이 부드럽게 블러+페이드됩니다.
 *
 * 렌더링 방식: 씬위에 씬 (scene-on-scene)
 *   1. SceneManager._stack 에서 이전 씬(Scene_Map)을 오프스크린 RT에 렌더링
 *   2. 해당 프레임에 블러 + 오버레이 적용
 *   3. 처리된 배경을 화면에 출력
 *   4. 현재 메뉴 씬을 autoClear=false 로 그 위에 렌더링
 *
 * 따라서 배경 게임 화면이 실시간으로 계속 업데이트됩니다.
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

    // 최종 합성: 배경(블러/원본) + 오버레이
    var _COMPOSITE_FS = [
        'uniform sampler2D tDiffuse;',
        'uniform float overlayAlpha;',  // 0-1
        'uniform vec3 overlayColor;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 c = texture2D(tDiffuse, vUv);',
        '    vec3 col = mix(c.rgb, overlayColor, overlayAlpha);',
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

    var _MT_bgSprite  = null;   // Scene_MenuBase._backgroundSprite (숨김 처리용)

    // Three.js 리소스
    var _MT_captureRT = null;  // 이전 씬 렌더 캡처
    var _MT_blurRT1   = null;  // 소형 텍스처 A (블러 ping-pong)
    var _MT_blurRT2   = null;  // 소형 텍스처 B (블러 ping-pong)
    var _MT_outputRT  = null;  // 블러/처리 결과 (원본 사이즈)

    var _MT_fsq       = null;
    var _MT_hMat      = null;
    var _MT_vMat      = null;
    var _MT_copyMat   = null;
    var _MT_compMat   = null;

    // ── GPU 리소스 초기화/해제 ────────────────────────────────────────────────

    function MT_initResources(renderer, w, h) {
        var rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };

        // 1/4 다운스케일 — 블러 텍스처용
        var SCALE = 4;
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

        // sigma: blur=0 → 스킵, blur=30 → 2.4, blur=100 → 8
        var sigma = Math.max(0.1, Cfg.blur / 100 * 8);

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

        // 1. captureRT → blurRT1 (다운스케일 복사)
        _MT_copyMat.uniforms.tDiffuse.value = _MT_captureRT.texture;
        _MT_fsq.material = _MT_copyMat;
        renderer.setRenderTarget(_MT_blurRT1);
        renderer.clear();
        _MT_fsq.render(renderer);

        // 2. 소형 텍스처에서 PASSES회 H+V 블러 (ping-pong)
        for (var p = 0; p < PASSES; p++) {
            _MT_hMat.uniforms.tDiffuse.value = _MT_blurRT1.texture;
            _MT_hMat.uniforms.stepX.value = 1.0 / sw;
            _MT_fsq.material = _MT_hMat;
            renderer.setRenderTarget(_MT_blurRT2);
            renderer.clear();
            _MT_fsq.render(renderer);

            _MT_vMat.uniforms.tDiffuse.value = _MT_blurRT2.texture;
            _MT_vMat.uniforms.stepY.value = 1.0 / sh;
            _MT_fsq.material = _MT_vMat;
            renderer.setRenderTarget(_MT_blurRT1);
            renderer.clear();
            _MT_fsq.render(renderer);
        }
        // 결과: blurRT1

        // 3. blurRT1 → outputRT (업스케일 복사)
        _MT_copyMat.uniforms.tDiffuse.value = _MT_blurRT1.texture;
        _MT_fsq.material = _MT_copyMat;
        renderer.setRenderTarget(_MT_outputRT);
        renderer.clear();
        _MT_fsq.render(renderer);
    }

    // ── RendererStrategy.render 후킹 ─────────────────────────────────────────
    // 씬위에 씬(scene-on-scene) 렌더링:
    //   1) 이전 씬(맵)을 captureRT에 렌더 → 블러/오버레이 처리
    //   2) 처리된 배경을 화면에 출력
    //   3) 현재 씬(메뉴)을 autoClear=false 로 그 위에 렌더

    function MT_installHook() {
        if (_hookInstalled) return;
        _hookInstalled = true;

        _origRSRender = RendererStrategy.render;
        RendererStrategy.render = function (rendererObj, stage) {
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

            // ── Step 1: 이전 씬(Scene_Map) → captureRT ──────────────────────
            var stack = SceneManager._stack;
            var prevScene = stack && stack.length > 0 ? stack[stack.length - 1] : null;
            var bgStage = prevScene || stage;

            renderer.setRenderTarget(_MT_captureRT);
            renderer.clear();
            _origRSRender.call(this, rendererObj, bgStage);

            // ── Step 2: 블러 또는 직접 복사 → outputRT ──────────────────────
            var useBlur = Cfg.blur > 0 && Cfg.effect !== 'overlayOnly';
            if (useBlur) {
                MT_applyBlur(renderer, Math.max(1, Math.ceil(Cfg.blur / 25)));
            } else {
                // 블러 없이 captureRT → outputRT 복사
                _MT_copyMat.uniforms.tDiffuse.value = _MT_captureRT.texture;
                _MT_fsq.material = _MT_copyMat;
                renderer.setRenderTarget(_MT_outputRT);
                renderer.clear();
                _MT_fsq.render(renderer);
            }

            // ── Step 3: 처리된 배경 + 오버레이 → 화면 ──────────────────────
            var t  = _MT_t;
            var oa = (Cfg.effect === 'blurOnly') ? 0 : (Cfg.overlayAlpha / 255 * t);
            _MT_compMat.uniforms.tDiffuse.value     = _MT_outputRT.texture;
            _MT_compMat.uniforms.overlayAlpha.value = oa;
            _MT_fsq.material = _MT_compMat;
            renderer.setRenderTarget(null);
            renderer.clear();
            _MT_fsq.render(renderer);

            // ── Step 4: 현재 씬(메뉴 UI) — autoClear=false 로 배경 위에 ─────
            renderer.autoClear = false;
            _origRSRender.call(this, rendererObj, stage);
            renderer.autoClear = true;
        };
    }

    // ── 애니메이션 타이머 (requestAnimationFrame 기반) ───────────────────────

    var _MT_animRafId  = null;
    var _MT_durationMs = 0;

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

    // ── Scene_MenuBase 오버라이드 ─────────────────────────────────────────────

    var _SMB_create = Scene_MenuBase.prototype.create;
    Scene_MenuBase.prototype.create = function () {
        _SMB_create.call(this);
        _MT_bgSprite = this._backgroundSprite || null;

        // Scene_MenuBase의 기본 배경 스프라이트 숨기기
        // 렌더 훅이 이전 씬(맵)을 배경으로 직접 렌더링하므로 불필요
        if (_MT_bgSprite) {
            _MT_bgSprite.visible = false;
        }

        MT_installHook();
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
