
    //=========================================================================
    // 마우스 이벤트 후킹 (드래그 회전)
    //=========================================================================

    var _orig_onLeftButtonDown = TouchInput._onLeftButtonDown;
    TouchInput._onLeftButtonDown = function(event) {
        // is3DActive() 여부와 무관하게 항상 dragState 초기화
        // 이유: mousedown 시점에 mode3d=false여도(타이틀→맵 전환 중 등),
        // 이후 mousemove 시점에 is3DActive()=true가 되어 있으면 회전이 가능해야 함
        var x = Graphics.pageToCanvasX(event.pageX);
        var y = Graphics.pageToCanvasY(event.pageY);
        if (Graphics.isInsideCanvas(x, y)) {
            _dragState.active = true;
            _dragState.startX = event.pageX;
            _dragState.startY = event.pageY;
            _dragState.lastX = event.pageX;
            _dragState.lastY = event.pageY;
            _dragState.moved = false;
            _suppressNextDestination = false;
            var scene = SceneManager._scene;
            var mapTouchOk = scene && scene.isActive &&
                             scene.isActive() && $gamePlayer && $gamePlayer.canMove();
            _mapTouchTriggered = !!mapTouchOk;
        }
        _orig_onLeftButtonDown.call(this, event);
    };

    // =========================================================================
    // mousemove / mouseup — document.addEventListener 직접 등록
    //
    // TouchInput._onMouseMove = function(...) 교체 방식은 rpg_core가
    // TouchInput.initialize()에서 this._onMouseMove.bind(this) 로 등록하므로
    // 플러그인 교체가 반영되지 않음. 직접 addEventListener로 우회.
    // =========================================================================

    // iframe 경계 밖으로 드래그해도 mousemove를 계속 받기 위해 pointer capture 설정
    document.addEventListener('pointerdown', function(event) {
        if (event.button === 0) {
            try { event.target.setPointerCapture(event.pointerId); } catch(e) {}
        }
    });

    document.addEventListener('mousemove', function(event) {
        if (!is3DActive()) return;

        // dragState 복구 (mousedown이 mode3d=false 시점에 발생한 경우)
        if ((event.buttons & 1) && !_dragState.active) {
            _dragState.active = true;
            _dragState.startX = event.pageX;
            _dragState.startY = event.pageY;
            _dragState.lastX  = event.pageX;
            _dragState.lastY  = event.pageY;
            _dragState.moved  = false;
            _suppressNextDestination = false;
        }

        if (!(event.buttons & 1)) {
            _dragState.active = false;
            return;
        }

        if (_dragState.active) {
            var dx = event.pageX - _dragState.lastX;
            var dy = event.pageY - _dragState.lastY;

            if (!isCameraZoneActive()) {
                if (!_dragState.moved) {
                    var tdx = event.pageX - _dragState.startX;
                    var tdy = event.pageY - _dragState.startY;
                    if (Math.sqrt(tdx * tdx + tdy * tdy) > DRAG_THRESHOLD) {
                        _dragState.moved = true;
                        _suppressNextDestination = true;
                    }
                }
                if (_dragState.moved) {
                    applyYaw(-dx * ROTATION_SPEED);
                    applyTilt(dy * ROTATION_SPEED);
                }
            }

            _dragState.lastX = event.pageX;
            _dragState.lastY = event.pageY;
        }
    });

    document.addEventListener('mouseup', function(event) {
        if (event.button === 0) {
            _dragState.active = false;
        }
    });
