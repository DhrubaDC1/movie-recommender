import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, FastAPI, HTTPException, Query
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
from db import (
    init_db,
    insert_user_events,
    insert_pipeline_event,
    get_user_feedback_history,
    upsert_movie_feedback,
)
from auth import get_current_user, get_optional_user, router as auth_router

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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


# ── Models ─────────────────────────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    liked: list[str]
    disliked: list[str] = []
    num_results: int = 5
    session_id: Optional[str] = None


class LogEventsRequest(BaseModel):
    events: list[dict]


class FeedbackRequest(BaseModel):
    movie_title: str
    opinion: str          # 'liked' | 'disliked'
    session_id: Optional[str] = None
    source: str = "post_recommendation"


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model": "llama-3.3-70b-versatile"}


@app.get("/search-movies")
async def search_movies(q: str = Query(..., min_length=2)):
    if not q.strip():
        return []
    return await tmdb.search_movie(q)


@app.post("/log-events", status_code=204)
async def log_events(req: LogEventsRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(insert_user_events, req.events)


@app.post("/user/feedback", status_code=204)
async def submit_feedback(
    req: FeedbackRequest,
    user: dict = Depends(get_current_user),
):
    if req.opinion not in ("liked", "disliked"):
        raise HTTPException(status_code=400, detail="opinion must be 'liked' or 'disliked'")
    await upsert_movie_feedback(
        user_id=user["id"],
        movie_title=req.movie_title,
        opinion=req.opinion,
        session_id=req.session_id,
        source=req.source,
    )


@app.get("/user/history")
async def user_history(user: dict = Depends(get_current_user)):
    return await get_user_feedback_history(user["id"])


@app.post("/recommend")
async def recommend(
    req: RecommendRequest,
    background_tasks: BackgroundTasks,
    user: Optional[dict] = Depends(get_optional_user),
):
    if not req.liked:
        raise HTTPException(status_code=400, detail="Provide at least one liked movie.")

    t_total = time.monotonic()
    session_id = req.session_id

    # Merge in the authenticated user's taste history
    extra_liked: list[str] = []
    extra_disliked: list[str] = []
    if user:
        history = await get_user_feedback_history(user["id"], limit=20)
        current_mentioned = {t.lower() for t in req.liked + req.disliked}
        extra_liked = [t for t in history["liked"] if t.lower() not in current_mentioned][:5]
        extra_disliked = [t for t in history["disliked"] if t.lower() not in current_mentioned][:3]

    all_liked = req.liked + extra_liked
    all_disliked = req.disliked + extra_disliked

    query_text = (
        f"Movies similar to: {', '.join(all_liked)}. "
        f"Avoiding themes from: {', '.join(all_disliked)}."
        if all_disliked
        else f"Movies similar to: {', '.join(all_liked)}."
    )

    t0 = time.monotonic()
    embedding = embedder.encode_query(query_text)
    embed_ms = int((time.monotonic() - t0) * 1000)

    t0 = time.monotonic()
    n_candidates = req.num_results * 2
    candidates = vector_store.query(embedding, n_results=n_candidates)
    vector_ms = int((time.monotonic() - t0) * 1000)

    mentioned = {t.lower() for t in all_liked + all_disliked}
    candidates = [c for c in candidates if c["title"].lower() not in mentioned]

    t0 = time.monotonic()
    candidates = reranker.rerank(candidates)
    rerank_ms = int((time.monotonic() - t0) * 1000)

    t0 = time.monotonic()
    tmdb_enriched = []
    for c in candidates:
        details = await tmdb.get_movie_details_by_title(c["title"], c.get("year"))
        tmdb_enriched.append({**c, **details})
    tmdb_ms = int((time.monotonic() - t0) * 1000)

    t0 = time.monotonic()
    top_candidates = tmdb_enriched[: req.num_results * 2]
    ranked = await llm_engine.rank_and_explain(
        liked=all_liked,
        disliked=all_disliked,
        candidates=top_candidates,
        num_results=req.num_results,
    )
    llm_ms = int((time.monotonic() - t0) * 1000)

    for rec in ranked:
        match = next((c for c in tmdb_enriched if c["title"].lower() == rec["title"].lower()), {})
        rec["poster_url"] = match.get("poster_url")
        rec["backdrop_url"] = match.get("backdrop_url")
        rec["streaming"] = match.get("streaming", [])
        rec["year"] = match.get("year", rec.get("year"))
        rec["genre"] = match.get("genre", rec.get("genre", ""))
        rec["imdb_rating"] = match.get("imdb_rating", rec.get("imdb_rating"))

    total_ms = int((time.monotonic() - t_total) * 1000)

    background_tasks.add_task(
        insert_pipeline_event,
        event_type="recommend_pipeline",
        event_data={
            "liked": req.liked,
            "disliked": req.disliked,
            "history_liked_injected": extra_liked,
            "history_disliked_injected": extra_disliked,
            "user_id": user["id"] if user else None,
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
