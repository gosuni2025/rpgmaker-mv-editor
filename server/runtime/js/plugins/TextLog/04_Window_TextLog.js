    // =========================================================================
    // Window_TextLog — 가상 스크롤 로그 창
    // =========================================================================
    function Window_TextLog() { this.initialize.apply(this, arguments); }
    Window_TextLog.prototype = Object.create(Window_Base.prototype);
    Window_TextLog.prototype.constructor = Window_TextLog;

    Window_TextLog.prototype.initialize = function (x, y, w, h) {
        Window_Base.prototype.initialize.call(this, x, y, w, h);
        this._etNoClearRect = true;  // gradient 재그리기 시 clearRect 방지 (배경 보존)
        this._sy      = 0;      // 현재 스크롤 Y
        this._layouts = [];     // 각 항목의 { y, h }
        this._total   = 0;      // 전체 콘텐츠 높이
        this._vel     = 0;      // 드래그 관성 속도
        this.refresh();
    };

    // 창 내부 표시 가능 높이
    Window_TextLog.prototype.innerH = function () {
        return this.height - this.standardPadding() * 2;
    };

    Window_TextLog.prototype.maxSY = function () {
        return Math.max(0, this._total - this.innerH());
    };

    // ── 항목 높이 계산 (calcTextHeight로 정확하게) ──────────────────────────
    Window_TextLog.prototype.entryH = function (e) {
        var hasFace = SHOW_FACE && e.fn;
        // escape code 변환 후 실제 줄 수를 calcTextHeight로 측정
        var converted  = this.convertEscapeCharacters(e.txt);
        var textState  = { index: 0, text: converted };
        var textH = this.calcTextHeight(textState, true);
        if (e.spk) textH += this.lineHeight();
        var height = textH + ENTRY_PAD * 2;
        if (hasFace) height = Math.max(height, FACE_SIZE + ENTRY_PAD * 2);
        return height;
    };

    // ── 레이아웃 빌드 (각 항목의 y 위치, h 계산) ────────────────────────────
    // 타이틀(TITLE_ITEM_H)은 스크롤 영역의 첫 부분으로 포함됨
    Window_TextLog.prototype.buildLayouts = function () {
        var list = TextLogManager.list();
        this._layouts = [];
        var y = ENTRY_GAP + TITLE_ITEM_H + ENTRY_GAP;
        for (var i = 0; i < list.length; i++) {
            var h = this.entryH(list[i]);
            this._layouts.push({ y: y, h: h });
            y += h + ENTRY_GAP;
        }
        this._total = Math.max(y, ENTRY_GAP + TITLE_ITEM_H + ENTRY_GAP);
    };

    // ── 새로고침 (레이아웃 재계산 + 맨 아래로 스크롤) ───────────────────────
    Window_TextLog.prototype.refresh = function () {
        this.buildLayouts();
        this._sy = this.maxSY();
        this.redraw();
    };

    // ── 현재 스크롤 위치에 보이는 항목만 렌더링 ─────────────────────────────
    Window_TextLog.prototype.redraw = function () {
        if (!this.contents) return;
        this.contents.clear();

        // 제목 (스크롤과 함께 이동 — 첫 라인으로 포함)
        var sbR    = (this._total > this.innerH()) ? SCROLLBAR_RESERVED : 0;
        var titleY = ENTRY_GAP - this._sy;
        if (titleY + TITLE_ITEM_H > 0 && titleY < this.contentsHeight()) {
            var titleW = this.contentsWidth() - sbR;
            var ty = titleY + Math.floor((TITLE_ITEM_H - this.lineHeight()) / 2);
            this.changeTextColor(this.systemColor());
            this.drawText(MENU_NAME, 0, ty, titleW, 'center');
            this.resetTextColor();
            this.resetFontSettings();
            // 구분선
            var ctx = this.contents._context;
            if (ctx) {
                ctx.save();
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, titleY + TITLE_ITEM_H - 2);
                ctx.lineTo(titleW, titleY + TITLE_ITEM_H - 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        var list = TextLogManager.list();
        var top  = this._sy;
        var bot  = this._sy + this.innerH();

        for (var i = 0; i < this._layouts.length; i++) {
            var l = this._layouts[i];
            if (l.y + l.h > top && l.y < bot) {
                this.drawEntry(list[i], l.y - this._sy, l.h);
            }
        }
        this.drawScrollBar();

        // ExtendedText가 drawTextEx 중 _etAnimSegs에 추가한 shake/hologram 세그먼트를 초기화.
        // 세그먼트는 그 시점의 y 좌표를 기억하므로, 스크롤 후 redraw하면 좌표가 달라져
        // 엉뚱한 위치에 흰 글자가 계속 흔들리며 남는 버그가 발생함.
        this._etAnimSegs  = [];
        this._etEffectStack = [];
    };

    // ── 스크롤바 ────────────────────────────────────────────────────────────
    Window_TextLog.prototype.drawScrollBar = function () {
        if (this._total <= this.innerH()) return;
        var bw    = 5;
        var bx    = this.contentsWidth() - bw - 1;
        var avail = this.innerH() - 8;
        var hh    = Math.max(24, avail * (this.innerH() / this._total));
        var ratio = this.maxSY() > 0 ? (this._sy / this.maxSY()) : 0;
        var hy    = 4 + (avail - hh) * ratio;
        this.contents.fillRect(bx, 4,  bw, avail, 'rgba(255,255,255,0.1)');
        this.contents.fillRect(bx, hy, bw, hh,    'rgba(255,255,255,0.55)');
    };

    // ── 항목 하나 렌더링 ─────────────────────────────────────────────────────
    Window_TextLog.prototype.drawEntry = function (e, dy, bh) {
        var sbR     = (this._total > this.innerH()) ? SCROLLBAR_RESERVED : 0;
        var w       = this.contentsWidth() - sbR;
        var hasFace = SHOW_FACE && e.fn;

        // 배경 박스 (선택지/선택 항목은 약간 다른 색)
        var alpha = BG_OPACITY / 255;
        if (e.type === 'choice') {
            this.contents.fillRect(0, dy, w, bh, 'rgba(20,40,80,' + (alpha * 0.9).toFixed(3) + ')');
        } else if (e.type === 'selected') {
            this.contents.fillRect(0, dy, w, bh, 'rgba(40,60,20,' + (alpha * 0.9).toFixed(3) + ')');
        } else {
            this.contents.fillRect(0, dy, w, bh, 'rgba(0,0,0,' + (alpha * 0.85).toFixed(3) + ')');
        }

        // 테두리 (canvas context 직접 접근)
        var ctx = this.contents._context;
        if (ctx) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth   = 1;
            ctx.strokeRect(0.5, dy + 0.5, w - 1, bh - 1);
            ctx.restore();
        }

        var tx = ENTRY_PAD;
        var tw = w - ENTRY_PAD * 2;

        if (hasFace) {
            var fy = dy + Math.floor((bh - FACE_SIZE) / 2);
            this.drawFace(e.fn, e.fi, tx, fy, FACE_SIZE, FACE_SIZE);
            tx += FACE_SIZE + 12;
            tw  = w - tx - ENTRY_PAD;
        }

        var cy = dy + ENTRY_PAD;

        // 화자 이름 (선택지 헤더 포함)
        if (e.spk) {
            this.changeTextColor(this.systemColor());
            this.drawText(e.spk, tx, cy, tw);
            this.resetTextColor();
            cy += this.lineHeight();
        }

        // 대사 텍스트 (escape code 포함 렌더링)
        this.drawTextEx(e.txt, tx, cy);
        this.resetFontSettings();
    };

    // ── update ──────────────────────────────────────────────────────────────
    Window_TextLog.prototype.update = function () {
        // ExtendedText.update가 _etAnimSegs 좌표로 그리기 전에 미리 비워서
        // 로그 창에서 shake/hologram 애니메이션이 잘못된 위치에 그려지지 않도록 억제
        this._etAnimSegs    = [];
        this._etEffectStack = [];
        Window_Base.prototype.update.call(this);
        this._handleKeyScroll();
        this._handleInertia();
    };

    Window_TextLog.prototype._handleKeyScroll = function () {
        var lh   = this.lineHeight();
        var ph   = Math.floor(this.innerH() * 0.9);
        var max  = this.maxSY();
        var prev = this._sy;
        if (Input.isRepeated('up'))        this._sy -= lh;
        if (Input.isRepeated('down'))      this._sy += lh;
        if (Input.isTriggered('pageup'))   this._sy -= ph;
        if (Input.isTriggered('pagedown')) this._sy += ph;
        this._sy = Math.max(0, Math.min(this._sy, max));
        if (this._sy !== prev) this.redraw();
    };

    Window_TextLog.prototype._handleInertia = function () {
        if (Math.abs(this._vel) < 0.5) { this._vel = 0; return; }
        var prev = this._sy;
        this._sy = Math.max(0, Math.min(this._sy + this._vel, this.maxSY()));
        this._vel *= 0.88;
        if (this._sy !== prev) this.redraw();
        if (this._sy <= 0 || this._sy >= this.maxSY()) this._vel = 0;
    };

    // Scene에서 휠/드래그 값을 주입하는 인터페이스
    Window_TextLog.prototype.scrollBy = function (dy) {
        var prev = this._sy;
        this._sy = Math.max(0, Math.min(this._sy + dy, this.maxSY()));
        if (this._sy !== prev) this.redraw();
    };

