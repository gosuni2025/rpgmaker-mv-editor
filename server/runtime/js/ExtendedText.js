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
// 지원 태그 (애니메이션 - 텍스트는 표시되나 이펙트는 미구현):
//   <gradient-wave speed=1>텍스트</gradient-wave>
//   <dissolve speed=1>텍스트</dissolve>
//   <fade duration=60>텍스트</fade>
//   <shake amplitude=3 speed=1>텍스트</shake>
//   <blur-fade duration=60>텍스트</blur-fade>
//   <hologram scanline=5 flicker=0.3>텍스트</hologram>
//
// 지원 태그 (타이밍):
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
    // 먼저 기존 \V, \N, \P, \G 치환 실행
    text = _Window_Base_convertEscapeCharacters.call(this, text);

    this._etTags = [];
    var self = this;
    var result = '';
    var i = 0;
    var tagStack = []; // {tag, idx}

    while (i < text.length) {
        if (text[i] === '<') {
            // 시작 태그 확인
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

            // 종료 태그 확인
            var closeMatch = text.slice(i).match(/^<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/);
            if (closeMatch) {
                var closeTagName = closeMatch[1];
                // 스택에서 매칭 태그 찾기 (LIFO)
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

    // 현재 상태 저장
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
    };

    // 효과 적용
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
        // 임시로 color1으로 설정 (ETEND에서 재그리기)
        if (this.contents) this.changeTextColor(params.color1 || '#ffffff');
        break;
    // 기타 태그 (gradient-wave, dissolve, fade, shake, blur-fade, hologram, typewriter):
    // 텍스트는 정상 표시, 이펙트 미구현
    }

    this._etEffectStack.push(saved);
};

//─── ETEND 처리 ───
Window_Base.prototype._etProcessEnd = function(textState) {
    // [n] 파라미터 소비
    this.obtainEscapeParam(textState);

    if (!this._etEffectStack || this._etEffectStack.length === 0) return;
    var saved = this._etEffectStack.pop();

    // gradient: 기록된 문자 재그리기
    if (saved.gradientActive && saved.chars.length > 0) {
        this._etRedrawGradient(saved);
    }

    // 상태 복원
    if (this.contents) {
        this.changeTextColor(saved.textColor);
        this.contents.outlineColor = saved.outlineColor;
        this.contents.outlineWidth = saved.outlineWidth;
    }
};

//─── processNormalCharacter: gradient용 문자 위치 기록 ───
var _Window_Base_processNormalCharacter = Window_Base.prototype.processNormalCharacter;
Window_Base.prototype.processNormalCharacter = function(textState) {
    // 활성 gradient 이펙트가 있으면 문자/위치 기록
    if (this._etEffectStack && this._etEffectStack.length > 0) {
        for (var i = this._etEffectStack.length - 1; i >= 0; i--) {
            if (this._etEffectStack[i].gradientActive) {
                var c = textState.text[textState.index];
                this._etEffectStack[i].chars.push({
                    c: c,
                    x: textState.x,
                    y: textState.y,
                    h: textState.height,
                });
                break;
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

    // 첫 번째 줄의 영역 지우기 (단순 수평 처리)
    var startX = saved.startX;
    var endX = chars[chars.length - 1].x + this.textWidth(chars[chars.length - 1].c);
    var y0 = saved.startY;

    // 외곽선 포함한 영역 클리어
    var ow = bmp.outlineWidth || 4;
    if (bmp.clearRect) {
        bmp.clearRect(startX - ow, y0, endX - startX + ow * 2, lh);
    }

    // 각 문자를 보간 색상으로 재그리기
    var savedColor = bmp.textColor;
    var count = chars.length;
    for (var i = 0; i < count; i++) {
        var t = count > 1 ? i / (count - 1) : 0;
        var color;
        if (saved.direction === 'v') {
            // 수직: 줄 단위 보간 (단일 줄은 color1)
            color = saved.color1;
        } else {
            color = ExtendedText._lerpColor(saved.color1, saved.color2, t);
        }
        this.changeTextColor(color);
        var ch = chars[i];
        var w = this.textWidth(ch.c);
        bmp.drawText(ch.c, ch.x, ch.y, w * 2, ch.h || lh);
    }
    this.changeTextColor(savedColor);
};

//=============================================================================
// update 루프 (애니메이션 시간 업데이트용)
//=============================================================================
var _Window_Base_update = Window_Base.prototype.update;
Window_Base.prototype.update = function() {
    _Window_Base_update.call(this);
    // 향후 애니메이션 이펙트용 시간 동기화
    ExtendedText._time = PictureShader ? PictureShader._time : (ExtendedText._time + 1/60);
};
