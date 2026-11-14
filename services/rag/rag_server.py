"""HTTP wrapper around the retriever, so the game app can ask for evidence chunks.

Run from the project root:

    uv run --group server uvicorn rag_server:app --host 127.0.0.1 --port 8000
    # or: python -m uvicorn rag_server:app --host 127.0.0.1 --port 8000

Settings (environment variables, all optional):

    RAG_CONFIG      retriever config file        (default: services/rag/retriver.local.yaml)
    RAG_DB_PATH     Chroma directory             (default: data/vector_db)
    RAG_COLLECTION  Chroma collection name       (default: plant_research)
    RAG_RERANK      "1" to rerank with the cross-encoder (default: off)
    RAG_DEVICE      device for the reranker, e.g. cuda or cpu

The default config (retriver.local.yaml) uses keyword search only (alpha 0),
so no OpenAI API key is needed. Set RAG_CONFIG=retriver.yaml to use the
team's hybrid search, which needs API_KEY in .env for query embeddings.
"""

from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from paths import CONFIG_LOCAL, VECTOR_DB_PATH
from retriver import Retriever

MAX_TOP_N = 10


class RetrieveRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    top_n: int = Field(default=5, ge=1, le=MAX_TOP_N)


class Chunk(BaseModel):
    rank: int
    id: str
    section: str
    subsection: str
    text: str
    source_url: str
    source_location: str
    source_license: str | None


class RetrieveResponse(BaseModel):
    query: str
    mode: str
    results: list[Chunk]


state: dict = {}


def build_searcher():
    config = Path(os.getenv("RAG_CONFIG", str(CONFIG_LOCAL)))
    retriever = Retriever(
        db_path=Path(os.getenv("RAG_DB_PATH", str(VECTOR_DB_PATH))),
        collection_name=os.getenv("RAG_COLLECTION", "plant_research"),
        config_path=config,
    )
    alpha = retriever.config["alpha"]
    mode = "keyword" if alpha == 0 else "dense" if alpha == 1 else "hybrid"
    if os.getenv("RAG_RERANK") == "1":
        from reranker import Reranker

        # Queries from the app are English, so rerank against the English text.
        searcher = Reranker(
            retriever, device=os.getenv("RAG_DEVICE") or None, prefer_korean=False
        )
        return searcher, f"{mode}+rerank", retriever
    return retriever, mode, retriever


@asynccontextmanager
async def lifespan(_: FastAPI):
    searcher, mode, retriever = build_searcher()
    state.update(searcher=searcher, mode=mode, chunks=len(retriever.chunks))
    yield
    state.clear()


app = FastAPI(title="Groot Gardener evidence search", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "mode": state["mode"], "chunks": state["chunks"]}


@app.post("/retrieve", response_model=RetrieveResponse)
def retrieve(request: RetrieveRequest) -> RetrieveResponse:
    searcher = state["searcher"]
    try:
        if hasattr(searcher, "candidate_count"):  # Reranker always returns TOP_N
            found = searcher.retrieve(request.query)[: request.top_n]
        else:
            found = searcher.retrieve(request.query, top_n=request.top_n)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    results = []
    for rank, chunk in enumerate(found, start=1):
        meta = chunk["metadata"]
        results.append(Chunk(
            rank=rank,
            id=chunk["id"],
            section=str(meta.get("section", "")),
            subsection=str(meta.get("subsection", "")),
            text=chunk["text"],
            source_url=str(meta.get("source_url", "")),
            source_location=str(meta.get("source_location", "")),
            source_license=meta.get("source_license"),
        ))
    return RetrieveResponse(query=request.query, mode=state["mode"], results=results)
