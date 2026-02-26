# Minimap — 미니맵

**파일**: `js/plugins/Minimap.js`
**버전**: v1.1

## 기능 요약

게임 화면 구석에 미니맵을 표시합니다. Fog of War(안개 효과), 리전/지형 태그별 색상 매핑, 커스텀 마커를 지원하며 2D와 3D 모드 모두 작동합니다.

## 주요 기능

- **원형 또는 사각형** 미니맵 형태
- **Fog of War** — 탐색한 영역만 표시
- **리전 색상 매핑** — 리전 ID별로 다른 색상 표시
- **지형 태그 색상** — 통행성 태그별 색상
- **플레이어/이벤트 마커** — 위치 표시 점
- **카메라 방향 회전** — 3D 모드에서 카메라 yaw에 따라 미니맵 회전

## 파라미터

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| showOnStart | true | 시작 시 미니맵 표시 |
| shape | circle | 형태 (circle / square) |
| size | 160 | 크기 (px) |
| margin | 10 | 화면 가장자리 여백 (px) |
| opacity | 210 | 불투명도 (0~255) |
| rotation | north | 방향 (north 고정 / camera 회전) |
| tileSize | 4 | 미니맵 타일 크기 (px) |
| viewRadius | 6 | FoW 시야 반경 (타일) |
| fowEnabled | true | Fog of War 활성화 |
| bgColor | #000000 | 배경 색상 |
| wallColor | #555555 | 통행 불가 타일 색상 |
| floorColor | #aaaaaa | 통행 가능 타일 색상 |
| playerColor | #ffff00 | 플레이어 마커 색상 |
| eventMarkerColor | #ff4444 | 이벤트 마커 색상 |
| borderColor | #888888 | 미니맵 테두리 색상 |
| regionColors | `{}` | 리전 ID별 색상 JSON |
| terrainColors | `{}` | 지형 태그별 색상 JSON |

## 리전 색상 예시

```json
{
  "1": "#ff0000",
  "2": "#00ff00",
  "3": "#0000ff"
}
```

리전 1번 타일은 빨간색, 2번은 초록색, 3번은 파란색으로 표시됩니다.

## 플러그인 커맨드

| 커맨드 | 설명 |
|--------|------|
| `MinimapShow` | 미니맵 표시 |
| `MinimapHide` | 미니맵 숨김 |
| `MinimapToggle` | 미니맵 표시/숨김 전환 |

## 이벤트 마커 설정

이벤트의 노트(메모) 필드에 다음을 입력하면 미니맵에 특별 마커가 표시됩니다:

```
<minimap_marker: red>
<minimap_marker: #ff8800>
```
