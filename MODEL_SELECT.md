# NASA 식물 재배 시뮬레이션 RAG

시뮬레이션의 현재 상태가 한글로 전달되면, 다음 행동을 추천할 LLM에 참고 근거를 제공하는 검색 시스템입니다. 근거는 해외 논문에서 발췌한 chunk로 구성하며, Chroma DB에는 영어 원문을 저장합니다. 검색 결과는 상위 5개 chunk입니다.

## Embedding 모델: OpenAI `text-embedding-3-small`

Chroma 벡터 DB를 만들 때 영어 chunk를 임베딩하고, Dense 검색 시 한글 query를 임베딩하는 데 모두 `text-embedding-3-small`을 사용합니다.

## Retriever: BM25 + Dense + Weighted RRF

질문은 한글이고 논문 원문은 영어라서, **BM25만으로는** 언어가 다른 표현을 놓칠 수 있습니다. 반대로 **Dense 검색만으로는** 특정 장치명이나 전문용어처럼 단어 일치가 중요한 근거를 놓칠 수 있습니다. 두 방식의 장점을 함께 쓰기 위해 BM25와 Dense의 검색 순위를 **Weighted RRF**로 결합합니다.

현재 구현은 BM25가 영어 원문과 `data/json_ko/`의 한국어 번역을 함께 색인합니다. `alpha`(Dense 가중치)와 `k`(순위 완화 상수)는 `retriver.yaml`에서 조절할 수 있습니다.

## Reranker: `mixedbread-ai/mxbai-rerank-large-v2`

기본 검색 결과가 충분히 정확하지 않을 때, Weighted RRF 후보를 다시 점수화해 상위 5개를 고릅니다. 이 모델은 [공식 모델 카드](https://huggingface.co/mixedbread-ai/mxbai-rerank-large-v2)에서 **영어 검색 성능, 다국어 지원, 긴 문맥 지원**을 제시합니다. 영어 논문 원문이 중심이고 한글 질문이 들어오는 환경에 맞으며, 논문 내용을 부분별로 발췌해 길이가 긴 chunk도 포함되는 점을 고려해 선택했습니다.

현재 `reranker.py`는 각 후보에 한국어 번역이 있으면 그 번역을 모델에 입력하고, 없으면 Chroma에 저장된 영어 원문을 입력합니다. 반환하는 근거 chunk의 본문은 Chroma의 영어 원문입니다.

설치, 검색, reranking, 평가 명령은 [RETRIEVAL_USAGE.md](RETRIEVAL_USAGE.md)를 참고하세요.
