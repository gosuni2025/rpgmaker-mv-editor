    // =========================================================================
    // Window_Message 확장
    // =========================================================================

    // VN 모드에서 Window_Message 자체 입력 차단
    // 단, VN 창이 _forceOk 플래그를 세우면 1회만 true 반환 → 원본 흐름(terminateMessage) 활용
    var _WM_isTriggered = Window_Message.prototype.isTriggered;
    Window_Message.prototype.isTriggered = function () {
        if (VNManager.isActive()) {
            var s  = SceneManager._scene;
            var tw = s && s._vnCtrl ? s._vnCtrl.getTextWindow() : null;
            if (tw && tw._forceOk) {
                tw._forceOk = false;
                return true;  // 원본 updateInput() 흐름: pause=false → terminateMessage()
            }
            return false;
        }
        return _WM_isTriggered.call(this);
    };

    // VN 모드에서 \! \. \| \w 대기/정지 코드 무시 — Window_Message는 즉시 처리하고 숨김
    var _WM_startPause = Window_Message.prototype.startPause;
    Window_Message.prototype.startPause = function () {
        if (VNManager.isActive()) {
            this.pause = true;
            // VN 텍스트 창의 pause sign도 활성화
            var s  = SceneManager._scene;
            var tw = s && s._vnCtrl ? s._vnCtrl.getTextWindow() : null;
            if (tw) tw.pause = true;
            return;
        }
        _WM_startPause.call(this);
    };

    var _WM_startWait = Window_Message.prototype.startWait;
    Window_Message.prototype.startWait = function (count) {
        if (VNManager.isActive()) return;  // VN 모드에서 \. \| \w 무시
        _WM_startWait.call(this, count);
    };

    var _WM_updateWait = Window_Message.prototype.updateWait;
    Window_Message.prototype.updateWait = function () {
        if (VNManager.isActive()) return false;  // VN 모드에서 waitCount 무시
        return _WM_updateWait.call(this);
    };

    var _WM_updateMessage = Window_Message.prototype.updateMessage;
    Window_Message.prototype.updateMessage = function () {
        if (VNManager.isActive()) {
            // 이전 메시지에서 남은 상태 클리어 (안전망)
            this.pause = false;
            this._waitCount = 0;
        }
        return _WM_updateMessage.call(this);
    };

    // VN 모드에서 페이지 분할 없이 즉시 처리
    // newPage() → clearFlags() → _showFast=false 로 인해 텍스트가 한 글자씩 처리되어
    // 선택지 설정(onEndOfText→startInput)이 수 초 후에야 실행되는 문제 방지.
    var _WM_needsNewPage = Window_Message.prototype.needsNewPage;
    Window_Message.prototype.needsNewPage = function (textState) {
        if (VNManager.isActive()) return false;
        return _WM_needsNewPage.call(this, textState);
    };

    // VN 모드에서 pending 선택지(타이핑 완료 대기)도 subWindow 활성으로 간주
    // → Window_Message.update() while 루프를 대기 상태로 유지하여 terminateMessage 방지
    var _WM_isAnySubWindowActive = Window_Message.prototype.isAnySubWindowActive;
    Window_Message.prototype.isAnySubWindowActive = function () {
        if (VNManager.isActive()) {
            var s  = SceneManager._scene;
            var tw = s && s._vnCtrl ? s._vnCtrl.getTextWindow() : null;
            if (tw && (tw.isChoiceActive() || tw._pendingChoiceIdx >= 0)) return true;
        }
        return _WM_isAnySubWindowActive.call(this);
    };

    var _WM_startMessage = Window_Message.prototype.startMessage;
    Window_Message.prototype.startMessage = function () {
        var isVN = VNManager.isActive();
        var spk = '', txt = '';
        if (isVN) {
            spk = (typeof $gameMessage.speakerName === 'function')
                        ? ($gameMessage.speakerName() || '') : '';
            txt = $gameMessage.allText();
        }
        _WM_startMessage.call(this);  // 원본 호출 (내부 newPage→clearFlags가 _showFast를 false로 리셋함)
        if (isVN) {
            this._showFast = true;
            this.openness = 255;
            this._opening = false;  // open() 호출로 세팅된 _opening 플래그 즉시 해제
            this.pause = false;     // 이전 메시지의 pause 상태 클리어
            this._waitCount = 0;    // 이전 메시지의 waitCount 클리어
            var s = SceneManager._scene;
            if (s && s._vnCtrl) {
                s._vnCtrl.startTyping(spk, txt);
                s._vnCtrl.cancelAutoExit();
            }
        }
    };

    // VN 모드에서 onEndOfText:
    // - startInput()으로 선택지/숫자입력 등 처리 (원본과 동일)
    // - 일반 메시지면 pause=true → _forceOk → terminateMessage() 대기
    // - _textState는 항상 null (원본과 동일) → updateMessage 루프 종료
    var _WM_onEndOfText = Window_Message.prototype.onEndOfText;
    Window_Message.prototype.onEndOfText = function () {
        if (VNManager.isActive()) {
            if (!this.startInput()) {
                this.startPause();  // startPause 오버라이드를 통해 tw.pause도 설정됨
            }
            this._textState = null;  // 원본과 동일: 항상 null
            return;
        }
        _WM_onEndOfText.call(this);
    };


    // VN 모드에서 Window_Message를 화면 밖으로
    var _WM_updatePlacement = Window_Message.prototype.updatePlacement;
    Window_Message.prototype.updatePlacement = function () {
        _WM_updatePlacement.call(this);
        if (VNManager.isActive()) this.y = Graphics.boxHeight + 200;
    };

    // 메시지 종료 후 자동 탈출 스케줄
    var _WM_terminateMessage = Window_Message.prototype.terminateMessage;
    Window_Message.prototype.terminateMessage = function () {
        if (VNManager.isActive()) {
            // VN 모드: close()를 호출하지 않음.
            // 원본 close() → isClosing()=true → update() while 루프가 멈춰 선택지 처리 불가.
            // Window_Message는 화면 밖(y=boxHeight+200)에 있으므로 열린 채 유지해도 무방.
            this._goldWindow.close();
            $gameMessage.clear();
        } else {
            _WM_terminateMessage.call(this);
            return;
        }
        if ($gameMessage.isChoice() || $gameMessage.isNumberInput() || $gameMessage.isItemChoice()) return;
        if (!$gameMessage.isBusy()) {
            var s = SceneManager._scene;
            if (s && s._vnCtrl) {
                var tw = s._vnCtrl.getTextWindow();
                if (tw && !tw._isTyping) {
                    s._vnCtrl.scheduleAutoExit();
                } else if (tw) {
                    tw._pendingAutoExit = true;
                }
            }
        }
    };

    // 타이핑 완료 감지 → pending 선택지 활성화 + 자동 탈출
    var _origSkipTyping = Window_VNText.prototype.skipTyping;
    Window_VNText.prototype.skipTyping = function () {
        _origSkipTyping.call(this);
        this._activatePendingChoice();
        this._checkPendingAutoExit();
    };

    // _isTyping이 false가 된 후 pendingAutoExit 처리
    Window_VNText.prototype._checkPendingAutoExit = function () {
        if (!this._pendingAutoExit) return;
        this._pendingAutoExit = false;
        var s = SceneManager._scene;
        if (s && s._vnCtrl && VNManager.isActive()) {
            s._vnCtrl.scheduleAutoExit();
        }
    };

    // update에서 타이핑 완료 시점에도 체크
    var _origUpdate = Window_VNText.prototype.update;
    Window_VNText.prototype.update = function () {
        var wasTying = this._isTyping;
        _origUpdate.call(this);
        if (wasTying && !this._isTyping) {
            this._activatePendingChoice();
            this._checkPendingAutoExit();
        }
    };

    // 선택지/숫자입력 등이 실제로 시작될 때만 자동 탈출 취소
    // (startInput은 매 프레임 호출될 수 있으므로, true 반환 시(=실제 입력 시작)에만 취소)
    var _WM_startInput = Window_Message.prototype.startInput;
    Window_Message.prototype.startInput = function () {
        var result = _WM_startInput.call(this);
        if (result && VNManager.isActive()) {
            var s = SceneManager._scene;
            if (s && s._vnCtrl) s._vnCtrl.cancelAutoExit();
        }
        return result;
    };

