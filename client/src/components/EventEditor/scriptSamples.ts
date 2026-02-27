export interface ScriptSample {
  group: string;
  label: string;
  code: string;
}

export const SCRIPT_SAMPLES: ScriptSample[] = [

  // ══════════════════════════════════════════
  //  텍스트 / 메시지
  // ══════════════════════════════════════════
  {
    group: '텍스트 / 메시지',
    label: '메시지 창에 텍스트 표시',
    code:
`$gameMessage.add("첫 번째 줄입니다.");
$gameMessage.add("두 번째 줄입니다.");`,
  },
  {
    group: '텍스트 / 메시지',
    label: '얼굴 이미지 지정 메시지',
    code:
`// faceImage: img/faces/ 기준 파일명, faceIndex: 0~7
// ※ MV에는 이름 창 기능 없음 (setSpeakerName은 MZ 전용)
$gameMessage.setFaceImage("Actor1", 0);
$gameMessage.add("\\\\C[6]안녕하세요\\\\C[0], 모험가님!");`,
  },
  {
    group: '텍스트 / 메시지',
    label: '선택지 표시',
    code:
`// 선택지 표시 후 결과를 변수 #1에 저장 (0=첫번째, 1=두번째, ...)
$gameMessage.setChoices(["예", "아니오"], 0, 1);
$gameMessage.setChoiceCallback(function(index) {
  $gameVariables.setValue(1, index);
});
$gameMessage.add("계속하시겠습니까?");`,
  },
  {
    group: '텍스트 / 메시지',
    label: '숫자 입력 창 (Input Number)',
    code:
`// 4자리 숫자를 입력받아 변수 #1에 저장
$gameMessage.setNumberInput(1, 4);`,
  },
  {
    group: '텍스트 / 메시지',
    label: '스크롤 텍스트 표시',
    code:
`// 스크롤 속도 2, 빨리 돌리기 허용
$gameMessage.setScroll(2, false);
$gameMessage.add("첫 번째 스크롤 라인");
$gameMessage.add("두 번째 스크롤 라인");
$gameMessage.add("세 번째 스크롤 라인");`,
  },

  // ══════════════════════════════════════════
  //  변수 / 스위치
  // ══════════════════════════════════════════
  {
    group: '변수 / 스위치',
    label: '변수 값 설정',
    code:
`// 변수 #1에 값 100 대입
$gameVariables.setValue(1, 100);`,
  },
  {
    group: '변수 / 스위치',
    label: '변수 현재 값 읽기 / 계산',
    code:
`// 변수 #1의 값을 읽어 +10
var current = $gameVariables.value(1);
$gameVariables.setValue(1, current + 10);`,
  },
  {
    group: '변수 / 스위치',
    label: '스위치 켜기 / 끄기',
    code:
`$gameSwitches.setValue(1, true);   // 스위치 #1 ON
// $gameSwitches.setValue(1, false); // 스위치 #1 OFF`,
  },
  {
    group: '변수 / 스위치',
    label: '셀프 스위치 조작',
    code:
`// 현재 맵 & 현재 이벤트의 셀프 스위치 A를 ON
var key = [$gameMap.mapId(), this._eventId, 'A'];
$gameSelfSwitches.setValue(key, true);`,
  },
  {
    group: '변수 / 스위치',
    label: '타이머 시작 / 정지',
    code:
`// 60초(3600프레임) 타이머 시작
$gameTimer.start(60 * 60);
// 타이머 정지: $gameTimer.stop();`,
  },

  // ══════════════════════════════════════════
  //  파티 / 아이템 / 골드
  // ══════════════════════════════════════════
  {
    group: '파티 / 아이템 / 골드',
    label: '소지금 증감',
    code:
`$gameParty.gainGold(1000);   // +1000
// $gameParty.gainGold(-500); // -500`,
  },
  {
    group: '파티 / 아이템 / 골드',
    label: '아이템 획득 / 소비',
    code:
`$gameParty.gainItem($dataItems[1], 5);    // 아이템 #1 +5
// $gameParty.gainItem($dataItems[1], -2); // 아이템 #1 -2`,
  },
  {
    group: '파티 / 아이템 / 골드',
    label: '무기 획득',
    code:
`$gameParty.gainItem($dataWeapons[1], 1); // 무기 #1 +1`,
  },
  {
    group: '파티 / 아이템 / 골드',
    label: '방어구 획득',
    code:
`$gameParty.gainItem($dataArmors[1], 1); // 방어구 #1 +1`,
  },
  {
    group: '파티 / 아이템 / 골드',
    label: '파티원 추가 / 제거',
    code:
`$gameParty.addActor(2);    // 액터 #2를 파티에 추가
// $gameParty.removeActor(2); // 파티에서 제거`,
  },

  // ══════════════════════════════════════════
  //  액터
  // ══════════════════════════════════════════
  {
    group: '액터',
    label: 'HP / MP / TP 증감',
    code:
`var actor = $gameActors.actor(1); // 액터 #1
actor.gainHp(100);   // HP +100 (maxHP 초과 불가)
actor.gainMp(50);    // MP +50
actor.gainTp(30);    // TP +30`,
  },
  {
    group: '액터',
    label: '전체 회복',
    code:
`$gameActors.actor(1).recoverAll(); // 액터 #1 HP·MP 완전 회복`,
  },
  {
    group: '액터',
    label: '파티 전원 회복',
    code:
`$gameParty.members().forEach(function(actor) {
  actor.recoverAll();
});`,
  },
  {
    group: '액터',
    label: 'EXP / 레벨 증감',
    code:
`var actor = $gameActors.actor(1);
actor.gainExp(500);            // EXP +500 (레벨업 메시지 없음)
// actor.changeLevel(5, false); // 레벨을 5로 직접 설정 (false=표시 안함)`,
  },
  {
    group: '액터',
    label: '스킬 습득 / 망각',
    code:
`var actor = $gameActors.actor(1);
actor.learnSkill(7);   // 스킬 #7 습득
// actor.forgetSkill(7); // 스킬 #7 망각`,
  },
  {
    group: '액터',
    label: '스테이트 부여 / 해제',
    code:
`var actor = $gameActors.actor(1);
actor.addState(4);    // 스테이트 #4(독 등) 부여
// actor.removeState(4); // 스테이트 해제`,
  },
  {
    group: '액터',
    label: '장비 변경',
    code:
`// slotId: 0=무기, 1=방패, 2=머리, 3=몸, 4=장신구
$gameActors.actor(1).changeEquip(0, $dataWeapons[2]); // 무기 슬롯에 무기#2 장착
// 장비 해제: changeEquip(0, null)`,
  },
  {
    group: '액터',
    label: '이름 / 닉네임 / 직업 변경',
    code:
`var actor = $gameActors.actor(1);
actor.setName("용사");
actor.setNickname("빛의 전사");
// actor.changeClass(2, true); // 직업 #2로 변경, true=EXP 유지`,
  },

  // ══════════════════════════════════════════
  //  이동 / 위치
  // ══════════════════════════════════════════
  {
    group: '이동 / 위치',
    label: '장소 이동 (맵 전환)',
    code:
`// reserveTransfer(mapId, x, y, direction, fadeType)
// direction: 2=아래, 4=왼쪽, 6=오른쪽, 8=위, 0=유지
// fadeType: 0=검정, 1=흰색, 2=페이드 없음
$gamePlayer.reserveTransfer(1, 10, 8, 2, 0);`,
  },
  {
    group: '이동 / 위치',
    label: '이벤트 위치 순간 이동',
    code:
`// 이벤트 ID 2를 좌표 (5, 5)로 순간 이동
var ev = $gameMap.event(2);
if (ev) ev.locate(5, 5);`,
  },
  {
    group: '이동 / 위치',
    label: '맵 스크롤',
    code:
`// startScroll(direction, distance, speed)
// direction: 2=아래, 4=왼쪽, 6=오른쪽, 8=위
$gameMap.startScroll(6, 5, 4); // 오른쪽으로 5칸, 속도4`,
  },
  {
    group: '이동 / 위치',
    label: '탈것 위치 설정',
    code:
`// vehicle: 'boat'(소형), 'ship'(대형), 'airship'(비행선)
$gameMap.vehicle('boat').setLocation(1, 12, 8);`,
  },

  // ══════════════════════════════════════════
  //  캐릭터 조작
  // ══════════════════════════════════════════
  {
    group: '캐릭터 조작',
    label: '플레이어 투명 상태 변경',
    code:
`$gamePlayer.setTransparent(true);  // 투명
// $gamePlayer.setTransparent(false); // 불투명`,
  },
  {
    group: '캐릭터 조작',
    label: '대열 보행 ON / OFF',
    code:
`$gamePlayer.followers().show(); // 대열 보행 ON
// $gamePlayer.followers().hide(); // OFF`,
  },
  {
    group: '캐릭터 조작',
    label: '애니메이션 표시',
    code:
`// 플레이어에 애니메이션 #1 표시 (미러 없음)
$gamePlayer.requestAnimation(1);
// 이벤트에 표시: $gameMap.event(2).requestAnimation(1);`,
  },
  {
    group: '캐릭터 조작',
    label: '말풍선 아이콘 표시',
    code:
`// balloonId: 1=!  2=?  3=♪  4=♥  5=怒  6=汗  7=くぐ  8=zzz  9=ユーザー定義
$gamePlayer.requestBalloon(1);   // 플레이어 위에 ! 풍선
// $gameMap.event(2).requestBalloon(2); // 이벤트 위에 ? 풍선`,
  },

  // ══════════════════════════════════════════
  //  그림 (Picture)
  // ══════════════════════════════════════════
  {
    group: '그림 (Picture)',
    label: '그림 표시',
    code:
`// showPicture(id, name, origin, x, y, scaleX, scaleY, opacity, blendMode)
// origin: 0=왼쪽위, 1=중앙
$gameScreen.showPicture(1, "Window", 0, 100, 100, 100, 100, 255, 0);`,
  },
  {
    group: '그림 (Picture)',
    label: '그림 이동',
    code:
`// movePicture(id, origin, x, y, scaleX, scaleY, opacity, blendMode, duration, easingType)
$gameScreen.movePicture(1, 0, 300, 200, 100, 100, 255, 0, 60, 0);`,
  },
  {
    group: '그림 (Picture)',
    label: '그림 회전',
    code:
`$gameScreen.rotatePicture(1, 5);  // 그림 #1을 속도 5로 회전
// 정지: $gameScreen.rotatePicture(1, 0);`,
  },
  {
    group: '그림 (Picture)',
    label: '그림 색조 변경',
    code:
`// tintPicture(id, tone, duration) — tone: [R, G, B, gray] 각 -255~255
$gameScreen.tintPicture(1, [-68, -68, 0, 0], 60); // 어둡게`,
  },
  {
    group: '그림 (Picture)',
    label: '그림 제거',
    code:
`$gameScreen.erasePicture(1); // 그림 #1 제거`,
  },

  // ══════════════════════════════════════════
  //  화면 효과
  // ══════════════════════════════════════════
  {
    group: '화면 효과',
    label: '페이드아웃 / 페이드인',
    code:
`$gameScreen.startFadeOut(30); // 30프레임 페이드아웃
// $gameScreen.startFadeIn(30); // 30프레임 페이드인`,
  },
  {
    group: '화면 효과',
    label: '화면 색조 변경',
    code:
`// startTint(tone, duration) — tone: [R, G, B, gray]
$gameScreen.startTint([-68, -68, -68, 0], 60);  // 어둡게
// 원상복구: $gameScreen.startTint([0, 0, 0, 0], 60);`,
  },
  {
    group: '화면 효과',
    label: '화면 플래시',
    code:
`// startFlash(color, duration) — color: [R, G, B, A] 0~255
$gameScreen.startFlash([255, 255, 255, 170], 30); // 흰색 플래시`,
  },
  {
    group: '화면 효과',
    label: '화면 흔들기',
    code:
`// startShake(power, speed, duration)
$gameScreen.startShake(5, 5, 30);`,
  },
  {
    group: '화면 효과',
    label: '날씨 효과',
    code:
`// changeWeather(type, power, duration)
// type: 'none' / 'rain' / 'storm' / 'snow'
$gameScreen.changeWeather('rain', 5, 60);
// 날씨 제거: $gameScreen.changeWeather('none', 0, 60);`,
  },

  // ══════════════════════════════════════════
  //  오디오
  // ══════════════════════════════════════════
  {
    group: '오디오',
    label: 'BGM 재생',
    code:
`AudioManager.playBgm({ name: "Castle1", volume: 90, pitch: 100, pan: 0 });`,
  },
  {
    group: '오디오',
    label: 'BGM 페이드아웃',
    code:
`AudioManager.fadeOutBgm(4); // 4초에 걸쳐 페이드아웃`,
  },
  {
    group: '오디오',
    label: 'BGM 저장 / 복원',
    code:
`$gameSystem.saveBgm();    // 현재 BGM 저장
// $gameSystem.replayBgm(); // 저장된 BGM 재생`,
  },
  {
    group: '오디오',
    label: 'BGS 재생 / 정지',
    code:
`AudioManager.playBgs({ name: "City", volume: 80, pitch: 100, pan: 0 });
// AudioManager.fadeOutBgs(2); // 2초 페이드아웃`,
  },
  {
    group: '오디오',
    label: 'ME 재생',
    code:
`AudioManager.playMe({ name: "Fanfare1", volume: 90, pitch: 100, pan: 0 });`,
  },
  {
    group: '오디오',
    label: 'SE 재생 / 정지',
    code:
`AudioManager.playSe({ name: "Cursor1", volume: 80, pitch: 100, pan: 0 });
// AudioManager.stopSe(); // 모든 SE 즉시 정지`,
  },

  // ══════════════════════════════════════════
  //  씬 전환
  // ══════════════════════════════════════════
  {
    group: '씬 전환',
    label: '메뉴 화면 열기',
    code:
`SceneManager.push(Scene_Menu);`,
  },
  {
    group: '씬 전환',
    label: '세이브 화면 열기',
    code:
`SceneManager.push(Scene_Save);`,
  },
  {
    group: '씬 전환',
    label: '게임 오버',
    code:
`SceneManager.goto(Scene_Gameover);`,
  },
  {
    group: '씬 전환',
    label: '타이틀 화면으로',
    code:
`SceneManager.goto(Scene_Title);`,
  },
  {
    group: '씬 전환',
    label: '전투 처리 (트루프 지정)',
    code:
`// setup(troopId, canEscape, canLose)
BattleManager.setup(1, true, false);
$gamePlayer.makeEncounterCount();
SceneManager.push(Scene_Battle);`,
  },

  // ══════════════════════════════════════════
  //  시스템 설정
  // ══════════════════════════════════════════
  {
    group: '시스템 설정',
    label: '저장 / 메뉴 / 조우 금지 토글',
    code:
`$gameSystem.disableSave();       // 저장 금지
// $gameSystem.enableSave();     // 저장 허용
$gameSystem.disableMenu();       // 메뉴 금지
// $gameSystem.enableMenu();
$gameSystem.disableEncounter();  // 조우 금지
// $gameSystem.enableEncounter();`,
  },
  {
    group: '시스템 설정',
    label: '창 색깔 변경',
    code:
`// windowTone: [R, G, B, gray] 각 -255~255
// windowTone은 메서드이므로 setWindowTone()으로 설정해야 함
$gameSystem.setWindowTone([-50, 0, 50, 0]); // 파란빛
// 원상복구: $gameSystem.setWindowTone([0, 0, 0, 0]);`,
  },
  {
    group: '시스템 설정',
    label: '전투 BGM / 승리 ME 변경',
    code:
`$gameSystem.setBattleBgm({ name: "Battle2", volume: 90, pitch: 100, pan: 0 });
$gameSystem.setVictoryMe({ name: "Victory1", volume: 90, pitch: 100, pan: 0 });`,
  },

  // ══════════════════════════════════════════
  //  맵
  // ══════════════════════════════════════════
  {
    group: '맵',
    label: '지도 이름 변경 (표시명)',
    code:
`// $dataMap.displayName을 직접 수정 (setDisplayName은 MV에 없음)
$dataMap.displayName = "새로운 지역";`,
  },
  {
    group: '맵',
    label: '타일셋 변경',
    code:
`// 타일셋 ID를 변경 (System.json의 tilesets 배열 인덱스와 동일)
$gameMap.changeTileset(2); // 타일셋 #2로 변경`,
  },
  {
    group: '맵',
    label: '타일 통행 가능 여부 확인',
    code:
`// isPassable(x, y, direction) — d: 2=아래, 4=왼쪽, 6=오른쪽, 8=위
var canPass = $gameMap.isPassable(10, 8, 2);
console.log("통행 가능:", canPass);`,
  },
  {
    group: '맵',
    label: '지정 위치 정보 획득',
    code:
`// regionId, terrainTag, tileId를 변수에 저장
$gameVariables.setValue(1, $gameMap.regionId(10, 8));       // 리전 ID
$gameVariables.setValue(2, $gameMap.terrainTag(10, 8));     // 지형 태그
// tileId(x, y, z) — z: 0~3 타일 레이어
$gameVariables.setValue(3, $gameMap.tileId(10, 8, 0));`,
  },

  // ══════════════════════════════════════════
  //  전투 (전투 씬 내 스크립트)
  // ══════════════════════════════════════════
  {
    group: '전투 (전투 씬 전용)',
    label: '적 HP / MP / TP 변경',
    code:
`// 전투 중 적 인덱스 0번 (첫 번째 적)
var enemy = $gameTroop.members()[0];
if (enemy) {
  enemy.gainHp(-200);  // HP -200 (데미지)
  enemy.gainMp(-50);
}`,
  },
  {
    group: '전투 (전투 씬 전용)',
    label: '적 전체 회복',
    code:
`var enemy = $gameTroop.members()[0];
if (enemy) enemy.recoverAll();`,
  },
  {
    group: '전투 (전투 씬 전용)',
    label: '적 출현 / 변신',
    code:
`var enemy = $gameTroop.members()[0];
if (enemy) {
  enemy.appear();            // 적 출현
  // enemy.transform(3);    // 적 ID 3으로 변신
}`,
  },
  {
    group: '전투 (전투 씬 전용)',
    label: '전투 강제 종료 (승리)',
    code:
`BattleManager._victoryflag = true;
$gameTroop.members().forEach(function(e) { e.die(); });`,
  },

  // ══════════════════════════════════════════
  //  디버그 / 유틸리티
  // ══════════════════════════════════════════
  {
    group: '디버그 / 유틸리티',
    label: '콘솔 디버그 출력',
    code:
`console.log("=== 디버그 ===");
console.log("소지금:", $gameParty.gold());
console.log("변수#1:", $gameVariables.value(1));
console.log("스위치#1:", $gameSwitches.value(1));
console.log("플레이어 위치:", $gamePlayer.x, $gamePlayer.y);`,
  },
  {
    group: '디버그 / 유틸리티',
    label: '현재 맵 / 플레이어 정보',
    code:
`console.log("맵 ID:", $gameMap.mapId());
console.log("맵 이름:", $gameMap.displayName());
console.log("플레이어:", $gamePlayer.x, $gamePlayer.y, "dir:", $gamePlayer.direction());
console.log("파티원 수:", $gameParty.size());`,
  },
  {
    group: '디버그 / 유틸리티',
    label: '전체 변수 목록 출력',
    code:
`var vars = $dataSystem.variables;
for (var i = 1; i < vars.length; i++) {
  var val = $gameVariables.value(i);
  if (val !== 0) console.log("[V" + i + "] " + vars[i] + " = " + val);
}`,
  },
  {
    group: '디버그 / 유틸리티',
    label: '전체 스위치 ON 목록 출력',
    code:
`var sw = $dataSystem.switches;
for (var i = 1; i < sw.length; i++) {
  if ($gameSwitches.value(i)) console.log("[S" + i + "] " + sw[i] + " = ON");
}`,
  },
];

/** 그룹 이름 배열 (순서 유지) */
export const SAMPLE_GROUPS: string[] = (() => {
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const s of SCRIPT_SAMPLES) {
    if (!seen.has(s.group)) { seen.add(s.group); groups.push(s.group); }
  }
  return groups;
})();

// 조건 분기 샘플은 별도 파일로 분리됨
export { COND_BRANCH_SAMPLES, COND_BRANCH_SAMPLE_GROUPS } from './condBranchSamples';
