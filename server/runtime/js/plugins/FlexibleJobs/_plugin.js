//=============================================================================
// FlexibleJobs.js
//=============================================================================
/*:
 * @plugindesc 유연한 직업 시스템 — 멀티슬롯 직업, 독립 레벨, JP 스킬 습득
 * @author gosuni2025
 *
 * @param subClassSlots
 * @text 서브클래스 슬롯 수
 * @type number
 * @min 0
 * @max 5
 * @default 2
 *
 * @param subStatRate
 * @text 서브클래스 스탯 기여율 (%)
 * @type number
 * @min 0
 * @max 100
 * @default 50
 *
 * @param subExpRate
 * @text 서브클래스 EXP 배분율 (%)
 * @desc 전투 EXP 중 각 서브클래스에 배분되는 비율
 * @type number
 * @min 0
 * @max 100
 * @default 50
 *
 * @param jpPerBattle
 * @text 전투당 JP 획득량
 * @type number
 * @min 0
 * @default 10
 *
 * @param jpPerLevel
 * @text 레벨업당 JP 획득량
 * @type number
 * @min 0
 * @default 50
 *
 * @param jpName
 * @text JP 표시명
 * @default JP
 *
 * @param cmdClassChange
 * @text 전직 메뉴 이름
 * @default 전직
 *
 * @param cmdSkillLearn
 * @text 스킬 습득 메뉴 이름
 * @default 스킬 습득
 *
 * @param menuSwitch
 * @text 메뉴 접근 스위치
 * @desc 이 스위치가 ON일 때만 메뉴에 전직/스킬습득 항목을 표시합니다. 0이면 항상 표시.
 * @type switch
 * @default 0
 *
 * @help
 * FlexibleJobs.js
 *
 * ■ 개요
 *   주직업 1개 + 서브클래스 N개 슬롯을 지원합니다.
 *   각 직업은 독립된 레벨, EXP, JP를 보유합니다.
 *
 * ■ 스킬 습득 방식
 *   1. 레벨 자동 습득 — 직업 장착 중 레벨 달성 시 자동으로 사용 가능
 *                       <Portable> 태그 추가 시 직업을 바꿔도 영구 유지
 *   2. JP 소모 습득   — JP를 소비하여 스킬을 영구 습득 (어느 직업에서도 사용 가능)
 *
 * ■ 클래스 노트태그
 *   <Unlock Requires>
 *   Class x Lv y
 *   </Unlock Requires>
 *     클래스 x를 레벨 y 이상 달성해야 이 직업이 해금됩니다.
 *     여러 줄 작성 가능, 모든 조건을 충족해야 합니다.
 *
 *   <Primary Only>   주직업 슬롯에만 배치 가능
 *   <Sub Only>       서브클래스 슬롯에만 배치 가능
 *   <JP Rate: x>     이 직업 장착 시 JP 획득률 (기본 100)
 *
 * ■ 스킬 노트태그
 *   <Learn Level: x>  해당 직업 레벨 x 달성 시 자동 습득
 *   <Learn JP: x>     JP x 소모로 영구 습득 (스킬 습득 화면에서 구입)
 *   <Portable>        레벨 자동 습득 스킬을 직업 변경 후에도 유지
 *
 * ■ 플러그인 커맨드
 *   OpenClassChange              전직 화면 열기
 *   OpenSkillLearn               스킬 습득 화면 열기
 *   GainJP actorId amount        액터에게 JP 지급 (현재 주직업 귀속)
 *   UnlockClass actorId classId  직업 강제 해금
 */

(function () {
  'use strict';

  //===========================================================================
  // 파라미터
  //===========================================================================
  var p = PluginManager.parameters('FlexibleJobs');
  var SUB_SLOTS = Math.max(0, parseInt(p['subClassSlots'] || 2));
  var SUB_RATE  = Math.min(1, Math.max(0, parseInt(p['subStatRate'] || 50) / 100));
  var SUB_EXP   = Math.min(1, Math.max(0, parseInt(p['subExpRate']  || 50) / 100));
  var JP_BATTLE = parseInt(p['jpPerBattle']  || 10);
  var JP_LEVEL  = parseInt(p['jpPerLevel']   || 50);
  var JP_NAME   = String(p['jpName']         || 'JP');
  var CMD_CLASS   = String(p['cmdClassChange'] || '전직');
  var CMD_LEARN   = String(p['cmdSkillLearn']  || '스킬 습득');
  var MENU_SWITCH = parseInt(p['menuSwitch'] || 0);
