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
PictureShader._FRAGMENT_DISSOLVE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uThreshold;',
    'uniform float uEdgeWidth;',
    'uniform vec3 uEdgeColor;',
    'uniform float uNoiseScale;',
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
    '    float edge = smoothstep(uThreshold - uEdgeWidth, uThreshold, n);',
    '    float edgeGlow = smoothstep(uThreshold, uThreshold + uEdgeWidth, n);',
    '    color.rgb = mix(uEdgeColor, color.rgb, edgeGlow);',
    '    color.a *= edge * opacity;',
    '    gl_FragColor = color;',
    '}',
].join('\n');

// 4. Glow (발광)
PictureShader._FRAGMENT_GLOW = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uIntensity;',
    'uniform float uRadius;',
    'uniform vec3 uColor;',
    'uniform float uPulseSpeed;',
    'varying vec2 vUv;',
    'void main() {',
    '    vec4 color = texture2D(map, vUv);',
    '    float pulse = 1.0;',
    '    if (uPulseSpeed > 0.0) {',
    '        pulse = 0.5 + 0.5 * sin(uTime * uPulseSpeed);',
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
PictureShader._FRAGMENT_CHROMATIC = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uOffset;',
    'uniform float uAngle;',
    'uniform float uPulseSpeed;',
    'varying vec2 vUv;',
    'void main() {',
    '    float pulse = 1.0;',
    '    if (uPulseSpeed > 0.0) {',
    '        pulse = 0.5 + 0.5 * sin(uTime * uPulseSpeed);',
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
PictureShader._FRAGMENT_PIXELATE = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uSize;',
    'uniform float uPulseSpeed;',
    'uniform float uMinSize;',
    'uniform float uMaxSize;',
    'varying vec2 vUv;',
    'void main() {',
    '    float size = uSize;',
    '    if (uPulseSpeed > 0.0) {',
    '        float t = 0.5 + 0.5 * sin(uTime * uPulseSpeed);',
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
PictureShader._FRAGMENT_BLUR = [
    'uniform sampler2D map;',
    'uniform float opacity;',
    'uniform float uTime;',
    'uniform float uStrength;',
    'uniform float uPulseSpeed;',
    'uniform float uMinStrength;',
    'uniform float uMaxStrength;',
    'varying vec2 vUv;',
    'void main() {',
    '    float strength = uStrength;',
    '    if (uPulseSpeed > 0.0) {',
    '        float t = 0.5 + 0.5 * sin(uTime * uPulseSpeed);',
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

// 10. Hologram (홀로그램)
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
};

//=============================================================================
// 셰이더 타입별 기본 uniform 정의
//=============================================================================

PictureShader._DEFAULT_PARAMS = {
    'wave':      { amplitude: 10, frequency: 5, speed: 2, direction: 0 },
    'glitch':    { intensity: 0.3, rgbShift: 5, lineSpeed: 3, blockSize: 8 },
    'dissolve':  { threshold: 0.5, edgeWidth: 0.05, edgeColorR: 1, edgeColorG: 0.5, edgeColorB: 0, noiseScale: 10 },
    'glow':      { intensity: 1, radius: 4, colorR: 1, colorG: 1, colorB: 1, pulseSpeed: 2 },
    'chromatic': { offset: 3, angle: 0, pulseSpeed: 0 },
    'pixelate':  { size: 8, pulseSpeed: 0, minSize: 2, maxSize: 16 },
    'shake':     { power: 5, speed: 10, direction: 2 },
    'blur':      { strength: 4, pulseSpeed: 0, minStrength: 0, maxStrength: 8 },
    'rainbow':   { speed: 1, saturation: 0.5, brightness: 0.1 },
    'hologram':  { scanlineSpacing: 4, scanlineAlpha: 0.3, flickerSpeed: 5, flickerIntensity: 0.2, rgbShift: 2, tintR: 0.5, tintG: 0.8, tintB: 1 },
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
            uniforms.uThreshold  = { value: p.threshold };
            uniforms.uEdgeWidth  = { value: p.edgeWidth };
            uniforms.uEdgeColor  = { value: new THREE.Vector3(p.edgeColorR, p.edgeColorG, p.edgeColorB) };
            uniforms.uNoiseScale = { value: p.noiseScale };
            break;
        case 'glow':
            uniforms.uIntensity  = { value: p.intensity };
            uniforms.uRadius     = { value: p.radius };
            uniforms.uColor      = { value: new THREE.Vector3(p.colorR, p.colorG, p.colorB) };
            uniforms.uPulseSpeed = { value: p.pulseSpeed };
            break;
        case 'chromatic':
            uniforms.uOffset     = { value: p.offset };
            uniforms.uAngle      = { value: p.angle };
            uniforms.uPulseSpeed = { value: p.pulseSpeed };
            break;
        case 'pixelate':
            uniforms.uSize       = { value: p.size };
            uniforms.uPulseSpeed = { value: p.pulseSpeed };
            uniforms.uMinSize    = { value: p.minSize };
            uniforms.uMaxSize    = { value: p.maxSize };
            break;
        case 'shake':
            // shake는 JS 레벨 처리, fragment는 패스스루
            break;
        case 'blur':
            uniforms.uStrength     = { value: p.strength };
            uniforms.uPulseSpeed   = { value: p.pulseSpeed };
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
        if (shaderData && shaderData.enabled) {
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
        if (this._params[3] === 0) {
            x = this._params[4];
            y = this._params[5];
        } else {
            x = $gameVariables.value(this._params[4]);
            y = $gameVariables.value(this._params[5]);
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
// Sprite_Picture 확장
//=============================================================================

(function() {
    var _Sprite_Picture_initialize = Sprite_Picture.prototype.initialize;
    Sprite_Picture.prototype.initialize = function(pictureId) {
        this._shaderMaterial = null;
        this._shaderType = null;
        this._originalMaterial = null;
        this._shakeOffsetX = 0;
        this._shakeOffsetY = 0;
        _Sprite_Picture_initialize.call(this, pictureId);
    };

    var _Sprite_Picture_update = Sprite_Picture.prototype.update;
    Sprite_Picture.prototype.update = function() {
        _Sprite_Picture_update.call(this);
        this.updateShader();
    };

    /**
     * 셰이더 업데이트:
     * - Game_Picture의 shaderData를 확인
     * - 변경되면 ShaderMaterial 생성/교체 또는 복원
     * - 매 프레임 uTime 업데이트, 텍스처·opacity 동기화
     */
    Sprite_Picture.prototype.updateShader = function() {
        var picture = this.picture();
        if (!picture) {
            this._restoreOriginalMaterial();
            return;
        }

        var shaderData = picture.shaderData();

        // 셰이더가 없거나 비활성이면 원래 material로 복원
        if (!shaderData || !shaderData.enabled) {
            this._restoreOriginalMaterial();
            return;
        }

        var type = shaderData.type;
        var params = shaderData.params || {};

        // 셰이더 타입이 변경되었으면 새로 생성
        if (this._shaderType !== type) {
            this._applyShaderMaterial(type, params);
        }

        // ShaderMaterial이 있으면 매 프레임 업데이트
        if (this._shaderMaterial) {
            var u = this._shaderMaterial.uniforms;

            // 시간 업데이트
            if (u.uTime) {
                u.uTime.value = PictureShader._time;
            }

            // 텍스처 동기화: ThreeSprite의 _threeTexture를 사용
            if (u.map && this._threeTexture) {
                u.map.value = this._threeTexture;
            }

            // opacity 동기화
            if (u.opacity) {
                u.opacity.value = this.worldAlpha;
            }

            // Shake: JS 레벨 position offset
            if (type === 'shake') {
                var p = shaderData.params || {};
                var power = (p.power !== undefined) ? p.power : 5;
                var speed = (p.speed !== undefined) ? p.speed : 10;
                var dir   = (p.direction !== undefined) ? p.direction : 2;
                var t = PictureShader._time * speed;
                var dx = 0, dy = 0;
                if (dir === 0 || dir === 2) { // horizontal
                    dx = (Math.sin(t * 7.13) + Math.sin(t * 5.71) * 0.5) * power;
                }
                if (dir === 1 || dir === 2) { // vertical
                    dy = (Math.sin(t * 6.47) + Math.sin(t * 4.93) * 0.5) * power;
                }
                this._shakeOffsetX = dx;
                this._shakeOffsetY = dy;
            } else {
                this._shakeOffsetX = 0;
                this._shakeOffsetY = 0;
            }
        }
    };

    /**
     * ShaderMaterial을 적용한다.
     */
    Sprite_Picture.prototype._applyShaderMaterial = function(type, params) {
        // 원래 material 백업
        if (!this._originalMaterial && this._material) {
            this._originalMaterial = this._material;
        }

        // 기존 셰이더 material 정리
        if (this._shaderMaterial) {
            this._shaderMaterial.dispose();
            this._shaderMaterial = null;
        }

        var texture = this._threeTexture || (this._material && this._material.map) || null;
        var material = PictureShader.createMaterial(type, params, texture);

        if (material) {
            this._shaderMaterial = material;
            this._shaderType = type;
            this._material = material;
            if (this._threeObj) {
                this._threeObj.material = material;
            }
            // blendMode 동기화
            this._updateBlendMode();
        }
    };

    /**
     * 원래 MeshBasicMaterial로 복원한다.
     */
    Sprite_Picture.prototype._restoreOriginalMaterial = function() {
        if (this._shaderMaterial) {
            this._shaderMaterial.dispose();
            this._shaderMaterial = null;
            this._shaderType = null;
            this._shakeOffsetX = 0;
            this._shakeOffsetY = 0;

            if (this._originalMaterial) {
                this._material = this._originalMaterial;
                if (this._threeObj) {
                    this._threeObj.material = this._originalMaterial;
                }
                this._originalMaterial = null;
                // 텍스처 재동기화
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
    };
})();
