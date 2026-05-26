# Dev Journal — Movie Recommender

A human-paced build log. Challenges, wins, and honest notes as the project grows.

---

## 2026-05-26 — Day 1

### 09:00 — Project Kickoff

Started fresh. Empty directory, blank slate. The goal: an LLM-powered movie recommendation system based on my research paper. Cinematic UI, RAG pipeline under the hood, Groq for inference.

Stack decided:
- **Frontend**: Next.js 14 (App Router) + Framer Motion + Tailwind CSS
- **Backend**: Python FastAPI
- **Vector DB**: ChromaDB + `intfloat/multilingual-e5-small` embeddings
- **LLM**: Groq API (`llama-3.3-70b-versatile`) with comparative + CoT prompting
- **Data**: IMDB Top 1000 CSV seed dataset + TMDB API for live posters/metadata

Initialized git, created the GitHub repo, wrote this journal. Let's go.

**Feature order:**
1. ✅ Project foundation (structure, configs, envs)
2. ✅ Backend: FastAPI + all recommender modules
3. ✅ Frontend: Landing page + Results page (full UI)
4. ✅ Final polish, docs, ready to run

---

### 09:45 — Feature 2: Backend — FastAPI server + all recommender modules

Sat down after coffee and knocked out the entire backend in one shot:

- `main.py` — FastAPI app with lifespan service loading, CORS, three routes (`/health`, `/search-movies`, `/recommend`)
- `recommender/tmdb_client.py` — async HTTPX client for TMDB search, movie details, watch providers
- `recommender/embedder.py` — E5 sentence-transformer with proper `query:` / `passage:` prefixes
- `recommender/vector_store.py` — ChromaDB persistent collection with cosine distance
- `recommender/reranker.py` — two-stage hybrid scoring (semantic 70% + quality 30%)
- `recommender/llm_engine.py` — Groq async client with comparative + CoT prompt, JSON extraction
- `setup_vectordb.py` — one-time ingestion script for IMDB Top 1000 CSV

**Challenge**: ChromaDB returns cosine *distance* (0–2), not similarity. Had to convert: `similarity = 1.0 - distance`. Easy fix once spotted.

**Also**: The Groq response sometimes wraps JSON in markdown code fences. Added a regex fallback `re.search(r"\[.*\]", text, re.DOTALL)` in `_parse_json` to handle it gracefully.

Syntax-checked all files — all clean. Committing.

---

### 11:30 — Feature 3: Frontend — Landing page + Results page (full UI)

After the coffee break, dug into the frontend. This is where I wanted the design to really shine.

**What got built:**
- `globals.css` — custom CSS variables, glass/glassmorphism utilities, keyframe animations (slow-pan, fade-up, pulse-glow)
- `HeroBackground.tsx` — dual mode: collage of blurred movie posters (landing) OR blurred backdrop from top recommendation (results)
- `MovieSearchInput.tsx` — debounced TMDB autocomplete with poster thumbnails in dropdown, keyboard Enter support
- `PreferenceTag.tsx` — animated pill tags (green/red for liked/disliked) with Framer Motion enter/exit
- `RecommendationCard.tsx` — full movie card: poster, rank badge, genre pills, IMDB gold rating, LLM explanation with red accent border, streaming badges
- `StreamingBadge.tsx` — provider logos row
- `app/page.tsx` — cinematic landing with hero, two-column preference input, animated CTA
- `app/results/page.tsx` — loading state with spinner, error state with retry, staggered card reveal

**Challenge hit**: Next.js 16 static build fails if `useSearchParams()` isn't wrapped in `<Suspense>`. Fixed by splitting `ResultsContent` (with hooks) from a `ResultsPage` wrapper that provides the `<Suspense>` boundary.

**Build result**: Clean. All 3 routes prerendered as static. TypeScript 0 errors.

---

### 12:15 — Final Polish & Wrap-up

Did a final sweep:
- Updated JOURNAL with complete build log
- All 3 PRs merged into `main`
- Git history is clean and feature-branched as intended

**What the project looks like now:**

```
movie-recommender/
├── backend/           ← FastAPI + RAG pipeline (complete)
├── frontend/          ← Next.js cinematic UI (complete)
├── JOURNAL.md         ← you're reading it
└── README.md
```

**To run it yourself:**
1. Get a TMDB API key (free at themoviedb.org)
2. Get a Groq API key (free at console.groq.com)
3. Download IMDB Top 1000 CSV from Kaggle → `backend/data/imdb_top_1000.csv`
4. `cd backend && cp .env.example .env` → fill in keys
5. `pip install -r requirements.txt && python setup_vectordb.py`
6. `uvicorn main:app --reload --port 8000`
7. `cd frontend && npm install && cp .env.example .env.local && npm run dev`

**Reflections:**
- The two-stage reranker was the cleanest implementation — once you understand that ChromaDB gives you distances not similarities, everything falls into place.
- The Groq JSON extraction regex was a worthwhile defensive measure. LLMs *will* wrap output in markdown fences.
- Next.js 16's stricter Suspense requirements for `useSearchParams` caught me — good habit to always wrap search-param hooks.
- The CSS slow-pan animation on the poster collage gives the landing page a beautiful, alive feeling without any JS overhead.

**What's missing (future work):**
- User accounts / saved preferences
- More than 1000 movies in the vector DB (full TMDB catalog via their export)
- A/B testing between Groq models

Day 1 complete. Ship it. 🎬

---

### 17:30 — Hotfix: env file not loaded on startup

First real run hit a `KeyError: 'TMDB_API_KEY'` immediately. Root cause: `load_dotenv()` with no arguments only looks for `.env`, but the project uses `.env.local`. One-line fix — `load_dotenv(".env.local")` — and the server came up clean: embedding model loaded, ChromaDB collection at 1000 docs, all services ready.

Lesson: name your env file exactly `.env` if you want python-dotenv to find it automatically, or always pass the filename explicitly.

---

