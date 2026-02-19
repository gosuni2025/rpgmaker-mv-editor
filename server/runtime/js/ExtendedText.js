//=============================================================================
// ExtendedText.js - 확장 텍스트 이펙트 플러그인
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
    var tagStack = []; // {tag, idx}

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

//─── ETSTART: shake/hologram은 즉시 animSegs 등록 ───
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
        hologramOuter: null,  // shake 전용: outer hologram 참조
        hasInnerShake: false, // hologram 전용: inner shake 존재 여부
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
        this._etAnimSegs.push(saved); // 즉시 등록
        break;
    case 'hologram':
        saved.hologramActive = true;
        saved.scanline = Number(params.scanline || 5);
        if (this.contents) this.changeTextColor('#00ffff');
        this._etAnimSegs.push(saved); // 즉시 등록
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

    if (saved.gradientActive && saved.chars.length > 0) {
        this._etRedrawGradient(saved);
    }

    if (saved.shakeActive) {
        // outer hologram 연결 (ETEND[shake] 시 _etEffectStack에 hologram이 남아있음)
        for (var i = this._etEffectStack.length - 1; i >= 0; i--) {
            if (this._etEffectStack[i].hologramActive) {
                saved.hologramOuter = this._etEffectStack[i];
                break;
            }
        }
    }

    if (saved.hologramActive) {
        // inner shake 여부 감지
        var segs = this._etAnimSegs || [];
        for (var j = 0; j < segs.length; j++) {
            if (segs[j].shakeActive && segs[j].hologramOuter === saved) {
                saved.hasInnerShake = true;
                break;
            }
        }
        // 즉시 그리기 없음 (깜빡임 방지, 다음 _etRunAnimPass에서 처리)
    }

    if (this.contents) {
        this.changeTextColor(saved.textColor);
        this.contents.outlineColor = saved.outlineColor;
        this.contents.outlineWidth = saved.outlineWidth;
    }
};

//─── processNormalCharacter: 모든 활성 이펙트에 chars 기록 ───
// 타이프라이터 모드 지원: chars 추가 직후 즉시 _etRunAnimPass 호출
var _Window_Base_processNormalCharacter = Window_Base.prototype.processNormalCharacter;
Window_Base.prototype.processNormalCharacter = function(textState) {
    var hasAnim = false;
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
                if (seg.shakeActive || seg.hologramActive ||
                    seg.gradientWaveActive || seg.fadeActive || seg.dissolveActive || seg.blurFadeActive) hasAnim = true;
            }
        }
    }
    _Window_Base_processNormalCharacter.call(this, textState);
    // 타이프라이터 모드: 새 글자가 그려진 직후 즉시 효과 적용
    if (hasAnim && this._etAnimSegs && this._etAnimSegs.length > 0) {
        this._etRunAnimPass();
    }
};

//─── _etRunAnimPass: 2패스 애니메이션 적용 (재사용 가능한 공통 함수) ───
// 패스1: shake/hologram_base 재그리기 + shake의 hologramOuter scanlines
// 패스2: hologram 단독의 scanlines 오버레이
Window_Base.prototype._etRunAnimPass = function() {
    var segs = this._etAnimSegs;
    if (!segs || segs.length === 0) return;
    var t = ExtendedText._time;

    // 패스 1: 텍스트 재그리기
    for (var i = 0; i < segs.length; i++) {
        var seg = segs[i];
        if (seg.chars.length === 0) continue;
        if (seg.shakeActive) {
            this._etRedrawShake(seg, t);
            // outer hologram의 스캔라인을 shake 직후 오버레이
            if (seg.hologramOuter && seg.hologramOuter.chars.length > 0) {
                this._etOverlayScanlines(seg.hologramOuter, t);
            }
        } else if (seg.hologramActive && !seg.hasInnerShake) {
            this._etRedrawHologramBase(seg);
        } else if (seg.gradientWaveActive) {
            this._etRedrawGradientWave(seg, t);
        } else if (seg.fadeActive) {
            this._etRedrawFade(seg, t);
        } else if (seg.dissolveActive) {
            this._etRedrawDissolve(seg, t);
        } else if (seg.blurFadeActive) {
            this._etRedrawBlurFade(seg, t);
        }
    }

    // 패스 2: hologram 단독 스캔라인 오버레이
    for (var j = 0; j < segs.length; j++) {
        var seg2 = segs[j];
        if (seg2.chars.length === 0) continue;
        if (seg2.hologramActive && !seg2.hasInnerShake) {
            this._etOverlayScanlines(seg2, t);
        }
    }

    // 완료 세그먼트 제거 (_etDone 플래그)
    for (var k = segs.length - 1; k >= 0; k--) {
        if (segs[k]._etDone) segs.splice(k, 1);
    }
};

//─── gradient 재그리기 ───
Window_Base.prototype._etRedrawGradient = function(saved) {
    var chars = saved.chars;
    if (!chars || chars.length === 0 || !this.contents) return;
    var bmp = this.contents;
    var lh = chars[0].h || this.lineHeight();
    var startX = saved.startX;
    var endX = chars[chars.length-1].x + this.textWidth(chars[chars.length-1].c);
    var y0 = saved.startY;
    var ow = bmp.outlineWidth || 4;
    if (bmp.clearRect) bmp.clearRect(startX - ow, y0, endX - startX + ow*2, lh);

    var savedColor = bmp.textColor;
    var count = chars.length;
    for (var i = 0; i < count; i++) {
        var t = count > 1 ? i / (count-1) : 0;
        var color = (saved.direction === 'v') ? saved.color1 : ExtendedText._lerpColor(saved.color1, saved.color2, t);
        this.changeTextColor(color);
        var ch = chars[i];
        bmp.drawText(ch.c, ch.x, ch.y, this.textWidth(ch.c)*2, ch.h || lh);
        ch.finalColor = color; // shake 등 외부 이펙트가 사용할 최종 색상
    }
    this.changeTextColor(savedColor);
};

//─── shake 재그리기 ───
Window_Base.prototype._etRedrawShake = function(seg, time) {
    var chars = seg.chars;
    if (!chars || chars.length === 0 || !this.contents) return;
    var bmp = this.contents;
    var lh = chars[0].h || this.lineHeight();
    var amp = seg.amplitude, speed = seg.speed;
    var ow = (bmp.outlineWidth || 4) + 1;

    var startX = chars[0].x - ow;
    var endX   = chars[chars.length-1].x + this.textWidth(chars[chars.length-1].c) + ow;
    bmp.clearRect(startX, chars[0].y - amp - 1, endX - startX, lh + (amp+1)*2);

    var savedColor = bmp.textColor;
    // 현재 outlineColor가 외부 이펙트(다른 줄 outline 등)로 오염될 수 있으므로
    // seg 생성 시점의 값으로 복구하여 그리기
    var savedOutlineColor = bmp.outlineColor;
    var savedOutlineWidth = bmp.outlineWidth;
    bmp.outlineColor = seg.outlineColor;
    bmp.outlineWidth = seg.outlineWidth;

    for (var i = 0; i < chars.length; i++) {
        var ch = chars[i];
        var charColor = ch.finalColor || ch.color || seg.textColor;
        this.changeTextColor(charColor);
        var offsetY = Math.sin(time * speed * 5.0 + i * 0.8) * amp;
        bmp.drawText(ch.c, ch.x, ch.y + offsetY, this.textWidth(ch.c) + 4, ch.h || lh);
    }

    this.changeTextColor(savedColor);
    bmp.outlineColor = savedOutlineColor;
    bmp.outlineWidth = savedOutlineWidth;
};

//─── hologram base 재그리기 (clearRect + cyan, outline 없이) ───
Window_Base.prototype._etRedrawHologramBase = function(seg) {
    var chars = seg.chars;
    if (!chars || chars.length === 0 || !this.contents) return;
    var bmp = this.contents;
    var lh = chars[0].h || this.lineHeight();
    var ow = (bmp.outlineWidth || 4) + 1;
    var startX = chars[0].x - ow;
    var endX   = chars[chars.length-1].x + this.textWidth(chars[chars.length-1].c) + ow;

    bmp.clearRect(startX, chars[0].y - 1, endX - startX, lh + 2);

    var savedColor = bmp.textColor;
    // 외부 outlineColor 오염 방지: hologram은 outline 없이 그리기
    var savedOutlineColor = bmp.outlineColor;
    var savedOutlineWidth = bmp.outlineWidth;
    bmp.outlineColor = 'rgba(0,0,0,0)';
    bmp.outlineWidth = 0;

    this.changeTextColor('#00ffff');
    for (var i = 0; i < chars.length; i++) {
        var ch = chars[i];
        bmp.drawText(ch.c, ch.x, ch.y, this.textWidth(ch.c) + 4, ch.h || lh);
    }

    this.changeTextColor(savedColor);
    bmp.outlineColor = savedOutlineColor;
    bmp.outlineWidth = savedOutlineWidth;
};

//─── hologram 스캔라인 오버레이 ───
// destination-out: 해당 줄을 투명하게 잘라내어 배경이 비쳐 보이는 효과
// 스캔라인이 time에 따라 아래로 흘러내림
Window_Base.prototype._etOverlayScanlines = function(seg, time) {
    var chars = seg.chars;
    if (!chars || chars.length === 0 || !this.contents) return;
    var bmp = this.contents;
    var ctx = bmp._context;
    if (!ctx) return;

    var lh = chars[0].h || this.lineHeight();
    var ow = (bmp.outlineWidth || 4) + 1;
    var startX = chars[0].x - ow;
    var endX   = chars[chars.length-1].x + this.textWidth(chars[chars.length-1].c) + ow;
    var y0 = chars[0].y;
    var width = endX - startX;

    var scanH = seg.scanline || 5;
    var darkH = Math.max(1, Math.floor(scanH * 0.45));
    var scrollY = (time * 25) % scanH;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    for (var y = y0 - scanH + scrollY; y < y0 + lh + scanH; y += scanH) {
        var clipY = Math.max(y, y0);
        var clipH = Math.min(y + darkH, y0 + lh) - clipY;
        if (clipH > 0) ctx.fillRect(startX, clipY, width, clipH);
    }
    ctx.restore();
    bmp._setDirty();
};

//─── gradient-wave: 무지개 색상 사이클 (문자별 hue 오프셋) ───
Window_Base.prototype._etRedrawGradientWave = function(seg, time) {
    var chars = seg.chars;
    if (!chars || chars.length === 0 || !this.contents) return;
    var bmp = this.contents;
    var lh = chars[0].h || this.lineHeight();
    var ow = (bmp.outlineWidth || 4) + 1;
    var startX = chars[0].x - ow;
    var endX   = chars[chars.length-1].x + this.textWidth(chars[chars.length-1].c) + ow;

    bmp.clearRect(startX, chars[0].y - 1, endX - startX, lh + 2);

    var savedColor = bmp.textColor;
    var savedOutlineColor = bmp.outlineColor;
    var savedOutlineWidth = bmp.outlineWidth;
    bmp.outlineColor = seg.outlineColor;
    bmp.outlineWidth = seg.outlineWidth;

    var speed = seg.speed || 1;
    for (var i = 0; i < chars.length; i++) {
        var hue = ((i * 28 + time * speed * 80) % 360 + 360) % 360;
        this.changeTextColor('hsl(' + hue.toFixed(0) + ',100%,62%)');
        var ch = chars[i];
        bmp.drawText(ch.c, ch.x, ch.y, this.textWidth(ch.c) + 4, ch.h || lh);
    }

    this.changeTextColor(savedColor);
    bmp.outlineColor = savedOutlineColor;
    bmp.outlineWidth = savedOutlineWidth;
};

//─── fade: globalAlpha로 서서히 나타나기 ───
Window_Base.prototype._etRedrawFade = function(seg, time) {
    var chars = seg.chars;
    if (!chars || chars.length === 0 || !this.contents) return;
    var bmp = this.contents;
    var ctx = bmp._context;
    if (!ctx) return;

    var progress = Math.min(1.0, (time - seg.startTime) * 60 / seg.duration);
    var lh = chars[0].h || this.lineHeight();
    var ow = (bmp.outlineWidth || 4) + 1;
    var startX = chars[0].x - ow;
    var endX   = chars[chars.length-1].x + this.textWidth(chars[chars.length-1].c) + ow;

    bmp.clearRect(startX, chars[0].y - 1, endX - startX, lh + 2);
    if (progress <= 0) return;

    var savedAlpha = ctx.globalAlpha;
    ctx.globalAlpha = progress;

    var savedColor = bmp.textColor;
    var savedOutlineColor = bmp.outlineColor;
    var savedOutlineWidth = bmp.outlineWidth;
    bmp.outlineColor = seg.outlineColor;
    bmp.outlineWidth = seg.outlineWidth;

    for (var i = 0; i < chars.length; i++) {
        var ch = chars[i];
        this.changeTextColor(ch.finalColor || ch.color || seg.textColor);
        bmp.drawText(ch.c, ch.x, ch.y, this.textWidth(ch.c) + 4, ch.h || lh);
    }

    ctx.globalAlpha = savedAlpha;
    this.changeTextColor(savedColor);
    bmp.outlineColor = savedOutlineColor;
    bmp.outlineWidth = savedOutlineWidth;

    if (progress >= 1.0) seg._etDone = true;
};

//─── dissolve: 픽셀 블록 단위로 서서히 나타나기 ───
Window_Base.prototype._etRedrawDissolve = function(seg, time) {
    var chars = seg.chars;
    if (!chars || chars.length === 0 || !this.contents) return;
    var bmp = this.contents;
    var ctx = bmp._context;
    if (!ctx) return;

    var elapsed = time - seg.startTime;
    var speed = seg.speed || 1;
    var threshold = Math.max(0, 1.0 - elapsed * speed);

    var lh = chars[0].h || this.lineHeight();
    var ow = (bmp.outlineWidth || 4) + 1;
    var startX = chars[0].x - ow;
    var endX   = chars[chars.length-1].x + this.textWidth(chars[chars.length-1].c) + ow;
    var y0 = chars[0].y;
    var width = endX - startX;

    bmp.clearRect(startX, y0 - 1, width, lh + 2);

    var savedColor = bmp.textColor;
    var savedOutlineColor = bmp.outlineColor;
    var savedOutlineWidth = bmp.outlineWidth;
    bmp.outlineColor = seg.outlineColor;
    bmp.outlineWidth = seg.outlineWidth;

    for (var i = 0; i < chars.length; i++) {
        var ch = chars[i];
        this.changeTextColor(ch.finalColor || ch.color || seg.textColor);
        bmp.drawText(ch.c, ch.x, ch.y, this.textWidth(ch.c) + 4, ch.h || lh);
    }

    this.changeTextColor(savedColor);
    bmp.outlineColor = savedOutlineColor;
    bmp.outlineWidth = savedOutlineWidth;

    if (threshold <= 0) {
        seg._etDone = true;
        return;
    }

    // destination-out으로 노이즈 블록 지우기 (임계값 이하 블록은 숨김)
    var blockSize = 4;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    for (var by = y0; by < y0 + lh; by += blockSize) {
        for (var bx = startX; bx < startX + width; bx += blockSize) {
            var noiseVal = Math.abs(Math.sin(bx * 127.1 + by * 311.7));
            if (noiseVal < threshold) {
                ctx.fillRect(bx, by, blockSize, blockSize);
            }
        }
    }
    ctx.restore();
    bmp._setDirty();
};

//─── blur-fade: 흐릿한 상태에서 선명하게 나타나기 ───
Window_Base.prototype._etRedrawBlurFade = function(seg, time) {
    var chars = seg.chars;
    if (!chars || chars.length === 0 || !this.contents) return;
    var bmp = this.contents;
    var ctx = bmp._context;
    if (!ctx) return;

    var progress = Math.min(1.0, (time - seg.startTime) * 60 / seg.duration);
    var blurPx = (1.0 - progress) * 8;
    var alpha = 0.2 + progress * 0.8;

    var lh = chars[0].h || this.lineHeight();
    // blur 여백 확보
    var ow = (bmp.outlineWidth || 4) + Math.ceil(blurPx) + 2;
    var startX = chars[0].x - ow;
    var endX   = chars[chars.length-1].x + this.textWidth(chars[chars.length-1].c) + ow;

    bmp.clearRect(startX, chars[0].y - ow, endX - startX, lh + ow * 2);
    if (progress <= 0) return;

    var savedFilter = ctx.filter !== undefined ? ctx.filter : 'none';
    var savedAlpha = ctx.globalAlpha;

    if (blurPx > 0.1 && 'filter' in ctx) {
        ctx.filter = 'blur(' + blurPx.toFixed(1) + 'px)';
    }
    ctx.globalAlpha = alpha;

    var savedColor = bmp.textColor;
    var savedOutlineColor = bmp.outlineColor;
    var savedOutlineWidth = bmp.outlineWidth;
    bmp.outlineColor = seg.outlineColor;
    bmp.outlineWidth = seg.outlineWidth;

    for (var i = 0; i < chars.length; i++) {
        var ch = chars[i];
        this.changeTextColor(ch.finalColor || ch.color || seg.textColor);
        bmp.drawText(ch.c, ch.x, ch.y, this.textWidth(ch.c) + 4, ch.h || lh);
    }

    if ('filter' in ctx) ctx.filter = savedFilter;
    ctx.globalAlpha = savedAlpha;
    this.changeTextColor(savedColor);
    bmp.outlineColor = savedOutlineColor;
    bmp.outlineWidth = savedOutlineWidth;

    if (progress >= 1.0) seg._etDone = true;
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

if (typeof Window_Message !== 'undefined') {
    var _Window_Message_newPage = Window_Message.prototype.newPage;
    Window_Message.prototype.newPage = function(textState) {
        _Window_Message_newPage.call(this, textState);
        this._etAnimSegs = [];
        this._etEffectStack = [];
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
