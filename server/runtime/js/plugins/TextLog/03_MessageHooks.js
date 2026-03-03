    // =========================================================================
    // Window_Message 후킹 — 메시지 시작 시 로그에 기록
    // =========================================================================
    var _startMessage = Window_Message.prototype.startMessage;
    Window_Message.prototype.startMessage = function () {
        var txt = $gameMessage.allText();
        if (txt && txt.trim().length > 0) {
            // speakerName은 MV 1.6+ 또는 일부 플러그인에서만 존재
            var spk = (typeof $gameMessage.speakerName === 'function')
                        ? ($gameMessage.speakerName() || '') : '';
            var fn  = $gameMessage.faceName()   || '';
            var fi  = $gameMessage.faceIndex()  || 0;
            var bg  = $gameMessage.background() || 0;

            // 라인 수 추정 (이스케이프 코드 제거 후 줄 수)
            var stripped = txt
                .replace(/\x1b[A-Za-z]+\[[^\]]*\]/g, '')
                .replace(/\x1b./g, '');
            var lc = stripped.split('\n').length + (spk ? 1 : 0);

            TextLogManager.add({ spk: spk, txt: txt, fn: fn, fi: fi, bg: bg, lc: Math.max(lc, 1) });
        }
        _startMessage.call(this);
    };

    // =========================================================================
    // Window_ChoiceList 후킹 — 선택지 및 선택한 항목 로그 기록
    // =========================================================================

    // 선택지 창이 열릴 때 선택지 목록 기록
    var _choiceStart = Window_ChoiceList.prototype.start;
    Window_ChoiceList.prototype.start = function () {
        _choiceStart.call(this);
        var choices = $gameMessage.choices();
        if (choices && choices.length > 0) {
            var lines = choices.map(function (c) { return '  ' + c; });
            TextLogManager.add({
                type: 'choice',
                spk: '◆ 선택지',
                txt: lines.join('\n'),
                fn: '', fi: 0, bg: 0,
                lc: choices.length + 1
            });
        }
    };

    // 선택지 선택 완료 시 선택한 항목 기록
    var _choiceOk = Window_ChoiceList.prototype.processOk;
    Window_ChoiceList.prototype.processOk = function () {
        var choices  = $gameMessage.choices();
        var idx      = this.index();
        var selected = (choices && choices[idx] !== undefined) ? choices[idx] : null;
        _choiceOk.call(this);
        if (selected !== null) {
            TextLogManager.add({
                type: 'selected',
                spk: '',
                txt: '▷ ' + selected,
                fn: '', fi: 0, bg: 0,
                lc: 1
            });
        }
    };

