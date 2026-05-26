import math


def _safe_float(val, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


class Reranker:
    """Two-stage hybrid re-ranking per paper:
    quality = 0.6*IMDB + 0.3*Metascore + 0.1*log(votes)
    final   = 0.7*semantic + 0.3*quality
    """

    def rerank(self, candidates: list[dict]) -> list[dict]:
        if not candidates:
            return []

        ratings = [_safe_float(c.get("imdb_rating")) for c in candidates]
        metascores = [_safe_float(c.get("meta_score")) for c in candidates]
        log_votes = [math.log1p(_safe_float(c.get("num_votes"))) for c in candidates]

        def normalize(values: list[float]) -> list[float]:
            mn, mx = min(values), max(values)
            rng = mx - mn
            if rng == 0:
                return [0.5] * len(values)
            return [(v - mn) / rng for v in values]

        norm_r = normalize(ratings)
        norm_m = normalize(metascores)
        norm_v = normalize(log_votes)

        for i, c in enumerate(candidates):
            quality = 0.6 * norm_r[i] + 0.3 * norm_m[i] + 0.1 * norm_v[i]
            c["quality_score"] = round(quality, 4)
            c["final_score"] = round(0.7 * c["semantic_score"] + 0.3 * quality, 4)

        return sorted(candidates, key=lambda x: x["final_score"], reverse=True)
