/*:
 * @plugindesc [MenuTransition] 메뉴/UI 씬 배경 전환 효과 (GPU 블러 애니메이션)
 * @author RPG Maker MV Web Editor
 *
 * @help
 * 메뉴·아이템·스킬 등 UI 씬이 열릴 때 맵 화면이 점점 블러되면서
 * 어두워지는 애니메이션 후 메뉴 UI가 표시됩니다.
 *
 * 렌더링 방식:
 *   - Scene_Map.terminate() → snapForBackground 시점에 맵 스냅샷 취득
 *   - PostProcess.menuBgHook을 통해 매 프레임 composer.writeBuffer에
 *     블러 배경을 먼저 렌더하고, 그 위에 메뉴 UI를 합성
 *   - 블러 강도와 오버레이가 t(0→1)에 따라 점진적으로 강해짐
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

    var _overlayRGB = (function () {
        var parts = Cfg.overlayColor.split(',').map(function (s) {
            return Math.max(0, Math.min(255, Number(s) || 0)) / 255;
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

    // ── GLSL ─────────────────────────────────────────────────────────────────

    var _VS = [
        'varying vec2 vUv;',
        'void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
    ].join('\n');

    var _COPY_FS = [
        'uniform sampler2D tDiffuse; varying vec2 vUv;',
        'void main() { gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0); }'
    ].join('\n');

    var _BLUR_H_FS = [
        'uniform sampler2D tDiffuse; uniform float sigma; uniform float stepX; varying vec2 vUv;',
        'void main() {',
        '    vec4 c = vec4(0.0); float w = 0.0;',
        '    for (int i = -20; i <= 20; i++) {',
        '        float k = exp(-float(i*i) / (2.0*sigma*sigma));',
        '        c += texture2D(tDiffuse, vec2(clamp(vUv.x + float(i)*stepX, 0.0, 1.0), vUv.y)) * k;',
        '        w += k;',
        '    }',
        '    gl_FragColor = vec4((c/w).rgb, 1.0);',
        '}'
    ].join('\n');

    var _BLUR_V_FS = [
        'uniform sampler2D tDiffuse; uniform float sigma; uniform float stepY; varying vec2 vUv;',
        'void main() {',
        '    vec4 c = vec4(0.0); float w = 0.0;',
        '    for (int i = -20; i <= 20; i++) {',
        '        float k = exp(-float(i*i) / (2.0*sigma*sigma));',
        '        c += texture2D(tDiffuse, vec2(vUv.x, clamp(vUv.y + float(i)*stepY, 0.0, 1.0))) * k;',
        '        w += k;',
        '    }',
        '    gl_FragColor = vec4((c/w).rgb, 1.0);',
        '}'
    ].join('\n');

    // 배경(블러) + 오버레이 합성
    var _COMPOSITE_FS = [
        'uniform sampler2D tDiffuse;',
        'uniform float overlayAlpha;',
        'uniform vec3 overlayColor;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec3 c = texture2D(tDiffuse, vUv).rgb;',
        '    gl_FragColor = vec4(mix(c, overlayColor, overlayAlpha), 1.0);',
        '}'
    ].join('\n');

    // ── 상태 ─────────────────────────────────────────────────────────────────

    var _phase      = 0;   // 0=비활성, 1=열기, 2=열림, 3=닫기
    var _t          = 0;
    var _startTime  = 0;
    var _durationMs = 0;
    var _closeCb    = null;
    var _rafId      = null;

    var _snapshotReady       = false;
    var _needsBlurredSnapshot = false;  // t=1 도달 시 블러 결과 저장 트리거

    // Three.js 리소스
    var _canvasTex = null;   // 스냅샷 CanvasTexture (원본)
    var _blurRT1   = null;
    var _blurRT2   = null;
    var _outputRT  = null;   // 블러+오버레이 합성 결과
    var _fsq       = null;
    var _hMat      = null;
    var _vMat      = null;
    var _copyMat   = null;
    var _compMat   = null;

    // 복원용 저장값
    var _saved_bgSpriteVisible = true;
    var _saved_renderPassClear = true;
    var _saved_autoClear       = true;

    // ── GPU 리소스 초기화 ────────────────────────────────────────────────────

    var SCALE = 4;  // 블러 FBO 다운스케일 (성능)

    function initResources(renderer, w, h) {
        var rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
        var sw = Math.max(1, Math.round(w / SCALE));
        var sh = Math.max(1, Math.round(h / SCALE));

        function needsNew(rt, tw, th) { return !rt || rt.width !== tw || rt.height !== th; }

        if (needsNew(_blurRT1, sw, sh)) {
            if (_blurRT1) _blurRT1.dispose();
            _blurRT1 = new THREE.WebGLRenderTarget(sw, sh, rtOpts);
        }
        if (needsNew(_blurRT2, sw, sh)) {
            if (_blurRT2) _blurRT2.dispose();
            _blurRT2 = new THREE.WebGLRenderTarget(sw, sh, rtOpts);
        }
        if (needsNew(_outputRT, w, h)) {
            if (_outputRT) _outputRT.dispose();
            _outputRT = new THREE.WebGLRenderTarget(w, h, rtOpts);
        }
        if (!_fsq) {
            _fsq = new FullScreenQuad(new THREE.MeshBasicMaterial());
        }
        if (!_copyMat) {
            _copyMat = new THREE.ShaderMaterial({
                uniforms: { tDiffuse: { value: null } },
                vertexShader: _VS, fragmentShader: _COPY_FS,
                depthTest: false, depthWrite: false
            });
        }
        if (!_hMat) {
            _hMat = new THREE.ShaderMaterial({
                uniforms: { tDiffuse: { value: null }, sigma: { value: 1 }, stepX: { value: 1 / sw } },
                vertexShader: _VS, fragmentShader: _BLUR_H_FS,
                depthTest: false, depthWrite: false
            });
        } else {
            _hMat.uniforms.stepX.value = 1 / sw;
        }
        if (!_vMat) {
            _vMat = new THREE.ShaderMaterial({
                uniforms: { tDiffuse: { value: null }, sigma: { value: 1 }, stepY: { value: 1 / sh } },
                vertexShader: _VS, fragmentShader: _BLUR_V_FS,
                depthTest: false, depthWrite: false
            });
        } else {
            _vMat.uniforms.stepY.value = 1 / sh;
        }
        if (!_compMat) {
            _compMat = new THREE.ShaderMaterial({
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

    // ── GPU 블러 + 오버레이 → outputRT ───────────────────────────────────────

    function renderBgToRT(renderer, w, h, t) {
        if (!_canvasTex || !_outputRT) return;

        var sigma = t * Cfg.blur / 100 * 8;
        var sw = _blurRT1.width, sh = _blurRT1.height;
        var compositeSource;  // 오버레이 합성 소스 (outputRT와 다른 텍스처)

        if (sigma < 0.1 || Cfg.effect === 'overlayOnly') {
            // 블러 없이 원본 캔버스 텍스처를 합성 소스로 직접 사용
            compositeSource = _canvasTex;
        } else {
            // 다운샘플 → H blur → V blur (결과: _blurRT1)
            _copyMat.uniforms.tDiffuse.value = _canvasTex;
            _fsq.material = _copyMat;
            renderer.setRenderTarget(_blurRT1);
            renderer.clear();
            _fsq.render(renderer);

            _hMat.uniforms.tDiffuse.value = _blurRT1.texture;
            _hMat.uniforms.sigma.value = sigma;
            _hMat.uniforms.stepX.value = 1 / sw;
            _fsq.material = _hMat;
            renderer.setRenderTarget(_blurRT2);
            renderer.clear();
            _fsq.render(renderer);

            _vMat.uniforms.tDiffuse.value = _blurRT2.texture;
            _vMat.uniforms.sigma.value = sigma;
            _vMat.uniforms.stepY.value = 1 / sh;
            _fsq.material = _vMat;
            renderer.setRenderTarget(_blurRT1);
            renderer.clear();
            _fsq.render(renderer);

            // _blurRT1에 블러 완성 — outputRT와 다른 텍스처이므로 자기참조 없음
            compositeSource = _blurRT1.texture;
        }

        // 오버레이 합성: compositeSource → outputRT (자기참조 없음)
        var oa = (Cfg.effect === 'blurOnly') ? 0 : (Cfg.overlayAlpha / 255 * t);
        _compMat.uniforms.tDiffuse.value     = compositeSource;
        _compMat.uniforms.overlayAlpha.value = oa;
        _fsq.material = _compMat;
        renderer.setRenderTarget(_outputRT);
        renderer.clear();
        _fsq.render(renderer);
    }

    // ── PostProcess.menuBgHook ────────────────────────────────────────────────

    function installHook() {
        PostProcess.menuBgHook = {
            preRender: function (renderer, composer) {
                if (_phase === 0 || !_snapshotReady || !_canvasTex) return;

                var w = composer.renderTarget1.width;
                var h = composer.renderTarget1.height;
                initResources(renderer, w, h);

                // 배경 블러 → outputRT (매 프레임 t에 따라 갱신)
                renderBgToRT(renderer, w, h, _t);

                // 블러 완료 시 결과 저장 (1회)
                if (_needsBlurredSnapshot && _outputRT) {
                    _needsBlurredSnapshot = false;
                    saveRenderTargetPng(renderer, _outputRT, 'mt-snapshot-blurred');
                }

                // writeBuffer에 배경 blit
                _copyMat.uniforms.tDiffuse.value = _outputRT.texture;
                _fsq.material = _copyMat;
                renderer.setRenderTarget(composer.writeBuffer);
                renderer.clear();
                _fsq.render(renderer);

                // 첫 번째 RenderPass가 writeBuffer를 clear하지 않도록
                var firstPass = composer.passes[0];
                if (firstPass) {
                    _saved_renderPassClear = firstPass.clear;
                    firstPass.clear = false;
                }

                // renderer.autoClear=false → renderer.render() 내부 자동 clear 방지
                _saved_autoClear = renderer.autoClear;
                renderer.autoClear = false;

                // 배경 스프라이트 숨기기 (메뉴 씬의 것)
                var scene = SceneManager._scene;
                var bgSpr = scene && scene._backgroundSprite;
                if (bgSpr) {
                    _saved_bgSpriteVisible = bgSpr.visible;
                    bgSpr.visible = false;
                }
            },

            postRender: function (renderer) {
                if (_phase === 0 || !_snapshotReady) return;

                // 복원
                renderer.autoClear = _saved_autoClear;

                var composer = PostProcess._composer;
                if (composer && composer.passes[0]) {
                    composer.passes[0].clear = _saved_renderPassClear;
                }

                var scene = SceneManager._scene;
                var bgSpr = scene && scene._backgroundSprite;
                if (bgSpr) {
                    bgSpr.visible = _saved_bgSpriteVisible;
                }
            }
        };
    }

    function uninstallHook() {
        if (typeof PostProcess !== 'undefined') {
            PostProcess.menuBgHook = null;
        }
    }

    // ── 스냅샷 취득 ──────────────────────────────────────────────────────────

    function captureSnapshot(renderer) {
        var cap = (typeof PostProcess !== 'undefined') ? PostProcess._captureCanvas : null;
        if (!cap || cap.width <= 0 || cap.height <= 0) {
            console.warn('[MenuTransition] 스냅샷 실패: PostProcess._captureCanvas 없음');
            _snapshotReady = false;
            return;
        }

        // 디버그: 원본 파일 저장
        saveCanvasPng(cap, 'mt-snapshot-raw');

        var w = cap.width;
        var h = cap.height;

        // renderer가 필요 → initResources는 preRender에서 처리, 여기서는 CanvasTexture만 생성
        if (_canvasTex && _canvasTex.image === cap) {
            _canvasTex.needsUpdate = true;
        } else {
            if (_canvasTex) _canvasTex.dispose();
            _canvasTex = new THREE.CanvasTexture(cap);
            _canvasTex.flipY    = false;
            _canvasTex.minFilter = THREE.LinearFilter;
            _canvasTex.magFilter = THREE.LinearFilter;
        }

        _snapshotReady = true;
        console.log('[MenuTransition] 스냅샷 취득 완료:', w + 'x' + h);
    }

    // ── 디버그: /tmp/rpgmaker-snapshots 에 PNG 저장 ───────────────────────────

    function saveRenderTargetPng(renderer, rt, name) {
        try {
            var w = rt.width, h = rt.height;
            var pixels = new Uint8Array(w * h * 4);
            renderer.readRenderTargetPixels(rt, 0, 0, w, h, pixels);
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            var ctx = canvas.getContext('2d');
            var imgData = ctx.createImageData(w, h);
            // WebGL은 Y축이 반전되어 있으므로 flip
            for (var y = 0; y < h; y++) {
                var srcRow = (h - 1 - y) * w * 4;
                var dstRow = y * w * 4;
                for (var x = 0; x < w * 4; x++) {
                    imgData.data[dstRow + x] = pixels[srcRow + x];
                }
            }
            ctx.putImageData(imgData, 0, 0);
            saveCanvasPng(canvas, name);
        } catch (e) {
            console.warn('[MenuTransition] saveRenderTargetPng 실패:', e);
        }
    }

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

    // ── SceneManager.snapForBackground 오버라이드 ─────────────────────────────
    // Scene_Map.terminate()에서 호출 → 이 시점의 _captureCanvas = 맵 화면

    var _origSnapForBg = SceneManager.snapForBackground;
    SceneManager.snapForBackground = function () {
        _origSnapForBg.call(this);  // PostProcess 오버라이드 포함 실행

        // renderer 취득
        var rendererObj = Graphics._renderer;
        var renderer = rendererObj && rendererObj.renderer;
        if (renderer) {
            captureSnapshot(renderer);
        } else {
            console.warn('[MenuTransition] snapForBackground: renderer 없음');
        }
    };

    // ── Scene_MenuBase 오버라이드 ─────────────────────────────────────────────

    var _SMB_create = Scene_MenuBase.prototype.create;
    Scene_MenuBase.prototype.create = function () {
        _SMB_create.call(this);
        installHook();
        startOpen();
        console.log('[MenuTransition] 메뉴 열기 시작');
    };

    var _SMB_startFadeIn = Scene_MenuBase.prototype.startFadeIn;
    Scene_MenuBase.prototype.startFadeIn = function (duration, white) {
        // MT가 열기 애니메이션을 담당 → 페이드인 즉시 완료
        if (_phase === 1 || _phase === 2) {
            _SMB_startFadeIn.call(this, 1, white);
        } else {
            _SMB_startFadeIn.call(this, duration, white);
        }
    };

    // ── SceneManager.pop 오버라이드 (닫기 애니메이션) ────────────────────────

    if (Cfg.closeAnim) {
        var _origPop = SceneManager.pop;
        SceneManager.pop = function () {
            var scene = this._scene;
            if (scene instanceof Scene_MenuBase && _phase !== 3) {
                scene._active = false;
                var mgr = this;
                startClose(function () {
                    _snapshotReady = false;
                    uninstallHook();
                    _origPop.call(mgr);
                });
            } else {
                _origPop.call(this);
            }
        };
    }

})();
