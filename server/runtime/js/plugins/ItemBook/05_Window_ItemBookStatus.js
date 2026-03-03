    //=========================================================================
    // Window_ItemBookStatus — 오른쪽 상단 스탯
    //=========================================================================
    function Window_ItemBookStatus() { this.initialize.apply(this, arguments); }
    Window_ItemBookStatus.prototype = Object.create(Window_Base.prototype);
    Window_ItemBookStatus.prototype.constructor = Window_ItemBookStatus;

    Window_ItemBookStatus.prototype.initialize = function(x, y, width, height) {
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this._item     = null;
        this._showDesc = false;
        this.refresh();
    };

    Window_ItemBookStatus.prototype.setItem = function(item) {
        if (this._item !== item) {
            this._item = item;
            this.refresh();
        }
    };

    Window_ItemBookStatus.prototype.toggleView = function() {
        this._showDesc = !this._showDesc;
        this.refresh();
    };

    Window_ItemBookStatus.prototype.refresh = function() {
        var item = this._item;
        var lh   = this.lineHeight();
        var pad  = this.textPadding();
        var cw   = this.contents.width;
        var ch   = this.contents.height;
        this.contents.clear();

        // 하단 힌트 (아이템 유무와 상관없이 항상 표시)
        this._drawHint();

        if (!item || !$gameSystem.isInItemBook(item)) return;

        var x = pad, y = 0;
        var maxY = ch - lh * 2; // 힌트 영역 제외

        // 이름 + 아이콘
        this.drawItemName(item, x, y, cw - pad);
        y += lh;

        if (this._showDesc) {
            // ── 설명 모드 ──
            this.drawTextEx(item.description, x, y);
        } else {
            // ── 효과/스탯 모드 ──
            var col2 = Math.floor(cw / 2) + pad;

            // 가격
            this.changeTextColor(this.systemColor());
            this.drawText(priceText, x, y, 90);
            this.resetTextColor();
            this.drawText(item.price > 0 ? item.price : '-', x + 90, y, 60, 'right');

            if (DataManager.isWeapon(item) || DataManager.isArmor(item)) {
                // 장비 슬롯
                var etype = $dataSystem.equipTypes[item.etypeId];
                this.changeTextColor(this.systemColor());
                this.drawText(equipText, col2, y, 90);
                this.resetTextColor();
                this.drawText(etype || '-', col2 + 90, y, 110);
                y += lh;

                // 타입
                var typeName = DataManager.isWeapon(item)
                    ? $dataSystem.weaponTypes[item.wtypeId]
                    : $dataSystem.armorTypes[item.atypeId];
                this.changeTextColor(this.systemColor());
                this.drawText(typeText, x, y, 90);
                this.resetTextColor();
                this.drawText(typeName || '-', x + 90, y, 110);
                y += lh;

                // 파라미터 (ATK~LUK, 인덱스 2~7) — 2열
                for (var i = 2; i < 8; i++) {
                    var pi = i - 2;
                    var px = (pi % 2 === 0) ? x : col2;
                    var py = y + Math.floor(pi / 2) * lh;
                    this.changeTextColor(this.systemColor());
                    this.drawText(TextManager.param(i), px, py, 90);
                    this.resetTextColor();
                    this.drawText(item.params[i], px + 90, py, 50, 'right');
                }
            } else {
                // 일반 아이템 — 사용 효과 목록
                y += lh;
                var effects = item.effects || [];
                for (var ei = 0; ei < effects.length; ei++) {
                    if (y >= maxY) break;
                    var ef = this._parseEffect(effects[ei]);
                    if (ef) {
                        this.changeTextColor(this.systemColor());
                        this.drawText(ef.label, x, y, 110);
                        this.resetTextColor();
                        this.drawText(ef.value, x + 110, y, cw - x - 110 - pad);
                        y += lh;
                    }
                }
            }
        }
    };

    Window_ItemBookStatus.prototype._drawHint = function() {
        var lh  = this.lineHeight();
        var pad = this.textPadding();
        var cw  = this.contents.width;
        var ch  = this.contents.height;

        // 구분선
        var lineY = ch - lh * 2 + 4;
        this.contents.fillRect(pad, lineY, cw - pad * 2, 1, this.textColor(7));

        // 힌트 텍스트
        var hintText = this._showDesc ? '[ 결정 ]  효과 보기' : '[ 결정 ]  설명 보기';
        this.changeTextColor(this.textColor(7));
        this.drawText(hintText, pad, ch - lh, cw - pad * 2, 'right');
        this.resetTextColor();
    };

    // effect 코드 → {label, value} 변환
    Window_ItemBookStatus.prototype._parseEffect = function(effect) {
        var label, value, parts;
        switch (effect.code) {
        case 11: // HP 회복
            label = 'HP 회복';
            parts = [];
            if (effect.value1 !== 0) parts.push(Math.round(effect.value1 * 100) + '%');
            if (effect.value2 !== 0) parts.push((effect.value2 > 0 ? '+' : '') + effect.value2);
            value = parts.join(' + ') || '-';
            break;
        case 12: // MP 회복
            label = 'MP 회복';
            parts = [];
            if (effect.value1 !== 0) parts.push(Math.round(effect.value1 * 100) + '%');
            if (effect.value2 !== 0) parts.push((effect.value2 > 0 ? '+' : '') + effect.value2);
            value = parts.join(' + ') || '-';
            break;
        case 13: // TP 증가
            label = 'TP 증가';
            value = '+' + effect.value1;
            break;
        case 14: // 상태 부여
            label = '상태 부여';
            var st14 = $dataStates[effect.dataId];
            value = (st14 ? st14.name : '?') + ' ' + Math.round(effect.value1 * 100) + '%';
            break;
        case 15: // 상태 해제
            label = '상태 해제';
            var st15 = $dataStates[effect.dataId];
            value = st15 ? st15.name : '?';
            break;
        case 16: // 버프
            label = '버프';
            value = TextManager.param(effect.dataId);
            break;
        case 17: // 디버프
            label = '디버프';
            value = TextManager.param(effect.dataId);
            break;
        case 21: // 특수 (도주 등)
            label = '특수 효과';
            value = effect.dataId === 0 ? '도주' : String(effect.dataId);
            break;
        case 22: // 성장
            label = '성장';
            value = TextManager.param(effect.dataId) + ' +' + effect.value1;
            break;
        case 23: // 스킬 습득
            label = '스킬 습득';
            var sk = $dataSkills[effect.dataId];
            value = sk ? sk.name : '?';
            break;
        default:
            return null;
        }
        return { label: label, value: value };
    };

