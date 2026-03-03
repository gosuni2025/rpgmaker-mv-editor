/*:
 * @plugindesc 오토 세이브 (자동 저장) 기능
 * @author gosuni2025
 *
 * @param --- 자동 저장 조건 ---
 * @default
 *
 * @param enableMapTransferSave
 * @parent --- 자동 저장 조건 ---
 * @text 맵 이동 시 저장
 * @desc 맵 이동(장소 이동) 완료 후 자동 저장합니다.
 * @type boolean
 * @default true
 *
 * @param enableAfterBattle
 * @parent --- 자동 저장 조건 ---
 * @text 전투 종료 후 저장
 * @desc 전투 승리·도주 후 맵으로 돌아올 때 자동 저장합니다. (게임오버는 저장 안 됨)
 * @type boolean
 * @default true
 *
 * @param enableOnVariableChange
 * @parent --- 자동 저장 조건 ---
 * @text 게임 변수 변경 시 저장
 * @desc 게임 변수가 변경된 후 일정 시간 기다렸다가 자동 저장합니다.
 * @type boolean
 * @default false
 *
 * @param variableChangeDelay
 * @parent --- 자동 저장 조건 ---
 * @text 변수 변경 후 저장 지연 (ms)
 * @desc 변수 변경 후 이 시간(밀리초)이 지나면 저장합니다. 연속 변경 시 마지막 변경 기준.
 * @type number
 * @min 100
 * @max 10000
 * @default 500
 *
 * @param enableAfterMenu
 * @parent --- 자동 저장 조건 ---
 * @text ESC 메뉴 닫기 후 저장
 * @desc 메뉴(아이템·스킬·장비 등)를 닫고 맵으로 돌아올 때 자동 저장합니다.
 * @type boolean
 * @default true
 *
 * @param saveCooldown
 * @parent --- 자동 저장 조건 ---
 * @text 저장 쿨다운 (초)
 * @desc 마지막 자동 저장 완료 후 이 시간(초)이 지나야 다시 저장됩니다. 0이면 쿨다운 없음.
 * @type number
 * @min 0
 * @max 3600
 * @default 30
 *
 * @param --- 표시 설정 ---
 * @default
 *
 * @param slotLabel
 * @parent --- 표시 설정 ---
 * @text 오토 세이브 슬롯 레이블
 * @desc 저장/로드 화면에서 오토 세이브 슬롯에 표시할 이름
 * @type string
 * @default 오토 세이브
 *
 * @param showNotification
 * @parent --- 표시 설정 ---
 * @text 자동 저장 알림
 * @desc 자동 저장 시 화면 우상단에 알림을 표시합니다.
 * @type boolean
 * @default true
 *
 * @help
 * ================================================================
 * ■ AutoSave 플러그인
 * ================================================================
 *
 * 저장/로드 화면 최상단에 전용 오토 세이브 슬롯이 항상 표시됩니다.
 * 오토 세이브 슬롯은 자동으로만 기록되며, 저장 화면에서
 * 수동으로 덮어쓸 수 없습니다.
 *
 * ----------------------------------------------------------------
 * ■ 자동 저장 조건 (파라미터에서 개별 활성화/비활성화)
 * ----------------------------------------------------------------
 *   1. 맵 이동 시
 *      - 장소 이동 이벤트 커맨드로 맵이 전환될 때마다 저장
 *
 *   2. 전투 종료(승리·도주) 후
 *      - 전투 승리 또는 도주 성공 후 맵으로 복귀할 때 저장
 *      - 게임 오버(전멸)는 저장하지 않음
 *
 *   3. 게임 변수 변경 시
 *      - 이벤트 커맨드 등으로 변수가 바뀔 때 저장
 *      - 연속 변경은 마지막 변경 기준으로 1회만 저장 (디바운스)
 *      - 기본 비활성화 — 빈번한 저장이 우려되는 경우 주의
 *
 *   4. ESC 메뉴 닫기 후
 *      - 메인 메뉴·아이템·스킬·장비·상태 화면을 닫고
 *        맵으로 돌아올 때 저장
 *
 *   ※ 저장 쿨다운 (기본 30초)
 *      - 마지막 자동 저장 완료 후 설정한 시간이 지나야 다시 저장됨
 *      - 연속 이벤트로 트리거가 반복되어도 과도한 저장 방지
 *      - 0으로 설정하면 쿨다운 없이 매번 저장
 *
 * ----------------------------------------------------------------
 * ■ 자동 저장 알림 (화면 우상단)
 * ----------------------------------------------------------------
 *   자동 저장이 실행되면 3단계 메시지가 순차 표시됩니다:
 *     "오토 세이브 저장 시작"  (파란색, 약 0.4초)
 *     "오토 세이브 저장 중..."  (노란색, 약 0.4초)
 *     "오토 세이브 저장 완료"  (초록색, 약 1.5초 후 페이드 아웃)
 *   저장에 실패하면 마지막 메시지가 "저장 실패" (빨간색)로 표시됩니다.
 *
 * ----------------------------------------------------------------
 * ■ 플러그인 커맨드
 * ----------------------------------------------------------------
 *   AutoSave           즉시 오토 세이브 실행
 *   AutoSaveEnable     맵 이동 시 자동 저장 활성화
 *   AutoSaveDisable    맵 이동 시 자동 저장 비활성화
 *
 * ================================================================
 */

(function() {
    'use strict';

    var PLUGIN_NAME = 'AutoSave';

    /**
     * 오토 세이브 전용 파일 ID.
     * 일반 세이브 슬롯(1~maxSavefiles) 및 globalInfo(ID=0)와 충돌하지 않도록
     * maxSavefiles()+1 을 사용한다. (기본 maxSavefiles=20 → ID=21)
     * @const {number}
     */
    var AUTOSAVE_FILE_ID = DataManager.maxSavefiles() + 1;

    var parameters = PluginManager.parameters(PLUGIN_NAME);

    /** @type {boolean} 맵 이동 시 자동 저장 */
    var param_onMapTransfer    = (parameters['enableMapTransferSave']  !== 'false');
    /** @type {boolean} 전투 종료 후 자동 저장 */
    var param_onBattle         = (parameters['enableAfterBattle']      !== 'false');
    /** @type {boolean} 게임 변수 변경 시 자동 저장 */
    var param_onVariable       = (parameters['enableOnVariableChange'] === 'true');
    /** @type {number} 변수 변경 후 저장 지연(ms) */
    var param_variableDelay    = Number(parameters['variableChangeDelay'] || 500);
    /** @type {boolean} 메뉴 닫기 후 자동 저장 */
    var param_onMenu           = (parameters['enableAfterMenu']        !== 'false');
    /** @type {number} 저장 쿨다운 (밀리초) */
    var param_cooldownMs       = Number(parameters['saveCooldown'] !== undefined ? parameters['saveCooldown'] : 30) * 1000;
    /** @type {string} 슬롯 레이블 */
    var param_slotLabel        = String(parameters['slotLabel'] || '오토 세이브');
    /** @type {boolean} 저장 알림 표시 */
    var param_showNotification = (parameters['showNotification']       !== 'false');

