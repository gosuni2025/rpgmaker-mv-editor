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
//=============================================================================
PostProcessEffects.GodRaysShader = {
    uniforms: {
        tColor:      { value: null },
        uLightPos:   { value: new THREE.Vector2(0.5, 0.0) },
        uExposure:   { value: 0.3 },
        uDecay:      { value: 0.95 },
        uDensity:    { value: 0.8 },
        uWeight:     { value: 0.4 },
        uSamples:    { value: 50 }
    },
    vertexShader: VERT,
    fragmentShader: [
        'uniform sampler2D tColor;',
        'uniform vec2 uLightPos;',
        'uniform float uExposure;',
        'uniform float uDecay;',
        'uniform float uDensity;',
        'uniform float uWeight;',
        'uniform int uSamples;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec2 texCoord = vUv;',
        '    vec2 deltaTexCoord = (texCoord - uLightPos) * (1.0 / float(uSamples)) * uDensity;',
        '    vec4 color = texture2D(tColor, texCoord);',
        '    float illuminationDecay = 1.0;',
        '    vec4 accum = vec4(0.0);',
        '    for (int i = 0; i < 50; i++) {',
        '        if (i >= uSamples) break;',
        '        texCoord -= deltaTexCoord;',
        '        vec4 sample0 = texture2D(tColor, clamp(texCoord, 0.0, 1.0));',
        '        float lum = dot(sample0.rgb, vec3(0.299, 0.587, 0.114));',
        '        sample0 *= lum * illuminationDecay * uWeight;',
        '        accum += sample0;',
        '        illuminationDecay *= uDecay;',
        '    }',
        '    gl_FragColor = color + accum * uExposure;',
        '    gl_FragColor.a = color.a;',
        '}'
    ].join('\n')
};

PostProcessEffects.createGodRaysPass = function(params) {
    var pass = createPass(this.GodRaysShader);
    if (params) {
        if (params.lightPosX != null) pass.uniforms.uLightPos.value.x = params.lightPosX;
        if (params.lightPosY != null) pass.uniforms.uLightPos.value.y = params.lightPosY;
        if (params.exposure != null) pass.uniforms.uExposure.value = params.exposure;
        if (params.decay != null) pass.uniforms.uDecay.value = params.decay;
        if (params.density != null) pass.uniforms.uDensity.value = params.density;
        if (params.weight != null) pass.uniforms.uWeight.value = params.weight;
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
    { key: 'colorInversion', name: '색반전',       create: 'createColorInversionPass' },
    { key: 'edgeDetection', name: '외곽선 검출',   create: 'createEdgeDetectionPass' },
    { key: 'ssao',          name: 'SSAO',          create: 'createSSAOPass' }
];

// 이펙트별 파라미터 정의 (에디터 인스펙터용)
PostProcessEffects.EFFECT_PARAMS = {
    vignette: [
        { key: 'intensity', label: '강도',    min: 0, max: 2,   step: 0.05, default: 0.5 },
        { key: 'softness',  label: '부드러움', min: 0, max: 0.5, step: 0.05, default: 0.3 },
        { key: 'radius',    label: '반경',    min: 0, max: 0.7, step: 0.05, default: 0.4 },
        { key: 'color',     label: '색상',    type: 'color', default: '#000000' }
    ],
    colorGrading: [
        { key: 'brightness',  label: '밝기',    min: -0.5, max: 0.5, step: 0.01, default: 0 },
        { key: 'contrast',    label: '대비',    min: 0.5,  max: 2,   step: 0.05, default: 1 },
        { key: 'saturation',  label: '채도',    min: 0,    max: 3,   step: 0.05, default: 1 },
        { key: 'temperature', label: '색온도',  min: -1,   max: 1,   step: 0.05, default: 0 },
        { key: 'tint',        label: '틴트',    min: -1,   max: 1,   step: 0.05, default: 0 },
        { key: 'gamma',       label: '감마',    min: 0.5,  max: 2.5, step: 0.05, default: 1 }
    ],
    chromatic: [
        { key: 'strength', label: '강도', min: 0, max: 0.05, step: 0.001, default: 0.005 },
        { key: 'radial',   label: '방사', min: 0, max: 3,    step: 0.1,   default: 1 }
    ],
    filmGrain: [
        { key: 'intensity', label: '강도', min: 0, max: 0.5, step: 0.01, default: 0.1 },
        { key: 'size',      label: '크기', min: 0.5, max: 4, step: 0.1,  default: 1 }
    ],
    toneMapping: [
        { key: 'exposure', label: '노출', min: 0.1, max: 3, step: 0.05, default: 1 },
        { key: 'mode',     label: '모드', type: 'select', options: [{v:0,l:'ACES'},{v:1,l:'Reinhard'},{v:2,l:'Linear'}], default: 0 }
    ],
    fog: [
        { key: 'density', label: '밀도',     min: 0, max: 1,   step: 0.05, default: 0.3 },
        { key: 'start',   label: '시작',     min: 0, max: 1,   step: 0.05, default: 0 },
        { key: 'end',     label: '끝',       min: 0, max: 1,   step: 0.05, default: 1 },
        { key: 'color',   label: '안개 색상', type: 'color', default: '#ccd9e6' }
    ],
    godRays: [
        { key: 'lightPosX', label: '조명 X', min: 0, max: 1, step: 0.01, default: 0.5 },
        { key: 'lightPosY', label: '조명 Y', min: 0, max: 1, step: 0.01, default: 0 },
        { key: 'exposure',  label: '노출',   min: 0, max: 1, step: 0.01, default: 0.3 },
        { key: 'decay',     label: '감쇠',   min: 0.8, max: 1, step: 0.005, default: 0.95 },
        { key: 'density',   label: '밀도',   min: 0, max: 2, step: 0.05, default: 0.8 },
        { key: 'weight',    label: '가중치', min: 0, max: 1, step: 0.05, default: 0.4 }
    ],
    radialBlur: [
        { key: 'centerX',  label: '중심 X', min: 0, max: 1, step: 0.01, default: 0.5 },
        { key: 'centerY',  label: '중심 Y', min: 0, max: 1, step: 0.01, default: 0.5 },
        { key: 'strength', label: '강도',   min: 0, max: 0.5, step: 0.01, default: 0.1 }
    ],
    waveDistortion: [
        { key: 'amplitude', label: '진폭',    min: 0, max: 0.1, step: 0.005, default: 0.03 },
        { key: 'waveWidth', label: '파폭',    min: 0, max: 0.5, step: 0.01,  default: 0.15 },
        { key: 'speed',     label: '속도',    min: 0, max: 5,   step: 0.1,   default: 1.5 }
    ],
    anamorphic: [
        { key: 'threshold',    label: '임계값',  min: 0, max: 1,   step: 0.05, default: 0.7 },
        { key: 'intensity',    label: '강도',    min: 0, max: 2,   step: 0.05, default: 0.5 },
        { key: 'streakLength', label: '줄 길이', min: 0, max: 2,   step: 0.05, default: 0.5 }
    ],
    motionBlur: [
        { key: 'velocityX', label: '속도 X', min: -0.05, max: 0.05, step: 0.001, default: 0 },
        { key: 'velocityY', label: '속도 Y', min: -0.05, max: 0.05, step: 0.001, default: 0 }
    ],
    pixelation: [
        { key: 'pixelSize', label: '픽셀 크기', min: 1, max: 32, step: 1, default: 4 }
    ],
    colorInversion: [
        { key: 'strength', label: '강도', min: 0, max: 1, step: 0.05, default: 1 }
    ],
    edgeDetection: [
        { key: 'strength',  label: '강도',    min: 0, max: 3, step: 0.1,  default: 1 },
        { key: 'threshold', label: '임계값',  min: 0, max: 0.5, step: 0.01, default: 0.1 },
        { key: 'overlay',   label: '오버레이', min: 0, max: 1, step: 0.1,  default: 1 }
    ],
    ssao: [
        { key: 'radius',    label: '반경', min: 1, max: 20, step: 0.5, default: 5 },
        { key: 'intensity', label: '강도', min: 0, max: 2,  step: 0.05, default: 0.5 },
        { key: 'bias',      label: '바이어스', min: 0, max: 0.2, step: 0.005, default: 0.05 }
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
                    decay: 'uDecay', density: 'uDensity', weight: 'uWeight' },
    radialBlur:   { centerX: 'uCenter', centerY: 'uCenter', strength: 'uStrength' },
    waveDistortion: { amplitude: 'uAmplitude', waveWidth: 'uWaveWidth', speed: 'uSpeed' },
    anamorphic:   { threshold: 'uThreshold', intensity: 'uIntensity', streakLength: 'uStreakLength' },
    motionBlur:   { velocityX: 'uVelocity', velocityY: 'uVelocity' },
    pixelation:   { pixelSize: 'uPixelSize' },
    colorInversion: { strength: 'uStrength' },
    edgeDetection: { strength: 'uStrength', threshold: 'uThreshold', overlay: 'uOverlay' },
    ssao:         { radius: 'uRadius', intensity: 'uIntensity', bias: 'uBias' }
};

// 런타임에서 파라미터를 pass의 uniform에 적용
PostProcessEffects.applyParam = function(effectKey, pass, paramKey, value) {
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
    } else if (uniformName === 'uColor' && u.value && u.value.isVector3) {
        // fog color: parse hex string
        if (typeof value === 'string' && value[0] === '#') {
            var r = parseInt(value.substr(1,2),16)/255;
            var g = parseInt(value.substr(3,2),16)/255;
            var b = parseInt(value.substr(5,2),16)/255;
            u.value.set(r, g, b);
        }
    } else {
        u.value = value;
    }
};

})();
