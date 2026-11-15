"""Evaluate top-N retrieval (default 5) with Recall, MRR, nDCG, Precision and off-stage excerpts."""

import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import sys

from paths import CONFIG_DEFAULT, VECTOR_DB_PATH
from retriver import Retriever, TOP_N

# Dataset items need "query" and "relevant_ids" (the key chunks, grade 2).
# Optional fields; without them the numbers are the same as before:
#   "partial_ids":   supporting chunks (grade 1). They count for Precision and
#                    graded nDCG, not for Recall or MRR.
#   "off_stage_ids": chunks about symptoms the situation does not have yet.
#                    OffStage counts how many reach the top N, where they could
#                    lead the model to write a symptom the stage does not have.
#   "label":         a short name copied into the details.
OPTIONAL_ID_FIELDS = ("partial_ids", "off_stage_ids")
MAX_TOP_N = 10  # same limit as rag_server.py


def metric_names(top_n: int) -> tuple[str, ...]:
    return tuple(f"{name}@{top_n}" for name in ("Recall", "MRR", "nDCG", "Precision", "OffStage"))


def _check_id_list(value, index: int, field: str, required: bool) -> None:
    if value is None and not required:
        return
    if not isinstance(value, list) or (required and not value) or any(
        not isinstance(chunk_id, str) or not chunk_id for chunk_id in value
    ):
        need = "a nonempty" if required else "a"
        raise ValueError(f"Item {index} needs {need} {field} string list")
    if len(value) != len(set(value)):
        raise ValueError(f"Item {index} has duplicate IDs in {field}")


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
        _check_id_list(item.get("relevant_ids"), index, "relevant_ids", required=True)
        for field in OPTIONAL_ID_FIELDS:
            _check_id_list(item.get(field), index, field, required=False)
        relevant = set(item["relevant_ids"])
        partial = set(item.get("partial_ids") or [])
        off_stage = set(item.get("off_stage_ids") or [])
        if relevant & partial:
            raise ValueError(f"Item {index} lists IDs as both relevant and partial: {sorted(relevant & partial)}")
        if off_stage & (relevant | partial):
            raise ValueError(f"Item {index} lists IDs as both useful and off-stage: {sorted(off_stage & (relevant | partial))}")
    return data


def metrics_at_n(
    retrieved_ids: list[str],
    relevant_ids: list[str],
    top_n: int = TOP_N,
    partial_ids: list[str] | None = None,
    off_stage_ids: list[str] | None = None,
) -> dict[str, float]:
    relevant = set(relevant_ids)
    partial = set(partial_ids or []) - relevant
    off_stage = set(off_stage_ids or [])
    top = retrieved_ids[:top_n]
    hits = [chunk_id in relevant for chunk_id in top]
    recall = sum(hits) / len(relevant)
    first_hit = next((rank for rank, hit in enumerate(hits, start=1) if hit), None)
    mrr = 1 / first_hit if first_hit is not None else 0.0
    # Graded gain 2^grade - 1: relevant 3, partial 1. With relevant IDs only,
    # every gain is 3 and nDCG equals the earlier binary nDCG.
    gains = [3 if chunk_id in relevant else 1 if chunk_id in partial else 0 for chunk_id in top]
    dcg = sum(gain / math.log2(rank + 1) for rank, gain in enumerate(gains, start=1))
    ideal_gains = ([3] * len(relevant) + [1] * len(partial))[:top_n]
    ideal = sum(gain / math.log2(rank + 1) for rank, gain in enumerate(ideal_gains, start=1))
    names = metric_names(top_n)
    return {
        names[0]: recall,
        names[1]: mrr,
        names[2]: dcg / ideal,
        names[3]: sum(1 for gain in gains if gain) / top_n,
        names[4]: sum(1 for chunk_id in top if chunk_id in off_stage),
    }


def metrics_at_5(retrieved_ids: list[str], relevant_ids: list[str]) -> dict[str, float]:
    """Earlier interface: Recall@5, MRR@5 and nDCG@5 with relevant IDs only."""
    scores = metrics_at_n(retrieved_ids, relevant_ids, TOP_N)
    return {name: scores[name] for name in metric_names(TOP_N)[:3]}


def retrieve_ids(retriever, query: str, top_n: int) -> list[str]:
    if hasattr(retriever, "candidate_count"):  # Reranker returns its own top 5
        return [chunk["id"] for chunk in retriever.retrieve(query)][:top_n]
    return [chunk["id"] for chunk in retriever.retrieve(query, top_n=top_n)]


def evaluate(retriever, dataset: list[dict], top_n: int = TOP_N) -> dict:
    known_ids = set(retriever.chunks)
    details = []
    for index, item in enumerate(dataset, start=1):
        listed = set(item["relevant_ids"])
        for field in OPTIONAL_ID_FIELDS:
            listed |= set(item.get(field) or [])
        missing = listed - known_ids
        if missing:
            raise ValueError(f"Item {index} references IDs absent from Chroma: {sorted(missing)}")
        ids = retrieve_ids(retriever, item["query"], top_n)
        detail = {"case": index}
        if item.get("label"):
            detail["label"] = item["label"]
        detail.update({"query": item["query"], "relevant_ids": item["relevant_ids"]})
        for field in OPTIONAL_ID_FIELDS:
            if item.get(field):
                detail[field] = item[field]
        detail["retrieved_ids"] = ids
        detail.update(metrics_at_n(
            ids, item["relevant_ids"], top_n, item.get("partial_ids"), item.get("off_stage_ids"),
        ))
        details.append(detail)
    return {"queries": len(details), "summary": summarize(details, top_n), "details": details}


def summarize(details: list[dict], top_n: int = TOP_N) -> dict[str, float]:
    summary = {
        metric: sum(item[metric] for item in details) / len(details)
        for metric in metric_names(top_n)
    }
    off_stage = metric_names(top_n)[4]
    summary[f"{off_stage} total"] = sum(item[off_stage] for item in details)
    return summary


def evaluate_files(retriever, paths: list[Path], top_n: int = TOP_N) -> dict:
    datasets = []
    all_details = []
    for path in paths:
        result = evaluate(retriever, load_dataset(path), top_n)
        datasets.append({"dataset": str(path), **result})
        all_details.extend(result["details"])
    return {
        "datasets": datasets,
        "overall": {"queries": len(all_details), "summary": summarize(all_details, top_n)},
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
    parser.add_argument("--db-path", type=Path, default=VECTOR_DB_PATH)
    parser.add_argument("--collection", default="plant_research")
    parser.add_argument("--config", type=Path, default=CONFIG_DEFAULT)
    parser.add_argument(
        "--top-n", type=int, default=TOP_N,
        help=f"chunks scored per query (default {TOP_N}; the game puts 4 in the prompt)",
    )
    parser.add_argument("--rerank", action="store_true", help="evaluate reranked results")
    parser.add_argument("--rerank-candidates", type=int, default=20)
    parser.add_argument("--rerank-batch-size", type=int, default=2)
    parser.add_argument("--rerank-device", help="optional PyTorch device, e.g. cuda or cpu")
    parser.add_argument("--output-dir", type=Path, default=Path("result"))
    args = parser.parse_args()
    limit = TOP_N if args.rerank else MAX_TOP_N
    if not 1 <= args.top_n <= limit:
        parser.error(f"--top-n must be between 1 and {limit}" + (" with --rerank" if args.rerank else ""))
    try:
        retriever = Retriever(args.db_path, args.collection, args.config)
        parameters = {
            "config": args.config.name,
            "alpha": retriever.config["alpha"],
            "k": retriever.config["k"],
            "candidate_count": retriever.config["candidate_count"],
            "top_n": args.top_n,
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
            **evaluate_files(retriever, args.dataset, args.top_n),
        }
        path = save_report(report, args.output_dir, mode)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        print(f"Saved report: {path}", file=sys.stderr)
    except (ValueError, OSError) as exc:
        parser.exit(1, f"Error: {exc}\n")


if __name__ == "__main__":
    main()
