# Space Garden Simulator — 프론트엔드 v0.8.1 (handoff)

팀 HOTHIS · NASA Space Apps 2026 Seoul. 이 폴더는 claude.ai 아티팩트로 만든 플레이 가능한 프론트엔드를 그대로 옮긴 것입니다.
**지금 상태 그대로 브라우저에서 동작**합니다. 이 문서는 클로드 코드(또는 팀원)가 팀 저장소에 옮겨 실제 API에 붙일 때 필요한 내용입니다.

## 1. 구성

```
index.html          HTML + CSS + JS가 한 파일에 모두 들어 있음 (빌드 도구·라이브러리 없음)
assets/bg/          배경 5장 (1672×941, 16:9)
assets/sprites/     상추 스프라이트 16장 (600×520)
assets/icons/       아이콘 18장 (128×128) — TEMP_* 6장은 임시 그림
README.md           이 문서
```

- 외부에서 불러오는 것은 구글 폰트(Pixelify Sans, VT323)뿐입니다. 오프라인이면 Courier New로 대체됩니다.
- 실행: `index.html`을 브라우저로 열거나, 폴더에서 `python -m http.server` 후 `http://localhost:8000`.

## 2. 화면 구조 (1600×900 아트보드)

- 장면 전체를 1600×900 기준으로 그리고, 창 크기에 맞춰 `transform: scale()`로 줄입니다(`layout()`).
- 768px 미만에서는 오른쪽 모니터 내용(`[data-stack]`)을 장면 아래로 옮깁니다.
- **배경에 그려진 모니터 안에 UI를 넣는 방식**입니다. 좌표는 `SCREENS` 표에 있습니다.

| 장면 키 | 배경 | 큰 화면 `main` | 아래 화면 `strip` |
|---|---|---|---|
| normal | BG_growth_normal | 1050,122 – 1558,516 | 1050,574 – 1558,694 |
| event | BG_growth_event | 1054,128 – 1546,562 | 1054,566 – 1546,682 (같은 화면 안, 구분선) |
| result | BG_growth_result | 1050,126 – 1552,566 | 1050,570 – 1552,686 (같은 화면 안, 구분선) |
| ret | BG_sample_return | 1040,116 – 1566,680 | 없음 |
| report | BG_report_wall | 클립보드 종이(`.sg-paper`) | — |

- **배경을 바꾸면 `SCREENS` 좌표와 화분 위치를 다시 재야 합니다.**
  - 화분: `.plant { left: 210px; width: 640px; bottom: 16% }`, `PLANT.left = 210`. 재배실 기둥 사이 가운데가 x 530.
  - 말풍선: `bubbleStyle()`이 `SPRITE_BOX`(스프라이트별 잎 꼭대기 좌표)를 보고 잎 바로 위에 꼬리를 둡니다. `tipX = 530 + 70`.
- 글이 모니터를 넘치면 `fit-1`~`fit-4` 클래스로 단계적으로 압축합니다(스크롤바 없음).

## 3. 게임 흐름 (브라우저 쪽 로직)

1. **Daily care:** 하루에 돌봄 2번까지. 물 Normal(+10) / Heavy(+20), 팬 Low / High. `careOp()`.
2. **End day:** `step()` — 하룻밤 변화(`night()`), 사건·위기 판정, 날짜 +1.
   - `night()`는 아래 띠 화면의 "지금 → 내일" 예보에도 똑같이 쓰여서, 예보와 결과가 항상 같습니다.
3. **사건:** 재배일 3(wick_opening), 7(thinning)은 고정. fan_off_after_restart(2–17), mild_tip_burn(6–22)은 확률.
4. **위기:** 수치가 주의/위험 구간이면 확률로 `/api/crisis` 호출. 부적절 판정이면 `active.chosen_action_ids`를 실어 다시 요청하고, 3번째도 부적절이면 `ground_support`.
5. **재배일 33:** 수확 → 소독(선택) → 냉동·귀환 → 지상 분석(미생물 값) → 임무 보고서.
6. **Auto-run (1×/4×/16×):** 돌봄 없이 날짜만 빨리 넘기는 시연용 기능. 필요 없으면 지워도 됩니다.

## 4. API — 지금은 가짜(mock)

- `mockCrisis(req)`, `mockEvent(req)`가 팀 API 명세(main @ c9a08e4)의 요청·응답 형식을 그대로 흉내 냅니다.
  - 정의 안 된 필드가 있으면 400, 위기 후보가 없으면 422.
- **실제 API로 바꾸는 곳은 `api(path, req)` 함수 하나**입니다.

```js
async function api(path, req){
  const r = await fetch(path, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(req)});
  const body = await r.json();
  API_LOG.unshift({path, status:r.status, ms:0, req, res:body});
  return {status:r.status, body};
}
```

- 바꾼 뒤에는 `mockCrisis`, `mockEvent`, `CRISES`, `EVENTS`, `SRC`를 지워도 됩니다. 단 `BANDS`, `band()`는 화면에서도 쓰니 남겨야 합니다.

### 명세와 다르거나 확인이 필요한 점
- **`cultivation_day`:** 하루씩 진행하므로 1–33 사이 아무 날짜나 보냅니다(예: 9). 명세 예시는 1, 6, 12, 17, 22, 28, 33뿐이라 백엔드가 중간 날짜를 받는지 확인이 필요합니다.
- **`plant_health` 구간:** 명세에 없습니다. 지금은 60 이상 정상, 35 이상 주의(`band()`의 기본값)로 임시 설정했습니다. 팀 결정이 필요합니다.
- **사건 카드:** 명세대로 `draft: true`면 `DRAFT RULE` 배지를 붙입니다.

## 5. 임시 값 (제출 전에 바꿔야 할 것)

- 위기·사건 문구, 판정, 변화량, 확률, 물 +10/+20, 하룻밤 변화 규칙 → 전부 **게임 값**. 팀 `evidence.json`·`events.json`으로 교체.
- **출처:** 실제 링크는 NASA JSC 백일홍 곰팡이 발표(EurekAlert)와 Massa 외(2014, NTRS)뿐입니다. Massa 인용문은 API 명세 예시를 옮긴 것이라 원문 확인이 필요합니다.
- **지상 분석의 미생물 관측 범위 2.14–4.86**은 디자인 랩 v0.2에서 가져온 값이라 출처 확인이 필요합니다.
- **Veggie 기록 카드**(재배일 1, 10, 14, 20, 25, 30)는 빈 자리입니다. `events.json`의 기록 사건으로 채워야 합니다.
- `assets/icons/TEMP_*` 6장은 임시 그림입니다.
- `assets/bg/BG_report_wall.png`는 새 화풍으로 아직 안 바뀌었습니다.
- 챌린지 Resources 탭의 NASA 리소스(글로벌 어워드 자격 조건)는 아직 화면 어디에도 연결되지 않았습니다.

## 6. 지켜야 할 규칙 (Seoul 운영 지침)

- 화면 문구는 영어로 씁니다.
- 생성형 AI 그림에는 눈에 보이는 워터마크를 넣습니다(지금은 `AI-GENERATED ART` 18px 표시).
- NASA 로고, 깃발, 미션 식별자를 쓰지 않고, NASA가 보증하는 것처럼 보이게 하지 않습니다.
- API 키나 비밀번호를 커밋하지 않습니다.
- 확인하지 않은 효과를 "검증 완료"로 쓰지 않습니다.

## 7. 디자인 기준

- Space Garden Design System v1.0 (claude.ai 아티팩트) — 색·글꼴·컴포넌트 규칙.
- 상태는 색 + 아이콘 + 단어로 함께 표시하고, 시뮬레이션 수치에는 `GAME VALUE` 배지를 붙입니다.

## 8. 생성형 AI 사용 기록 (Use of SI 초안)

> Claude (Anthropic) generated this frontend (HTML/CSS/JS), the in-page mock API matching the team's API spec, and 6 temporary placeholder icons. All mock crisis/event text, probabilities and values are placeholders to be replaced with the team's evidence data. Backgrounds and sprites are team-provided.

<details>
<summary>변경 기록</summary>

- v0.8.1 — 다시 고르기 화면이 가짜 데이터 표(CRISES)를 읽지 않도록 정리(실제 API 연결 대비)
- v0.8 — 팀 새 배경 4장 반영, 모니터 좌표 재측정, 화분 재정렬, Daily care 이름표를 버튼 위로
- v0.7 — Daily care(하루 2회 돌봄 + End day), 오늘 밤 예보, 식물 크기에 따라 움직이는 말풍선
- v0.6.1 — 화분 가운데 정렬, 말풍선 꼬리 수정
- v0.6 — 스크롤 없는 4단계 자동 압축, 페이지 바깥 스크롤 제거
- v0.5 — 배경에 그려진 모니터 안으로 UI 이동
- v0.4 — 같은 시각 화분 비교 제거, Plant health 대형 게이지
- v0.3 — v0.1 장면 + 하루 단위 진행, 튜토리얼 없는 안내(깜빡임, 일시정지 표시)
- v0.2 — 80억분의 1 참고 대시보드 실험
- v0.1 — 첫 플레이 가능 버전

</details>
