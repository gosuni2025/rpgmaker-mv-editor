    //=========================================================================
    // Sprite_TurnOrderBar
    //=========================================================================
    function Sprite_TurnOrderBar() {
        this.initialize.apply(this, arguments);
    }
    Sprite_TurnOrderBar.prototype = Object.create(Sprite.prototype);
    Sprite_TurnOrderBar.prototype.constructor = Sprite_TurnOrderBar;

    Sprite_TurnOrderBar.prototype.initialize = function () {
        Sprite.prototype.initialize.call(this);
        // entry: { b: battler, ic: Sprite_TurnOrderIcon, role: 'cur'|'next' }
        this._iconEntries  = [];
        this._exitingIcons = [];
        this._orderKey     = '';
        this._configKey    = '';
        this._frame        = 0;

        this._bgBitmap = new Bitmap(Graphics.width, Graphics.height);
        this._bgSprite = new Sprite(this._bgBitmap);
        this.addChild(this._bgSprite);

        this._overlayBitmap = new Bitmap(Graphics.width, Graphics.height);
        this._overlaySprite = new Sprite(this._overlayBitmap);
        this.addChild(this._overlaySprite);

        this._divSprite = new Sprite();
        this._divSprite.anchor.x = 0.5;
        this._divSprite.anchor.y = 0.5;
        this.addChild(this._divSprite);

        this._indSprite = new Sprite();
        this._indSprite.visible = false;
        this.addChild(this._indSprite);
    };

    //=========================================================================
    // 매 프레임 업데이트
    //=========================================================================
    Sprite_TurnOrderBar.prototype.update = function () {
        Sprite.prototype.update.call(this);

        if (!Config.visible || !$gameParty || !$gameTroop || !BattleManager._phase) {
            this.visible = false;
            return;
        }
        this.visible = true;
        this._frame++;

        var ck = [Config.direction, Config.position, Config.iconSize, Config.gap,
                  Config.dividerWidth, Config.dividerColor, Config.dividerGap,
                  Config.indicatorStyle, Config.indicatorColor].join('|');
        if (ck !== this._configKey) {
            this._configKey = ck;
            this._rebuildDivider();
            this._rebuildIndicator();
            this._orderKey = '';
        }

        // 턴 전환 감지
        if (_turnTransitionPending) {
            _turnTransitionPending = false;
            this._turnTransition = true;
            this._orderKey = ''; // 강제 _syncIcons 호출
        }

        // 매 프레임 순서 계산 (캐시 — _updateOrder/_updateLayout 공유)
        this._order = this._calcTurnOrder();
        this._updateOrder();
        this._updateIconStatuses();
        this._updateLayout();
        this._updateIndicatorPos();
        this._updateOverlay();
        this._cleanExiting();
    };

    //=========================================================================
    // 구분선 / 인디케이터 재생성
    //=========================================================================
    Sprite_TurnOrderBar.prototype._rebuildDivider = function () {
        var lw = Config.dividerWidth;
        if (lw <= 0) { this._divSprite.bitmap = new Bitmap(1, 1); return; }
        this._divSprite.bitmap = buildDividerBitmap(
            Config.direction === 'horizontal', Config.iconSize, lw, Config.dividerColor
        );
    };

    Sprite_TurnOrderBar.prototype._rebuildIndicator = function () {
        var style = Config.indicatorStyle;
        if (style === 'none') {
            this._indSprite.bitmap  = new Bitmap(1, 1);
            this._indSprite.visible = false;
            return;
        }
        var isH = Config.direction === 'horizontal';
        this._indSprite.bitmap   = buildIndicatorBitmap(style, Config.indicatorColor, Config.iconSize, isH);
        this._indSprite.anchor.x = isH ? 0.5 : 1.0;
        this._indSprite.anchor.y = isH ? 1.0 : 0.5;
        this._indSprite.visible  = false;
    };

    //=========================================================================
    // 턴 순서 계산
    // 반환: { curOrder, curSubject, curPending, next }
    //
    // curOrder 규칙:
    //   turn/action/turnEnd: done(반투명) + subject(active) + pending — 모두 유지
    //     done 판별: _doneThisTurn 배열 (BattleManager.endAction hook으로 기록)
    //   input/기타: done 배틀러 유지 + AGI 기반 pending (순서 안정화)
    //     ※ 이전 코드는 input에서 AGI 전체 재정렬 → 아이콘이 이동하는 버그 있었음
    //     ※ done 유지로 turnEnd→input 전환 시 아이콘 이동 없음
    //
    // next는 turn/action/turnEnd에서만 표시
    //   input에서 next=[]이면 _syncIcons에서 next 아이콘들이 cur로 자연스럽게 승격됨
    //=========================================================================
    Sprite_TurnOrderBar.prototype._calcTurnOrder = function () {
        var phase   = BattleManager._phase;
        var subject = BattleManager._subject;

        var partyAlive = $gameParty.battleMembers().filter(function (b) { return b.isAlive(); });
        var troopAlive = ($gameTroop.aliveMembers
            ? $gameTroop.aliveMembers()
            : $gameTroop.members().filter(function (b) { return b.isAlive(); }));
        var allAlive = partyAlive.concat(troopAlive);

        var curOrder, curSubject, curPending;

        if (phase === 'turn' || phase === 'action' || phase === 'turnEnd') {
            // done: 이번 턴에 이미 endAction을 마친 배틀러 (행동 완료 순서 유지)
            var done = _doneThisTurn.filter(function (b) {
                return allAlive.indexOf(b) >= 0;
            });
            // pending: done도 아니고 active(subject)도 아닌 배틀러
            // _actionBattlers 순서를 따르되, 없으면 allAlive 순서
            var actionBattlers = BattleManager._actionBattlers || [];
            var pending = allAlive.filter(function (b) {
                return _doneThisTurn.indexOf(b) < 0 && b !== subject;
            }).sort(function (a, b) {
                var ai = actionBattlers.indexOf(a); if (ai < 0) ai = 9999;
                var bi = actionBattlers.indexOf(b); if (bi < 0) bi = 9999;
                return ai - bi;
            });
            // subject가 이미 done에 포함되면 중복 추가하지 않음
            // (endAction 직후 subject가 아직 남아있어 중복 발생 방지)
            var subjectSlot = (subject && _doneThisTurn.indexOf(subject) < 0) ? [subject] : [];
            curOrder   = done.concat(subjectSlot).concat(pending);
            curSubject = (subject && _doneThisTurn.indexOf(subject) < 0) ? subject : null;
            curPending = pending;
        } else {
            // input / 기타: 속도 미리보기 순서 사용 (없으면 AGI 순서)
            var done2 = _doneThisTurn.filter(function (b) {
                return allAlive.indexOf(b) >= 0;
            });
            var pending2;
            if (_inputPreviewOrder && _inputPreviewOrder.length > 0) {
                pending2 = _inputPreviewOrder.filter(function (b) {
                    return allAlive.indexOf(b) >= 0 && _doneThisTurn.indexOf(b) < 0;
                });
            } else {
                pending2 = allAlive.filter(function (b) {
                    return _doneThisTurn.indexOf(b) < 0;
                }).sort(function (a, b) { return b.agi - a.agi; });
            }
            curOrder   = done2.concat(pending2);
            curSubject = null;
            curPending = pending2;
        }

        // 다음 턴 예측: 항상 표시
        // startTurn 시 턴 전환 애니메이션으로 next→cur 승격이 필요하므로
        // input phase에서도 next를 유지해야 함
        var next = allAlive.slice().sort(function (a, b) { return b.agi - a.agi; });

        return { curOrder: curOrder, curSubject: curSubject, curPending: curPending, next: next };
    };

    Sprite_TurnOrderBar.prototype._orderKeyOf = function (order) {
        var subKey = order.curSubject
            ? order.curSubject.name() + order.curSubject.index()
            : '-';
        return [
            order.curOrder.map(function (b) { return b.name() + b.index(); }).join(','),
            subKey,
            order.next.map(function (b) { return b.name() + b.index(); }).join(',')
        ].join('|');
    };

    Sprite_TurnOrderBar.prototype._updateOrder = function () {
        var order = this._order;
        var key   = this._orderKeyOf(order);
        if (key === this._orderKey) return;
        this._orderKey = key;
        this._syncIcons(order);
    };

