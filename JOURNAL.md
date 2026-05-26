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
4. ⏳ Deploy / integration testing

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

