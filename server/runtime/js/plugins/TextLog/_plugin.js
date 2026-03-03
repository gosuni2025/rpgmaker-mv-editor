/*:
 * @plugindesc [v1.2] 텍스트 로그 - 메시지 대사 기록을 스크롤하며 볼 수 있는 창
 * @author RPG Maker MV Web Editor
 *
 * @param menuName
 * @text 메뉴 이름
 * @type string
 * @desc 메인 메뉴에 표시될 이름
 * @default 텍스트 로그
 *
 * @param maxLines
 * @text 최대 라인 수
 * @type number
 * @min 50
 * @max 5000
 * @desc 이 수를 초과하면 오래된 로그가 삭제됩니다.
 * @default 300
 *
 * @param entryGap
 * @text 항목 간격
 * @type number
 * @min 0
 * @max 30
 * @desc 로그 항목 사이의 여백 (픽셀)
 * @default 6
 *
 * @param showFace
 * @text 얼굴 이미지 표시
 * @type boolean
 * @on 표시
 * @off 숨김
 * @desc 로그에 캐릭터 얼굴 이미지를 표시합니다.
 * @default true
 *
 * @param faceSize
 * @text 얼굴 이미지 크기
 * @type number
 * @min 32
 * @max 144
 * @desc 로그에 표시되는 얼굴 이미지 크기 (픽셀, 원본 144px 기준으로 축소)
 * @default 100
 *
 * @param bgOpacity
 * @text 항목 배경 불투명도
 * @type number
 * @min 0
 * @max 255
 * @desc 각 로그 항목 배경 박스 불투명도 (0=완전투명, 255=완전불투명)
 * @default 160
 *
 * @param scrollSpeed
 * @text 마우스 휠 속도
 * @type number
 * @min 1
 * @max 20
 * @desc 마우스 휠 스크롤 배율
 * @default 4
 *
 * @help
 * ============================================================================
 * 텍스트 로그 플러그인 v1.2
 * ============================================================================
 * 게임 내 메시지 창의 대사를 자동으로 기록하여 다시 볼 수 있습니다.
 * 선택지 목록과 선택한 항목도 함께 기록됩니다.
 *
 * [접근 방법]
 * - 메인 메뉴에서 "텍스트 로그" 항목 선택
 *
 * [스크롤 조작]
 * - 마우스 휠
 * - 터치 드래그
 * - ↑ / ↓ 방향키 (라인 단위)
 * - PageUp / PageDown (페이지 단위)
 *
 * [닫기]
 * - ESC 키 또는 오른쪽 클릭
 *
 * [저장/불러오기]
 * - 로그 기록은 세이브 파일에 자동으로 저장/복원됩니다.
 * - 새 게임 시작 시 로그가 초기화됩니다.
 * ============================================================================
 */

(function () {
    'use strict';

    var params      = PluginManager.parameters('TextLog');
    var MENU_NAME   = String(params['menuName']   || '텍스트 로그');
    var MAX_LINES   = parseInt(params['maxLines'])   || 300;
    var ENTRY_GAP   = parseInt(params['entryGap'])   || 6;
    var SHOW_FACE   = String(params['showFace'])  !== 'false';
    var FACE_SIZE   = parseInt(params['faceSize'])   || 100;
    var BG_OPACITY  = parseInt(params['bgOpacity'])  || 160;
    var SCROLL_SPEED = parseInt(params['scrollSpeed']) || 4;

    var ENTRY_PAD    = 10;  // 항목 내부 패딩
    var TITLE_ITEM_H = 40;  // 스크롤 가능한 제목 항목 높이
    var SCROLLBAR_W  = 5;   // 스크롤바 너비
    var SCROLLBAR_RESERVED = SCROLLBAR_W + 6; // 스크롤바 + 여백 (텍스트 영역에서 제외)

