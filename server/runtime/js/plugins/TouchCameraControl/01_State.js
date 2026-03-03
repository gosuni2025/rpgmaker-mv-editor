
    //=========================================================================
    // 내부 상태
    //=========================================================================

    var _dragState = {
        active: false,
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
        moved: false          // threshold를 넘었는지
    };

    var _pinchState = {
        active: false,
        lastDist: 0
    };

    // 터치 이동 억제 플래그: 드래그/핀치 중이었으면 터치업 시 이동하지 않음
    var _suppressNextDestination = false;

    // 맵에서 실제로 터치 다운(trigger)이 있었는지 추적
    // 이 플래그가 true일 때만 isReleased()에서 이동 처리
    // (이벤트/선택지 등 다른 UI에서 클릭 후 맵으로 복귀 시 오발동 방지)
    var _mapTouchTriggered = false;

    //=========================================================================
    // 유틸
    //=========================================================================

    function is3DActive() {
        return !!(ConfigManager.mode3d && Mode3D._active && Mode3D._perspCamera);
    }

    // 카메라 존 활성화 중이면 true (터치 회전 비활성화 판단에 사용)
    function isCameraZoneActive() {
        return typeof $gameMap !== 'undefined' && $gameMap &&
               $gameMap._activeCameraZoneId != null;
    }

    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    function getTouchDist(touches) {
        if (touches.length < 2) return 0;
        var dx = touches[0].pageX - touches[1].pageX;
        var dy = touches[0].pageY - touches[1].pageY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    //=========================================================================
    // 카메라 yaw/tilt/zoom 적용 (Mode3D 전역 값 직접 수정)
    //=========================================================================

    function applyYaw(deltaDeg) {
        Mode3D._yawDeg = (Mode3D._yawDeg || 0) + deltaDeg;
        // -180 ~ 180 범위로 정규화
        while (Mode3D._yawDeg > 180) Mode3D._yawDeg -= 360;
        while (Mode3D._yawDeg < -180) Mode3D._yawDeg += 360;
        Mode3D._yawRad = Mode3D._yawDeg * Math.PI / 180;
        // lerp 현재값도 동기화 (카메라존 lerp가 덮어쓰지 않도록)
        Mode3D._currentYaw = Mode3D._yawDeg;
    }

    function applyTilt(deltaDeg) {
        var newTilt = clamp((Mode3D._tiltDeg || 60) + deltaDeg, TILT_MIN, TILT_MAX);
        Mode3D._tiltDeg = newTilt;
        Mode3D._tiltRad = newTilt * Math.PI / 180;
        Mode3D._currentTilt = newTilt;
    }

    function applyZoom(delta) {
        var newZoom = clamp((Mode3D._zoomScale || 1.0) + delta, ZOOM_MIN, ZOOM_MAX);
        Mode3D._zoomScale = newZoom;
        Mode3D._currentZoom = newZoom;
    }
