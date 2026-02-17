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
    '    if (uAnimSpeed > 0.0 && uAnimMode < 1.5) {',
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
    '    if (uPulseSpeed > 0.0 && uAnimMode < 1.5) {',
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
    '    if (uPulseSpeed > 0.0 && uAnimMode < 1.5) {',
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
    '    if (uPulseSpeed > 0.0 && uAnimMode < 1.5) {',
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
    '    if (uPulseSpeed > 0.0 && uAnimMode < 1.5) {',
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
    '    if (uAnimSpeed > 0.0 && uAnimMode < 1.5) {',
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
    '    if (uAnimSpeed > 0.0 && uAnimMode < 1.5) {',
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

// 13. Greyscale (그레이스케일)
PictureShader._FRAGMENT_GREYSCALE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uLuminosity;',
    'uniform float uBlend;',
    'uniform vec3 uTintColor;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    float lum = 0.3 * col.r + 0.59 * col.g + 0.11 * col.b;',
    '    lum = clamp(lum + uLuminosity, 0.0, 1.0);',
    '    col.rgb = mix(col.rgb, vec3(lum) * uTintColor, uBlend);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 14. Negative (네거티브)
PictureShader._FRAGMENT_NEGATIVE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uAmount;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    col.rgb = mix(col.rgb, 1.0 - col.rgb, uAmount);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 15. HitEffect (피격 플래시)
PictureShader._FRAGMENT_HITEFFECT = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform vec3 uColor;',
    'uniform float uGlow;',
    'uniform float uBlend;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    col.rgb = mix(col.rgb, uColor * uGlow, uBlend);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 16. Shine (광택)
PictureShader._FRAGMENT_SHINE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform vec3 uColor;',
    'uniform float uLocation;',
    'uniform float uRotate;',
    'uniform float uWidth;',
    'uniform float uGlow;',
    'uniform float uSpeed;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    vec2 uv = vUv;',
    '    float cosA = cos(uRotate);',
    '    float sinA = sin(uRotate);',
    '    uv -= 0.5;',
    '    uv = vec2(uv.x * cosA - uv.y * sinA, uv.x * sinA + uv.y * cosA);',
    '    uv += 0.5;',
    '    float loc = uSpeed > 0.0 ? fract(uTime * uSpeed * 0.1) : uLocation;',
    '    float proj = (uv.x + uv.y) / 2.0;',
    '    float w = 1.0 - abs(proj - loc) / uWidth;',
    '    float mask = max(sign(proj - (loc - uWidth)), 0.0) * max(sign((loc + uWidth) - proj), 0.0);',
    '    col.rgb += col.a * w * uGlow * mask * uColor;',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 17. Flicker (깜빡임)
PictureShader._FRAGMENT_FLICKER = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uPercent;',
    'uniform float uFreq;',
    'uniform float uAlpha;',
    'varying vec2 vUv;',
    'float rand(vec2 s) { return fract(sin(dot(s, vec2(12.9898,78.233)))*43758.5453); }',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    float flick = step(fract(0.05 + uTime * uFreq), 1.0 - uPercent);',
    '    col.a *= clamp(col.a * flick + uAlpha, 0.0, 1.0);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 19. Gradient (그래디언트)
PictureShader._FRAGMENT_GRADIENT = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uBlend;',
    'uniform vec4 uTopLeft;',
    'uniform vec4 uTopRight;',
    'uniform vec4 uBotLeft;',
    'uniform vec4 uBotRight;',
    'uniform float uBoostX;',
    'uniform float uBoostY;',
    'uniform float uRadial;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    vec4 grad;',
    '    if (uRadial > 0.5) {',
    '        float d = 1.0 - length(vUv - 0.5) * 2.0;',
    '        d = clamp(d * uBoostX, 0.0, 1.0);',
    '        grad = mix(uTopLeft, uBotLeft, d);',
    '    } else {',
    '        float fx = clamp(pow(vUv.x, uBoostX), 0.0, 1.0);',
    '        grad = mix(mix(uBotLeft, uBotRight, fx), mix(uTopLeft, uTopRight, fx), clamp(pow(vUv.y, uBoostY), 0.0, 1.0));',
    '    }',
    '    grad = mix(col, grad, uBlend);',
    '    col.rgb = grad.rgb * col.a;',
    '    col.a *= grad.a * opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 20. ColorSwap (색상 스왑)
PictureShader._FRAGMENT_COLORSWAP = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform vec3 uRedNew;',
    'uniform vec3 uGreenNew;',
    'uniform vec3 uBlueNew;',
    'uniform float uRedLum;',
    'uniform float uGreenLum;',
    'uniform float uBlueLum;',
    'uniform float uBlend;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    float lum = 0.3 * col.r + 0.59 * col.g + 0.11 * col.b;',
    '    vec3 swapped = col.r * mix(uRedNew, vec3(lum), uRedLum)',
    '                 + col.g * mix(uGreenNew, vec3(lum), uGreenLum)',
    '                 + col.b * mix(uBlueNew, vec3(lum), uBlueLum);',
    '    col.rgb = mix(col.rgb, swapped, uBlend);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 21. HSV (HSV 색상 시프트)
PictureShader._FRAGMENT_HSV = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uHsvShift;',
    'uniform float uHsvSaturation;',
    'uniform float uHsvBright;',
    'varying vec2 vUv;',
    'vec3 rgb2hsv(vec3 c) {',
    '    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);',
    '    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));',
    '    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));',
    '    float d = q.x - min(q.w, q.y);',
    '    float e = 1.0e-10;',
    '    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);',
    '}',
    'vec3 hsv2rgb(vec3 c) {',
    '    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);',
    '    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);',
    '    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);',
    '}',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    vec3 hsv = rgb2hsv(col.rgb);',
    '    hsv.x = fract(hsv.x + uHsvShift);',
    '    hsv.y = clamp(hsv.y + uHsvSaturation, 0.0, 2.0);',
    '    hsv.z = clamp(hsv.z + uHsvBright, 0.0, 2.0);',
    '    col.rgb = hsv2rgb(hsv);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 23. Contrast (명도/대비)
PictureShader._FRAGMENT_CONTRAST = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uContrast;',
    'uniform float uBrightness;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    col.rgb = (col.rgb - 0.5) * uContrast + 0.5 + uBrightness;',
    '    col.rgb = clamp(col.rgb, 0.0, 1.0);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 24. MotionBlur (모션 블러)
PictureShader._FRAGMENT_MOTIONBLUR = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uAngle;',
    'uniform float uDist;',
    'varying vec2 vUv;',
    'void main() {',
    '    float a = uAngle * 3.14159265;',
    '    float d = uDist * 0.005;',
    '    vec2 dir = vec2(cos(a), sin(a)) * d;',
    '    vec4 col = texture2D(map, vUv);',
    '    col.rgb += texture2D(map, vUv + dir).rgb;',
    '    col.rgb += texture2D(map, vUv + dir * 2.0).rgb;',
    '    col.rgb += texture2D(map, vUv + dir * 3.0).rgb;',
    '    col.rgb += texture2D(map, vUv + dir * 4.0).rgb;',
    '    col.rgb += texture2D(map, vUv - dir).rgb;',
    '    col.rgb += texture2D(map, vUv - dir * 2.0).rgb;',
    '    col.rgb += texture2D(map, vUv - dir * 3.0).rgb;',
    '    col.rgb += texture2D(map, vUv - dir * 4.0).rgb;',
    '    col.rgb /= 9.0;',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 25. Ghost (고스트)
PictureShader._FRAGMENT_GHOST = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uColorBoost;',
    'uniform float uTransparency;',
    'uniform float uBlend;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    float lum = 0.3*col.r + 0.59*col.g + 0.11*col.b;',
    '    vec4 ghost;',
    '    ghost.a = clamp(lum - uTransparency, 0.0, 1.0) * col.a;',
    '    ghost.rgb = col.rgb * (lum + uColorBoost);',
    '    col = mix(col, ghost, uBlend);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 26. Shadow (드롭 섀도우)
PictureShader._FRAGMENT_SHADOW = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uShadowX;',
    'uniform float uShadowY;',
    'uniform float uShadowAlpha;',
    'uniform vec3 uShadowColor;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    float shadowA = texture2D(map, vUv + vec2(uShadowX, uShadowY)).a;',
    '    col.rgb *= 1.0 - ((shadowA - col.a) * (1.0 - col.a));',
    '    col.rgb += (uShadowColor * shadowA) * (1.0 - col.a);',
    '    col.a = max(shadowA * uShadowAlpha, col.a);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 27. Doodle (손그림)
PictureShader._FRAGMENT_DOODLE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uAmount;',
    'uniform float uSpeed;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec2 uv = vUv;',
    '    float t = floor(uTime * 20.0 * uSpeed / uSpeed) * uSpeed;',
    '    vec2 d;',
    '    d.x = sin((uv.x * uAmount + t) * 4.0);',
    '    d.y = cos((uv.y * uAmount + t) * 4.0);',
    '    uv = mix(uv, uv + d, 0.0005 * uAmount);',
    '    vec4 col = texture2D(map, uv);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 28. Warp (워프)
PictureShader._FRAGMENT_WARP = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uStrength;',
    'uniform float uSpeed;',
    'uniform float uScale;',
    'varying vec2 vUv;',
    'void main() {',
    '    float tau = 6.283185307;',
    '    float xW = uTime * uSpeed + vUv.x * tau / uScale;',
    '    float yW = uTime * uSpeed + vUv.y * tau / uScale;',
    '    vec2 warp = vec2(sin(xW), sin(yW)) * uStrength;',
    '    vec4 col = texture2D(map, vUv + warp);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 29. Twist (트위스트) - 시간 기반 애니메이션 지원
PictureShader._FRAGMENT_TWIST = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uAmount;',
    'uniform float uPosX;',
    'uniform float uPosY;',
    'uniform float uRadius;',
    'uniform float uSpeed;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec2 center = vec2(uPosX, uPosY);',
    '    vec2 d = vUv - center;',
    '    float dist = length(d);',
    '    float amt = uAmount + uTime * uSpeed;',
    '    float pct = (uRadius - dist) / uRadius;',
    '    float theta = pct * pct * 2.0 * sin(amt) * 8.0;',
    '    float beta = step(dist, uRadius);',
    '    float s = sin(theta); float c = cos(theta);',
    '    vec2 twisted = vec2(d.x*c - d.y*s, d.x*s + d.y*c) * beta + d * (1.0 - beta);',
    '    twisted += center;',
    '    vec4 col = texture2D(map, twisted);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 30. RoundWave (원형 파동) - 원본 AllIn1 참고, 방향성 오프셋 수정
PictureShader._FRAGMENT_ROUNDWAVE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uStrength;',
    'uniform float uSpeed;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec2 d = vUv - 0.5;',
    '    float ripple = length(d);',
    '    float wave = sin(ripple * 40.0 - uTime * uSpeed) * (uStrength * 0.01);',
    '    vec2 dir = normalize(d + 0.0001);',
    '    vec2 uv = vUv + dir * wave;',
    '    vec4 col = texture2D(map, uv);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 31. Fisheye (어안 렌즈) - 시간 기반 애니메이션 지원
PictureShader._FRAGMENT_FISHEYE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uAmount;',
    'uniform float uSpeed;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec2 center = vec2(0.5, 0.5);',
    '    float bind = length(center);',
    '    vec2 dF = vUv - center;',
    '    float dFlen = length(dF);',
    '    float amt = uAmount;',
    '    if (uSpeed > 0.0) amt *= 0.5 + 0.5 * sin(uTime * uSpeed);',
    '    float fishInt = (3.14159265 / bind) * (amt + 0.001);',
    '    vec2 uv = center + (dF / max(0.0001, dFlen)) * tan(dFlen * fishInt) * bind / tan(bind * fishInt);',
    '    vec4 col = texture2D(map, uv);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 32. Pinch (핀치) - 시간 기반 애니메이션 지원
PictureShader._FRAGMENT_PINCH = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uAmount;',
    'uniform float uSpeed;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec2 center = vec2(0.5, 0.5);',
    '    vec2 dP = vUv - center;',
    '    float amt = uAmount;',
    '    if (uSpeed > 0.0) amt *= 0.5 + 0.5 * sin(uTime * uSpeed);',
    '    float pinchInt = (3.14159265 / length(center)) * (-amt + 0.001);',
    '    vec2 uv = center + normalize(dP) * atan(length(dP) * -pinchInt * 10.0) * 0.5 / atan(-pinchInt * 5.0);',
    '    vec4 col = texture2D(map, uv);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 33. Overlay (오버레이 색상)
PictureShader._FRAGMENT_OVERLAY = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform vec3 uOverlayColor;',
    'uniform float uOverlayGlow;',
    'uniform float uBlend;',
    'uniform float uMultiply;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    vec3 overlayCol = uOverlayColor * uOverlayGlow;',
    '    if (uMultiply > 0.5) {',
    '        col.rgb = mix(col.rgb, col.rgb * overlayCol, uBlend);',
    '    } else {',
    '        col.rgb += overlayCol * uBlend * col.a;',
    '    }',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 36. Wind (바람 흔들림) - 버텍스 기반을 UV 왜곡으로 구현
PictureShader._FRAGMENT_WIND = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uSpeed;',
    'uniform float uWind;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec2 uv = vUv;',
    '    float sway = sin(uTime * uSpeed + vUv.y * 3.0) * uWind * 0.01;',
    '    uv.x += sway * vUv.y;',
    '    vec4 col = texture2D(map, uv);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 37. TextureScroll (텍스처 스크롤)
PictureShader._FRAGMENT_TEXTURESCROLL = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uSpeedX;',
    'uniform float uSpeedY;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec2 uv = vUv;',
    '    uv.x = fract(uv.x + uTime * uSpeedX);',
    '    uv.y = fract(uv.y + uTime * uSpeedY);',
    '    vec4 col = texture2D(map, uv);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 38. ZoomUV (UV 줌)
PictureShader._FRAGMENT_ZOOMUV = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uZoom;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec2 uv = (vUv - 0.5) * uZoom + 0.5;',
    '    vec4 col = texture2D(map, uv);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 39. RotateUV (UV 회전)
PictureShader._FRAGMENT_ROTATEUV = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uAngle;',
    'uniform float uSpeed;',
    'varying vec2 vUv;',
    'void main() {',
    '    float a = uAngle + uTime * uSpeed;',
    '    vec2 uv = vUv - 0.5;',
    '    float c = cos(a); float s = sin(a);',
    '    uv = vec2(uv.x*c - uv.y*s, uv.x*s + uv.y*c) + 0.5;',
    '    vec4 col = texture2D(map, uv);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 40. PolarUV (극좌표 변환) - 시간 기반 회전 애니메이션 지원
PictureShader._FRAGMENT_POLARUV = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uSpeed;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec2 d = vUv - 0.5;',
    '    float r = length(d) * 2.0;',
    '    float theta = atan(d.y, d.x) / 6.2831853 + 0.5;',
    '    theta = fract(theta + uTime * uSpeed);',
    '    vec4 col = texture2D(map, vec2(theta, r));',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 41. OffsetUV (UV 오프셋)
PictureShader._FRAGMENT_OFFSETUV = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uOffsetX;',
    'uniform float uOffsetY;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv + vec2(uOffsetX, uOffsetY));',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 42. Clipping (사각형 클리핑)
PictureShader._FRAGMENT_CLIPPING = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uLeft;',
    'uniform float uRight;',
    'uniform float uUp;',
    'uniform float uDown;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    float mask = step(uLeft, vUv.x) * step(vUv.x, 1.0 - uRight)',
    '              * step(uDown, vUv.y) * step(vUv.y, 1.0 - uUp);',
    '    col.a *= mask * opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 43. RadialClipping (방사형 클리핑)
PictureShader._FRAGMENT_RADIALCLIPPING = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uStartAngle;',
    'uniform float uClip;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    vec2 d = vUv - 0.5;',
    '    float angle = atan(d.y, d.x) / 6.2831853 + 0.5;',
    '    angle = fract(angle - uStartAngle / 360.0);',
    '    col.a *= step(angle, uClip) * opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 44. InnerOutline (내부 아웃라인)
PictureShader._FRAGMENT_INNEROUTLINE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform vec3 uColor;',
    'uniform float uWidth;',
    'uniform float uAlpha;',
    'uniform float uOnlyOutline;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    vec2 texSize = vec2(textureSize(map, 0));',
    '    vec2 pxSize = 1.0 / texSize;',
    '    float minA = 1.0;',
    '    for (float a = 0.0; a < 6.2832; a += 0.7854) {',
    '        vec2 off = vec2(cos(a), sin(a)) * pxSize * uWidth;',
    '        minA = min(minA, texture2D(map, vUv + off).a);',
    '    }',
    '    float inner = col.a * (1.0 - minA);',
    '    if (uOnlyOutline > 0.5) {',
    '        col.rgb = uColor * inner;',
    '        col.a = inner * uAlpha;',
    '    } else {',
    '        col.rgb = mix(col.rgb, uColor, inner * uAlpha);',
    '    }',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 45. AlphaOutline (알파 기반 아웃라인)
PictureShader._FRAGMENT_ALPHAOUTLINE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform vec3 uColor;',
    'uniform float uGlow;',
    'uniform float uPower;',
    'uniform float uMinAlpha;',
    'uniform float uBlend;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    float edge = smoothstep(uMinAlpha, uMinAlpha + uPower, col.a) * (1.0 - smoothstep(1.0 - uPower, 1.0, col.a));',
    '    vec3 outlineCol = uColor * uGlow;',
    '    col.rgb = mix(col.rgb, outlineCol, edge * uBlend);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 46. Distort (왜곡 - 노이즈 기반)
PictureShader._FRAGMENT_DISTORT = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uAmount;',
    'uniform float uSpeedX;',
    'uniform float uSpeedY;',
    'uniform float uScale;',
    'varying vec2 vUv;',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
    'float noise(vec2 p) {',
    '    vec2 i = floor(p); vec2 f = fract(p);',
    '    float a = hash(i); float b = hash(i+vec2(1,0));',
    '    float c = hash(i+vec2(0,1)); float d = hash(i+vec2(1,1));',
    '    vec2 u = f*f*(3.0-2.0*f);',
    '    return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;',
    '}',
    'void main() {',
    '    vec2 distUv = vUv * uScale;',
    '    distUv.x += uTime * uSpeedX;',
    '    distUv.y += uTime * uSpeedY;',
    '    float nx = noise(distUv);',
    '    float ny = noise(distUv + 100.0);',
    '    vec2 offset = (vec2(nx, ny) - 0.5) * uAmount * 0.1;',
    '    vec4 col = texture2D(map, vUv + offset);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 47. ColorRamp (컬러 램프 - 그래디언트 기반)
PictureShader._FRAGMENT_COLORRAMP = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uBlend;',
    'uniform float uLuminosity;',
    'uniform vec3 uColorDark;',
    'uniform vec3 uColorMid;',
    'uniform vec3 uColorLight;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    float lum = 0.3*col.r + 0.59*col.g + 0.11*col.b;',
    '    lum = clamp(lum + uLuminosity, 0.0, 1.0);',
    '    vec3 ramp = lum < 0.5 ? mix(uColorDark, uColorMid, lum*2.0) : mix(uColorMid, uColorLight, (lum-0.5)*2.0);',
    '    col.rgb = mix(col.rgb, ramp, uBlend);',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 48. OnlyOutline (외곽선만 표시)
PictureShader._FRAGMENT_ONLYOUTLINE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform vec3 uColor;',
    'uniform float uThickness;',
    'uniform float uGlow;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 col = texture2D(map, vUv);',
    '    vec2 texSize = vec2(textureSize(map, 0));',
    '    vec2 pxSize = 1.0 / texSize;',
    '    float maxA = 0.0;',
    '    for (float a = 0.0; a < 6.2832; a += 0.7854) {',
    '        vec2 off = vec2(cos(a), sin(a)) * pxSize * uThickness;',
    '        maxA = max(maxA, texture2D(map, vUv + off).a);',
    '    }',
    '    float outl = maxA * (1.0 - col.a);',
    '    gl_FragColor = vec4(uColor * uGlow, outl * opacity);',
    '}',
].join('\n');

// 49. Gradient2Col (2색 그래디언트)
// gradient와 동일한 셰이더 재사용 (topRight=topLeft, botRight=botLeft)
PictureShader._FRAGMENT_GRADIENT2COL = PictureShader._FRAGMENT_GRADIENT;

// 50. RadialGradient (방사형 그래디언트)
// gradient와 동일한 셰이더 재사용 (uRadial=1)
PictureShader._FRAGMENT_RADIALGRADIENT = PictureShader._FRAGMENT_GRADIENT;

// 51. Distort (왜곡 텍스처) - 위의 noise 기반 distort와 같은 셰이더 재사용

// 52. ShakeUV (UV 떨림) - shake와 유사하지만 UV 레벨
PictureShader._FRAGMENT_SHAKEUV = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uSpeed;',
    'uniform float uShakeX;',
    'uniform float uShakeY;',
    'varying vec2 vUv;',
    'float rand(vec2 s) { return fract(sin(dot(s, vec2(12.9898,78.233)))*43758.5453); }',
    'void main() {',
    '    float t = floor(uTime * uSpeed * 10.0);',
    '    float rx = (rand(vec2(t, 0.0)) - 0.5) * 2.0 * uShakeX * 0.01;',
    '    float ry = (rand(vec2(0.0, t)) - 0.5) * 2.0 * uShakeY * 0.01;',
    '    vec4 col = texture2D(map, vUv + vec2(rx, ry));',
    '    col.a *= opacity;',
    '    gl_FragColor = col;',
    '}',
].join('\n');

// 53. Fade (페이드 트랜지션) - threshold로 alpha 제어
PictureShader._FRAGMENT_FADE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uThreshold;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 color = texture2D(map, vUv);',
    '    color.a *= uThreshold * opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 54. Wipe (방향성 와이프 트랜지션)
// threshold 0=완전 표시, 1=완전 숨김, direction: 0=좌→우, 1=우→좌, 2=상→하, 3=하→상
PictureShader._FRAGMENT_WIPE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uThreshold;',
    'uniform float uDirection;',
    'uniform float uSoftness;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 color = texture2D(map, vUv);',
    '    float pos;',
    '    if (uDirection < 0.5) pos = vUv.x;',             // 좌→우
    '    else if (uDirection < 1.5) pos = 1.0 - vUv.x;',  // 우→좌
    '    else if (uDirection < 2.5) pos = 1.0 - vUv.y;',  // 상→하
    '    else pos = vUv.y;',                                // 하→상
    '    float edge = smoothstep(uThreshold - uSoftness, uThreshold, pos);',
    '    color.a *= edge * opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 54. CircleWipe (원형 와이프 트랜지션)
// threshold 0=완전 표시, 1=완전 숨김
PictureShader._FRAGMENT_CIRCLEWIPE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uThreshold;',
    'uniform float uSoftness;',
    'uniform float uCenterX;',
    'uniform float uCenterY;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 color = texture2D(map, vUv);',
    '    float dist = length(vUv - vec2(uCenterX, uCenterY)) / 0.707;',  // 0.707 = sqrt(0.5) 정규화
    '    float edge = smoothstep(uThreshold - uSoftness, uThreshold, 1.0 - dist);',
    '    color.a *= edge * opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 55. Blinds (블라인드 트랜지션)
// threshold 0=완전 표시, 1=완전 숨김, direction: 0=수평, 1=수직
PictureShader._FRAGMENT_BLINDS = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uThreshold;',
    'uniform float uCount;',
    'uniform float uDirection;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 color = texture2D(map, vUv);',
    '    float pos = uDirection < 0.5 ? vUv.y : vUv.x;',
    '    float stripe = fract(pos * uCount);',
    '    float reveal = 1.0 - uThreshold;',
    '    float edge = step(stripe, reveal);',
    '    color.a *= edge * opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 56. PixelDissolve (픽셀 디졸브 트랜지션)
// threshold 0=완전 표시, 1=완전 숨김
PictureShader._FRAGMENT_PIXELDISSOLVE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uThreshold;',
    'uniform float uPixelSize;',
    'varying vec2 vUv;',
    'float rand(vec2 s) { return fract(sin(dot(s, vec2(12.9898,78.233)))*43758.5453); }',
    'void main() {',
    '    float ps = mix(1.0, uPixelSize, uThreshold) / 256.0;',  // 픽셀 크기를 threshold에 비례
    '    vec2 pixUv = floor(vUv / ps) * ps + ps * 0.5;',
    '    vec4 color = texture2D(map, pixUv);',
    '    float cellRand = rand(floor(vUv / ps));',
    '    float reveal = 1.0 - uThreshold;',
    '    float edge = smoothstep(reveal - 0.1, reveal, cellRand);',
    '    color.a *= (1.0 - edge) * opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

//=============================================================================
// 셰이더 타입별 fragment shader 매핑
//=============================================================================

PictureShader._FRAGMENT_SHADERS = {
    'wave':           PictureShader._FRAGMENT_WAVE,
    'glitch':         PictureShader._FRAGMENT_GLITCH,
    'dissolve':       PictureShader._FRAGMENT_DISSOLVE,
    'glow':           PictureShader._FRAGMENT_GLOW,
    'chromatic':      PictureShader._FRAGMENT_CHROMATIC,
    'pixelate':       PictureShader._FRAGMENT_PIXELATE,
    'shake':          PictureShader._FRAGMENT_SHAKE,
    'blur':           PictureShader._FRAGMENT_BLUR,
    'rainbow':        PictureShader._FRAGMENT_RAINBOW,
    'hologram':       PictureShader._FRAGMENT_HOLOGRAM,
    'outline':        PictureShader._FRAGMENT_OUTLINE,
    'fireAura':       PictureShader._FRAGMENT_FIRE_AURA,
    'greyscale':      PictureShader._FRAGMENT_GREYSCALE,
    'negative':       PictureShader._FRAGMENT_NEGATIVE,
    'hitEffect':      PictureShader._FRAGMENT_HITEFFECT,
    'shine':          PictureShader._FRAGMENT_SHINE,
    'flicker':        PictureShader._FRAGMENT_FLICKER,
    'gradient':       PictureShader._FRAGMENT_GRADIENT,
    'colorSwap':      PictureShader._FRAGMENT_COLORSWAP,
    'hsv':            PictureShader._FRAGMENT_HSV,
    'contrast':       PictureShader._FRAGMENT_CONTRAST,
    'motionBlur':     PictureShader._FRAGMENT_MOTIONBLUR,
    'ghost':          PictureShader._FRAGMENT_GHOST,
    'shadow':         PictureShader._FRAGMENT_SHADOW,
    'doodle':         PictureShader._FRAGMENT_DOODLE,
    'warp':           PictureShader._FRAGMENT_WARP,
    'twist':          PictureShader._FRAGMENT_TWIST,
    'roundWave':      PictureShader._FRAGMENT_ROUNDWAVE,
    'fisheye':        PictureShader._FRAGMENT_FISHEYE,
    'pinch':          PictureShader._FRAGMENT_PINCH,
    'overlay':        PictureShader._FRAGMENT_OVERLAY,
    'wind':           PictureShader._FRAGMENT_WIND,
    'textureScroll':  PictureShader._FRAGMENT_TEXTURESCROLL,
    'zoomUV':         PictureShader._FRAGMENT_ZOOMUV,
    'rotateUV':       PictureShader._FRAGMENT_ROTATEUV,
    'polarUV':        PictureShader._FRAGMENT_POLARUV,
    'offsetUV':       PictureShader._FRAGMENT_OFFSETUV,
    'clipping':       PictureShader._FRAGMENT_CLIPPING,
    'radialClipping': PictureShader._FRAGMENT_RADIALCLIPPING,
    'innerOutline':   PictureShader._FRAGMENT_INNEROUTLINE,
    'alphaOutline':   PictureShader._FRAGMENT_ALPHAOUTLINE,
    'distort':        PictureShader._FRAGMENT_DISTORT,
    'colorRamp':      PictureShader._FRAGMENT_COLORRAMP,
    'onlyOutline':    PictureShader._FRAGMENT_ONLYOUTLINE,
    'gradient2col':   PictureShader._FRAGMENT_GRADIENT2COL,
    'radialGradient': PictureShader._FRAGMENT_RADIALGRADIENT,
    'shakeUV':        PictureShader._FRAGMENT_SHAKEUV,
    'fade':           PictureShader._FRAGMENT_FADE,
    'wipe':           PictureShader._FRAGMENT_WIPE,
    'circleWipe':     PictureShader._FRAGMENT_CIRCLEWIPE,
    'blinds':         PictureShader._FRAGMENT_BLINDS,
    'pixelDissolve':  PictureShader._FRAGMENT_PIXELDISSOLVE,
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
    'greyscale': { luminosity: 0, blend: 1, tintR: 1, tintG: 1, tintB: 1 },
    'negative':  { amount: 1 },
    'hitEffect': { colorR: 1, colorG: 1, colorB: 1, glow: 5, blend: 1 },
    'shine':     { colorR: 1, colorG: 1, colorB: 1, location: 0.5, rotate: 0, width: 0.1, glowAmount: 1, speed: 1 },
    'flicker':   { percent: 0.05, freq: 0.2, alpha: 0 },
    'gradient':  { blend: 1, topLeftR: 1, topLeftG: 0, topLeftB: 0, topLeftA: 1, topRightR: 1, topRightG: 1, topRightB: 0, topRightA: 1, botLeftR: 0, botLeftG: 0, botLeftB: 1, botLeftA: 1, botRightR: 0, botRightG: 1, botRightB: 0, botRightA: 1, boostX: 1.2, boostY: 1.2, radial: 0 },
    'colorSwap': { redNewR: 1, redNewG: 0, redNewB: 0, greenNewR: 0, greenNewG: 1, greenNewB: 0, blueNewR: 0, blueNewG: 0, blueNewB: 1, redLum: 0, greenLum: 0, blueLum: 0, blend: 1 },
    'hsv':       { hsvShift: 0, hsvSaturation: 0, hsvBright: 0 },
    'contrast':  { contrast: 1, brightness: 0 },
    'motionBlur': { angle: 0.1, dist: 1.25 },
    'ghost':     { colorBoost: 1, transparency: 0, blend: 1 },
    'shadow':    { shadowX: 0.1, shadowY: -0.05, shadowAlpha: 0.5, shadowColorR: 0, shadowColorG: 0, shadowColorB: 0 },
    'doodle':    { amount: 10, speed: 5 },
    'warp':      { strength: 0.025, speed: 8, scale: 0.5 },
    'twist':     { amount: 1, posX: 0.5, posY: 0.5, radius: 0.75, speed: 0 },
    'roundWave': { strength: 0.7, speed: 2 },
    'fisheye':   { amount: 0.35, speed: 0 },
    'pinch':     { amount: 0.35, speed: 0 },
    'overlay':   { overlayColorR: 1, overlayColorG: 1, overlayColorB: 1, overlayGlow: 1, blend: 0.5, multiply: 0 },
    'wind':      { speed: 2, wind: 5 },
    'textureScroll': { speedX: 0.25, speedY: 0 },
    'zoomUV':    { zoom: 1 },
    'rotateUV':  { angle: 0, speed: 0 },
    'polarUV':   { speed: 0 },
    'offsetUV':  { offsetX: 0, offsetY: 0 },
    'clipping':  { left: 0, right: 0, up: 0, down: 0 },
    'radialClipping': { startAngle: 0, clip: 1 },
    'innerOutline': { colorR: 1, colorG: 1, colorB: 1, width: 2, alpha: 1, onlyOutline: 0 },
    'alphaOutline': { colorR: 1, colorG: 0.5, colorB: 0, glow: 1, power: 0.3, minAlpha: 0.1, blend: 1 },
    'distort':   { amount: 0.5, speedX: 0.5, speedY: 0.3, scale: 5 },
    'colorRamp': { blend: 1, luminosity: 0, colorDarkR: 0, colorDarkG: 0, colorDarkB: 0.3, colorMidR: 0.5, colorMidG: 0.2, colorMidB: 0.5, colorLightR: 1, colorLightG: 0.9, colorLightB: 0.7 },
    'onlyOutline': { colorR: 1, colorG: 1, colorB: 1, thickness: 2, glow: 1 },
    'gradient2col': { blend: 1, topLeftR: 1, topLeftG: 0, topLeftB: 0, topLeftA: 1, topRightR: 1, topRightG: 0, topRightB: 0, topRightA: 1, botLeftR: 0, botLeftG: 0, botLeftB: 1, botLeftA: 1, botRightR: 0, botRightG: 0, botRightB: 1, botRightA: 1, boostX: 1.2, boostY: 1.2, radial: 0 },
    'radialGradient': { blend: 1, topLeftR: 1, topLeftG: 0, topLeftB: 0, topLeftA: 1, topRightR: 1, topRightG: 0, topRightB: 0, topRightA: 1, botLeftR: 0, botLeftG: 0, botLeftB: 1, botLeftA: 1, botRightR: 0, botRightG: 0, botRightB: 1, botRightA: 1, boostX: 1.2, boostY: 1.2, radial: 1 },
    'shakeUV':   { speed: 5, shakeX: 5, shakeY: 5 },
    'fade':      { threshold: 1 },
    'wipe':      { threshold: 0, direction: 0, softness: 0.05 },
    'circleWipe': { threshold: 0, softness: 0.05, centerX: 0.5, centerY: 0.5 },
    'blinds':    { threshold: 0, count: 8, direction: 0 },
    'pixelDissolve': { threshold: 0, pixelSize: 32 },
};

//=============================================================================
// 셰이더 타입별 uniform 매핑 정의 (데이터 기반)
// 'p' = 파라미터 이름, 'u' = uniform 이름, 'vec3' = [r,g,b] → THREE.Vector3, 'vec4' = [r,g,b,a] → THREE.Vector4
//=============================================================================

PictureShader._UNIFORM_MAP = {
    'wave':      [ ['amplitude','uAmplitude'], ['frequency','uFrequency'], ['speed','uSpeed'], ['direction','uDirection'] ],
    'glitch':    [ ['intensity','uIntensity'], ['rgbShift','uRgbShift'], ['lineSpeed','uLineSpeed'], ['blockSize','uBlockSize'] ],
    'dissolve':  [ ['threshold','uThreshold'], ['edgeWidth','uEdgeWidth'], {u:'uEdgeColor',vec3:['edgeColorR','edgeColorG','edgeColorB']}, ['noiseScale','uNoiseScale'], ['animSpeed','uAnimSpeed'], ['animMode','uAnimMode'], ['thresholdMin','uThresholdMin'], ['thresholdMax','uThresholdMax'] ],
    'glow':      [ ['intensity','uIntensity'], ['radius','uRadius'], {u:'uColor',vec3:['colorR','colorG','colorB']}, ['pulseSpeed','uPulseSpeed'], ['animMode','uAnimMode'] ],
    'chromatic': [ ['offset','uOffset'], ['angle','uAngle'], ['pulseSpeed','uPulseSpeed'], ['animMode','uAnimMode'] ],
    'pixelate':  [ ['size','uSize'], ['pulseSpeed','uPulseSpeed'], ['animMode','uAnimMode'], ['minSize','uMinSize'], ['maxSize','uMaxSize'] ],
    'shake':     [],
    'blur':      [ ['strength','uStrength'], ['pulseSpeed','uPulseSpeed'], ['animMode','uAnimMode'], ['minStrength','uMinStrength'], ['maxStrength','uMaxStrength'] ],
    'rainbow':   [ ['speed','uSpeed'], ['saturation','uSaturation'], ['brightness','uBrightness'] ],
    'hologram':  [ ['scanlineSpacing','uScanlineSpacing'], ['scanlineAlpha','uScanlineAlpha'], ['flickerSpeed','uFlickerSpeed'], ['flickerIntensity','uFlickerIntensity'], ['rgbShift','uRgbShift'], {u:'uTint',vec3:['tintR','tintG','tintB']} ],
    'outline':   [ ['thickness','uThickness'], {u:'uColor',vec3:['colorR','colorG','colorB']}, ['intensity','uIntensity'], ['animMode','uAnimMode'], ['animSpeed','uAnimSpeed'], ['animMin','uAnimMin'], ['animMax','uAnimMax'] ],
    'fireAura':  [ ['radius','uRadius'], ['intensity','uIntensity'], ['speed','uSpeed'], ['noiseScale','uNoiseScale'], {u:'uInnerColor',vec3:['innerColorR','innerColorG','innerColorB']}, {u:'uOuterColor',vec3:['outerColorR','outerColorG','outerColorB']}, ['turbulence','uTurbulence'], ['flameHeight','uFlameHeight'], ['animMode','uAnimMode'], ['animSpeed','uAnimSpeed'] ],
    'greyscale': [ ['luminosity','uLuminosity'], ['blend','uBlend'], {u:'uTintColor',vec3:['tintR','tintG','tintB']} ],
    'negative':  [ ['amount','uAmount'] ],
    'hitEffect': [ {u:'uColor',vec3:['colorR','colorG','colorB']}, ['glow','uGlow'], ['blend','uBlend'] ],
    'shine':     [ {u:'uColor',vec3:['colorR','colorG','colorB']}, ['location','uLocation'], ['rotate','uRotate'], ['width','uWidth'], ['glowAmount','uGlow'], ['speed','uSpeed'] ],
    'flicker':   [ ['percent','uPercent'], ['freq','uFreq'], ['alpha','uAlpha'] ],
    'gradient':  [ ['blend','uBlend'], {u:'uTopLeft',vec4:['topLeftR','topLeftG','topLeftB','topLeftA']}, {u:'uTopRight',vec4:['topRightR','topRightG','topRightB','topRightA']}, {u:'uBotLeft',vec4:['botLeftR','botLeftG','botLeftB','botLeftA']}, {u:'uBotRight',vec4:['botRightR','botRightG','botRightB','botRightA']}, ['boostX','uBoostX'], ['boostY','uBoostY'], ['radial','uRadial'] ],
    'colorSwap': [ {u:'uRedNew',vec3:['redNewR','redNewG','redNewB']}, {u:'uGreenNew',vec3:['greenNewR','greenNewG','greenNewB']}, {u:'uBlueNew',vec3:['blueNewR','blueNewG','blueNewB']}, ['redLum','uRedLum'], ['greenLum','uGreenLum'], ['blueLum','uBlueLum'], ['blend','uBlend'] ],
    'hsv':       [ ['hsvShift','uHsvShift'], ['hsvSaturation','uHsvSaturation'], ['hsvBright','uHsvBright'] ],
    'contrast':  [ ['contrast','uContrast'], ['brightness','uBrightness'] ],
    'motionBlur': [ ['angle','uAngle'], ['dist','uDist'] ],
    'ghost':     [ ['colorBoost','uColorBoost'], ['transparency','uTransparency'], ['blend','uBlend'] ],
    'shadow':    [ ['shadowX','uShadowX'], ['shadowY','uShadowY'], ['shadowAlpha','uShadowAlpha'], {u:'uShadowColor',vec3:['shadowColorR','shadowColorG','shadowColorB']} ],
    'doodle':    [ ['amount','uAmount'], ['speed','uSpeed'] ],
    'warp':      [ ['strength','uStrength'], ['speed','uSpeed'], ['scale','uScale'] ],
    'twist':     [ ['amount','uAmount'], ['posX','uPosX'], ['posY','uPosY'], ['radius','uRadius'], ['speed','uSpeed'] ],
    'roundWave': [ ['strength','uStrength'], ['speed','uSpeed'] ],
    'fisheye':   [ ['amount','uAmount'], ['speed','uSpeed'] ],
    'pinch':     [ ['amount','uAmount'], ['speed','uSpeed'] ],
    'overlay':   [ {u:'uOverlayColor',vec3:['overlayColorR','overlayColorG','overlayColorB']}, ['overlayGlow','uOverlayGlow'], ['blend','uBlend'], ['multiply','uMultiply'] ],
    'wind':      [ ['speed','uSpeed'], ['wind','uWind'] ],
    'textureScroll': [ ['speedX','uSpeedX'], ['speedY','uSpeedY'] ],
    'zoomUV':    [ ['zoom','uZoom'] ],
    'rotateUV':  [ ['angle','uAngle'], ['speed','uSpeed'] ],
    'polarUV':   [ ['speed','uSpeed'] ],
    'offsetUV':  [ ['offsetX','uOffsetX'], ['offsetY','uOffsetY'] ],
    'clipping':  [ ['left','uLeft'], ['right','uRight'], ['up','uUp'], ['down','uDown'] ],
    'radialClipping': [ ['startAngle','uStartAngle'], ['clip','uClip'] ],
    'innerOutline': [ {u:'uColor',vec3:['colorR','colorG','colorB']}, ['width','uWidth'], ['alpha','uAlpha'], ['onlyOutline','uOnlyOutline'] ],
    'alphaOutline': [ {u:'uColor',vec3:['colorR','colorG','colorB']}, ['glow','uGlow'], ['power','uPower'], ['minAlpha','uMinAlpha'], ['blend','uBlend'] ],
    'distort':   [ ['amount','uAmount'], ['speedX','uSpeedX'], ['speedY','uSpeedY'], ['scale','uScale'] ],
    'colorRamp': [ ['blend','uBlend'], ['luminosity','uLuminosity'], {u:'uColorDark',vec3:['colorDarkR','colorDarkG','colorDarkB']}, {u:'uColorMid',vec3:['colorMidR','colorMidG','colorMidB']}, {u:'uColorLight',vec3:['colorLightR','colorLightG','colorLightB']} ],
    'onlyOutline': [ {u:'uColor',vec3:['colorR','colorG','colorB']}, ['thickness','uThickness'], ['glow','uGlow'] ],
    'gradient2col': 'gradient',
    'radialGradient': 'gradient',
    'shakeUV':   [ ['speed','uSpeed'], ['shakeX','uShakeX'], ['shakeY','uShakeY'] ],
    'fade':      [ ['threshold','uThreshold'] ],
    'wipe':      [ ['threshold','uThreshold'], ['direction','uDirection'], ['softness','uSoftness'] ],
    'circleWipe': [ ['threshold','uThreshold'], ['softness','uSoftness'], ['centerX','uCenterX'], ['centerY','uCenterY'] ],
    'blinds':    [ ['threshold','uThreshold'], ['count','uCount'], ['direction','uDirection'] ],
    'pixelDissolve': [ ['threshold','uThreshold'], ['pixelSize','uPixelSize'] ],
};

//=============================================================================
// ShaderMaterial 생성 (데이터 기반)
//=============================================================================

PictureShader.createMaterial = function(type, params, texture) {
    var fragShader = this._FRAGMENT_SHADERS[type];
    if (!fragShader) return null;

    var defaults = this._DEFAULT_PARAMS[type] || {};
    var p = {};
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

    // 데이터 기반 uniform 매핑
    var mapping = this._UNIFORM_MAP[type];
    // 문자열이면 다른 타입의 매핑을 참조
    if (typeof mapping === 'string') mapping = this._UNIFORM_MAP[mapping];
    if (mapping) {
        for (var j = 0; j < mapping.length; j++) {
            var m = mapping[j];
            if (Array.isArray(m)) {
                // [paramKey, uniformName]
                uniforms[m[1]] = { value: p[m[0]] };
            } else if (m.vec3) {
                uniforms[m.u] = { value: new THREE.Vector3(p[m.vec3[0]], p[m.vec3[1]], p[m.vec3[2]]) };
            } else if (m.vec4) {
                uniforms[m.u] = { value: new THREE.Vector4(p[m.vec4[0]], p[m.vec4[1]], p[m.vec4[2]], p[m.vec4[3]]) };
            }
        }
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
        this._transition = null; // { shaderList, direction, applyMode, duration, elapsed, onComplete }
    };

    var _Game_Picture_show = Game_Picture.prototype.show;
    Game_Picture.prototype.show = function(name, origin, x, y, scaleX, scaleY, opacity, blendMode) {
        _Game_Picture_show.call(this, name, origin, x, y, scaleX, scaleY, opacity, blendMode);
        // shaderData는 showPicture에서 별도 설정
    };

    Game_Picture.prototype.shaderData = function() {
        // 트랜지션 중이면 트랜지션 셰이더를 반환
        if (this._transition && this._transition.shaderList) {
            // 기본 셰이더와 트랜지션 셰이더를 합침
            var base = this._shaderData ? this._normalizeArray(this._shaderData) : [];
            return base.concat(this._transition.shaderList);
        }
        return this._shaderData;
    };

    Game_Picture.prototype._normalizeArray = function(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        return [data];
    };

    Game_Picture.prototype.setShaderData = function(data) {
        this._shaderData = data;
    };

    // fade: threshold 높으면 보임 (0=투명, 1=불투명)
    // wipe, circleWipe, blinds, pixelDissolve: threshold 높으면 안 보임 (0=보임, 1=투명)
    var INVERTED_THRESHOLD_TYPES = { wipe: true, circleWipe: true, blinds: true, pixelDissolve: true };

    /**
     * 셰이더 트랜지션 시작
     * @param {Array} shaderList - 트랜지션 셰이더 목록 [{type, enabled, params}]
     * @param {string} direction - 'in' (나타나기) 또는 'out' (사라지기)
     * @param {string} applyMode - 'interpolate' 또는 'instant'
     * @param {number} duration - 소요 시간 (초), instant이면 0
     * @param {function} onComplete - 완료 콜백
     */
    Game_Picture.prototype.startTransition = function(shaderList, direction, applyMode, duration, onComplete) {
        if (!shaderList || shaderList.length === 0) {
            if (onComplete) onComplete();
            return;
        }
        // 셰이더 타입에 따라 threshold 방향 결정
        // 각 셰이더별로 시작/종료 threshold를 계산
        for (var i = 0; i < shaderList.length; i++) {
            var s = shaderList[i];
            var inverted = INVERTED_THRESHOLD_TYPES[s.type];
            if (direction === 'in') {
                // 나타나기: 안보임→보임
                s._startThreshold = inverted ? 1 : 0;  // 시작: 안 보이는 값
                s._endThreshold = inverted ? 0 : 1;    // 끝: 보이는 값
            } else {
                // 사라지기: 보임→안보임
                s._startThreshold = inverted ? 0 : 1;  // 시작: 보이는 값
                s._endThreshold = inverted ? 1 : 0;    // 끝: 안 보이는 값
            }
        }
        if (applyMode === 'instant' || duration <= 0) {
            for (var i = 0; i < shaderList.length; i++) {
                shaderList[i].params.threshold = shaderList[i]._endThreshold;
            }
            this._transition = {
                shaderList: shaderList,
                direction: direction,
                applyMode: 'instant',
                duration: 0,
                elapsed: 0,
                onComplete: onComplete
            };
            return;
        }
        // 보간 적용: 시작값으로 설정
        for (var i = 0; i < shaderList.length; i++) {
            shaderList[i].params.threshold = shaderList[i]._startThreshold;
        }
        this._transition = {
            shaderList: shaderList,
            direction: direction,
            applyMode: applyMode,
            duration: duration,
            elapsed: 0,
            onComplete: onComplete
        };
    };

    var _Game_Picture_update = Game_Picture.prototype.update;
    Game_Picture.prototype.update = function() {
        _Game_Picture_update.call(this);
        this.updateTransition();
    };

    Game_Picture.prototype.updateTransition = function() {
        if (!this._transition) return;
        var t = this._transition;
        if (t.applyMode === 'instant') {
            // 즉시 적용: 한 프레임 후 완료
            var cb = t.onComplete;
            this._transition = null;
            if (cb) cb();
            return;
        }
        // 보간 적용
        t.elapsed += 1 / 60;
        var progress = Math.min(t.elapsed / t.duration, 1);
        for (var i = 0; i < t.shaderList.length; i++) {
            var s = t.shaderList[i];
            s.params.threshold = s._startThreshold + (s._endThreshold - s._startThreshold) * progress;
        }
        if (progress >= 1) {
            var cb = t.onComplete;
            this._transition = null;
            if (cb) cb();
        }
    };

    var _Game_Picture_erase = Game_Picture.prototype.erase;
    Game_Picture.prototype.erase = function() {
        if (_Game_Picture_erase) {
            _Game_Picture_erase.call(this);
        }
        this._shaderData = null;
        this._transition = null;
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

// 프리셋 좌표를 픽셀 좌표로 변환하는 유틸리티
PictureShader._resolvePresetPosition = function(preset) {
    var sw = Graphics.boxWidth || 816;
    var sh = Graphics.boxHeight || 624;
    var px = (preset && preset.presetX !== undefined) ? preset.presetX : 3;
    var py = (preset && preset.presetY !== undefined) ? preset.presetY : 3;
    var ox = (preset && preset.offsetX !== undefined) ? preset.offsetX : 0;
    var oy = (preset && preset.offsetY !== undefined) ? preset.offsetY : 0;
    return {
        x: Math.round(sw * (px - 1) / 4) + ox,
        y: Math.round(sh * (py - 1) / 4) + oy
    };
};

// 트랜지션 셰이더 리스트를 복제 (params.threshold를 0으로 초기화)
PictureShader._cloneTransitionShaders = function(transitionData) {
    if (!transitionData || !transitionData.shaderList || transitionData.shaderList.length === 0) return null;
    var list = [];
    for (var i = 0; i < transitionData.shaderList.length; i++) {
        var s = transitionData.shaderList[i];
        var params = {};
        for (var k in s.params) {
            if (s.params.hasOwnProperty(k)) params[k] = s.params[k];
        }
        list.push({ type: s.type, enabled: true, params: params });
    }
    return {
        shaderList: list,
        applyMode: transitionData.applyMode || 'interpolate',
        duration: transitionData.duration || 1
    };
};

(function() {
    // ─── command231: 그림 표시 ───
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
            var pos = PictureShader._resolvePresetPosition(this._params[11]);
            x = pos.x;
            y = pos.y;
        } else {
            x = this._params[4];
            y = this._params[5];
        }
        // parameters[10]에 셰이더 데이터가 있으면 전달
        var shaderData = this._params[10] || null;
        $gameScreen.showPicture(this._params[0], this._params[1], this._params[2],
            x, y, this._params[6], this._params[7], this._params[8], this._params[9],
            shaderData);

        // parameters[12]에 트랜지션 데이터가 있으면 나타나기 트랜지션 시작
        var transitionData = PictureShader._cloneTransitionShaders(this._params[12]);
        if (transitionData) {
            var realPictureId = $gameScreen.realPictureId(this._params[0]);
            var picture = $gameScreen._pictures[realPictureId];
            if (picture) {
                picture.startTransition(
                    transitionData.shaderList, 'in',
                    transitionData.applyMode, transitionData.duration
                );
            }
        }
        return true;
    };

    // ─── command232: 그림 이동 ───
    var _Game_Interpreter_command232 = Game_Interpreter.prototype.command232;
    Game_Interpreter.prototype.command232 = function() {
        var x, y;
        if (this._params[3] === 0) {          // 직접 지정
            x = this._params[4];
            y = this._params[5];
        } else if (this._params[3] === 1) {   // 변수로 지정
            x = $gameVariables.value(this._params[4]);
            y = $gameVariables.value(this._params[5]);
        } else if (this._params[3] === 2) {   // 프리셋 지정
            var pos = PictureShader._resolvePresetPosition(this._params[12]);
            x = pos.x;
            y = pos.y;
        } else {
            x = this._params[4];
            y = this._params[5];
        }

        var moveMode = this._params[13] || 'interpolate';
        var duration = (moveMode === 'instant') ? 1 : (this._params[10] || 60);

        $gameScreen.movePicture(this._params[0], this._params[2], x, y,
            this._params[6], this._params[7], this._params[8], this._params[9], duration);

        // 보간 이동 시 트랜지션 셰이더
        if (moveMode === 'interpolate') {
            var transitionData = PictureShader._cloneTransitionShaders(this._params[14]);
            if (transitionData) {
                var realPictureId = $gameScreen.realPictureId(this._params[0]);
                var picture = $gameScreen._pictures[realPictureId];
                if (picture) {
                    // 이동 트랜지션: in 방향 (0→1, 새 위치로 나타남)
                    picture.startTransition(
                        transitionData.shaderList, 'in',
                        transitionData.applyMode, transitionData.duration
                    );
                }
            }
            if (this._params[11]) {
                this.wait(duration);
            }
        }
        return true;
    };

    // ─── command235: 그림 제거 ───
    var _Game_Interpreter_command235 = Game_Interpreter.prototype.command235;
    Game_Interpreter.prototype.command235 = function() {
        var eraseMode = this._params[1] || 'instant';
        var transitionData = PictureShader._cloneTransitionShaders(this._params[2]);

        if (eraseMode === 'interpolate' && transitionData) {
            // 보간 제거: 트랜지션 후 erase
            var pictureId = this._params[0];
            var realPictureId = $gameScreen.realPictureId(pictureId);
            var picture = $gameScreen._pictures[realPictureId];
            if (picture) {
                picture.startTransition(
                    transitionData.shaderList, 'out',
                    transitionData.applyMode, transitionData.duration,
                    function() {
                        $gameScreen.erasePicture(pictureId);
                    }
                );
            } else {
                $gameScreen.erasePicture(pictureId);
            }
        } else {
            // 즉시 제거
            $gameScreen.erasePicture(this._params[0]);
        }
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
            // params → uniform 동기화 (트랜지션 threshold 등 런타임 변경 반영)
            var mapping = PictureShader._UNIFORM_MAP[pass.type];
            if (typeof mapping === 'string') mapping = PictureShader._UNIFORM_MAP[mapping];
            if (mapping && pass.params) {
                for (var mi = 0; mi < mapping.length; mi++) {
                    var m = mapping[mi];
                    if (Array.isArray(m) && u[m[1]] !== undefined && pass.params[m[0]] !== undefined) {
                        u[m[1]].value = pass.params[m[0]];
                    }
                }
            }

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
        if (this._outputMaterial) {
            if (lastRT) {
                this._outputMaterial.map = lastRT.texture;
            } else {
                // shake만 있는 경우 등 모든 패스가 skip되면 원본 텍스처 사용
                this._outputMaterial.map = sourceTexture;
            }
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
