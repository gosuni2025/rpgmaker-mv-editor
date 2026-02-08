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
