    //=========================================================================
    // 배틀러 고유 키
    //=========================================================================
    Sprite_TurnOrderBar.prototype._bKey = function (battler) {
        return battler.isActor() ? 'a' + battler.actorId() : 'e' + battler.index();
    };

    //=========================================================================
    // 아이콘 동기화
    //
    // 핵심 원칙:
    //   1. 기존 'cur' 항목 재사용 (변경 없음)
    //   2. 기존 'next' 항목을 'cur'로 승격 (새 아이콘 생성 없음 → 슬라이드 없음)
    //   3. 남은 경우에만 새 아이콘 생성
    //   4. next 항목: 기존 재사용, 없으면 신규 (오른쪽에서 슬라이드 인)
    //=========================================================================
    Sprite_TurnOrderBar.prototype._syncIcons = function (order) {
        var isH  = Config.direction === 'horizontal';
        var self = this;

        // 기존 엔트리를 (bKey, role) 기준으로 분류
        var oldCur  = {};  // bKey → entry
        var oldNext = {};  // bKey → entry
        this._iconEntries.forEach(function (e) {
            var k = self._bKey(e.b);
            if (e.role === 'cur')  oldCur[k]  = e;
            else                   oldNext[k] = e;
        });

        var newEntries = [];
        var sc_next = Config.nextScale;

        // ── cur 아이콘 처리 ──
        // 기존 cur 재사용 → 없으면 기존 next 승격 (이동 애니만, 새 아이콘 아님) → 없으면 신규
        order.curOrder.forEach(function (b) {
            var s   = b === order.curSubject ? 'active' :
                      (order.curPending.indexOf(b) >= 0 ? 'pending' : 'done');
            var k   = self._bKey(b);
            var entry;

            if (oldCur[k]) {
                // 기존 cur 항목 재사용
                entry = oldCur[k];
                delete oldCur[k];
                entry.ic.setStatus(s);
                entry.ic.scale.x = 1.0; entry.ic.scale.y = 1.0;

            } else if (oldNext[k]) {
                // next → cur 승격: 아이콘 재사용, 위치는 lerp로 자연스럽게 이동
                entry = oldNext[k];
                delete oldNext[k];
                entry.role = 'cur';
                entry.ic.setStatus(s);
                // scale은 즉시 변경 (위치 lerp로 자연스러운 전환 느낌)
                entry.ic.scale.x = 1.0; entry.ic.scale.y = 1.0;

            } else {
                // 신규 생성 (배틀 중간에 소환 등 예외 케이스)
                var ic = new Sprite_TurnOrderIcon(b);
                ic.setStatus(s);
                ic.opacity = 0;
                ic._isNew  = true;
                ic.scale.x = 1.0; ic.scale.y = 1.0;
                self.addChild(ic);
                entry = { b: b, ic: ic, role: 'cur' };
            }
            newEntries.push(entry);
        });

        // ── next 아이콘 처리 ──
        // 기존 next 재사용 (cur 승격에서 사용되지 않은 것) → 없으면 신규
        order.next.forEach(function (b) {
            var k   = self._bKey(b);
            var entry;

            if (oldNext[k]) {
                // 기존 next 재사용
                entry = oldNext[k];
                delete oldNext[k];
                entry.ic.setStatus('next');
                entry.ic.scale.x = sc_next; entry.ic.scale.y = sc_next;

            } else {
                // 신규 생성 (next→cur 승격 이후 새 next 슬롯)
                var ic = new Sprite_TurnOrderIcon(b);
                ic.setStatus('next');
                ic.opacity = 0;
                ic._isNew  = true;
                ic.scale.x = sc_next; ic.scale.y = sc_next;
                self.addChild(ic);
                entry = { b: b, ic: ic, role: 'next' };
            }
            newEntries.push(entry);
        });

        // ── 남은 old 항목 처리 ──
        // curOrder에서 빠진 cur 아이콘: 살아있으면 done 유지, 죽었으면 퇴장
        var k;
        for (k in oldCur) {
            var oe = oldCur[k];
            if (oe.b.isAlive && oe.b.isAlive()) {
                oe.ic.setStatus('done');
                oe.ic.scale.x = 1.0; oe.ic.scale.y = 1.0;
                newEntries.push(oe);
            } else {
                oe.ic.startExit(isH);
                self._exitingIcons.push(oe.ic);
            }
        }
        for (k in oldNext) { oldNext[k].ic.startExit(isH); self._exitingIcons.push(oldNext[k].ic); }

        self._iconEntries = newEntries;

        // 구분선·인디케이터를 최상위로
        self.removeChild(self._divSprite);
        self.removeChild(self._indSprite);
        self.addChild(self._divSprite);
        self.addChild(self._indSprite);
    };

    // role 포함 검색
    Sprite_TurnOrderBar.prototype._findEntry = function (battler, role) {
        for (var i = 0; i < this._iconEntries.length; i++) {
            var e = this._iconEntries[i];
            if (e.b === battler && e.role === role) return e;
        }
        return null;
    };

    //=========================================================================
    // 상태 동기화 (매 프레임, role 기반)
    //=========================================================================
    Sprite_TurnOrderBar.prototype._updateIconStatuses = function () {
        var subject = BattleManager._subject;

        this._iconEntries.forEach(function (e) {
            if (e.role === 'next') {
                if (e.ic._status !== 'next') e.ic.setStatus('next');
                return;
            }
            // cur role
            var b = e.b;
            if (b === subject) {
                if (e.ic._status !== 'active') e.ic.setStatus('active');
            } else if (_doneThisTurn.indexOf(b) >= 0) {
                // 이번 턴에 행동 완료 → 반투명 유지 (phase 무관)
                // inTurn 조건을 제거해야 input phase에서도 done이 유지됨
                if (e.ic._status !== 'done') e.ic.setStatus('done');
            } else {
                if (e.ic._status !== 'pending') e.ic.setStatus('pending');
            }
        });
    };

    //=========================================================================
    // 레이아웃
    //=========================================================================
    Sprite_TurnOrderBar.prototype._updateLayout = function () {
        var order = this._order;
        var isH   = Config.direction === 'horizontal';
        if (isH) this._layoutH(order.curOrder, order.next);
        else     this._layoutV(order.curOrder, order.next);
    };

    Sprite_TurnOrderBar.prototype._layoutH = function (curList, nextList) {
        var size = Config.iconSize, gap = Config.gap;
        var nSz  = Math.round(size * Config.nextScale);
        var lw   = Config.dividerWidth, dg = Config.dividerGap;
        var dBSz = lw > 0 ? lw + 8 : 0;
        var hasDiv = lw > 0 && curList.length > 0 && nextList.length > 0;

        var curW  = curList.length  > 0 ? curList.length  * (size + gap) - gap : 0;
        var nxtW  = nextList.length > 0 ? nextList.length * (nSz  + gap) - gap : 0;
        var midW  = hasDiv
            ? dg + dBSz + dg
            : (curList.length > 0 && nextList.length > 0 ? gap : 0);
        var total = curW + midW + nxtW;

        var sx = this._startX(total);
        var cy = this._centerY(size);
        var x  = sx;

        curList.forEach(function (b) {
            var e = this._findEntry(b, 'cur'); if (!e) return;
            this._setTarget(e.ic, x + Math.round(size / 2), cy, true);
            x += size + gap;
        }, this);

        if (hasDiv) {
            x += dg - gap;
            this._divSprite.x = x + Math.round(dBSz / 2);
            this._divSprite.y = cy;
            x += dBSz + dg;
        } else {
            this._divSprite.x = -999;
        }

        nextList.forEach(function (b) {
            var e = this._findEntry(b, 'next'); if (!e) return;
            this._setTarget(e.ic, x + Math.round(nSz / 2), cy, true);
            x += nSz + gap;
        }, this);

        this._redrawBackground(sx - 10, cy - Math.round(size / 2) - 9, total + 20, size + 18);
    };

    Sprite_TurnOrderBar.prototype._layoutV = function (curList, nextList) {
        var size = Config.iconSize, gap = Config.gap;
        var nSz  = Math.round(size * Config.nextScale);
        var lw   = Config.dividerWidth, dg = Config.dividerGap;
        var dBSz = lw > 0 ? lw + 8 : 0;
        var hasDiv = lw > 0 && curList.length > 0 && nextList.length > 0;

        var curH  = curList.length  > 0 ? curList.length  * (size + gap) - gap : 0;
        var nxtH  = nextList.length > 0 ? nextList.length * (nSz  + gap) - gap : 0;
        var midH  = hasDiv
            ? dg + dBSz + dg
            : (curList.length > 0 && nextList.length > 0 ? gap : 0);
        var total = curH + midH + nxtH;

        var cx = this._centerX(size);
        var sy = this._startY(total);
        var y  = sy;

        curList.forEach(function (b) {
            var e = this._findEntry(b, 'cur'); if (!e) return;
            this._setTarget(e.ic, cx, y + Math.round(size / 2), false);
            y += size + gap;
        }, this);

        if (hasDiv) {
            y += dg - gap;
            this._divSprite.x = cx;
            this._divSprite.y = y + Math.round(dBSz / 2);
            y += dBSz + dg;
        } else {
            this._divSprite.x = -999;
        }

        nextList.forEach(function (b) {
            var e = this._findEntry(b, 'next'); if (!e) return;
            this._setTarget(e.ic, cx, y + Math.round(nSz / 2), false);
            y += nSz + gap;
        }, this);

        this._redrawBackground(cx - Math.round(size / 2) - 9, sy - 10, size + 18, total + 20);
    };

    // _isNew인 아이콘: 항상 즉시 배치 (슬라이드 없음)
    // 단, 배틀 중간에 새로 생긴 경우(_isNew && frame > 10)만 오른쪽에서 슬라이드
    Sprite_TurnOrderBar.prototype._setTarget = function (ic, tx, ty, isH) {
        if (ic._exiting) return;
        if (ic._isNew) {
            ic._isNew = false;
            if (this._frame <= 4) {
                // 첫 배치: 즉시 표시
                ic.x = tx; ic.y = ty; ic.opacity = 255;
            } else {
                // 배틀 중 추가 (next→cur 승격 후 새 next 등): 오른쪽/아래에서 슬라이드 인
                ic.x = isH ? tx + Config.iconSize * 3 : tx;
                ic.y = isH ? ty : ty + Config.iconSize * 3;
                ic.opacity = 0;
            }
        }
        ic._targetX = tx;
        ic._targetY = ty;
    };

    //=========================================================================
    // 인디케이터 위치
    //=========================================================================
    Sprite_TurnOrderBar.prototype._updateIndicatorPos = function () {
        if (Config.indicatorStyle === 'none') return;
        var activeIc = null;
        for (var i = 0; i < this._iconEntries.length; i++) {
            var e = this._iconEntries[i];
            if (e.role === 'cur' && e.ic._status === 'active' && !e.ic._exiting) {
                activeIc = e.ic; break;
            }
        }
        if (!activeIc) { this._indSprite.visible = false; return; }

        var isH  = Config.direction === 'horizontal';
        var half = Math.round(Config.iconSize / 2);
        var pad  = 3;
        this._indSprite.visible = true;
        this._indSprite.x = isH ? activeIc.x : activeIc.x - half - pad;
        this._indSprite.y = isH ? activeIc.y - half - pad : activeIc.y;
    };

    //=========================================================================
    // 퇴장 아이콘 정리
    //=========================================================================
    Sprite_TurnOrderBar.prototype._cleanExiting = function () {
        this._exitingIcons = this._exitingIcons.filter(function (ic) {
            if (ic._exitDone) { this.removeChild(ic); return false; }
            return true;
        }, this);
    };

