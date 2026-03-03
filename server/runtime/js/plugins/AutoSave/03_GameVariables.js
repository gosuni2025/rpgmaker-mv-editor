    //=========================================================================
    // Game_Variables - 변수 변경 시 자동 저장 (디바운스)
    //=========================================================================

    if (param_onVariable) {
        var _Game_Variables_setValue = Game_Variables.prototype.setValue;
        /**
         * 게임 변수 값을 설정한다.
         * AutoSave 플러그인: 값 변경 시 param_variableDelay ms 후 오토 세이브 예약.
         * @param {number} variableId - 변수 ID
         * @param {*} value - 설정할 값 (숫자는 Math.floor 처리됨)
         */
        Game_Variables.prototype.setValue = function(variableId, value) {
            _Game_Variables_setValue.call(this, variableId, value);
            DataManager.scheduleAutosaveForVariable();
        };
    }

