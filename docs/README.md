# RPG Maker MV Web Editor — 도움말

RPG Maker MV의 에디터를 웹 브라우저에서 사용할 수 있도록 재구현한 프로젝트입니다.
원본 에디터의 모든 기능을 제공하면서, **3D 렌더링**, **조명 시스템**, **UI 커스터마이징** 등 확장 기능을 추가로 제공합니다.

---

## 목차

### 기본 에디터

| 문서 | 내용 |
|------|------|
| [에디터 개요](01-overview.md) | 화면 구성, 메뉴바, 단축키 |
| [맵 에디터](02-map-editor.md) | 타일 그리기, 이벤트 편집, 오브젝트, 조명, 카메라 존, FOW |
| [3D 모드](03-3d-mode.md) | HD-2D 렌더링, 스카이박스, 카메라 조작 |
| [UI 에디터](04-ui-editor.md) | UITheme 스킨 시스템, 커스텀 씬 엔진 |

### 내장 플러그인

| 문서 | 플러그인 | 요약 |
|------|----------|------|
| [터치 카메라 조작](plugins/touch-camera.md) | TouchCameraControl | 3D 카메라 드래그/핀치 조작 |
| [스카이박스](plugins/skybox.md) | SkyBox | 파노라마 하늘 배경 |
| [오클루전 실루엣](plugins/occlusion-silhouette.md) | OcclusionSilhouette | 캐릭터 가림 시 실루엣 표시 |
| [미니맵](plugins/minimap.md) | Minimap | FoW · 리전 색상 · 마커 |
| [자동 저장](plugins/autosave.md) | AutoSave | 맵 이동/전투 후 자동 저장 |
| [비주얼 노벨 모드](plugins/visual-novel-mode.md) | VisualNovelMode | VN 스타일 메시지 |
| [메뉴 전환 효과](plugins/menu-transition.md) | MenuTransition | 메뉴 배경 blur/sepia 등 효과 |
| [WASD 이동](plugins/wasd-movement.md) | WASD_Movement | WASD 키보드 이동 |
| [아이템 도감](plugins/item-book.md) | ItemBook | 아이템/무기/방어구 도감 |
| [적 도감](plugins/enemy-book.md) | EnemyBook | 적 정보 도감 |
| [텍스트 로그](plugins/text-log.md) | TextLog | 대화 로그 열람 |
| [타이틀 크레딧](plugins/title-credit.md) | TitleCredit | 타이틀 화면 크레딧 |

---

## 원본과의 주요 차이점

### ✅ 추가된 기능

- **3D 렌더링 모드** — 맵을 HD-2D 원근 뷰로 표시
- **조명 시스템 (EXT)** — 맵별 동적 포인트 라이트 / 앰비언트 설정
- **스카이박스 (EXT)** — 3D 모드에서 파노라마 하늘 배경
- **카메라 존 (EXT)** — 특정 영역 진입 시 카메라 고정 / 앵글 변경
- **오브젝트 시스템 (EXT)** — 이미지/타일/애니메이션을 레이어 배치
- **FOW (EXT)** — 맵별 안개 효과 (Fog of War) 설정
- **UI 에디터** — 창 레이아웃 · 9-slice 스킨 · 폰트 시각 편집
- **커스텀 씬 엔진** — JSON으로 게임 내 UI 씬 정의 및 실시간 프리뷰
- **MCP 통합** — Claude AI가 이벤트 커맨드를 직접 작성·수정

### 🔄 호환성

- 원본 RPG Maker MV의 `Map*.json` 형식 그대로 사용
- 확장 데이터는 `Map*_ext.json`에 별도 저장 (원본 에디터와 완전 호환)
- PIXI.js 런타임(`index.html`)과 Three.js 런타임(`index_3d.html`) 공존

---

## 빠른 시작

1. `npm run dev` — 에디터 서버(3001) + 클라이언트(5173) 동시 실행
2. 브라우저에서 `http://localhost:5173` 접속
3. **파일 → 프로젝트 열기** — RPG Maker MV 프로젝트 폴더 선택
4. 맵 트리에서 맵을 더블클릭하여 편집 시작
