
    //=========================================================================
    // 마우스 휠 줌 — document.addEventListener 직접 등록
    //=========================================================================

    if (MOUSE_WHEEL_ZOOM) {
        document.addEventListener('wheel', function(event) {
            if (is3DActive()) {
                var delta = -event.deltaY * WHEEL_ZOOM_SPEED * 0.01;
                applyZoom(delta);
                event.preventDefault();
            }
        }, { passive: false });
    }

    //=========================================================================
    // Scene_Map.processMapTouch 오버라이드
    // 터치다운 → 터치업이 같은 위치(threshold 이내)에서만 이동 처리
    //=========================================================================

    var _orig_processMapTouch = Scene_Map.prototype.processMapTouch;
    Scene_Map.prototype.processMapTouch = function() {
        if (!is3DActive()) {
            _orig_processMapTouch.call(this);
            return;
        }

        // 3D 모드: 드래그/핀치 중이었으면 이동 억제
        if (_suppressNextDestination) {
            // 릴리즈 시점에서만 플래그 클리어
            if (TouchInput.isReleased()) {
                _suppressNextDestination = false;
                _mapTouchTriggered = false;
            }
            // 현재 이동 요청 무시, 진행 중인 destination도 클리어
            if (this._touchCount > 0) {
                $gameTemp.clearDestination();
                this._touchCount = 0;
            }
            return;
        }

        // 3D 모드: 터치 릴리즈(터치업) 시에만 이동
        // 단, 맵에서 실제로 터치 다운이 있었던 경우에만 처리
        // (이벤트/선택지 등 다른 UI에서 클릭 후 맵으로 복귀 시 오발동 방지)
        if (TouchInput.isReleased()) {
            if (_mapTouchTriggered) {
                var x = $gameMap.canvasToMapX(TouchInput.x);
                var y = $gameMap.canvasToMapY(TouchInput.y);
                $gameTemp.setDestination(x, y);
            }
            _mapTouchTriggered = false;
            this._touchCount = 0;
        }
    };
