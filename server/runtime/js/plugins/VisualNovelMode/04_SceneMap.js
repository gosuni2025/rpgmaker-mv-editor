    // =========================================================================
    // Scene_Map 확장
    // =========================================================================
    var _SceneMap_createDisplayObjects = Scene_Map.prototype.createDisplayObjects;
    Scene_Map.prototype.createDisplayObjects = function () {
        _SceneMap_createDisplayObjects.call(this);
        this._vnCtrl = new VNController(this);
        if (VNManager.isActive()) this._vnCtrl.open();
    };

    var _SceneMap_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _SceneMap_update.call(this);
        if (this._vnCtrl) this._vnCtrl.update();
    };

    var _vnWheelHandler = null;

    var _SceneMap_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function () {
        _SceneMap_start.call(this);
        var self = this;
        _vnWheelHandler = function (e) {
            if (!VNManager.isActive()) return;
            e.preventDefault();         // 배경 3D 줌 차단
            e.stopPropagation();        // 캡처 이후 버블링 핸들러(에디터 줌) 차단
            var ctrl = self._vnCtrl;
            if (!ctrl) return;
            var tw = ctrl.getTextWindow();
            if (tw && !tw.isChoiceActive() && !tw._isTyping) {
                tw.scrollBy(e.deltaY * 0.5);
                tw._vel = 0;
            }
        };
        // capture: true — 버블링 핸들러보다 먼저 실행되어 에디터 줌을 차단
        window.addEventListener('wheel', _vnWheelHandler, { passive: false, capture: true });
    };

    var _SceneMap_terminate = Scene_Map.prototype.terminate;
    Scene_Map.prototype.terminate = function () {
        _SceneMap_terminate.call(this);
        if (_vnWheelHandler) {
            window.removeEventListener('wheel', _vnWheelHandler, { capture: true });
            _vnWheelHandler = null;
        }
    };

