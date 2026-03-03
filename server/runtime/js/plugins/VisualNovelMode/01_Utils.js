    // =========================================================================
    // raw 텍스트에서 escape/태그를 제외한 visible 글자 count개까지 슬라이스
    // =========================================================================
    function sliceRaw(text, count) {
        var i = 0, visible = 0;
        var openTags = [];  // 열린 ET 태그 스택 (닫는 태그 자동 보완용)
        while (i < text.length) {
            if (visible >= count) break;
            var c = text[i];
            if (c === '\\') {
                // \C[n], \N[n], \V[n], \I[n] 또는 \. \! \{ \} 등
                i++;
                if (i < text.length) {
                    var n = text[i].toUpperCase();
                    if ('CNVI'.indexOf(n) >= 0 && i + 1 < text.length && text[i + 1] === '[') {
                        i += 2;
                        while (i < text.length && text[i] !== ']') i++;
                        if (i < text.length) i++;
                    } else {
                        i++;
                    }
                }
            } else if (c === '<') {
                var tagStart = i;
                i++;
                var isClose = (i < text.length && text[i] === '/');
                while (i < text.length && text[i] !== '>') i++;
                if (i < text.length) i++;
                if (isClose) {
                    if (openTags.length > 0) openTags.pop();
                } else {
                    // 태그명: < 다음 첫 공백 또는 > 이전까지
                    var inner = text.substring(tagStart + 1, i - 1);
                    var tagName = inner.split(/[\s>]/)[0];
                    if (tagName) openTags.push(tagName);
                }
            } else {
                i++;
                visible++;
            }
        }
        // 아직 열린 태그들의 닫는 태그를 역순으로 보완
        var result = text.substring(0, i);
        for (var k = openTags.length - 1; k >= 0; k--) {
            result += '</' + openTags[k] + '>';
        }
        return result;
    }

    function countVisible(text) {
        var i = 0, count = 0;
        while (i < text.length) {
            var c = text[i];
            if (c === '\\') {
                i++;
                if (i < text.length) {
                    var n = text[i].toUpperCase();
                    if ('CNVI'.indexOf(n) >= 0 && i + 1 < text.length && text[i + 1] === '[') {
                        i += 2;
                        while (i < text.length && text[i] !== ']') i++;
                        if (i < text.length) i++;
                    } else { i++; }
                }
            } else if (c === '<') {
                while (i < text.length && text[i] !== '>') i++;
                if (i < text.length) i++;
            } else {
                i++; count++;
            }
        }
        return count;
    }

