"""Offline test of rag_llm.py against the real vector_db, with fake OpenAI clients.

Run: uv run python -m unittest test_rag_llm
"""

import json
from pathlib import Path
from types import SimpleNamespace
import unittest

import chromadb

from rag_llm import RagAdvisor, parse_answer
from paths import CONFIG_DEFAULT, VECTOR_DB_PATH
from retriver import Retriever

TARGET_ID = "veggie-03a-fan-restart"


class FakeOpenAI:
    """Embeds every query as one stored chunk vector, and answers chat with a fixed JSON."""

    def __init__(self, vector, answer: dict):
        self.messages = None
        self.embeddings = SimpleNamespace(
            create=lambda **_: SimpleNamespace(data=[SimpleNamespace(embedding=vector)])
        )
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._chat))
        self._answer = answer

    def _chat(self, **kwargs):
        self.messages = kwargs["messages"]
        content = json.dumps(self._answer, ensure_ascii=False)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


class RagAdvisorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        collection = chromadb.PersistentClient(path=str(VECTOR_DB_PATH)).get_collection("plant_research")
        cls.vector = list(collection.get(ids=[TARGET_ID], include=["embeddings"])["embeddings"][0])

    def make(self, answer):
        client = FakeOpenAI(self.vector, answer)
        retriever = Retriever(VECTOR_DB_PATH, "plant_research", CONFIG_DEFAULT, openai_client=client)
        return RagAdvisor(retriever, client), client

    def test_db_has_81_chunks(self):
        client = FakeOpenAI(self.vector, {})
        retriever = Retriever(openai_client=client)
        self.assertEqual(len(retriever.chunks), 81)

    def test_advise_grounds_answer_on_retrieved_chunks(self):
        query = "현재 상태: 재배실 습도가 높고 팬은 약입니다. 다음 행동을 추천해 주세요."
        probe, _ = self.make({})
        cited = probe.retriever.retrieve(query)[0]["id"]
        answer = {
            "summary": "습기가 많다.",
            "recommendations": [
                {"action": "팬이 실제로 도는지 확인한다.", "reason": "근거 chunk의 기록.", "chunk_ids": [cited, "made-up-id"]}
            ],
            "insufficient_evidence": False,
            "missing": "",
        }
        advisor, client = self.make(answer)
        result = advisor.advise(query)

        self.assertEqual(len(result["evidence"]), 5)
        self.assertEqual(result["evidence"][0]["id"], cited)
        # Only retrieved chunk ids survive; invented ones are reported.
        self.assertEqual(result["recommendations"][0]["chunk_ids"], [cited])
        self.assertEqual(result["dropped_chunk_ids"], ["made-up-id"])
        # The prompt carries the retrieved chunk text.
        self.assertIn(f"[id: {cited}]", client.messages[1]["content"])

    def test_parse_answer_rejects_wrong_shape(self):
        with self.assertRaises(ValueError):
            parse_answer(json.dumps({"answer": "free text"}), set())


if __name__ == "__main__":
    unittest.main()
