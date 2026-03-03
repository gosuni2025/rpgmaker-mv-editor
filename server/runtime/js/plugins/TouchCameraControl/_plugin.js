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

    // touch-action: none — 브라우저 기본 pan/scroll을 비활성화하여 touchcancel 방지
    // itch.io 등 iframe 환경에서 브라우저가 pan을 감지해 touchcancel을 발생시키는 문제 해결
    (function() {
        var style = document.createElement('style');
        style.textContent = 'canvas { touch-action: none; }';
        document.head.appendChild(style);
    })();

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
