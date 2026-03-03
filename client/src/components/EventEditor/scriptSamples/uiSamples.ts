import type { ScriptSample } from './gameSamples';

export const UI_SCRIPT_SAMPLES: ScriptSample[] = [

  // ────────── $ctx ──────────
  {
    group: '$ctx (씬 컨텍스트)',
    label: '$ctx 값 읽기',
    code:
`// 씬 레벨 공유 컨텍스트 객체
var idx = $ctx.actorIndex;
console.log("actorIndex:", idx);`,
  },
  {
    group: '$ctx (씬 컨텍스트)',
    label: '$ctx 값 변경 후 위젯 갱신',
    code:
`$ctx.actorIndex = ($ctx.actorIndex + 1) % $gameParty.size();
$scene.refreshWidgets();`,
  },
  {
    group: '$ctx (씬 컨텍스트)',
    label: '$ctx.item 아이템 정보 읽기',
    code:
`var item = $ctx.item;
if (item) {
  console.log("이름:", item.name);
  console.log("설명:", item.description);
  console.log("가격:", item.price);
}`,
  },

  // ────────── 씬 전환 ──────────
  {
    group: '씬 전환',
    label: '씬 닫기 (popScene)',
    code:
`SceneManager.pop();`,
  },
  {
    group: '씬 전환',
    label: '커스텀 씬 이동 (push)',
    code:
`// 씬 ID로 이동 (registerCustomScenes로 등록된 씬)
SceneManager.push(window['Scene_CS_status']);`,
  },
  {
    group: '씬 전환',
    label: '커스텀 씬 이동 + 데이터 전달',
    code:
`// prepare()에서 args를 $ctx에 복사함
var scene = window['Scene_CS_itemDetail'];
SceneManager.push(scene);
SceneManager.prepareNextScene($ctx.item);`,
  },
  {
    group: '씬 전환',
    label: 'Scene_Map으로 돌아가기',
    code:
`SceneManager.goto(Scene_Map);`,
  },

  // ────────── 위젯 조작 ──────────
  {
    group: '위젯 조작',
    label: '위젯 찾기',
    code:
`// $scene._rootWidget.findWidget(id)
var widget = $scene._rootWidget.findWidget('btn_ok');
if (widget) console.log("위젯 발견:", widget._id);`,
  },
  {
    group: '위젯 조작',
    label: '위젯 visible 토글',
    code:
`var widget = $scene._rootWidget.findWidget('panel_info');
if (widget && widget._displayObject) {
  widget._displayObject.visible = !widget._displayObject.visible;
}`,
  },
  {
    group: '위젯 조작',
    label: '버튼 disabled 설정',
    code:
`var btn = $scene._rootWidget.findWidget('btn_ok');
if (btn && typeof btn.setDisabled === 'function') {
  btn.setDisabled(true);  // false로 해제
}`,
  },
  {
    group: '위젯 조작',
    label: '씬 전체 위젯 갱신',
    code:
`// $scene.refreshWidgets() — 모든 위젯 redraw
$scene.refreshWidgets();`,
  },
  {
    group: '위젯 조작',
    label: '위젯 포커스 이동',
    code:
`// NavigationManager로 특정 위젯에 포커스
if ($scene._navManager) {
  $scene._navManager.focusWidget('btn_ok');
}`,
  },

  // ────────── 사운드 ──────────
  {
    group: '사운드',
    label: 'SE 재생 (커서)',
    code:
`SoundManager.playCursor();`,
  },
  {
    group: '사운드',
    label: 'SE 재생 (OK)',
    code:
`SoundManager.playOk();`,
  },
  {
    group: '사운드',
    label: 'SE 재생 (취소)',
    code:
`SoundManager.playCancel();`,
  },
  {
    group: '사운드',
    label: 'SE 파일 직접 재생',
    code:
`AudioManager.playSe({ name: "Cursor1", volume: 80, pitch: 100, pan: 0 });`,
  },
  {
    group: '사운드',
    label: 'BGM 변경',
    code:
`AudioManager.playBgm({ name: "Town1", volume: 90, pitch: 100, pan: 0 });`,
  },

  // ────────── 변수 / 스위치 ──────────
  {
    group: '변수 / 스위치',
    label: '변수 값 설정',
    code:
`$gameVariables.setValue(1, 100);`,
  },
  {
    group: '변수 / 스위치',
    label: '변수 읽기 → $ctx 저장',
    code:
`$ctx.myVar = $gameVariables.value(1);`,
  },
  {
    group: '변수 / 스위치',
    label: '스위치 ON',
    code:
`$gameSwitches.setValue(1, true);`,
  },

  // ────────── 파티 / 액터 ──────────
  {
    group: '파티 / 액터',
    label: '현재 선택 액터 가져오기',
    code:
`var actor = $gameParty.members()[$ctx.actorIndex || 0];
console.log("액터:", actor ? actor.name() : "없음");`,
  },
  {
    group: '파티 / 액터',
    label: '아이템 사용 가능 여부 확인',
    code:
`var actor = $gameParty.members()[0];
var item = $ctx.item;
if (actor && item) {
  var canUse = actor.canUse(item);
  console.log("사용 가능:", canUse);
}`,
  },
  {
    group: '파티 / 액터',
    label: '아이템 사용',
    code:
`var actor = $gameParty.members()[$ctx.actorIndex || 0];
var item = $ctx.item;
if (actor && item && actor.canUse(item)) {
  actor.useItem(item);
  $scene.refreshWidgets();
}`,
  },

  // ────────── 설정 (ConfigManager) ──────────
  {
    group: '설정 (ConfigManager)',
    label: '볼륨 읽기',
    code:
`console.log("BGM:", ConfigManager.bgmVolume);
console.log("SFX:", ConfigManager.seVolume);`,
  },
  {
    group: '설정 (ConfigManager)',
    label: '볼륨 변경 후 저장',
    code:
`ConfigManager.bgmVolume = Math.min(100, ConfigManager.bgmVolume + 20);
ConfigManager.save();
AudioManager.updateBgmParameters(AudioManager._currentBgm);`,
  },
  {
    group: '설정 (ConfigManager)',
    label: '항상 대시 토글',
    code:
`ConfigManager.alwaysDash = !ConfigManager.alwaysDash;
ConfigManager.save();`,
  },
];

export const UI_SAMPLE_GROUPS: string[] = (() => {
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const s of UI_SCRIPT_SAMPLES) {
    if (!seen.has(s.group)) { seen.add(s.group); groups.push(s.group); }
  }
  return groups;
})();
