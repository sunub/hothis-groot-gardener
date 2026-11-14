"""Evaluate top-5 retrieval with Recall@5, MRR@5, and nDCG@5."""

import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import sys

from retriver import Retriever, TOP_N


METRICS = ("Recall@5", "MRR@5", "nDCG@5")


def load_dataset(path: Path) -> list[dict]:
    if not path.is_file():
        raise ValueError(f"Evaluation dataset does not exist: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list) or not data:
        raise ValueError("Evaluation dataset must be a nonempty JSON array")
    for index, item in enumerate(data, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Item {index} must be an object")
        if not isinstance(item.get("query"), str) or not item["query"].strip():
            raise ValueError(f"Item {index} needs a nonempty query")
        relevant = item.get("relevant_ids")
        if not isinstance(relevant, list) or not relevant or any(
            not isinstance(chunk_id, str) or not chunk_id for chunk_id in relevant
        ):
            raise ValueError(f"Item {index} needs a nonempty relevant_ids string list")
        if len(relevant) != len(set(relevant)):
            raise ValueError(f"Item {index} has duplicate relevant IDs")
    return data


def metrics_at_5(retrieved_ids: list[str], relevant_ids: list[str]) -> dict[str, float]:
    relevant = set(relevant_ids)
    hits = [chunk_id in relevant for chunk_id in retrieved_ids[:TOP_N]]
    recall = sum(hits) / len(relevant)
    first_hit = next((rank for rank, hit in enumerate(hits, start=1) if hit), None)
    mrr = 1 / first_hit if first_hit is not None else 0.0
    dcg = sum(1 / math.log2(rank + 1) for rank, hit in enumerate(hits, start=1) if hit)
    ideal = sum(1 / math.log2(rank + 1) for rank in range(1, min(len(relevant), TOP_N) + 1))
    return {"Recall@5": recall, "MRR@5": mrr, "nDCG@5": dcg / ideal}


def evaluate(retriever, dataset: list[dict]) -> dict:
    known_ids = set(retriever.chunks)
    details = []
    for index, item in enumerate(dataset, start=1):
        missing = set(item["relevant_ids"]) - known_ids
        if missing:
            raise ValueError(f"Item {index} references IDs absent from Chroma: {sorted(missing)}")
        ids = [chunk["id"] for chunk in retriever.retrieve(item["query"])]
        details.append({
            "case": index,
            "query": item["query"],
            "relevant_ids": item["relevant_ids"],
            "retrieved_ids": ids,
            **metrics_at_5(ids, item["relevant_ids"]),
        })
    summary = summarize(details)
    return {"queries": len(details), "summary": summary, "details": details}


def summarize(details: list[dict]) -> dict[str, float]:
    return {
        metric: sum(item[metric] for item in details) / len(details)
        for metric in METRICS
    }


def evaluate_files(retriever, paths: list[Path]) -> dict:
    datasets = []
    all_details = []
    for path in paths:
        result = evaluate(retriever, load_dataset(path))
        datasets.append({"dataset": str(path), **result})
        all_details.extend(result["details"])
    return {
        "datasets": datasets,
        "overall": {"queries": len(all_details), "summary": summarize(all_details)},
    }


def save_report(report: dict, output_dir: Path, mode: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    path = output_dir / f"{mode}_{timestamp}.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, nargs="+", required=True)
    parser.add_argument("--db-path", type=Path, default=Path("vector_db"))
    parser.add_argument("--collection", default="plant_research")
    parser.add_argument("--config", type=Path, default=Path("retriver.yaml"))
    parser.add_argument("--rerank", action="store_true", help="evaluate reranked top-5 results")
    parser.add_argument("--rerank-candidates", type=int, default=20)
    parser.add_argument("--rerank-batch-size", type=int, default=2)
    parser.add_argument("--rerank-device", help="optional PyTorch device, e.g. cuda or cpu")
    parser.add_argument("--output-dir", type=Path, default=Path("result"))
    args = parser.parse_args()
    try:
        retriever = Retriever(args.db_path, args.collection, args.config)
        parameters = {
            "alpha": retriever.config["alpha"],
            "k": retriever.config["k"],
            "candidate_count": retriever.config["candidate_count"],
        }
        mode = "weighted_rrf"
        if args.rerank:
            from reranker import RERANK_MODEL, Reranker

            retriever = Reranker(
                retriever, args.rerank_candidates, args.rerank_batch_size,
                args.rerank_device,
            )
            mode = "rerank"
            parameters.update({
                "reranker_model": RERANK_MODEL,
                "rerank_candidates": args.rerank_candidates,
                "rerank_batch_size": args.rerank_batch_size,
            })
        report = {
            "mode": mode,
            "parameters": parameters,
            **evaluate_files(retriever, args.dataset),
        }
        path = save_report(report, args.output_dir, mode)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        print(f"Saved report: {path}", file=sys.stderr)
    except (ValueError, OSError) as exc:
        parser.exit(1, f"Error: {exc}\n")


if __name__ == "__main__":
    main()
