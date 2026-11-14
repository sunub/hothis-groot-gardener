# 역할별 작업 전달

Space Garden Simulator · 2026-11-15 09:20 기준 · 기준 브랜치 `HwangSoon96`

이 문서는 통합 브랜치의 지금 상태와, 세 역할이 이어서 할 일을 적은 것입니다. 역할의 경계는 `docs/TIMELINE-EVENTS-PLAN.md` 7절의 폴더 구분을 따릅니다.

- **역할 A**: 시뮬레이션 엔진 (`apps/web/src/lib/game/**`, `apps/web/src/lib/events/**`, `apps/web/src/features/mission/**`, `apps/web/src/lib/contract/types.ts`)
- **역할 B**: 데이터와 생성 (`data/content/*.json`, `apps/web/src/server/ai/crisis/**`, `apps/web/src/server/ai/event-cards/**`, `apps/web/src/app/api/**`, `apps/web/src/lib/contract/schemas.ts`, Python 검색 코드, `data/vector_db/`, `data/`)
- **역할 C**: 화면과 콘텐츠 (`apps/web/src/features/**`(`mission` 제외), `apps/web/src/components/**`, 화면 글, 그림, `docs/DEMO-SCRIPT.md`)

읽는 법은 두 가지입니다.

- "확인함"은 실제로 실행해서 본 것입니다. 그렇지 않은 것은 "확인 못 함"이라고 적었습니다.
- 수치 옆의 "초안"은 `data/content/events.json`의 초안 게임 값이라는 뜻입니다. 팀 결정 전에는 바꾸지 않습니다.

## 0. 지금 브랜치에 들어 있는 것

`main`에는 `HwangSoon96`의 통합 병합(`lkh`, `woojin-llm`, `woojin-rag-server`)과 `sunub`의 폴더 구조 정리(`b32cf60`)가 들어가 있습니다(11/15 08:40). `HwangSoon96`은 그 위에 커밋 8개가 더 있습니다.

| 폴더 | 내용 |
|---|---|
| `apps/web/` | Next.js 앱. 화면과 게임 엔진은 `src/features`, `src/lib`, 서버에서만 도는 위기·사건 카드 코드는 `src/server/ai` |
| `services/rag/` | Python 근거 검색 코드와 검색 서버 |
| `data/content/` | 앱이 읽는 JSON (근거 목록, 사건 목록, 카드 글, 출처별 라이선스) |
| `data/sources/`, `data/eval/`, `data/vector_db/` | 검색 조각, 평가 질문, 검색 DB |

`main`에 없고 `HwangSoon96`에만 있는 것은 아래와 같습니다.

| 내용 | 파일 |
|---|---|
| 사건의 근거 조각 목록 보완 | `data/content/events.json`, `data/eval/evaluation.events.json` |
| 사건 카드 글 생성기와 생성 스위치 | `apps/web/src/server/ai/event-cards/llm-generator.ts`, `llm-prompt.ts`, `generation-switch.ts` |
| README와 출처 문서의 사실 정정 | `README.md`, `docs/SOURCES.md` |
| 이 문서 | `docs/ROLE-TASKS.md` |

**확인함**

- 새 폴더 구조에서 타입 검사, 린트, 테스트 582개, 빌드, Python 테스트 3개 통과.
- 폴더 구조를 바꾸기 전, 사건 카드 API를 넣기 전의 통합본으로 시연 임무를 1일째부터 보고서까지 브라우저에서 진행했습니다. 위기 3번의 글을 모두 언어 모델이 썼고(`origin: generated`), 수치는 `docs/DEMO-SCRIPT.md`와 같았고, 화면 오류는 없었습니다.
- `POST /api/event`에 정상 요청 2종과 잘못된 요청 5종을 보내 200과 400을 확인했습니다.

**실행하는 법**

```bash
npm install                                   # 저장소 루트에서
cp apps/web/.env.example apps/web/.env.local  # LLM_MODEL을 비우면 미리 만든 위기만 나옵니다
npm run dev                                   # http://localhost:3000
cd services/rag && uv run --group server uvicorn rag_server:app --host 127.0.0.1 --port 8000   # 근거 검색 서버 (선택)
```

- 사건 카드의 글 생성은 기본으로 꺼져 있습니다. 켜려면 `apps/web/.env.local`에 `LLM_EVENT_CARDS=on`을 더합니다(B7).
- 검색 서버나 Python 테스트를 저장소에서 돌리면 `data/vector_db/`의 파일이 수정된 것으로 잡힙니다(B8).

**`main`에 합칠 때** 충돌이 없습니다 (미리 합쳐 보고 확인함). 폴더 구조 정리와의 충돌(`README.md`, `apps/web/src/app/api/event/route.ts`)은 `HwangSoon96` 안에서 이미 풀었습니다.

## 1. 팀이 먼저 정할 것

아래 결정이 역할 작업을 막고 있습니다.

### D1. 날짜별 흐름을 어떻게 만들지

지금은 식물 상태가 게임 날 7번에만 변합니다. 사이의 26일에는 보여 줄 변화가 없습니다. 실행해서 조사한 결과는 이렇습니다.

- **엔진으로 날짜별 상태를 계산할 수 있습니다 (확인함).** 하루를 마치면 다음 게임 날 아침의 상태와 위기 발생 여부가 이미 정해집니다. 그 사이의 재배일마다 값을 나눠 보여 줄 수 있습니다. 시연 임무의 6 → 12일째 구간에서는 뿌리 수분이 45.0 → 40.0(9일째) → 38.3(10일째, 주의 구간으로 넘어감) → 35.0(12일째, 물 부족 위기)입니다.
- **언어 모델은 상태 추세만으로는 쓸 만한 문장을 만들지 못합니다 (확인함).** 닷새치를 주면 22초가 걸리고 거의 같은 문장이 반복됩니다. 변화가 있는 날만 골라 실제 기록 문장과 함께 주면 구간 하나에 10~15초가 걸리고 입력 안의 내용으로만 씁니다. 시험한 줄은 13개뿐입니다.
- **검색 DB에는 날짜별 생장 서술이 없습니다 (확인함).** 돌아오는 것은 솎아내기, 성장 멈춤, 팬 이상 같은 사건과 절차의 기록입니다.

정할 것은 네 가지입니다.

1. 수치를 날마다 실제로 계산할지, 보여 주기만 날마다 나눌지. 뒤쪽이면 균형과 테스트가 그대로입니다.
2. 하루의 기록 한 줄을 무엇으로 만들지. 상태에서 계산한 줄(게임 값), 실제 실험 기록(실측), 모델이 쓴 줄.
3. 언어 모델이 날마다 하는 일. 문장만 쓰는지, 어떤 사건을 낼지도 고르는지.
4. 사건과 기록을 얼마나 더 쓸지. 지금은 카드 사건 5개와 실험 기록 12줄입니다.

제안: 1번은 "보여 주기만", 2번은 "상태 줄을 기본으로 하고 기록이 있는 날에만 실측 줄을 더한다", 3번은 "문장만". 이 조합이면 모델이 꺼져 있어도 33일 모두에 줄이 생깁니다.

### D2. 사건 목록의 수치 (계획 문서의 S2)

`events.json`의 판정, 확률(15%, 20%, 25%), 효과, 팬 고장 때 습도 +5는 모두 초안입니다. 사건 카드 API는 이 값을 그대로 돌려주고 응답에 `draft: true`를 붙입니다.

### D3. 검색 조각과 라이선스

- 조각 81개 가운데 문장을 그대로 실을 수 있는 것은 Khodadad 2020(CC BY 4.0)의 25개입니다. 나머지 56개는 CC BY-NC-ND이거나 공개 라이선스가 없습니다. 출처별 기록은 `data/content/source-licenses.json`에 있습니다.
- `data/sources/total_RAG.json`과 `data/vector_db/`는 이미 공개 브랜치에 올라가 있습니다.
- 대회 약관은 NASA 것이 아닌 자료가 제한 없이 공개된 것이거나 오픈소스 라이선스일 것을 요구합니다.
- 제안: 화면과 데이터 파일에는 문장을 옮기지 않고 사실만 우리 말로 적고 출처를 답니다. 조각 원문과 한국어 번역은 개발 기기에만 둡니다.

### D4. 엔진 수치

| 건 | 내용 | 확인 |
|---|---|---|
| 33번 | 과습 위기에서 표면을 닦으면 +0.3과 −0.2가 함께 붙어 미생물 수치가 0.1 오름 | 엔진으로 돌려 확인함 |
| 11번 | 지상 관제 지원까지 가면 식물 건강이 60 → 50 → 25로 합계 −35 | 엔진으로 돌려 확인함 |
| 위기 0회 | 매일 보통 급수, 사흘째 팬 강, 나흘째 팬 약이면 시드 8개 모두 위기 0회, 건강 88 | 엔진으로 돌려 확인함 |
| 9번 | 과습의 적절한 조치(팬 강)가 뿌리 수분까지 55로 되돌림 | 시연 수치가 바뀌므로 팀 결정 |
| 36번 | "범위보다 낮음"은 나올 수 없음. 33번을 고치면 최저값이 2.1이 되어 나올 수 있게 됨 | 계산 |

### D5. 제출 조건

저장소 라이선스, README의 AI 사용 문구, 저장소 안의 한국어 문서. 아직 답이 없습니다.

## 2. 역할 A: 시뮬레이션 엔진

### A1. 시간축을 엔진과 임무 저장소에 연결 (계획 문서의 A3, A4)

- **지금 상태**: `apps/web/src/lib/events/`의 판정 함수(`planEvents`, `eventsDueOn`, `nextEventOn`, `activeFlagEffects`, `trackEntriesOn`)는 있지만 엔진이 부르지 않습니다. 화면의 재배일 지도는 움직이지 않습니다.
- **할 일**: 게임 날 사이의 재배일을 하루씩 넘기며 사건을 판정하고, 사건이 나면 시간을 멈추고(`pending_event`), 대응을 받으면 효과를 적용하고 기록을 남깁니다.
- **사건 카드의 글은 `POST /api/event`에서 받습니다** (아래 계약).
- **시연 수치를 지키는 방법**
  - 시연 시드 2042에서는 조건 사건이 하나도 계획되지 않습니다 (확인함).
  - 예정 사건은 수치를 바꿉니다. 7일째 솎기의 적절한 조치는 식물 건강 +2(초안)라서, 기본 흐름에 넣으면 `docs/DEMO-SCRIPT.md`와 `apps/web/src/lib/game/mission-run.test.ts`의 값이 달라집니다.
  - 예정 사건 2개(3일째 심지 벌리기, 7일째 솎기)부터 넣고, 시연 순서를 다시 계산하기 전까지는 지금 흐름을 그대로 쓸 수 있게 두는 것을 권합니다.

**`POST /api/event` 계약** (`apps/web/src/lib/contract/schemas.ts`)

| 방향 | 칸 |
|---|---|
| 요청 | `locale`, `cultivation_day`(0~33), `state`, `event_id`, `offered_action_ids`(선택. 없으면 그 사건의 조치 전부) |
| 응답 | `event_id`, `kind`, `name`, `cultivation_day`, `scene`, `plant_line`, `options[]`, `summary`, `source_chunks`, `draft: true`, `origin` |
| 응답의 선택지 | `action_id`, `op`, `label`, `result_line`, `why`, `verdict`, `effect`, `value_type` |

- 판정과 효과는 `events.json`에서만 옵니다. 선택지의 순서는 요청한 순서입니다.
- 없는 사건, 위기 사건(`kind: crisis`), 기간 밖의 날, 그 사건의 것이 아닌 조치는 400입니다. 위기는 지금처럼 `POST /api/crisis`를 씁니다.

### A2. 구간 궤적과 "상태가 바뀐 날"

- **할 일**: 하루를 마칠 때 다음 게임 날까지의 날짜별 상태(보간)와 구간이 바뀌는 날을 계산해 화면에 넘깁니다. 수치 규칙은 바꾸지 않습니다.
- **타입**: 기록에 "상태 줄"의 종류가 없습니다. 지금은 `event`, `track`, `milestone`뿐입니다. `apps/web/src/lib/contract/types.ts`의 `TimelineLogEntry`에 더해야 합니다.
- **기다리는 것**: D1.

### A3. 사건 날짜에 상태를 맞추기

- 원인 사건이 표시(flag)를 남겨 밤사이 변화를 바꾸는 구조는 이미 있습니다(`blocks_watering`, `night_drift`).
- 지금 초안 수치로는 1일째에 급수가 막히면 뿌리 수분이 55 → 45 → 35 → 25 → 15가 되어 22일째에 위기가 확실해집니다. 밤사이 변화를 −11로 하면 17일째에 위험 구간에 들어갑니다. 실제 기록(14~16일째)에 가장 가까운 게임 날입니다.
- 사건은 게임 날(재배일 6, 12, 17, 22, 28)에만 납니다. 다른 날에 내려면 엔진이 날마다 계산해야 합니다.
- **기다리는 것**: D1, D2.

### A4. 사건 목록 보완을 막는 테스트 7개

`docs/TIMELINE-ENGINE-NOTES.md`의 T5와 T6이 역할 B에 요청한 수정(`pillow_no_flow`의 `flag_effects`, 실험 기록의 `entry_id`)은 준비돼 있습니다. 그런데 넣으면 아래 테스트가 깨집니다 (합쳐서 돌려 확인함).

| 테스트 | 깨지는 이유 |
|---|---|
| `events.test.ts`의 "warns about a flag that has no effect entry" | 실제 파일에서 경고가 나는 것을 검사합니다. 효과를 채우면 경고가 사라집니다 |
| `judge.test.ts`의 "returns the dated track entries of a day with stable keys" | `VEG-01A#1` 형식의 키를 적어 두었습니다 |
| `fixtures.test.ts`의 "has a log in day order that matches the list" 5개 | 예시 상태가 같은 형식의 키를 씁니다 |

- **할 일**: 경고 테스트는 테스트용 목록을 쓰게 바꾸고, 예시 상태와 테스트의 키를 아래 번호로 바꿉니다. 그 뒤 역할 B가 데이터를 넣습니다.
- **넣을 번호**: `veg01a_d0`, `veg01a_d7`, `veg01a_d14`, `veg01a_d33`, `veg01b_d15`, `veg01b_d16`, `veg01b_d33`, `veg03a_early_growth`, `veg03j_d3`, `veg03j_d7`, `veg03j_after_germination`, `veg03j_d29`.

### A5. `verified_source` 칸을 타입과 스키마에 추가

- `events.json`의 실험 기록에 원문 인용 칸(`verified_source`: `title`, `url`, `quote`, `license`)을 더했습니다. 대조된 기록에만 있습니다.
- `apps/web/src/lib/events/schema.ts`의 기록 스키마는 모르는 칸을 읽을 때 버립니다. `source_check`는 이미 들어갔고, `verified_source`도 넣어야 화면까지 갑니다.

### A6. 엔진 규칙 수정 (D4의 결정 뒤)

- **33번**: `apps/web/src/lib/game/engine.ts`의 `computeMicrobial`에서, 표면을 닦아 부분적으로 끝난 위기에는 +0.3을 붙이지 않습니다. 36번과 같이 봐야 합니다.
- **11번**: `apps/web/src/lib/game/rules.ts`의 지상 관제 지원 값.
- **위기 0회 경로**: `events.json`의 `fan_off_after_restart`가 상태와 무관하게 나는 사건의 후보입니다. 근거는 Khodadad 2020(CC BY 4.0)에 있고 원문 대조가 끝났습니다.

### A7. 공용 계약 파일 관련

- **`schemas.ts` 검토 요청.** 요청의 번호 형식(`/^[a-z0-9_]+$/`, 64자), 크기 상한(본문 64 KiB, 이력 200건 등), 생성 글의 칸별 길이 상한(장면 420, 식물의 말 240, 단서 160, 선택지 100, 선택 뒤 식물의 말 220, 이유 280), 사건 카드의 요청과 응답 형식을 더했습니다.
- **이력의 번호 검사.** 위기 요청의 이력에는 근거 목록(`evidence.json`)에 있는 위기만 들어갈 수 있습니다. 사건을 이력에 넣게 되면 `apps/web/src/server/ai/crisis/pipeline.ts`의 `assertRequestIdsKnown`을 넓혀야 하니 알려 주세요.
- **사본 두 개.** `schemas.ts`의 `eventResponseOpSchema`와 `eventCardEffectSchema`는 `apps/web/src/lib/events/schema.ts`의 것과 같은 내용의 사본입니다. 서로 불러오면 순환 참조가 되어 따로 두었고, `schemas.test.ts`가 둘이 같은지 검사합니다. 조작이나 효과의 종류를 바꾸면 양쪽을 같이 고칩니다.
- **요청 횟수 제한.** 넣으려면 `types.ts`의 `ApiError` 코드에 하나를 더해야 합니다.

### A8. 엔진이 정할 것 하나

`mild_tip_burn`은 팬이 이미 강일 때도 날 수 있습니다. 그때 "팬을 강으로"를 선택지에 넣을지는 엔진이 `offered_action_ids`로 정합니다.

## 3. 역할 B: 데이터와 생성

### 끝난 것

| 내용 | 파일 |
|---|---|
| 출처 6종의 라이선스 기록과 점검 테스트 | `data/content/source-licenses.json` |
| 위기 API의 요청 검사와 생성 글 검사 | `apps/web/src/lib/contract/schemas.ts`, `apps/web/src/server/ai/crisis/validate.ts`, `apps/web/src/lib/contract/claims.ts` |
| 실험 기록 12건의 원문 대조 | `data/content/events.json`의 `source_check`, `verified_source` |
| 사건별 검색 평가 질문 12개 | `data/eval/evaluation.events.json` |
| NASA 공개 문서에서 뽑은 조각 26개 | `data/sources/public_sources_RAG.json` |
| 사건 카드 API, 사건용 출력 형식과 검증, 미리 만든 카드 글 5개 | `apps/web/src/app/api/event/`, `apps/web/src/server/ai/event-cards/`, `data/content/event-cards.json` |
| 사건의 근거 조각 목록 보완 (아래 B2) | `data/content/events.json`의 `source_chunks`, `data/eval/evaluation.events.json` |
| 사건 카드 글 생성기 연결 (아래 B7) | `apps/web/src/server/ai/event-cards/llm-generator.ts`, `llm-prompt.ts` |
| 병합 뒤 달라진 사실에 맞게 README와 출처 문서를 고침 | `README.md`, `docs/SOURCES.md` |

### B1. 검색 DB에 공개 조각을 넣고 다시 만들기 (임베딩 키가 필요)

- `data/sources/public_sources_RAG.json`의 26개는 원문에서 그대로 잘라 낸 것이고 스크립트로 대조했습니다 (확인함). 과습·곰팡이 위기의 백일홍 기록, VEG-01 물 부족 초록, 팬과 급수 지침, 수확과 냉동, 소독 물티슈가 들어 있습니다.
- **주의**: `services/rag/build_vector_db.py`는 입력 파일에 없는 조각을 DB에서 지웁니다. 새 파일만 넣고 돌리면 기존 81개가 지워집니다. 두 파일을 합친 뒤 돌려야 합니다.
- `data/sources/total_RAG.json`에 합치려면 새 출처 10종을 `data/content/source-licenses.json`에 더해야 합니다. 그 파일의 테스트는 문장 인용을 CC BY 4.0에만 허용하므로, NASA 문서의 사용 조건 표기를 허용 목록에 넣을지 정해야 합니다.
- 새 조각에는 한국어 번역이 없습니다. 키워드 검색은 영어로만 찾습니다.

### B2. 사건의 근거 조각 목록 보완 (끝남)

조각 본문을 읽고, 그 사건의 절차나 관찰이나 이상 현상을 직접 적은 조각만 남겼습니다.

| 사건 | 바뀐 것 |
|---|---|
| `overwater_mold` | `veggie-03a-fan-restart` 추가. `veggie-cultivar-airflow` 삭제(일반적인 장비 설명) |
| `thinning` | `veggie-seed-wicks-thinning` 추가 |
| `harvest_procedure` | `veggie-sequential-harvest-methods`, `veggie-03a-sample-handling` 추가. `veg01-harvest-b`는 넣지 않음(먹는 수확물의 소독) |
| `fan_off_after_restart` | `veg01-light-hardware` 삭제(이상 현상이 적혀 있지 않음) |
| `water_shortage`, `wick_opening`, `pillow_no_flow`, `mild_tip_burn` | 그대로 |

키워드 검색으로 평가한 값입니다(영어 질문, 한국어 번역 없음, 벡터 검색 없음, 질문 12개).

| | Recall@5 | MRR@5 |
|---|---|---|
| 보완 전 | 0.583 | 0.878 |
| 보완 후 | 0.597 | 0.794 |

달라진 것은 정답 표시입니다. 검색 자체는 같습니다.

### B3. 실험 기록을 공개 원문이 뒷받침하는 문장으로 바꾸기

12건 가운데 공개 원문으로 뒷받침되는 것은 1건(VEG-03A 팬 이상)입니다. 나머지는 날짜, 포기 수, 패드 이름 같은 세부가 문장을 실을 수 없는 논문에만 있습니다. 아래 문장으로 바꾸면 실측으로 표시할 수 있습니다. 바꿀지는 D1과 D3의 결정을 따릅니다.

| 기록 | 지금 문장의 문제 | 공개 원문이 뒷받침하는 문장 | 출처 |
|---|---|---|---|
| VEG-01A 0일째 | "Pillow A", 날짜가 원문에 없음 | VEG-01을 시작할 때 첫 패드에 물이 들어가지 않아 예비 패드로 바꿨다 | NTRS 20150001374 |
| VEG-01A 7일째 | "Pillow B"가 원문에 없음 | 패드 여섯 개 가운데 다섯 개에서 싹이 났다. 7일째에 패드마다 한 포기로 솎았다 | NTRS 20150001374, Khodadad 2020 |
| VEG-01A 14일째 | "14일째", "다섯 중 셋", "둘이 죽음"이 원문에 없음 | 약 일주일 반 뒤 식물이 잘 자라지 않고 심지가 말라 있었다. 패드에 물을 직접 더했고, 여러 포기는 회복했고 두어 포기는 회복하지 못했다 | NTRS 20150001374 |
| VEG-01A 33일째 | "28일 예정이었다"가 원문에 없음 | VEG-01A는 33일 자란 뒤 수확했다 | Khodadad 2020 |
| VEG-01B 15일째, 16일째 | 날짜별 기록이 공개 원문에 없음 | VEG-01B의 식물은 초기에 물이 부족한 시기가 있었다(날짜 없음) | Khodadad 2020 |
| VEG-01B 33일째 | "회복했다"가 원문에 없음 | VEG-01B는 33일 자란 뒤 수확했다. 승무원이 절반을 먹었고 나머지는 냉동했다 | Khodadad 2020, NTRS 20160004060 |
| VEG-03J 4건 | 공개 원문이 없음 | 대체 문장 없음 | |

### B4. 사건 목록 데이터

- **A4 뒤에**: `pillow_no_flow`의 `flag_effects`와 실험 기록의 `entry_id`를 넣습니다.
- **D2 뒤에**: 정해진 수치를 `events.json`에 반영하고 초안 표시를 정리합니다(계획 문서의 B6).

### B5. 사건 카드의 글

- `data/content/event-cards.json`의 다섯 장은 초안입니다. 팀이 읽고 고쳐야 합니다.
- 설명(`why`)은 `events.json`에 적힌 것만 근거로 쓰고, 근거가 없는 결과는 "게임 값"이라고 적었습니다.
- **사건 이름이 답을 드러냅니다.** 응답의 `name`은 `events.json`의 이름 그대로이고, "Open the germination wicks", "Thin to one plant per pillow", "The fan reads low but is off"는 답이나 원인을 말합니다. 선택 전에 보여 줄지는 역할 C와 정합니다.
- 카드 글의 근거가 된 기록 가운데 원문 대조가 된 것은 팬 이상 하나입니다.

### B6. 상태 줄의 틀 문장과 기록 줄 데이터 (D1 뒤에)

D1에서 "상태 줄을 기본으로"로 정하면, 구간이 바뀌는 날과 그렇지 않은 날의 틀 문장이 필요합니다. 글은 역할 C의 사전 파일에 두고, 어떤 날에 어떤 줄이 나오는지는 역할 A의 계산이 정합니다.

### B7. 생성 글 (`apps/web/src/server/ai/crisis/llm/**`, `woojin-llm` 브랜치에서 온 코드)

- **제한 시간.** `apps/web/.env.example`의 `LLM_TIMEOUT_MS`는 30초입니다. 시험한 기기에서는 생성 한 번에 30~52초가 걸렸습니다 (확인함). 기본값이면 표시 없이 미리 만든 위기로 넘어갑니다. 60초로 올려서 썼습니다.
- **검사 규칙이 두 곳에 있습니다.** `llm/guard.ts`의 길이 상한, 정답 노출 표현, 안전 표현 목록과 `schemas.ts`·`validate.ts`·`claims.ts`의 것이 따로 있습니다. 지금은 `schemas.ts`의 상한이 `guard.ts`의 값 이상이라 충돌하지 않습니다. 한곳에서 가져오게 합치는 것을 권합니다.
- **지시문에 들어가는 조각의 라이선스.** 검색 결과가 600자까지 그대로 지시문에 들어갑니다. 물 부족 위기의 질문에서는 상위 4개가 모두 "사실만 쓸 출처"의 조각입니다 (확인함). 모델이 그 문장을 화면 글에 옮기면 문제가 화면까지 갑니다. `source-licenses.json`의 `use`로 걸러 내거나, D3의 결정에 맞춥니다.
- **모델은 위기를 고르지 않습니다.** 코드가 후보를 정하고 모델은 장면과 선택지의 글만 씁니다. 판정과 수치는 근거 목록에서 옵니다.
- **사건 카드 생성기 (연결함).** `LLM_MODEL`이 설정돼 있으면 `POST /api/event`가 글을 생성합니다(`apps/web/src/server/ai/event-cards/llm-generator.ts`). 위기 쪽의 모델 호출 코드와 설정을 그대로 쓰고, 그쪽 파일은 고치지 않았습니다.
  - 모델이 쓰는 것: 장면, 식물의 말, 선택지 문구, 선택 뒤 식물의 말.
  - 모델이 쓰지 않는 것: 이유 설명(`why`). 미리 만든 글에서 가져옵니다. 모델에는 판정과 사건 이름과 날짜를 주지 않으므로, 이유를 쓰게 하면 원인을 지어내기 때문입니다.
  - 근거 검색 결과는 지시문에 넣지 않습니다.
  - 사건 기록에 없는 증상(시듦, 곰팡이, 변색 등)이 글에 나오면 거절합니다. 두 번 실패하면 미리 만든 글이 나옵니다.
  - **실제 모델로 돌린 결과 (확인함)**: 카드 5장을 3번씩, 15번 모두 생성됐고 한 번에 15~27초(중앙값 17초)가 걸렸습니다.
  - **문제 두 가지**: ① 미리 만든 글을 거의 그대로 베낀 경우가 많습니다. 솎기 카드는 세 번 모두 미리 만든 글과 같았습니다 ② 근거 없는 관찰을 덧붙인 장면이 15번 중 2번 있었습니다("싹 끝이 배지 위로 보인다", "배지가 축축해 보인다. 재배실 습도는 정상이다"). 이런 문장을 걸러 내는 검사는 없습니다.
  - **그래서 기본으로 꺼 두었습니다.** `LLM_EVENT_CARDS`가 `on`, `true`, `1`일 때에만 사건 카드 글을 생성합니다. 그 밖에는 모델이 설정돼 있어도 미리 만든 글이 나옵니다. `apps/web/.env.example`에는 이 변수가 아직 없습니다(LLM 담당의 파일이라 고치지 않음).
- **날짜별 기록 문장.** D1의 조사 수치를 참고하세요. 변화가 있는 날만 골라 한 번에 부르는 방식이 구간 하나에 10~15초였습니다.
- **한국어 생성 글에는 내용 검사가 없습니다.** 금지 표현 목록이 영어뿐입니다.

### B8. Python 검색 코드와 DB 파일

- **검색 서버나 Python 테스트를 저장소에서 돌리면 `data/vector_db/chroma.sqlite3`와 `data_level0.bin`이 수정된 것으로 잡힙니다 (확인함).** DB 파일을 추적에서 뺄지, 복사본에서 돌릴지 정해야 합니다.
- 앱이 기본으로 쓰는 검색은 키워드 검색입니다(`services/rag/retriver.local.yaml`, 임베딩 키 불필요). 벡터 검색을 섞은 점수와 재정렬은 확인 못 함.
- D3의 결정에 따라 `data/sources/total_RAG.json`, `data/vector_db/`, 한국어 번역(`data/sources/json_ko`)의 처리를 정합니다. 번역은 CC BY-NC-ND 출처의 변형물이라 공개할 수 없습니다.

### B9. 문서

- `docs/SOURCES.md`와 README에 새 데이터 파일(`event-cards.json`, `public_sources_RAG.json`, `source-licenses.json`)과 새 출처를 적어야 합니다.
- README는 언어 모델 연결까지 반영돼 있습니다. 사건 카드 API(`POST /api/event`)와 시간축은 아직 적혀 있지 않습니다.

## 4. 역할 C: 화면과 콘텐츠

### C1. 시간 흐름 조작과 기록 목록 (계획 문서의 C1, C3)

- 일시정지, 배속, "다음 사건까지". 사건 카드가 떠 있으면 시간이 멈춥니다.
- 기록 목록: 사건 줄, 실제 실험 기록 줄, 게임 날 줄. D1에서 정해지면 상태 줄.
- 예시 상태는 `apps/web/src/lib/contract/fixtures.ts`의 `TIMELINE_FIXTURES` 6개입니다.

### C2. 사건 카드 (계획 문서의 C2)

- 데이터는 `POST /api/event`의 응답입니다(2절의 계약). 선택지의 칸 이름(`label`, `result_line`, `why`, `verdict`, `value_type`)은 위기 응답과 같아서 같은 부품으로 그릴 수 있습니다.
- 위기와 다른 점: 단서(`clues`)가 없고, 수치 변화는 `delta`가 아니라 `effect`이며, 출처 인용(`source`)이 없고 `summary`와 `source_chunks`가 있습니다.
- `origin`이 `generated`이면 위기 화면처럼 "AI가 쓴 글" 표시가 필요합니다.
- `draft: true`인 동안은 판정과 수치가 초안입니다.
- 사건 이름을 선택 전에 보여 주지 않는 것을 권합니다(B5).

### C3. 생성 대기

위기 글 생성에 30~50초가 걸립니다 (확인함). 기다리는 동안의 화면과, 미리 만든 위기로 넘어갔을 때의 표시를 확인해 주세요.

### C4. 식물 그림이 근거 목록과 맞지 않음

`apps/web/src/features/grow-room/lettuce-sprite.ts` 기준입니다.

| 위기 | 그림 | 근거 목록 |
|---|---|---|
| 물 부족 | 시든 그림 | "시듦"은 확인한 원문에 없어 뺀 증상입니다. 근거 목록의 증상은 생장 부진, 마른 심지, 스트레스를 받은 식물입니다 |
| 과습 1단계 | 물방울, 잎 말림 | 과도한 수분, 잎의 물방울 ("잎 말림"은 근거 없음) |
| 과습 2단계 | 갈색 가장자리 | 잎과 줄기의 곰팡이 |
| 과습 3단계 | 곰팡이 | 잎과 줄기의 부패 |

2단계와 3단계에서 글과 그림이 서로 다른 증상을 보여 줍니다.

### C5. 그 밖의 화면 항목

- **`docs/DESIGN.md`의 "죽은 조직 제거".** 가위 아이콘의 용도에 적혀 있는데, 원문에 없어 근거 목록에서 뺀 조치입니다.
- **조명 조작.** 수치를 바꾸지 않는데 하루 두 번의 횟수를 씁니다 (확인함). 숨기는 것을 권합니다.
- **실측 표시.** 실험 기록은 `source_check`가 `checked`인 것만 실측으로 표시합니다. 지금은 12건 중 1건입니다.
- **논문 문장.** `data/content/source-licenses.json`에서 `use`가 `facts_only`인 출처 5곳의 문장은 화면 글에 그대로 옮기지 않습니다.
- **충돌을 푼 자리 확인.** `crisis-panel.tsx`에서 "AI가 쓴 글" 줄을 장면 글 바로 아래에 `text-caption text-ink-muted`로 넣었습니다. 새 디자인에 맞는 자리와 모양인지 봐 주세요.
- **`apps/web/src/lib/i18n/strings.test.ts`.** 금지 표현 목록을 `apps/web/src/lib/contract/claims.ts`에서 가져오게 바꿨습니다. 검사 내용은 같습니다.

### C6. 발표와 영상의 표현

- 2.14~4.86은 ISS에서 기른 상추 잎의 세균 수 평균의 범위입니다. "ISS와 지상", "세균·곰팡이"라고 하지 않습니다.
- "팬을 강으로 두면 물 부족이 된다"는 실제 사례가 아니라 게임 규칙입니다.
- 병든 식물과 승무원의 스트레스는 측정한 효과가 아니라 보고서의 당부입니다.
- 소독 물티슈(Pro-San)는 먹는 수확물에 대한 절차입니다(NTRS 20150021302). 분석용 냉동 시료를 닦았다는 기록은 없습니다.

## 5. 확인 못 한 것

- 사건 카드 API를 넣은 뒤에는 브라우저로 임무를 끝까지 다시 돌려 보지 않았습니다. 화면은 이 API를 아직 부르지 않습니다.
- 벡터 검색을 섞은 검색 점수와 재정렬 (임베딩 키 없음).
- 언어 모델의 날짜별 문장은 13줄만 시험했습니다.
- 다른 기기에서의 생성 시간, Chromium 외의 브라우저.
- `data/sources/public_sources_RAG.json`의 OSDR 자료에 붙인 "NASA open data" 표기는 저장해 둔 원문이 아니라 `docs/SOURCES.md`의 표기를 따른 것입니다.
- 라이선스에 대한 내용은 출판사 기록과 라이선스 문구를 읽은 것이고 법률 자문이 아닙니다.
