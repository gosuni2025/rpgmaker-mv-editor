# CustomSceneEngine — 커스텀 씬 엔진

**파일**: `js/plugins/CustomSceneEngine.js`

## 기능 요약

`data/UIEditorScenes.json` 파일을 읽어 커스텀 씬(`Scene_CS_*`)을 동적으로 생성합니다. 에디터의 씬 에디터에서 JSON으로 정의한 씬을 이벤트 커맨드로 실행할 수 있습니다.

## 씬 정의 파일 (UIEditorScenes.json)

에디터의 **UI 에디터** → **씬** 탭에서 시각적으로 편집하거나, 직접 JSON을 수정할 수 있습니다.

```json
{
  "scenes": [
    {
      "id": "main_menu",
      "name": "메인 메뉴",
      "windows": [
        {
          "id": "cmd_window",
          "type": "command",
          "x": 0, "y": 0,
          "width": 240,
          "commands": [
            { "name": "아이템", "symbol": "item" },
            { "name": "장비",   "symbol": "equip" },
            { "name": "저장",   "symbol": "save" }
          ],
          "handlers": {
            "item":  { "action": "scene", "scene": "item_scene" },
            "equip": { "action": "scene", "scene": "equip_scene" },
            "save":  { "action": "scene", "scene": "save_scene" }
          }
        },
        {
          "id": "info_window",
          "type": "display",
          "x": 240, "y": 0,
          "width": 400, "height": 200,
          "elements": [
            { "type": "label",    "text": "{actor[0].name}", "x": 10, "y": 10 },
            { "type": "variable", "id": 1, "label": "금화", "x": 10, "y": 40 }
          ]
        }
      ]
    }
  ]
}
```

## 윈도우 타입

| 타입 | 설명 |
|------|------|
| `command` | 선택 가능한 커맨드 목록 창 |
| `display` | 정보 표시 전용 창 |

## 엘리먼트 타입 (display 창)

| 타입 | 설명 |
|------|------|
| `label` | 고정 텍스트 또는 템플릿 변수 표시 |
| `variable` | 게임 변수 값 표시 |
| `configValue` | ConfigManager 값 표시 |

## 템플릿 변수

텍스트 내 `{...}` 형식으로 게임 데이터를 동적으로 표시할 수 있습니다.

| 표현식 | 설명 |
|--------|------|
| `{actor[0].name}` | 파티 첫 번째 액터 이름 |
| `{actor[0].level}` | 첫 번째 액터 레벨 |
| `{actor[0].hp}` / `{actor[0].mhp}` | HP / 최대 HP |
| `{actor[0].mp}` / `{actor[0].mmp}` | MP / 최대 MP |
| `{var:1}` | 게임 변수 1번 값 |
| `{switch:1}` | 게임 스위치 1번 값 (ON/OFF) |
| `{gold}` | 파티 소지금 |
| `{config.bgmVolume}` | ConfigManager 설정값 |

## 플러그인 커맨드

이벤트에서 커스텀 씬을 열 때 사용합니다.

```
[플러그인 커맨드] CustomScene open main_menu
```

| 커맨드 | 설명 |
|--------|------|
| `CustomScene open [씬ID]` | 지정한 커스텀 씬 열기 |

## 핸들러 액션 타입

커맨드 창에서 항목 선택 시 실행할 동작을 지정합니다.

| 액션 | 설명 |
|------|------|
| `scene` | 다른 씬으로 전환 (`"scene": "씬ID"`) |
| `script` | JavaScript 코드 실행 (`"script": "코드"`) |
| `close` | 현재 씬 닫기 |
| `back` | 이전 씬으로 돌아가기 |

## 에디터에서 씬 만들기

1. **UI 에디터 탭** 열기
2. **씬 추가** 버튼 클릭 → 씬 ID와 이름 입력
3. **윈도우 추가** → command 또는 display 타입 선택
4. 커맨드 추가, 위치/크기 조정, 핸들러 설정
5. **저장** → `UIEditorScenes.json` 자동 업데이트

## 호환성

- RPG Maker MV 1.6.x 이상
- NW.js 및 웹 브라우저 배포 모두 지원
- `UIEditorScenes.json`이 없으면 아무 씬도 등록하지 않음 (안전한 기본값)

## 주의사항

- 씬 ID는 영문/숫자/언더스코어만 사용하세요. 내부적으로 `Scene_CS_[ID]`로 클래스가 생성됩니다.
- 이 플러그인은 에디터가 자동으로 관리합니다. `UITheme.js`와 함께 사용되어야 합니다.
- 복잡한 씬 로직이 필요한 경우 `script` 핸들러로 JavaScript를 직접 실행할 수 있습니다.
