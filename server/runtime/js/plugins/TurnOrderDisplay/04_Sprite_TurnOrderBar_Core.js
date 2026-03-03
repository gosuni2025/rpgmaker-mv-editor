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
    //   input/기타: AGI 기반 예측 순서 표시 (모두 pending, done 없음)
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
            // done: 이번 턴에 이미 endAction을 마친 배틀러
            var done = allAlive.filter(function (b) {
                return _doneThisTurn.indexOf(b) >= 0;
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
            curOrder   = done.concat(subject ? [subject] : []).concat(pending);
            curSubject = subject;
            curPending = pending;
        } else {
            // input / 기타: AGI 기반 예측 순서 표시 (커맨드 선택 중 참고용)
            curOrder   = allAlive.slice().sort(function (a, b) { return b.agi - a.agi; });
            curSubject = null;
            curPending = curOrder.slice();
        }

        // 다음 턴 예측: turn/action/turnEnd에서만 표시
        // input phase에서는 curOrder가 이미 전체 배틀러를 포함하므로 next를 비워 중복 방지
        var next;
        if (phase === 'turn' || phase === 'action' || phase === 'turnEnd') {
            next = allAlive.slice().sort(function (a, b) { return b.agi - a.agi; });
        } else {
            next = [];
        }

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

