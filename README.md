# Movie Recommender

An LLM-powered movie recommendation system built on RAG + explicit user preference elicitation.

Based on: *"The Architecture, Tuning, and Evaluation of Large Language Model-Driven Movie Recommendation Systems"*

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, Framer Motion |
| Backend | Python FastAPI |
| Vector DB | ChromaDB + `intfloat/multilingual-e5-small` |
| LLM | Groq (`llama-3.3-70b-versatile`) |
| Data | IMDB Top 1000 + TMDB API |

## How it works

1. User inputs movies they love and movies they didn't click with
2. User profile is embedded and queried against a ChromaDB vector store (IMDB Top 1000)
3. Candidates are re-ranked by semantic similarity + quality score (IMDB/Metascore/Votes weighted)
4. Groq LLaMA generates ranked recommendations with Chain-of-Thought explanations
5. TMDB API enriches results with high-res posters and streaming availability

## Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in GROQ_API_KEY, TMDB_API_KEY
python setup_vectordb.py
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)
