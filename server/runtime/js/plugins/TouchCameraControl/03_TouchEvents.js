
    //=========================================================================
    // 터치 이벤트 처리 (모바일 기기 대응)
    //
    // 원본 rpg_core의 _onTouchStart/_onTouchMove/_onTouchEnd/_onTouchCancel을
    // 완전히 대체함. 이유:
    //   1. 원본은 isInsideCanvas() 체크가 실패하면 아무것도 하지 않음.
    //      실제 기기에서 viewport/DPR 오차로 체크가 실패하는 경우가 있음.
    //   2. 원본 _onTouchMove에는 event.preventDefault()가 없어서
    //      브라우저가 pan(스크롤)을 시작하고 touchcancel이 발생함.
    // 해결책: 좌표를 게임 해상도로 클램프 + 항상 event.preventDefault()
    //=========================================================================

    function canvasClamp(rawX, rawY) {
        var w = (Graphics && Graphics.width)  ? Graphics.width  : 816;
        var h = (Graphics && Graphics.height) ? Graphics.height : 624;
        return {
            x: Math.max(0, Math.min(rawX, w - 1)),
            y: Math.max(0, Math.min(rawY, h - 1))
        };
    }

    // touchstart 처리 함수
    // document.addEventListener로 직접 등록하여, rpg_core._setupEventHandlers의
    // bind() 캡처 문제를 우회 (플러그인이 비동기 로드되므로 bind 시점에는
    // 원본 _onTouchStart가 캡처되어 이 오버라이드가 호출되지 않을 수 있음)
    function handleTouchStart(event) {
        // 항상 preventDefault: touchcancel·pan·zoom 원천 차단
        event.preventDefault();

        // itch.io 등 iframe 환경에서 포커스가 없으면 터치 이벤트가 비정상 동작하므로 강제 취득
        try { window.focus(); } catch(e) {}
        var canvas = document.querySelector('canvas');
        if (canvas && typeof canvas.focus === 'function') {
            try { canvas.focus(); } catch(e) {}
        }

        for (var i = 0; i < event.changedTouches.length; i++) {
            var t = event.changedTouches[i];
            var p = canvasClamp(
                Graphics.pageToCanvasX(t.pageX),
                Graphics.pageToCanvasY(t.pageY)
            );
            TouchInput._screenPressed = true;
            TouchInput._pressedTime = 0;
            if (event.touches.length >= 2) {
                TouchInput._onCancel(p.x, p.y);
            } else {
                TouchInput._onTrigger(p.x, p.y);
            }
        }

        // is3DActive() 여부와 무관하게 항상 드래그/핀치 상태 초기화
        // (로딩 중 터치 시 is3DActive()=false여서 _dragState.active가 설정 안 되는 버그 방지)
        if (event.touches.length === 1) {
            var touch = event.touches[0];
            _dragState.active = true;
            _dragState.startX = touch.pageX;
            _dragState.startY = touch.pageY;
            _dragState.lastX  = touch.pageX;
            _dragState.lastY  = touch.pageY;
            _dragState.moved  = false;
            _suppressNextDestination = false;
            _pinchState.active = false;
            var scene = SceneManager._scene;
            _mapTouchTriggered = !!(scene && scene.isActive && scene.isActive() &&
                                    $gamePlayer && $gamePlayer.canMove());
        } else if (event.touches.length >= 2) {
            _dragState.active = false;
            _dragState.moved  = true;   // 핀치 → 이동 억제
            _suppressNextDestination = true;
            _mapTouchTriggered = false;
            _pinchState.active   = true;
            _pinchState.lastDist = getTouchDist(event.touches);
        }
    }

    // 원본 _onTouchStart도 오버라이드 (bind 전에 로드되면 유효)
    TouchInput._onTouchStart = handleTouchStart;

    // =========================================================================
    // touchstart / touchmove / touchend / touchcancel
    // — document.addEventListener 직접 등록
    //
    // PluginManager.setup()이 플러그인을 비동기 로드하므로,
    // rpg_core._setupEventHandlers()의 bind() 시점에는 원본 함수가 캡처됨.
    // 따라서 모든 터치 핸들러를 document.addEventListener로 직접 등록해야
    // 플러그인 오버라이드가 확실히 동작함.
    // passive: false 필수 (event.preventDefault() 호출을 위해)
    // =========================================================================

    document.addEventListener('touchstart', handleTouchStart, { passive: false });

    document.addEventListener('touchmove', function(event) {
        event.preventDefault(); // pan/scroll 원천 차단

        if (!is3DActive()) {
            // 이동 좌표 갱신
            for (var i = 0; i < event.changedTouches.length; i++) {
                var t = event.changedTouches[i];
                var p = canvasClamp(
                    Graphics.pageToCanvasX(t.pageX),
                    Graphics.pageToCanvasY(t.pageY)
                );
                TouchInput._onMove(p.x, p.y);
            }
            return;
        }

        // 핀치 줌
        if (event.touches.length >= 2) {
            if (!_pinchState.active) {
                _dragState.active = false;
                _dragState.moved  = true;
                _suppressNextDestination = true;
                _mapTouchTriggered = false;
                _pinchState.active   = true;
                _pinchState.lastDist = getTouchDist(event.touches);
            }
            var dist = getTouchDist(event.touches);
            applyZoom((dist - _pinchState.lastDist) * ZOOM_SPEED);
            _pinchState.lastDist = dist;
            return;
        }

        // 1-손가락 드래그
        if (event.touches.length === 1) {
            // touchstart 누락 복구
            if (!_dragState.active) {
                var t0 = event.touches[0];
                _dragState.active = true;
                _dragState.startX = t0.pageX;
                _dragState.startY = t0.pageY;
                _dragState.lastX  = t0.pageX;
                _dragState.lastY  = t0.pageY;
                _dragState.moved  = false;
                _suppressNextDestination = false;
            }

            var touch = event.touches[0];
            var dx = touch.pageX - _dragState.lastX;
            var dy = touch.pageY - _dragState.lastY;

            if (!isCameraZoneActive()) {
                if (!_dragState.moved) {
                    var tdx = touch.pageX - _dragState.startX;
                    var tdy = touch.pageY - _dragState.startY;
                    if (Math.sqrt(tdx * tdx + tdy * tdy) > DRAG_THRESHOLD) {
                        _dragState.moved = true;
                        _suppressNextDestination = true;
                    }
                }
                if (_dragState.moved) {
                    applyYaw(-dx * ROTATION_SPEED);
                    applyTilt(dy * ROTATION_SPEED);
                    _dragState.lastX = touch.pageX;
                    _dragState.lastY = touch.pageY;
                    return;
                }
            }

            _dragState.lastX = touch.pageX;
            _dragState.lastY = touch.pageY;
        }

        // 이동 좌표 갱신 (클램프 적용)
        for (var j = 0; j < event.changedTouches.length; j++) {
            var ct = event.changedTouches[j];
            var cp = canvasClamp(
                Graphics.pageToCanvasX(ct.pageX),
                Graphics.pageToCanvasY(ct.pageY)
            );
            TouchInput._onMove(cp.x, cp.y);
        }
    }, { passive: false });

    document.addEventListener('touchend', function(event) {
        if (event.touches.length < 2) _pinchState.active = false;
        if (event.touches.length === 0) {
            _dragState.active = false;
            // 원본 _onTouchEnd(bind 캡처)가 isInsideCanvas 없이 _onRelease를 호출하지만,
            // Graphics.pageToCanvasX/Y가 모바일에서 부정확할 수 있으므로
            // 클램프된 좌표로 덮어써서 정확한 TouchInput.x/y를 보장
            for (var i = 0; i < event.changedTouches.length; i++) {
                var t = event.changedTouches[i];
                var p = canvasClamp(
                    Graphics.pageToCanvasX(t.pageX),
                    Graphics.pageToCanvasY(t.pageY)
                );
                TouchInput._screenPressed = false;
                TouchInput._onRelease(p.x, p.y);
            }
        }
    });

    document.addEventListener('touchcancel', function() {
        _dragState.active  = false;
        _dragState.moved   = false;
        _pinchState.active = false;
        _suppressNextDestination = false;
        _mapTouchTriggered = false;
    });
