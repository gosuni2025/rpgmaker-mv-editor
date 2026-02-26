# OcclusionSilhouette — 오클루전 실루엣

**파일**: `js/plugins/OcclusionSilhouette.js`

## 기능 요약

플레이어(또는 파티원)가 이미지 오브젝트나 상층 타일 뒤에 가려졌을 때, 가려진 부분을 실루엣으로 렌더링하여 플레이어의 위치를 항상 파악할 수 있게 합니다.

**지원 패턴**: solid, empty, dot, diagonal, cross, hatch

## 파라미터

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| Fill Color | #3366ff | 실루엣 채움 색상 (HEX) |
| Fill Opacity | 0.35 | 채움 투명도 (0.0 ~ 1.0) |
| Outline Color | #ffffff | 외곽선 색상 |
| Outline Opacity | 0.8 | 외곽선 투명도 |
| Outline Width | 2 | 외곽선 두께 (px) |
| Pattern | solid | 채움 패턴 |
| Pattern Scale | 8 | 패턴 반복 크기 (px) |
| Include Followers | false | 파티원도 실루엣 처리 |

## 패턴 종류

| 패턴 | 설명 |
|------|------|
| `solid` | 단색 채움 |
| `empty` | 외곽선만 표시 |
| `dot` | 점 패턴 |
| `diagonal` | 대각선 줄무늬 |
| `cross` | 격자 패턴 |
| `hatch` | 해치 패턴 |

## 사용 예시

### 건물 내부 탐색

실내 맵에서 벽이나 지붕 오브젝트 뒤로 이동할 때, 캐릭터의 위치가 파란 실루엣으로 표시됩니다.

### 파티원 포함

`Include Followers: true`로 설정하면 파티원도 실루엣 처리 대상에 포함됩니다.
