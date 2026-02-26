//=============================================================================
// PostProcessEffects.js - 추가 포스트 프로세싱 이펙트 모음
//=============================================================================
// PostProcess.js의 SimpleEffectComposer에 삽입할 수 있는 ShaderPass 기반 이펙트.
// 각 이펙트는 PostProcessEffects.XXX 로 접근 가능.
// 의존: THREE (global)
//=============================================================================

(function() {

var PostProcessEffects = {};
window.PostProcessEffects = PostProcessEffects;

// PostProcess.js에서 공유하는 유틸리티 (전역에서 참조)
// ShaderPass 패턴과 동일하게 구현
function createPass(shader) {
    var pass = {};
    pass.enabled = false;
    pass.needsSwap = true;
    pass.renderToScreen = false;
    pass.uniforms = THREE.UniformsUtils.clone(shader.uniforms);
    pass.material = new THREE.ShaderMaterial({
        uniforms: pass.uniforms,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader
    });
    var geometry = new THREE.PlaneGeometry(2, 2);
    pass._mesh = new THREE.Mesh(geometry, pass.material);
    pass._scene = new THREE.Scene();
    pass._scene.add(pass._mesh);
    pass._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    pass.render = function(renderer, writeBuffer, readBuffer) {
        if (this.uniforms.tColor) this.uniforms.tColor.value = readBuffer.texture;
        if (this.renderToScreen) {
            renderer.setRenderTarget(null);
        } else {
            renderer.setRenderTarget(writeBuffer);
            renderer.clear();
        }
        renderer.render(this._scene, this._camera);
    };
    pass.setSize = function() {};
    pass.dispose = function() {
        this.material.dispose();
        this._mesh.geometry.dispose();
    };
    return pass;
}

var VERT = [
    'varying vec2 vUv;',
    'void main() {',
    '    vUv = uv;',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
].join('\n');

//=============================================================================
// 1. Vignette - 화면 가장자리 어둡게
//=============================================================================
PostProcessEffects.VignetteShader = {
    uniforms: {
        tColor:    { value: null },
        uIntensity: { value: 0.5 },
        uSoftness:  { value: 0.3 },
        uRadius:    { value: 0.4 },
        uColor:     { value: new THREE.Vector3(0.0, 0.0, 0.0) }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uIntensity;',
        'uniform float uSoftness;',
        'uniform float uRadius;',
        'uniform vec3 uColor;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 tex = texture2D(tColor, vUv);',
        '    float dist = distance(vUv, vec2(0.5));',
        '    float vig = smoothstep(uRadius, uRadius + uSoftness, dist);',
        '    vig *= uIntensity;',
        '    vec3 col = mix(tex.rgb, uColor, vig * 0.6);',
        '    col *= 1.0 - vig * 0.3;',
        '    gl_FragColor = vec4(col, tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createVignettePass = function(params) {
    var pass = createPass(this.VignetteShader);
    if (params) {
        if (params.intensity != null) pass.uniforms.uIntensity.value = params.intensity;
        if (params.softness != null) pass.uniforms.uSoftness.value = params.softness;
        if (params.radius != null) pass.uniforms.uRadius.value = params.radius;
        if (params.color != null && typeof params.color === 'string' && params.color[0] === '#') {
            var r = parseInt(params.color.substr(1,2),16)/255;
            var g = parseInt(params.color.substr(3,2),16)/255;
            var b = parseInt(params.color.substr(5,2),16)/255;
            pass.uniforms.uColor.value.set(r, g, b);
        }
    }
    return pass;
};

//=============================================================================
// 2. Color Grading (색조 보정) - 밝기/대비/채도/색온도
//=============================================================================
PostProcessEffects.ColorGradingShader = {
    uniforms: {
        tColor:        { value: null },
        uBrightness:   { value: 0.0 },
        uContrast:     { value: 1.0 },
        uSaturation:   { value: 1.0 },
        uTemperature:  { value: 0.0 },
        uTint:         { value: 0.0 },
        uGamma:        { value: 1.0 }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uBrightness;',
        'uniform float uContrast;',
        'uniform float uSaturation;',
        'uniform float uTemperature;',
        'uniform float uTint;',
        'uniform float uGamma;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 tex = texture2D(tColor, vUv);',
        '    vec3 col = tex.rgb;',
        // Brightness
        '    col += uBrightness;',
        // Contrast
        '    col = (col - 0.5) * uContrast + 0.5;',
        // Saturation
        '    float lum = dot(col, vec3(0.299, 0.587, 0.114));',
        '    col = mix(vec3(lum), col, uSaturation);',
        // Temperature (warm/cool shift)
        '    col.r += uTemperature * 0.1;',
        '    col.b -= uTemperature * 0.1;',
        // Tint (green/magenta)
        '    col.g += uTint * 0.1;',
        // Gamma
        '    col = pow(max(col, 0.0), vec3(1.0 / uGamma));',
        '    gl_FragColor = vec4(clamp(col, 0.0, 1.0), tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createColorGradingPass = function(params) {
    var pass = createPass(this.ColorGradingShader);
    if (params) {
        if (params.brightness != null) pass.uniforms.uBrightness.value = params.brightness;
        if (params.contrast != null) pass.uniforms.uContrast.value = params.contrast;
        if (params.saturation != null) pass.uniforms.uSaturation.value = params.saturation;
        if (params.temperature != null) pass.uniforms.uTemperature.value = params.temperature;
        if (params.tint != null) pass.uniforms.uTint.value = params.tint;
        if (params.gamma != null) pass.uniforms.uGamma.value = params.gamma;
    }
    return pass;
};

//=============================================================================
// 3. Chromatic Aberration - 색수차
//=============================================================================
PostProcessEffects.ChromaticAberrationShader = {
    uniforms: {
        tColor:    { value: null },
        uStrength: { value: 0.005 },
        uRadial:   { value: 1.0 }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uStrength;',
        'uniform float uRadial;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec2 center = vec2(0.5);',
        '    vec2 dir = (vUv - center) * uRadial;',
        '    float dist = length(dir);',
        '    vec2 offset = dir * uStrength * dist;',
        '    float r = texture2D(tColor, vUv + offset).r;',
        '    float g = texture2D(tColor, vUv).g;',
        '    float b = texture2D(tColor, vUv - offset).b;',
        '    float a = texture2D(tColor, vUv).a;',
        '    gl_FragColor = vec4(r, g, b, a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createChromaticAberrationPass = function(params) {
    var pass = createPass(this.ChromaticAberrationShader);
    if (params) {
        if (params.strength != null) pass.uniforms.uStrength.value = params.strength;
        if (params.radial != null) pass.uniforms.uRadial.value = params.radial;
    }
    return pass;
};

//=============================================================================
// 4. Film Grain - 필름 노이즈
//=============================================================================
PostProcessEffects.FilmGrainShader = {
    uniforms: {
        tColor:     { value: null },
        uTime:      { value: 0.0 },
        uIntensity: { value: 0.1 },
        uSize:      { value: 1.0 }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uTime;',
        'uniform float uIntensity;',
        'uniform float uSize;',
        'varying vec2 vUv;',
        'float rand(vec2 co) {',
        '    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);',
        '}',
        'void main() {',
        '    vec4 tex = texture2D(tColor, vUv);',
        '    vec2 coord = floor(vUv * 512.0 / uSize) * uSize;',
        '    float noise = rand(coord + vec2(uTime * 0.1, uTime * 0.13)) * 2.0 - 1.0;',
        '    vec3 col = tex.rgb + vec3(noise * uIntensity);',
        '    gl_FragColor = vec4(clamp(col, 0.0, 1.0), tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createFilmGrainPass = function(params) {
    var pass = createPass(this.FilmGrainShader);
    if (params) {
        if (params.intensity != null) pass.uniforms.uIntensity.value = params.intensity;
        if (params.size != null) pass.uniforms.uSize.value = params.size;
    }
    return pass;
};

//=============================================================================
// 5. Tone Mapping (ACES)
//=============================================================================
PostProcessEffects.ToneMappingShader = {
    uniforms: {
        tColor:      { value: null },
        uExposure:   { value: 1.0 },
        uMode:       { value: 0 }  // 0=ACES, 1=Reinhard, 2=Linear
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uExposure;',
        'uniform int uMode;',
        'varying vec2 vUv;',
        'vec3 aces(vec3 x) {',
        '    float a = 2.51;',
        '    float b = 0.03;',
        '    float c = 2.43;',
        '    float d = 0.59;',
        '    float e = 0.14;',
        '    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);',
        '}',
        'void main() {',
        '    vec4 tex = texture2D(tColor, vUv);',
        '    vec3 col = tex.rgb * uExposure;',
        '    if (uMode == 0) {',
        '        col = aces(col);',
        '    } else if (uMode == 1) {',
        '        col = col / (col + vec3(1.0));',
        '    }',
        // Linear: no mapping
        '    gl_FragColor = vec4(col, tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createToneMappingPass = function(params) {
    var pass = createPass(this.ToneMappingShader);
    if (params) {
        if (params.exposure != null) pass.uniforms.uExposure.value = params.exposure;
        if (params.mode != null) pass.uniforms.uMode.value = params.mode;
    }
    return pass;
};

//=============================================================================
// 6. Fog / Mist - 안개 효과
//=============================================================================
PostProcessEffects.FogShader = {
    uniforms: {
        tColor:     { value: null },
        uDensity:   { value: 0.3 },
        uColor:     { value: new THREE.Vector3(0.8, 0.85, 0.9) },
        uStart:     { value: 0.0 },
        uEnd:       { value: 1.0 }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uDensity;',
        'uniform vec3 uColor;',
        'uniform float uStart;',
        'uniform float uEnd;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 tex = texture2D(tColor, vUv);',
        // Y-based fog (top=far, bottom=near in tilt-shift style)
        '    float fogFactor = smoothstep(uEnd, uStart, vUv.y) * uDensity;',
        '    vec3 col = mix(tex.rgb, uColor, fogFactor);',
        '    gl_FragColor = vec4(col, tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createFogPass = function(params) {
    var pass = createPass(this.FogShader);
    if (params) {
        if (params.density != null) pass.uniforms.uDensity.value = params.density;
        if (params.start != null) pass.uniforms.uStart.value = params.start;
        if (params.end != null) pass.uniforms.uEnd.value = params.end;
        if (params.color) pass.uniforms.uColor.value.set(params.color[0], params.color[1], params.color[2]);
    }
    return pass;
};

//=============================================================================
// 7. God Rays (Volumetric Light) - 빛줄기
//   개선사항:
//   - uThreshold:    루미넌스 모드에서 이 값 이상의 밝은 픽셀만 광원으로 기여
//   - uRayColor:     빛줄기 색상 (따뜻한 흰색 기본값)
//   - uMaxDistance:  광원 UV에서 멀어질수록 효과 감쇠
//   - tOcclusion/uUseOcclusion: 2패스 오클루전 모드 (3D 전용)
//     → 배경(하늘)=흰색, 오브젝트=검정 마스크를 radial blur해 정확한 빛줄기 생성
//=============================================================================
PostProcessEffects.GodRaysShader = {
    uniforms: {
        tColor:        { value: null },
        tOcclusion:    { value: null },
        uLightPos:     { value: new THREE.Vector2(0.5, 0.0) },
        uExposure:     { value: 0.3 },
        uDecay:        { value: 0.95 },
        uDensity:      { value: 0.8 },
        uWeight:       { value: 0.4 },
        uSamples:      { value: 50 },
        uThreshold:    { value: 0.5 },
        uRayColor:     { value: new THREE.Vector3(1.0, 0.95, 0.8) },
        uMaxDistance:  { value: 1.5 },
        uUseOcclusion: { value: 0.0 }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform sampler2D tOcclusion;',
        'uniform vec2 uLightPos;',
        'uniform float uExposure;',
        'uniform float uDecay;',
        'uniform float uDensity;',
        'uniform float uWeight;',
        'uniform int uSamples;',
        'uniform float uThreshold;',
        'uniform vec3 uRayColor;',
        'uniform float uMaxDistance;',
        'uniform float uUseOcclusion;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec2 texCoord = vUv;',
        '    vec2 deltaTexCoord = (texCoord - uLightPos) * (1.0 / float(uSamples)) * uDensity;',
        '    vec4 color = texture2D(tColor, texCoord);',
        '    float illuminationDecay = 1.0;',
        '    float accum = 0.0;',
        '    for (int i = 0; i < 50; i++) {',
        '        if (i >= uSamples) break;',
        '        texCoord -= deltaTexCoord;',
        '        vec2 clampedUV = clamp(texCoord, 0.0, 1.0);',
        // 루미넌스 모드: 임계값 이상의 밝기만 기여
        '        float lum = dot(texture2D(tColor, clampedUV).rgb, vec3(0.299, 0.587, 0.114));',
        '        float lumContrib = max(0.0, lum - uThreshold);',
        // 오클루전 모드: 오클루전 마스크(흰=광원, 검=차폐) radial blur
        '        float occContrib = texture2D(tOcclusion, clampedUV).r;',
        // mix로 분기 없이 전환 (tOcclusion null → occContrib≈0 → lumContrib 사용)
        '        float contrib = mix(lumContrib, occContrib, uUseOcclusion);',
        '        accum += contrib * illuminationDecay * uWeight;',
        '        illuminationDecay *= uDecay;',
        '    }',
        // 광원 거리 기반 감쇠 + 빛줄기 색상 적용
        '    float distFade = 1.0 - smoothstep(0.0, uMaxDistance, length(vUv - uLightPos));',
        '    vec3 rays = accum * uExposure * distFade * uRayColor;',
        '    gl_FragColor = vec4(color.rgb + rays, color.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createGodRaysPass = function(params) {
    var shader = this.GodRaysShader;
    var pass = {};
    pass.enabled = false;
    pass.needsSwap = true;
    pass.renderToScreen = false;
    pass.uniforms = THREE.UniformsUtils.clone(shader.uniforms);
    pass.material = new THREE.ShaderMaterial({
        uniforms: pass.uniforms,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader
    });
    var _geom = new THREE.PlaneGeometry(2, 2);
    pass._mesh = new THREE.Mesh(_geom, pass.material);
    pass._scene2d = new THREE.Scene();
    pass._scene2d.add(pass._mesh);
    pass._camera2d = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // 2패스 오클루전 지원 (3D 전용)
    pass._occlusionEnabled = false;
    pass._sceneRef = null;
    pass._perspCameraRef = null;
    pass._occlusionTarget = null;
    pass._occlusionMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    pass._getOcclusionTarget = function(w, h) {
        if (!this._occlusionTarget ||
            this._occlusionTarget.width !== w ||
            this._occlusionTarget.height !== h) {
            if (this._occlusionTarget) this._occlusionTarget.dispose();
            this._occlusionTarget = new THREE.WebGLRenderTarget(w, h, {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat
            });
        }
        return this._occlusionTarget;
    };

    // scene.overrideMaterial=검정 + background=흰색 → 오클루전 마스크 렌더
    pass._renderOcclusion = function(renderer, w, h) {
        if (!this._sceneRef || !this._perspCameraRef) return;
        var scene = this._sceneRef;
        var camera = this._perspCameraRef;
        var target = this._getOcclusionTarget(w, h);

        var savedBackground = scene.background;
        var savedOverride = scene.overrideMaterial;
        var savedClearColor = new THREE.Color();
        var savedClearAlpha = renderer.getClearAlpha();
        renderer.getClearColor(savedClearColor);

        scene.overrideMaterial = this._occlusionMaterial;
        scene.background = new THREE.Color(0xffffff);
        renderer.setRenderTarget(target);
        renderer.setClearColor(0xffffff, 1);
        renderer.clear();
        renderer.render(scene, camera);

        renderer.setClearColor(savedClearColor, savedClearAlpha);
        renderer.setRenderTarget(null);
        scene.overrideMaterial = savedOverride;
        scene.background = savedBackground;

        this.uniforms.tOcclusion.value = target.texture;
        this.uniforms.uUseOcclusion.value = 1.0;
    };

    pass.render = function(renderer, writeBuffer, readBuffer) {
        this.uniforms.uUseOcclusion.value = 0.0;
        if (this._occlusionEnabled) {
            this._renderOcclusion(renderer, readBuffer.width, readBuffer.height);
        }
        this.uniforms.tColor.value = readBuffer.texture;
        if (this.renderToScreen) {
            renderer.setRenderTarget(null);
        } else {
            renderer.setRenderTarget(writeBuffer);
            renderer.clear();
        }
        renderer.render(this._scene2d, this._camera2d);
    };

    pass.setSize = function() {};
    pass.dispose = function() {
        this.material.dispose();
        this._mesh.geometry.dispose();
        this._occlusionMaterial.dispose();
        if (this._occlusionTarget) {
            this._occlusionTarget.dispose();
            this._occlusionTarget = null;
        }
    };

    if (params) {
        if (params.lightPosX != null) pass.uniforms.uLightPos.value.x = params.lightPosX;
        if (params.lightPosY != null) pass.uniforms.uLightPos.value.y = params.lightPosY;
        if (params.exposure != null) pass.uniforms.uExposure.value = params.exposure;
        if (params.decay != null) pass.uniforms.uDecay.value = params.decay;
        if (params.density != null) pass.uniforms.uDensity.value = params.density;
        if (params.weight != null) pass.uniforms.uWeight.value = params.weight;
        if (params.threshold != null) pass.uniforms.uThreshold.value = params.threshold;
        if (params.maxDistance != null) pass.uniforms.uMaxDistance.value = params.maxDistance;
        if (params.rayColor != null && typeof params.rayColor === 'string' && params.rayColor[0] === '#') {
            pass.uniforms.uRayColor.value.set(
                parseInt(params.rayColor.substr(1,2),16)/255,
                parseInt(params.rayColor.substr(3,2),16)/255,
                parseInt(params.rayColor.substr(5,2),16)/255
            );
        }
        if (params.useOcclusion != null) pass._occlusionEnabled = !!params.useOcclusion;
    }

    return pass;
};

//=============================================================================
// 8. Radial Blur - 방사형 블러
//=============================================================================
PostProcessEffects.RadialBlurShader = {
    uniforms: {
        tColor:      { value: null },
        uCenter:     { value: new THREE.Vector2(0.5, 0.5) },
        uStrength:   { value: 0.1 },
        uSamples:    { value: 12 }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform vec2 uCenter;',
        'uniform float uStrength;',
        'uniform int uSamples;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec2 dir = vUv - uCenter;',
        '    float dist = length(dir);',
        '    dir = normalize(dir);',
        '    float stepSize = dist * uStrength / float(uSamples);',
        '    vec4 col = vec4(0.0);',
        '    float total = 0.0;',
        '    vec2 tc = vUv;',
        '    for (int i = 0; i < 16; i++) {',
        '        if (i >= uSamples) break;',
        '        float w = 1.0 - float(i) / float(uSamples) * 0.5;',
        '        vec2 sampleUv = clamp(tc, 0.0, 1.0);',
        '        col += texture2D(tColor, sampleUv) * w;',
        '        total += w;',
        '        tc -= dir * stepSize;',
        '    }',
        '    gl_FragColor = col / total;',
        '    gl_FragColor.a = 1.0;',
        '}'
    ].join('\n')
};

PostProcessEffects.createRadialBlurPass = function(params) {
    var pass = createPass(this.RadialBlurShader);
    if (params) {
        if (params.centerX != null) pass.uniforms.uCenter.value.x = params.centerX;
        if (params.centerY != null) pass.uniforms.uCenter.value.y = params.centerY;
        if (params.strength != null) pass.uniforms.uStrength.value = params.strength;
    }
    return pass;
};

//=============================================================================
// 9. Wave Distortion - 충격파/왜곡
//=============================================================================
PostProcessEffects.WaveDistortionShader = {
    uniforms: {
        tColor:       { value: null },
        uTime:        { value: 0.0 },
        uCenter:      { value: new THREE.Vector2(0.5, 0.5) },
        uAmplitude:   { value: 0.03 },
        uWaveWidth:   { value: 0.15 },
        uSpeed:       { value: 1.5 },
        uAspect:      { value: 1.0 }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uTime;',
        'uniform vec2 uCenter;',
        'uniform float uAmplitude;',
        'uniform float uWaveWidth;',
        'uniform float uSpeed;',
        'uniform float uAspect;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec2 diff = vUv - uCenter;',
        '    diff.y *= uAspect;',
        '    float dist = length(diff);',
        '    float waveRadius = uTime * uSpeed;',
        '    float distFromWave = abs(dist - waveRadius);',
        '    float wave = smoothstep(uWaveWidth, 0.0, distFromWave);',
        '    float fadeOut = 1.0 - smoothstep(0.0, 1.5, waveRadius);',
        '    vec2 displacement = normalize(diff) * wave * uAmplitude * fadeOut * sin(dist * 30.0 - uTime * 10.0);',
        '    gl_FragColor = texture2D(tColor, vUv + displacement);',
        '}'
    ].join('\n')
};

PostProcessEffects.createWaveDistortionPass = function(params) {
    var pass = createPass(this.WaveDistortionShader);
    if (params) {
        if (params.amplitude != null) pass.uniforms.uAmplitude.value = params.amplitude;
        if (params.waveWidth != null) pass.uniforms.uWaveWidth.value = params.waveWidth;
        if (params.speed != null) pass.uniforms.uSpeed.value = params.speed;
    }
    return pass;
};

//=============================================================================
// 10. Anamorphic Flare - 아나모픽 렌즈 플레어
//=============================================================================
PostProcessEffects.AnamorphicFlareShader = {
    uniforms: {
        tColor:        { value: null },
        uThreshold:    { value: 0.7 },
        uIntensity:    { value: 0.5 },
        uStreakLength: { value: 0.5 },
        uColor:        { value: new THREE.Vector3(0.7, 0.8, 1.0) }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uThreshold;',
        'uniform float uIntensity;',
        'uniform float uStreakLength;',
        'uniform vec3 uColor;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 tex = texture2D(tColor, vUv);',
        // Horizontal streak blur from bright areas
        '    vec3 streak = vec3(0.0);',
        '    float totalWeight = 0.0;',
        '    for (int i = -16; i <= 16; i++) {',
        '        float offset = float(i) * uStreakLength * 0.01;',
        '        vec2 sampleUv = vec2(clamp(vUv.x + offset, 0.0, 1.0), vUv.y);',
        '        vec4 s = texture2D(tColor, sampleUv);',
        '        float lum = dot(s.rgb, vec3(0.299, 0.587, 0.114));',
        '        float bright = max(0.0, lum - uThreshold);',
        '        float w = exp(-abs(float(i)) * 0.15);',
        '        streak += s.rgb * bright * w;',
        '        totalWeight += w;',
        '    }',
        '    streak /= totalWeight;',
        '    gl_FragColor = vec4(tex.rgb + streak * uIntensity * uColor, tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createAnamorphicFlarePass = function(params) {
    var pass = createPass(this.AnamorphicFlareShader);
    if (params) {
        if (params.threshold != null) pass.uniforms.uThreshold.value = params.threshold;
        if (params.intensity != null) pass.uniforms.uIntensity.value = params.intensity;
        if (params.streakLength != null) pass.uniforms.uStreakLength.value = params.streakLength;
    }
    return pass;
};

//=============================================================================
// 11. Motion Blur - 모션 블러
//=============================================================================
PostProcessEffects.MotionBlurShader = {
    uniforms: {
        tColor:      { value: null },
        uVelocity:   { value: new THREE.Vector2(0.0, 0.0) },
        uSamples:    { value: 8 }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform vec2 uVelocity;',
        'uniform int uSamples;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 col = vec4(0.0);',
        '    float total = 0.0;',
        '    for (int i = 0; i < 16; i++) {',
        '        if (i >= uSamples) break;',
        '        float t = float(i) / float(uSamples) - 0.5;',
        '        vec2 offset = uVelocity * t;',
        '        col += texture2D(tColor, clamp(vUv + offset, 0.0, 1.0));',
        '        total += 1.0;',
        '    }',
        '    gl_FragColor = col / total;',
        '}'
    ].join('\n')
};

PostProcessEffects.createMotionBlurPass = function(params) {
    var pass = createPass(this.MotionBlurShader);
    if (params) {
        if (params.velocityX != null) pass.uniforms.uVelocity.value.x = params.velocityX;
        if (params.velocityY != null) pass.uniforms.uVelocity.value.y = params.velocityY;
    }
    return pass;
};

//=============================================================================
// 12. Pixelation - 의도적 저해상도
//=============================================================================
PostProcessEffects.PixelationShader = {
    uniforms: {
        tColor:     { value: null },
        uPixelSize: { value: 4.0 },
        uResolution: { value: new THREE.Vector2(816, 624) }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uPixelSize;',
        'uniform vec2 uResolution;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec2 pixelCount = uResolution / uPixelSize;',
        '    vec2 pixelUv = floor(vUv * pixelCount) / pixelCount;',
        '    gl_FragColor = texture2D(tColor, pixelUv);',
        '}'
    ].join('\n')
};

PostProcessEffects.createPixelationPass = function(params) {
    var pass = createPass(this.PixelationShader);
    if (params) {
        if (params.pixelSize != null) pass.uniforms.uPixelSize.value = params.pixelSize;
    }
    pass.setSize = function(w, h) {
        this.uniforms.uResolution.value.set(w, h);
    };
    return pass;
};

//=============================================================================
// 12-B. Pixel Art — 픽셀화 + 색상 팔레트 양자화
//   다운샘플(nearest-neighbor)로 픽셀 블록을 만든 뒤,
//   RGB 유클리드 거리 최소화로 고정 팔레트에서 가장 가까운 색을 매핑한다.
//=============================================================================
PostProcessEffects._PIXEL_ART_PALETTES = {
    gameboy:   [[15,56,15],[48,98,48],[139,172,15],[155,188,15]],
    nes:       [[0,0,0],[252,116,96],[0,120,248],[188,0,188],
                [0,168,0],[216,40,0],[148,224,16],[248,56,0],
                [108,136,252],[255,255,255],[72,160,236],[0,168,68],
                [248,248,0],[60,188,252],[124,124,124],[252,252,252]],
    cga:       [[0,0,0],[85,255,255],[255,85,255],[255,255,255]],
    c64:       [[0,0,0],[255,255,255],[136,0,0],[170,255,238],
                [204,68,204],[0,204,85],[0,0,170],[238,238,119],
                [221,136,85],[102,68,0],[255,119,119],[51,51,51],
                [119,119,119],[170,255,102],[0,136,255],[187,187,187]],
    pico8:     [[0,0,0],[29,43,83],[126,37,83],[0,135,81],
                [171,82,54],[95,87,79],[194,195,199],[255,241,232],
                [255,0,77],[255,163,0],[255,236,39],[0,228,54],
                [41,173,255],[131,118,156],[255,119,168],[255,204,170]],
    sweetie16: [[26,28,44],[93,39,93],[177,62,83],[239,125,87],
                [255,205,117],[167,240,112],[56,183,100],[37,113,121],
                [41,54,111],[59,93,201],[65,166,246],[115,239,247],
                [244,244,244],[148,176,194],[86,108,134],[51,60,87]],
    mono:      [[0,0,0],[32,32,32],[64,64,64],[96,96,96],[128,128,128],
                [160,160,160],[192,192,192],[224,224,224],[255,255,255]],
    pastel:    [[255,179,186],[255,223,186],[255,255,186],[186,255,201],
                [186,225,255],[218,186,255],[255,186,255],[210,210,210],
                [255,255,255],[0,0,0],[100,100,100],[180,180,180]]
};

PostProcessEffects.PixelArtShader = {
    uniforms: {
        tColor:       { value: null },
        uPixelSize:   { value: 4.0 },
        uResolution:  { value: new THREE.Vector2(816, 624) },
        uPalette:     { value: (function() {
            var a = []; for (var i = 0; i < 32; i++) a.push(new THREE.Vector3(0,0,0)); return a;
        })() },
        uPaletteSize: { value: 0.0 },
        uBlend:       { value: 1.0 }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uPixelSize;',
        'uniform vec2 uResolution;',
        'uniform vec3 uPalette[32];',
        'uniform float uPaletteSize;',
        'uniform float uBlend;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec2 pixelUv = floor(vUv * uResolution / uPixelSize) * uPixelSize / uResolution;',
        '    vec4 orig = texture2D(tColor, vUv);',
        '    vec4 tex  = texture2D(tColor, pixelUv);',
        '    if (uPaletteSize > 0.5) {',
        '        vec3 best = tex.rgb;',
        '        float minDist = 1e9;',
        '        for (int i = 0; i < 32; i++) {',
        '            if (float(i) >= uPaletteSize) break;',
        '            vec3 diff = tex.rgb - uPalette[i];',
        '            float dist = dot(diff, diff);',
        '            if (dist < minDist) { minDist = dist; best = uPalette[i]; }',
        '        }',
        '        tex.rgb = best;',
        '    }',
        '    gl_FragColor = vec4(mix(orig.rgb, tex.rgb, uBlend), orig.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createPixelArtPass = function(params) {
    var pass = createPass(this.PixelArtShader);
    // THREE.UniformsUtils.clone은 배열을 shallow copy하므로 독립 배열 재생성
    var freshPalette = [];
    for (var i = 0; i < 32; i++) freshPalette.push(new THREE.Vector3(0, 0, 0));
    pass.uniforms.uPalette.value = freshPalette;
    if (params) {
        if (params.pixelSize != null) pass.uniforms.uPixelSize.value = params.pixelSize;
        if (params.blend     != null) pass.uniforms.uBlend.value     = params.blend;
        if (params.palette   != null) {
            var colors = PostProcessEffects._PIXEL_ART_PALETTES[params.palette] || [];
            for (var j = 0; j < 32; j++) {
                if (j < colors.length) {
                    pass.uniforms.uPalette.value[j].set(colors[j][0]/255, colors[j][1]/255, colors[j][2]/255);
                }
            }
            pass.uniforms.uPaletteSize.value = colors.length;
        }
    }
    pass.setSize = function(w, h) { this.uniforms.uResolution.value.set(w, h); };
    return pass;
};

//=============================================================================
// 13. Color Inversion / Negative - 색반전
//=============================================================================
PostProcessEffects.ColorInversionShader = {
    uniforms: {
        tColor:    { value: null },
        uStrength: { value: 1.0 }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uStrength;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 tex = texture2D(tColor, vUv);',
        '    vec3 inverted = vec3(1.0) - tex.rgb;',
        '    gl_FragColor = vec4(mix(tex.rgb, inverted, uStrength), tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createColorInversionPass = function(params) {
    var pass = createPass(this.ColorInversionShader);
    if (params) {
        if (params.strength != null) pass.uniforms.uStrength.value = params.strength;
    }
    return pass;
};

//=============================================================================
// 14. Edge Detection / Outline - 외곽선 검출
//=============================================================================
PostProcessEffects.EdgeDetectionShader = {
    uniforms: {
        tColor:      { value: null },
        uResolution: { value: new THREE.Vector2(816, 624) },
        uStrength:   { value: 1.0 },
        uThreshold:  { value: 0.1 },
        uOverlay:    { value: 1.0 }  // 0=edge only, 1=overlay on original
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform vec2 uResolution;',
        'uniform float uStrength;',
        'uniform float uThreshold;',
        'uniform float uOverlay;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec2 texel = vec2(1.0) / uResolution;',
        '    vec4 tex = texture2D(tColor, vUv);',
        // Sobel edge detection
        '    float tl = dot(texture2D(tColor, vUv + vec2(-texel.x,  texel.y)).rgb, vec3(0.299, 0.587, 0.114));',
        '    float t  = dot(texture2D(tColor, vUv + vec2(0.0,       texel.y)).rgb, vec3(0.299, 0.587, 0.114));',
        '    float tr = dot(texture2D(tColor, vUv + vec2( texel.x,  texel.y)).rgb, vec3(0.299, 0.587, 0.114));',
        '    float l  = dot(texture2D(tColor, vUv + vec2(-texel.x,  0.0    )).rgb, vec3(0.299, 0.587, 0.114));',
        '    float r  = dot(texture2D(tColor, vUv + vec2( texel.x,  0.0    )).rgb, vec3(0.299, 0.587, 0.114));',
        '    float bl = dot(texture2D(tColor, vUv + vec2(-texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));',
        '    float b  = dot(texture2D(tColor, vUv + vec2(0.0,      -texel.y)).rgb, vec3(0.299, 0.587, 0.114));',
        '    float br = dot(texture2D(tColor, vUv + vec2( texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));',
        '    float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;',
        '    float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;',
        '    float edge = sqrt(gx*gx + gy*gy) * uStrength;',
        '    edge = step(uThreshold, edge);',
        '    vec3 edgeColor = vec3(1.0 - edge);',
        '    vec3 result = mix(edgeColor, tex.rgb * edgeColor, uOverlay);',
        '    gl_FragColor = vec4(result, tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createEdgeDetectionPass = function(params) {
    var pass = createPass(this.EdgeDetectionShader);
    if (params) {
        if (params.strength != null) pass.uniforms.uStrength.value = params.strength;
        if (params.threshold != null) pass.uniforms.uThreshold.value = params.threshold;
        if (params.overlay != null) pass.uniforms.uOverlay.value = params.overlay;
    }
    pass.setSize = function(w, h) {
        this.uniforms.uResolution.value.set(w, h);
    };
    return pass;
};

//=============================================================================
// 15. SSAO (Screen Space Ambient Occlusion) - 간이 버전
//=============================================================================
PostProcessEffects.SSAOShader = {
    uniforms: {
        tColor:      { value: null },
        uResolution: { value: new THREE.Vector2(816, 624) },
        uRadius:     { value: 5.0 },
        uIntensity:  { value: 0.5 },
        uBias:       { value: 0.05 }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform vec2 uResolution;',
        'uniform float uRadius;',
        'uniform float uIntensity;',
        'uniform float uBias;',
        'varying vec2 vUv;',
        // Simple SSAO approximation based on luminance differences
        'float rand(vec2 co) {',
        '    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);',
        '}',
        'void main() {',
        '    vec4 tex = texture2D(tColor, vUv);',
        '    vec2 texel = vec2(1.0) / uResolution;',
        '    float centerLum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));',
        '    float occlusion = 0.0;',
        '    float sampleCount = 0.0;',
        '    for (int i = 0; i < 16; i++) {',
        '        float angle = float(i) * 2.39996323;',  // golden angle
        '        float r = sqrt(float(i + 1) / 16.0) * uRadius;',
        '        vec2 offset = vec2(cos(angle), sin(angle)) * r * texel;',
        '        vec4 s = texture2D(tColor, clamp(vUv + offset, 0.0, 1.0));',
        '        float sLum = dot(s.rgb, vec3(0.299, 0.587, 0.114));',
        '        float diff = centerLum - sLum;',
        '        if (diff > uBias) occlusion += 1.0;',
        '        sampleCount += 1.0;',
        '    }',
        '    occlusion = occlusion / sampleCount;',
        '    float ao = 1.0 - occlusion * uIntensity;',
        '    gl_FragColor = vec4(tex.rgb * ao, tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createSSAOPass = function(params) {
    var pass = createPass(this.SSAOShader);
    if (params) {
        if (params.radius != null) pass.uniforms.uRadius.value = params.radius;
        if (params.intensity != null) pass.uniforms.uIntensity.value = params.intensity;
        if (params.bias != null) pass.uniforms.uBias.value = params.bias;
    }
    pass.setSize = function(w, h) {
        this.uniforms.uResolution.value.set(w, h);
    };
    return pass;
};

//=============================================================================
// 16. Heat Haze - 아지랑이 (열기 UV 왜곡)
// lava 예제의 이중 UV 스크롤 기법을 응용한 포스트 프로세싱 패스.
// 사막, 화산, 여름 맵 등에서 열기 왜곡 연출에 활용.
//=============================================================================
PostProcessEffects.HeatHazeShader = {
    uniforms: {
        tColor:      { value: null },
        uTime:       { value: 0.0 },
        uAmplitude:  { value: 0.003 },
        uFrequencyX: { value: 15.0 },
        uFrequencyY: { value: 10.0 },
        uSpeed:      { value: 1.0 },
        uStrength:   { value: 1.0 }  // 0=미적용, 1=완전 적용 (on/off 보간용)
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uTime;',
        'uniform float uAmplitude;',
        'uniform float uFrequencyX;',
        'uniform float uFrequencyY;',
        'uniform float uSpeed;',
        'uniform float uStrength;',
        'varying vec2 vUv;',
        'void main() {',
        '    float t = uTime * uSpeed;',
        // 이중 독립 UV 스크롤 노이즈 (lava 예제 기법 응용)
        '    float n1 = sin(vUv.y * uFrequencyX + t * 1.1) * cos(vUv.x * uFrequencyY * 0.7 + t * 0.7);',
        '    float n2 = cos(vUv.y * uFrequencyY * 0.8 + t * 0.9) * sin(vUv.x * uFrequencyX * 0.5 + t * 1.3);',
        '    vec2 offset = vec2(n1 * uAmplitude, n2 * uAmplitude * 0.6) * uStrength;',
        '    gl_FragColor = texture2D(tColor, clamp(vUv + offset, 0.0, 1.0));',
        '}'
    ].join('\n')
};

PostProcessEffects.createHeatHazePass = function(params) {
    var pass = createPass(this.HeatHazeShader);
    if (params) {
        if (params.amplitude  != null) pass.uniforms.uAmplitude.value  = params.amplitude;
        if (params.frequencyX != null) pass.uniforms.uFrequencyX.value = params.frequencyX;
        if (params.frequencyY != null) pass.uniforms.uFrequencyY.value = params.frequencyY;
        if (params.speed      != null) pass.uniforms.uSpeed.value      = params.speed;
        if (params.strength   != null) pass.uniforms.uStrength.value   = params.strength;
    }
    return pass;
};

//=============================================================================
// 17. Scanlines - CRT 스캔라인
//=============================================================================
PostProcessEffects.ScanlinesShader = {
    uniforms: {
        tColor:      { value: null },
        uTime:       { value: 0.0 },
        uResolution: { value: new THREE.Vector2(816, 624) },
        uIntensity:  { value: 0.3 },
        uDensity:    { value: 1.0 },
        uSpeed:      { value: 0.0 }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uTime;',
        'uniform vec2 uResolution;',
        'uniform float uIntensity;',
        'uniform float uDensity;',
        'uniform float uSpeed;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 tex = texture2D(tColor, vUv);',
        '    float scrollY = vUv.y + uTime * uSpeed;',
        '    float lines = uResolution.y * uDensity;',
        '    float scan = sin(scrollY * lines * 3.14159265) * 0.5 + 0.5;',
        '    scan = pow(scan, 1.5);',
        '    float scanFactor = 1.0 - scan * uIntensity;',
        '    gl_FragColor = vec4(tex.rgb * scanFactor, tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createScanlinesPass = function(params) {
    var pass = createPass(this.ScanlinesShader);
    if (params) {
        if (params.intensity != null) pass.uniforms.uIntensity.value = params.intensity;
        if (params.density   != null) pass.uniforms.uDensity.value   = params.density;
        if (params.speed     != null) pass.uniforms.uSpeed.value     = params.speed;
    }
    pass.setSize = function(w, h) {
        this.uniforms.uResolution.value.set(w, h);
    };
    return pass;
};

//=============================================================================
// 18. Posterize - 포스터화 (색상 단계 감소)
//=============================================================================
PostProcessEffects.PosterizeShader = {
    uniforms: {
        tColor:  { value: null },
        uSteps:  { value: 8.0 },
        uBlend:  { value: 1.0 }  // 0=원본, 1=완전 포스터화 (on/off 전환용)
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uSteps;',
        'uniform float uBlend;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 tex = texture2D(tColor, vUv);',
        '    vec3 posterized = floor(tex.rgb * uSteps + 0.5) / uSteps;',
        '    gl_FragColor = vec4(mix(tex.rgb, posterized, uBlend), tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createPosterizePass = function(params) {
    var pass = createPass(this.PosterizeShader);
    if (params) {
        if (params.steps != null) pass.uniforms.uSteps.value = params.steps;
        if (params.blend != null) pass.uniforms.uBlend.value = params.blend;
    }
    return pass;
};

//=============================================================================
// 19. Barrel Distortion - CRT 배럴 왜곡 (볼록 곡면 시뮬레이션)
//=============================================================================
PostProcessEffects.BarrelDistortShader = {
    uniforms: {
        tColor:     { value: null },
        uCurvature: { value: 0.05 }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uCurvature;',
        'varying vec2 vUv;',
        'vec2 barrelUV(vec2 uv, float k) {',
        '    uv = uv * 2.0 - 1.0;',
        '    float r2 = uv.x * uv.x + uv.y * uv.y;',
        '    uv *= 1.0 + k * r2;',
        '    return uv * 0.5 + 0.5;',
        '}',
        'void main() {',
        '    vec2 distUV = barrelUV(vUv, uCurvature);',
        '    if (distUV.x < 0.0 || distUV.x > 1.0 || distUV.y < 0.0 || distUV.y > 1.0) {',
        '        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
        '        return;',
        '    }',
        '    gl_FragColor = texture2D(tColor, distUV);',
        '}'
    ].join('\n')
};

PostProcessEffects.createBarrelDistortPass = function(params) {
    var pass = createPass(this.BarrelDistortShader);
    if (params) {
        if (params.curvature != null) pass.uniforms.uCurvature.value = params.curvature;
    }
    return pass;
};

//=============================================================================
// 20. Anaglyph - 애너글리프 3D (빨간-청록 입체 효과)
//=============================================================================
PostProcessEffects.AnaglyphShader = {
    uniforms: {
        tColor:      { value: null },
        uSeparation: { value: 0.005 },
        uMode:       { value: 0 },
        uBlend:      { value: 1.0 }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uSeparation;',
        'uniform int uMode;',
        'uniform float uBlend;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 original = texture2D(tColor, vUv);',
        '    vec4 left  = texture2D(tColor, vUv + vec2(-uSeparation, 0.0));',
        '    vec4 right = texture2D(tColor, vUv + vec2( uSeparation, 0.0));',
        '    vec4 anaglyph;',
        '    if (uMode == 1) {',
        '        anaglyph = vec4(left.r, right.g, 0.0, 1.0);',
        '    } else if (uMode == 2) {',
        '        anaglyph = vec4(left.r, right.g, left.b, 1.0);',
        '    } else {',
        '        anaglyph = vec4(left.r, right.g, right.b, 1.0);',
        '    }',
        '    gl_FragColor = mix(original, anaglyph, uBlend);',
        '}'
    ].join('\n')
};

PostProcessEffects.createAnaglyphPass = function(params) {
    var pass = createPass(this.AnaglyphShader);
    if (params) {
        if (params.separation != null) pass.uniforms.uSeparation.value = params.separation;
        if (params.mode != null) pass.uniforms.uMode.value = params.mode;
        if (params.blend != null) pass.uniforms.uBlend.value = params.blend;
    }
    return pass;
};

//=============================================================================
// 21. CRT Phosphor Mask - 형광체 RGB 픽셀 마스크
//=============================================================================
PostProcessEffects.CRTPhosphorShader = {
    uniforms: {
        tColor:      { value: null },
        uStrength:   { value: 0.3 },
        uScale:      { value: 1.0 },
        uType:       { value: 0.0 },   // 0=Shadow Mask, 1=Aperture Grille
        uResolution: { value: new THREE.Vector2(816, 624) }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uStrength;',
        'uniform float uScale;',
        'uniform float uType;',
        'uniform vec2 uResolution;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 tex = texture2D(tColor, vUv);',
        '    vec2 pixel = vUv * uResolution / uScale;',
        '    vec3 mask;',
        '    if (uType < 0.5) {',
        // Shadow Mask: 홀수행은 0.5픽셀 오프셋된 RGB 삼각 배열
        '        float col = mod(floor(pixel.x), 3.0);',
        '        float row = mod(floor(pixel.y), 2.0);',
        '        if (row > 0.5) col = mod(col + 1.5, 3.0);',
        '        if (col < 0.5)       mask = vec3(1.0, 0.25, 0.25);',
        '        else if (col < 1.5)  mask = vec3(0.25, 1.0, 0.25);',
        '        else                 mask = vec3(0.25, 0.25, 1.0);',
        '    } else {',
        // Aperture Grille: 수직 RGB 스트라이프
        '        float col = mod(floor(pixel.x), 3.0);',
        '        if (col < 0.5)       mask = vec3(1.0, 0.2, 0.2);',
        '        else if (col < 1.5)  mask = vec3(0.2, 1.0, 0.2);',
        '        else                 mask = vec3(0.2, 0.2, 1.0);',
        '    }',
        // 마스크 적용 + 평균 휘도 보정 (shadow: 0.583, aperture: 0.467)
        '    float avgMask = (uType < 0.5) ? 0.583 : 0.467;',
        '    vec3 result = tex.rgb * mix(vec3(1.0), mask, uStrength);',
        '    result /= mix(1.0, avgMask, uStrength);',
        '    gl_FragColor = vec4(clamp(result, 0.0, 1.0), tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createCRTPhosphorPass = function(params) {
    var pass = createPass(this.CRTPhosphorShader);
    if (params) {
        if (params.strength != null) pass.uniforms.uStrength.value = params.strength;
        if (params.scale    != null) pass.uniforms.uScale.value    = params.scale;
        if (params.type     != null) pass.uniforms.uType.value     = params.type;
    }
    pass.setSize = function(w, h) { this.uniforms.uResolution.value.set(w, h); };
    return pass;
};

//=============================================================================
// 22. CRT Screen Glare - 화면 유리 반사광
//=============================================================================
PostProcessEffects.CRTGlareShader = {
    uniforms: {
        tColor:      { value: null },
        uPosX:       { value: 0.15 },
        uPosY:       { value: 0.18 },
        uRadiusX:    { value: 0.20 },
        uRadiusY:    { value: 0.12 },
        uIntensity:  { value: 0.25 },
        uColor:      { value: new THREE.Vector3(1.0, 1.0, 1.0) }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uPosX;',
        'uniform float uPosY;',
        'uniform float uRadiusX;',
        'uniform float uRadiusY;',
        'uniform float uIntensity;',
        'uniform vec3 uColor;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 tex = texture2D(tColor, vUv);',
        // 주 반사광: 타원형 강한 하이라이트
        '    vec2 d1 = (vUv - vec2(uPosX, uPosY)) / vec2(uRadiusX, uRadiusY);',
        '    float g1 = exp(-dot(d1, d1) * 3.5) * uIntensity;',
        // 보조 반사광: 좀 더 크고 은은한 빛 (실제 CRT의 두 번째 반사)
        '    vec2 d2 = (vUv - vec2(uPosX + 0.04, uPosY + 0.07)) / vec2(uRadiusX * 1.8, uRadiusY * 2.2);',
        '    float g2 = exp(-dot(d2, d2) * 2.5) * uIntensity * 0.35;',
        '    float glare = g1 + g2;',
        '    gl_FragColor = vec4(clamp(tex.rgb + uColor * glare, 0.0, 1.5), tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createCRTGlarePass = function(params) {
    var pass = createPass(this.CRTGlareShader);
    if (params) {
        if (params.posX      != null) pass.uniforms.uPosX.value      = params.posX;
        if (params.posY      != null) pass.uniforms.uPosY.value      = params.posY;
        if (params.radiusX   != null) pass.uniforms.uRadiusX.value   = params.radiusX;
        if (params.radiusY   != null) pass.uniforms.uRadiusY.value   = params.radiusY;
        if (params.intensity != null) pass.uniforms.uIntensity.value = params.intensity;
        if (params.color != null && typeof params.color === 'string' && params.color[0] === '#') {
            var r = parseInt(params.color.substr(1,2),16)/255;
            var g = parseInt(params.color.substr(3,2),16)/255;
            var b = parseInt(params.color.substr(5,2),16)/255;
            pass.uniforms.uColor.value.set(r, g, b);
        }
    }
    return pass;
};

//=============================================================================
// 23. CRT Phosphor Glow - 형광체 번짐 (밝은 영역 글로우)
//=============================================================================
PostProcessEffects.CRTGlowShader = {
    uniforms: {
        tColor:      { value: null },
        uIntensity:  { value: 0.5 },
        uRadius:     { value: 2.0 },
        uThreshold:  { value: 0.6 },
        uGlowColor:  { value: new THREE.Vector3(0.7, 0.9, 1.0) },
        uResolution: { value: new THREE.Vector2(816, 624) }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uIntensity;',
        'uniform float uRadius;',
        'uniform float uThreshold;',
        'uniform vec3 uGlowColor;',
        'uniform vec2 uResolution;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 tex = texture2D(tColor, vUv);',
        '    vec2 texel = uRadius / uResolution;',
        // 8방향 샘플링으로 글로우 근사
        '    vec3 glow = vec3(0.0);',
        '    vec2 o0 = vec2( 1.0,  0.0) * texel;',
        '    vec2 o1 = vec2(-1.0,  0.0) * texel;',
        '    vec2 o2 = vec2( 0.0,  1.0) * texel;',
        '    vec2 o3 = vec2( 0.0, -1.0) * texel;',
        '    vec2 o4 = vec2( 0.707,  0.707) * texel;',
        '    vec2 o5 = vec2(-0.707,  0.707) * texel;',
        '    vec2 o6 = vec2( 0.707, -0.707) * texel;',
        '    vec2 o7 = vec2(-0.707, -0.707) * texel;',
        '    vec3 s0 = texture2D(tColor, vUv + o0).rgb;',
        '    vec3 s1 = texture2D(tColor, vUv + o1).rgb;',
        '    vec3 s2 = texture2D(tColor, vUv + o2).rgb;',
        '    vec3 s3 = texture2D(tColor, vUv + o3).rgb;',
        '    vec3 s4 = texture2D(tColor, vUv + o4).rgb;',
        '    vec3 s5 = texture2D(tColor, vUv + o5).rgb;',
        '    vec3 s6 = texture2D(tColor, vUv + o6).rgb;',
        '    vec3 s7 = texture2D(tColor, vUv + o7).rgb;',
        '    float inv = 1.0 - uThreshold;',
        '    glow += s0 * max(0.0, dot(s0, vec3(0.299,0.587,0.114)) - uThreshold) / inv;',
        '    glow += s1 * max(0.0, dot(s1, vec3(0.299,0.587,0.114)) - uThreshold) / inv;',
        '    glow += s2 * max(0.0, dot(s2, vec3(0.299,0.587,0.114)) - uThreshold) / inv;',
        '    glow += s3 * max(0.0, dot(s3, vec3(0.299,0.587,0.114)) - uThreshold) / inv;',
        '    glow += s4 * max(0.0, dot(s4, vec3(0.299,0.587,0.114)) - uThreshold) / inv;',
        '    glow += s5 * max(0.0, dot(s5, vec3(0.299,0.587,0.114)) - uThreshold) / inv;',
        '    glow += s6 * max(0.0, dot(s6, vec3(0.299,0.587,0.114)) - uThreshold) / inv;',
        '    glow += s7 * max(0.0, dot(s7, vec3(0.299,0.587,0.114)) - uThreshold) / inv;',
        '    glow /= 8.0;',
        '    vec3 result = tex.rgb + glow * uGlowColor * uIntensity;',
        '    gl_FragColor = vec4(clamp(result, 0.0, 1.0), tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createCRTGlowPass = function(params) {
    var pass = createPass(this.CRTGlowShader);
    if (params) {
        if (params.intensity  != null) pass.uniforms.uIntensity.value  = params.intensity;
        if (params.radius     != null) pass.uniforms.uRadius.value     = params.radius;
        if (params.threshold  != null) pass.uniforms.uThreshold.value  = params.threshold;
        if (params.glowColor != null && typeof params.glowColor === 'string' && params.glowColor[0] === '#') {
            var r = parseInt(params.glowColor.substr(1,2),16)/255;
            var g = parseInt(params.glowColor.substr(3,2),16)/255;
            var b = parseInt(params.glowColor.substr(5,2),16)/255;
            pass.uniforms.uGlowColor.value.set(r, g, b);
        }
    }
    pass.setSize = function(w, h) { this.uniforms.uResolution.value.set(w, h); };
    return pass;
};

//=============================================================================
// 24. CRT Signal Noise - 수평 지터 + 신호 잡음
//=============================================================================
PostProcessEffects.CRTNoiseShader = {
    uniforms: {
        tColor:      { value: null },
        uTime:       { value: 0.0 },
        uJitter:     { value: 0.003 },
        uNoise:      { value: 0.04 },
        uSpeed:      { value: 8.0 },
        uResolution: { value: new THREE.Vector2(816, 624) }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uTime;',
        'uniform float uJitter;',
        'uniform float uNoise;',
        'uniform float uSpeed;',
        'uniform vec2 uResolution;',
        'varying vec2 vUv;',
        'float rand(vec2 co) {',
        '    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);',
        '}',
        'void main() {',
        '    vec2 uv = vUv;',
        '    float t = floor(uTime * uSpeed);',
        // 수평 지터: 일부 스캔라인만 수평 이동
        '    float row = floor(uv.y * uResolution.y);',
        '    float jitterMask = step(0.96, rand(vec2(row * 0.13, t * 0.37)));',
        '    float jitterAmt = (rand(vec2(row, t)) * 2.0 - 1.0) * uJitter * jitterMask;',
        '    uv.x = clamp(uv.x + jitterAmt, 0.0, 1.0);',
        '    vec4 tex = texture2D(tColor, uv);',
        // 화이트 노이즈
        '    float n = rand(uv + vec2(fract(uTime * 0.1), fract(uTime * 0.073)));',
        '    n = (n - 0.5) * uNoise;',
        '    gl_FragColor = vec4(clamp(tex.rgb + n, 0.0, 1.0), tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createCRTNoisePass = function(params) {
    var pass = createPass(this.CRTNoiseShader);
    if (params) {
        if (params.jitter != null) pass.uniforms.uJitter.value = params.jitter;
        if (params.noise  != null) pass.uniforms.uNoise.value  = params.noise;
        if (params.speed  != null) pass.uniforms.uSpeed.value  = params.speed;
    }
    pass.setSize = function(w, h) { this.uniforms.uResolution.value.set(w, h); };
    return pass;
};

//=============================================================================
// 25. CRT Corner Mask - 둥근 모서리 마스크
//=============================================================================
PostProcessEffects.CRTCornerShader = {
    uniforms: {
        tColor:    { value: null },
        uRadius:   { value: 0.05 },
        uSoftness: { value: 0.02 },
        uResolution: { value: new THREE.Vector2(816, 624) }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform float uRadius;',
        'uniform float uSoftness;',
        'uniform vec2 uResolution;',
        'varying vec2 vUv;',
        'float roundedBoxSDF(vec2 p, vec2 b, float r) {',
        '    vec2 d = abs(p) - b + r;',
        '    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;',
        '}',
        'void main() {',
        '    vec4 tex = texture2D(tColor, vUv);',
        // 화면 비율 보정: x 좌표를 aspect 기준으로 스케일
        '    float aspect = uResolution.x / uResolution.y;',
        '    vec2 p = (vUv * 2.0 - 1.0) * vec2(aspect, 1.0);',
        '    float dist = roundedBoxSDF(p, vec2(aspect, 1.0), uRadius);',
        '    float mask = 1.0 - smoothstep(-uSoftness, uSoftness * 0.5, dist);',
        '    gl_FragColor = vec4(tex.rgb * mask, tex.a);',
        '}'
    ].join('\n')
};

PostProcessEffects.createCRTCornerPass = function(params) {
    var pass = createPass(this.CRTCornerShader);
    if (params) {
        if (params.radius   != null) pass.uniforms.uRadius.value   = params.radius;
        if (params.softness != null) pass.uniforms.uSoftness.value = params.softness;
    }
    pass.setSize = function(w, h) { this.uniforms.uResolution.value.set(w, h); };
    return pass;
};

//=============================================================================
// 이펙트 목록 레지스트리 (에디터 UI에서 사용)
//=============================================================================
PostProcessEffects.EFFECT_LIST = [
    { key: 'vignette',     name: '비네트',         create: 'createVignettePass' },
    { key: 'colorGrading', name: '색조 보정',      create: 'createColorGradingPass' },
    { key: 'chromatic',    name: '색수차',         create: 'createChromaticAberrationPass' },
    { key: 'filmGrain',    name: '필름 그레인',    create: 'createFilmGrainPass' },
    { key: 'toneMapping',  name: '톤 매핑',        create: 'createToneMappingPass' },
    { key: 'fog',          name: '안개',           create: 'createFogPass' },
    { key: 'godRays',      name: '빛줄기',         create: 'createGodRaysPass' },
    { key: 'radialBlur',   name: '방사형 블러',    create: 'createRadialBlurPass' },
    { key: 'waveDistortion', name: '충격파 왜곡',  create: 'createWaveDistortionPass' },
    { key: 'anamorphic',   name: '아나모픽 플레어', create: 'createAnamorphicFlarePass' },
    { key: 'motionBlur',   name: '모션 블러',      create: 'createMotionBlurPass' },
    { key: 'pixelation',   name: '픽셀화',         create: 'createPixelationPass' },
    { key: 'pixelArt',     name: '픽셀 아트',       create: 'createPixelArtPass' },
    { key: 'colorInversion', name: '색반전',       create: 'createColorInversionPass' },
    { key: 'edgeDetection', name: '외곽선 검출',   create: 'createEdgeDetectionPass' },
    { key: 'ssao',          name: 'SSAO',          create: 'createSSAOPass' },
    { key: 'heatHaze',      name: '아지랑이',      create: 'createHeatHazePass' },
    { key: 'scanlines',     name: '스캔라인',          create: 'createScanlinesPass' },
    { key: 'posterize',     name: '포스터화',          create: 'createPosterizePass' },
    { key: 'barrelDistort', name: 'CRT 배럴 왜곡',     create: 'createBarrelDistortPass', defaultApplyOverUI: true },
    { key: 'anaglyph',      name: '애너글리프 3D',     create: 'createAnaglyphPass' },
    { key: 'crtPhosphor',   name: 'CRT 형광체 마스크', create: 'createCRTPhosphorPass', defaultApplyOverUI: true },
    { key: 'crtGlare',      name: 'CRT 반사광',        create: 'createCRTGlarePass',    defaultApplyOverUI: true },
    { key: 'crtGlow',       name: 'CRT 형광 번짐',     create: 'createCRTGlowPass' },
    { key: 'crtNoise',      name: 'CRT 신호 잡음',     create: 'createCRTNoisePass' },
    { key: 'crtCorner',     name: 'CRT 모서리 마스크', create: 'createCRTCornerPass',   defaultApplyOverUI: true }
];

// 이펙트별 파라미터 정의 (에디터 인스펙터용)
PostProcessEffects.EFFECT_PARAMS = {
    vignette: [
        { key: 'intensity', label: '강도',    min: 0, max: 2,   step: 0.05, default: 0.5 },
        { key: 'softness',  label: '부드러움', min: 0, max: 0.5, step: 0.05, default: 0.3 },
        { key: 'radius',    label: '반경',    min: 0, max: 0.7, step: 0.05, default: 0.4 },
        { key: 'color',     label: '색상',    type: 'color', default: '#000000' },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    colorGrading: [
        { key: 'brightness',  label: '밝기',    min: -0.5, max: 0.5, step: 0.01, default: 0 },
        { key: 'contrast',    label: '대비',    min: 0.5,  max: 2,   step: 0.05, default: 1 },
        { key: 'saturation',  label: '채도',    min: 0,    max: 3,   step: 0.05, default: 1 },
        { key: 'temperature', label: '색온도',  min: -1,   max: 1,   step: 0.05, default: 0 },
        { key: 'tint',        label: '틴트',    min: -1,   max: 1,   step: 0.05, default: 0 },
        { key: 'gamma',       label: '감마',    min: 0.5,  max: 2.5, step: 0.05, default: 1 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    chromatic: [
        { key: 'strength', label: '강도', min: 0, max: 0.05, step: 0.001, default: 0.005 },
        { key: 'radial',   label: '방사', min: 0, max: 3,    step: 0.1,   default: 1 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    filmGrain: [
        { key: 'intensity', label: '강도', min: 0, max: 0.5, step: 0.01, default: 0.1 },
        { key: 'size',      label: '크기', min: 0.5, max: 4, step: 0.1,  default: 1 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    toneMapping: [
        { key: 'exposure', label: '노출', min: 0.1, max: 3, step: 0.05, default: 1 },
        { key: 'mode',     label: '모드', type: 'select', options: [{v:0,l:'ACES'},{v:1,l:'Reinhard'},{v:2,l:'Linear'}], default: 0 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    fog: [
        { key: 'density', label: '밀도',     min: 0, max: 1,   step: 0.05, default: 0.3 },
        { key: 'start',   label: '시작',     min: 0, max: 1,   step: 0.05, default: 0 },
        { key: 'end',     label: '끝',       min: 0, max: 1,   step: 0.05, default: 1 },
        { key: 'color',   label: '안개 색상', type: 'color', default: '#ccd9e6' },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    godRays: [
        { key: 'lightPosX',    label: '조명 X',    min: 0, max: 1,   step: 0.01,  default: 0.5 },
        { key: 'lightPosY',    label: '조명 Y',    min: 0, max: 1,   step: 0.01,  default: 0 },
        { key: 'exposure',     label: '노출',      min: 0, max: 1,   step: 0.01,  default: 0.3 },
        { key: 'decay',        label: '감쇠',      min: 0.8, max: 1, step: 0.005, default: 0.95 },
        { key: 'density',      label: '밀도',      min: 0, max: 2,   step: 0.05,  default: 0.8 },
        { key: 'weight',       label: '가중치',    min: 0, max: 1,   step: 0.05,  default: 0.4 },
        { key: 'threshold',    label: '임계값',    min: 0, max: 1,   step: 0.05,  default: 0.5 },
        { key: 'rayColor',     label: '빛 색상',   type: 'color',    default: '#ffe8c0' },
        { key: 'maxDistance',  label: '거리 감쇠', min: 0.3, max: 3, step: 0.1,   default: 1.5 },
        { key: 'useOcclusion', label: '오클루전',  type: 'select', options: [{v:0,l:'루미넌스'},{v:1,l:'오클루전(3D)'}], default: 0 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    radialBlur: [
        { key: 'centerX',  label: '중심 X', min: 0, max: 1, step: 0.01, default: 0.5 },
        { key: 'centerY',  label: '중심 Y', min: 0, max: 1, step: 0.01, default: 0.5 },
        { key: 'strength', label: '강도',   min: 0, max: 0.5, step: 0.01, default: 0.1 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    waveDistortion: [
        { key: 'amplitude', label: '진폭',    min: 0, max: 0.1, step: 0.005, default: 0.03 },
        { key: 'waveWidth', label: '파폭',    min: 0, max: 0.5, step: 0.01,  default: 0.15 },
        { key: 'speed',     label: '속도',    min: 0, max: 5,   step: 0.1,   default: 1.5 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    anamorphic: [
        { key: 'threshold',    label: '임계값',  min: 0, max: 1,   step: 0.05, default: 0.7 },
        { key: 'intensity',    label: '강도',    min: 0, max: 2,   step: 0.05, default: 0.5 },
        { key: 'streakLength', label: '줄 길이', min: 0, max: 2,   step: 0.05, default: 0.5 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    motionBlur: [
        { key: 'velocityX', label: '속도 X', min: -0.05, max: 0.05, step: 0.001, default: 0 },
        { key: 'velocityY', label: '속도 Y', min: -0.05, max: 0.05, step: 0.001, default: 0 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    pixelation: [
        { key: 'pixelSize', label: '픽셀 크기', min: 1, max: 32, step: 1, default: 4 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    pixelArt: [
        { key: 'pixelSize', label: '픽셀 크기', min: 1, max: 32, step: 1, default: 4 },
        { key: 'palette',   label: '색상 팔레트', type: 'select', options: [
            { v: 'none',      l: '팔레트 없음' },
            { v: 'gameboy',   l: '게임보이 (4색)' },
            { v: 'nes',       l: 'NES (16색)' },
            { v: 'cga',       l: 'CGA (4색)' },
            { v: 'c64',       l: 'C64 (16색)' },
            { v: 'pico8',     l: 'PICO-8 (16색)' },
            { v: 'sweetie16', l: 'Sweetie 16 (16색)' },
            { v: 'mono',      l: '흑백 (9색)' },
            { v: 'pastel',    l: '파스텔 (12색)' }
        ], default: 'none' },
        { key: 'blend',       label: '혼합 강도',    min: 0, max: 1, step: 0.05, default: 1 },
        { key: 'applyOverUI', label: 'UI에도 적용',  type: 'checkbox', default: false }
    ],
    colorInversion: [
        { key: 'strength', label: '강도', min: 0, max: 1, step: 0.05, default: 1 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    edgeDetection: [
        { key: 'strength',  label: '강도',    min: 0, max: 3, step: 0.1,  default: 1 },
        { key: 'threshold', label: '임계값',  min: 0, max: 0.5, step: 0.01, default: 0.1 },
        { key: 'overlay',   label: '오버레이', min: 0, max: 1, step: 0.1,  default: 1 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    ssao: [
        { key: 'radius',    label: '반경', min: 1, max: 20, step: 0.5, default: 5 },
        { key: 'intensity', label: '강도', min: 0, max: 2,  step: 0.05, default: 0.5 },
        { key: 'bias',      label: '바이어스', min: 0, max: 0.2, step: 0.005, default: 0.05 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    heatHaze: [
        { key: 'strength',   label: '강도',       min: 0, max: 1,    step: 0.01,  default: 1 },
        { key: 'amplitude',  label: '왜곡 진폭',  min: 0, max: 0.02, step: 0.001, default: 0.003 },
        { key: 'frequencyX', label: '주파수 X',   min: 1, max: 40,   step: 1,     default: 15 },
        { key: 'frequencyY', label: '주파수 Y',   min: 1, max: 40,   step: 1,     default: 10 },
        { key: 'speed',      label: '속도',       min: 0, max: 5,    step: 0.1,   default: 1 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    scanlines: [
        { key: 'intensity', label: '강도',   min: 0,    max: 1,   step: 0.05,  default: 0.3 },
        { key: 'density',   label: '밀도',   min: 0.02, max: 1,   step: 0.02,  default: 1.0 },
        { key: 'speed',     label: '스크롤', min: 0,    max: 0.1, step: 0.005, default: 0.0 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    posterize: [
        { key: 'steps', label: '색상 단계', min: 2, max: 32, step: 1, default: 8 },
        { key: 'blend', label: '혼합 강도', min: 0, max: 1, step: 0.05, default: 1.0 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    barrelDistort: [
        { key: 'curvature', label: '곡면 강도', min: 0, max: 0.3, step: 0.01, default: 0.05 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: true }
    ],
    anaglyph: [
        { key: 'separation', label: '채널 분리', min: 0, max: 0.03, step: 0.001, default: 0.005 },
        { key: 'mode',       label: '색상 모드', type: 'select', options: [{v:0,l:'Red-Cyan'},{v:1,l:'Red-Green'},{v:2,l:'Magenta-Green'}], default: 0 },
        { key: 'blend',      label: '블렌드',    min: 0, max: 1,    step: 0.01,  default: 1 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    crtPhosphor: [
        { key: 'type',     label: '마스크 유형', type: 'select', options: [{v:0,l:'Shadow Mask'},{v:1,l:'Aperture Grille'}], default: 0 },
        { key: 'strength', label: '강도',       min: 0,   max: 1,   step: 0.05,  default: 0.3 },
        { key: 'scale',    label: '픽셀 배율',  min: 0.5, max: 4,   step: 0.25,  default: 1 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: true }
    ],
    crtGlare: [
        { key: 'posX',      label: '위치 X',    min: 0, max: 1,   step: 0.01,  default: 0.15 },
        { key: 'posY',      label: '위치 Y',    min: 0, max: 1,   step: 0.01,  default: 0.18 },
        { key: 'radiusX',   label: '반경 X',    min: 0, max: 0.5, step: 0.01,  default: 0.20 },
        { key: 'radiusY',   label: '반경 Y',    min: 0, max: 0.5, step: 0.01,  default: 0.12 },
        { key: 'intensity', label: '강도',      min: 0, max: 1,   step: 0.05,  default: 0.25 },
        { key: 'color',     label: '반사 색상', type: 'color', default: '#ffffff' },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: true }
    ],
    crtGlow: [
        { key: 'intensity',  label: '강도',       min: 0, max: 2,  step: 0.05, default: 0.5 },
        { key: 'radius',     label: '번짐 반경',  min: 1, max: 20, step: 0.5,  default: 2 },
        { key: 'threshold',  label: '임계 밝기',  min: 0, max: 1,  step: 0.05, default: 0.6 },
        { key: 'glowColor',  label: '빛 색상',    type: 'color', default: '#b3e5ff' },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    crtNoise: [
        { key: 'jitter', label: '수평 지터', min: 0, max: 0.02, step: 0.001, default: 0.003 },
        { key: 'noise',  label: '노이즈',    min: 0, max: 0.2,  step: 0.01,  default: 0.04 },
        { key: 'speed',  label: '속도',      min: 0, max: 20,   step: 1,     default: 8 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: false }
    ],
    crtCorner: [
        { key: 'radius',   label: '모서리 반경',   min: 0, max: 0.2,  step: 0.01,  default: 0.05 },
        { key: 'softness', label: '경계 부드러움', min: 0, max: 0.05, step: 0.005, default: 0.02 },
        { key: 'applyOverUI', label: 'UI에도 적용', type: 'checkbox', default: true }
    ]
};

//=============================================================================
// uniform 이름 ↔ 파라미터 키 매핑
//=============================================================================
PostProcessEffects._UNIFORM_MAP = {
    vignette:     { intensity: 'uIntensity', softness: 'uSoftness', radius: 'uRadius', color: 'uColor' },
    colorGrading: { brightness: 'uBrightness', contrast: 'uContrast', saturation: 'uSaturation',
                    temperature: 'uTemperature', tint: 'uTint', gamma: 'uGamma' },
    chromatic:    { strength: 'uStrength', radial: 'uRadial' },
    filmGrain:    { intensity: 'uIntensity', size: 'uSize' },
    toneMapping:  { exposure: 'uExposure', mode: 'uMode' },
    fog:          { density: 'uDensity', start: 'uStart', end: 'uEnd' },
    godRays:      { lightPosX: 'uLightPos', lightPosY: 'uLightPos', exposure: 'uExposure',
                    decay: 'uDecay', density: 'uDensity', weight: 'uWeight',
                    threshold: 'uThreshold', rayColor: 'uRayColor', maxDistance: 'uMaxDistance'
                    /* useOcclusion: pass 플래그 — applyParam에서 특수 처리 */ },
    radialBlur:   { centerX: 'uCenter', centerY: 'uCenter', strength: 'uStrength' },
    waveDistortion: { amplitude: 'uAmplitude', waveWidth: 'uWaveWidth', speed: 'uSpeed' },
    anamorphic:   { threshold: 'uThreshold', intensity: 'uIntensity', streakLength: 'uStreakLength' },
    motionBlur:   { velocityX: 'uVelocity', velocityY: 'uVelocity' },
    pixelation:   { pixelSize: 'uPixelSize' },
    pixelArt:     { pixelSize: 'uPixelSize', blend: 'uBlend' },
    colorInversion: { strength: 'uStrength' },
    edgeDetection: { strength: 'uStrength', threshold: 'uThreshold', overlay: 'uOverlay' },
    ssao:         { radius: 'uRadius', intensity: 'uIntensity', bias: 'uBias' },
    heatHaze:     { strength: 'uStrength', amplitude: 'uAmplitude', frequencyX: 'uFrequencyX', frequencyY: 'uFrequencyY', speed: 'uSpeed' },
    scanlines:    { intensity: 'uIntensity', density: 'uDensity', speed: 'uSpeed' },
    posterize:    { steps: 'uSteps', blend: 'uBlend' },
    barrelDistort: { curvature: 'uCurvature' },
    anaglyph:      { separation: 'uSeparation', mode: 'uMode', blend: 'uBlend' },
    crtPhosphor:   { strength: 'uStrength', scale: 'uScale', type: 'uType' },
    crtGlare:      { posX: 'uPosX', posY: 'uPosY', radiusX: 'uRadiusX', radiusY: 'uRadiusY', intensity: 'uIntensity', color: 'uColor' },
    crtGlow:       { intensity: 'uIntensity', radius: 'uRadius', threshold: 'uThreshold', glowColor: 'uGlowColor' },
    crtNoise:      { jitter: 'uJitter', noise: 'uNoise', speed: 'uSpeed' },
    crtCorner:     { radius: 'uRadius', softness: 'uSoftness' }
};

// 런타임에서 파라미터를 pass의 uniform에 적용
PostProcessEffects.applyParam = function(effectKey, pass, paramKey, value) {
    // pixelArt 팔레트 특수 처리: 팔레트 이름 → uniform vec3 배열 + 크기 설정
    if (effectKey === 'pixelArt' && paramKey === 'palette') {
        var colors = PostProcessEffects._PIXEL_ART_PALETTES[value] || [];
        for (var i = 0; i < 32; i++) {
            if (i < colors.length) {
                pass.uniforms.uPalette.value[i].set(colors[i][0]/255, colors[i][1]/255, colors[i][2]/255);
            } else {
                pass.uniforms.uPalette.value[i].set(0, 0, 0);
            }
        }
        pass.uniforms.uPaletteSize.value = colors.length;
        return;
    }

    // godRays 특수 처리: useOcclusion은 uniform이 아닌 pass 플래그
    if (effectKey === 'godRays' && paramKey === 'useOcclusion') {
        if (pass._occlusionEnabled !== undefined) pass._occlusionEnabled = !!value;
        return;
    }

    var map = this._UNIFORM_MAP[effectKey];
    if (!map) return;
    var uniformName = map[paramKey];
    if (!uniformName || !pass.uniforms[uniformName]) return;

    var u = pass.uniforms[uniformName];
    // Vector2 components (x/y)
    if (u.value && u.value.isVector2) {
        if (paramKey.endsWith('X') || paramKey === 'lightPosX' || paramKey === 'centerX') {
            u.value.x = value;
        } else if (paramKey.endsWith('Y') || paramKey === 'lightPosY' || paramKey === 'centerY') {
            u.value.y = value;
        }
    } else if (u.value && u.value.isVector3 && typeof value === 'string' && value[0] === '#') {
        // Vector3 색상 uniform: hex 문자열 파싱 (uColor, uRayColor 등 모든 색상 uniform에 적용)
        var r = parseInt(value.substr(1,2),16)/255;
        var g = parseInt(value.substr(3,2),16)/255;
        var b = parseInt(value.substr(5,2),16)/255;
        u.value.set(r, g, b);
    } else {
        u.value = value;
    }
};

})();
