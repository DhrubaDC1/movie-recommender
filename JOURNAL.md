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

### 17:30 — Hotfix: passlib/bcrypt incompatibility (PR #7)

First real run of the server crashed on `POST /auth/signup` with 500. Root cause: `passlib 1.7.4` (abandoned since 2020) is incompatible with `bcrypt 4.x`. Two symptoms in the traceback:
- `AttributeError: module 'bcrypt' has no attribute '__about__'` — printed as a warning on every startup
- `ValueError: password cannot be longer than 72 bytes` — raised during passlib's internal bcrypt wrap-bug detection test, crashing signup entirely

Fix: dropped passlib entirely. `bcrypt` directly needs only two lines:
```python
bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()  # hash
bcrypt.checkpw(plain.encode(), hashed.encode())           # verify
```

Verified: correct password → True, wrong password → False. Server now starts clean.

Lesson: don't pin abandoned libraries. passlib has had no release since 2020; the bcrypt ecosystem moved on without it.

---

### 18:00 — Hotfix: Groq rate limit (PR #8)

Hit a 429 from Groq: `llama-3.3-70b-versatile` free tier has only 12,000 TPM. With a 10-candidate prompt + 1024-token response, each call burns ~2,000 tokens. A few rapid test requests was enough to hit the wall.

**Two fixes in `llm_engine.py`:**

1. **Switched default model to `llama-3.1-8b-instant`** — 30,000 TPM free limit vs 12,000. Faster too. Quality is slightly lower than 70b but perfectly good for movie recommendations.

2. **Added `_call_with_retry` with up to 3 attempts:**
   - `RateLimitError`: parse the "Please try again in X.Xs" from Groq's error message, sleep for that duration + 1s buffer, then retry
   - `APIStatusError` (5xx): exponential backoff (2^attempt seconds)
   - After max attempts, re-raise so the endpoint returns a real error

3. **Reduced `max_tokens` from 2048 to 1024** — movie recommendation explanations don't need 2048 tokens. Halves token burn per call.

4. **Dropped `Stars` from the candidates block** — director + genre + IMDB rating is enough context for ranking. Saves ~50 tokens per candidate.

With these changes, each call burns ~800-1000 tokens instead of ~2000. Much more headroom on the free tier.

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

## 2026-05-26 — Day 1 (late evening)

### 18:30 — Hotfix: 264 "Failed to fetch" errors on results page (PR merged to main)

Opened the event logs and found 264 `recommendations_error` entries, all with `"Failed to fetch"`. Four errors had identical timestamps (12:03:35.892Z × 4) — a clear sign of multiple simultaneous requests, not a network problem.

**Root cause** — a React referential stability bug in `frontend/app/results/page.tsx`:

```typescript
// These create new array references on every render:
const liked = searchParams.getAll("liked");
const disliked = searchParams.getAll("disliked");

const fetchRecs = useCallback(async (...) => {
  ...
}, [liked, disliked, sessionId]); // deps always "changed" → recreated every render

useEffect(() => {
  fetchRecs(); // re-fired on every render
}, [fetchRecs]); // caught the recreation → fired again
```

`searchParams.getAll()` returns a new `string[]` instance on every call, even when the values are identical. React's `useCallback` uses `Object.is` comparison — two different array objects are never equal — so `fetchRecs` was recreated on every render. The `useEffect` caught that and re-fired `fetchRecs()`, which aborted the previous in-flight fetch, which the browser reported as `"Failed to fetch"`.

**Fix — three changes:**

1. **`useMemo` on the arrays** — stable reference as long as `searchParams` doesn't change:
   ```typescript
   const liked = useMemo(() => searchParams.getAll("liked"), [searchParams]);
   const disliked = useMemo(() => searchParams.getAll("disliked"), [searchParams]);
   ```

2. **`fetchInitiatedRef` mount guard** — even in edge cases (StrictMode double-invoke, hot reload), the initial fetch runs exactly once:
   ```typescript
   const fetchInitiatedRef = useRef(false);
   useEffect(() => {
     if (fetchInitiatedRef.current) return;
     fetchInitiatedRef.current = true;
     const controller = new AbortController();
     fetchRecs([], [], controller.signal);
     return () => controller.abort();
   }, [fetchRecs]);
   ```

3. **`AbortController` threaded through** — so navigating away mid-fetch aborts cleanly, and the `AbortError` is silently swallowed (not logged as a real error):
   ```typescript
   catch (e: unknown) {
     if (e instanceof Error && e.name === "AbortError") return;
     // ... real error handling
   }
   ```

Also forwarded `signal` to `getRecommendations` in `lib/api.ts` so it reaches the actual `fetch()` call.

**Result**: Exactly one POST `/recommend` per page load. Error events in the DB: zero for normal loads. Rediscovery (user-triggered) unchanged.

Lesson: `searchParams.getAll()` is a call that allocates a new array every time. Never put it raw into `useCallback` deps — always memoize first.

---

## 2026-05-26 — Day 1 (night)

### 19:30 — Feature 7: Reliable Movie Thumbnails + Language Preference Filter

Two features in one branch (`feat/thumbnails-and-language-filter`).

**Feature 1 — Reliable Thumbnails**

The `RecommendationCard` already had a poster `<img>` tag, but if the TMDB URL failed to load (network error, wrong title match, movie not in TMDB), the image would silently break. Fixed with:

- `imgError` state + `onError={() => setImgError(true)}` on the img tag
- `PosterFallback` component: cinema-red gradient background + movie initials extracted from the title (up to two words). Renders when `poster_url` is null OR when the image load fails.
- Poster column widened: 120px→130px (mobile), 160px→175px (desktop). `self-stretch` ensures it fills the full card height.

**Feature 2 — Language Preference Filter**

Flow: Landing page → URL params → Results page → API body → Backend filter → LLM hint.

*Frontend (`page.tsx`):*
- Four multi-select language pills: **English, Hindi, Bangla, Others**
- Cinema-red glow when active; neutral glass when inactive
- "No filter — recommends from all languages" helper text when nothing selected
- Selected languages appended to URL as `?language=English&language=Hindi`

*Frontend (`results/page.tsx` + `api.ts`):*
- `languages` read from URL params (memoized like `liked`/`disliked`)
- Passed into `getRecommendations` → POST body `languages: [...]`
- Results nav subtitle shows active filter: "Based on: Inception · Hindi"

*Backend:*
- `_LANG_ISO` map: `{"English": "en", "Hindi": "hi", "Bangla": "bn"}`
- `"Others"` = anything NOT in `[en, hi, bn]`
- **Soft-sort** (not hard-filter): preferred-language candidates go first in the list, the rest are appended. This means we always return `num_results` results even if the IMDB Top 1000 has zero Bengali films — the LLM just gets them ranked lower.
- TMDB `_enrich()` now returns `original_language` from the search result (no extra API call — it's already in the search response).
- `rank_and_explain` updated: `PREFERRED LANGUAGES: {languages}` added to the CoT prompt. LLM prioritises matching languages when quality is otherwise equal.

**Challenge**: The PR merge kept targeting `feat/project-foundation` (the repo's default branch is wrong). Fixed by merging directly to `main` locally and pushing.

**Lesson (soft vs hard filter)**: Hard-filtering by language in a small dataset (1000 English-majority films) would leave users with Bengali preference getting 0 results. Soft-sort keeps UX intact while still honouring the preference wherever possible.

Build: TypeScript clean. All changes on `main`.

---

### 20:15 — Hotfix: Language filter not reflected in results

User reported language selection had no visible effect. Traced the pipeline and found three separate issues:

**Root cause 1 — Candidate pool too small**

`n_candidates = req.num_results * 2 = 10`. The IMDB Top 1000 dataset has a small number of Hindi films (Dangal, 3 Idiots, Lagaan, etc.) and essentially zero Bangla films. If the semantic search returns 10 candidates and the soft-sort only finds 1–2 Hindi matches in that pool, the LLM still gets 8 English films and will rank them higher by default.

Fix: `n_candidates = req.num_results * (4 if req.languages else 2)` — double the pool when a language filter is active to give the soft-sort more material.

**Root cause 2 — Vector query had no language signal**

The embedding query was `"Movies similar to: Inception."` — no mention of language anywhere. ChromaDB finds thematically similar movies, which are overwhelmingly English.

Fix: Prepend the language to the query: `"Hindi/Bangla movies similar to: Inception."` — the multilingual E5 embedding encodes this, biasing retrieval toward Indian cinema.

**Root cause 3 — LLM couldn't see the language of each candidate**

The candidates block showed title/genre/rating/director but NOT language. The LLM had to guess which films were Hindi from its own training knowledge — for lesser-known films it would have no idea. And the instruction was "prioritise when quality is otherwise equal" — a soft hint the LLM could silently ignore.

Fix: Added `Language: Hindi` to every candidate line (ISO code → full name via `_ISO_TO_NAME` dict). Hardened the LANGUAGE RULE in the prompt: "you MUST rank films whose Language field matches a preferred language above films that do not match, as long as any language-matching candidate exists."

Lesson: A language filter only works if all three of (retrieval, sorting, LLM visibility) respect it. Fixing just one layer is insufficient.

---

