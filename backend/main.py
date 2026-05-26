from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
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

tmdb: TMDBClient
embedder: Embedder
vector_store: VectorStore
reranker: Reranker
llm_engine: LLMEngine


@asynccontextmanager
async def lifespan(app: FastAPI):
    global tmdb, embedder, vector_store, reranker, llm_engine
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


class RecommendRequest(BaseModel):
    liked: list[str]
    disliked: list[str] = []
    num_results: int = 5


@app.get("/health")
async def health():
    return {"status": "ok", "model": "llama-3.3-70b-versatile"}


@app.get("/search-movies")
async def search_movies(q: str = Query(..., min_length=2)):
    if not q.strip():
        return []
    results = await tmdb.search_movie(q)
    return results


@app.post("/recommend")
async def recommend(req: RecommendRequest):
    if not req.liked:
        raise HTTPException(status_code=400, detail="Provide at least one liked movie.")

    query_text = (
        f"Movies similar to: {', '.join(req.liked)}. "
        f"Avoiding themes from: {', '.join(req.disliked)}."
        if req.disliked
        else f"Movies similar to: {', '.join(req.liked)}."
    )

    embedding = embedder.encode_query(query_text)
    n_candidates = req.num_results * 2
    candidates = vector_store.query(embedding, n_results=n_candidates)

    mentioned = {t.lower() for t in req.liked + req.disliked}
    candidates = [c for c in candidates if c["title"].lower() not in mentioned]

    candidates = reranker.rerank(candidates)

    tmdb_enriched = []
    for c in candidates:
        details = await tmdb.get_movie_details_by_title(c["title"], c.get("year"))
        tmdb_enriched.append({**c, **details})

    top_candidates = tmdb_enriched[: req.num_results * 2]
    ranked = await llm_engine.rank_and_explain(
        liked=req.liked,
        disliked=req.disliked,
        candidates=top_candidates,
        num_results=req.num_results,
    )

    for rec in ranked:
        match = next((c for c in tmdb_enriched if c["title"].lower() == rec["title"].lower()), {})
        rec["poster_url"] = match.get("poster_url")
        rec["backdrop_url"] = match.get("backdrop_url")
        rec["streaming"] = match.get("streaming", [])
        rec["year"] = match.get("year", rec.get("year"))
        rec["genre"] = match.get("genre", rec.get("genre", ""))
        rec["imdb_rating"] = match.get("imdb_rating", rec.get("imdb_rating"))

    return {"recommendations": ranked}
