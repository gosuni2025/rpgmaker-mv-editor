//=============================================================================
// PictureShader.js - 그림(Picture) 셰이더 애니메이션 플러그인
//=============================================================================
// Game_Picture에 셰이더 데이터를 저장하고, Sprite_Picture에서
// Three.js ShaderMaterial로 교체하여 실시간 셰이더 이펙트를 적용한다.
// parameters[10]에 셰이더 정보 객체를 넣어 하위 호환을 유지한다.
//=============================================================================

var PictureShader = {};

// 전역 시간 (매 프레임 업데이트)
PictureShader._time = 0;
// Three.js 렌더러 참조 (멀티패스용)
PictureShader._renderer = null;

//=============================================================================
// 공통 Vertex Shader
//=============================================================================

PictureShader._VERTEX_SHADER = [
    'varying vec2 vUv;',
    'void main() {',
    '    vUv = uv;',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}',
].join('\n');

//=============================================================================
// Fragment Shader 정의 (10종)
//=============================================================================

// 1. Wave (물결)
PictureShader._FRAGMENT_WAVE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uAmplitude;',
    'uniform float uFrequency;',
    'uniform float uSpeed;',
    'uniform float uDirection;', // 0=horizontal, 1=vertical, 2=both
    'varying vec2 vUv;',
    'void main() {',
    '    vec2 uv = vUv;',
    '    float amp = uAmplitude / 1000.0;',
    '    if (uDirection == 0.0 || uDirection == 2.0) {',
    '        uv.x += sin(uv.y * uFrequency + uTime * uSpeed) * amp;',
    '    }',
    '    if (uDirection == 1.0 || uDirection == 2.0) {',
    '        uv.y += sin(uv.x * uFrequency + uTime * uSpeed) * amp;',
    '    }',
    '    vec4 color = texture2D(map, uv);',
    '    color.a *= opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 2. Glitch (글리치)
PictureShader._FRAGMENT_GLITCH = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uIntensity;',
    'uniform float uRgbShift;',
    'uniform float uLineSpeed;',
    'uniform float uBlockSize;',
    'varying vec2 vUv;',
    '',
    'float random(vec2 st) {',
    '    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);',
    '}',
    '',
    'void main() {',
    '    vec2 uv = vUv;',
    '    float t = floor(uTime * uLineSpeed * 10.0);',
    '    float blockY = floor(uv.y * (50.0 / uBlockSize));',
    '    float noise = random(vec2(blockY, t));',
    '    float glitchStrength = step(1.0 - uIntensity * 0.3, noise);',
    '    uv.x += (noise - 0.5) * glitchStrength * uIntensity * 0.1;',
    '    float shift = uRgbShift / 1000.0 * glitchStrength;',
    '    vec4 color;',
    '    color.r = texture2D(map, uv + vec2(shift, 0.0)).r;',
    '    color.g = texture2D(map, uv).g;',
    '    color.b = texture2D(map, uv - vec2(shift, 0.0)).b;',
    '    color.a = texture2D(map, uv).a;',
    '    color.a *= opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 3. Dissolve (디졸브)
// animMode: 0=왕복(oscillate), 1=원웨이(one-way, min→max 후 정지)
PictureShader._FRAGMENT_DISSOLVE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uThreshold;',
    'uniform float uEdgeWidth;',
    'uniform vec3 uEdgeColor;',
    'uniform float uNoiseScale;',
    'uniform float uAnimSpeed;',
    'uniform float uAnimMode;',
    'uniform float uThresholdMin;',
    'uniform float uThresholdMax;',
    'varying vec2 vUv;',
    '',
    'float random(vec2 st) {',
    '    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);',
    '}',
    '',
    'float noise(vec2 st) {',
    '    vec2 i = floor(st);',
    '    vec2 f = fract(st);',
    '    float a = random(i);',
    '    float b = random(i + vec2(1.0, 0.0));',
    '    float c = random(i + vec2(0.0, 1.0));',
    '    float d = random(i + vec2(1.0, 1.0));',
    '    vec2 u = f * f * (3.0 - 2.0 * f);',
    '    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;',
    '}',
    '',
    'void main() {',
    '    vec4 color = texture2D(map, vUv);',
    '    float n = noise(vUv * uNoiseScale);',
    '    float thresh = uThreshold;',
    '    if (uAnimSpeed > 0.0) {',
    '        float t;',
    '        if (uAnimMode < 0.5) {',
    '            t = 0.5 + 0.5 * sin(uTime * uAnimSpeed);',
    '        } else {',
    '            t = clamp(uTime * uAnimSpeed * 0.5, 0.0, 1.0);',
    '        }',
    '        thresh = mix(uThresholdMin, uThresholdMax, t);',
    '    }',
    '    float edge = smoothstep(thresh - uEdgeWidth, thresh, n);',
    '    float edgeGlow = smoothstep(thresh, thresh + uEdgeWidth, n);',
    '    color.rgb = mix(uEdgeColor, color.rgb, edgeGlow);',
    '    color.a *= edge * opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 4. Glow (발광)
// animMode: 0=왕복(oscillate), 1=원웨이(one-way, 0→max 후 정지)
PictureShader._FRAGMENT_GLOW = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uIntensity;',
    'uniform float uRadius;',
    'uniform vec3 uColor;',
    'uniform float uPulseSpeed;',
    'uniform float uAnimMode;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 color = texture2D(map, vUv);',
    '    float pulse = 1.0;',
    '    if (uPulseSpeed > 0.0) {',
    '        if (uAnimMode < 0.5) {',
    '            pulse = 0.5 + 0.5 * sin(uTime * uPulseSpeed);',
    '        } else {',
    '            pulse = clamp(uTime * uPulseSpeed * 0.5, 0.0, 1.0);',
    '        }',
    '    }',
    '    float r = uRadius / 1000.0;',
    '    vec4 glow = vec4(0.0);',
    '    float total = 0.0;',
    '    for (float x = -3.0; x <= 3.0; x += 1.0) {',
    '        for (float y = -3.0; y <= 3.0; y += 1.0) {',
    '            float w = exp(-(x*x+y*y)/4.5);',
    '            glow += texture2D(map, vUv + vec2(x,y) * r) * w;',
    '            total += w;',
    '        }',
    '    }',
    '    glow /= total;',
    '    vec3 glowColor = glow.rgb * uColor * uIntensity * pulse;',
    '    color.rgb += glowColor * glow.a;',
    '    color.a *= opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 5. Chromatic Aberration (색수차)
// animMode: 0=왕복(oscillate), 1=원웨이(one-way, 0→max 후 정지)
PictureShader._FRAGMENT_CHROMATIC = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uOffset;',
    'uniform float uAngle;',
    'uniform float uPulseSpeed;',
    'uniform float uAnimMode;',
    'varying vec2 vUv;',
    'void main() {',
    '    float pulse = 1.0;',
    '    if (uPulseSpeed > 0.0) {',
    '        if (uAnimMode < 0.5) {',
    '            pulse = 0.5 + 0.5 * sin(uTime * uPulseSpeed);',
    '        } else {',
    '            pulse = clamp(uTime * uPulseSpeed * 0.5, 0.0, 1.0);',
    '        }',
    '    }',
    '    float off = uOffset / 1000.0 * pulse;',
    '    float a = uAngle * 3.14159265 / 180.0;',
    '    vec2 dir = vec2(cos(a), sin(a)) * off;',
    '    vec4 color;',
    '    color.r = texture2D(map, vUv + dir).r;',
    '    color.g = texture2D(map, vUv).g;',
    '    color.b = texture2D(map, vUv - dir).b;',
    '    color.a = texture2D(map, vUv).a;',
    '    color.a *= opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 6. Pixelate (픽셀화)
// animMode: 0=왕복(oscillate), 1=원웨이(one-way, min→max 후 정지)
PictureShader._FRAGMENT_PIXELATE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uSize;',
    'uniform float uPulseSpeed;',
    'uniform float uAnimMode;',
    'uniform float uMinSize;',
    'uniform float uMaxSize;',
    'varying vec2 vUv;',
    'void main() {',
    '    float size = uSize;',
    '    if (uPulseSpeed > 0.0) {',
    '        float t;',
    '        if (uAnimMode < 0.5) {',
    '            t = 0.5 + 0.5 * sin(uTime * uPulseSpeed);',
    '        } else {',
    '            t = clamp(uTime * uPulseSpeed * 0.5, 0.0, 1.0);',
    '        }',
    '        size = mix(uMinSize, uMaxSize, t);',
    '    }',
    '    vec2 texSize = vec2(textureSize(map, 0));',
    '    vec2 pixelSize = size / texSize;',
    '    vec2 uv = floor(vUv / pixelSize) * pixelSize + pixelSize * 0.5;',
    '    vec4 color = texture2D(map, uv);',
    '    color.a *= opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 7. Shake (흔들림) — JS 레벨에서 position offset 처리, fragment는 패스스루
PictureShader._FRAGMENT_SHAKE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 color = texture2D(map, vUv);',
    '    color.a *= opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 8. Blur (흐림)
// animMode: 0=왕복(oscillate), 1=원웨이(one-way, min→max 후 정지)
PictureShader._FRAGMENT_BLUR = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uStrength;',
    'uniform float uPulseSpeed;',
    'uniform float uAnimMode;',
    'uniform float uMinStrength;',
    'uniform float uMaxStrength;',
    'varying vec2 vUv;',
    'void main() {',
    '    float strength = uStrength;',
    '    if (uPulseSpeed > 0.0) {',
    '        float t;',
    '        if (uAnimMode < 0.5) {',
    '            t = 0.5 + 0.5 * sin(uTime * uPulseSpeed);',
    '        } else {',
    '            t = clamp(uTime * uPulseSpeed * 0.5, 0.0, 1.0);',
    '        }',
    '        strength = mix(uMinStrength, uMaxStrength, t);',
    '    }',
    '    float r = strength / 1000.0;',
    '    vec4 color = vec4(0.0);',
    '    float total = 0.0;',
    '    for (float x = -4.0; x <= 4.0; x += 1.0) {',
    '        for (float y = -4.0; y <= 4.0; y += 1.0) {',
    '            float w = exp(-(x*x+y*y)/8.0);',
    '            color += texture2D(map, vUv + vec2(x,y) * r) * w;',
    '            total += w;',
    '        }',
    '    }',
    '    color /= total;',
    '    color.a *= opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 9. Rainbow (무지개)
PictureShader._FRAGMENT_RAINBOW = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uSpeed;',
    'uniform float uSaturation;',
    'uniform float uBrightness;',
    'varying vec2 vUv;',
    '',
    'vec3 rgb2hsv(vec3 c) {',
    '    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);',
    '    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));',
    '    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));',
    '    float d = q.x - min(q.w, q.y);',
    '    float e = 1.0e-10;',
    '    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);',
    '}',
    '',
    'vec3 hsv2rgb(vec3 c) {',
    '    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);',
    '    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);',
    '    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);',
    '}',
    '',
    'void main() {',
    '    vec4 color = texture2D(map, vUv);',
    '    float hueShift = fract(uTime * uSpeed * 0.1 + vUv.x * 0.5 + vUv.y * 0.3);',
    '    vec3 hsv = rgb2hsv(color.rgb);',
    '    hsv.x = fract(hsv.x + hueShift);',
    '    hsv.y = min(hsv.y + uSaturation, 1.0);',
    '    hsv.z = min(hsv.z + uBrightness, 1.0);',
    '    color.rgb = hsv2rgb(hsv);',
    '    color.a *= opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 10. Outline (외곽선)
// 이미지 알파 경계를 감지하여 발광 외곽선을 그린다.
// animMode: 0=왕복(oscillate), 1=원웨이(one-way, min→max 후 정지)
PictureShader._FRAGMENT_OUTLINE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uThickness;',
    'uniform vec3 uColor;',
    'uniform float uIntensity;',
    'uniform float uAnimSpeed;',
    'uniform float uAnimMode;',
    'uniform float uAnimMin;',
    'uniform float uAnimMax;',
    'varying vec2 vUv;',
    '',
    'void main() {',
    '    vec4 color = texture2D(map, vUv);',
    '    vec2 texSize = vec2(textureSize(map, 0));',
    '    vec2 pixelSize = 1.0 / texSize;',
    '',
    '    // 주변 알파 샘플링으로 외곽 감지',
    '    float maxAlpha = 0.0;',
    '    float thickness = uThickness;',
    '    for (float a = 0.0; a < 6.2832; a += 0.7854) {',
    '        vec2 offset = vec2(cos(a), sin(a)) * pixelSize * thickness;',
    '        maxAlpha = max(maxAlpha, texture2D(map, vUv + offset).a);',
    '    }',
    '',
    '    // 외곽선 = 주변에 불투명 픽셀이 있지만 현재 픽셀은 투명한 영역',
    '    float outline = maxAlpha * (1.0 - color.a);',
    '',
    '    // 애니메이션 계산',
    '    float pulse = uIntensity;',
    '    if (uAnimSpeed > 0.0) {',
    '        float t;',
    '        if (uAnimMode < 0.5) {',
    '            // 0: 왕복',
    '            t = 0.5 + 0.5 * sin(uTime * uAnimSpeed);',
    '        } else {',
    '            // 1: 원웨이 (min→max 도달 후 정지)',
    '            t = clamp(uTime * uAnimSpeed * 0.5, 0.0, 1.0);',
    '        }',
    '        pulse = mix(uAnimMin, uAnimMax, t);',
    '    }',
    '',
    '    // 외곽선 발광 색상을 원본에 합성',
    '    vec3 outlineColor = uColor * pulse;',
    '    color.rgb = mix(color.rgb, outlineColor, outline);',
    '    color.a = max(color.a, outline * pulse) * opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 11. Fire Aura (불꽃 오라)
// 이미지 외곽에서 노이즈 기반의 불규칙한 불꽃이 타오르는 효과.
// animMode: 0=왕복(oscillate), 1=원웨이(one-way, 0→max 후 정지)
PictureShader._FRAGMENT_FIRE_AURA = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uRadius;',
    'uniform float uIntensity;',
    'uniform float uSpeed;',
    'uniform float uNoiseScale;',
    'uniform vec3 uInnerColor;',
    'uniform vec3 uOuterColor;',
    'uniform float uTurbulence;',
    'uniform float uFlameHeight;',
    'uniform float uAnimMode;',
    'uniform float uAnimSpeed;',
    'varying vec2 vUv;',
    '',
    '// 2D 심플렉스 유사 노이즈',
    'float hash(vec2 p) {',
    '    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
    '}',
    '',
    'float noise(vec2 p) {',
    '    vec2 i = floor(p);',
    '    vec2 f = fract(p);',
    '    float a = hash(i);',
    '    float b = hash(i + vec2(1.0, 0.0));',
    '    float c = hash(i + vec2(0.0, 1.0));',
    '    float d = hash(i + vec2(1.0, 1.0));',
    '    vec2 u = f * f * (3.0 - 2.0 * f);',
    '    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;',
    '}',
    '',
    'float fbm(vec2 p) {',
    '    float v = 0.0;',
    '    float a = 0.5;',
    '    vec2 shift = vec2(100.0);',
    '    for (int i = 0; i < 5; i++) {',
    '        v += a * noise(p);',
    '        p = p * 2.0 + shift;',
    '        a *= 0.5;',
    '    }',
    '    return v;',
    '}',
    '',
    'void main() {',
    '    vec4 color = texture2D(map, vUv);',
    '    vec2 texSize = vec2(textureSize(map, 0));',
    '    vec2 pixelSize = 1.0 / texSize;',
    '',
    '    // 애니메이션에 따른 강도 계수',
    '    float animMul = 1.0;',
    '    if (uAnimSpeed > 0.0) {',
    '        if (uAnimMode < 0.5) {',
    '            // 0: 왕복 - intensity가 0~max 사이를 왔다갔다',
    '            animMul = 0.5 + 0.5 * sin(uTime * uAnimSpeed);',
    '        } else {',
    '            // 1: 원웨이 - 0에서 1로 한번 올라가고 정지',
    '            animMul = clamp(uTime * uAnimSpeed * 0.5, 0.0, 1.0);',
    '        }',
    '    }',
    '    float effectIntensity = uIntensity * animMul;',
    '    float effectRadius = uRadius * animMul;',
    '',
    '    // 주변 알파 최대값으로 원본 마스크(거리장 근사) 생성',
    '    float radius = effectRadius;',
    '    float maxAlpha = 0.0;',
    '    float distFromEdge = 999.0;',
    '',
    '    // 외곽으로부터의 거리 추정',
    '    for (float r = 1.0; r <= 20.0; r += 1.0) {',
    '        if (r > radius) break;',
    '        float found = 0.0;',
    '        for (float a = 0.0; a < 6.2832; a += 0.3927) {',
    '            vec2 offset = vec2(cos(a), sin(a)) * pixelSize * r;',
    '            float sAlpha = texture2D(map, vUv + offset).a;',
    '            found = max(found, sAlpha);',
    '        }',
    '        if (found > 0.5 && color.a < 0.5) {',
    '            distFromEdge = min(distFromEdge, r);',
    '        }',
    '    }',
    '',
    '    // 현재 픽셀이 투명하고 근처에 불투명 경계가 있으면 불꽃 생성',
    '    float aura = 0.0;',
    '    if (color.a < 0.5 && distFromEdge < radius) {',
    '        // 노이즈 기반 불꽃 형태',
    '        float t = uTime * uSpeed;',
    '        vec2 noiseCoord = vUv * uNoiseScale;',
    '',
    '        // 위로 솟아오르는 불꽃 효과 (Y 방향 오프셋)',
    '        noiseCoord.y -= t * uFlameHeight;',
    '',
    '        // 난류로 불규칙한 형태',
    '        float n = fbm(noiseCoord + vec2(t * 0.3, t * 0.1) * uTurbulence);',
    '        float n2 = fbm(noiseCoord * 1.5 + vec2(-t * 0.2, t * 0.15) * uTurbulence);',
    '        float combined = (n + n2) * 0.5;',
    '',
    '        // 거리에 따른 감쇄',
    '        float distFade = 1.0 - (distFromEdge / radius);',
    '        distFade = pow(distFade, 0.8);',
    '',
    '        // 노이즈로 불규칙한 경계 (디졸브)',
    '        aura = distFade * combined * effectIntensity;',
    '        aura = smoothstep(0.1, 0.6, aura);',
    '    }',
    '',
    '    // 원본 이미지 경계에도 얇은 발광',
    '    if (color.a > 0.5) {',
    '        float edgeDist = 999.0;',
    '        for (float a = 0.0; a < 6.2832; a += 0.7854) {',
    '            vec2 offset = vec2(cos(a), sin(a)) * pixelSize * 2.0;',
    '            if (texture2D(map, vUv + offset).a < 0.5) {',
    '                edgeDist = 1.0;',
    '                break;',
    '            }',
    '        }',
    '        if (edgeDist < 2.0) {',
    '            aura = max(aura, 0.4 * effectIntensity);',
    '        }',
    '    }',
    '',
    '    // 내부/외부 색상 보간',
    '    float gradientT = clamp(distFromEdge / max(radius, 0.001), 0.0, 1.0);',
    '    vec3 flameColor = mix(uInnerColor, uOuterColor, gradientT);',
    '',
    '    // 합성',
    '    color.rgb = mix(color.rgb, flameColor, aura * (1.0 - color.a) + aura * 0.3 * color.a);',
    '    color.a = max(color.a, aura) * opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 12. Hologram (홀로그램)
PictureShader._FRAGMENT_HOLOGRAM = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uScanlineSpacing;',
    'uniform float uScanlineAlpha;',
    'uniform float uFlickerSpeed;',
    'uniform float uFlickerIntensity;',
    'uniform float uRgbShift;',
    'uniform vec3 uTint;',
    'varying vec2 vUv;',
    '',
    'float random(vec2 st) {',
    '    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);',
    '}',
    '',
    'void main() {',
    '    vec2 uv = vUv;',
    '    float shift = uRgbShift / 1000.0;',
    '    vec4 color;',
    '    color.r = texture2D(map, uv + vec2(shift, 0.0)).r;',
    '    color.g = texture2D(map, uv).g;',
    '    color.b = texture2D(map, uv - vec2(shift, 0.0)).b;',
    '    color.a = texture2D(map, uv).a;',
    '',
    '    // Scanlines',
    '    float texH = float(textureSize(map, 0).y);',
    '    float scanline = step(0.5, fract(uv.y * texH / uScanlineSpacing));',
    '    color.a *= mix(1.0, uScanlineAlpha, scanline);',
    '',
    '    // Flicker',
    '    float flicker = 1.0 - uFlickerIntensity * 0.5 * (1.0 + sin(uTime * uFlickerSpeed));',
    '    flicker *= 1.0 - uFlickerIntensity * 0.2 * random(vec2(floor(uTime * 20.0), 0.0));',
    '    color.rgb *= flicker;',
    '',
    '    // Tint',
    '    color.rgb *= uTint;',
    '',
    '    color.a *= opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

//=============================================================================
// 셰이더 타입별 fragment shader 매핑
//=============================================================================

PictureShader._FRAGMENT_SHADERS = {
    'wave':      PictureShader._FRAGMENT_WAVE,
    'glitch':    PictureShader._FRAGMENT_GLITCH,
    'dissolve':  PictureShader._FRAGMENT_DISSOLVE,
    'glow':      PictureShader._FRAGMENT_GLOW,
    'chromatic': PictureShader._FRAGMENT_CHROMATIC,
    'pixelate':  PictureShader._FRAGMENT_PIXELATE,
    'shake':     PictureShader._FRAGMENT_SHAKE,
    'blur':      PictureShader._FRAGMENT_BLUR,
    'rainbow':   PictureShader._FRAGMENT_RAINBOW,
    'hologram':  PictureShader._FRAGMENT_HOLOGRAM,
    'outline':   PictureShader._FRAGMENT_OUTLINE,
    'fireAura':  PictureShader._FRAGMENT_FIRE_AURA,
};

//=============================================================================
// 셰이더 타입별 기본 uniform 정의
//=============================================================================

PictureShader._DEFAULT_PARAMS = {
    'wave':      { amplitude: 10, frequency: 5, speed: 2, direction: 0 },
    'glitch':    { intensity: 0.3, rgbShift: 5, lineSpeed: 3, blockSize: 8 },
    'dissolve':  { threshold: 0.5, edgeWidth: 0.05, edgeColorR: 1, edgeColorG: 0.5, edgeColorB: 0, noiseScale: 10, animSpeed: 1, animMode: 0, thresholdMin: 0, thresholdMax: 1 },
    'glow':      { intensity: 1, radius: 4, colorR: 1, colorG: 1, colorB: 1, pulseSpeed: 2, animMode: 0 },
    'chromatic': { offset: 3, angle: 0, pulseSpeed: 2, animMode: 0 },
    'pixelate':  { size: 8, pulseSpeed: 2, animMode: 0, minSize: 2, maxSize: 16 },
    'shake':     { power: 5, speed: 10, direction: 2 },
    'blur':      { strength: 4, pulseSpeed: 2, animMode: 0, minStrength: 0, maxStrength: 8 },
    'rainbow':   { speed: 1, saturation: 0.5, brightness: 0.1 },
    'hologram':  { scanlineSpacing: 4, scanlineAlpha: 0.3, flickerSpeed: 5, flickerIntensity: 0.2, rgbShift: 2, tintR: 0.5, tintG: 0.8, tintB: 1 },
    'outline':   { thickness: 3, colorR: 1, colorG: 0.9, colorB: 0.2, intensity: 1.5, animMode: 0, animSpeed: 2, animMin: 0.8, animMax: 2.0 },
    'fireAura':  { radius: 12, intensity: 1.2, speed: 1.5, noiseScale: 8, innerColorR: 1, innerColorG: 0.9, innerColorB: 0.3, outerColorR: 1, outerColorG: 0.3, outerColorB: 0, turbulence: 1.5, flameHeight: 1.0, animMode: 0, animSpeed: 1 },
};

//=============================================================================
// ShaderMaterial 생성
//=============================================================================

PictureShader.createMaterial = function(type, params, texture) {
    var fragShader = this._FRAGMENT_SHADERS[type];
    if (!fragShader) return null;

    var defaults = this._DEFAULT_PARAMS[type] || {};
    var p = {};
    // defaults를 기반으로, params로 오버라이드
    var keys = Object.keys(defaults);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        p[k] = (params && params[k] !== undefined) ? params[k] : defaults[k];
    }

    var uniforms = {
        map:     { value: texture || null },
        opacity: { value: 1.0 },
        uTime:   { value: 0.0 },
    };

    // 타입별 uniform 추가
    switch (type) {
        case 'wave':
            uniforms.uAmplitude  = { value: p.amplitude };
            uniforms.uFrequency  = { value: p.frequency };
            uniforms.uSpeed      = { value: p.speed };
            uniforms.uDirection  = { value: p.direction };
            break;
        case 'glitch':
            uniforms.uIntensity  = { value: p.intensity };
            uniforms.uRgbShift   = { value: p.rgbShift };
            uniforms.uLineSpeed  = { value: p.lineSpeed };
            uniforms.uBlockSize  = { value: p.blockSize };
            break;
        case 'dissolve':
            uniforms.uThreshold     = { value: p.threshold };
            uniforms.uEdgeWidth     = { value: p.edgeWidth };
            uniforms.uEdgeColor     = { value: new THREE.Vector3(p.edgeColorR, p.edgeColorG, p.edgeColorB) };
            uniforms.uNoiseScale    = { value: p.noiseScale };
            uniforms.uAnimSpeed     = { value: p.animSpeed };
            uniforms.uAnimMode      = { value: p.animMode };
            uniforms.uThresholdMin  = { value: p.thresholdMin };
            uniforms.uThresholdMax  = { value: p.thresholdMax };
            break;
        case 'glow':
            uniforms.uIntensity  = { value: p.intensity };
            uniforms.uRadius     = { value: p.radius };
            uniforms.uColor      = { value: new THREE.Vector3(p.colorR, p.colorG, p.colorB) };
            uniforms.uPulseSpeed = { value: p.pulseSpeed };
            uniforms.uAnimMode   = { value: p.animMode };
            break;
        case 'chromatic':
            uniforms.uOffset     = { value: p.offset };
            uniforms.uAngle      = { value: p.angle };
            uniforms.uPulseSpeed = { value: p.pulseSpeed };
            uniforms.uAnimMode   = { value: p.animMode };
            break;
        case 'pixelate':
            uniforms.uSize       = { value: p.size };
            uniforms.uPulseSpeed = { value: p.pulseSpeed };
            uniforms.uAnimMode   = { value: p.animMode };
            uniforms.uMinSize    = { value: p.minSize };
            uniforms.uMaxSize    = { value: p.maxSize };
            break;
        case 'shake':
            // shake는 JS 레벨 처리, fragment는 패스스루
            break;
        case 'blur':
            uniforms.uStrength     = { value: p.strength };
            uniforms.uPulseSpeed   = { value: p.pulseSpeed };
            uniforms.uAnimMode     = { value: p.animMode };
            uniforms.uMinStrength  = { value: p.minStrength };
            uniforms.uMaxStrength  = { value: p.maxStrength };
            break;
        case 'rainbow':
            uniforms.uSpeed      = { value: p.speed };
            uniforms.uSaturation = { value: p.saturation };
            uniforms.uBrightness = { value: p.brightness };
            break;
        case 'hologram':
            uniforms.uScanlineSpacing  = { value: p.scanlineSpacing };
            uniforms.uScanlineAlpha    = { value: p.scanlineAlpha };
            uniforms.uFlickerSpeed     = { value: p.flickerSpeed };
            uniforms.uFlickerIntensity = { value: p.flickerIntensity };
            uniforms.uRgbShift         = { value: p.rgbShift };
            uniforms.uTint             = { value: new THREE.Vector3(p.tintR, p.tintG, p.tintB) };
            break;
        case 'outline':
            uniforms.uThickness  = { value: p.thickness };
            uniforms.uColor      = { value: new THREE.Vector3(p.colorR, p.colorG, p.colorB) };
            uniforms.uIntensity  = { value: p.intensity };
            uniforms.uAnimMode   = { value: p.animMode };
            uniforms.uAnimSpeed  = { value: p.animSpeed };
            uniforms.uAnimMin    = { value: p.animMin };
            uniforms.uAnimMax    = { value: p.animMax };
            break;
        case 'fireAura':
            uniforms.uRadius      = { value: p.radius };
            uniforms.uIntensity   = { value: p.intensity };
            uniforms.uSpeed       = { value: p.speed };
            uniforms.uNoiseScale  = { value: p.noiseScale };
            uniforms.uInnerColor  = { value: new THREE.Vector3(p.innerColorR, p.innerColorG, p.innerColorB) };
            uniforms.uOuterColor  = { value: new THREE.Vector3(p.outerColorR, p.outerColorG, p.outerColorB) };
            uniforms.uTurbulence  = { value: p.turbulence };
            uniforms.uFlameHeight = { value: p.flameHeight };
            uniforms.uAnimMode    = { value: p.animMode };
            uniforms.uAnimSpeed   = { value: p.animSpeed };
            break;
    }

    var material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: this._VERTEX_SHADER,
        fragmentShader: fragShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    material._shaderType = type;
    material._shaderParams = p;

    return material;
};

//=============================================================================
// Game_Picture 확장
//=============================================================================

(function() {
    var _Game_Picture_initialize = Game_Picture.prototype.initialize;
    Game_Picture.prototype.initialize = function() {
        _Game_Picture_initialize.call(this);
        this._shaderData = null;
    };

    var _Game_Picture_show = Game_Picture.prototype.show;
    Game_Picture.prototype.show = function(name, origin, x, y, scaleX, scaleY, opacity, blendMode) {
        _Game_Picture_show.call(this, name, origin, x, y, scaleX, scaleY, opacity, blendMode);
        // shaderData는 showPicture에서 별도 설정
    };

    Game_Picture.prototype.shaderData = function() {
        return this._shaderData;
    };

    Game_Picture.prototype.setShaderData = function(data) {
        this._shaderData = data;
    };

    var _Game_Picture_erase = Game_Picture.prototype.erase;
    Game_Picture.prototype.erase = function() {
        if (_Game_Picture_erase) {
            _Game_Picture_erase.call(this);
        }
        this._shaderData = null;
    };
})();

//=============================================================================
// Game_Screen 확장
//=============================================================================

(function() {
    var _Game_Screen_showPicture = Game_Screen.prototype.showPicture;
    Game_Screen.prototype.showPicture = function(pictureId, name, origin, x, y,
                                                 scaleX, scaleY, opacity, blendMode, shaderData) {
        _Game_Screen_showPicture.call(this, pictureId, name, origin, x, y,
                                       scaleX, scaleY, opacity, blendMode);
        // shaderData가 전달되면 해당 picture에 설정
        // 배열 또는 단일 객체 모두 지원
        if (shaderData) {
            var realPictureId = this.realPictureId(pictureId);
            var picture = this._pictures[realPictureId];
            if (picture) {
                picture.setShaderData(shaderData);
            }
        }
    };
})();

//=============================================================================
// Game_Interpreter 확장
//=============================================================================

(function() {
    var _Game_Interpreter_command231 = Game_Interpreter.prototype.command231;
    Game_Interpreter.prototype.command231 = function() {
        var x, y;
        if (this._params[3] === 0) {          // 직접 지정
            x = this._params[4];
            y = this._params[5];
        } else if (this._params[3] === 1) {   // 변수로 지정
            x = $gameVariables.value(this._params[4]);
            y = $gameVariables.value(this._params[5]);
        } else if (this._params[3] === 2) {   // 프리셋 지정
            var preset = this._params[11] || {};
            var sw = Graphics.boxWidth || 816;
            var sh = Graphics.boxHeight || 624;
            var px = (preset.presetX !== undefined) ? preset.presetX : 3;
            var py = (preset.presetY !== undefined) ? preset.presetY : 3;
            var ox = (preset.offsetX !== undefined) ? preset.offsetX : 0;
            var oy = (preset.offsetY !== undefined) ? preset.offsetY : 0;
            x = Math.round(sw * px / 5) + ox;
            y = Math.round(sh * py / 5) + oy;
        } else {
            x = this._params[4];
            y = this._params[5];
        }
        // parameters[10]에 셰이더 데이터가 있으면 전달
        var shaderData = this._params[10] || null;
        $gameScreen.showPicture(this._params[0], this._params[1], this._params[2],
            x, y, this._params[6], this._params[7], this._params[8], this._params[9],
            shaderData);
        return true;
    };
})();

//=============================================================================
// Sprite_Picture 확장 (멀티패스 셰이더 체이닝)
//=============================================================================

(function() {
    var _Sprite_Picture_initialize = Sprite_Picture.prototype.initialize;
    Sprite_Picture.prototype.initialize = function(pictureId) {
        // 멀티패스용 필드
        this._shaderPasses = [];       // [{material, type, params}]
        this._shaderRTs = [];          // [WebGLRenderTarget]
        this._shaderKey = '';          // 현재 셰이더 조합 키
        this._originalMaterial = null;
        this._shakeOffsetX = 0;
        this._shakeOffsetY = 0;
        this._rtScene = null;
        this._rtCamera = null;
        this._rtQuad = null;
        _Sprite_Picture_initialize.call(this, pictureId);
    };

    var _Sprite_Picture_update = Sprite_Picture.prototype.update;
    Sprite_Picture.prototype.update = function() {
        _Sprite_Picture_update.call(this);
        this.updateShader();
    };

    /**
     * shaderData를 배열로 정규화한다.
     * 단일 객체 {type,enabled,params}이면 배열로 감싸고,
     * 배열이면 enabled인 것만 필터링한다.
     */
    Sprite_Picture.prototype._normalizeShaderData = function(shaderData) {
        if (!shaderData) return [];
        // 배열 형태
        if (Array.isArray(shaderData)) {
            return shaderData.filter(function(s) { return s && s.enabled; });
        }
        // 단일 객체 (하위 호환)
        if (shaderData.enabled) {
            return [shaderData];
        }
        return [];
    };

    /**
     * 셰이더 조합의 고유 키를 생성한다. (변경 감지용)
     */
    Sprite_Picture.prototype._makeShaderKey = function(passes) {
        return passes.map(function(s) { return s.type; }).join('+');
    };

    /**
     * 셰이더 업데이트 (멀티패스)
     */
    Sprite_Picture.prototype.updateShader = function() {
        var picture = this.picture();
        if (!picture) {
            this._restoreOriginalMaterial();
            return;
        }

        var shaderData = picture.shaderData();
        var passes = this._normalizeShaderData(shaderData);

        // 셰이더가 없으면 복원
        if (passes.length === 0) {
            this._restoreOriginalMaterial();
            return;
        }

        // 셰이더 조합이 변경되었으면 재생성
        var key = this._makeShaderKey(passes);
        if (this._shaderKey !== key) {
            this._applyShaderPasses(passes);
            this._shaderKey = key;
        }

        // 매 프레임: 멀티패스 렌더링 실행
        this._executeMultipass(passes);

        // Shake offset 계산 (shake 셰이더가 포함되어 있으면)
        this._shakeOffsetX = 0;
        this._shakeOffsetY = 0;
        for (var i = 0; i < passes.length; i++) {
            if (passes[i].type === 'shake') {
                var p = passes[i].params || {};
                var power = (p.power !== undefined) ? p.power : 5;
                var speed = (p.speed !== undefined) ? p.speed : 10;
                var dir   = (p.direction !== undefined) ? p.direction : 2;
                var t = PictureShader._time * speed;
                if (dir === 0 || dir === 2) {
                    this._shakeOffsetX += (Math.sin(t * 7.13) + Math.sin(t * 5.71) * 0.5) * power;
                }
                if (dir === 1 || dir === 2) {
                    this._shakeOffsetY += (Math.sin(t * 6.47) + Math.sin(t * 4.93) * 0.5) * power;
                }
            }
        }
    };

    /**
     * 멀티패스 셰이더 Material과 RenderTarget을 생성한다.
     */
    Sprite_Picture.prototype._applyShaderPasses = function(passes) {
        // 원래 material 백업
        if (!this._originalMaterial && this._material) {
            this._originalMaterial = this._material;
        }

        // 기존 패스 정리
        this._disposeShaderPasses();

        // 공유 렌더 씬/카메라 (lazy init)
        if (!this._rtScene) {
            this._rtScene = new THREE.Scene();
            this._rtCamera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1, 1);
            var geo = new THREE.PlaneGeometry(1, 1);
            this._rtQuad = new THREE.Mesh(geo, null);
            this._rtQuad.frustumCulled = false;
            this._rtScene.add(this._rtQuad);
        }

        // RT 크기: 텍스처 크기 또는 기본값
        var tex = this._threeTexture || (this._material && this._material.map);
        var rtW = 256, rtH = 256;
        if (tex && tex.image) {
            rtW = tex.image.width || 256;
            rtH = tex.image.height || 256;
        }

        // 각 패스별 Material + RT 생성
        for (var i = 0; i < passes.length; i++) {
            var s = passes[i];
            // shake는 JS 레벨 처리이므로 Material 패스 불필요, 건너뜀
            if (s.type === 'shake') {
                this._shaderPasses.push({ material: null, type: s.type, params: s.params });
                this._shaderRTs.push(null);
                continue;
            }
            var mat = PictureShader.createMaterial(s.type, s.params || {}, null);
            this._shaderPasses.push({ material: mat, type: s.type, params: s.params });
            // 마지막 패스가 아니면 RT 필요 (중간 결과물 저장)
            // 마지막 패스도 RT에 렌더링 후 최종 material에 적용
            var rt = new THREE.WebGLRenderTarget(rtW, rtH, {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                format: THREE.RGBAFormat,
            });
            this._shaderRTs.push(rt);
        }

        // 최종 출력용 MeshBasicMaterial (마지막 RT의 결과를 mesh에 표시)
        var outputMat = new THREE.MeshBasicMaterial({
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        this._outputMaterial = outputMat;
        this._material = outputMat;
        if (this._threeObj) {
            this._threeObj.material = outputMat;
        }
        this._updateBlendMode();
    };

    /**
     * 매 프레임 멀티패스 렌더링을 실행한다.
     */
    Sprite_Picture.prototype._executeMultipass = function(passes) {
        if (this._shaderPasses.length === 0) return;

        // Three.js 렌더러 가져오기
        var renderer = PictureShader._renderer;
        if (!renderer) return;

        var sourceTexture = this._threeTexture || (this._originalMaterial && this._originalMaterial.map);
        if (!sourceTexture) return;

        var currentInput = sourceTexture;
        var lastRT = null;

        for (var i = 0; i < this._shaderPasses.length; i++) {
            var pass = this._shaderPasses[i];
            var rt = this._shaderRTs[i];

            // shake는 JS 레벨 처리, 패스 건너뜀
            if (pass.type === 'shake' || !pass.material) continue;

            var mat = pass.material;
            var u = mat.uniforms;

            // 시간 업데이트
            if (u.uTime) u.uTime.value = PictureShader._time;
            // 입력 텍스처 설정
            if (u.map) u.map.value = currentInput;
            // opacity는 마지막 패스에서만 적용
            if (u.opacity) u.opacity.value = 1.0;

            // RT에 렌더링
            this._rtQuad.material = mat;
            var prevRT = renderer.getRenderTarget();
            renderer.setRenderTarget(rt);
            renderer.render(this._rtScene, this._rtCamera);
            renderer.setRenderTarget(prevRT);

            // 다음 패스의 입력으로 사용
            currentInput = rt.texture;
            lastRT = rt;
        }

        // 최종 RT 결과를 출력 material에 적용
        if (lastRT && this._outputMaterial) {
            this._outputMaterial.map = lastRT.texture;
            this._outputMaterial.opacity = this.worldAlpha;
            this._outputMaterial.needsUpdate = true;
        }
    };

    /**
     * 셰이더 패스를 모두 정리한다.
     */
    Sprite_Picture.prototype._disposeShaderPasses = function() {
        for (var i = 0; i < this._shaderPasses.length; i++) {
            if (this._shaderPasses[i].material) {
                this._shaderPasses[i].material.dispose();
            }
        }
        for (var j = 0; j < this._shaderRTs.length; j++) {
            if (this._shaderRTs[j]) {
                this._shaderRTs[j].dispose();
            }
        }
        this._shaderPasses = [];
        this._shaderRTs = [];
        this._shaderKey = '';
        if (this._outputMaterial) {
            this._outputMaterial.dispose();
            this._outputMaterial = null;
        }
    };

    /**
     * 원래 MeshBasicMaterial로 복원한다.
     */
    Sprite_Picture.prototype._restoreOriginalMaterial = function() {
        if (this._shaderPasses.length > 0 || this._outputMaterial) {
            this._disposeShaderPasses();
            this._shakeOffsetX = 0;
            this._shakeOffsetY = 0;

            if (this._originalMaterial) {
                this._material = this._originalMaterial;
                if (this._threeObj) {
                    this._threeObj.material = this._originalMaterial;
                }
                this._originalMaterial = null;
                this._updateTexture();
                this._updateBlendMode();
            }
        }
    };

    // updatePosition 오버라이드: shake offset 적용
    var _Sprite_Picture_updatePosition = Sprite_Picture.prototype.updatePosition;
    Sprite_Picture.prototype.updatePosition = function() {
        _Sprite_Picture_updatePosition.call(this);
        if (this._shakeOffsetX || this._shakeOffsetY) {
            this.x += Math.round(this._shakeOffsetX);
            this.y += Math.round(this._shakeOffsetY);
        }
    };
})();

//=============================================================================
// 시간 업데이트 (Spriteset_Base에서 매 프레임 호출)
//=============================================================================

(function() {
    var _Spriteset_Base_update = Spriteset_Base.prototype.update;
    Spriteset_Base.prototype.update = function() {
        _Spriteset_Base_update.call(this);
        PictureShader._time += 1 / 60;
        // Three.js 렌더러 참조 캐싱
        if (!PictureShader._renderer && Graphics._renderer && Graphics._renderer.renderer) {
            PictureShader._renderer = Graphics._renderer.renderer;
        }
    };
})();
