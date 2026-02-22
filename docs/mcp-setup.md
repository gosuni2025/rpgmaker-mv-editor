# RPG Maker MV 에디터 MCP 설정 가이드

이 문서는 RPG Maker MV 웹 에디터의 MCP(Model Context Protocol) 서버를 Claude에 연결하는 방법을 안내합니다.

MCP를 설정하면 Claude가 에디터를 직접 조작하여 맵 생성, 이벤트 추가, 데이터베이스 편집 등을 수행할 수 있습니다.

---

## 사전 조건

- RPG Maker MV 웹 에디터가 설치되어 실행 중이어야 합니다 (`npm run dev`)
- 에디터 서버가 **포트 3001**, MCP 서버가 **포트 3002**에서 실행됩니다

---

## Claude Desktop 설정

`~/Library/Application Support/Claude/claude_desktop_config.json` 파일을 열고 아래 내용을 추가합니다.

```json
{
  "mcpServers": {
    "rpgmaker-mv-editor": {
      "type": "sse",
      "url": "http://localhost:3002/sse"
    }
  }
}
```

설정 후 Claude Desktop을 **재시작**합니다.

---

## Claude Code 설정

프로젝트 루트 또는 `~/.claude.json`에 아래 내용을 추가합니다.

```json
{
  "mcpServers": {
    "rpgmaker-mv-editor": {
      "type": "sse",
      "url": "http://localhost:3002/sse"
    }
  }
}
```

또는 Claude Code CLI에서 직접 등록:

```bash
claude mcp add rpgmaker-mv-editor --transport sse http://localhost:3002/sse
```

---

## 연결 확인

에디터 메뉴바 **MCP → MCP 상태 팝업**을 열면 연결된 에이전트 수와 도구 호출 로그를 실시간으로 확인할 수 있습니다.

녹색 점(●)이 표시되면 MCP 서버가 정상 실행 중입니다.

---

## 포트 변경

기본 MCP 포트(3002)가 충돌하는 경우:

1. **MCP → MCP 상태 팝업** 창을 엽니다
2. 포트 입력란에 새 포트 번호를 입력합니다
3. **재시작** 버튼을 클릭합니다
4. Claude 설정의 URL도 새 포트로 업데이트합니다

---

## 사용 가능한 도구 목록

| 도구 | 설명 |
|------|------|
| `get_project_info` | 현재 열린 프로젝트 정보 |
| `list_maps` | 맵 목록 조회 |
| `get_map` | 맵 데이터 조회 |
| `create_map` | 새 맵 생성 |
| `list_events` | 맵의 이벤트 목록 |
| `get_event` | 이벤트 전체 데이터 |
| `create_event` | 이벤트 생성 |
| `update_event` | 이벤트 수정 |
| `search_events` | 전체 맵에서 이벤트 검색 |
| `get_database` | DB 조회 (actors/skills/items 등) |
| `get_database_entry` | DB 단일 항목 조회 |
| `update_database_entry` | DB 항목 수정 |
| `get_event_command_reference` | ★ 이벤트 커맨드 형식 레퍼런스 |

---

## Claude에게 전달할 프롬프트 예시

MCP 연결 후 Claude에게 다음과 같이 요청할 수 있습니다:

```
맵 1의 좌표 (5, 3)에 "마을 사람 A" 이벤트를 만들어줘.
플레이어가 말을 걸면 "안녕하세요, 오늘 날씨가 참 좋네요!" 라고 출력하게 해줘.
```

```
액터 1의 이름을 "알렉스"로 바꾸고 초기 레벨을 5로 설정해줘.
```

```
스위치 10번이 ON일 때만 대화하는 NPC를 맵 2의 (8, 4)에 만들어줘.
```

---

## 문제 해결

**MCP 서버가 시작되지 않는 경우**
- 에디터 서버(`npm run dev`)가 먼저 실행 중인지 확인하세요
- 포트 3002가 다른 프로세스에 의해 사용 중일 수 있습니다. MCP 상태 팝업에서 포트를 변경해보세요

**Claude가 도구를 인식하지 못하는 경우**
- Claude Desktop을 완전히 재시작하세요
- MCP 상태 팝업에서 서버가 실행 중(녹색 점)인지 확인하세요

---

> **Claude에게**: 이 문서를 참고해서 사용자의 Claude에 rpgmaker-mv-editor MCP를 설정해주세요.
> MCP 서버 URL은 `http://localhost:3002/sse`이며, SSE 타입으로 등록하면 됩니다.
> Claude Desktop이라면 `~/Library/Application Support/Claude/claude_desktop_config.json`을,
> Claude Code라면 `~/.claude.json` 또는 `claude mcp add` 명령어를 사용하세요.
