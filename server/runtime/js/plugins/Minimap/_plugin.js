/*:
 * @plugindesc [v1.1] 미니맵 — FoW, 리전 색상, 커스텀 마커, 2D/3D 지원
 * @author Claude
 * @require CustomSceneEngine
 *
 * @param showOnStart
 * @text 시작 시 표시
 * @desc 게임 시작(맵 진입) 시 미니맵을 표시할지 여부. false로 하면 숨겨진 상태로 시작하며 플러그인 커맨드로 표시할 수 있습니다.
 * @type boolean
 * @default true
 *
 * @param shape
 * @text 모양
 * @type select
 * @option 원형
 * @value circle
 * @option 사각형
 * @value square
 * @default circle
 *
 * @param size
 * @text 크기 (px)
 * @type number
 * @min 64
 * @max 512
 * @default 160
 *
 * @param margin
 * @text 여백 (px)
 * @type number
 * @min 0
 * @default 10
 *
 * @param opacity
 * @text 불투명도 (0~255)
 * @type number
 * @min 0
 * @max 255
 * @default 210
 *
 * @param rotation
 * @text 회전 모드
 * @type select
 * @option 북쪽 고정
 * @value north_fixed
 * @option 카메라 방향 (3D)
 * @value rotate
 * @default north_fixed
 *
 * @param tileSize
 * @text 타일 크기 (px)
 * @desc 미니맵 상에서 한 타일이 차지하는 픽셀 크기
 * @type number
 * @min 1
 * @max 16
 * @default 4
 *
 * @param viewRadius
 * @text 시야 반경 (타일)
 * @desc FoW 현재 시야 반경. 이 범위 내 타일이 밝게 표시됨.
 * @type number
 * @min 1
 * @default 6
 *
 * @param fowEnabled
 * @text 안개 효과 사용
 * @type boolean
 * @default true
 *
 * @param bgColor
 * @text 배경색
 * @type color
 * @default #1a2030
 *
 * @param wallColor
 * @text 벽 색상
 * @type color
 * @default #445566
 *
 * @param floorColor
 * @text 바닥 색상
 * @type color
 * @default #7799aa
 *
 * @param playerColor
 * @text 플레이어 마커 색상
 * @type color
 * @default #ffffff
 *
 * @param eventMarkerColor
 * @text 이벤트 마커 기본 색상
 * @type color
 * @default #ffcc00
 *
 * @param showEvents
 * @text 이벤트 마커 표시
 * @type boolean
 * @default true
 *
 * @param iconFixedSize
 * @text 아이콘 마커 고정 크기
 * @desc 활성화 시 아이콘 마커가 줌에 관계없이 항상 일정한 크기로 표시됩니다.
 * @type boolean
 * @default true
 *
 * @param regionColors
 * @text 리전별 색상 (JSON)
 * @desc {"리전ID":"색상"} 형식. 리전 ID(1~255)를 색상에 매핑합니다.\n예: {"1":"#ff4444","2":"#44cc44","3":"#4488ff"}\n리전 ID는 에디터 → 그리기 → 리전 탭에서 타일에 지정한 번호입니다.
 * @type json
 * @default {"1":"#ff4444","2":"#44cc44","3":"#4488ff","4":"#ffaa00","5":"#cc44cc"}
 *
 * @param terrainColors
 * @text 지형 태그별 색상 (JSON)
 * @desc {"지형태그":"색상"} 형식. 타일의 지형 태그(0~7)를 색상에 매핑합니다.\n예: {"1":"#226633","2":"#5588aa","3":"#887766"}\n지형 태그는 타일셋 편집기 → 지형 탭에서 각 타일에 부여한 숫자입니다.
 * @type json
 * @default {"1":"#226633","2":"#5588aa","3":"#887766","4":"#aaaaaa","5":"#ffeecc"}
 *
 * @param borderColor
 * @text 테두리 색상
 * @type color
 * @default #aabbcc
 *
 * @param borderWidth
 * @text 테두리 두께 (px)
 * @type number
 * @min 0
 * @max 8
 * @default 2
 *
 * @param showMapName
 * @text 맵 이름 표시
 * @desc 미니맵에 현재 맵 이름을 표시합니다.
 * @type boolean
 * @default true
 *
 * @param mapNameFontSize
 * @text 맵 이름 폰트 크기
 * @type number
 * @min 8
 * @max 32
 * @default 13
 *
 * @param mapNameFont
 * @text 맵 이름 폰트
 * @desc 비워두면 게임 기본 폰트를 사용합니다.
 * @type font
 * @default
 *
 * @param mapNameColor
 * @text 맵 이름 색상
 * @type color
 * @default #ffffff
 *
 * @param mapNamePosition
 * @text 맵 이름 위치
 * @type select
 * @option 아래 (버튼 아래)
 * @value bottom
 * @option 위 (미니맵 위)
 * @value top
 * @default bottom
 *
 * @param resetNameOnTransfer
 * @text 맵 이동 시 커스텀 이름 초기화
 * @desc 맵 이동 시 setMapName으로 지정한 커스텀 이름을 자동 초기화할지 여부.
 * @type boolean
 * @default true
 *
 * @param overlaySceneId
 * @text 오버레이 씬 ID
 * @desc UIEditor에서 만든 오버레이 씬의 ID. show/hide 커맨드가 이 씬을 OVERLAY SHOW/HIDE로 연동합니다.
 * @type string
 * @default minimap_hud
 *
 * @command show
 * @text 미니맵 표시
 * @desc 미니맵을 화면에 표시합니다.
 *
 * @command hide
 * @text 미니맵 숨기기
 * @desc 미니맵을 숨깁니다.
 *
 * @command toggle
 * @text 표시/숨김 전환
 * @desc 미니맵 표시 상태를 토글합니다.
 *
 * @command clearFow
 * @text 안개 초기화
 * @desc 현재 맵의 탐험 안개를 초기화합니다.
 *
 * @command revealAll
 * @text 전체 탐험 처리
 * @desc 현재 맵의 모든 타일을 탐험 상태로 만듭니다.
 *
 * @command shape
 * @text 모양 변경
 * @desc 미니맵의 모양을 변경합니다.
 *
 * @arg value
 * @text 모양
 * @type select
 * @default circle
 *
 * @option 원형
 * @value circle
 *
 * @option 사각형
 * @value square
 *
 * @command rotation
 * @text 회전 모드 변경
 * @desc 미니맵 회전 모드를 변경합니다.
 *
 * @arg value
 * @text 회전 모드
 * @type select
 * @default north_fixed
 *
 * @option 북쪽 고정
 * @value north_fixed
 *
 * @option 카메라 방향 (3D)
 * @value rotate
 *
 * @command tileSize
 * @text 타일 크기 변경
 * @desc 미니맵에서 한 타일이 차지하는 픽셀 크기를 변경합니다.
 *
 * @arg value
 * @text 크기 (px)
 * @type number
 * @min 1
 * @max 16
 * @default 4
 *
 * @command addMarker
 * @text 마커 추가
 * @desc 미니맵에 커스텀 마커를 추가합니다. 같은 ID가 있으면 덮어씁니다.
 *
 * @arg id
 * @text 마커 ID
 * @desc 고유 식별자. 나중에 이 ID로 마커를 삭제할 수 있습니다.
 * @type string
 * @default marker1
 *
 * @arg x
 * @text X 좌표
 * @type number
 * @min 0
 * @default 0
 *
 * @arg y
 * @text Y 좌표
 * @type number
 * @min 0
 * @default 0
 *
 * @arg color
 * @text 색상
 * @desc CSS 색상값. 예: #ff4444, rgba(255,100,0,0.8)
 * @type string
 * @default #ff4444
 *
 * @arg shape
 * @text 모양
 * @type select
 * @default circle
 *
 * @option 원형
 * @value circle
 *
 * @option 사각형
 * @value square
 *
 * @option 다이아몬드
 * @value diamond
 *
 * @command removeMarker
 * @text 마커 삭제
 * @desc ID로 마커를 삭제합니다.
 *
 * @arg id
 * @text 마커 ID
 * @type string
 * @default marker1
 *
 * @command clearMarkers
 * @text 마커 전체 삭제
 * @desc 모든 커스텀 마커를 삭제합니다.
 *
 * @command setMapName
 * @text 맵 이름 변경
 * @desc 미니맵에 표시할 이름을 커스텀으로 설정합니다. resetMapName으로 원래 이름으로 되돌릴 수 있습니다.
 *
 * @arg name
 * @text 이름
 * @type string
 * @default 커스텀 이름
 *
 * @command resetMapName
 * @text 맵 이름 초기화
 * @desc 미니맵 이름을 실제 맵 이름으로 되돌립니다.
 *
 * @help
 * 미니맵을 화면 우측 상단에 표시합니다.
 * 미니맵 하단의 -/+ 버튼으로 확대/축소할 수 있습니다.
 *
 * --- 이벤트 마커 ---
 * 에디터 이벤트 에디터에서 "미니맵" 항목으로 색상·모양을 설정하면
 * $dataMap.minimapData[eventId]에 저장되어 자동으로 표시됩니다.
 *
 * --- 커스텀 마커 (스크립트/커맨드) ---
 * 플러그인 커맨드로 임의 좌표에 마커를 추가할 수 있습니다:
 *   Minimap addMarker npc1 5 10 #ff4444 circle
 *   Minimap addMarker boss 20 15 #ff0000 diamond
 *   Minimap removeMarker npc1
 *   Minimap clearMarkers
 *
 * 커스텀 마커는 세이브 데이터에 저장됩니다.
 */

(function () {
  'use strict';

  const PLUGIN_NAME = 'Minimap';
  const p = PluginManager.parameters(PLUGIN_NAME);

  const CFG = {
    showOnStart:      p['showOnStart'] !== 'false',
    shape:            p['shape'] || 'circle',
    size:             parseInt(p['size']) || 160,
    margin:           parseInt(p['margin']) || 10,
    opacity:          parseInt(p['opacity']) || 210,
    rotation:         p['rotation'] || 'north_fixed',
    tileSize:         parseInt(p['tileSize']) || 4,
    viewRadius:       parseInt(p['viewRadius']) || 6,
    fowEnabled:       p['fowEnabled'] !== 'false',
    bgColor:          p['bgColor'] || '#1a2030',
    wallColor:        p['wallColor'] || '#445566',
    floorColor:       p['floorColor'] || '#7799aa',
    playerColor:      p['playerColor'] || '#ffffff',
    eventMarkerColor: p['eventMarkerColor'] || '#ffcc00',
    showEvents:       p['showEvents'] !== 'false',
    iconFixedSize:    p['iconFixedSize'] !== 'false',
    borderColor:      p['borderColor'] || '#aabbcc',
    borderWidth:      parseInt(p['borderWidth']) || 2,
    overlaySceneId:   p['overlaySceneId'] || 'minimap_hud',
    resetNameOnTransfer: p['resetNameOnTransfer'] !== 'false',
    regionColors:     {},
    terrainColors:    {},
  };

  try { CFG.regionColors  = JSON.parse(p['regionColors']  || '{}'); } catch(e) {}
  try { CFG.terrainColors = JSON.parse(p['terrainColors'] || '{}'); } catch(e) {}

  const N_PAD = 16; // 북쪽 N 표시를 위한 비트맵 여백 (px)
