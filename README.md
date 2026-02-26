# RPG Maker MV Editor

| **[에디터 데모 페이지](https://rpgmakerdemo.gosuni.com/)** (저장 안됨) | **[데모 프로젝트](https://rpgmaker-mv-claudetest.pages.dev/)** |
|---|---|
| [![에디터 데모](docs/screenshot-editor.png)](https://rpgmakerdemo.gosuni.com/) | [![데모 프로젝트](docs/screenshot-game.png)](https://rpgmaker-mv-claudetest.pages.dev/) |

RPG Maker MV 프로젝트를 웹 브라우저에서 편집할 수 있는 데스크톱 에디터입니다.

## 다운로드

**[최신 릴리즈](https://github.com/gosuni2025/rpgmaker-mv-editor/releases/latest)**

| 플랫폼 | 파일 |
|---|---|
| macOS Apple Silicon | `*-mac-arm64.dmg` |
| macOS Intel | `*-mac-x64.dmg` |
| Windows | `*-win.zip` |

## 사전 요구사항

- **RPG Maker MV**가 필요합니다. 이 에디터는 RPG Maker MV 프로젝트 파일을 편집하며, 런타임 에셋에 의존합니다.

## 도움말

- [에디터 개요 및 화면 구성](docs/01-overview.md)
- [맵 에디터](docs/02-map-editor.md) — 타일 편집, 조명, 오브젝트, 안개
- [3D 모드](docs/03-3d-mode.md) — 카메라 조작, 렌더링, 스카이박스
- [UI 에디터](docs/04-ui-editor.md) — 스킨 시스템, 커스텀 씬
- [플러그인 목록](docs/05-plugins.md) — 14개 번들 플러그인 문서
- [이벤트 에디터](docs/06-event-editor.md) — 커맨드 편집, 스크립트, 이동 루트, 조건 분기

## AI 연동 (MCP)

MCP(Model Context Protocol) 서버를 내장하고 있어 Claude가 에디터를 직접 조작할 수 있습니다. 맵 생성, 이벤트 작성, 데이터베이스 편집 등을 자연어로 요청할 수 있습니다.

**설정 방법**: [docs/mcp-setup.md](docs/mcp-setup.md)

## 개발

### 요구사항

- Node.js 20+
- npm

### 설치 및 실행

```bash
# 의존성 설치 (루트 한 번만 — client/server 자동 설치됨)
npm install

# 개발 모드 실행 (서버:3001 + 클라이언트:5173, MCP:3002)
npm run dev
```

### 빌드

```bash
# 전체 빌드 (클라이언트 + 서버 + Electron)
npm run build

# 데스크톱 앱 패키징
npm run dist
```

## 아키텍처

- **클라이언트**: React 18 + TypeScript + Vite + Zustand
- **서버**: Express + TypeScript
- **렌더링**: Three.js + RPG Maker MV 런타임 (Spriteset_Map을 직접 사용하여 실제 게임과 동일한 맵 렌더링)
- **데스크톱**: Electron (클라이언트 + 서버를 하나의 앱으로 번들링)
- **AI 연동**: MCP(Model Context Protocol) SSE 서버 내장 (포트 3002)

## 라이선스

[MIT](LICENSE)
