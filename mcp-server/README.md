# RPG Maker MV Editor MCP Server

Claude가 RPG Maker MV 에디터를 직접 조작할 수 있게 해주는 MCP 서버입니다.
런타임 소스코드를 읽지 않고도 맵, 이벤트, 데이터베이스를 편집할 수 있습니다.

## 제공 도구

| 도구 | 설명 |
|------|------|
| `get_project_info` | 현재 열린 프로젝트 정보 |
| `list_maps` | 맵 목록 조회 |
| `get_map` | 맵 데이터 조회 |
| `create_map` | 새 맵 생성 |
| `list_events` | 맵 이벤트 목록 |
| `get_event` | 이벤트 전체 조회 |
| `create_event` | 이벤트 생성 |
| `update_event` | 이벤트 수정 |
| `update_event_page` | 이벤트 페이지 수정 |
| `delete_event` | 이벤트 삭제 |
| `search_events` | 이벤트 검색 |
| `get_event_command_reference` | 이벤트 커맨드 스키마 레퍼런스 ★ |
| `get_database` | DB 전체 조회 |
| `get_database_entry` | DB 단일 항목 조회 |
| `update_database_entry` | DB 항목 수정 |
| `add_database_entry` | DB 항목 추가 |
| `get_common_event` | 커먼 이벤트 조회 |
| `update_common_event` | 커먼 이벤트 수정 |

## 설치

### 1. 빌드

```bash
cd editor/mcp-server
npm install
npm run build
```

### 2. Claude Desktop 설정

`~/Library/Application Support/Claude/claude_desktop_config.json` 에 추가:

```json
{
  "mcpServers": {
    "rpgmaker-mv-editor": {
      "command": "node",
      "args": ["/절대경로/editor/mcp-server/dist/index.js"],
      "env": {
        "EDITOR_URL": "http://localhost:3001"
      }
    }
  }
}
```

### 3. Claude Code 설정

`.claude.json` 또는 프로젝트의 `.mcp.json` 에 추가:

```json
{
  "mcpServers": {
    "rpgmaker-mv-editor": {
      "command": "node",
      "args": ["/절대경로/editor/mcp-server/dist/index.js"],
      "env": {
        "EDITOR_URL": "http://localhost:3001"
      }
    }
  }
}
```

## 사용 방법

1. 에디터 서버 실행: `npm run dev` (port 3001)
2. 에디터에서 프로젝트 열기
3. Claude에서 자연어로 요청:

```
맵 1의 이벤트 목록을 보여줘
맵 2의 좌표 5,3에 "마을 사람" 이벤트를 만들어줘. 플레이어가 접촉하면 "안녕하세요!" 라는 대화를 출력하고 싶어.
액터 1의 이름을 "용사 루카"로 변경해줘
```

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `EDITOR_URL` | `http://localhost:3001` | 에디터 서버 주소 |

## API 수정 시 동기화

| 케이스 | 대응 |
|--------|------|
| 기존 API 로직 변경 | 자동 반영 (MCP는 API만 호출) |
| 새 API 엔드포인트 추가 | `src/tools/` 에 도구 추가 필요 |
| API URL 변경 | `src/client.ts` 한 곳만 수정 |
