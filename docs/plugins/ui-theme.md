# UITheme — UI 테마 시스템

**파일**: `js/plugins/UITheme.js`

## 기능 요약

에디터의 UI 에디터 기능과 연동하여 게임 내 모든 Window의 스타일(폰트, 투명도, 색조, 스킨)과 배치(위치, 크기)를 커스터마이징합니다. 설정 파일이 없으면 RPG Maker MV 원본과 완전히 동일하게 동작합니다.

## 데이터 파일

| 파일 | 설명 |
|------|------|
| `data/UIEditorConfig.json` | 창별 배치·스타일 오버라이드 설정 |
| `data/UIEditorSkins.json` | 스킨 정의 (9-slice 이미지, cornerSize 등) |
| `data/UIEditorFonts.json` | 커스텀 폰트 정의 |

> 이 파일들은 에디터의 **UI 에디터** 탭에서 시각적으로 편집됩니다. 직접 수정할 수도 있습니다.

## UIEditorConfig.json 구조

```json
{
  "overrides": {
    "Window_MenuCommand": {
      "x": 0,
      "y": 0,
      "width": 240,
      "height": 312,
      "windowStyle": "frame",
      "windowskinName": "my_skin",
      "opacity": 255,
      "backOpacity": 192,
      "colorTone": [0, 0, 0, 0],
      "fontSize": 26,
      "fontName": "GameFont",
      "padding": 18,
      "lineHeight": 36
    }
  }
}
```

### 지원 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `x`, `y` | number | 창 위치 오버라이드 |
| `width`, `height` | number | 창 크기 오버라이드 |
| `windowStyle` | `"frame"` / `"none"` | 프레임 표시 여부 |
| `windowskinName` | string | 사용할 스킨 이름 |
| `opacity` | 0~255 | 창 전체 투명도 |
| `backOpacity` | 0~255 | 배경 투명도 |
| `colorTone` | [R,G,B,A] | 배경 색조 |
| `fontSize` | number | 폰트 크기 |
| `fontName` | string | 폰트 이름 |
| `padding` | number | 내부 여백 |
| `lineHeight` | number | 줄 높이 |

## UIEditorSkins.json 구조 — 9-Slice 스킨

스킨은 `img/system/` 폴더의 이미지를 9-slice 방식으로 잘라 창 배경과 프레임을 렌더링합니다.

```json
{
  "defaultSkin": "Window",
  "skins": [
    {
      "name": "my_skin",
      "file": "my_skin",
      "cornerSize": 12,
      "fillX": 0,
      "fillY": 0,
      "fillW": 96,
      "fillH": 96,
      "frameX": 0,
      "frameY": 96,
      "frameW": 192,
      "frameH": 192
    }
  ]
}
```

### 스킨 필드

| 필드 | 설명 |
|------|------|
| `name` | 스킨 식별자 (Config에서 `windowskinName`으로 참조) |
| `file` | `img/system/` 내 이미지 파일명 (확장자 제외) |
| `cornerSize` | 9-slice 코너 크기 (픽셀) |
| `fillX/Y/W/H` | 배경 fill 영역 좌표/크기 |
| `frameX/Y/W/H` | 프레임 영역 좌표/크기 |

## UIEditorFonts.json 구조

```json
{
  "fonts": [
    {
      "name": "MyFont",
      "file": "fonts/MyFont.ttf"
    }
  ]
}
```

## 에디터에서 편집하기

에디터에서 **UI 에디터** 탭 → **스타일** 패널에서 시각적으로 설정할 수 있습니다:

1. 창 목록에서 대상 창 선택
2. 인스펙터에서 폰트, 색조, 투명도, 스킨 변경
3. 미리보기에서 실시간 확인
4. 저장 시 `UIEditorConfig.json` 자동 업데이트

## 호환성

- RPG Maker MV 1.6.x 이상
- NW.js (로컬 실행) 및 웹 브라우저 배포 모두 지원
- 설정 파일이 없으면 원본 MV 동작과 완전히 동일

## 주의사항

- `windowskinName`을 지정한 경우 해당 이름의 스킨이 `UIEditorSkins.json`에 정의되어 있어야 합니다.
- `colorTone`은 `[R, G, B, A]` 형식으로 입력합니다 (각 -255~255).
- 이 플러그인은 에디터가 자동으로 관리합니다. 직접 수정 시 에디터와 충돌할 수 있습니다.
