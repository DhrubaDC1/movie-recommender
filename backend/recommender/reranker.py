import math


def _safe_float(val, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _normalize(values: list[float]) -> list[float]:
    mn, mx = min(values), max(values)
    rng = mx - mn
    if rng == 0:
        return [0.5] * len(values)
    return [(v - mn) / rng for v in values]


class Reranker:
    def rerank(self, candidates: list[dict]) -> list[dict]:
        """Legacy IMDB-CSV reranking (semantic_score + imdb_rating + metascore + votes)."""
        if not candidates:
            return []

        ratings = [_safe_float(c.get("imdb_rating")) for c in candidates]
        metascores = [_safe_float(c.get("meta_score")) for c in candidates]
        log_votes = [math.log1p(_safe_float(c.get("num_votes"))) for c in candidates]

        norm_r = _normalize(ratings)
        norm_m = _normalize(metascores)
        norm_v = _normalize(log_votes)

        for i, c in enumerate(candidates):
            quality = 0.6 * norm_r[i] + 0.3 * norm_m[i] + 0.1 * norm_v[i]
            c["quality_score"] = round(quality, 4)
            c["final_score"] = round(0.7 * c["semantic_score"] + 0.3 * quality, 4)

        return sorted(candidates, key=lambda x: x["final_score"], reverse=True)

    def rerank_tmdb(self, candidates: list[dict]) -> list[dict]:
        """Rerank TMDB discover results by vote_average, vote_count, and popularity."""
        if not candidates:
            return []

        vote_avgs = [_safe_float(c.get("vote_average")) for c in candidates]
        log_counts = [math.log1p(_safe_float(c.get("vote_count"))) for c in candidates]
        log_pops = [math.log1p(_safe_float(c.get("popularity"))) for c in candidates]

        norm_avg = _normalize(vote_avgs)
        norm_cnt = _normalize(log_counts)
        norm_pop = _normalize(log_pops)

        scored = []
        for i, c in enumerate(candidates):
            # 50% rating quality, 30% audience size, 20% current popularity
            score = 0.5 * norm_avg[i] + 0.3 * norm_cnt[i] + 0.2 * norm_pop[i]
            scored.append({**c, "quality_score": round(score, 4)})

        return sorted(scored, key=lambda x: x["quality_score"], reverse=True)
