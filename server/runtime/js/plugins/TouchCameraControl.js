/*:
 * @pluginname 터치 카메라 조작
 * @plugindesc 터치 카메라 회전/줌 + HD-2D 스타일 빌보드 방향 (3D 모드 전용)
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
 *
 * === HD-2D 빌보드 방향 ===
 * 카메라 yaw 회전에 따라 캐릭터 스프라이트의 방향 행이 자동으로 변경됩니다.
 * (옥토패스 트래블러/HD-2D 스타일)
 * 예: 아래를 향한 캐릭터가 카메라 90° 회전 시 왼쪽 방향 행으로 표시됩니다.
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

    // 맵에서 실제로 터치 다운(trigger)이 있었는지 추적
    // 이 플래그가 true일 때만 isReleased()에서 이동 처리
    // (이벤트/선택지 등 다른 UI에서 클릭 후 맵으로 복귀 시 오발동 방지)
    var _mapTouchTriggered = false;

    //=========================================================================
    // 유틸
    //=========================================================================

    function is3DActive() {
        return ConfigManager.mode3d && Mode3D._active && Mode3D._perspCamera;
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
                // 맵에서 실제로 이동 가능한 상태일 때만 터치 다운으로 기록
                // (이벤트/선택지 등 다른 UI 처리 중에는 이동 불가 상태이므로 기록 안 함)
                var scene = SceneManager._scene;
                var mapTouchOk = scene && scene.isActive &&
                                 scene.isActive() && $gamePlayer && $gamePlayer.canMove();
                _mapTouchTriggered = !!mapTouchOk;
            }
        }
        _orig_onLeftButtonDown.call(this, event);
    };

    var _orig_onMouseMove = TouchInput._onMouseMove;
    TouchInput._onMouseMove = function(event) {
        if (is3DActive() && _dragState.active && this._mousePressed) {
            var dx = event.pageX - _dragState.lastX;
            var dy = event.pageY - _dragState.lastY;

            // 카메라 존 밖에서만 드래그 회전 처리
            if (!isCameraZoneActive()) {
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
                var scene = SceneManager._scene;
                var mapTouchOk = scene && scene.isActive &&
                                 scene.isActive() && $gamePlayer && $gamePlayer.canMove();
                _mapTouchTriggered = !!mapTouchOk;
            } else if (event.touches.length >= 2) {
                // 핀치 시작
                _dragState.active = false;
                _dragState.moved = true; // 핀치 → 이동 억제
                _suppressNextDestination = true;
                _mapTouchTriggered = false;
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

                // 카메라 존 밖에서만 드래그 회전 처리
                if (!isCameraZoneActive()) {
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

    //=========================================================================
    // HD-2D 스타일 빌보드 방향 (카메라 yaw에 따라 스프라이트 방향 행 변경)
    //=========================================================================
    // 카메라가 회전하면 캐릭터의 실제 이동 방향과 무관하게,
    // 카메라 시점에서 보이는 방향에 맞는 스프라이트 행을 표시함.
    // 예: 캐릭터가 아래(+Y)를 향하고 있을 때 카메라가 90° 회전하면
    //     카메라 시점에서는 왼쪽을 향한 것으로 보이므로 "왼쪽" 행 사용.
    //
    // 방향 회전 순서 (CCW, yaw +90°마다 한 단계):
    //   2(Down) → 4(Left) → 8(Up) → 6(Right) → 2(Down)
    //=========================================================================

    // 방향 → 인덱스, 인덱스 → 방향 매핑
    var _dirToIdx = { 2: 0, 4: 1, 8: 2, 6: 3 };
    var _idxToDir = [2, 4, 8, 6];

    /**
     * 카메라 yaw를 고려한 시각적 방향을 반환
     * @param {number} actualDir - 캐릭터의 실제 방향 (2/4/6/8)
     * @returns {number} 카메라 시점에서의 시각적 방향 (2/4/6/8)
     */
    function getVisualDirection(actualDir) {
        if (!is3DActive()) return actualDir;

        var yawDeg = Mode3D._yawDeg || 0;
        // yaw를 90° 단위로 양자화 (반올림)
        var yawStep = Math.round(yawDeg / 90);
        // -180~180 범위의 yaw에서 step은 -2~2 범위
        var idx = _dirToIdx[actualDir];
        if (idx === undefined) return actualDir; // 비표준 방향은 그대로
        // 양의 모듈로 연산: (idx + yawStep) mod 4
        var visualIdx = ((idx + yawStep) % 4 + 4) % 4;
        return _idxToDir[visualIdx];
    }

    //=========================================================================
    // TPS 스타일 이동: WASD 입력을 카메라 방향 기준으로 변환
    //=========================================================================
    // 카메라 yaw 회전에 따라 입력 방향을 월드 좌표 기준으로 변환.
    // getVisualDirection(월드→시각) 의 역방향: 입력(화면 기준) → 월드 방향.
    //
    // 예: 카메라가 yaw=90° 일 때 "위" 키 → 맵에서 Left(4) 방향으로 이동
    //=========================================================================

    var _orig_getInputDirection = Game_Player.prototype.getInputDirection;
    Game_Player.prototype.getInputDirection = function() {
        var dir4 = _orig_getInputDirection.call(this);
        if (!is3DActive() || dir4 === 0) return dir4;

        var yawDeg = Mode3D._yawDeg || 0;
        var yawStep = Math.round(yawDeg / 90);
        var idx = _dirToIdx[dir4];
        if (idx === undefined) return dir4;
        // 역변환: 화면 기준 방향 → 월드 방향
        var worldIdx = ((idx - yawStep) % 4 + 4) % 4;
        return _idxToDir[worldIdx];
    };

    // Sprite_Character.prototype.characterPatternY 오버라이드
    var _orig_characterPatternY = Sprite_Character.prototype.characterPatternY;
    Sprite_Character.prototype.characterPatternY = function() {
        if (is3DActive() && this._character) {
            // !나 $ 접두어가 붙은 캐릭터(오브젝트/빅 캐릭터)는 방향 보정 안 함
            // 이들은 고정 방향 이미지이므로 카메라 각도와 무관하게 원래 방향 유지
            var charName = this._character.characterName ? this._character.characterName() : '';
            if (charName && /^[\!\$]/.test(charName)) {
                return _orig_characterPatternY.call(this);
            }
            var actualDir = this._character.direction();
            var visualDir = getVisualDirection(actualDir);
            return (visualDir - 2) / 2;
        }
        return _orig_characterPatternY.call(this);
    };

})();
