import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os

load_dotenv(".env.local")

from recommender.tmdb_client import TMDBClient
from recommender.embedder import Embedder
from recommender.vector_store import VectorStore
from recommender.reranker import Reranker
from recommender.llm_engine import LLMEngine
from db import init_db, insert_user_events, insert_pipeline_event

tmdb: TMDBClient
embedder: Embedder
vector_store: VectorStore
reranker: Reranker
llm_engine: LLMEngine


@asynccontextmanager
async def lifespan(app: FastAPI):
    global tmdb, embedder, vector_store, reranker, llm_engine
    print("Initialising database...")
    await init_db()
    print("Loading services...")
    tmdb = TMDBClient(api_key=os.environ["TMDB_API_KEY"], region=os.getenv("TMDB_REGION", "US"))
    embedder = Embedder()
    vector_store = VectorStore(persist_dir=os.getenv("CHROMA_DB_PATH", "./chroma_db"))
    reranker = Reranker()
    llm_engine = LLMEngine(api_key=os.environ["GROQ_API_KEY"])
    print("All services ready.")
    yield


app = FastAPI(title="Movie Recommender API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    liked: list[str]
    disliked: list[str] = []
    num_results: int = 5
    session_id: str | None = None


class LogEventsRequest(BaseModel):
    events: list[dict]


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model": "llama-3.3-70b-versatile"}


@app.get("/search-movies")
async def search_movies(q: str = Query(..., min_length=2)):
    if not q.strip():
        return []
    results = await tmdb.search_movie(q)
    return results


@app.post("/log-events", status_code=204)
async def log_events(req: LogEventsRequest, background_tasks: BackgroundTasks):
    """Receive a batch of frontend interaction events and persist them."""
    background_tasks.add_task(insert_user_events, req.events)


@app.post("/recommend")
async def recommend(req: RecommendRequest, background_tasks: BackgroundTasks):
    if not req.liked:
        raise HTTPException(status_code=400, detail="Provide at least one liked movie.")

    t_total = time.monotonic()
    session_id = req.session_id

    query_text = (
        f"Movies similar to: {', '.join(req.liked)}. "
        f"Avoiding themes from: {', '.join(req.disliked)}."
        if req.disliked
        else f"Movies similar to: {', '.join(req.liked)}."
    )

    # Stage 1 — embed query
    t0 = time.monotonic()
    embedding = embedder.encode_query(query_text)
    embed_ms = int((time.monotonic() - t0) * 1000)

    # Stage 2 — vector search
    t0 = time.monotonic()
    n_candidates = req.num_results * 2
    candidates = vector_store.query(embedding, n_results=n_candidates)
    vector_ms = int((time.monotonic() - t0) * 1000)

    mentioned = {t.lower() for t in req.liked + req.disliked}
    candidates = [c for c in candidates if c["title"].lower() not in mentioned]

    # Stage 3 — quality re-rank
    t0 = time.monotonic()
    candidates = reranker.rerank(candidates)
    rerank_ms = int((time.monotonic() - t0) * 1000)

    # Stage 4 — TMDB enrichment
    t0 = time.monotonic()
    tmdb_enriched = []
    for c in candidates:
        details = await tmdb.get_movie_details_by_title(c["title"], c.get("year"))
        tmdb_enriched.append({**c, **details})
    tmdb_ms = int((time.monotonic() - t0) * 1000)

    # Stage 5 — LLM ranking + CoT explanations
    t0 = time.monotonic()
    top_candidates = tmdb_enriched[: req.num_results * 2]
    ranked = await llm_engine.rank_and_explain(
        liked=req.liked,
        disliked=req.disliked,
        candidates=top_candidates,
        num_results=req.num_results,
    )
    llm_ms = int((time.monotonic() - t0) * 1000)

    # Merge TMDB metadata into final results
    for rec in ranked:
        match = next((c for c in tmdb_enriched if c["title"].lower() == rec["title"].lower()), {})
        rec["poster_url"] = match.get("poster_url")
        rec["backdrop_url"] = match.get("backdrop_url")
        rec["streaming"] = match.get("streaming", [])
        rec["year"] = match.get("year", rec.get("year"))
        rec["genre"] = match.get("genre", rec.get("genre", ""))
        rec["imdb_rating"] = match.get("imdb_rating", rec.get("imdb_rating"))

    total_ms = int((time.monotonic() - t_total) * 1000)

    # Log pipeline event in background (non-blocking)
    background_tasks.add_task(
        insert_pipeline_event,
        event_type="recommend_pipeline",
        event_data={
            "liked": req.liked,
            "disliked": req.disliked,
            "num_results": req.num_results,
            "num_candidates_retrieved": len(candidates),
            "num_final_results": len(ranked),
            "results": [r["title"] for r in ranked],
            "timings": {
                "embed_ms": embed_ms,
                "vector_search_ms": vector_ms,
                "rerank_ms": rerank_ms,
                "tmdb_enrich_ms": tmdb_ms,
                "llm_ms": llm_ms,
                "total_ms": total_ms,
            },
        },
        duration_ms=total_ms,
        session_id=session_id,
    )

    return {"recommendations": ranked}
