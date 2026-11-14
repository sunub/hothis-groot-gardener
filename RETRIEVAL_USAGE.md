# 검색·재정렬·평가 실행 방법

모든 명령은 프로젝트 루트(`/home/kmjj42/nasa_plant`)에서 실행합니다. 검색 입력은 논문에 대한 질문보다 **시뮬레이션의 현재 상태와 다음 행동 요청**을 한글로 적습니다. 검색 결과는 LLM이 행동을 추천할 때 참고할 근거 chunk 5개입니다.

## 준비

프로젝트 루트의 `.env`에 OpenAI API 키를 입력합니다. Dense 검색은 질문을 `text-embedding-3-small`로 임베딩하므로 검색과 평가에도 키가 필요합니다.

```dotenv
API_KEY=발급받은_API_키
```

기본 검색에 필요한 패키지를 설치합니다.

```bash
uv sync
```

DB가 없다면 `data/json/total_RAG.json`으로 먼저 생성합니다. 이미 `vector_db/chroma.sqlite3`가 있다면 이 단계는 건너뛸 수 있습니다.

```bash
uv run python build_vector_db.py
```

Chroma는 SQLite 파일 자체가 아닌 **`vector_db/` 디렉터리**를 열어 사용합니다. BM25는 `data/json_ko/`의 같은 ID에 해당하는 한국어 번역도 색인합니다.

## 1. Weighted RRF 검색만 사용

BM25와 Dense 결과를 Weighted RRF로 합쳐 상위 5개 chunk를 JSON으로 출력합니다.

```bash
uv run python retriver.py "현재 상태: 파종 7일차이고 한 파우치에 유묘가 두 포기 자랐습니다. 다음 관리 행동을 추천해 주세요."
```

`retriver.yaml`에서 `alpha`(Dense 가중치, BM25 가중치는 `1 - alpha`), `k`(순위 완화 상수), `candidate_count`(각 검색 방식의 후보 수)를 조절할 수 있습니다.

## 2. Reranker까지 사용

선택 의존성을 설치합니다. 첫 실행에서는 Hugging Face의 `mixedbread-ai/mxbai-rerank-large-v2` 모델 가중치도 내려받습니다.

```bash
uv sync --group rerank
```

Weighted RRF의 상위 20개 후보를 재정렬한 뒤 최종 5개 chunk를 출력합니다.

```bash
uv run --group rerank python reranker.py "현재 상태: 파종 7일차이고 한 파우치에 유묘가 두 포기 자랐습니다. 다음 관리 행동을 추천해 주세요."
```

후보 수를 바꾸려면 `--candidates 30`, 추론 배치 크기를 줄이려면 `--batch-size 1`, 장치를 지정하려면 `--device cuda` 또는 `--device cpu`를 추가합니다.

## 3. 평가

평가 데이터는 `query`(한글 시뮬레이션 상태와 행동 요청) 및 `relevant_ids`(근거로 적합한 chunk ID 목록)를 가진 JSON 배열입니다. 예시는 `data/evaluation.example.json`에 15개 있습니다. 실제 성능 비교에는 직접 검토한 정답 ID를 사용합니다.

Weighted RRF 검색만 평가:

```bash
uv run python evaluation.py --dataset data/evaluation.example.json
```

Reranker를 적용한 결과 평가:

```bash
uv run --group rerank python evaluation.py --dataset data/evaluation.example.json --rerank
```

두 명령은 같은 `Recall@5`, `MRR@5`, `nDCG@5`를 사용합니다. 화면과 저장된 보고서의 `datasets`에는 **평가 파일별 평균(`summary`)과 각 상황의 점수(`details`)**가 있고, `overall.summary`에는 **모든 평가 파일의 질문을 합친 평균**이 있습니다. 각 상황에는 검색된 chunk ID도 기록합니다.

평가 파일을 여러 개 한 번에 비교하려면 경로를 이어서 적습니다.

```bash
uv run python evaluation.py --dataset data/evaluation.example.json data/다른_평가.json
```

평가할 때마다 `result/weighted_rrf_날짜시간.json` 또는 `result/rerank_날짜시간.json`에 보고서를 새로 저장합니다. 저장 위치를 바꾸려면 `--output-dir 경로`를 추가합니다. Reranker 평가의 후보 수와 배치 크기는 각각 `--rerank-candidates`, `--rerank-batch-size`로 조절할 수 있습니다.

## 4. LLM 추천 붙이기 (`rag_llm.py`)

검색한 근거 chunk 5개를 LLM에 넘겨 다음 행동을 추천받습니다. LLM은 주어진 chunk만 근거로 쓰고, 추천마다 근거 chunk ID를 적습니다. 검색되지 않은 ID를 적으면 결과에서 빼고 `dropped_chunk_ids`에 남깁니다. 키는 검색과 같은 `.env`의 `API_KEY`를 씁니다.

```bash
uv run python rag_llm.py "현재 상태: 재배 12일차, 뿌리 수분 30(부족), 재배실 습도 55, 팬 약. 다음 관리 행동을 추천해 주세요."
```

Reranker를 거친 근거를 쓰려면 `--rerank`를 붙입니다 (`uv sync --group rerank` 필요). 모델은 `--model` 또는 환경변수 `LLM_MODEL`로 바꿉니다. 기본값은 `gpt-4.1-mini`입니다.

출력 JSON: `summary`, `recommendations`(행동, 이유, 근거 chunk ID), `insufficient_evidence`, `missing`, `dropped_chunk_ids`, `evidence`(검색된 chunk 5개의 ID, 순위, 출처).

API 키 없이 실제 `vector_db`로 동작을 확인하는 테스트:

```bash
uv run python -m unittest test_rag_llm
```

`data/json_ko/`가 없으면(저장소에는 올리지 않음) BM25는 경고를 내고 영어 원문만 색인합니다.
