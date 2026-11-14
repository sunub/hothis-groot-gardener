"""Recommend next actions for a simulator state with an LLM grounded on retrieved evidence chunks."""

import argparse
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
import yaml

from paths import CONFIG_DEFAULT, VECTOR_DB_PATH
from retriver import Retriever


DEFAULT_MODEL = "gpt-4.1-mini"

SYSTEM_PROMPT = """너는 국제우주정거장 Veggie 장치의 적상추 재배 시뮬레이션에서 다음 관리 행동을 추천하는 조언자다.
규칙:
- 아래에 주어진 근거 chunk만 사용한다. chunk에 없는 사실, 수치, 사례를 지어내지 않는다.
- 추천과 이유마다 그 근거가 된 chunk의 id를 적는다. 주어진 id만 쓴다.
- 근거가 부족하면 insufficient_evidence를 true로 하고, 무엇이 부족한지 적는다.
- 이것은 교육용 시뮬레이션이다. 실제 식물이나 사람을 진단하지 않고, 수확물이 안전하다거나 먹어도 된다고 말하지 않는다.
- 답은 한국어로, 아래 JSON 형식으로만 한다.
{"recommendations": [{"action": "행동 한 문장", "reason": "이유 한두 문장", "chunk_ids": ["id"]}],
 "summary": "상황 요약 한 문장",
 "insufficient_evidence": false,
 "missing": "부족한 근거 (없으면 빈 문자열)"}"""


def format_chunks(chunks: list[dict]) -> str:
    blocks = []
    for chunk in chunks:
        meta = chunk.get("metadata", {})
        header = f"[id: {chunk['id']}] {meta.get('subsection', '')} ({meta.get('source_location', '')})"
        application = meta.get("simulator_application_ko")
        body = chunk["text"] + (f"\n시뮬레이터 적용: {application}" if application else "")
        blocks.append(f"{header}\n{body}")
    return "\n\n---\n\n".join(blocks)


def parse_answer(raw: str, allowed_ids: set[str]) -> dict:
    """Parse the model's JSON and drop citations to chunks that were not retrieved."""
    data = json.loads(raw)
    if not isinstance(data, dict) or not isinstance(data.get("recommendations"), list):
        raise ValueError("LLM answer is not in the expected JSON format")
    dropped = []
    recommendations = []
    for item in data["recommendations"]:
        if not isinstance(item, dict) or not isinstance(item.get("action"), str):
            raise ValueError("LLM recommendation is missing an action")
        ids = [i for i in item.get("chunk_ids", []) if isinstance(i, str)]
        dropped.extend(i for i in ids if i not in allowed_ids)
        recommendations.append({
            "action": item["action"],
            "reason": str(item.get("reason", "")),
            "chunk_ids": [i for i in ids if i in allowed_ids],
        })
    return {
        "summary": str(data.get("summary", "")),
        "recommendations": recommendations,
        "insufficient_evidence": bool(data.get("insufficient_evidence", False)),
        "missing": str(data.get("missing", "")),
        "dropped_chunk_ids": dropped,
    }


class RagAdvisor:
    """Retriever (or Reranker) + chat model. Any object with retrieve(query) -> chunks works as the retriever."""

    def __init__(self, retriever, openai_client, model: str = DEFAULT_MODEL, temperature: float = 0.2):
        self.retriever = retriever
        self.client = openai_client
        self.model = model
        self.temperature = temperature

    def advise(self, query: str) -> dict:
        chunks = self.retriever.retrieve(query)
        response = self.client.chat.completions.create(
            model=self.model,
            temperature=self.temperature,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"근거 chunk:\n\n{format_chunks(chunks)}\n\n현재 상황과 요청:\n{query}"},
            ],
        )
        answer = parse_answer(response.choices[0].message.content or "", {c["id"] for c in chunks})
        return {
            "query": query,
            "model": self.model,
            **answer,
            "evidence": [
                {
                    "id": c["id"],
                    "rank": c["rank"],
                    "subsection": c.get("metadata", {}).get("subsection"),
                    "source_url": c.get("metadata", {}).get("source_url"),
                    "source_location": c.get("metadata", {}).get("source_location"),
                }
                for c in chunks
            ],
        }


def openai_client_from_env() -> OpenAI:
    load_dotenv()
    api_key = os.getenv("API_KEY")
    if not api_key:
        raise ValueError("API_KEY is missing. Add API_KEY=... to .env")
    return OpenAI(api_key=api_key)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("query", help="simulator state and request for next actions (Korean)")
    parser.add_argument("--model", default=os.getenv("LLM_MODEL", DEFAULT_MODEL))
    parser.add_argument("--rerank", action="store_true", help="rerank candidates first (uv sync --group rerank)")
    parser.add_argument("--db-path", type=Path, default=VECTOR_DB_PATH)
    parser.add_argument("--collection", default="plant_research")
    parser.add_argument("--config", type=Path, default=CONFIG_DEFAULT)
    args = parser.parse_args()
    try:
        client = openai_client_from_env()
        retriever = Retriever(args.db_path, args.collection, args.config, openai_client=client)
        if args.rerank:
            from reranker import Reranker

            retriever = Reranker(retriever)
        advisor = RagAdvisor(retriever, client, args.model)
        print(json.dumps(advisor.advise(args.query), ensure_ascii=False, indent=2))
    except (ValueError, OSError, yaml.YAMLError, json.JSONDecodeError) as exc:
        parser.exit(1, f"Error: {exc}\n")


if __name__ == "__main__":
    main()
