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

## 2026-05-26 — Day 1 (evening)

### 15:30 — Feature 5: User Auth System (JWT + httpOnly cookies)

Two new features requested: auth system + post-recommendation feedback loop. Starting with auth — everything else builds on top of it.

**Backend:**
- `db.py` — added `users` table (id, email, username, password_hash, created_at) and `movie_feedback` table (user_id, movie_title, opinion, source, timestamp). Added full CRUD: `create_user`, `get_user_by_email/id/username`, `upsert_movie_feedback`, `get_user_feedback_history`. UNIQUE index on (user_id, movie_title) so rating a movie twice updates rather than duplicates.
- `auth.py` — JWT with `python-jose` (HS256, 7-day expiry), bcrypt password hashing via `passlib`. Routes: POST /auth/signup, POST /auth/login, POST /auth/logout, GET /auth/me. Tokens stored in httpOnly cookies so JS can't read them (XSS-safe). Two FastAPI dependencies: `get_current_user` (raises 401) and `get_optional_user` (returns None).
- `main.py` — CORS updated with `allow_credentials=True` (required for cookies). Auth router included. `/recommend` now uses `get_optional_user` — if logged in, it fetches up to 5 historical liked + 3 historical disliked movies and merges them into the query, so results improve with every session.
- Added `POST /user/feedback` and `GET /user/history` routes.

**Frontend:**
- `lib/auth.ts` — all auth API calls with `credentials: "include"` so cookies are sent
- `contexts/AuthContext.tsx` — React context: hydrates from `/auth/me` on mount, exposes login/signup/logout
- `components/AuthModal.tsx` — glassmorphism modal, tabbed Sign In / Create Account, field focus animations, error display
- `components/NavBar.tsx` — shared nav for both pages: logo, auth state (avatar + username + sign out, or Sign in / Join free buttons)
- `app/layout.tsx` — wrapped with `<AuthProvider>`
- `app/page.tsx` — uses `NavBar`, fetches history on login and pre-fills liked/disliked tags, welcome message for returning users

**Challenge**: `allow_credentials=True` in CORS requires `allow_origins` to be explicit (not `*`). Already had explicit origins, so no change needed — just adding the flag was enough.

**What this unlocks**: Every recommend call now merges the user's historical opinions into the query. First session is cold-start; by session 3-4, the system knows them well.

Build: TypeScript clean, Next.js static build passes.

---

### 16:45 — Feature 6: Post-Recommendation Feedback + Rediscovery Loop

This one closes the loop on the whole system — the user can now rate movies they've watched and immediately rediscover using those opinions.

**What was built:**

**`RecommendationCard.tsx` (updated)**
- Added `feedback: FeedbackOpinion` prop and `onFeedback` callback
- Two `FeedbackButton` components (👍 / 👎), always visible bottom-right of each card
- Active state: coloured glow + solid background (green for liked, red for disliked)
- Card border/glow changes to match the selected opinion — visual confirmation
- `saving` prop disables both buttons while the API call is in-flight

**`RediscoverButton.tsx` (new)**
- Sticky floating button, fixed at bottom-center
- Appears via spring animation when `count > 0` (at least one movie rated)
- Shows count: "Rediscover with 3 new opinions →"
- Exits smoothly when count drops to zero

**`results/page.tsx` (heavily updated)**
- `feedback` state: `Record<title, 'liked' | 'disliked' | null>`
- `handleFeedback`: updates local state immediately (optimistic), then persists to DB if user is logged in. Guests get UI feedback but no DB write.
- `extraLikedRef` / `extraDislikedRef`: accumulate feedback across multiple rediscovery rounds (so round 3 builds on rounds 1+2)
- `handleRediscover`: merges accumulated opinions into the liked/disliked lists, calls `fetchRecs` in-place (no navigation), scrolls to top
- `NavBar` now used instead of inline nav
- Hint text "Rate movies you've watched to unlock Rediscovery" shown until first rating

**Challenge**: Rediscovery needed to be *in-place* (no navigation) because the search params URL was the source of truth. Solved by storing extra liked/disliked in `useRef` (persists across renders, doesn't trigger re-render) and passing them directly into `fetchRecs()`.

**Also**: Guest users (not logged in) still get the full UI experience — their feedback is tracked in the event log but not persisted to `movie_feedback`. The hint text under the title card changes based on auth state.

**The full data flywheel now works:**
1. User rates a movie 👍 → stored in `movie_feedback`
2. Next session: history pre-fills liked list
3. `/recommend` merges history into query → better candidates
4. More ratings → better history → better recommendations

Build: TypeScript clean, Next.js static build passes.

---

## 2026-05-26 — Day 1 (continued)

### 14:00 — Feature 4: Interaction & Behaviour Logging

New requirement: log everything users do and what the system does internally, flush to DB every 30 seconds, so we can use the data later to improve recommendations.

**What was built:**

**Backend — `db.py` (new)**
- Async SQLite via `aiosqlite`
- Two tables: `user_events` (frontend interactions) and `pipeline_events` (backend RAG timings)
- `user_events`: session_id, event_type, page, event_data (JSON), client/server timestamp
- `pipeline_events`: session_id, event_type, event_data (JSON), duration_ms, error, timestamp
- Indexed on session_id, event_type, timestamp for future querying

**Backend — `main.py` (updated)**
- `await init_db()` on startup before loading ML services
- New `POST /log-events` endpoint — accepts batch of frontend events, writes to DB via `BackgroundTasks` (non-blocking, doesn't slow the response)
- `/recommend` now fully instrumented with `time.monotonic()` at each RAG stage:
  - embed_ms, vector_search_ms, rerank_ms, tmdb_enrich_ms, llm_ms, total_ms
  - Pipeline event written to DB as background task after every recommendation
- `session_id` threaded through from frontend → recommend request → pipeline log

**Frontend — `lib/logger.ts` (new)**
- Singleton `EventLogger` class
- 30-second `setInterval` flush via `fetch` with `keepalive: true` (survives page navigation)
- `beforeunload` handler for immediate flush on tab close
- On flush failure: events put back at front of buffer so nothing is lost
- Session ID stored in `sessionStorage` so it persists within a tab but not across sessions

**Frontend — events tracked:**
- `page_view` — on both landing and results pages
- `movie_add_liked` / `movie_add_disliked` — when user selects from autocomplete
- `movie_remove_liked` / `movie_remove_disliked` — when they remove a tag
- `discover_click` — with full liked/disliked list at click time; triggers immediate flush before navigation
- `recommendations_received` — titles, ranks, and client-perceived latency
- `recommendations_error` — error message
- `card_view` — via `IntersectionObserver` when a card becomes ≥50% visible (fires once per card)
- `refine_click` — when navigating back, triggers flush

**Challenges:**
- `RecommendationCard` didn't accept `onView` prop originally. Added `IntersectionObserver` pattern with a `viewFired` ref to fire exactly once per card.
- `motion.article` + `ref` required casting `cardRef as React.Ref<HTMLDivElement>` since Framer Motion's `motion.article` generic doesn't infer the element type from the HTML tag automatically.
- `keepalive: true` on the flush fetch is critical — without it, the browser cancels in-flight requests when the page unloads.

**What this data enables later:**
- Most-searched movies (hot autocomplete terms)
- Liked/disliked pair patterns → train better retrieval
- Card view-through rate per rank position (are rank 4/5 ever seen?)
- End-to-end latency tracking per RAG stage
- Error rate monitoring

Build: TypeScript clean. Next.js static build passes.

---

### 17:30 — Hotfix: env file not loaded on startup

First real run hit a `KeyError: 'TMDB_API_KEY'` immediately. Root cause: `load_dotenv()` with no arguments only looks for `.env`, but the project uses `.env.local`. One-line fix — `load_dotenv(".env.local")` — and the server came up clean: embedding model loaded, ChromaDB collection at 1000 docs, all services ready.

Lesson: name your env file exactly `.env` if you want python-dotenv to find it automatically, or always pass the filename explicitly.

---

