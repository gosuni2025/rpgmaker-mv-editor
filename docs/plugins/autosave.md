# AutoSave — 자동 저장

**파일**: `js/plugins/AutoSave.js`

## 기능 요약

게임 진행 중 특정 이벤트(맵 이동, 전투 종료, 메뉴 닫기)가 발생하면 자동으로 저장합니다. 화면 우상단에 저장 알림이 표시됩니다.

## 자동 저장 트리거

| 트리거 | 기본값 | 파라미터 |
|--------|--------|----------|
| 맵 이동 시 | ✅ ON | enableMapTransferSave |
| 전투 종료 후 | ✅ ON | enableAfterBattle |
| 게임 변수 변경 시 | ❌ OFF | enableOnVariableChange |
| ESC 메뉴 닫기 후 | ✅ ON | enableAfterMenu |

## 파라미터

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| enableMapTransferSave | true | 맵 이동 시 자동 저장 |
| enableAfterBattle | true | 전투 종료 후 자동 저장 |
| enableOnVariableChange | false | 변수 변경 시 자동 저장 |
| variableChangeDelay | 500 | 변수 변경 후 저장 지연 (ms) |
| enableAfterMenu | true | 메뉴 닫기 후 자동 저장 |
| saveCooldown | 30 | 저장 쿨다운 (초) — 이 시간 내 중복 저장 방지 |
| slotLabel | "오토 세이브" | 저장 슬롯에 표시할 레이블 |
| showNotification | true | 저장 완료 알림 표시 |

## 플러그인 커맨드

| 커맨드 | 설명 |
|--------|------|
| `AutoSave` | 즉시 자동 저장 실행 |
| `AutoSaveEnable` | 맵 이동 시 자동 저장 활성화 |
| `AutoSaveDisable` | 맵 이동 시 자동 저장 비활성화 |

## 저장 슬롯

자동 저장은 **슬롯 1번**을 사용합니다. 기존 세이브 슬롯과 충돌하지 않도록 슬롯 번호를 확인하세요.

## 주의사항

- 자동 저장은 수동 저장을 대체하지 않습니다. 중요한 분기점 전에는 수동 저장을 권장합니다.
- `saveCooldown`을 너무 낮게 설정하면 성능에 영향을 줄 수 있습니다.
