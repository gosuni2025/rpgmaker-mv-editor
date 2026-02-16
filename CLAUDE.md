# RPG Maker MV Web Editor

RPG Maker MV의 에디터를 웹 기반으로 재구현하는 프로젝트.

작업 마치면 반드시 커밋할것.

> **IMPORTANT**: 반드시 `CLAUDE.local.md` 파일을 함께 읽을 것. 이 파일은 `.gitignore`에 포함되어 Git에 커밋되지 않으며, 로컬 환경에 한정된 설정(Node.js 설치 방식, 경로, 환경변수 등)을 담고 있다. 로컬 환경 관련 문제 발생 시 이 파일을 먼저 참조할 것.

## 프로젝트 개요

- RPG Maker MV 원본 에디터의 기능을 웹 브라우저에서 사용 가능하도록 재구성
- 테스트 대상 RPG Maker MV 프로젝트 경로 및 도움말 경로는 `CLAUDE.local.md` 참조

## 기술 스택

- **Client**: React 18 + TypeScript + Vite + Zustand (상태 관리)
- **Server**: Express + TypeScript (tsx로 실행)
- **렌더링**: Three.js (PixiJS 제거됨) — RPG Maker MV 런타임(rpg_core/rpg_sprites 등)의 Spriteset_Map을 직접 사용하여 맵 렌더링
- **통신**: REST API (`/api/*`) + WebSocket (파일 변경 감지)
- **개발 실행**: `npm run dev` (concurrently로 서버:3001 + 클라이언트:5173 동시 실행)

### Three.js 렌더링 주의사항 (Y-flip)

RPG Maker MV의 Mode3D 플러그인이 projection matrix의 Y축을 반전(`m[5] = -m[5]`)하므로, 에디터에서 3D 씬에 직접 추가하는 오버레이 객체는 다음을 준수해야 함:
- **THREE.Sprite 사용 불가** — Y-반전 projection matrix와 호환 안 됨 → PlaneGeometry Mesh 사용
- **CanvasTexture Y-flip 보정** 필요 (`ctx.scale(1,-1)`)
- **`frustumCulled = false`** 필수 (PerspectiveCamera frustum 밖으로 컬링 방지)

### Three.js 렌더링 주의사항 (depthTest off & renderOrder)

현재 타일 메시, 스프라이트 등 거의 모든 오브젝트가 `depthTest: false`, `depthWrite: false`로 설정되어 있음. 따라서 **position.z 값은 렌더링 순서에 영향을 주지 않으며**, 오직 `renderOrder`만으로 앞뒤가 결정됨.

- `renderOrder`는 `ThreeRendererStrategy._syncHierarchy`에서 tilemap의 `_sortChildren()` 정렬 순서(PIXI 호환 `.z` 속성 기준)를 따라 할당됨
- RPG Maker MV의 PIXI `.z` 값 체계: `0=Lower tiles, 1=Lower chars, 3=Normal chars, 4=Upper tiles, 5=Upper chars, 6~9=기타`
- **upper layer 타일(z=4)은 z=3 이하의 모든 오브젝트를 덮어씀** — 이는 2D에서는 정상(지붕 아래로 숨는 효과)이지만, 3D 모드에서 이미지 오브젝트 등에 문제가 됨
- 현재 이미지 오브젝트는 `z=5`로 설정하여 upper 타일 위에 그려지도록 우회함
- **근본적 해결**: 3D 모드에서 depthTest를 활성화하고 position.z 기반 깊이 판별로 전환해야 하나, 투명도 정렬 문제(반투명 오브젝트 간 정렬)가 수반됨
- 관련 파일: `ThreeTilemap.js`(타일 메시 material), `ThreeSprite.js`(스프라이트 material), `ThreeRendererStrategy.js`(renderOrder 할당)

## 디렉터리 구조

```
editor/
├── client/                     # React 프론트엔드
│   ├── src/
│   │   ├── App.tsx             # 메인 레이아웃 (grid: menubar/sidebar/main/statusbar)
│   │   ├── App.css             # 전역 스타일 (리셋, 레이아웃, 모달, 스크롤바)
│   │   ├── main.tsx            # 엔트리포인트
│   │   ├── api/client.ts       # API 클라이언트 (fetch wrapper: get/post/put/delete/upload)
│   │   ├── store/useEditorStore.ts  # Zustand 전역 상태
│   │   ├── types/rpgMakerMV.ts # RPG Maker MV 데이터 타입 정의
│   │   └── components/
│   │       ├── MenuBar/MenuBar.tsx
│   │       ├── Sidebar/
│   │       │   ├── MapTree.tsx          # 맵 트리 (계층구조)
│   │       │   └── TilesetPalette.tsx   # 타일셋 팔레트
│   │       ├── MapEditor/
│   │       │   ├── MapCanvas.tsx        # 맵 캔버스 (타일 렌더링)
│   │       │   ├── DrawToolbar.tsx      # 그리기 도구 모음
│   │       │   └── MapPropertiesDialog.tsx
│   │       ├── Database/               # 데이터베이스 편집 다이얼로그
│   │       │   ├── DatabaseDialog.tsx   # 메인 DB 다이얼로그 (탭 컨테이너)
│   │       │   ├── ActorsTab.tsx
│   │       │   ├── ClassesTab.tsx
│   │       │   ├── SkillsTab.tsx
│   │       │   ├── ItemsTab.tsx
│   │       │   ├── WeaponsTab.tsx
│   │       │   ├── ArmorsTab.tsx
│   │       │   ├── EnemiesTab.tsx
│   │       │   ├── TroopsTab.tsx
│   │       │   ├── StatesTab.tsx
│   │       │   ├── AnimationsTab.tsx
│   │       │   ├── TilesetsTab.tsx
│   │       │   ├── CommonEventsTab.tsx
│   │       │   ├── SystemTab.tsx
│   │       │   ├── TypesTab.tsx
│   │       │   └── TermsTab.tsx
│   │       ├── EventEditor/
│   │       │   ├── EventList.tsx
│   │       │   ├── EventDetail.tsx
│   │       │   └── EventCommandEditor.tsx
│   │       ├── common/
│   │       │   ├── StatusBar.tsx
│   │       │   ├── ResizablePanel.tsx
│   │       │   ├── TraitsEditor.tsx
│   │       │   ├── EffectsEditor.tsx
│   │       │   ├── ImagePicker.tsx
│   │       │   ├── AudioPicker.tsx
│   │       │   ├── IconPicker.tsx
│   │       │   └── DamageEditor.tsx
│   │       ├── OpenProjectDialog.tsx
│   │       ├── NewProjectDialog.tsx
│   │       ├── DeployDialog.tsx
│   │       ├── FindDialog.tsx
│   │       ├── EventSearchDialog.tsx
│   │       ├── PluginManagerDialog.tsx
│   │       ├── SoundTestDialog.tsx
│   │       ├── ResourceManagerDialog.tsx
│   │       └── CharacterGeneratorDialog.tsx
│   └── vite.config.ts          # Vite 설정 (proxy: /api -> localhost:3001)
│
├── server/                     # Express 백엔드
│   ├── index.ts                # 서버 엔트리 (Express + WebSocket)
│   ├── routes/
│   │   ├── project.ts          # 프로젝트 열기/닫기
│   │   ├── maps.ts             # 맵 CRUD
│   │   ├── database.ts         # DB 데이터 읽기/쓰기
│   │   ├── resources.ts        # 이미지 리소스
│   │   ├── audio.ts            # 오디오 파일
│   │   ├── plugins.ts          # 플러그인 관리
│   │   └── events.ts           # 이벤트 검색
│   └── services/
│       ├── projectManager.ts   # 프로젝트 경로/파일 관리
│       └── fileWatcher.ts      # 파일 변경 감지 (WebSocket 브로드캐스트)
│
└── package.json                # 루트 (concurrently로 dev 실행)
```

## RPG Maker MV 데이터 구조

프로젝트 데이터는 `data/` 폴더에 JSON 파일로 저장됨:
- `Actors.json`, `Classes.json`, `Skills.json`, `Items.json`
- `Weapons.json`, `Armors.json`, `Enemies.json`, `Troops.json`
- `States.json`, `Animations.json`, `Tilesets.json`, `CommonEvents.json`
- `System.json` - 게임 시스템 설정 (타이틀, 용어, 사운드 등)
- `MapInfos.json` - 맵 목록 (트리 구조)
- `Map001.json` ~ `MapNNN.json` - 개별 맵 데이터

맵 데이터 구조:
- `data[]`: 1차원 배열, 인덱스 = `(z * height + y) * width + x` (z: 레이어 0~3)
- `events[]`: 맵 이벤트 배열 (null 가능, id 기반 인덱싱)
- `tilesetId`: 사용할 타일셋 ID

타일 ID 규칙 (RPG Maker MV):
- 0: 빈 타일
- 1~255: Region ID (레이어 z=3 사용)
- 2048~: A1 타일 (바다/물)
- 2816~: A2 타일 (지형)
- 4352~: A3 타일 (건물 외벽)
- 5888~: A4 타일 (건물 벽/지형)
- 1536~: A5 타일
- 256~511: B 타일
- 512~767: C 타일
- 768~1023: D 타일
- 1024~1279: E 타일

## 에디터 기능 (원본 RPG Maker MV 기준)

### 메인 에디터
- **메뉴바**: 파일, 편집, 모드, 그리기, 축척, 도구, 게임, 도움말
- **사이드바**: 타일셋 팔레트 (상단) + 맵 트리 (하단)
- **메인 영역**: 맵 캔버스 (타일 그리기/이벤트 편집)
- **상태바**: 현재 위치, 줌 레벨 등

### 편집 모드
- **맵 모드**: 타일 그리기 (펜, 직사각형, 타원, 채우기, 영역선택)
- **이벤트 모드**: 이벤트 생성/편집/삭제

### 데이터베이스 편집기
- 액터, 직업, 스킬, 아이템, 무기, 방어구
- 적, 적 그룹, 스테이트, 애니메이션
- 타일셋, 커먼 이벤트
- 시스템 설정, 타입 설정, 용어 설정

### 기타 도구
- 플러그인 매니저, 사운드 테스트, 이벤트 검색
- 리소스 매니저, 캐릭터 생성기
- 배포 (Deploy), 찾기, 플레이테스트

## RPG Maker MV 공식 도움말 참조

도움말 HTML 파일 위치는 `CLAUDE.local.md` 참조

주요 섹션:
- `01_04.html` - 메뉴바
- `01_07*.html` - 맵 (디자인, 데이터, 속성)
- `01_08*.html` - 데이터베이스 (액터~용어 설정)
- `01_09*.html` - 이벤트 시스템
- `01_10*.html` - 이벤트 커맨드 (메시지, 진행, 흐름제어, 파티, 액터, 이동, 캐릭터, 그림, 타이밍, 화면, 오디오, 씬, 시스템, 맵, 전투, 고급)
- `01_11*.html` - 문서 (에셋 규격, 플러그인, 배포 형식)
- `03_*.html` - JS 라이브러리 API 레퍼런스 (데이터 구조 상세)

## 확장 데이터 저장 규칙

에디터 전용 확장 데이터(editorLights, objects, cameraZones 등)는 원본 RPG Maker MV와의 호환성을 위해 별도 파일에 저장됨:

```
data/
├── Map001.json      ← RPG Maker MV 표준 필드만 (원본 에디터와 호환)
├── Map001_ext.json  ← 에디터 확장 데이터
```

- **서버 측에서 투명하게 처리**: 클라이언트는 변경 없이 기존처럼 사용
- **API GET**: MapXXX.json + MapXXX_ext.json 병합 반환
- **API PUT**: EXTENSION_FIELDS를 분리하여 각각 저장
- **정적 서빙** (`/data/`, `/game/data/`): 맵 파일 요청 시 동적 병합
- **EXTENSION_FIELDS**: `editorLights`, `objects`, `cameraZones` (maps.ts에 정의)
- **STRIP_ONLY_FIELDS**: `tilesetNames` (저장 시 제거, ext에도 넣지 않음)
- 새 확장 필드 추가 시 `EXTENSION_FIELDS` 배열에 추가할 것

## 개발 규칙

- 작업 완료 시 반드시 커밋할 것
- 한국어 UI 사용 (테스트 프로젝트도 한국어 로케일: ko_KR)
- 다크 테마 IDE 스타일 유지 (배경 #2b2b2b, 텍스트 #ddd, 강조 #2675bf)
- 컴포넌트 스타일은 각 컴포넌트 디렉터리의 CSS 파일로 관리 (App.css는 전역 스타일만)
