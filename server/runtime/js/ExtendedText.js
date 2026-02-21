//=============================================================================
// ExtendedText.js - 확장 텍스트 이펙트 플러그인 (Three.js ShaderMaterial 기반)
//=============================================================================

var ExtendedText = {};
ExtendedText._time = 0;

// ─── 씬 참조 헬퍼 ───
// 에디터 프리뷰: MessagePreview가 renderer._etScene = previewScene으로 설정
// 게임 런타임: _etScene 미설정 → 씬=null → 오버레이 미생성 → bitmap 텍스트 유지
// 주의: Graphics._renderer.scene은 3D 맵 씬(PerspectiveCamera)이므로 절대 사용 금지
//   → 화면좌표 기반 오버레이가 월드좌표로 해석되어 맵에 투영되는 버그 발생
ExtendedText._overlayScene = null;

//─── 파라미터 파싱 ───
ExtendedText._parseParams = function(paramsStr) {
    var params = {};
    if (!paramsStr) return params;
    var re = /(\w+)=(?:"([^"]*)"|([^\s>]+))/g;
    var m;
    while ((m = re.exec(paramsStr)) !== null) {
        params[m[1]] = m[2] !== undefined ? m[2] : m[3];
    }
    return params;
};

ExtendedText._parseHex = function(color) {
    if (!color) return null;
    var m = /^#([0-9a-f]{3,8})$/i.exec(color.trim());
    if (!m) return null;
    var hex = m[1];
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    if (hex.length < 6) return null;
    return [
        parseInt(hex.substr(0, 2), 16) / 255,
        parseInt(hex.substr(2, 2), 16) / 255,
        parseInt(hex.substr(4, 2), 16) / 255,
    ];
};

ExtendedText._toCSS = function(rgb) {
    return 'rgb(' + Math.round(rgb[0]*255) + ',' + Math.round(rgb[1]*255) + ',' + Math.round(rgb[2]*255) + ')';
};

ExtendedText._lerpColor = function(c1, c2, t) {
    var rgb1 = this._parseHex(c1) || [1,1,1];
    var rgb2 = this._parseHex(c2) || [0,0,0];
    return this._toCSS([
        rgb1[0] + (rgb2[0]-rgb1[0])*t,
        rgb1[1] + (rgb2[1]-rgb1[1])*t,
        rgb1[2] + (rgb2[2]-rgb1[2])*t,
    ]);
};

ExtendedText._hsv2css = function(h, s, v) {
    var c = v * s;
    var x = c * (1 - Math.abs((h * 6) % 2 - 1));
    var m = v - c;
    var r, g, b;
    if      (h < 1/6) { r=c; g=x; b=0; }
    else if (h < 2/6) { r=x; g=c; b=0; }
    else if (h < 3/6) { r=0; g=c; b=x; }
    else if (h < 4/6) { r=0; g=x; b=c; }
    else if (h < 5/6) { r=x; g=0; b=c; }
    else               { r=c; g=0; b=x; }
    return 'rgb(' + Math.round((r+m)*255) + ',' + Math.round((g+m)*255) + ',' + Math.round((b+m)*255) + ')';
};

//─── GLSL 공통 Vertex ───
ExtendedText._vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

//─── ShaderMaterial 팩토리 ───
ExtendedText._createShaderMaterial = function(effectType, params) {
    var THREE = window.THREE;
    if (!THREE) return null;

    var fragShader;
    var uniforms;

    if (effectType === 'shake') {
        uniforms = {
            tTex:       { value: null },
            uTime:      { value: 0.0 },
            uAmp:       { value: parseFloat(params.amplitude || 3) },
            uSpeed:     { value: parseFloat(params.speed || 1) },
            uCharCount: { value: 1.0 },
            uTexH:      { value: 36.0 },
        };
        fragShader = `
uniform sampler2D tTex;
uniform float uTime;
uniform float uAmp;
uniform float uSpeed;
uniform float uCharCount;
uniform float uTexH;
varying vec2 vUv;
void main() {
  float charIdx = floor(vUv.x * uCharCount);
  float offsetY = sin(uTime * uSpeed * 5.0 + charIdx * 0.8) * uAmp / uTexH;
  vec2 sUv = vec2(vUv.x, vUv.y + offsetY);
  if (sUv.y < 0.0 || sUv.y > 1.0) { gl_FragColor = vec4(0.0); return; }
  gl_FragColor = texture2D(tTex, sUv);
}
`;
    } else if (effectType === 'hologram') {
        uniforms = {
            tTex:    { value: null },
            uTime:   { value: 0.0 },
            uScanH:  { value: parseFloat(params.scanline || 5) },
            uFlicker:{ value: 1.0 },
            uTexH:   { value: 36.0 },
        };
        fragShader = `
uniform sampler2D tTex;
uniform float uTime;
uniform float uScanH;
uniform float uFlicker;
uniform float uTexH;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tTex, vUv);
  if (c.a < 0.01) { gl_FragColor = vec4(0.0); return; }
  c.rgb = vec3(0.0, 1.0, 1.0) * c.a;
  float lineY = mod(vUv.y * uTexH + uTime * 25.0, uScanH);
  if (lineY < uScanH * 0.45) c.a *= 0.3;
  c.a *= (0.8 + 0.2 * sin(uTime * uFlicker * 10.0));
  c.rgb *= c.a;
  gl_FragColor = c;
}
`;
    } else if (effectType === 'dissolve') {
        uniforms = {
            tTex:       { value: null },
            uTime:      { value: 0.0 },
            uSpeed:     { value: parseFloat(params.speed || 1) },
            uStartTime: { value: ExtendedText._time },
        };
        fragShader = `
uniform sampler2D tTex;
uniform float uTime;
uniform float uSpeed;
uniform float uStartTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec4 c = texture2D(tTex, vUv);
  if (c.a < 0.01) { gl_FragColor = vec4(0.0); return; }
  float progress = clamp((uTime - uStartTime) * uSpeed * 0.5, 0.0, 1.0);
  float noise = hash(vUv + fract(uTime * 0.1));
  if (noise > progress) discard;
  gl_FragColor = c;
}
`;
    } else if (effectType === 'fade') {
        uniforms = {
            tTex:       { value: null },
            uTime:      { value: 0.0 },
            uStartTime: { value: ExtendedText._time },
            uDuration:  { value: parseFloat(params.duration || 60) },
        };
        fragShader = `
uniform sampler2D tTex;
uniform float uTime;
uniform float uStartTime;
uniform float uDuration;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tTex, vUv);
  // uTime += 1/60 per frame, uDuration in frames → 60.0/dur = frames to seconds conversion
  float progress = clamp((uTime - uStartTime) * 60.0 / uDuration, 0.0, 1.0);
  c.a *= progress;
  c.rgb *= progress;
  gl_FragColor = c;
}
`;
    } else if (effectType === 'gradient-wave') {
        uniforms = {
            tTex:  { value: null },
            uTime: { value: 0.0 },
            uSpeed:{ value: parseFloat(params.speed || 1) },
        };
        fragShader = `
uniform sampler2D tTex;
uniform float uTime;
uniform float uSpeed;
varying vec2 vUv;
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
void main() {
  vec4 c = texture2D(tTex, vUv);
  if (c.a < 0.01) { gl_FragColor = vec4(0.0); return; }
  float hue = mod(vUv.x + uTime * uSpeed * 0.075, 1.0);
  vec3 waveColor = hsv2rgb(vec3(hue, 1.0, 0.62));
  gl_FragColor = vec4(waveColor * c.a, c.a);
}
`;
    } else if (effectType === 'blur-fade') {
        uniforms = {
            tTex:       { value: null },
            uTime:      { value: 0.0 },
            uStartTime: { value: ExtendedText._time },
            uDuration:  { value: parseFloat(params.duration || 60) },
            uTexelSize: { value: new THREE.Vector2(1/100, 1/36) },
        };
        fragShader = `
uniform sampler2D tTex;
uniform float uTime;
uniform float uStartTime;
uniform float uDuration;
uniform vec2 uTexelSize;
varying vec2 vUv;
void main() {
  // 초점 맞추기 효과: 블러 → 선명, 투명 → 불투명
  // uTime += 1/60 per frame, uDuration in frames
  float progress = clamp((uTime - uStartTime) * 60.0 / uDuration, 0.0, 1.0);
  float blurR = (1.0 - progress) * 10.0;  // 10픽셀 블러로 시작, progress 1.0에서 0
  // 3x3 box blur: 더 자연스러운 카메라 초점 효과
  vec4 c = vec4(0.0);
  c += texture2D(tTex, vUv + vec2(-blurR, -blurR) * uTexelSize);
  c += texture2D(tTex, vUv + vec2(  0.0, -blurR) * uTexelSize);
  c += texture2D(tTex, vUv + vec2( blurR, -blurR) * uTexelSize);
  c += texture2D(tTex, vUv + vec2(-blurR,   0.0) * uTexelSize);
  c += texture2D(tTex, vUv);
  c += texture2D(tTex, vUv + vec2( blurR,   0.0) * uTexelSize);
  c += texture2D(tTex, vUv + vec2(-blurR,  blurR) * uTexelSize);
  c += texture2D(tTex, vUv + vec2(  0.0,  blurR) * uTexelSize);
  c += texture2D(tTex, vUv + vec2( blurR,  blurR) * uTexelSize);
  c /= 9.0;
  // sqrt(progress): 초반에 빠르게 나타나서 블러 상태로 잠시 보임 → 서서히 초점
  c.a *= sqrt(progress);
  gl_FragColor = c;
}
`;
    } else {
        return null;
    }

    return new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: ExtendedText._vertexShader,
        fragmentShader: fragShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
};

//=============================================================================
// Window_Base 오버라이드
//=============================================================================

var _Window_Base_convertEscapeCharacters = Window_Base.prototype.convertEscapeCharacters;
Window_Base.prototype.convertEscapeCharacters = function(text) {
    text = _Window_Base_convertEscapeCharacters.call(this, text);
    this._etTags = [];
    var self = this;
    var result = '';
    var i = 0;
    var tagStack = [];

    while (i < text.length) {
        if (text[i] === '<') {
            var openMatch = text.slice(i).match(/^<([a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?\s*>/);
            if (openMatch) {
                var tag = openMatch[1];
                var params = ExtendedText._parseParams(openMatch[2] || '');
                var idx = self._etTags.length;
                self._etTags.push({ tag: tag, params: params });
                tagStack.push({ tag: tag, idx: idx });
                result += '\x1bETSTART[' + idx + ']';
                i += openMatch[0].length;
                continue;
            }
            var closeMatch = text.slice(i).match(/^<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/);
            if (closeMatch) {
                var closeTagName = closeMatch[1];
                for (var s = tagStack.length - 1; s >= 0; s--) {
                    if (tagStack[s].tag === closeTagName) {
                        var matchIdx = tagStack[s].idx;
                        tagStack.splice(s, 1);
                        result += '\x1bETEND[' + matchIdx + ']';
                        break;
                    }
                }
                i += closeMatch[0].length;
                continue;
            }
        }
        result += text[i];
        i++;
    }
    return result;
};

var _Window_Base_processEscapeCharacter = Window_Base.prototype.processEscapeCharacter;
Window_Base.prototype.processEscapeCharacter = function(code, textState) {
    switch (code) {
    case 'ETSTART': this._etProcessStart(textState); break;
    case 'ETEND':   this._etProcessEnd(textState);   break;
    default: _Window_Base_processEscapeCharacter.call(this, code, textState); break;
    }
};

//─── ETSTART ───
Window_Base.prototype._etProcessStart = function(textState) {
    if (!this._etEffectStack) this._etEffectStack = [];
    if (!this._etAnimSegs)   this._etAnimSegs = [];

    var idx = this.obtainEscapeParam(textState);
    var tagData = this._etTags && this._etTags[idx];
    if (!tagData) return;

    var tag = tagData.tag;
    var params = tagData.params;

    var saved = {
        tag: tag, params: params,
        textColor:    this.contents ? this.contents.textColor    : '#ffffff',
        outlineColor: this.contents ? this.contents.outlineColor : 'rgba(0,0,0,0)',
        outlineWidth: this.contents ? this.contents.outlineWidth : 4,
        startX: textState.x, startY: textState.y,
        chars: [],
        gradientActive: false, shakeActive: false, hologramActive: false,
        gradientWaveActive: false, fadeActive: false,
        dissolveActive: false, blurFadeActive: false,
        hologramOuter: null,
        gradientWaveOuter: null,
        hasInnerShake: false,
        _overlayMesh: null,
        _etOpen: true,   // 태그가 아직 닫히지 않음 — _etEnsureOverlay 생성 보류
    };

    switch (tag) {
    case 'color':
        if (params.value && this.contents) this.changeTextColor(params.value);
        break;
    case 'outline':
        if (this.contents) {
            if (params.color)     this.contents.outlineColor = params.color;
            if (params.thickness) this.contents.outlineWidth = Number(params.thickness);
        }
        break;
    case 'gradient':
        saved.gradientActive = true;
        saved.color1 = params.color1 || '#ffffff';
        saved.color2 = params.color2 || '#000000';
        saved.direction = params.direction || 'h';
        if (this.contents) this.changeTextColor(params.color1 || '#ffffff');
        break;
    case 'shake':
        saved.shakeActive = true;
        saved.amplitude = Number(params.amplitude || 3);
        saved.speed = Number(params.speed || 1);
        this._etAnimSegs.push(saved);
        break;
    case 'hologram':
        saved.hologramActive = true;
        saved.scanline = Number(params.scanline || 5);
        if (this.contents) this.changeTextColor('#00ffff');
        this._etAnimSegs.push(saved);
        break;
    case 'gradient-wave':
        saved.gradientWaveActive = true;
        saved.speed = Number(params.speed || 1);
        saved.startTime = ExtendedText._time;
        this._etAnimSegs.push(saved);
        break;
    case 'fade':
        saved.fadeActive = true;
        saved.duration = Number(params.duration || 60);
        saved.startTime = ExtendedText._time;
        this._etAnimSegs.push(saved);
        break;
    case 'dissolve':
        saved.dissolveActive = true;
        saved.speed = Number(params.speed || 1);
        saved.startTime = ExtendedText._time;
        this._etAnimSegs.push(saved);
        break;
    case 'blur-fade':
        saved.blurFadeActive = true;
        saved.duration = Number(params.duration || 60);
        saved.startTime = ExtendedText._time;
        this._etAnimSegs.push(saved);
        break;
    }

    this._etEffectStack.push(saved);
};

//─── ETEND ───
Window_Base.prototype._etProcessEnd = function(textState) {
    this.obtainEscapeParam(textState);
    if (!this._etEffectStack || this._etEffectStack.length === 0) return;
    var saved = this._etEffectStack.pop();
    // 태그 닫힘 → 이제 _etEnsureOverlay 허용
    saved._etOpen = false;


    if (saved.gradientActive && saved.chars.length > 0) {
        this._etRedrawGradient(saved);
    }

    if (saved.shakeActive) {
        for (var i = this._etEffectStack.length - 1; i >= 0; i--) {
            var outerSeg = this._etEffectStack[i];
            if (outerSeg.hologramActive && !saved.hologramOuter) {
                saved.hologramOuter = outerSeg;
            }
            if (outerSeg.gradientWaveActive && !saved.gradientWaveOuter) {
                saved.gradientWaveOuter = outerSeg;
            }
        }
    }

    if (saved.hologramActive) {
        var segs = this._etAnimSegs || [];
        for (var j = 0; j < segs.length; j++) {
            if (segs[j].shakeActive && segs[j].hologramOuter === saved) {
                saved.hasInnerShake = true;
                break;
            }
        }
    }

    if (saved.gradientWaveActive) {
        var segs2 = this._etAnimSegs || [];
        for (var k = 0; k < segs2.length; k++) {
            if (segs2[k].shakeActive && segs2[k].gradientWaveOuter === saved) {
                saved.hasInnerShake = true;
                break;
            }
        }
    }

    if (this.contents) {
        this.changeTextColor(saved.textColor);
        this.contents.outlineColor = saved.outlineColor;
        this.contents.outlineWidth = saved.outlineWidth;
    }
};

//─── processNormalCharacter: chars 기록 ───
var _Window_Base_processNormalCharacter = Window_Base.prototype.processNormalCharacter;
Window_Base.prototype.processNormalCharacter = function(textState) {
    if (this._etEffectStack && this._etEffectStack.length > 0) {
        var c = textState.text[textState.index];
        var currentColor = this.contents ? this.contents.textColor : '#ffffff';
        for (var i = this._etEffectStack.length - 1; i >= 0; i--) {
            var seg = this._etEffectStack[i];
            if (seg.gradientActive || seg.shakeActive || seg.hologramActive ||
                seg.gradientWaveActive || seg.fadeActive || seg.dissolveActive || seg.blurFadeActive) {
                seg.chars.push({
                    c: c,
                    x: textState.x, y: textState.y, h: textState.height,
                    color: currentColor,
                    finalColor: null,
                });
                // gradient/gradient-wave: 글자 추가마다 즉시 재그리기 (타이핑 중 흰색 착! 현상 방지)
                // 재그리기 후 마지막 글자 색상으로 변경 → 원본 processNormalCharacter가 올바른 색으로 덮어씀
                if (seg.gradientActive) {
                    this._etRedrawGradient(seg);
                    var lastCh = seg.chars[seg.chars.length - 1];
                    if (lastCh && lastCh.finalColor) this.changeTextColor(lastCh.finalColor);
                }
                if (seg.gradientWaveActive) {
                    this._etRedrawGradientWave(seg);
                    var lastChW = seg.chars[seg.chars.length - 1];
                    if (lastChW && lastChW.finalColor) this.changeTextColor(lastChW.finalColor);
                }
            }
        }
    }
    _Window_Base_processNormalCharacter.call(this, textState);
};

//─── gradient 재그리기 (Canvas 2D, 정적 효과이므로 유지) ───
Window_Base.prototype._etRedrawGradient = function(saved) {
    var chars = saved.chars;
    if (!chars || chars.length === 0 || !this.contents) return;
    var bmp = this.contents;
    var lh = chars[0].h || this.lineHeight();
    var startX = saved.startX;
    var endX = chars[chars.length-1].x + this.textWidth(chars[chars.length-1].c);
    var y0 = saved.startY;
    var ow = bmp.outlineWidth || 4;
    if (bmp.clearRect && !this._etNoClearRect) bmp.clearRect(startX - ow, y0, endX - startX + ow*2, lh);

    var savedColor = bmp.textColor;
    var count = chars.length;
    for (var i = 0; i < count; i++) {
        var t = count > 1 ? i / (count-1) : 0;
        var color = (saved.direction === 'v') ? saved.color1 : ExtendedText._lerpColor(saved.color1, saved.color2, t);
        this.changeTextColor(color);
        var ch = chars[i];
        bmp.drawText(ch.c, ch.x, ch.y, this.textWidth(ch.c)*2, ch.h || lh);
        ch.finalColor = color;
    }
    this.changeTextColor(savedColor);
};

//─── gradient-wave 재그리기 (Canvas 2D — 타이핑 중 정적 무지개 색상 적용) ───
// 프리뷰 오버레이가 생성되면 애니메이션 버전으로 교체됨
Window_Base.prototype._etRedrawGradientWave = function(saved) {
    var chars = saved.chars;
    if (!chars || chars.length === 0 || !this.contents) return;
    var bmp = this.contents;
    var lh = chars[0].h || this.lineHeight();
    var startX = saved.startX;
    var endX = chars[chars.length-1].x + this.textWidth(chars[chars.length-1].c);
    var totalW = endX - startX;
    var y0 = saved.startY;
    var ow = bmp.outlineWidth || 4;
    if (bmp.clearRect && !this._etNoClearRect) bmp.clearRect(startX - ow, y0, endX - startX + ow*2, lh);

    var savedColor = bmp.textColor;
    for (var i = 0; i < chars.length; i++) {
        var ch = chars[i];
        // HSV hue: 글자 위치 기반 (0~1, GLSL shader와 동일 공식)
        var hue = totalW > 0 ? (ch.x - startX) / totalW : 0;
        var color = ExtendedText._hsv2css(hue, 1.0, 0.62);
        this.changeTextColor(color);
        bmp.drawText(ch.c, ch.x, ch.y, this.textWidth(ch.c)*2, ch.h || lh);
        ch.finalColor = color;
    }
    this.changeTextColor(savedColor);
};

//─── 오버레이 부모 컨테이너 + 좌표 오프셋 결정 ───
// 에디터 프리뷰: 독립 씬에 world coords로 배치
// 게임 런타임: 윈도우의 _threeObj(THREE.Group)에 local coords로 배치
//   → 부모 Group이 윈도우 위치/카메라 변환을 처리하므로 PerspectiveCamera에서도 정상 동작
Window_Base.prototype._etGetOverlayTarget = function() {
    // 1) 에디터 프리뷰 (per-renderer 씬 or 글로벌)
    var scene = this._etScene || ExtendedText._overlayScene;
    if (scene) {
        var winX = this._etWindowX !== undefined ? this._etWindowX : (this.x || 0);
        var winY = this._etWindowY !== undefined ? this._etWindowY : (this.y || 0);
        var pad  = this._etPadding !== undefined ? this._etPadding  : (this.padding || 0);
        return { parent: scene, offsetX: winX + pad, offsetY: winY + pad, scrollY: this._etScrollY || 0 };
    }
    // 2) 게임 런타임: 윈도우 Three.js Group에 로컬 좌표로 추가
    if (this._threeObj) {
        return { parent: this._threeObj, offsetX: this.padding || 0, offsetY: this.padding || 0, scrollY: 0 };
    }
    return null;
};

//─── 세그먼트 오버레이 메시 생성 ───
Window_Base.prototype._etEnsureOverlay = function(seg) {
    if (seg._overlayMesh || seg._charMeshes) return;  // 이미 생성됨
    if (seg._etOpen) return;
    var THREE = window.THREE;
    var target = this._etGetOverlayTarget();
    if (!THREE || !target || !this.contents || seg.chars.length === 0) return;

    // shake는 per-character 독립 메시 사용 (UV charIdx 기반 세로줄 아티팩트 방지)
    if (seg.shakeActive) {
        this._etEnsureShakeMeshes(seg, THREE, target);
        return;
    }

    var bmp = this.contents;
    var chars = seg.chars;
    var lh = chars[0].h || this.lineHeight();
    var outlineW = bmp.outlineWidth !== undefined ? bmp.outlineWidth : 4;
    var clearL = Math.ceil(outlineW / 2);

    var segX = chars[0].x;
    var segY = chars[0].y;
    var segEndX = chars[chars.length-1].x + this.textWidth(chars[chars.length-1].c);
    var segW = Math.max(1, segEndX - segX + clearL * 2);
    var segH = Math.max(1, lh + 4);
    var srcX = segX - clearL;
    var srcY = segY;

    // 각 글자를 직접 재그리기
    var offCanvas = document.createElement('canvas');
    offCanvas.width = Math.ceil(segW);
    offCanvas.height = Math.ceil(segH);
    var offCtx = offCanvas.getContext('2d');

    if (offCtx) {
        offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
        // 원본 비트맵 내용을 그대로 복사 (그라데이션/외곽선 등 실제 그려진 모습을 텍스처로 사용)
        var srcBmpCanvas = bmp._canvas || (bmp._context && bmp._context.canvas);
        if (srcBmpCanvas && srcX >= 0 && srcY >= 0) {
            offCtx.drawImage(srcBmpCanvas, srcX, srcY, segW, segH, 0, 0, segW, segH);
        } else {
            // fallback: 글자 직접 재그리기
            var fontSize   = bmp.fontSize   || 28;
            var fontFace   = bmp.fontFace   || 'GameFont';
            var outlineCol = bmp.outlineColor  || 'rgba(0,0,0,0.5)';
            var baselineY = lh - (lh - fontSize * 0.7) / 2;

            offCtx.save();
            offCtx.font = fontSize + 'px ' + fontFace;
            offCtx.textBaseline = 'alphabetic';
            offCtx.textAlign    = 'left';
            offCtx.lineJoin     = 'round';

            for (var ci = 0; ci < chars.length; ci++) {
                var ch = chars[ci];
                var drawX = ch.x - segX + clearL;
                if (outlineW > 0) {
                    offCtx.strokeStyle = outlineCol;
                    offCtx.lineWidth   = outlineW;
                    offCtx.strokeText(ch.c, drawX, baselineY);
                }
                offCtx.fillStyle = ch.finalColor || ch.color || '#ffffff';
                offCtx.fillText(ch.c, drawX, baselineY);
            }
            offCtx.restore();
        }
        if (bmp.clearRect) bmp.clearRect(srcX, srcY, segW, segH);
    }

    var tex = new THREE.CanvasTexture(offCanvas);
    tex.flipY = false;
    tex.needsUpdate = true;

    var effectType = 'hologram';
    if (seg.dissolveActive)          effectType = 'dissolve';
    else if (seg.fadeActive)         effectType = 'fade';
    else if (seg.gradientWaveActive) effectType = 'gradient-wave';
    else if (seg.blurFadeActive)     effectType = 'blur-fade';

    var mat = ExtendedText._createShaderMaterial(effectType, seg.params || {});
    if (!mat) return;

    mat.uniforms.tTex.value = tex;
    if (mat.uniforms.uTexH) mat.uniforms.uTexH.value = segH;
    if (mat.uniforms.uTexelSize) mat.uniforms.uTexelSize.value.set(1/Math.max(1,segW), 1/Math.max(1,segH));
    // 복원된 _overlayStartTime이 있으면 유지 (스크롤/타이핑 중 재생성 시 애니메이션 연속성 보장)
    // 없으면 현재 시간으로 새 애니메이션 시작
    var startT = seg._overlayStartTime || ExtendedText._time;
    if (mat.uniforms.uStartTime) mat.uniforms.uStartTime.value = startT;

    var geo = new THREE.PlaneGeometry(1, 1);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 10000;  // 윈도우 내부 요소 위에 표시
    mesh._wrapper = true;  // _syncHierarchy가 renderOrder 덮어쓰기 방지

    var oX = target.offsetX + srcX;
    var oY = target.offsetY + srcY;
    mesh.position.set(oX + segW / 2, oY - target.scrollY + segH / 2, 1);
    mesh.scale.set(segW, segH, 1);

    target.parent.add(mesh);
    seg._overlayMesh      = mesh;
    seg._overlayTex       = tex;
    seg._overlayStartTime = startT;
    seg._overlayParent    = target.parent;
    seg._etBaseWorldY = oY;
    seg._etSegH       = segH;
};

//─── shake per-character 메시 생성 (texture boundary 세로줄 방지) ───
// 각 글자를 독립 PlaneGeometry Mesh로 생성, 매 프레임 position.y로 shake 표현
Window_Base.prototype._etEnsureShakeMeshes = function(seg, THREE, target) {
    var bmp   = this.contents;
    var chars = seg.chars;
    if (!bmp || !chars || chars.length === 0) return;

    var fontSize   = bmp.fontSize   || 28;
    var fontFace   = bmp.fontFace   || 'GameFont';
    var outlineCol = bmp.outlineColor  || 'rgba(0,0,0,0.5)';
    var outlineW   = bmp.outlineWidth !== undefined ? bmp.outlineWidth : 4;
    var clearL     = Math.ceil(outlineW / 2);
    var lh         = chars[0].h || this.lineHeight();
    var amp        = seg.amplitude || 3;
    var segH       = Math.max(1, lh + amp * 2 + 4);  // shake 여백 포함 높이
    var baselineY  = lh - (lh - fontSize * 0.7) / 2;

    seg._charMeshes = [];

    for (var ci = 0; ci < chars.length; ci++) {
        var ch    = chars[ci];
        var rawW  = this.textWidth ? this.textWidth(ch.c) : fontSize;
        var charW = Math.max(1, Math.ceil(rawW) + clearL * 2);

        // 글자 하나짜리 오프스크린 캔버스
        var offCanvas = document.createElement('canvas');
        offCanvas.width  = charW;
        offCanvas.height = segH;
        var offCtx = offCanvas.getContext('2d');
        if (offCtx) {
            offCtx.clearRect(0, 0, charW, segH);
            offCtx.save();
            offCtx.font         = fontSize + 'px ' + fontFace;
            offCtx.textBaseline = 'alphabetic';
            offCtx.textAlign    = 'left';
            offCtx.lineJoin     = 'round';
            if (outlineW > 0) {
                offCtx.strokeStyle = outlineCol;
                offCtx.lineWidth   = outlineW;
                offCtx.strokeText(ch.c, clearL, baselineY);
            }
            offCtx.fillStyle = ch.finalColor || ch.color || '#ffffff';
            offCtx.fillText(ch.c, clearL, baselineY);
            offCtx.restore();
        }

        var tex = new THREE.CanvasTexture(offCanvas);
        tex.flipY     = false;
        tex.needsUpdate = true;

        var geo  = new THREE.PlaneGeometry(1, 1);
        var mat  = new THREE.MeshBasicMaterial({
            map: tex, transparent: true,
            depthTest: false, depthWrite: false,
            side: THREE.DoubleSide,
        });
        var mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 10000;
        mesh._wrapper = true;  // _syncHierarchy가 renderOrder 덮어쓰기 방지

        // target 좌표 기반 위치 (스크롤 없음 — 매 프레임 scrollY를 따로 더함)
        var baseX = target.offsetX + ch.x - clearL + charW / 2;
        var baseY = target.offsetY + ch.y + segH / 2;
        mesh.position.set(baseX, baseY - target.scrollY, 1);
        mesh.scale.set(charW, segH, 1);
        target.parent.add(mesh);

        // Bitmap에서 해당 글자 영역 투명화
        if (bmp.clearRect) {
            bmp.clearRect(ch.x - clearL, ch.y, charW, segH);
        }

        seg._charMeshes.push({ mesh: mesh, tex: tex, baseX: baseX, baseY: baseY, charIdx: ci });
    }

    seg._overlayStartTime = ExtendedText._time;
    seg._overlayParent    = target.parent;
};

//─── 오버레이 uniform 업데이트 ───
Window_Base.prototype._etUpdateOverlayUniforms = function(seg, t) {
    // shake: per-character 메시 위치를 sin 파형으로 업데이트
    if (seg.shakeActive && seg._charMeshes) {
        var scrollY = this._etScrollY || 0;
        var amp   = seg.amplitude || 3;
        var speed = seg.speed || 1;
        for (var ci = 0; ci < seg._charMeshes.length; ci++) {
            var cm = seg._charMeshes[ci];
            var shakeY = Math.sin(t * speed * 5.0 + cm.charIdx * 0.8) * amp;
            var shakeX = Math.sin(t * speed * 3.0 + cm.charIdx * 0.5) * amp * 0.3;
            cm.mesh.position.x = cm.baseX + shakeX;
            cm.mesh.position.y = cm.baseY - scrollY + shakeY;
        }
        return;
    }

    if (!seg._overlayMesh) return;

    // VN 스크롤 위치 업데이트 (매 프레임)
    var scrollY = this._etScrollY || 0;
    if (seg._etBaseWorldY !== undefined) {
        seg._overlayMesh.position.y = (seg._etBaseWorldY - scrollY) + (seg._etSegH || 0) / 2;
    }

    var uniforms = seg._overlayMesh.material.uniforms;

    // 애니메이션 완료 후 frozen 상태 — uStartTime/uTime을 완성값으로 고정 후 종료
    // (오버레이 재생성 후에도 shader가 완성 상태 progress=1로 표시되도록)
    if (seg._etFrozen) {
        if (uniforms.uStartTime) uniforms.uStartTime.value = seg._overlayStartTime || 0;
        if (uniforms.uTime) uniforms.uTime.value = (seg._overlayStartTime || 0) + 100;
        return;
    }

    if (uniforms.uTime) uniforms.uTime.value = t;
    // _overlayStartTime은 스크롤 시 _redraw()에서 복원될 수 있으므로 매 프레임 동기화
    if (uniforms.uStartTime) uniforms.uStartTime.value = seg._overlayStartTime || 0;

    // 완료 판정: dispose 대신 freeze (메시 유지 → 글자가 사라지지 않음)
    // uTime += 1/60 per frame, duration in frames → 60/dur converts frames→seconds ratio
    if (seg.fadeActive || seg.blurFadeActive) {
        var dur    = seg.duration || 60;
        var startT = seg._overlayStartTime || 0;
        var progress = Math.min(1.0, (t - startT) * 60 / dur);
        if (progress >= 1.0) seg._etFrozen = true;
    } else if (seg.dissolveActive) {
        var speed   = seg.speed || 1;
        var startT2 = seg._overlayStartTime || 0;
        var elapsed = t - startT2;
        // GLSL: progress = elapsed * speed * 0.5; frozen when progress >= 1 → elapsed >= 2/speed
        if (elapsed * speed * 0.5 >= 1.0) seg._etFrozen = true;
    }
};

//─── 오버레이 dispose ───
Window_Base.prototype._etDisposeOverlay = function(seg) {
    var parent = seg._overlayParent || null;

    // shake per-character meshes
    if (seg._charMeshes) {
        for (var ci = 0; ci < seg._charMeshes.length; ci++) {
            var cm = seg._charMeshes[ci];
            if (parent) parent.remove(cm.mesh);
            if (cm.mesh) {
                cm.mesh.geometry.dispose();
                cm.mesh.material.dispose();
            }
            if (cm.tex) cm.tex.dispose();
        }
        seg._charMeshes = null;
    }

    // 단일 오버레이 메시 (non-shake 효과)
    if (seg._overlayMesh) {
        if (parent) parent.remove(seg._overlayMesh);
        seg._overlayMesh.geometry.dispose();
        seg._overlayMesh.material.dispose();
        if (seg._overlayTex) seg._overlayTex.dispose();
        seg._overlayMesh = null;
        seg._overlayTex = null;
    }

    seg._overlayParent = null;
};

//─── _etRunAnimPass: ShaderMaterial 오버레이 업데이트 ───
Window_Base.prototype._etRunAnimPass = function() {
    var segs = this._etAnimSegs;
    if (!segs || segs.length === 0) return;
    var t = ExtendedText._time;

    for (var i = 0; i < segs.length; i++) {
        var seg = segs[i];
        if (seg.chars.length === 0) continue;
        // gradient는 Canvas 2D로 이미 처리됨 (정적 효과)
        if (seg.gradientActive) continue;

        this._etEnsureOverlay(seg);
        this._etUpdateOverlayUniforms(seg, t);
    }
    // 참고: _etFrozen 세그먼트는 메시를 유지 (애니메이션 완료 후 글자 보존)
    // 오버레이 정리는 newPage / buildRenderer 정리 시에만 수행
};

//=============================================================================
// createContents / newPage 초기화
//=============================================================================
var _Window_Base_createContents = Window_Base.prototype.createContents;
Window_Base.prototype.createContents = function() {
    _Window_Base_createContents.call(this);
    this._etAnimSegs = [];
    this._etEffectStack = [];
};

// 오버레이 전체 정리 헬퍼 (newPage / terminateMessage 공통)
Window_Base.prototype._etClearAllOverlays = function() {
    var segs = this._etAnimSegs || [];
    for (var i = 0; i < segs.length; i++) {
        if (segs[i]._overlayMesh || segs[i]._charMeshes) {
            this._etDisposeOverlay(segs[i]);
        }
    }
    this._etAnimSegs = [];
    this._etEffectStack = [];
};

if (typeof Window_Message !== 'undefined') {
    var _Window_Message_newPage = Window_Message.prototype.newPage;
    Window_Message.prototype.newPage = function(textState) {
        _Window_Message_newPage.call(this, textState);
        this._etClearAllOverlays();
    };

    // 대화창 닫힐 때 오버레이 정리
    var _Window_Message_terminateMessage = Window_Message.prototype.terminateMessage;
    Window_Message.prototype.terminateMessage = function() {
        this._etClearAllOverlays();
        _Window_Message_terminateMessage.call(this);
    };
}

//=============================================================================
// update 루프
//=============================================================================
var _Window_Base_update = Window_Base.prototype.update;
Window_Base.prototype.update = function() {
    _Window_Base_update.call(this);
    ExtendedText._time += 1 / 60;
    if (this._etAnimSegs && this._etAnimSegs.length > 0) {
        this._etRunAnimPass();
    }
};
