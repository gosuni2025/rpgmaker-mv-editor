    // =========================================================================
    // Window_VNText
    // =========================================================================
    function Window_VNText() { this.initialize.apply(this, arguments); }
    Window_VNText.prototype = Object.create(Window_Base.prototype);
    Window_VNText.prototype.constructor = Window_VNText;

    Window_VNText.prototype.initialize = function () {
        Window_Base.prototype.initialize.call(this, TEXT_AREA_X, TEXT_AREA_Y, TEXT_AREA_W, TEXT_AREA_H);
        this.opacity     = 0;
        this.backOpacity = 0;
        this.openness    = 255;  // pause sign 표시를 위해 isOpen()=true로 유지
        this._entries    = [];
        this._layouts    = [];
        this._totalH     = 0;
        this._scrollY    = 0;
        this._vel        = 0;
        this._touchPrevY = null;

        // 타이프라이터 상태
        this._isTyping    = false;
        this._typeSpk     = '';
        this._typeFull    = '';   // 전체 raw 텍스트
        this._typeTotal   = 0;   // 총 visible 글자 수
        this._typeShown   = 0;   // 현재 표시된 visible 글자 수
        this._typeEntryIdx = -1;

        // 인라인 선택지 상태
        this._choiceActive  = false;
        this._choiceIndex   = 0;
        this._cancelIndex   = -1;
        this._choiceResult  = -1;

        // 타이핑 중 선택지 pending 상태
        this._pendingChoiceIdx     = -1;
        this._pendingChoiceDefault = 0;
        this._pendingCancelIdx     = -1;

        this.contents.clear();

        // pause sign sprite: transparent:false(3D모드)에선 opacity 제어가 안 됨 → 패치
        var ps = this._windowPauseSignSprite;
        if (ps && ps._threeObj && ps._threeObj.material) {
            ps._threeObj.material.transparent = true;
            ps._threeObj.material.alphaTest   = 0;
            ps._threeObj.material.needsUpdate = true;
        }
    };

    // Three.js에서 transparent:false면 alpha 변화가 시각 효과 없음.
    // pause=false일 때 visible=false로 숨기고, pause=true일 때만 표시.
    Window_VNText.prototype._updatePauseSign = function () {
        Window.prototype._updatePauseSign.call(this);
        var sp = this._windowPauseSignSprite;
        if (sp) sp.visible = this.pause && this.isOpen();
    };

    // ── 타이프라이터로 텍스트 추가 ────────────────────────────────────────────
    Window_VNText.prototype.startTyping = function (spk, txt) {
        // 이전 타이핑이 있으면 즉시 완료
        if (this._isTyping) this.skipTyping();

        this._typeSpk   = spk;
        this._typeFull  = txt;
        this._typeTotal = countVisible(txt);
        this._typeShown = 0;
        this._isTyping  = true;

        // entries에 빈 항목 먼저 추가 (점점 채워짐)
        this._entries.push({ spk: spk, txt: '' });
        this._typeEntryIdx = this._entries.length - 1;

        this._vel = 0;
        this._rebuildAndScroll();
    };

    // 타이핑 즉시 완료
    Window_VNText.prototype.skipTyping = function () {
        if (!this._isTyping) return;
        this._entries[this._typeEntryIdx].txt = this._typeFull;
        this._isTyping = false;
        this._vel = 0;
        this._rebuildAndScroll();
    };

    // 직접 즉시 추가 (선택 결과 등)
    Window_VNText.prototype.addEntry = function (spk, txt) {
        if (this._isTyping) this.skipTyping();
        this._entries.push({ spk: spk, txt: txt });
        this._vel = 0;
        this._rebuildAndScroll();
    };

    // 인라인 선택지 추가
    Window_VNText.prototype.addChoiceEntry = function (choices, defaultIdx, cancelIdx) {
        this._forceOk = false;  // 이전 메시지에서 남은 forceOk 리셋 (선택지 이후 메시지 자동진행 방지)
        // TextLog에 선택지 목록 기록
        if (window.TextLogManager && choices && choices.length > 0) {
            var lines = choices.map(function (c) { return '  ' + c; });
            window.TextLogManager.add({
                type: 'choice',
                spk: '◆ 선택지',
                txt: lines.join('\n'),
                fn: '', fi: 0, bg: 0,
                lc: choices.length + 1
            });
        }
        if (this._isTyping) {
            // 타이핑 중: skipTyping 없이 pending으로 저장 → 타이핑 완료 후 활성화
            // (타이핑 효과를 유지하면서 텍스트가 끝난 후 선택지가 자연스럽게 나타남)
            this._entries.push({ type: 'choice', choices: choices, sel: defaultIdx >= 0 ? defaultIdx : 0, cancelIndex: cancelIdx, _pending: true });
            this._pendingChoiceIdx     = this._entries.length - 1;
            this._pendingChoiceDefault = defaultIdx >= 0 ? defaultIdx : 0;
            this._pendingCancelIdx     = cancelIdx;
            this._vel = 0;
            this._buildLayouts();
            this._scrollY = this._maxScrollY();
            this._redraw();
            return;
        }
        this._entries.push({ type: 'choice', choices: choices, sel: defaultIdx, cancelIndex: cancelIdx });
        this._choiceActive = true;
        this._choiceIndex  = (defaultIdx >= 0) ? defaultIdx : 0;
        this._cancelIndex  = cancelIdx;
        this._choiceResult = -1;
        this._choiceInputDelay = 3;  // 선택지 추가 직후 3프레임간 입력 무시 (즉시 확정 방지)
        this._vel = 0;
        // 항상 맨 아래로 강제 이동 (선택지가 화면 밖으로 밀리지 않도록)
        this._buildLayouts();
        this._scrollY = this._maxScrollY();
        this._redraw();
    };

    // pending 선택지 활성화 (타이핑 완료 시 호출)
    Window_VNText.prototype._activatePendingChoice = function () {
        if (this._pendingChoiceIdx < 0) return;
        var e = this._entries[this._pendingChoiceIdx];
        if (!e || e.type !== 'choice') { this._pendingChoiceIdx = -1; return; }
        e._pending = false;
        this._choiceActive     = true;
        this._choiceIndex      = this._pendingChoiceDefault;
        this._cancelIndex      = this._pendingCancelIdx;
        this._choiceResult     = -1;
        this._choiceInputDelay = 3;
        this._pendingChoiceIdx = -1;
        this._vel = 0;
        this._buildLayouts();
        this._scrollY = this._maxScrollY();
        this._redraw();
    };

    // pending 상태(타이핑 완료 대기)도 "선택 중"으로 간주 → _updateVNInline 자동선택 방지
    Window_VNText.prototype.isChoiceActive  = function () { return this._choiceActive || this._pendingChoiceIdx >= 0; };
    Window_VNText.prototype.getChoiceResult = function () { return this._choiceResult; };

    // ── 레이아웃 빌드 ─────────────────────────────────────────────────────────
    Window_VNText.prototype._buildLayouts = function () {
        var lh = this.lineHeight();
        this._layouts = [];
        var y = ENTRY_GAP;
        for (var i = 0; i < this._entries.length; i++) {
            var e = this._entries[i];
            var h;
            if (e.type === 'choice') {
                h = e._pending ? 0 : (e.choices.length * lh + ENTRY_PAD * 2);
            } else {
                var conv = this.convertEscapeCharacters(e.txt || '');
                var ts   = { index: 0, text: conv };
                h = this.calcTextHeight(ts, true) + ENTRY_PAD;
                if (e.spk) h += lh;
            }
            this._layouts.push({ y: y, h: h });
            y += h + ENTRY_GAP;
        }
        this._totalH = y;
    };

    Window_VNText.prototype._innerH    = function () { return this.height - this.standardPadding() * 2; };
    Window_VNText.prototype._innerW    = function () { return this.width  - this.standardPadding() * 2; };
    Window_VNText.prototype._maxScrollY = function () { return Math.max(0, this._totalH - this._innerH()); };

    Window_VNText.prototype._rebuildAndScroll = function () {
        this._vel = 0;
        var wasAtBottom = (this._maxScrollY() <= 0) || (this._scrollY >= this._maxScrollY() - 2);
        this._buildLayouts();
        if (wasAtBottom) this._scrollY = this._maxScrollY();
        this._redraw();
    };

    // ── 렌더링 ──────────────────────────────────────────────────────────────
    // 세그먼트 고유 키 생성 (이펙트 타입 + 엔트리 인덱스)
    // 엔트리 인덱스 기반으로 매칭하므로 타이핑 중 chars가 바뀌어도 올바르게 복원됨
    // 스크롤로 뷰포트 밖 텍스트 여부가 달라져도 엔트리 인덱스로 구분되어 오매칭 방지
    function _etSegKey(seg) {
        var type = seg.shakeActive ? 'S' : seg.hologramActive ? 'H' :
            seg.gradientWaveActive ? 'GW' : seg.gradientActive ? 'G' :
            seg.fadeActive ? 'F' : seg.dissolveActive ? 'D' : seg.blurFadeActive ? 'BF' : '?';
        // _entryIdx가 있으면 엔트리 기반 키 (정상 경로)
        if (seg._entryIdx !== undefined) {
            return type + ':e' + seg._entryIdx;
        }
        // fallback: 세그먼트 생성 직후 아직 태그 전 (chars 기반)
        return type + ':' + (seg.chars || []).map(function(ch){ return ch.c; }).join('');
    }

    Window_VNText.prototype._redraw = function () {
        if (!this.contents) return;

        // 기존 세그먼트의 시간 상태를 텍스트+이펙트 키 기반으로 보존 (스크롤 시 애니메이션 재시작 방지)
        // 인덱스 기반 매칭은 뷰포트 밖 텍스트 여부에 따라 순서가 달라져 오작동하므로 키 기반 사용
        var prevMap = {};
        (this._etAnimSegs || []).forEach(function (seg) {
            var key = _etSegKey(seg);
            if (!prevMap[key]) prevMap[key] = [];
            prevMap[key].push({
                startTime:        seg.startTime,
                overlayStartTime: seg._overlayStartTime,
                etFrozen:         seg._etFrozen,
            });
        });
        var keyCounters = {};

        this._etClearAllOverlays();
        this.contents.clear();
        var top = this._scrollY;
        var bot = this._scrollY + this._innerH();
        var lh  = this.lineHeight();
        var iw  = this._innerW();

        for (var i = 0; i < this._layouts.length; i++) {
            var l = this._layouts[i];
            if (l.y + l.h < top || l.y > bot) continue;
            var dy = l.y - this._scrollY;
            var e  = this._entries[i];
            var segsBefore = (this._etAnimSegs || []).length;
            if (e.type === 'choice') {
                if (e._pending) continue;  // 타이핑 완료 전엔 그리지 않음
                var activeSel = (i === this._entries.length - 1 && this._choiceActive)
                    ? this._choiceIndex : (e.sel !== undefined ? e.sel : -1);
                this._drawChoiceEntry(e, dy, lh, iw, activeSel);
            } else {
                this._drawTextEntry(e, dy, lh, iw);
            }
            // 이 엔트리에서 생성된 세그먼트에 엔트리 인덱스 태그 (키 매칭용)
            var curSegs = this._etAnimSegs || [];
            for (var s = segsBefore; s < curSegs.length; s++) {
                curSegs[s]._entryIdx = i;
            }
        }

        if (SHOW_SCROLL_BAR) this._drawScrollBar();

        // 키 기반으로 startTime / _overlayStartTime 복원
        var segs = this._etAnimSegs || [];
        for (var j = 0; j < segs.length; j++) {
            var key = _etSegKey(segs[j]);
            if (!keyCounters[key]) keyCounters[key] = 0;
            var cnt = keyCounters[key]++;
            var prev = prevMap[key] && prevMap[key][cnt];
            if (prev) {
                if (prev.startTime !== undefined)
                    segs[j].startTime = prev.startTime;
                if (prev.overlayStartTime !== undefined)
                    segs[j]._overlayStartTime = prev.overlayStartTime;
                if (prev.etFrozen !== undefined)
                    segs[j]._etFrozen = prev.etFrozen;
            }
        }
    };

    Window_VNText.prototype._drawTextEntry = function (e, dy, lh, iw) {
        var cy = dy + ENTRY_PAD;
        if (e.spk) {
            var prev = this.contents.textColor;
            this.contents.textColor = SPEAKER_COLOR;
            this.drawText(e.spk, 0, cy, iw);
            this.contents.textColor = prev;
            cy += lh;
        }
        this.drawTextEx(e.txt || '', 0, cy);
        this.resetFontSettings();
    };

    Window_VNText.prototype._drawChoiceEntry = function (e, dy, lh, iw, activeSel) {
        for (var j = 0; j < e.choices.length; j++) {
            var cy     = dy + ENTRY_PAD + j * lh;
            var isCur  = (activeSel === j);
            var prefix = isCur ? (CHOICE_IND + ' ') : '  ';
            this.contents.textColor = isCur ? '#ffffff' : '#999999';
            this.drawText(prefix + e.choices[j], 0, cy, iw);
        }
        this.contents.textColor = '#ffffff';
        this.resetFontSettings();
    };

    Window_VNText.prototype._drawScrollBar = function () {
        var innerH = this._innerH();
        if (this._totalH <= innerH) return;
        var bw    = 4;
        var bx    = this.contentsWidth() - bw - 1;
        var avail = innerH - 8;
        var hh    = Math.max(20, avail * (innerH / this._totalH));
        var ratio = this._maxScrollY() > 0 ? (this._scrollY / this._maxScrollY()) : 0;
        var hy    = 4 + (avail - hh) * ratio;
        this.contents.fillRect(bx, 4,  bw, avail, 'rgba(255,255,255,0.1)');
        this.contents.fillRect(bx, hy, bw, hh,    'rgba(255,255,255,0.5)');
    };

    // ── 스크롤 ───────────────────────────────────────────────────────────────
    Window_VNText.prototype.scrollBy = function (dy) {
        var prev = this._scrollY;
        this._scrollY = Math.max(0, Math.min(this._scrollY + dy, this._maxScrollY()));
        if (this._scrollY !== prev) this._redraw();
    };

    // ── 선택지 조작 ──────────────────────────────────────────────────────────
    Window_VNText.prototype.moveChoiceUp = function () {
        if (!this._choiceActive) return;
        var last = this._entries[this._entries.length - 1];
        if (!last || last.type !== 'choice') return;
        this._choiceIndex = (this._choiceIndex - 1 + last.choices.length) % last.choices.length;
        SoundManager.playCursor();
        this._redraw();
    };

    Window_VNText.prototype.moveChoiceDown = function () {
        if (!this._choiceActive) return;
        var last = this._entries[this._entries.length - 1];
        if (!last || last.type !== 'choice') return;
        this._choiceIndex = (this._choiceIndex + 1) % last.choices.length;
        SoundManager.playCursor();
        this._redraw();
    };

    Window_VNText.prototype.confirmChoice = function () {
        if (!this._choiceActive) return;
        var last = this._entries[this._entries.length - 1];
        if (!last || last.type !== 'choice') return;
        SoundManager.playOk();
        last.sel           = this._choiceIndex;
        this._choiceResult = this._choiceIndex;
        this._choiceActive = false;
        var txt = last.choices[this._choiceResult] || '';
        this._entries.push({ spk: '', txt: '  ' + CHOICE_IND + ' ' + txt, _choiceLog: txt });
        this._vel = 0;
        this._rebuildAndScroll();
    };

    Window_VNText.prototype.cancelChoice = function () {
        if (!this._choiceActive || this._cancelIndex < 0) return;
        var last = this._entries[this._entries.length - 1];
        if (!last || last.type !== 'choice') return;
        SoundManager.playCancel();
        last.sel           = this._cancelIndex;
        this._choiceResult = this._cancelIndex;
        this._choiceActive = false;
        var txt = (this._cancelIndex < last.choices.length) ? last.choices[this._cancelIndex] : '(취소)';
        this._entries.push({ spk: '', txt: '  ' + CHOICE_IND + ' ' + txt, _choiceLog: txt });
        this._vel = 0;
        this._rebuildAndScroll();
    };

    Window_VNText.prototype._handleChoiceTouch = function () {
        if (!this._choiceActive) return;
        var idx = this._entries.length - 1;
        if (idx < 0) return;
        var l = this._layouts[idx];
        var e = this._entries[idx];
        if (!l || !e || e.type !== 'choice') return;
        var lh   = this.lineHeight();
        var pad  = this.standardPadding();
        var baseY = this.y + pad + l.y - this._scrollY + ENTRY_PAD;
        var ty = TouchInput.y;
        var tx = TouchInput.x;
        if (tx < this.x || tx > this.x + this.width) return;
        for (var j = 0; j < e.choices.length; j++) {
            var cy = baseY + j * lh;
            if (ty >= cy && ty < cy + lh) {
                if (this._choiceIndex === j) { this.confirmChoice(); }
                else { this._choiceIndex = j; SoundManager.playCursor(); this._redraw(); }
                return;
            }
        }
    };

    // Window_Message를 다음 메시지로 진행
    // _forceOk 플래그를 세워 isTriggered()가 1회 true 반환하도록 함.
    // 원본 updateInput() 흐름:
    //   pause=true 시 isTriggered()=true → pause=false, !_textState → terminateMessage()
    // 주의: mw.pause가 아직 false일 수 있음 (창이 isOpening() 상태이면 updateMessage가
    //   실행되지 않아 onEndOfText/startPause가 아직 호출되지 않은 것).
    //   이 경우 _forceOk=true를 미리 설정해두면, pause가 true가 되는 순간
    //   updateInput()에서 isTriggered()=true를 반환하여 자동으로 처리됨.
    Window_VNText.prototype._sendOkToMessage = function () {
        var s  = SceneManager._scene;
        var mw = s && s._messageWindow;
        if (!mw) return;
        this.pause = false;  // 입력 완료 → pause sign 숨김
        this._forceOk = true;
    };

    // ── update ───────────────────────────────────────────────────────────────
    Window_VNText.prototype.update = function () {
        // 타이핑 진행 + _redraw()를 먼저 수행하여 세그먼트를 수집한 뒤,
        // Window_Base.update() → _etRunAnimPass()가 최신 세그먼트로 오버레이를 생성하도록 함.
        // (순서가 반대이면 오버레이 생성 직후 같은 프레임에 _redraw()가 dispose하여 효과가 안 보임)
        if (this._isTyping) {
            this._typeShown++;
            if (this._typeShown >= this._typeTotal) {
                // 완료
                this._entries[this._typeEntryIdx].txt = this._typeFull;
                this._isTyping = false;
            } else {
                this._entries[this._typeEntryIdx].txt = sliceRaw(this._typeFull, this._typeShown);
            }
            this._buildLayouts();
            this._scrollY = this._maxScrollY();  // 항상 맨 아래 추적
            this._redraw();
        }

        Window_Base.prototype.update.call(this);

        // Three.js 런타임에서 Window.updateTransform()이 호출되지 않으므로
        // pause sign 애니메이션을 직접 구동
        this._updatePauseSign();

        // 입력 처리
        if (this._choiceActive) {
            // 선택지 추가 직후 입력 딜레이 (이전 클릭이 즉시 확정되는 것 방지)
            if (this._choiceInputDelay > 0) {
                this._choiceInputDelay--;
            } else {
            // 선택지 모드
            if (Input.isRepeated('up'))      this.moveChoiceUp();
            if (Input.isRepeated('down'))    this.moveChoiceDown();
            if (Input.isTriggered('ok'))     this.confirmChoice();
            if (Input.isTriggered('cancel')) this.cancelChoice();
            if (TouchInput.isTriggered())    this._handleChoiceTouch();
            }
        } else {
            // 타이핑 중 또는 완료 후 클릭/OK
            var triggered = Input.isTriggered('ok') || TouchInput.isTriggered();
            if (triggered) {
                if (this._isTyping) {
                    this.skipTyping();  // 타이핑 즉시 완료
                } else {
                    this._sendOkToMessage();  // 다음 메시지로 진행
                }
            }
            // 스크롤 (선택지 없을 때만)
            this._handleInertia();
            this._handleTouchScroll();
        }
    };

    Window_VNText.prototype._handleInertia = function () {
        if (Math.abs(this._vel) < 0.5) { this._vel = 0; return; }
        this.scrollBy(this._vel);
        this._vel *= 0.88;
        if (this._scrollY <= 0 || this._scrollY >= this._maxScrollY()) this._vel = 0;
    };

    Window_VNText.prototype._handleTouchScroll = function () {
        if (TouchInput.isPressed()) {
            if (this._touchPrevY !== null) {
                var dy = this._touchPrevY - TouchInput.y;
                if (Math.abs(dy) > 2) {
                    this.scrollBy(dy);
                    this._vel = dy;
                }
            }
            this._touchPrevY = TouchInput.y;
        } else {
            this._touchPrevY = null;
        }
    };

