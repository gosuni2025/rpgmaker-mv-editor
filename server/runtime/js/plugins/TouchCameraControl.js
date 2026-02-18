/*:
 * @pluginname 터치 카메라 조작
 * @plugindesc 터치/마우스 드래그로 카메라 회전, 핀치로 줌 인/아웃 (3D 모드 전용)
 * @author gosuni2025
 *
 * @param Drag Threshold
 * @type number
 * @min 1
 * @max 50
 * @desc 탭으로 인식할 최대 이동 거리(px). 이 범위 안에서 터치업하면 이동 처리.
 * @default 12
 *
 * @param Rotation Speed
 * @type number
 * @decimals 3
 * @min 0.01
 * @max 2
 * @desc 드래그 시 카메라 회전 속도 (도/px)
 * @default 0.3
 *
 * @param Tilt Min
 * @type number
 * @min 10
 * @max 89
 * @desc 카메라 틸트 최소값(도). 낮을수록 수평에 가까움.
 * @default 20
 *
 * @param Tilt Max
 * @type number
 * @min 10
 * @max 89
 * @desc 카메라 틸트 최대값(도). 높을수록 탑다운에 가까움.
 * @default 80
 *
 * @param Zoom Min
 * @type number
 * @decimals 2
 * @min 0.1
 * @max 5
 * @desc 최소 줌 배율 (줌 아웃 한계)
 * @default 0.5
 *
 * @param Zoom Max
 * @type number
 * @decimals 2
 * @min 0.1
 * @max 10
 * @desc 최대 줌 배율 (줌 인 한계)
 * @default 3.0
 *
 * @param Zoom Speed
 * @type number
 * @decimals 3
 * @min 0.001
 * @max 0.1
 * @desc 핀치 줌 감도
 * @default 0.01
 *
 * @param Mouse Wheel Zoom
 * @type boolean
 * @desc 마우스 휠로도 줌 인/아웃 가능하게 할지 여부
 * @default true
 *
 * @param Wheel Zoom Speed
 * @type number
 * @decimals 3
 * @min 0.01
 * @max 1
 * @desc 마우스 휠 줌 감도
 * @default 0.1
 *
 * @help
 * 3D 모드(Mode3D)에서 터치/마우스 조작으로 카메라를 제어합니다.
 * 에디터 모드에서는 작동하지 않으며, 런타임 게임플레이 시에만 활성화됩니다.
 *
 * === 조작 방법 ===
 * - 터치/클릭 후 드래그: 카메라 회전 (좌우=yaw, 상하=tilt)
 * - 두 손가락 핀치: 줌 인/아웃
 * - 마우스 휠: 줌 인/아웃 (설정 시)
 * - 같은 위치에서 터치 후 바로 떼기: 이동 목적지 설정 (원래 동작)
 *   (드래그한 경우 이동하지 않음)
 */

(function() {

    // 에디터 모드에서는 실행하지 않음
    if (window.__editorMode) return;

    // Mode3D가 없는 환경에서는 실행하지 않음
    if (typeof Mode3D === 'undefined') return;

    var parameters = PluginManager.parameters('TouchCameraControl');
    var DRAG_THRESHOLD = Number(parameters['Drag Threshold'] || 12);
    var ROTATION_SPEED = Number(parameters['Rotation Speed'] || 0.3);
    var TILT_MIN = Number(parameters['Tilt Min'] || 20);
    var TILT_MAX = Number(parameters['Tilt Max'] || 80);
    var ZOOM_MIN = Number(parameters['Zoom Min'] || 0.5);
    var ZOOM_MAX = Number(parameters['Zoom Max'] || 3.0);
    var ZOOM_SPEED = Number(parameters['Zoom Speed'] || 0.01);
    var MOUSE_WHEEL_ZOOM = String(parameters['Mouse Wheel Zoom'] || 'true') === 'true';
    var WHEEL_ZOOM_SPEED = Number(parameters['Wheel Zoom Speed'] || 0.1);

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

    //=========================================================================
    // 유틸
    //=========================================================================

    function is3DActive() {
        return ConfigManager.mode3d && Mode3D._active && Mode3D._perspCamera;
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

    //=========================================================================
    // 마우스 이벤트 후킹 (드래그 회전)
    //=========================================================================

    var _orig_onLeftButtonDown = TouchInput._onLeftButtonDown;
    TouchInput._onLeftButtonDown = function(event) {
        if (is3DActive()) {
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
            }
        }
        _orig_onLeftButtonDown.call(this, event);
    };

    var _orig_onMouseMove = TouchInput._onMouseMove;
    TouchInput._onMouseMove = function(event) {
        if (is3DActive() && _dragState.active && this._mousePressed) {
            var dx = event.pageX - _dragState.lastX;
            var dy = event.pageY - _dragState.lastY;

            // threshold 체크
            var totalDx = event.pageX - _dragState.startX;
            var totalDy = event.pageY - _dragState.startY;
            if (!_dragState.moved) {
                if (Math.sqrt(totalDx * totalDx + totalDy * totalDy) > DRAG_THRESHOLD) {
                    _dragState.moved = true;
                    _suppressNextDestination = true;
                }
            }

            if (_dragState.moved) {
                applyYaw(-dx * ROTATION_SPEED);
                applyTilt(dy * ROTATION_SPEED);
            }

            _dragState.lastX = event.pageX;
            _dragState.lastY = event.pageY;
        }

        // 드래그 중이면 원본 _onMove 호출 억제 (이동 좌표 갱신 방지)
        if (is3DActive() && _dragState.moved) {
            // 원본 호출하지 않음 → TouchInput._onMove() 실행 안함
            return;
        }
        _orig_onMouseMove.call(this, event);
    };

    var _orig_onMouseUp = TouchInput._onMouseUp;
    TouchInput._onMouseUp = function(event) {
        if (event.button === 0) {
            _dragState.active = false;
        }
        _orig_onMouseUp.call(this, event);
    };

    //=========================================================================
    // 터치 이벤트 후킹 (드래그 회전 + 핀치 줌)
    //=========================================================================

    var _orig_onTouchStart = TouchInput._onTouchStart;
    TouchInput._onTouchStart = function(event) {
        if (is3DActive()) {
            if (event.touches.length === 1) {
                var touch = event.touches[0];
                _dragState.active = true;
                _dragState.startX = touch.pageX;
                _dragState.startY = touch.pageY;
                _dragState.lastX = touch.pageX;
                _dragState.lastY = touch.pageY;
                _dragState.moved = false;
                _suppressNextDestination = false;
            } else if (event.touches.length >= 2) {
                // 핀치 시작
                _dragState.active = false;
                _dragState.moved = true; // 핀치 → 이동 억제
                _suppressNextDestination = true;
                _pinchState.active = true;
                _pinchState.lastDist = getTouchDist(event.touches);
            }
        }
        _orig_onTouchStart.call(this, event);
    };

    var _orig_onTouchMove = TouchInput._onTouchMove;
    TouchInput._onTouchMove = function(event) {
        if (is3DActive()) {
            if (_pinchState.active && event.touches.length >= 2) {
                // 핀치 줌
                var dist = getTouchDist(event.touches);
                var delta = (dist - _pinchState.lastDist) * ZOOM_SPEED;
                applyZoom(delta);
                _pinchState.lastDist = dist;
                event.preventDefault();
                return; // 원본 호출 안함
            }

            if (_dragState.active && event.touches.length === 1) {
                var touch = event.touches[0];
                var dx = touch.pageX - _dragState.lastX;
                var dy = touch.pageY - _dragState.lastY;

                var totalDx = touch.pageX - _dragState.startX;
                var totalDy = touch.pageY - _dragState.startY;
                if (!_dragState.moved) {
                    if (Math.sqrt(totalDx * totalDx + totalDy * totalDy) > DRAG_THRESHOLD) {
                        _dragState.moved = true;
                        _suppressNextDestination = true;
                    }
                }

                if (_dragState.moved) {
                    applyYaw(-dx * ROTATION_SPEED);
                    applyTilt(dy * ROTATION_SPEED);
                    _dragState.lastX = touch.pageX;
                    _dragState.lastY = touch.pageY;
                    event.preventDefault();
                    return; // 원본 호출 안함
                }

                _dragState.lastX = touch.pageX;
                _dragState.lastY = touch.pageY;
            }
        }
        _orig_onTouchMove.call(this, event);
    };

    var _orig_onTouchEnd = TouchInput._onTouchEnd;
    TouchInput._onTouchEnd = function(event) {
        if (is3DActive()) {
            if (event.touches.length < 2) {
                _pinchState.active = false;
            }
            if (event.touches.length === 0) {
                _dragState.active = false;
            }
        }
        _orig_onTouchEnd.call(this, event);
    };

    //=========================================================================
    // 마우스 휠 줌
    //=========================================================================

    if (MOUSE_WHEEL_ZOOM) {
        var _orig_onWheel = TouchInput._onWheel;
        TouchInput._onWheel = function(event) {
            if (is3DActive()) {
                var delta = -event.deltaY * WHEEL_ZOOM_SPEED * 0.01;
                applyZoom(delta);
                event.preventDefault();
                return; // 원본 휠 이벤트 소비
            }
            _orig_onWheel.call(this, event);
        };
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
            }
            // 현재 이동 요청 무시, 진행 중인 destination도 클리어
            if (this._touchCount > 0) {
                $gameTemp.clearDestination();
                this._touchCount = 0;
            }
            return;
        }

        // 3D 모드: 터치 릴리즈(터치업) 시에만 이동
        if (TouchInput.isReleased()) {
            var x = $gameMap.canvasToMapX(TouchInput.x);
            var y = $gameMap.canvasToMapY(TouchInput.y);
            $gameTemp.setDestination(x, y);
            this._touchCount = 0;
        }
    };

})();
