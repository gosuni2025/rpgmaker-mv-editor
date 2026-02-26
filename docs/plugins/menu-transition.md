# MenuTransition — 메뉴 배경 전환 효과

**파일**: `js/plugins/MenuTransition.js`

## 기능 요약

메뉴·아이템·스킬 등 UI 씬이 열릴 때 맵 배경에 시각 효과를 적용합니다.
메뉴가 열리면 효과가 서서히 강해지고, 닫히면 서서히 사라집니다.

## 지원 효과 (15종)

| 효과 | 설명 |
|------|------|
| `blur` | 가우시안 블러 |
| `zoomBlur` | 중심에서 퍼지는 방사형 블러 |
| `desaturation` | 채도 감소 (흑백 전환) |
| `sepia` | 세피아 톤 |
| `brightness` | 밝기 증가 |
| `darkness` | 밝기 감소 (어둡게) |
| `contrast` | 대비 강조 |
| `hue` | 색조 회전 |
| `invert` | 색상 반전 |
| `pixelation` | 픽셀화 |
| `zoom` | 확대 |
| `chromatic` | 색수차 효과 |
| `vignette` | 비네팅 (가장자리 어둡게) |
| `scanline` | 스캔라인 효과 |

## 파라미터 (주요)

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| transitionEffect | blur | 적용할 효과 종류 |
| duration | 20 | 전환 시간 (프레임) |
| easing | linear | 이징 방식 |
| closeAnim | true | 닫기 애니메이션 활성화 |
| overlayColor | 0,0,0 | 오버레이 색상 (R,G,B) |
| overlayAlpha | 0.5 | 오버레이 투명도 |

### blur 효과 파라미터
| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| blur_amount | 8 | 블러 강도 (px) |

### darkness 효과 파라미터
| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| darkness_amount | 0.5 | 어둡기 (0.0~1.0) |

### vignette 파라미터
| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| vignette_amount | 0.8 | 비네팅 강도 |
| vignette_range | 0.6 | 비네팅 범위 |

## 사용 예시

### 클래식 RPG 스타일
- Effect: `desaturation`, Amount: 0.8
- 메뉴가 열리면 배경이 흑백으로 전환

### 공포 게임 스타일
- Effect: `vignette` + `darkness`
- 메뉴 배경이 어둡고 주변이 검게 변함

### 몽환적 연출
- Effect: `blur`, Amount: 12
- 메뉴 배경이 부드럽게 흐릿해짐
