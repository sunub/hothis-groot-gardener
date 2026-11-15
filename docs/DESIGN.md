# 픽셀 UI 디자인 시스템 (v2)

화면 담당이 쓰는 디자인 규칙입니다. 토큰은 `apps/web/src/app/globals.css`의 `@theme`에, 픽셀 프레임은 같은 파일의 `@utility`에 있습니다. 기획서의 내용을 바꾸는 문서가 아니며, 기획의 원본은 팀 기획서입니다.

- 시안 'SG-DS v2 · Pixel UI'(12개 보드, 일부는 눌러 볼 수 있음): https://claude.ai/artifact/UMnoCswcpKLmxoCBPFiDVf
- 보드:
  - 1 픽셀 UI 기초 · 2 컴포넌트
  - 3 시작 화면 · 4 재배실(돌봄·위기일·밤·수확일) · 5 위기 대응과 판정 · 6 수확, 지상 분석, 임무 종료 · 7 근거와 출처
  - 8 시간축과 사건 카드(계획안) · 9 시스템 상태 · 10 재배일 시간축 컴포넌트
  - 4b 재배실 + 재배일 시간축 · 5b 위기 대응 + 재배일 시간축
- 시안의 단계 미리보기 단추(점선 상자, "시안 전용")와 위기 결과의 "Replay" 단추는 제품 화면에 넣지 않습니다.

## 코드 구조

디자인 시스템은 Tailwind CSS v4로 구현했습니다. 토큰과 유틸리티는 CSS에, 컴포넌트의 변형(variant)은 `class-variance-authority`로 정의합니다.

| 위치 | 내용 |
| --- | --- |
| `apps/web/src/styles/scene-tokens.css` | 배경 그림 속 장면의 색(`--color-scene-*`). 아래 "장면 토큰" 참고 |
| `apps/web/src/styles/tokens.css` | `@theme` 토큰: 색, 서체, 글자 크기(`text-caption`, `text-body`, `text-control`, `text-heading`, `text-display`, `text-data-sm`~`text-data-xl`), 움직임. `--radius-*`를 초기화해 `rounded-*` 클래스가 생기지 않습니다 |
| `apps/web/src/styles/utilities.css` | `pixel-*` 유틸리티: 프레임(`pixel-frame`, `-flat`, `-thin`), 프레임 색(`pixel-tone-*`), `pixel-raised`, `pixel-pressed`, `pixel-bubble`, `pixel-dashed`, `pixel-bar`, `pixel-segments`, `pixel-hatch`, `pixel-art` |
| `apps/web/src/styles/base.css` | 요소 기본값(바탕, 본문 서체, 포커스 표시, 움직임 줄이기) |
| `apps/web/src/app/globals.css` | 위 세 파일을 순서대로 불러옵니다 |
| `apps/web/src/lib/utils/cn.ts` | `clsx` + `tailwind-merge`. 이 프로젝트의 글자 크기 토큰과 `pixel-*` 그룹을 알도록 설정했습니다 |
| `apps/web/src/components/ui/` | 화면에 무관한 기본 부품: `button`, `badge`, `card`(`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `Well`), `callout`, `speech-bubble`, `meter`, `choice-button`, `stepper`, `disclosure`, `skeleton`, `pixel-icon` |
| `apps/web/src/components/` | 게임 용어를 아는 부품: `value-type-tag`, `zone-badge`, `verdict-banner`, `source-citation` |
| `/design-system` | 모든 부품을 한 화면에서 보는 개발용 페이지(`apps/web/src/features/design-system/catalog.tsx`). 검색 엔진에 노출하지 않습니다 |

쓰는 규칙:
- 새 화면은 `apps/web/src/components/ui`의 부품을 먼저 씁니다. `pixel-*` 클래스를 직접 쓰는 것은 부품이 없을 때만입니다.
- 클래스를 합칠 때는 `cn()`을 씁니다. 부품은 `className`을 받아 마지막에 합칩니다.
- 링크를 단추처럼 보이게 할 때는 `buttonVariants({ variant })`를 `Link`의 `className`에 넣습니다.
- 프레임이 있는 부품은 바깥 여백 `m-1`을 스스로 가집니다. 여러 개를 쌓을 때는 `space-y-*` 대신 `flex flex-col gap-*`이나 `grid gap-*`을 씁니다. `space-y-*`의 여백은 `m-1`에 덮여 프레임이 서로 붙습니다.
- 숫자는 `font-data`와 `text-data-*`를 함께 씁니다. VT323은 18px보다 작게 쓰지 않습니다.

## 바뀐 것 (이번 이전의 범위)

| 구분 | 내용 |
| --- | --- |
| 토큰 | `globals.css` `@theme` 값 교체. 기존 이름(`bg`, `surface`, `line`, `ink`, `accent`, `normal`, `caution`, `danger`, `measured`, `game`, `led`)은 그대로라 기존 클래스는 깨지지 않고 색만 바뀝니다 |
| 새 토큰 | `surface-3`, `line-hi`, `ink-faint`, `accent-hi`, `accent-lo`, `danger-fill`, `health`, `water`, `humidity`, `lamp`, `micro`, `--font-data` |
| 유틸리티 | `pixel-frame`, `pixel-frame-flat`, `pixel-frame-{accent,normal,caution,danger,measured}`, `pixel-raised`, `pixel-bubble`, `pixel-dashed`, `pixel-segments`, `pixel-hatch` |
| 서체 | `layout.tsx`에 VT323 추가 (`font-data`). Pixelify Sans와 DotGothic16은 그대로 |
| 에셋 | `public/bg/bay-teal.jpg`, `public/bg/wall-teal.jpg`(분홍 조명을 청록으로 보정), `public/icons/*.png`(아이콘 12개) 추가. 기존 `bay.png`, `wall.png`는 그대로 |
| 컴포넌트와 화면 | 위 "코드 구조"의 부품으로 옮겼습니다. 아래 "다음 단계"의 1~3번은 끝났고, 4번(화면 배치)과 5번(시간축 확장)이 남았습니다 |

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

### 장면 토큰 (scene)

배경 그림 안에 그려지는 것(모니터 유리와 테두리, 상추 말풍선, 재배 조명)은 페이지 UI와 다른 색 체계를 씁니다. 그림에 맞춘 색이라 페이지 토큰보다 밝고 따뜻합니다. 값은 `apps/web/src/styles/scene-tokens.css`에 `--color-scene-*`로 따로 모았습니다.

- 랜딩 장면(`landing.css`의 `lp-*` 클래스)은 장면 토큰만 씁니다. hex 값을 직접 쓰지 않고, 투명도는 `color-mix()`로 만듭니다.
- 페이지 UI는 장면 토큰을 쓰지 않고, 장면은 페이지 토큰을 쓰지 않습니다.
- `scene-bezel`(따뜻한 베이지)은 그림 속 모니터 테두리 색입니다. "따뜻한 색 금지" 규칙의 유일한 예외이며, 장면 모니터 둘레에만 씁니다.
- 장면 전용 부품(브리핑 팝업, 단계 목록)은 `apps/web/src/features/grow-room/scene-ui.tsx`에 있습니다. 페이지용 부품은 계속 `components/ui`를 씁니다.

| 토큰 | 쓰는 곳 |
| --- | --- |
| `scene-glass` `-hi` `-edge` `-line` | 모니터 화면 안의 칸, 번호 칸, 단계 테두리, 탭 줄과 구분선 |
| `scene-monitor` `scene-bezel` `-inner` `-outline` | 팝업과 좁은 화면 모니터의 바탕과 테두리 |
| `scene-panel` `-hi` | 그림 위 작은 라벨, 단추 hover |
| `scene-ink` `-soft` `-muted` `scene-link` | 화면 글자, 읽는 글, 보조 글, 링크 |
| `scene-accent` `-ink` `scene-focus` | 주 단추, 선택 탭, 포커스 표시 |
| `scene-glow` `-hi` `-text` `scene-mote` | 재배 조명, 글자 발광, 떠다니는 먼지 |
| `scene-bubble` `-ink` `-line` | 상추 말풍선 |
| `scene-overlay` `scene-shadow` `scene-highlight` `scene-backdrop` | 팝업 뒤 어둠, 픽셀 그림자, 단추 하이라이트, 그림을 불러오는 동안의 바탕 |

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

**위기 대응(`CrisisPanel`).** 판정은 고르기 전까지 숨깁니다(시안 5번).
- 머리에 "Step 1~3 of 3 · Look · Choose · Result"를 둡니다.
- 선택지를 누르면 민트 테두리와 "✓ Selected"만 표시합니다. **"Confirm action ▸"을 눌러야 확정**되고, 확정 전에는 다른 선택지로 바꿀 수 있습니다.
  - 지금 코드는 첫 클릭에 바로 확정합니다. 고른 선택지 번호는 컴포넌트 상태로만 두고, 확정할 때 `chooseOption`을 부릅니다. 임무 상태와 저장 형식은 바뀌지 않습니다.
- 확정 뒤에 판정, 결과 대사, 이유, 변화량(게임 값 배지), 출처(접기)를 공개합니다. 고르지 않은 선택지는 흐리게 둡니다.
- 위기 이름은 결과에서 장면 아래 "THE CRISIS WAS" 카드로 공개합니다. 증상 단계(n of 3), 상추가 아닌 기록이면 그 안내(`record_note`), Recorded 배지를 함께 둡니다.
- Inappropriate 뒤 다시 제시할 때는 고른 선택지를 빼고 보여 줍니다. 서버가 이미 뺍니다(`effectiveExclusions`). 다만 남는 선택지가 최소 개수보다 적어지거나 적절한 조치가 없어지면 빼지 않습니다.
- 두 번 연속 Inappropriate이면 지구 아이콘과 "Ground Support steps in" 결과를 보여 줍니다.
- 로딩("Preparing today's situation…")과 오류("Could not load the situation", 근거 목록 점검 실패, "Try again")는 선택지 자리에 그립니다.

**출처(`SourceCitation`).** 접기 버튼 한 줄 + 펼치면 제목, 인용문(왼쪽 4px 막대), 주소. "판정과 변화량은 게임 값"이라는 문구를 함께 둡니다.

**장면 위 UI.** 장면 이미지의 오른쪽 절반(빈 금속 패널) 위에만 말풍선과 상태 칩을 올립니다. 작물을 가리지 않습니다. AI 생성 이미지에는 `AI-generated art` 표시를 HTML로 고정합니다(오른쪽 아래, `font-data`).
- 말풍선: 왼쪽 55%, 위 12%, 너비 38%.
- 전체 상태 칩(✓ All normal / △ Caution / ✕ Danger): 왼쪽 55%, 위 46%.
- 밤에는 장면 위에 어두운 막을 덮고 "NIGHT · lights low"를 표시합니다.

**돌봄 단추의 효과 방향.** 단추 아래에 작은 글자로 방향을 붙입니다. 숫자는 "Tonight forecast"가 보여 줍니다.
- 급수 보통: Moisture ↑ / 급수 많이: Moisture ↑↑
- 팬 약: Humidity ↑ / 팬 강: Humidity ↓ Moisture ↓↓
- 남은 조작 횟수는 칸 두 개(채움·빈칸)로 표시합니다.

**재배일 시간축(`CultivationTimeline`, 시안 10번).** 재배일 0~33을 한 칸씩, 17칸 두 줄로 그립니다.
- 칸은 `pixel-frame`이 아니라 2px 실선 테두리입니다. 칸이 촘촘해서 4px 그림자 여백을 둘 수 없기 때문입니다.
- 칸 모양:
  - 오늘: 밝은 채움 + 어두운 글자
  - 지난 날: 민트 계열로 은은하게 채움
  - 앞으로: 바탕색 + 얇은 선
  - 게임 날 정지: 민트 테두리 + D1~D7 라벨
- 위기 구간(재배일 6~28)은 ≈, 위기가 난 날은 △로 표시합니다. 색만으로 알리지 않습니다.
- 34칸 지도와 범례는 `aria-hidden`으로 숨기고, 7개 게임 날을 읽어 주는 목록을 따로 둡니다.
- 좁은 화면에서는 지도를 가로로 스크롤합니다(최소 너비 704px).
- 임무 상태를 읽기만 합니다. 재배일, 위기 구간, 정지 지점은 `rules.ts`의 값을 씁니다.

**시간축 확장(시안 8번, 계획안, 아직 구현하지 않음).** 사건 목록 엔진(`TIMELINE-EVENTS-PLAN.md`의 A1~A3)이 생긴 뒤에 만듭니다.
- 시간 단추: "▸ Continue / ❚❚ Pause", 1×·2×·4× 토글, "Next event »". 사건 카드가 떠 있으면 시간이 흐르지 않습니다.
- 지도에 예정 사건 ◆를 더합니다.
- 사건 카드: 민트 프레임, "SCHEDULED EVENT" 태그와 재배일, 제목, 상황 한 줄, "WHAT WAS RECORDED" 상자(왼쪽 4px `measured` 막대, Recorded 배지, 출처 chunk), 선택지. 선택지에는 힌트를 붙이지 않고 판정은 고른 뒤에 공개합니다.
- 접힌 띠: "Set aside ▴"로 접으면 caution 프레임 띠 "❚❚ Waiting for your response · (time is stopped)"와 "Open the card ▾"가 남습니다. 접힘은 화면 상태일 뿐이라 임무 단계는 바뀌지 않습니다.
- 멈춤 카드: "PAUSE CARD" 태그, "YOUR RUN SO FAR"(게임 값 배지), "REAL EXPERIMENTS, SAME DAY"(Recorded 배지), 선택으로 답하는 질문 칸, 단추 세 개("Write it down and continue", "Keep it in mind and continue", "Do not show this again"). 판정과 수치에는 영향이 없습니다. "다시 띄우지 않기"는 임무 기록과 분리된 설정으로 저장합니다.
- 재배 기록(Cultivation log): 최근 것이 위에 옵니다. 줄마다 날짜, 글, 끝에 `+`/`−`/`±`(각각 `aria-label`). 출처가 있으면 아래에 "Data · …" 줄을 붙이고, 줄을 골라 ☆ 표시를 할 수 있습니다.
- 같은 날 실험(Same days, real experiments): `measured` 프레임과 Recorded 배지. 실험마다 "✓ reached", "▣ today", "◇ in n days"로 표시합니다.

**시스템 상태(시안 9번).**
- 임무 실패: danger 프레임, 채도를 낮춘 장면과 `D0_dead`, "Mission failed", 어느 날 몇 재배일째인지, 지표 세 칸(ATTEMPTS, NIGHTS IN DANGER, GROUND SUPPORT, 게임 값), "Start a new mission ▸"와 "Evidence and sources".
- 로딩: "Loading your mission…". 옛 형식으로 저장된 임무는 새 형식으로 옮긴 뒤 연다는 안내를 함께 둡니다.
- 근거 목록 점검 오류: danger 프레임, "The evidence list did not pass its check", 임무는 바뀌지 않았다는 문장, "Try again".
- 수확 등급 배지: Excellent(normal, ok 아이콘) · Success(caution, half 아이콘) · Fail(danger, fail 아이콘). 등급이 Fail(건강 1~49)이어도 수확, 냉동, 보고서는 그대로 진행합니다. 건강 0인 임무 실패와 구분합니다.
- 화면 아래 고정 안내: 사람의 건강을 기록하지 않는다는 문장, 실측과 게임 값의 뜻과 "Evidence and sources" 링크, `AI-generated art`.

## 화면 구성 (시안 기준)

| 화면 | 시안 | 지금 코드와 다른 점 |
| --- | --- | --- |
| 시작 `/` | 3번: 소개, "How a mission works" 3단계, 숫자 읽는 법, 이어하기 카드, Standard·Demo, 덮어쓰기 확인 창 | 구성은 같습니다. 모양만 옮기면 됩니다 |
| 재배실 `/mission` | 4번·4b: 위에 HUD(로고, DAY 0n/07, 재배일, 7칸 진행, 단계, 단계 태그, 식물 건강 막대, Sources·Menu). 그 아래 시간축 지도. 넓은 왼쪽 열에 장면과 상태 차트, 오른쪽 열(최대 460px)에 Cabin status 게이지와 단계 패널 | 지금은 단계 패널이 가운데, 식물 그림·상태·차트가 오른쪽 24rem 열입니다. **배치가 반대**입니다. 식물 건강도 HUD로 올라갑니다 |
| 위기 | 5번·5b: 재배실의 위기일 카드("Something is wrong", "Look closer ▸")를 거쳐 들어가는 전용 배치. 왼쪽에 장면과 "WHAT YOU SEE", 오른쪽에 단서, 선택지, 확정, 결과 | 지금은 `/mission` 안의 패널 하나입니다. 같은 주소 안에서 배치만 바꿀지, 주소를 나눌지 정해야 합니다(`routes.ts`의 단계별 화면 표) |
| 수확 `/harvest` | 6번 위: ⑥⑦⑧ 단계 표시줄, 수확 방법 두 가지, 보고서 배경 위 수확 직전 상추 | 단계 표시줄이 더해집니다 |
| 보고서 `/report` | 6번 아래: 지상 분석(미생물 범위 막대, 수치를 바꾼 선택 목록과 합계, 병원균 선별 Recorded), 임무 종료 보고서(등급, 시도 수, 판정 비율 막대, 날짜별 기록 요약), "New mission ▸" | 판정 비율 막대와 날짜별 아이콘 요약이 더해집니다 |
| 근거와 출처 `/sources` | 7번: 왼쪽 목차, 위기별 단계별 증상(인용·출처·배지)과 조치·판정, 게임 값 설명, 실측 범위, 출처 목록 | 목차 배치가 더해집니다 |

## 에셋

| 파일 | 용도 |
| --- | --- |
| `public/bg/bay-teal.jpg` | 재배실 배경(1672×941). 마젠타 그로우 라이트를 청록으로 옮긴 것 |
| `public/bg/wall-teal.jpg` | 보고서 화면 배경 (같은 보정) |
| `public/icons/fan.png` | 팬 조작 |
| `public/icons/pruner.png` | 수확 |
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

1. 화면과 제출물은 영어입니다. 문구는 `apps/web/src/lib/i18n/`에 모읍니다.
2. 판정은 색에만 의존하지 않습니다(색 + 아이콘 + 글자).
3. 모든 수치와 판정 옆에 실측 또는 게임 값 배지를 붙입니다.
4. 판정은 고르기 전까지 숨기고, 출처는 접을 수 있게 합니다.
5. safe, passed, edible 같은 안전 판정 문구를 쓰지 않습니다. 지상 분석 보고서는 "범위 안이라고 해서 안전하다는 뜻은 아닙니다"를 낮음과 높음 결과에도 함께 띄웁니다.
6. NASA 로고, 깃발, 미션 패치, 보증을 암시하는 표현을 쓰지 않습니다. AI 생성 이미지에는 눈에 보이는 워터마크를 붙입니다.

## 다음 단계

- `apps/web/src/features/grow-room/mission-screen.tsx`의 단계 패널 테두리는 아직 1px 선입니다. 시간축 작업이 커밋되지 않은 파일이라 이번에 손대지 않았습니다. `Card`로 바꾸면 됩니다.

1. ~~배경 교체~~ 끝남: 재배실 장면이 `/bg/bay-teal.jpg`를 쓰고, 작물 위 조명색도 청록으로 바꿨습니다. `bay.png`, `wall.png`는 이제 코드에서 쓰지 않습니다(지워도 됨, 각 약 1.8MB).
2. ~~작은 컴포넌트~~ 끝남: "코드 구조" 표의 부품으로 옮겼습니다.
3. ~~게이지와 위기 화면~~ 끝남: `zone-gauge`, `crisis-panel`(고른 뒤 확정하는 단계 포함), `crisis-result-panel`(`VerdictBanner`, 출처 접기)을 옮겼습니다.
4. **화면 레이아웃**: 재배실, 위기, 보고서 화면을 시안 4b·5b·6번 구성으로 맞춥니다(위 "화면 구성" 표). 병렬 작업 중인 브랜치와 충돌하기 쉬우니 마지막에 합니다.
5. **시간축 확장**: 시안 8번은 사건 목록 엔진이 생긴 뒤에 진행합니다.

## 확인이 필요한 값

- 팬이 강일 때 밤사이 재배실 습도는 **−10**입니다. 기획서 v1.7 "하루 진행과 일상 돌봄"에 "강이면 10 내려갑니다"라고 적혀 있고, `rules.ts`의 `NIGHT_DRIFT`도 −10입니다. 시안 4번·4b의 "Tonight forecast"와 "Overnight" 계산은 −5로 되어 있으니, 시안 숫자를 옮기지 말고 `projectNight`나 `forecastNight`의 값을 씁니다.
- 시안 4번의 돌봄 패널에 있는 "Reset day"(그날 돌봄 되돌리기)는 엔진에 해당 동작이 없습니다. 넣으려면 엔진에 행동을 더해야 하므로, 넣지 않거나 팀이 정한 뒤 넣습니다.
- HUD의 "Menu" 단추가 무엇을 여는지 시안에 없습니다. 지금 머리글의 링크(Home, Sources)를 담는 자리로 볼지 정해야 합니다.
- 시안 6번의 수확 단추는 고르기 전부터 미생물 변화량(−0.3, ±0)을 보여 줍니다. 판정이 있는 위기가 아니어서 규칙 4에는 걸리지 않지만, 의도한 것인지 확인이 필요합니다.
- 시안의 색 이름(`bg-0`, `text`, `ok`, `warn`, `bad`, `rec`, `light`)은 이 문서의 토큰(`bg`, `ink`, `normal`, `caution`, `danger`, `measured`, `lamp`)과 같은 색입니다. 코드에서는 이 문서의 이름을 씁니다.
- 시안 4번의 출처 제목과 주소 중 NTRS 20150001374 외에는 자리표시입니다. 실제 값은 `data/content/evidence.json`을 따릅니다.
- 시안의 보고서 숫자(미생물 3.20, 건강 77 등)는 화면 확인용 샘플입니다.
