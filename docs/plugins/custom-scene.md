# CustomSceneEngine — 커스텀 씬 엔진

**파일**: `js/plugins/CustomSceneEngine.js`

## 기능 요약

`data/UIScenes/_index.json` + 씬별 JSON 파일을 읽어 커스텀 씬(`Scene_CS_*`)을 동적으로 생성합니다.
에디터의 씬 에디터에서 위젯 트리로 정의한 씬을 게임 런타임에서 실행할 수 있습니다.

> **구 방식 폴백**: `data/UIEditorScenes.json`이 존재하면 `data/UIScenes/`가 없을 때 대신 읽습니다.

## 씬 저장 구조

```
data/
└── UIScenes/
    ├── _index.json          ← 씬 ID 목록 (자동 생성)
    ├── main_menu.json        ← 씬별 정의 파일
    ├── status.json
    └── ...
```

- 에디터에서 저장 시 자동 관리되므로 직접 수정할 필요 없음
- `_index.json`: 씬 ID 배열 (`["main_menu", "status", ...]`)

## 씬 파일 구조 (formatVersion 2)

```json
{
  "id": "main_menu",
  "displayName": "메인 메뉴",
  "formatVersion": 2,
  "category": "clone",
  "prepareArgs": [],
  "root": {
    "id": "root",
    "type": "panel",
    "x": 0, "y": 0, "width": 816, "height": 624,
    "children": [
      {
        "id": "cmd",
        "type": "list",
        "x": 0, "y": 0, "width": 240, "height": 400,
        "items": [
          { "name": "아이템", "symbol": "item" },
          { "name": "장비",   "symbol": "equip" }
        ],
        "handlers": {
          "item":  { "action": "gotoScene", "target": "Scene_Item" },
          "equip": { "action": "gotoScene", "target": "Scene_Equip" }
        }
      }
    ]
  },
  "navigation": {
    "defaultFocus": "cmd"
  }
}
```

## 씬 분류 (category)

| 값 | 설명 |
|----|------|
| *(없음)* | 커스텀 복제 — 오리지널 씬을 대체 |
| `sub` | 서브씬 — 리스트 행 렌더링용 |
| `plugin` | 플러그인이 제공하는 씬 |
| `debug` | 디버그·개발용 씬 |
| `sample` | 샘플·예제 씬 |

## 위젯 종류

| 타입 | 설명 |
|------|------|
| `background` | 배경 이미지/색상 |
| `panel` | 컨테이너 (자식 위젯 그룹) |
| `label` | 텍스트 표시 |
| `textArea` | 여러 줄 텍스트 |
| `image` | 이미지 (파일 / 액터 얼굴·캐릭터) |
| `gauge` | HP·MP·TP 게이지 |
| `separator` | 구분선 |
| `button` | 클릭 가능한 버튼 |
| `list` | 커맨드 목록 창 |
| `textList` | 텍스트 전용 목록 창 |
| `rowSelector` | 행 선택 커서 |
| `options` | 옵션 설정 창 |
| `minimap` | 미니맵 |
| `scene` | 씬 안에 씬 (서브씬 포함) |

## 커맨드 핸들러 액션

| 액션 | 설명 |
|------|------|
| `gotoScene` | 지정 씬으로 전환 (`target`: 씬 클래스명 or `Scene_CS_<id>`) |
| `customScene` | 커스텀 씬으로 전환 |
| `popScene` | 이전 씬으로 돌아가기 |
| `callCommonEvent` | 커먼 이벤트 실행 (`eventId`) |
| `activateWindow` | 지정 위젯 활성화 |
| `focusWidget` | 포커스 이동 |
| `refreshWidgets` | 위젯 갱신 |
| `selectActor` | 액터 선택 |
| `formation` | 대형 변경 |
| `script` | JavaScript 코드 실행 (`code`) |
| `toggleConfig` | 설정 토글 |
| `incrementConfig` / `decrementConfig` | 설정값 증감 |
| `saveConfig` | 설정 저장 |

## 오버레이 씬

씬 정의에서 `"overlay": true`로 설정하면 씬 전환 없이 인게임 맵 위에 UI를 표시합니다.

플러그인 커맨드로 제어:

```
OVERLAY SHOW <sceneId>    — 오버레이 표시 (없으면 생성)
OVERLAY HIDE <sceneId>    — 오버레이 숨김
OVERLAY TOGGLE <sceneId>  — 토글
OVERLAY DESTROY <sceneId> — 제거 (다음 SHOW 시 재생성)
```

## 에디터에서 씬 만들기

1. **UI 에디터** 탭 열기
2. 상단 **씬 선택** → `+` 버튼으로 씬 추가 (ID·이름 입력)
3. 위젯 트리에 위젯 추가·배치
4. 인스펙터에서 핸들러·스타일·애니메이션 설정
5. **저장** → `data/UIScenes/<id>.json` 자동 저장

## 호환성

- RPG Maker MV 1.6.x 이상, NW.js 및 웹 브라우저 배포 모두 지원
- `data/UIScenes/_index.json`이 없으면 아무 씬도 등록하지 않음 (안전한 기본값)
- `UITheme.js`와 함께 사용해야 정상 렌더링됨
