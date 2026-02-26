# TitleCredit — 타이틀 크레딧

**파일**: `js/plugins/TitleCredit.js`

## 기능 요약

타이틀 화면에 "크레딧" 버튼을 추가합니다. 사용된 에셋의 저작권/라이선스 정보를 텍스트 파일로 관리하고 게임 내에서 열람할 수 있습니다.

## 주요 기능

- **타이틀 버튼 추가** — 타이틀 커맨드 창에 "크레딧" 항목 자동 추가
- **텍스트 파일 기반** — `data/Credits.txt` 파일에서 내용을 읽어 표시
- **섹션/스타일 지원** — `[섹션명]`, `- 타이틀 -`, `@link`, `@license` 형식 지원
- **링크 열기** — 결정 버튼으로 외부 URL을 브라우저에서 열기

## 파라미터

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| textFile | `data/Credits.txt` | 크레딧 파일 경로 (프로젝트 루트 기준) |

## Credits.txt 파일 형식

```
[섹션명]              → 시스템 색상으로 표시
- 타이틀 -            → 시스템 색상, 중앙 정렬
@link URL             → 파란색 링크 (결정 버튼으로 열기)
@link URL 표시텍스트   → URL 대신 표시텍스트로 보이는 링크
@license 텍스트       → 초록색으로 표시
                      → 빈 줄은 간격 추가
일반 텍스트           → 기본 색상으로 표시
```

### 예시 Credits.txt

```
- My RPG Game -

[그래픽]
타일셋 by RPG Maker MV
@license CC BY 4.0

[음악]
BGM: 제목 없는 멜로디
@link https://example.com 작곡가 사이트
@license 무료 사용 허가

[플러그인]
RPG Maker MV Web Editor
@link https://github.com/gosuni2025/rpgmaker-mv-editor GitHub
```

## 조작 방법

| 입력 | 동작 |
|------|------|
| ↑ / ↓ 방향키 | 줄 이동 |
| 결정 (Z / Enter) | 링크 줄에서 브라우저로 열기 |
| 취소 (X / Esc) | 타이틀로 돌아가기 |

## 주의사항

- `Credits.txt` 파일이 없으면 크레딧 버튼은 표시되지만 내용이 비어 있습니다.
- 링크 열기는 NW.js(로컬 실행)와 웹 브라우저 배포 모두 지원합니다.
