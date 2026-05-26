import httpx
from typing import Optional


TMDB_BASE = "https://api.themoviedb.org/3"
IMG_BASE = "https://image.tmdb.org/t/p"

# Stable TMDB genre ID → name map (rarely changes)
TMDB_GENRES: dict[int, str] = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
    80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
    14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Science Fiction",
    10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
}

STREAMING_LOGO = {
    "Netflix": "https://image.tmdb.org/t/p/original/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg",
    "Amazon Prime Video": "https://image.tmdb.org/t/p/original/68MNrwlkpF7WnmNPXLah69CR5xh.jpg",
    "Disney Plus": "https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg",
    "Apple TV Plus": "https://image.tmdb.org/t/p/original/6uhKBfmtzFqOcLousHwZuzcrScK.jpg",
    "Hulu": "https://image.tmdb.org/t/p/original/zxrVdFjIjLqkfnwyghnSPx1g3bR.jpg",
    "Max": "https://image.tmdb.org/t/p/original/nmU4bScM7OUGE7Lnx8WfDMOxmEg.jpg",
    "Paramount Plus": "https://image.tmdb.org/t/p/original/xbhHHa1YgtpwhC8lb1NQ3ACVcLd.jpg",
}


class TMDBClient:
    def __init__(self, api_key: str, region: str = "US"):
        self.api_key = api_key
        self.region = region
        self._client = httpx.AsyncClient(timeout=10.0)

    def _params(self, **kwargs) -> dict:
        return {"api_key": self.api_key, **kwargs}

    # ── Autocomplete search (used by frontend /search-movies) ──────────────

    async def search_movie(self, query: str) -> list[dict]:
        r = await self._client.get(
            f"{TMDB_BASE}/search/movie",
            params=self._params(query=query, include_adult=False),
        )
        r.raise_for_status()
        results = r.json().get("results", [])[:8]
        return [
            {
                "tmdb_id": m["id"],
                "title": m["title"],
                "year": (m.get("release_date") or "")[:4],
                "poster_url": f"{IMG_BASE}/w92{m['poster_path']}" if m.get("poster_path") else None,
            }
            for m in results
        ]

    # ── Metadata lookup for liked movies ───────────────────────────────────

    async def get_movie_meta(self, title: str) -> dict:
        """Return genre_ids and keyword_ids for a movie title (for discover seeding)."""
        r = await self._client.get(
            f"{TMDB_BASE}/search/movie",
            params=self._params(query=title, include_adult=False),
        )
        r.raise_for_status()
        results = r.json().get("results", [])
        if not results:
            return {"tmdb_id": None, "genre_ids": [], "keyword_ids": []}

        movie = results[0]
        tmdb_id = movie["id"]
        genre_ids: list[int] = movie.get("genre_ids", [])

        keyword_ids: list[int] = []
        try:
            kw_r = await self._client.get(
                f"{TMDB_BASE}/movie/{tmdb_id}/keywords", params=self._params()
            )
            kw_r.raise_for_status()
            keyword_ids = [k["id"] for k in kw_r.json().get("keywords", [])[:8]]
        except Exception:
            pass

        return {"tmdb_id": tmdb_id, "genre_ids": genre_ids, "keyword_ids": keyword_ids}

    # ── Real-time movie discovery ──────────────────────────────────────────

    async def discover_movies(
        self,
        genre_ids: list[int] = [],
        keyword_ids: list[int] = [],
        language_code: Optional[str] = None,
        page: int = 1,
        min_votes: int = 50,
        date_gte: Optional[str] = None,   # "YYYY-MM-DD"
        date_lte: Optional[str] = None,   # "YYYY-MM-DD"
    ) -> list[dict]:
        """Discover movies via TMDB /discover/movie (always current data)."""
        params: dict = {
            "sort_by": "popularity.desc",
            "vote_count.gte": min_votes,
            "include_adult": False,
            "page": page,
        }
        if genre_ids:
            # | = OR so movies with ANY of these genres are included
            params["with_genres"] = "|".join(str(g) for g in genre_ids)
        if keyword_ids:
            params["with_keywords"] = "|".join(str(k) for k in keyword_ids)
        if language_code:
            params["with_original_language"] = language_code
        if date_gte:
            params["primary_release_date.gte"] = date_gte
        if date_lte:
            params["primary_release_date.lte"] = date_lte

        r = await self._client.get(
            f"{TMDB_BASE}/discover/movie", params=self._params(**params)
        )
        r.raise_for_status()
        return [
            self._format_discover(m)
            for m in r.json().get("results", [])
            if m.get("title")
        ]

    def _format_discover(self, m: dict) -> dict:
        gids = m.get("genre_ids", [])
        genre_str = ", ".join(
            TMDB_GENRES[gid] for gid in gids[:3] if gid in TMDB_GENRES
        )
        return {
            "tmdb_id": m["id"],
            "title": m.get("title", ""),
            "year": (m.get("release_date") or "")[:4],
            "overview": m.get("overview", "")[:300],
            "genre_ids": gids,
            "genre": genre_str,
            "original_language": m.get("original_language", ""),
            "vote_average": m.get("vote_average", 0.0),
            "vote_count": m.get("vote_count", 0),
            "popularity": m.get("popularity", 0.0),
            "poster_url": f"{IMG_BASE}/w500{m['poster_path']}" if m.get("poster_path") else None,
            "backdrop_url": f"{IMG_BASE}/w1280{m['backdrop_path']}" if m.get("backdrop_path") else None,
        }

    # ── Top-rated discovery for swipe game ────────────────────────────────────

    async def get_top_rated(
        self,
        language_code: Optional[str] = None,
        page: int = 1,
        exclude_languages: Optional[list[str]] = None,
        min_votes: int = 300,
    ) -> list[dict]:
        """Top-rated movies by vote_average for the swipe game (no genre/keyword filter)."""
        params: dict = {
            "sort_by": "vote_average.desc",
            "vote_count.gte": min_votes,
            "include_adult": False,
            "page": page,
        }
        if language_code:
            params["with_original_language"] = language_code

        r = await self._client.get(
            f"{TMDB_BASE}/discover/movie", params=self._params(**params)
        )
        r.raise_for_status()
        movies = [
            self._format_discover(m)
            for m in r.json().get("results", [])
            if m.get("title")
        ]

        if exclude_languages:
            movies = [m for m in movies if m["original_language"] not in exclude_languages]

        return movies

    # ── Streaming providers (lightweight — no extra detail call needed) ─────

    async def enrich_with_streaming(self, tmdb_id: int) -> list[dict]:
        """Fetch streaming providers for a TMDB movie ID."""
        try:
            r = await self._client.get(
                f"{TMDB_BASE}/movie/{tmdb_id}/watch/providers", params=self._params()
            )
            r.raise_for_status()
            region_data = r.json().get("results", {}).get(self.region, {})
            return [
                {
                    "name": p["provider_name"],
                    "logo_url": f"{IMG_BASE}/w45{p['logo_path']}" if p.get("logo_path") else None,
                }
                for p in region_data.get("flatrate", [])[:4]
            ]
        except Exception:
            return []

    # ── Legacy: kept for get_movie_details_by_title callers ───────────────

    async def get_movie_details_by_title(self, title: str, year: Optional[str] = None) -> dict:
        params: dict = {"query": title, "include_adult": False}
        if year:
            params["year"] = year
        r = await self._client.get(
            f"{TMDB_BASE}/search/movie", params=self._params(**params)
        )
        r.raise_for_status()
        results = r.json().get("results", [])
        if not results:
            return {}
        return await self._enrich(results[0])

    async def _enrich(self, movie: dict) -> dict:
        tmdb_id = movie["id"]
        poster = f"{IMG_BASE}/w500{movie['poster_path']}" if movie.get("poster_path") else None
        backdrop = f"{IMG_BASE}/w1280{movie['backdrop_path']}" if movie.get("backdrop_path") else None

        genres = []
        streaming = []
        try:
            det_r = await self._client.get(
                f"{TMDB_BASE}/movie/{tmdb_id}", params=self._params()
            )
            det_r.raise_for_status()
            det = det_r.json()
            genres = [g["name"] for g in det.get("genres", [])]

            prov_r = await self._client.get(
                f"{TMDB_BASE}/movie/{tmdb_id}/watch/providers", params=self._params()
            )
            prov_r.raise_for_status()
            region_data = prov_r.json().get("results", {}).get(self.region, {})
            flatrate = region_data.get("flatrate", [])
            streaming = [
                {
                    "name": p["provider_name"],
                    "logo_url": f"{IMG_BASE}/w45{p['logo_path']}" if p.get("logo_path") else None,
                }
                for p in flatrate[:4]
            ]
        except Exception:
            pass

        return {
            "tmdb_id": tmdb_id,
            "poster_url": poster,
            "backdrop_url": backdrop,
            "genre": ", ".join(genres[:3]),
            "streaming": streaming,
            "year": (movie.get("release_date") or "")[:4],
            "original_language": movie.get("original_language", ""),
        }
