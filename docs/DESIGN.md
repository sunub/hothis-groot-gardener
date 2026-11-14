# 픽셀 UI 디자인 시스템 (v2)

화면 담당이 쓰는 디자인 규칙입니다. 토큰은 `src/app/globals.css`의 `@theme`에, 픽셀 프레임은 같은 파일의 `@utility`에 있습니다. 기획서의 내용을 바꾸는 문서가 아니며, 기획의 원본은 팀 기획서입니다.

- 시안(5개 보드, 일부는 눌러 볼 수 있음): https://claude.ai/artifact/UMnoCswcpKLmxoCBPFiDVf
- 보드: 1 픽셀 UI 기초 · 2 컴포넌트 · 3 재배실 · 4 위기 대응과 판정 · 5 수확, 지상 분석, 임무 종료

## 바뀐 것 (이번 이전의 범위)

| 구분 | 내용 |
| --- | --- |
| 토큰 | `globals.css` `@theme` 값 교체. 기존 이름(`bg`, `surface`, `line`, `ink`, `accent`, `normal`, `caution`, `danger`, `measured`, `game`, `led`)은 그대로라 기존 클래스는 깨지지 않고 색만 바뀝니다 |
| 새 토큰 | `surface-3`, `line-hi`, `ink-faint`, `accent-hi`, `accent-lo`, `danger-fill`, `health`, `water`, `humidity`, `lamp`, `micro`, `--font-data` |
| 유틸리티 | `pixel-frame`, `pixel-frame-flat`, `pixel-frame-{accent,normal,caution,danger,measured}`, `pixel-raised`, `pixel-bubble`, `pixel-dashed`, `pixel-segments`, `pixel-hatch` |
| 서체 | `layout.tsx`에 VT323 추가 (`font-data`). Pixelify Sans와 DotGothic16은 그대로 |
| 에셋 | `public/bg/bay-teal.jpg`, `public/bg/wall-teal.jpg`(분홍 조명을 청록으로 보정), `public/icons/*.png`(아이콘 12개) 추가. 기존 `bay.png`, `wall.png`는 그대로 |
| 바꾸지 않은 것 | 컴포넌트와 화면 코드. 아래 "다음 단계"에 적용 순서가 있습니다 |

## 색상 토큰

분홍과 자주 계열은 UI에서 쓰지 않습니다. 작물 스프라이트의 크림슨만 따뜻한 색으로 남깁니다.

| 토큰 | 값 | 쓰는 곳 |
| --- | --- | --- |
| `bg` | `#0a1016` | 페이지 바탕 |
| `surface` / `surface-2` / `surface-3` | `#131d26` / `#1a2733` / `#0f1820` | 패널 / 올린 면 / 패널 아래 안쪽 줄 |
| `line` / `line-hi` | `#34495a` / `#5a7a8e` | 프레임 / 점선과 강한 선 |
| `ink` / `ink-muted` / `ink-faint` | `#eaf1f3` / `#a9b9c0` / `#7f919a` | 본문 / 보조 / 희미 (모두 패널 위에서 4.5:1 이상) |
| `accent` (+`-ink`, `-hi`, `-lo`) | `#6fc3b2` | 주 버튼, 선택, 포커스 |
| `normal` / `caution` / `danger` | `#7bc68f` / `#e3b95b` / `#e5806a` | 구간, 판정 |
| `danger-fill` | `#c8654f` | 게이지의 위험 구간 채움 (빗금과 함께) |
| `measured` / `game` | `#6baed6` / `#a9b9c0` | 실측 배지 / 게임 값 배지 |
| `health` `water` `humidity` `lamp` `micro` | `#7bc68f` `#6baed6` `#9c8fd6` `#e3b95b` `#d49a6a` | 상태 항목별 색 (차트 선, 아이콘 점) |

## 픽셀 프레임

`border-radius` 대신 4px 오프셋 그림자 네 개로 모서리를 한 칸씩 깎습니다. 그림자는 상자 바깥에 그려지므로 바깥에 4px 이상 여백이 필요합니다(`m-1` 또는 `gap-4` 이상).

```tsx
<section className="pixel-frame m-1 p-5">패널</section>
<section className="pixel-frame pixel-frame-danger m-1 p-5">위험 강조</section>
<button className="pixel-raised m-1 min-h-11 px-6 font-title">Continue</button>
<div className="pixel-bubble m-1 p-3">식물 NPC의 말</div>
<span className="pixel-dashed px-2 font-data text-lg">Game value</span>
```

- `pixel-frame`: 기본 패널. 색은 `--pf`(기본 `line`) 또는 `pixel-frame-*`로 바꿉니다.
- `pixel-raised`: 주 버튼만. 보조 버튼은 `pixel-frame`을 씁니다.
- `pixel-bubble`: 식물 NPC의 말에만 씁니다.
- `pixel-segments`: 채워진 게이지를 8px 블록으로 끊습니다. `pixel-hatch`와 같은 요소에 함께 쓰면 `background-image`가 덮어써지므로, 위험 구간 칸에는 `pixel-hatch`를 쓰고 `pixel-segments`는 안쪽 요소에 둡니다.
- 간격은 4px 단위(`1`, `2`, `3`, `4`, `6`, `8`, `12`)만 씁니다. 이미지는 `.pixel`(`image-rendering: pixelated`)에 정수 배율만 씁니다.

## 서체

| 쓰임 | 클래스 | 규칙 |
| --- | --- | --- |
| 제목, 단추, 선택지 | `font-title` (Pixelify Sans) | 단추 18px 이상, 본문 17px |
| 숫자, 게이지 값, 태그 | `font-data` (VT323) | 글자가 작아 보이므로 18px 미만 금지 |
| 한국어(기록 문서, 개발자 화면) | `font-sans` | 화면 본문은 영어 |

## 컴포넌트 규칙

현재 컴포넌트가 이 규칙으로 옮겨질 때의 기준입니다.

**구간 게이지(`ZoneGauge`).** 5구간 막대와 현재값 화살표. 구간 경계는 `ZONE_BOUNDS`를 그대로 씁니다.
- 위험 구간은 `danger-fill` + `pixel-hatch`, 주의는 `caution`, 정상은 `normal`로 명도를 다르게 합니다.
- 구간 라벨(LOW / OK / HIGH)과 현재값 옆 `✓ △ ✕` 기호를 함께 보여 줍니다. 색만으로 알리지 않습니다.
- 현재값 화살표는 `ink` 색 아래 방향 삼각형입니다. `role="meter"`와 `aria-valuetext`는 지금 구현을 유지합니다.

**배지.** 실측과 게임 값은 모양으로 구분합니다.
- `ValueTypeTag` 실측(measured): `measured` 색으로 채운 배지, 앞에 ■.
- `ValueTypeTag` 게임 값(game): `pixel-dashed` 점선 배지, 앞에 ◇.
- 모든 수치와 판정 바로 옆에 붙입니다.

**판정 3종(`CrisisResultPanel`).** 색, 아이콘, 글자를 모두 씁니다.

| 판정 | 프레임 | 아이콘 | 글자 |
| --- | --- | --- | --- |
| Appropriate | `pixel-frame-normal` | `/icons/ok.png` | 위기 종료, 관련 값 55로 |
| Partial | `pixel-frame-caution` | `/icons/half.png` | 위기 종료, 절반만 회복 |
| Inappropriate | `pixel-frame-danger` | `/icons/fail.png` | 악화, 새 증상으로 다시 제시 |

**위기 대응(`CrisisPanel`).** 판정은 고르기 전까지 숨깁니다. 선택 전에는 선택지에 "✓ Selected"만 보이고, 확정 뒤에 판정, 결과 대사, 이유, 변화량(게임 값 배지), 출처(접기)를 공개합니다. 위기 이름도 결과 화면에서 공개합니다.

**출처(`SourceCitation`).** 접기 버튼 한 줄 + 펼치면 제목, 인용문(왼쪽 4px 막대), 주소. "판정과 변화량은 게임 값"이라는 문구를 함께 둡니다.

**장면 위 UI.** 장면 이미지의 오른쪽 절반(빈 금속 패널) 위에만 말풍선과 상태 칩을 올립니다. 작물을 가리지 않습니다. AI 생성 이미지에는 `AI-generated art` 표시를 HTML로 고정합니다(오른쪽 아래, `font-data`).

## 에셋

| 파일 | 용도 |
| --- | --- |
| `public/bg/bay-teal.jpg` | 재배실 배경(1672×941). 마젠타 그로우 라이트를 청록으로 옮긴 것 |
| `public/bg/wall-teal.jpg` | 보고서 화면 배경 (같은 보정) |
| `public/icons/fan.png` | 팬 조작 |
| `public/icons/pruner.png` | 수확, 죽은 조직 제거 |
| `public/icons/water.png` | 급수 |
| `public/icons/wipe.png` | 표면 닦기 (Partial 조치) |
| `public/icons/syringe.png` | 필로우 직접 급수 |
| `public/icons/ok.png` `half.png` `fail.png` | 판정 Appropriate, Partial, Inappropriate (`fail`은 임무 실패에도) |
| `public/icons/earth.png` | 시료 귀환, 지상 분석 |
| `public/icons/info.png` | 도움말, 단위 설명 |
| `public/icons/scope.png` | 관찰 단서 카드 |
| `public/icons/sprout.png` | 로고, 임무 시작 |
| `public/sprites/*.png` | 작물 상태 16종. 날짜와 위기에 따른 선택은 `lettuce-sprite.ts`가 이미 맡습니다 |

스프라이트가 놓이는 자리는 배경 비율 기준입니다: 왼쪽 8.4%, 위 23.4%, 너비 39.5%, 높이 60.8%, 바닥 그림자는 중심 (28.1%, 81.8%)·너비 27%. 기준점은 에셋 README의 B0 규격(1.1배, 기준점 470,770)을 비율로 옮긴 값입니다.

## 기획서에서 온 규칙

1. 화면과 제출물은 영어입니다. 문구는 `src/lib/i18n/`에 모읍니다.
2. 판정은 색에만 의존하지 않습니다(색 + 아이콘 + 글자).
3. 모든 수치와 판정 옆에 실측 또는 게임 값 배지를 붙입니다.
4. 판정은 고르기 전까지 숨기고, 출처는 접을 수 있게 합니다.
5. safe, passed, edible 같은 안전 판정 문구를 쓰지 않습니다. 지상 분석 보고서는 "범위 안이라고 해서 안전하다는 뜻은 아닙니다"를 낮음과 높음 결과에도 함께 띄웁니다.
6. NASA 로고, 깃발, 미션 패치, 보증을 암시하는 표현을 쓰지 않습니다. AI 생성 이미지에는 눈에 보이는 워터마크를 붙입니다.

## 다음 단계 (이번에는 하지 않은 것)

토큰을 바꿨기 때문에 기존 화면의 색은 이미 새 팔레트로 보입니다. 모양까지 바꾸려면 아래 순서로 진행합니다.

1. **배경 교체**: `src/features/grow-room/lettuce-scene.tsx`의 `/bg/bay.png`를 `/bg/bay-teal.jpg`로, 보고서 쪽 `wall.png` 참조를 `wall-teal.jpg`로 바꿉니다. 교체 뒤 사용하지 않는 `bay.png`, `wall.png`(각 약 1.8MB)는 지워도 됩니다.
2. **작은 컴포넌트**: `ui/button`, `ui/badge`, `ui/card`, `zone-badge`, `value-type-tag`를 위 유틸리티로 옮깁니다(`rounded-*` 제거).
3. **게이지와 위기 화면**: `zone-gauge`, `crisis-panel`, `crisis-result-panel`을 "컴포넌트 규칙"대로 옮깁니다.
4. **화면 레이아웃**: 재배실, 보고서 화면을 시안 3~5번 구성으로 맞춥니다. 병렬 작업 중인 브랜치와 충돌하기 쉬우니 마지막에 합니다.

## 확인이 필요한 값

- 팬이 강일 때 재배실 습도가 얼마나 줄어드는지 기획서에 없습니다. 시안은 −5로 가정했지만 코드의 `rules.ts`가 기준입니다.
- 시안 4번의 출처 제목과 주소 중 NTRS 20150001374 외에는 자리표시입니다. 실제 값은 `src/data/evidence.json`을 따릅니다.
- 시안의 보고서 숫자(미생물 3.20, 건강 77 등)는 화면 확인용 샘플입니다.
