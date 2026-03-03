/*:
 * @plugindesc 유연한 퀘스트 시스템 v1.1.0
 * 적 처치, 아이템 수집, 위치 도달 등 다양한 조건을 자동으로 추적합니다.
 * UI는 CustomSceneEngine 위젯 시스템으로 구동됩니다.
 * @author RPGMaker MV Web Editor
 *
 * @param journalKey
 * @text 저널 여는 키
 * @desc 퀘스트 저널을 여는 키보드 단축키 (빈 칸이면 비활성)
 * @default J
 *
 * @param showTracker
 * @text 맵 추적창 표시
 * @desc 맵 화면에 현재 추적 퀘스트 창을 표시할지 여부
 * @type boolean
 * @default true
 *
 * @param trackerX
 * @text 추적창 X
 * @type number
 * @default 0
 *
 * @param trackerY
 * @text 추적창 Y
 * @type number
 * @default 0
 *
 * @param trackerWidth
 * @text 추적창 너비
 * @type number
 * @default 300
 *
 * @param autoGiveRewards
 * @text 보상 자동 지급
 * @desc 퀘스트 완료 시 보상을 자동으로 지급할지 여부
 * @type boolean
 * @default true
 *
 * @help
 * ============================================================================
 * QuestSystem.js — 유연한 퀘스트 시스템
 * ============================================================================
 *
 * 퀘스트 데이터는 data/Quests.json 파일에서 로드됩니다.
 * 에디터의 데이터베이스 → 퀘스트 탭에서 편집할 수 있습니다.
 *
 * UI는 data/UIEditorScenes.json의 'questJournal' / 'questTracker' 씬을
 * CustomSceneEngine이 렌더링합니다.
 *
 * ── 플러그인 커맨드 ──────────────────────────────────────────────────────────
 *
 * QuestSystem open               # 퀘스트 저널 열기
 * QuestSystem add <questId>      # 퀘스트를 'known' 상태로 추가
 * QuestSystem start <questId>    # 퀘스트를 'active' 상태로 시작
 * QuestSystem complete <questId> # 퀘스트 강제 완료 (보상 자동 지급)
 * QuestSystem fail <questId>     # 퀘스트 실패 처리
 * QuestSystem remove <questId>   # 퀘스트 상태 초기화 (히든)
 * QuestSystem track <questId>    # 지정 퀘스트를 맵 추적창에 표시
 * QuestSystem untrack            # 추적 퀘스트 해제
 *
 * QuestSystem completeObjective <questId> <objId>  # 목표 수동 완료
 * QuestSystem failObjective <questId> <objId>      # 목표 실패
 * QuestSystem showObjective <questId> <objId>      # 숨겨진 목표 표시
 *
 * ── 퀘스트 상태 ──────────────────────────────────────────────────────────────
 *   hidden    — 아직 알려지지 않음 (기본)
 *   known     — 존재는 알지만 미수락
 *   active    — 진행 중
 *   completed — 완료
 *   failed    — 실패
 *
 * ── 목표 타입 ─────────────────────────────────────────────────────────────────
 *   kill      — 적 ID N마리 처치 (자동 추적)
 *   collect   — 아이템 N개 보유 (자동 추적)
 *   gold      — 골드 N 이상 보유 (자동 추적)
 *   variable  — 변수 X가 조건 충족 (자동 추적)
 *   switch    — 스위치 X가 ON/OFF (자동 추적)
 *   reach     — 맵 X의 위치에 도달 (자동 추적)
 *   talk      — 맵 X의 이벤트와 대화 (자동 추적)
 *   manual    — 플러그인 커맨드로 수동 완료
 */

(function () {
  'use strict';

  var params = PluginManager.parameters('QuestSystem');
  var journalKey = String(params['journalKey'] || 'J');
  var showTracker = String(params['showTracker']) !== 'false';
  var trackerX = Number(params['trackerX'] || 0);
  var trackerY = Number(params['trackerY'] || 0);
  var trackerWidth = Number(params['trackerWidth'] || 300);
  var autoGiveRewards = String(params['autoGiveRewards']) !== 'false';
  // J키를 RPG Maker MV Input 시스템에 등록 (Input.isTriggered가 인식하려면 keyMapper 등록 필수)
  var _QS_JOURNAL_KEY = '_qs_journal';
  if (journalKey) {
    Input.keyMapper[journalKey.toUpperCase().charCodeAt(0)] = _QS_JOURNAL_KEY;
  }
