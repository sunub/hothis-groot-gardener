"""Retrieve five evidence chunks for a simulator state and action request."""

import argparse
from collections import Counter
import json
import math
import os
from pathlib import Path
import re

import chromadb
from dotenv import load_dotenv
from openai import OpenAI
import yaml


TOP_N = 5
MODEL = "text-embedding-3-small"
TOKEN_PATTERN = re.compile(r"[^\W_]+", re.UNICODE)
HANGUL_PATTERN = re.compile(r"[가-힣]+")


def tokenize(text: str) -> list[str]:
    tokens = TOKEN_PATTERN.findall(text.casefold())
    # Character bigrams help Korean inflected words share lexical evidence.
    for word in HANGUL_PATTERN.findall(text):
        tokens.extend(f"ko:{word[index:index + 2]}" for index in range(len(word) - 1))
    return tokens


def load_korean_texts(directory: Path) -> dict[str, str]:
    if not directory.is_dir():
        # The Korean translations only help Korean queries. Without them the
        # retriever still searches the English chunks.
        print(f"Note: Korean BM25 directory not found, using English text only: {directory}")
        return {}
    texts = {}
    for path in sorted(directory.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise ValueError(f"{path}: expected a JSON array")
        for item in data:
            chunk_id = item["id"]
            if chunk_id in texts:
                raise ValueError(f"Duplicate Korean chunk ID: {chunk_id}")
            metadata = item.get("metadata", {})
            texts[chunk_id] = "\n".join(
                str(metadata[key]) for key in ("subsection_ko", "translation_ko")
                if metadata.get(key)
            )
    return texts


def load_config(path: Path) -> dict:
    if not path.is_file():
        raise ValueError(f"Config file does not exist: {path}")
    config = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(config, dict):
        raise ValueError(f"{path}: expected a YAML mapping")
    alpha = config.get("alpha")
    k = config.get("k")
    candidate_count = config.get("candidate_count", 20)
    bm25_ko_dir = config.get("bm25_ko_dir", "data/json_ko")
    if isinstance(alpha, bool) or not isinstance(alpha, (int, float)) or not 0 <= alpha <= 1:
        raise ValueError("alpha must be a number between 0 and 1")
    if isinstance(k, bool) or not isinstance(k, (int, float)) or not math.isfinite(k) or k <= 0:
        raise ValueError("k must be a positive number")
    if isinstance(candidate_count, bool) or not isinstance(candidate_count, int) or candidate_count < TOP_N:
        raise ValueError(f"candidate_count must be an integer >= {TOP_N}")
    if not isinstance(bm25_ko_dir, str) or not bm25_ko_dir:
        raise ValueError("bm25_ko_dir must be a directory path")
    return {
        "alpha": float(alpha), "k": float(k), "candidate_count": candidate_count,
        "bm25_ko_dir": Path(bm25_ko_dir),
    }


class BM25:
    """Small in-memory BM25 index over Chroma text and paired Korean text."""

    def __init__(self, documents: dict[str, str], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.term_counts = {chunk_id: Counter(tokenize(text)) for chunk_id, text in documents.items()}
        self.lengths = {chunk_id: sum(counts.values()) for chunk_id, counts in self.term_counts.items()}
        self.avg_length = sum(self.lengths.values()) / len(self.lengths)
        self.document_frequency = Counter()
        for counts in self.term_counts.values():
            self.document_frequency.update(counts.keys())

    def search(self, query: str, limit: int) -> list[str]:
        scores = Counter()
        count = len(self.term_counts)
        for term in set(tokenize(query)):
            frequency = self.document_frequency.get(term, 0)
            if not frequency:
                continue
            idf = math.log(1 + (count - frequency + 0.5) / (frequency + 0.5))
            for chunk_id, terms in self.term_counts.items():
                tf = terms.get(term, 0)
                if tf:
                    norm = self.k1 * (1 - self.b + self.b * self.lengths[chunk_id] / self.avg_length)
                    scores[chunk_id] += idf * tf * (self.k1 + 1) / (tf + norm)
        return sorted(scores, key=lambda chunk_id: (-scores[chunk_id], chunk_id))[:limit]


class Retriever:
    def __init__(
        self,
        db_path: Path = Path("vector_db"),
        collection_name: str = "plant_research",
        config_path: Path = Path("retriver.yaml"),
        openai_client=None,
    ):
        self.config = load_config(config_path)
        if not (db_path / "chroma.sqlite3").is_file():
            raise ValueError(f"Chroma DB not found: {db_path / 'chroma.sqlite3'}")
        self.collection = chromadb.PersistentClient(path=str(db_path)).get_collection(collection_name)
        if (self.collection.metadata or {}).get("embedding_model") != MODEL:
            raise ValueError(f"Collection {collection_name!r} was not built with {MODEL}")

        self.chunks = {}
        for offset in range(0, self.collection.count(), 1000):
            page = self.collection.get(limit=1000, offset=offset, include=["documents", "metadatas"])
            for chunk_id, document, metadata in zip(page["ids"], page["documents"], page["metadatas"]):
                self.chunks[chunk_id] = {"text": document, "metadata": metadata or {}}
        if not self.chunks:
            raise ValueError(f"Collection {collection_name!r} is empty")
        self.korean_texts = load_korean_texts(self.config["bm25_ko_dir"])
        self.bm25 = BM25({
            chunk_id: "\n".join((
                item["text"], self.korean_texts.get(chunk_id, ""),
                str(item["metadata"].get("simulator_application_ko", "")),
            ))
            for chunk_id, item in self.chunks.items()
        })

        self.openai_client = openai_client
        if self.config["alpha"] > 0 and self.openai_client is None:
            load_dotenv()
            api_key = os.getenv("API_KEY")
            if not api_key:
                raise ValueError("API_KEY is missing. Add API_KEY=... to .env")
            self.openai_client = OpenAI(api_key=api_key)

    def retrieve(self, query: str, top_n: int = TOP_N) -> list[dict]:
        if not isinstance(query, str) or not query.strip():
            raise ValueError("query must be a nonempty string")
        if isinstance(top_n, bool) or not isinstance(top_n, int) or top_n < 1:
            raise ValueError("top_n must be a positive integer")
        alpha = self.config["alpha"]
        k = self.config["k"]
        limit = min(self.config["candidate_count"], len(self.chunks))
        bm25_ids = self.bm25.search(query, limit) if alpha < 1 else []
        dense_ids = []
        if alpha > 0:
            response = self.openai_client.embeddings.create(
                model=MODEL, input=query, encoding_format="float"
            )
            vector = response.data[0].embedding
            result = self.collection.query(query_embeddings=[vector], n_results=limit, include=[])
            dense_ids = result["ids"][0]

        scores = Counter()
        for rank, chunk_id in enumerate(bm25_ids, start=1):
            scores[chunk_id] += (1 - alpha) / (k + rank)
        for rank, chunk_id in enumerate(dense_ids, start=1):
            scores[chunk_id] += alpha / (k + rank)
        bm25_ranks = {chunk_id: rank for rank, chunk_id in enumerate(bm25_ids, start=1)}
        dense_ranks = {chunk_id: rank for rank, chunk_id in enumerate(dense_ids, start=1)}
        ranked = sorted(scores, key=lambda chunk_id: (-scores[chunk_id], chunk_id))[:top_n]
        if len(ranked) < top_n:
            ranked.extend(chunk_id for chunk_id in sorted(self.chunks) if chunk_id not in scores)
            ranked = ranked[:top_n]
        return [
            {
                "rank": rank,
                "id": chunk_id,
                "text": self.chunks[chunk_id]["text"],
                "metadata": {
                    key: value for key, value in self.chunks[chunk_id]["metadata"].items()
                    if key not in {"rag_content_sha256", "rag_source_file"}
                },
                "rrf_score": scores[chunk_id],
                "bm25_rank": bm25_ranks.get(chunk_id),
                "dense_rank": dense_ranks.get(chunk_id),
            }
            for rank, chunk_id in enumerate(ranked, start=1)
        ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("query", help="simulator state and request for next actions")
    parser.add_argument("--db-path", type=Path, default=Path("vector_db"))
    parser.add_argument("--collection", default="plant_research")
    parser.add_argument("--config", type=Path, default=Path("retriver.yaml"))
    args = parser.parse_args()
    try:
        retriever = Retriever(args.db_path, args.collection, args.config)
        print(json.dumps(retriever.retrieve(args.query), ensure_ascii=False, indent=2))
    except (ValueError, OSError, yaml.YAMLError) as exc:
        parser.exit(1, f"Error: {exc}\n")


if __name__ == "__main__":
    main()
