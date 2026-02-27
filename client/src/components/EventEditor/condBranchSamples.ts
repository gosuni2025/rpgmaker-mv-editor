interface ScriptSample { group: string; label: string; code: string; }

// ══════════════════════════════════════════════════════════════
//  조건 분기 전용 샘플 (참/거짓 반환 표현식)
//  code 형식: 첫 줄 "// 주석", 나머지 줄이 실제 JS 표현식
// ══════════════════════════════════════════════════════════════

export const COND_BRANCH_SAMPLES: ScriptSample[] = [

  // ── ConfigManager ──────────────────────────────────────────
  {
    group: 'ConfigManager',
    label: 'BGM 볼륨 ≥ N',
    code:
`// BGM 볼륨이 50 이상일 때
ConfigManager.bgmVolume >= 50`,
  },
  {
    group: 'ConfigManager',
    label: 'BGS 볼륨 ≥ N',
    code:
`// BGS 볼륨이 50 이상일 때
ConfigManager.bgsVolume >= 50`,
  },
  {
    group: 'ConfigManager',
    label: 'SE 볼륨 ≥ N',
    code:
`// SE 볼륨이 50 이상일 때
ConfigManager.seVolume >= 50`,
  },
  {
    group: 'ConfigManager',
    label: 'ME 볼륨 ≥ N',
    code:
`// ME 볼륨이 50 이상일 때
ConfigManager.meVolume >= 50`,
  },
  {
    group: 'ConfigManager',
    label: '전체화면 모드',
    code:
`// 전체화면 모드일 때
ConfigManager.isFullScreen`,
  },
  {
    group: 'ConfigManager',
    label: '항상 대시 ON',
    code:
`// 항상 대시가 켜져 있을 때
ConfigManager.isAlwaysDash`,
  },
  {
    group: 'ConfigManager',
    label: '커맨드 기억 ON',
    code:
`// 전투 커맨드 기억이 켜져 있을 때
ConfigManager.isCommandRemember`,
  },
  {
    group: 'ConfigManager',
    label: '터치 UI 활성',
    code:
`// 터치 UI가 켜져 있을 때
ConfigManager.touchUI !== false`,
  },

  // ── 소지금 ─────────────────────────────────────────────────
  {
    group: '소지금',
    label: '골드 ≥ N',
    code:
`// 골드가 1000 이상일 때
$gameParty.gold() >= 1000`,
  },
  {
    group: '소지금',
    label: '골드 ≤ N',
    code:
`// 골드가 500 이하일 때
$gameParty.gold() <= 500`,
  },
  {
    group: '소지금',
    label: '골드 = 0',
    code:
`// 골드가 0 일 때 (빈털터리)
$gameParty.gold() === 0`,
  },

  // ── 변수 ───────────────────────────────────────────────────
  {
    group: '변수',
    label: '변수 #N ≥ 값',
    code:
`// 변수 #1이 10 이상일 때
$gameVariables.value(1) >= 10`,
  },
  {
    group: '변수',
    label: '변수 #N ≤ 값',
    code:
`// 변수 #1이 5 이하일 때
$gameVariables.value(1) <= 5`,
  },
  {
    group: '변수',
    label: '변수 #N = 값',
    code:
`// 변수 #1이 0 일 때
$gameVariables.value(1) === 0`,
  },
  {
    group: '변수',
    label: '두 변수 비교',
    code:
`// 변수 #1이 변수 #2보다 클 때
$gameVariables.value(1) > $gameVariables.value(2)`,
  },

  // ── 스위치 ─────────────────────────────────────────────────
  {
    group: '스위치',
    label: '스위치 #N ON',
    code:
`// 스위치 #1이 ON일 때
$gameSwitches.value(1)`,
  },
  {
    group: '스위치',
    label: '스위치 #N OFF',
    code:
`// 스위치 #1이 OFF일 때
!$gameSwitches.value(1)`,
  },
  {
    group: '스위치',
    label: '여러 스위치 모두 ON',
    code:
`// 스위치 #1, #2, #3이 모두 ON일 때
[1, 2, 3].every(function(id) { return $gameSwitches.value(id); })`,
  },
  {
    group: '스위치',
    label: '셀프 스위치 A ON',
    code:
`// 현재 이벤트의 셀프 스위치 A가 ON일 때
$gameSelfSwitches.value([$gameMap.mapId(), this._eventId, "A"])`,
  },

  // ── 파티 / 아이템 ──────────────────────────────────────────
  {
    group: '파티 / 아이템',
    label: '아이템 소지',
    code:
`// 아이템 #1을 소지하고 있을 때
$gameParty.hasItem($dataItems[1])`,
  },
  {
    group: '파티 / 아이템',
    label: '무기 소지 (장비 포함)',
    code:
`// 무기 #1을 소지하고 있을 때 (장비도 포함)
$gameParty.hasItem($dataWeapons[1], true)`,
  },
  {
    group: '파티 / 아이템',
    label: '방어구 소지 (장비 포함)',
    code:
`// 방어구 #1을 소지하고 있을 때 (장비도 포함)
$gameParty.hasItem($dataArmors[1], true)`,
  },
  {
    group: '파티 / 아이템',
    label: '파티원 수 ≥ N',
    code:
`// 파티원이 3명 이상일 때
$gameParty.size() >= 3`,
  },
  {
    group: '파티 / 아이템',
    label: '사망한 파티원 있음',
    code:
`// 사망한 파티원이 한 명이라도 있을 때
$gameParty.members().some(function(a) { return a.isDead(); })`,
  },
  {
    group: '파티 / 아이템',
    label: '리더 사망',
    code:
`// 파티 리더(1번째)가 사망했을 때
$gameParty.leader().isDead()`,
  },
  {
    group: '파티 / 아이템',
    label: '전멸',
    code:
`// 파티 전원이 사망했을 때
$gameParty.isAllDead()`,
  },

  // ── 액터 ───────────────────────────────────────────────────
  {
    group: '액터',
    label: 'HP ≤ N',
    code:
`// 액터 #1의 HP가 100 이하일 때
$gameActors.actor(1).hp <= 100`,
  },
  {
    group: '액터',
    label: 'HP 비율 ≤ N%',
    code:
`// 액터 #1의 HP가 25% 이하일 때
$gameActors.actor(1).hpRate() <= 0.25`,
  },
  {
    group: '액터',
    label: '레벨 ≥ N',
    code:
`// 액터 #1의 레벨이 10 이상일 때
$gameActors.actor(1).level >= 10`,
  },
  {
    group: '액터',
    label: '스테이트 적용 중',
    code:
`// 액터 #1에 스테이트 #4(독)가 적용 중일 때
$gameActors.actor(1).isStateAffected(4)`,
  },
  {
    group: '액터',
    label: '스킬 보유',
    code:
`// 액터 #1이 스킬 #7을 보유할 때
$gameActors.actor(1).hasSkill(7)`,
  },
  {
    group: '액터',
    label: '생존 여부',
    code:
`// 액터 #1이 살아있을 때
$gameActors.actor(1).isAlive()`,
  },
  {
    group: '액터',
    label: '파티 포함 여부',
    code:
`// 액터 #2가 현재 파티에 있을 때
$gameParty.members().some(function(a) { return a.actorId() === 2; })`,
  },

  // ── 플레이어 / 맵 ──────────────────────────────────────────
  {
    group: '플레이어 / 맵',
    label: '특정 좌표',
    code:
`// 플레이어가 좌표 (10, 8)에 있을 때
$gamePlayer.x === 10 && $gamePlayer.y === 8`,
  },
  {
    group: '플레이어 / 맵',
    label: '특정 리전 위',
    code:
`// 플레이어가 리전 ID 1 위에 있을 때
$gameMap.regionId($gamePlayer.x, $gamePlayer.y) === 1`,
  },
  {
    group: '플레이어 / 맵',
    label: '특정 지형 태그 위',
    code:
`// 플레이어가 지형 태그 1 위에 있을 때
$gameMap.terrainTag($gamePlayer.x, $gamePlayer.y) === 1`,
  },
  {
    group: '플레이어 / 맵',
    label: '탈것 탑승 중',
    code:
`// 플레이어가 탈것을 타고 있을 때
$gamePlayer.isInVehicle()`,
  },
  {
    group: '플레이어 / 맵',
    label: '비행선 탑승 중',
    code:
`// 플레이어가 비행선을 타고 있을 때
$gamePlayer.isInAirship()`,
  },
  {
    group: '플레이어 / 맵',
    label: '현재 맵 ID 확인',
    code:
`// 현재 맵 ID가 3일 때
$gameMap.mapId() === 3`,
  },

  // ── 게임 상태 ──────────────────────────────────────────────
  {
    group: '게임 상태',
    label: '저장 가능',
    code:
`// 저장이 가능한 상태일 때
$gameSystem.isSaveEnabled()`,
  },
  {
    group: '게임 상태',
    label: '메뉴 접근 가능',
    code:
`// 메뉴를 열 수 있는 상태일 때
$gameSystem.isMenuEnabled()`,
  },
  {
    group: '게임 상태',
    label: '전투 중',
    code:
`// 현재 전투 중일 때
$gameParty.inBattle()`,
  },
  {
    group: '게임 상태',
    label: '전투 이탈 가능',
    code:
`// 전투에서 도망칠 수 있을 때
BattleManager.canEscape()`,
  },
  {
    group: '게임 상태',
    label: '타이머 동작 중',
    code:
`// 타이머가 실행 중일 때
$gameTimer.isWorking()`,
  },
  {
    group: '게임 상태',
    label: '타이머 N초 이하',
    code:
`// 타이머 남은 시간이 10초 이하일 때
$gameTimer.isWorking() && $gameTimer.seconds() <= 10`,
  },
];

/** 조건 분기 샘플 그룹 배열 (순서 유지) */
export const COND_BRANCH_SAMPLE_GROUPS: string[] = (() => {
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const s of COND_BRANCH_SAMPLES) {
    if (!seen.has(s.group)) { seen.add(s.group); groups.push(s.group); }
  }
  return groups;
})();
