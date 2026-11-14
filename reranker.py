"""Rerank Weighted RRF candidates and return five evidence chunks."""

import argparse
import json
import math
from pathlib import Path

from retriver import Retriever, TOP_N


RERANK_MODEL = "mixedbread-ai/mxbai-rerank-large-v2"


class Reranker:
    def __init__(
        self,
        retriever: Retriever,
        candidate_count: int = 20,
        batch_size: int = 2,
        device: str | None = None,
        model=None,
    ):
        if isinstance(candidate_count, bool) or not isinstance(candidate_count, int) or candidate_count < TOP_N:
            raise ValueError(f"candidate_count must be an integer >= {TOP_N}")
        if isinstance(batch_size, bool) or not isinstance(batch_size, int) or batch_size < 1:
            raise ValueError("batch_size must be a positive integer")
        self.retriever = retriever
        self.chunks = retriever.chunks  # evaluation.py uses this to validate relevant IDs.
        self.candidate_count = candidate_count
        self.batch_size = batch_size
        if model is None:
            try:
                from sentence_transformers import CrossEncoder
            except ImportError as exc:
                raise ValueError(
                    "Reranker dependencies are missing. Run: uv sync --group rerank"
                ) from exc
            self.model = CrossEncoder(RERANK_MODEL, device=device)
        else:
            self.model = model

    def retrieve(self, query: str) -> list[dict]:
        candidates = self.retriever.retrieve(query, top_n=self.candidate_count)
        if not candidates:
            return []
        pairs = [
            (query, self.retriever.korean_texts.get(chunk["id"]) or chunk["text"])
            for chunk in candidates
        ]
        scores = self.model.predict(
            pairs, batch_size=self.batch_size, show_progress_bar=False
        )
        if len(scores) != len(candidates):
            raise ValueError("Reranker returned an incomplete score list")
        scores = [float(score) for score in scores]
        if not all(math.isfinite(score) for score in scores):
            raise ValueError("Reranker returned a nonfinite score")
        order = sorted(range(len(candidates)), key=lambda index: (-scores[index], index))[:TOP_N]
        return [
            {
                **candidates[index],
                "rank": rank,
                "rrf_rank": candidates[index]["rank"],
                "rerank_score": scores[index],
            }
            for rank, index in enumerate(order, start=1)
        ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("query", help="simulator state and request for next actions")
    parser.add_argument("--db-path", type=Path, default=Path("vector_db"))
    parser.add_argument("--collection", default="plant_research")
    parser.add_argument("--config", type=Path, default=Path("retriver.yaml"))
    parser.add_argument("--candidates", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--device", help="optional PyTorch device, e.g. cuda or cpu")
    args = parser.parse_args()
    try:
        retriever = Retriever(args.db_path, args.collection, args.config)
        reranker = Reranker(
            retriever, args.candidates, args.batch_size, args.device
        )
        print(json.dumps(reranker.retrieve(args.query), ensure_ascii=False, indent=2))
    except (ValueError, OSError) as exc:
        parser.exit(1, f"Error: {exc}\n")


if __name__ == "__main__":
    main()
