import re
from collections import defaultdict
from difflib import get_close_matches

_GENRE_NAMES: dict[int, str] = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
    80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
    14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Science Fiction",
    53: "Thriller", 10752: "War", 37: "Western",
}

# Weights when ChromaDB is available vs not
_W_WITH_VEC    = (0.35, 0.45, 0.20)   # genre, quality, vector
_W_WITHOUT_VEC = (0.40, 0.60, 0.00)


def _norm(t: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", t.lower()).strip()


def _jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


class AlgorithmicRanker:
    def __init__(self, embedder=None, vector_store=None):
        self.embedder = embedder
        self.vector_store = vector_store
        self._has_vec = embedder is not None and vector_store is not None

    def rank(
        self,
        candidates: list[dict],
        liked: list[str],
        disliked: list[str],
        liked_genre_ids: list[int],
        num_results: int = 5,
    ) -> list[dict]:
        if not candidates:
            return []

        liked_genre_set = set(liked_genre_ids)
        w_genre, w_quality, w_vec = _W_WITH_VEC if self._has_vec else _W_WITHOUT_VEC

        liked_sim = self._similarity_map(liked) if self._has_vec else {}
        disliked_sim = self._similarity_map(disliked) if (self._has_vec and disliked) else {}

        scored: list[tuple] = []
        for c in candidates:
            genre_score = _jaccard(set(c.get("genre_ids", [])), liked_genre_set)
            quality_score = c.get("quality_score", 0.0)
            vector_score = self._lookup(_norm(c["title"]), liked_sim)
            dislike_pen = self._lookup(_norm(c["title"]), disliked_sim) * 0.3

            final = (
                w_genre * genre_score
                + w_quality * quality_score
                + w_vec * vector_score
                - dislike_pen
            )
            scored.append((final, genre_score, quality_score, vector_score, c))

        scored.sort(key=lambda x: x[0], reverse=True)

        results = []
        for rank_idx, (_, gs, qs, vs, c) in enumerate(scored[:num_results], 1):
            explanation = _make_explanation(c, liked, gs, qs, vs, liked_genre_set)
            results.append({
                "rank": rank_idx,
                "title": c["title"],
                "explanation": explanation,
                "poster_url": c.get("poster_url"),
                "backdrop_url": c.get("backdrop_url"),
                "streaming": c.get("streaming", []),
                "year": c.get("year", ""),
                "genre": c.get("genre", ""),
                "imdb_rating": c.get("imdb_rating") or c.get("vote_average"),
                "original_language": c.get("original_language", ""),
            })
        return results

    def _similarity_map(self, titles: list[str]) -> dict[str, float]:
        sim: dict[str, float] = defaultdict(float)
        for title in titles:
            try:
                vec = self.embedder.encode_query(title)
                hits = self.vector_store.query(vec, n_results=50)
                for h in hits:
                    nt = _norm(h.get("title", ""))
                    s = h.get("semantic_score", 0.0)
                    if s > sim[nt]:
                        sim[nt] = s
            except Exception as e:
                print(f"[AlgorithmicRanker] ChromaDB query failed for '{title}': {e}")
        return dict(sim)

    def _lookup(self, norm_title: str, sim_map: dict[str, float]) -> float:
        if not sim_map:
            return 0.0
        if norm_title in sim_map:
            return sim_map[norm_title]
        close = get_close_matches(norm_title, sim_map.keys(), n=1, cutoff=0.75)
        return sim_map[close[0]] if close else 0.0


def _make_explanation(c, liked, genre_score, quality_score, vector_score, liked_genre_set) -> str:
    genre_ids = set(c.get("genre_ids", []))
    shared = [_GENRE_NAMES[g] for g in (genre_ids & liked_genre_set) if g in _GENRE_NAMES]
    rating = c.get("vote_average") or c.get("imdb_rating") or 0
    votes = int(c.get("vote_count", 0))
    ref = liked[0] if liked else "your selections"
    primary_genre = (c.get("genre", "").split(",")[0].strip()) or "Film"

    if genre_score >= 0.4 and shared:
        genre_str = " and ".join(shared[:2])
        return f"Shares {genre_str} with your picks. Rated {rating}/10 across {votes:,} votes."

    if vector_score >= 0.55:
        return f"Tonally close to {ref}. A {primary_genre} film rated {rating}/10."

    if quality_score >= 0.65:
        return (
            f"Highly acclaimed {primary_genre} ({rating}/10, {votes:,} votes). "
            f"Aligns with the taste profile from {ref}."
        )

    if shared:
        return f"A {shared[0]} film matching your genre preference. Rated {rating}/10."

    return f"Matches your era and language preferences. Rated {rating}/10 across {votes:,} votes."
