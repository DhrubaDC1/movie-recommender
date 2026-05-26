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
2. Backend: FastAPI + health check
3. Backend: TMDB client (movie search/autocomplete)
4. Backend: ChromaDB + embeddings (vector store)
5. Backend: LLM engine (Groq + comparative prompting + CoT)
6. Backend: Full `/recommend` endpoint
7. Frontend: Landing page (hero background, preference input)
8. Frontend: Results page (recommendation cards, streaming badges)

---

