/*:
 * @pluginname 터치 목적지 설정
 * @plugindesc 터치/클릭 목적지 애니메이션 및 이동경로 화살표 표시
 * @author gosuni2025
 *
 * @param Animation ID
 * @type animation
 * @desc 터치 시 재생할 애니메이션 ID (0 = 비활성)
 * @default 0
 *
 * @param Hide Default
 * @type boolean
 * @desc 기존 흰색 펄스 목적지 스프라이트를 숨길지 여부
 * @default true
 *
 * @param Show Path Arrow
 * @type boolean
 * @desc 플레이어에서 목적지까지 이동경로 화살표를 표시할지 여부
 * @default true
 *
 * @param Arrow Color
 * @type color
 * @desc 화살표 색상 (CSS 색상값)
 * @default rgba(255, 255, 255, 0.95)
 *
 * @param Arrow Width
 * @type number
 * @desc 화살표 삼각형 크기 배율 (1~10, 기본 5)
 * @min 1
 * @max 10
 * @default 5
 *
 * @param Arrow Outline
 * @type boolean
 * @desc 화살표 테두리 표시 여부
 * @default true
 *
 * @param Arrow Outline Color
 * @type color
 * @desc 화살표 테두리 색상
 * @default rgba(0, 0, 0, 0.85)
 *
 * @param Arrow Outline Width
 * @type number
 * @desc 화살표 테두리 굵기 (px)
 * @min 1
 * @max 5
 * @default 1
 *
 * @param Show Destination Indicator
 * @type boolean
 * @desc 실제 목적지 타일에 인디케이터를 표시할지 여부 (이동불가 시 빨간색 X, 이동가능 시 원+십자 표시)
 * @default true
 *
 * @param Show Hover Highlight
 * @type boolean
 * @desc 마우스 커서 위치의 타일을 흰선+검은 외곽선으로 하이라이트할지 여부 (2D/3D 모두 지원)
 * @default true
 *
 * @param Show Event Hover Line
 * @type boolean
 * @desc 이미지가 있는 이벤트 위에 마우스를 올리면 점멸 내곽선 효과를 표시할지 여부
 * @default true
 *
 * @param Event Hover Line Color
 * @type color
 * @desc 이벤트 호버 내곽선 색상 (CSS 색상값)
 * @default rgba(255, 255, 160, 1.0)
 *
 * @param Event Hover Line Width
 * @type number
 * @desc 이벤트 호버 내곽선 두께 (px)
 * @min 1
 * @max 8
 * @default 2
 *
 * @param Event Hover Line Speed
 * @type number
 * @desc 점멸 주기 (프레임 수, 낮을수록 빠름)
 * @min 10
 * @max 240
 * @default 50
 *
 * @param Event Hover Line Min Alpha
 * @type number
 * @desc 점멸 최소 불투명도 (0.0 ~ 1.0)
 * @decimals 2
 * @min 0
 * @max 1
 * @default 0.1
 *
 * @param Event Hover Line Max Alpha
 * @type number
 * @desc 점멸 최대 불투명도 (0.0 ~ 1.0)
 * @decimals 2
 * @min 0
 * @max 1
 * @default 1.0
 *
 * @help
 * 맵을 터치/클릭하면 기본 흰색 사각형 펄스 대신
 * 지정한 RPG Maker 애니메이션을 해당 위치에 재생합니다.
 *
 * Animation ID: $dataAnimations에서 사용할 애니메이션 번호
 * Hide Default: true이면 기존 Sprite_Destination 숨김
 * Show Path Arrow: true이면 이동경로를 화살표로 표시
 * Arrow Color: 화살표 색상
 * Arrow Width: 화살표 선 굵기
 * Arrow Outline: 화살표 테두리 표시 여부
 * Arrow Outline Color: 테두리 색상
 * Arrow Outline Width: 테두리 굵기
 * Show Event Hover Line: 이벤트 이미지에 점멸 내곽선 표시 여부
 * Event Hover Line Color: 내곽선 색상
 * Event Hover Line Width: 내곽선 두께
 * Event Hover Line Speed: 점멸 주기 (프레임)
 * Event Hover Line Min/Max Alpha: 점멸 투명도 범위
 */

(function() {

    var parameters = PluginManager.parameters('TouchDestAnimation');
    var animationId = Number(parameters['Animation ID'] || 0);
    var hideDefault = String(parameters['Hide Default']) !== 'false';
    var showPathArrow = String(parameters['Show Path Arrow']) !== 'false';
    var arrowColor = String(parameters['Arrow Color'] || 'rgba(255, 255, 255, 0.95)');
    var arrowWidth = Number(parameters['Arrow Width'] || 5);
    var arrowOutline = String(parameters['Arrow Outline']) !== 'false';
    var arrowOutlineColor = String(parameters['Arrow Outline Color'] || 'rgba(0, 0, 0, 0.85)');
    var arrowOutlineWidth = Number(parameters['Arrow Outline Width'] || 1);
    var showDestIndicator = String(parameters['Show Destination Indicator']) !== 'false';
    var showHoverHighlight = String(parameters['Show Hover Highlight']) !== 'false';
    var showEventHoverLine = String(parameters['Show Event Hover Line'] || 'true') !== 'false';
    var eventHoverLineColor = String(parameters['Event Hover Line Color'] || 'rgba(255, 255, 160, 1.0)');
    var eventHoverLineWidth = Number(parameters['Event Hover Line Width'] || 2);
    var eventHoverLineSpeed = Number(parameters['Event Hover Line Speed'] || 50);
    var eventHoverLineMinAlpha = parseFloat(parameters['Event Hover Line Min Alpha'] || 0.1);
    var eventHoverLineMaxAlpha = parseFloat(parameters['Event Hover Line Max Alpha'] || 1.0);

