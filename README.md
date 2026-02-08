# RPG Maker MV Web Editor

RPG Maker MV 에디터를 웹 브라우저에서 사용할 수 있도록 재구현한 프로젝트입니다.

## 기술 스택

- **Client**: React 18 + TypeScript + Vite + Zustand
- **Server**: Express + TypeScript (tsx)
- **통신**: REST API + WebSocket (파일 변경 감지)

## 실행 방법

### 사전 요구사항

- Node.js 18+
- npm

### 설치

```bash
# 루트 의존성 설치
npm install

# 서버 의존성 설치
cd server && npm install && cd ..

# 클라이언트 의존성 설치
cd client && npm install && cd ..
```

### 개발 서버 실행

```bash
npm run dev
```

서버(port 3001)와 클라이언트(port 5173)가 동시에 실행됩니다.

브라우저에서 http://localhost:5173 으로 접속하면 에디터를 사용할 수 있습니다.

## AI 연동 (외부 파일 변경 감지)

이 에디터의 핵심 목적은 **AI(Claude 등)가 RPG Maker MV 프로젝트 데이터를 직접 수정했을 때, 에디터에 실시간으로 반영**되는 것입니다.

원본 RPG Maker MV 에디터는 외부에서 파일이 변경되어도 감지하지 못하지만, 이 웹 에디터는 WebSocket 기반 파일 감시를 통해 자동으로 리로드합니다.

### 동작 방식

1. 서버가 프로젝트 `data/` 디렉토리의 JSON 파일 변경을 감시 (`fs.watch`)
2. 외부 변경 감지 시 WebSocket으로 클라이언트에 `fileChanged` 메시지 전송
3. 클라이언트가 변경된 파일 종류에 따라 자동 리로드

### 리로드 대상

| 파일 | 동작 |
|------|------|
| `MapXXX.json` | 현재 열린 맵이면 맵 데이터 리로드 |
| `MapInfos.json` | 맵 트리 리로드 |
| `System.json` | 시스템 데이터 리로드 |
| `Tilesets.json` | 타일셋 정보 리로드 |
| 기타 DB 파일 | `window` `fileChanged` 이벤트 발행 |

### 자체 저장 구분

에디터 자체에서 저장한 경우(`Ctrl+S` 등)는 리로드하지 않습니다. 서버의 `markApiWrite`로 API를 통한 저장을 기록하고, 2초 내 변경은 외부 변경이 아닌 것으로 판단합니다.
