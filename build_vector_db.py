"""Build a persistent Chroma collection from one pre-chunked RAG JSON file."""

import argparse
import hashlib
import json
import os
from pathlib import Path


MODEL = "text-embedding-3-small"
HASH_KEY = "rag_content_sha256"
FILE_KEY = "rag_source_file"


def batches(items, size):
    for start in range(0, len(items), size):
        yield items[start : start + size]


def load_chunks(path: Path):
    if not path.is_file():
        raise ValueError(f"Input JSON file does not exist: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path}: expected a JSON array")
    chunks = []
    seen_ids = set()
    for position, item in enumerate(data, start=1):
        location = f"{path}, item {position}"
        if not isinstance(item, dict):
            raise ValueError(f"{location}: expected an object")
        chunk_id, content, raw_metadata = (
            item.get("id"), item.get("text"), item.get("metadata")
        )
        if not isinstance(chunk_id, str) or not chunk_id.strip():
            raise ValueError(f"{location}: id must be a nonempty string")
        if chunk_id in seen_ids:
            raise ValueError(f"{location}: duplicate id {chunk_id!r}")
        if not isinstance(content, str) or not content.strip():
            raise ValueError(f"{location}: text must be a nonempty string")
        if not isinstance(raw_metadata, dict):
            raise ValueError(f"{location}: metadata must be an object")
        if HASH_KEY in raw_metadata or FILE_KEY in raw_metadata:
            raise ValueError(f"{location}: metadata uses a reserved key")

        metadata = {}
        for key, value in raw_metadata.items():
            if not isinstance(key, str):
                raise ValueError(f"{location}: metadata keys must be strings")
            if value is None:
                continue  # Chroma does not accept null metadata values.
            if isinstance(value, (str, int, float, bool)):
                metadata[key] = value
            else:
                metadata[key] = json.dumps(value, ensure_ascii=False, sort_keys=True)

        payload = json.dumps(
            {"text": content, "metadata": raw_metadata},
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        metadata[HASH_KEY] = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        metadata[FILE_KEY] = path.name
        chunks.append((chunk_id, content, metadata))
        seen_ids.add(chunk_id)
    return chunks


def build(args):
    input_path = args.input.resolve()
    chunks = load_chunks(input_path)
    print(f"Found {len(chunks)} chunks in {input_path}.")
    if args.dry_run:
        print("Validation complete; no embeddings or database writes were made.")
        return

    from dotenv import load_dotenv

    load_dotenv()
    api_key = os.getenv("API_KEY")
    if not api_key:
        raise ValueError("API_KEY is missing. Add API_KEY=... to .env")

    import chromadb
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    database = chromadb.PersistentClient(path=str(args.db_path))
    collection = database.get_or_create_collection(
        name=args.collection,
        metadata={"embedding_model": MODEL},
    )
    if (collection.metadata or {}).get("embedding_model") != MODEL:
        raise ValueError(
            f"Collection {args.collection!r} uses a different or unknown embedding model"
        )

    updated = 0
    skipped = 0
    for group in batches(chunks, args.batch_size):
        existing = collection.get(ids=[item[0] for item in group], include=["metadatas"])
        saved_hashes = {
            chunk_id: (metadata or {}).get(HASH_KEY)
            for chunk_id, metadata in zip(existing["ids"], existing["metadatas"])
        }
        pending = [
            item for item in group if saved_hashes.get(item[0]) != item[2][HASH_KEY]
        ]
        skipped += len(group) - len(pending)
        if not pending:
            continue

        response = client.embeddings.create(
            model=MODEL,
            input=[item[1] for item in pending],
            encoding_format="float",
        )
        vectors = {entry.index: entry.embedding for entry in response.data}
        if set(vectors) != set(range(len(pending))):
            raise ValueError("OpenAI returned an incomplete embedding batch")
        collection.upsert(
            ids=[item[0] for item in pending],
            documents=[item[1] for item in pending],
            metadatas=[item[2] for item in pending],
            embeddings=[vectors[index] for index in range(len(pending))],
        )
        updated += len(pending)
        print(f"Stored {updated} new or changed chunks...", flush=True)

    input_ids = {item[0] for item in chunks}
    stored_ids = set()
    for offset in range(0, collection.count(), 1000):
        stored_ids.update(collection.get(limit=1000, offset=offset, include=[])["ids"])
    stale_ids = sorted(stored_ids - input_ids)
    for group in batches(stale_ids, args.batch_size):
        collection.delete(ids=group)

    print(
        f"Done: {updated} stored, {skipped} unchanged, {len(stale_ids)} removed; "
        f"{collection.count()} total in collection."
    )
    print(f"Database: {args.db_path.resolve()} / {args.collection}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path("data/json/total_RAG.json"))
    parser.add_argument("--db-path", type=Path, default=Path("vector_db"))
    parser.add_argument("--collection", default="plant_research")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--dry-run", action="store_true", help="validate JSON without API calls")
    args = parser.parse_args()
    if args.batch_size < 1:
        parser.error("--batch-size must be at least 1")
    try:
        build(args)
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        parser.exit(1, f"Error: {exc}\n")


if __name__ == "__main__":
    main()
