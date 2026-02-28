/*:
 * @plugindesc 전투 디버그 패널 — 전투화면 우측 상단에 디버그 버튼 표시
 * @author Editor
 *
 * @help
 * 전투화면 우측 상단에 디버그 버튼 창을 표시합니다.
 *   - 몬스터 전체 피해 100
 *   - 아군 전체 피해 100
 *
 * 플러그인을 OFF 하면 창이 표시되지 않습니다.
 */

(function() {
    'use strict';

    var BUTTONS = [
        { label: '몬스터 전체 피해 100', symbol: 'enemyDamage' },
        { label: '아군 전체 피해 100',   symbol: 'allyDamage'  },
    ];

    //------------------------------------------------------------
    // Window_BattleDebug
    //------------------------------------------------------------
    function Window_BattleDebug() {
        this.initialize.apply(this, arguments);
    }
    Window_BattleDebug.prototype = Object.create(Window_Base.prototype);
    Window_BattleDebug.prototype.constructor = Window_BattleDebug;

    Window_BattleDebug.prototype.initialize = function() {
        var pad = this.standardPadding();
        var width = 220;
        var height = this.fittingHeight(BUTTONS.length);
        var x = Graphics.boxWidth - width - 4;
        Window_Base.prototype.initialize.call(this, x, 4, width, height);
        this._handlers = {};
        this._hoverIndex = -1;
        this.refresh();
    };

    Window_BattleDebug.prototype.setHandler = function(symbol, fn) {
        this._handlers[symbol] = fn;
    };

    Window_BattleDebug.prototype.refresh = function() {
        if (!this.contents) return;
        this.contents.clear();
        var lh = this.lineHeight();
        for (var i = 0; i < BUTTONS.length; i++) {
            if (this._hoverIndex === i) {
                this.contents.fillRect(0, i * lh, this.contentsWidth(), lh, 'rgba(255,255,255,0.15)');
                this.changeTextColor(this.systemColor());
            } else {
                this.changeTextColor(this.normalColor());
            }
            this.drawText(BUTTONS[i].label, 4, i * lh, this.contentsWidth() - 8);
        }
        this.resetTextColor();
    };

    Window_BattleDebug.prototype.update = function() {
        Window_Base.prototype.update.call(this);

        // hover 감지
        var pad = this.standardPadding();
        var lx = TouchInput.x - this.x - pad;
        var ly = TouchInput.y - this.y - pad;
        var lh = this.lineHeight();
        var hover = (lx >= 0 && lx < this.contentsWidth() && ly >= 0 && ly < this.contentsHeight())
            ? Math.floor(ly / lh) : -1;
        if (hover >= BUTTONS.length) hover = -1;

        if (hover !== this._hoverIndex) {
            this._hoverIndex = hover;
            this.refresh();
        }

        // 클릭 처리
        if (TouchInput.isTriggered() && hover >= 0) {
            var fn = this._handlers[BUTTONS[hover].symbol];
            if (fn) fn();
        }
    };

    //------------------------------------------------------------
    // Scene_Battle — 디버그 창 추가
    //------------------------------------------------------------
    var _Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
    Scene_Battle.prototype.createAllWindows = function() {
        _Scene_Battle_createAllWindows.call(this);
        this._battleDebugWindow = new Window_BattleDebug();
        this._battleDebugWindow.setHandler('enemyDamage', function() {
            $gameTroop.aliveMembers().forEach(function(e) { e.gainHp(-100); e.refresh(); });
        });
        this._battleDebugWindow.setHandler('allyDamage', function() {
            $gameParty.aliveMembers().forEach(function(m) { m.gainHp(-100); m.refresh(); });
        });
        this.addWindow(this._battleDebugWindow);
    };

})();
