import asyncio
import time
from collections import Counter
from contextlib import asynccontextmanager
from difflib import get_close_matches
from typing import Optional

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os

load_dotenv(".env.local")

from recommender.tmdb_client import TMDBClient
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
reranker: Reranker
llm_engine: LLMEngine

# Map UI language names → TMDB ISO 639-1 codes
_LANG_ISO: dict[str, str] = {
    "English": "en",
    "Hindi": "hi",
    "Bangla": "bn",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global tmdb, reranker, llm_engine
    print("Initialising database...")
    await init_db()
    print("Loading services...")
    tmdb = TMDBClient(api_key=os.environ["TMDB_API_KEY"], region=os.getenv("TMDB_REGION", "US"))
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

# Era → (release_date_gte, release_date_lte)  — None means no bound
_ERA_DATES: dict[str, tuple[Optional[str], Optional[str]]] = {
    "Latest":    ("2022-01-01", None),
    "2010s":     ("2010-01-01", "2019-12-31"),
    "2000s":     ("2000-01-01", "2009-12-31"),
    "Classics":  (None,         "1999-12-31"),
}


class RecommendRequest(BaseModel):
    liked: list[str]
    disliked: list[str] = []
    num_results: int = 5
    session_id: Optional[str] = None
    languages: list[str] = []   # e.g. ["English", "Hindi"]
    era: str = ""               # "Latest" | "2010s" | "2000s" | "Classics" | "" = any


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
    return {"status": "ok", "pipeline": "tmdb-discover"}


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

    # ── Merge authenticated user's taste history ────────────────────────────
    extra_liked: list[str] = []
    extra_disliked: list[str] = []
    if user:
        history = await get_user_feedback_history(user["id"], limit=20)
        current_mentioned = {t.lower() for t in req.liked + req.disliked}
        extra_liked = [t for t in history["liked"] if t.lower() not in current_mentioned][:5]
        extra_disliked = [t for t in history["disliked"] if t.lower() not in current_mentioned][:3]

    all_liked = req.liked + extra_liked
    all_disliked = req.disliked + extra_disliked

    # ── Step 1: Extract genre + keyword signals from liked movies ───────────
    t0 = time.monotonic()
    metas = await asyncio.gather(
        *[tmdb.get_movie_meta(title) for title in all_liked[:3]],
        return_exceptions=True,
    )
    genre_counter: Counter = Counter()
    keyword_ids_all: list[int] = []
    for meta in metas:
        if isinstance(meta, Exception):
            continue
        genre_counter.update(meta["genre_ids"])
        keyword_ids_all.extend(meta["keyword_ids"])

    top_genre_ids = [gid for gid, _ in genre_counter.most_common(4)]
    # Deduplicate keywords while preserving frequency-based order
    seen_kw: set[int] = set()
    keyword_ids: list[int] = []
    for kid in keyword_ids_all:
        if kid not in seen_kw:
            seen_kw.add(kid)
            keyword_ids.append(kid)
    keyword_ids = keyword_ids[:10]
    meta_ms = int((time.monotonic() - t0) * 1000)

    # ── Step 2: Determine target language codes and era date bounds ────────
    lang_codes: list[str] = []
    include_others = "Others" in req.languages
    for lang in req.languages:
        if lang in _LANG_ISO:
            lang_codes.append(_LANG_ISO[lang])

    date_gte, date_lte = _ERA_DATES.get(req.era, (None, None))

    # ── Step 3: Discover candidates from TMDB (real-time) ──────────────────
    t0 = time.monotonic()
    candidates: list[dict] = []

    if lang_codes:
        # One discover request per language (2 pages each) for balanced coverage
        discover_tasks = [
            tmdb.discover_movies(top_genre_ids, keyword_ids, lang_code, page=p,
                                 date_gte=date_gte, date_lte=date_lte)
            for lang_code in lang_codes
            for p in (1, 2)
        ]
        results_list = await asyncio.gather(*discover_tasks, return_exceptions=True)
        for res in results_list:
            if not isinstance(res, Exception):
                candidates.extend(res)

        if include_others:
            broad = await tmdb.discover_movies(top_genre_ids, keyword_ids, page=1,
                                               date_gte=date_gte, date_lte=date_lte)
            known_iso = set(_LANG_ISO.values())
            candidates.extend(c for c in broad if c["original_language"] not in known_iso)
    else:
        # No language preference — broad discovery across 2 pages
        pages = await asyncio.gather(
            tmdb.discover_movies(top_genre_ids, keyword_ids, page=1,
                                 date_gte=date_gte, date_lte=date_lte),
            tmdb.discover_movies(top_genre_ids, keyword_ids, page=2,
                                 date_gte=date_gte, date_lte=date_lte),
            return_exceptions=True,
        )
        for page_res in pages:
            if not isinstance(page_res, Exception):
                candidates.extend(page_res)

    # Fallback: if discover returned too few results (niche genre+keyword), retry genre-only
    if len(candidates) < req.num_results:
        fallback_tasks = [
            tmdb.discover_movies(top_genre_ids, [], lc if lang_codes else None, page=1,
                                 date_gte=date_gte, date_lte=date_lte)
            for lc in (lang_codes or [None])
        ]
        for res in await asyncio.gather(*fallback_tasks, return_exceptions=True):
            if not isinstance(res, Exception):
                candidates.extend(res)

    discover_ms = int((time.monotonic() - t0) * 1000)

    # ── Step 4: Deduplicate and filter out movies the user mentioned ────────
    mentioned = {t.lower() for t in all_liked + all_disliked}
    seen_ids: set[int] = set()
    filtered: list[dict] = []
    for c in candidates:
        tid = c.get("tmdb_id")
        if not tid or tid in seen_ids:
            continue
        if c["title"].lower() in mentioned:
            continue
        seen_ids.add(tid)
        filtered.append(c)
    candidates = filtered

    # ── Step 5: Quality rerank ──────────────────────────────────────────────
    t0 = time.monotonic()
    candidates = reranker.rerank_tmdb(candidates)
    rerank_ms = int((time.monotonic() - t0) * 1000)

    # Language soft-sort: preferred-language movies bubble to the top
    if req.languages:
        iso_wanted: set[str] = set(lang_codes)

        def _lang_matches(movie: dict) -> bool:
            orig = movie.get("original_language", "")
            if orig in iso_wanted:
                return True
            if include_others and orig not in _LANG_ISO.values():
                return True
            return False

        preferred = [c for c in candidates if _lang_matches(c)]
        rest = [c for c in candidates if not _lang_matches(c)]
        candidates = preferred + rest

    # ── Step 6: Enrich top candidates with streaming providers (parallel) ───
    t0 = time.monotonic()
    top_candidates = candidates[: req.num_results * 2]
    streaming_results = await asyncio.gather(
        *[tmdb.enrich_with_streaming(c["tmdb_id"]) for c in top_candidates],
        return_exceptions=True,
    )
    for i, streaming in enumerate(streaming_results):
        top_candidates[i]["streaming"] = [] if isinstance(streaming, Exception) else streaming
    tmdb_ms = int((time.monotonic() - t0) * 1000)

    # Ensure imdb_rating field exists (maps vote_average for frontend compat)
    for c in top_candidates:
        c.setdefault("imdb_rating", c.get("vote_average"))

    # ── Step 7: LLM comparative + CoT ranking ──────────────────────────────
    t0 = time.monotonic()
    ranked = await llm_engine.rank_and_explain(
        liked=all_liked,
        disliked=all_disliked,
        candidates=top_candidates,
        num_results=req.num_results,
        languages=req.languages or None,
        era=req.era or None,
    )
    llm_ms = int((time.monotonic() - t0) * 1000)

    # Attach full TMDB metadata to each ranked result.
    # LLM sometimes rephrases titles ("Se7en" → "Seven"), so we look up by
    # candidate_index first (exact array position), then fall back to fuzzy
    # title matching so the poster is always found if the movie is in our list.
    candidate_titles = [c["title"] for c in top_candidates]
    for rec in ranked:
        match: dict = {}

        # 1. Index-based lookup (LLM returns the number shown in the prompt)
        idx = rec.get("candidate_index")
        if isinstance(idx, int) and 1 <= idx <= len(top_candidates):
            match = top_candidates[idx - 1]

        # 2. Exact title match
        if not match:
            match = next(
                (c for c in top_candidates if c["title"].lower() == rec["title"].lower()),
                {},
            )

        # 3. Fuzzy title match (cutoff 0.6 avoids false positives)
        if not match:
            close = get_close_matches(rec["title"], candidate_titles, n=1, cutoff=0.6)
            if close:
                match = next(c for c in top_candidates if c["title"] == close[0])

        rec["poster_url"] = match.get("poster_url")
        rec["backdrop_url"] = match.get("backdrop_url")
        rec["streaming"] = match.get("streaming", [])
        rec["year"] = match.get("year", rec.get("year"))
        rec["genre"] = match.get("genre", rec.get("genre", ""))
        rec["imdb_rating"] = match.get("vote_average", rec.get("imdb_rating"))
        rec["original_language"] = match.get("original_language", "")

    total_ms = int((time.monotonic() - t_total) * 1000)

    background_tasks.add_task(
        insert_pipeline_event,
        event_type="recommend_pipeline",
        event_data={
            "liked": req.liked,
            "disliked": req.disliked,
            "languages": req.languages,
            "era": req.era,
            "history_liked_injected": extra_liked,
            "history_disliked_injected": extra_disliked,
            "user_id": user["id"] if user else None,
            "num_candidates_discovered": len(candidates),
            "num_final_results": len(ranked),
            "results": [r["title"] for r in ranked],
            "timings": {
                "meta_ms": meta_ms,
                "discover_ms": discover_ms,
                "rerank_ms": rerank_ms,
                "streaming_ms": tmdb_ms,
                "llm_ms": llm_ms,
                "total_ms": total_ms,
            },
        },
        duration_ms=total_ms,
        session_id=session_id,
    )

    return {"recommendations": ranked}
