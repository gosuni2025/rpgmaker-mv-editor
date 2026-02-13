# RPG Maker MV Editor

RPG Maker MV 프로젝트를 웹 기반으로 편집할 수 있는 데스크톱 에디터입니다.

## 다운로드

**[최신 버전 다운로드](https://github.com/painh/rpgmaker-mv-editor/releases/latest)**

| 플랫폼 | 파일 |
|--------|------|
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Windows | `.exe` (설치 프로그램) / `.zip` |
| Linux | `.AppImage` / `.zip` |

## 사전 요구사항

- **RPG Maker MV**가 필요합니다. 이 에디터는 RPG Maker MV 프로젝트 파일을 편집하며, 런타임 에셋에 의존합니다.

## 개발

### 요구사항

- Node.js 20+
- npm

### 설치 및 실행

```bash
# 의존성 설치
npm install
cd server && npm install
cd ../client && npm install
cd ..

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

## 아키텍처

- **클라이언트**: React 18 + TypeScript + Vite + Zustand
- **서버**: Express + TypeScript
- **데스크톱**: Electron (클라이언트 + 서버를 하나의 앱으로 번들링)

### AI 연동

에디터는 프로젝트 `data/` 디렉터리의 외부 파일 변경을 WebSocket으로 감시합니다. AI 도구(또는 외부 프로세스)가 프로젝트 JSON 파일을 수정하면, 에디터가 변경된 데이터를 자동으로 실시간 리로드합니다.

## 라이선스

[MIT](LICENSE)
