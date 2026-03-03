    // =========================================================================
    // Window_ChoiceList 분기
    // =========================================================================
    var _WCL_start = Window_ChoiceList.prototype.start;
    Window_ChoiceList.prototype.start = function () {
        if (VNManager.isActive() && VNManager.getChoiceStyle() === 'inline') {
            this._vnInline = true;
            this._setupVNInline();
        } else {
            this._vnInline = false;
            _WCL_start.call(this);
        }
    };

    Window_ChoiceList.prototype._setupVNInline = function () {
        var s  = SceneManager._scene;
        var tw = s && s._vnCtrl ? s._vnCtrl.getTextWindow() : null;
        if (!tw) { this._vnInline = false; _WCL_start.call(this); return; }

        var choices   = $gameMessage.choices();
        var defIdx    = $gameMessage.choiceDefaultType();
        var cancelIdx = $gameMessage.choiceCancelType();

        tw.addChoiceEntry(choices, defIdx >= 0 ? defIdx : 0, cancelIdx);
        this._vnTextWin = tw;

        // 화면 밖으로 이동하되 active/open 유지 → isAnySubWindowActive()=true → Window_Message 대기
        this.x = -9999;
        this.y = -9999;
        this.activate();
        this.open();
        this.select(defIdx >= 0 ? defIdx : 0);
    };

    var _WCL_update = Window_ChoiceList.prototype.update;
    Window_ChoiceList.prototype.update = function () {
        if (this._vnInline) { this._updateVNInline(); return; }
        _WCL_update.call(this);
    };

    Window_ChoiceList.prototype._updateVNInline = function () {
        Window_Base.prototype.update.call(this);
        var tw = this._vnTextWin;
        if (!tw || tw.isChoiceActive()) return;  // 아직 선택 중

        // 선택 완료
        var result = tw.getChoiceResult();
        if (result < 0) result = 0;

        // TextLog에 선택 결과 기록
        var entries = tw._entries;
        var lastLog = entries[entries.length - 1];
        if (lastLog && lastLog._choiceLog && window.TextLogManager) {
            window.TextLogManager.add({ type: 'selected', spk: '', txt: '▷ ' + lastLog._choiceLog, fn: '', fi: 0, bg: 0, lc: 1 });
        }

        $gameMessage.onChoice(result);
        this.deactivate();
        this.close();
        this._messageWindow.terminateMessage();
        this._vnInline  = false;
        this._vnTextWin = null;

        if (VNManager.isActive() && !$gameMessage.isBusy()) {
            var s = SceneManager._scene;
            if (s && s._vnCtrl) s._vnCtrl.scheduleAutoExit();
        }
    };

    // =========================================================================
    // 기본 선택지 방식일 때 선택 결과 로그+VN창 기록
    // =========================================================================
    var _GM_onChoice = Game_Message.prototype.onChoice;
    Game_Message.prototype.onChoice = function (n) {
        if (VNManager.isActive() && VNManager.getChoiceStyle() === 'default') {
            var choices = this._choices || [];
            var chosen  = (n >= 0 && n < choices.length) ? choices[n] : ('선택 ' + n);
            if (window.TextLogManager) {
                window.TextLogManager.add({ type: 'selected', spk: '', txt: '▷ ' + chosen, fn: '', fi: 0, bg: 0, lc: 1 });
            }
            var s = SceneManager._scene;
            if (s && s._vnCtrl) s._vnCtrl.getTextWindow().addEntry('[선택]', '  ' + CHOICE_IND + ' ' + chosen);
        }
        _GM_onChoice.call(this, n);
    };

