//=============================================================================
// ExtendedText.js - 확장 텍스트 이펙트 플러그인
//=============================================================================
// Window_Base의 텍스트 처리를 확장하여 XML 스타일 태그로
// 다양한 시각 효과를 텍스트에 적용한다.
//
// 지원 태그 (비주얼):
//   <color value=#rrggbb>텍스트</color>
//   <outline color=#rrggbb thickness=3>텍스트</outline>
//   <gradient color1=#ffff00 color2=#ff0000 direction=h>텍스트</gradient>
//
// 지원 태그 (애니메이션):
//   <shake amplitude=3 speed=1>텍스트</shake>       ← 매 프레임 sin 진동
//   <hologram scanline=5>텍스트</hologram>           ← cyan + 이동하는 투명 스캔라인
//
// 지원 태그 (패스스루 - 텍스트는 표시, 이펙트 미구현):
//   <gradient-wave speed=1>텍스트</gradient-wave>
//   <dissolve speed=1>텍스트</dissolve>
//   <fade duration=60>텍스트</fade>
//   <blur-fade duration=60>텍스트</blur-fade>
//   <typewriter speed=1>텍스트</typewriter>
//=============================================================================

var ExtendedText = {};
ExtendedText._time = 0;

//─── 헬퍼: 파라미터 문자열 파싱 ───
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

//─── 헬퍼: #rrggbb → [r, g, b] (0~1) ───
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

//─── 헬퍼: [r,g,b] → CSS 색상 문자열 ───
ExtendedText._toCSS = function(rgb) {
    return 'rgb(' +
        Math.round(rgb[0] * 255) + ',' +
        Math.round(rgb[1] * 255) + ',' +
        Math.round(rgb[2] * 255) + ')';
};

//─── 헬퍼: 두 CSS 색상 선형 보간 ───
ExtendedText._lerpColor = function(c1, c2, t) {
    var rgb1 = this._parseHex(c1) || [1, 1, 1];
    var rgb2 = this._parseHex(c2) || [0, 0, 0];
    return this._toCSS([
        rgb1[0] + (rgb2[0] - rgb1[0]) * t,
        rgb1[1] + (rgb2[1] - rgb1[1]) * t,
        rgb1[2] + (rgb2[2] - rgb1[2]) * t,
    ]);
};

//=============================================================================
// Window_Base 오버라이드
//=============================================================================

//─── convertEscapeCharacters: <tag>...</tag> → \x1bETSTART[n]...\x1bETEND[n] ───
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

//─── processEscapeCharacter: ETSTART / ETEND 처리 추가 ───
var _Window_Base_processEscapeCharacter = Window_Base.prototype.processEscapeCharacter;
Window_Base.prototype.processEscapeCharacter = function(code, textState) {
    switch (code) {
    case 'ETSTART':
        this._etProcessStart(textState);
        break;
    case 'ETEND':
        this._etProcessEnd(textState);
        break;
    default:
        _Window_Base_processEscapeCharacter.call(this, code, textState);
        break;
    }
};

//─── ETSTART 처리 ───
Window_Base.prototype._etProcessStart = function(textState) {
    if (!this._etEffectStack) this._etEffectStack = [];

    var idx = this.obtainEscapeParam(textState);
    var tagData = this._etTags && this._etTags[idx];
    if (!tagData) return;

    var tag = tagData.tag;
    var params = tagData.params;

    var saved = {
        tag: tag,
        params: params,
        textColor: this.contents ? this.contents.textColor : '#ffffff',
        outlineColor: this.contents ? this.contents.outlineColor : 'rgba(0,0,0,0)',
        outlineWidth: this.contents ? this.contents.outlineWidth : 4,
        startX: textState.x,
        startY: textState.y,
        chars: [],
        gradientActive: false,
        shakeActive: false,
        hologramActive: false,
    };

    switch (tag) {
    case 'color':
        if (params.value && this.contents) {
            this.changeTextColor(params.value);
        }
        break;
    case 'outline':
        if (this.contents) {
            if (params.color) this.contents.outlineColor = params.color;
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
        break;
    case 'hologram':
        saved.hologramActive = true;
        saved.scanline = Number(params.scanline || 5);
        if (this.contents) this.changeTextColor('#00ffff');
        break;
    }

    this._etEffectStack.push(saved);
};

//─── ETEND 처리 ───
Window_Base.prototype._etProcessEnd = function(textState) {
    this.obtainEscapeParam(textState);

    if (!this._etEffectStack || this._etEffectStack.length === 0) return;
    var saved = this._etEffectStack.pop();

    // gradient: 기록된 문자 재그리기 (finalColor도 설정)
    if (saved.gradientActive && saved.chars.length > 0) {
        this._etRedrawGradient(saved);
    }

    // shake: 애니메이션 세그먼트 등록
    if (saved.shakeActive && saved.chars.length > 0) {
        if (!this._etAnimSegs) this._etAnimSegs = [];
        this._etAnimSegs.push(saved);
    }

    // hologram: 애니메이션 세그먼트 등록 + 초기 그리기
    if (saved.hologramActive && saved.chars.length > 0) {
        if (!this._etAnimSegs) this._etAnimSegs = [];
        this._etAnimSegs.push(saved);
        // 초기 상태 렌더
        this._etRedrawHologramBase(saved);
        this._etOverlayScanlines(saved, ExtendedText._time);
    }

    // 상태 복원
    if (this.contents) {
        this.changeTextColor(saved.textColor);
        this.contents.outlineColor = saved.outlineColor;
        this.contents.outlineWidth = saved.outlineWidth;
    }
};

//─── processNormalCharacter: 모든 활성 이펙트에 문자/위치/색상 기록 ───
// (break 없이 모든 활성 이펙트에 기록 → 중첩 효과 지원)
var _Window_Base_processNormalCharacter = Window_Base.prototype.processNormalCharacter;
Window_Base.prototype.processNormalCharacter = function(textState) {
    if (this._etEffectStack && this._etEffectStack.length > 0) {
        var c = textState.text[textState.index];
        var currentColor = this.contents ? this.contents.textColor : '#ffffff';
        for (var i = this._etEffectStack.length - 1; i >= 0; i--) {
            var seg = this._etEffectStack[i];
            if (seg.gradientActive || seg.shakeActive || seg.hologramActive) {
                seg.chars.push({
                    c: c,
                    x: textState.x,
                    y: textState.y,
                    h: textState.height,
                    color: currentColor,   // 현재 색상 저장 (중첩 color 태그 등 반영)
                    finalColor: null,      // gradient가 설정하는 최종 색상
                });
            }
        }
    }
    _Window_Base_processNormalCharacter.call(this, textState);
};

//─── gradient 재그리기 ───
Window_Base.prototype._etRedrawGradient = function(saved) {
    var chars = saved.chars;
    if (!chars || chars.length === 0 || !this.contents) return;

    var bmp = this.contents;
    var lh = saved.chars[0].h || this.lineHeight();
    var startX = saved.startX;
    var endX = chars[chars.length - 1].x + this.textWidth(chars[chars.length - 1].c);
    var y0 = saved.startY;
    var ow = bmp.outlineWidth || 4;
    if (bmp.clearRect) {
        bmp.clearRect(startX - ow, y0, endX - startX + ow * 2, lh);
    }

    var savedColor = bmp.textColor;
    var count = chars.length;
    for (var i = 0; i < count; i++) {
        var t = count > 1 ? i / (count - 1) : 0;
        var color;
        if (saved.direction === 'v') {
            color = saved.color1;
        } else {
            color = ExtendedText._lerpColor(saved.color1, saved.color2, t);
        }
        this.changeTextColor(color);
        var ch = chars[i];
        var w = this.textWidth(ch.c);
        bmp.drawText(ch.c, ch.x, ch.y, w * 2, ch.h || lh);
        // shake 등 외부 이펙트가 이 char를 재그릴 때 사용할 최종 색상 기록
        ch.finalColor = color;
    }
    this.changeTextColor(savedColor);
};

//─── shake 재그리기 (매 프레임 호출) ───
Window_Base.prototype._etRedrawShake = function(seg, time) {
    var chars = seg.chars;
    if (!chars || chars.length === 0 || !this.contents) return;

    var bmp = this.contents;
    var lh = chars[0].h || this.lineHeight();
    var amp = seg.amplitude;
    var speed = seg.speed;
    var ow = (bmp.outlineWidth || 4) + 1;

    var startX = chars[0].x - ow;
    var endX   = chars[chars.length - 1].x + this.textWidth(chars[chars.length - 1].c) + ow;
    var y0     = chars[0].y - amp - 1;
    var totalH = lh + (amp + 1) * 2;
    bmp.clearRect(startX, y0, endX - startX, totalH);

    var savedColor = bmp.textColor;
    for (var i = 0; i < chars.length; i++) {
        var ch = chars[i];
        // 우선순위: gradient 최종색 > 기록 시점 색 > seg 저장 색
        var charColor = ch.finalColor || ch.color || seg.textColor;
        this.changeTextColor(charColor);
        var offsetY = Math.sin(time * speed * 5.0 + i * 0.8) * amp;
        var w = this.textWidth(ch.c) + 4;
        bmp.drawText(ch.c, ch.x, ch.y + offsetY, w, ch.h || lh);
    }
    this.changeTextColor(savedColor);
    // drawText가 _setDirty()를 호출하므로 checkDirty()에서 텍스처가 갱신됨
};

//─── hologram base 재그리기 (clearRect + drawText, 패스1) ───
Window_Base.prototype._etRedrawHologramBase = function(seg) {
    var chars = seg.chars;
    if (!chars || chars.length === 0 || !this.contents) return;

    var bmp = this.contents;
    var lh = chars[0].h || this.lineHeight();
    var ow = (bmp.outlineWidth || 4) + 1;

    var startX = chars[0].x - ow;
    var endX   = chars[chars.length - 1].x + this.textWidth(chars[chars.length - 1].c) + ow;
    var width  = endX - startX;

    bmp.clearRect(startX, chars[0].y - 1, width, lh + 2);

    var savedColor = bmp.textColor;
    this.changeTextColor('#00ffff');
    for (var i = 0; i < chars.length; i++) {
        var ch = chars[i];
        var w = this.textWidth(ch.c) + 4;
        bmp.drawText(ch.c, ch.x, ch.y, w, ch.h || lh);
    }
    this.changeTextColor(savedColor);
};

//─── hologram 스캔라인 오버레이 (패스2) ───
// destination-out compositing으로 해당 줄을 투명하게 만듦
// → cyan 글자에 투명한 가로 줄이 아래로 흘러가는 애니메이션
Window_Base.prototype._etOverlayScanlines = function(seg, time) {
    var chars = seg.chars;
    if (!chars || chars.length === 0 || !this.contents) return;

    var bmp = this.contents;
    var ctx = bmp._context;
    if (!ctx) return;

    var lh = chars[0].h || this.lineHeight();
    var ow = (bmp.outlineWidth || 4) + 1;
    var startX = chars[0].x - ow;
    var endX   = chars[chars.length - 1].x + this.textWidth(chars[chars.length - 1].c) + ow;
    var y0     = chars[0].y;
    var width  = endX - startX;

    var scanH = seg.scanline || 5;
    var darkH = Math.max(1, Math.floor(scanH * 0.45));
    // 스캔라인이 아래로 흐르는 애니메이션: time * speed → y 오프셋
    var scrollY = (time * 25) % scanH;

    ctx.save();
    // destination-out: 그리는 부분의 알파를 줄여 투명하게 만듦
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    for (var y = y0 - scanH + scrollY; y < y0 + lh + scanH; y += scanH) {
        var clipY = Math.max(y, y0);
        var clipH = Math.min(y + darkH, y0 + lh) - clipY;
        if (clipH > 0) {
            ctx.fillRect(startX, clipY, width, clipH);
        }
    }
    ctx.restore();

    bmp._setDirty();
};

//=============================================================================
// createContents 오버라이드 – 애니메이션 세그먼트 초기화
//=============================================================================
var _Window_Base_createContents = Window_Base.prototype.createContents;
Window_Base.prototype.createContents = function() {
    _Window_Base_createContents.call(this);
    this._etAnimSegs = [];
    this._etEffectStack = [];
};

//=============================================================================
// Window_Message.newPage 오버라이드 – 페이지 전환 시 초기화
// contents.clear()만으로는 _etAnimSegs가 초기화되지 않아 이전 shake/hologram이 지속됨
//=============================================================================
if (typeof Window_Message !== 'undefined') {
    var _Window_Message_newPage = Window_Message.prototype.newPage;
    Window_Message.prototype.newPage = function(textState) {
        _Window_Message_newPage.call(this, textState);
        this._etAnimSegs = [];
        this._etEffectStack = [];
    };
}

//=============================================================================
// update 루프 (시간 업데이트 + 2패스 애니메이션)
// 패스1: shake / hologram base → 패스2: hologram scanline 오버레이
// 순서가 중요: shake 후 hologram 스캔라인이 올라와야 겹쳐서 올바른 효과 나옴
//=============================================================================
var _Window_Base_update = Window_Base.prototype.update;
Window_Base.prototype.update = function() {
    _Window_Base_update.call(this);
    ExtendedText._time += 1 / 60;

    if (!this._etAnimSegs || this._etAnimSegs.length === 0) return;

    var segs = this._etAnimSegs;
    var t = ExtendedText._time;

    // 패스 1: 텍스트 재그리기 (shake는 위치 변경, hologram은 cyan 재그리기)
    for (var i = 0; i < segs.length; i++) {
        var seg = segs[i];
        if (seg.shakeActive) {
            this._etRedrawShake(seg, t);
        } else if (seg.hologramActive) {
            this._etRedrawHologramBase(seg);
        }
    }

    // 패스 2: 오버레이 (hologram 스캔라인을 텍스트 위에 적용)
    for (var j = 0; j < segs.length; j++) {
        var seg2 = segs[j];
        if (seg2.hologramActive) {
            this._etOverlayScanlines(seg2, t);
        }
    }
};
