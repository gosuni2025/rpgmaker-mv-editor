# RPG Maker MV Editor

**[에디터 데모 페이지](https://web-production-f1e8c.up.railway.app/)** (저장 안됨) | **[데모 프로젝트](https://gosuni2025.github.io/rpgmaker-demo/)**

RPG Maker MV 프로젝트를 웹 기반으로 편집할 수 있는 데스크톱 에디터입니다.

## 다운로드

**[최신 릴리즈](https://github.com/gosuni2025/rpgmaker-mv-editor/releases/latest)**

| 플랫폼 | 파일 |
|---|---|
| macOS Apple Silicon | `*-mac-arm64.dmg` |
| macOS Intel | `*-mac-x64.dmg` |
| Windows | `*-win.zip` |

## 사전 요구사항

- **RPG Maker MV**가 필요합니다. 이 에디터는 RPG Maker MV 프로젝트 파일을 편집하며, 런타임 에셋에 의존합니다.

## 개발

### 요구사항

- Node.js 20+
- npm

### 설치 및 실행

```bash
# 의존성 설치 (루트 한 번만 — client/server 자동 설치됨)
npm install

# 개발 모드 실행 (서버:3001 + 클라이언트:5173)
npm run dev
```

### 빌드

```bash
# 전체 빌드 (클라이언트 + 서버 + Electron)
npm run build

# 데스크톱 앱 패키징
npm run dist
```

## 주요 기능

- **맵 편집**: 타일 그리기 (연필, 직사각형, 타원, 채우기), 그림자 편집
- **이벤트 편집**: 이벤트 생성/편집/삭제, 이벤트 커맨드 편집
- **조명 편집**: ShadowAndLight 플러그인 기반 조명 배치/설정
- **오브젝트 편집**: 이미지 오브젝트 배치/변환
- **카메라 영역**: 맵 내 카메라 존 설정
- **데이터베이스**: 액터, 직업, 스킬, 아이템, 무기, 방어구, 적, 적 그룹, 스테이트, 애니메이션, 타일셋, 커먼 이벤트, 시스템/타입/용어 설정
- **3D 모드 지원**: Mode3D/ShadowAndLight/DepthOfField 플러그인 렌더링
- **플레이테스트**: 에디터에서 바로 게임 실행
- **로컬라이제이션**: 다국어 텍스트 관리

## 아키텍처

- **클라이언트**: React 18 + TypeScript + Vite + Zustand
- **서버**: Express + TypeScript
- **렌더링**: Three.js + RPG Maker MV 런타임 (Spriteset_Map을 직접 사용하여 실제 게임과 동일한 맵 렌더링)
- **데스크톱**: Electron (클라이언트 + 서버를 하나의 앱으로 번들링)

### AI 연동

에디터는 프로젝트 `data/` 디렉터리의 외부 파일 변경을 WebSocket으로 감시합니다. AI 도구(또는 외부 프로세스)가 프로젝트 JSON 파일을 수정하면, 에디터가 변경된 데이터를 자동으로 실시간 리로드합니다.

## 라이선스

[MIT](LICENSE)
