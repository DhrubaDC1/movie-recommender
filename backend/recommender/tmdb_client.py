import httpx
from typing import Optional


TMDB_BASE = "https://api.themoviedb.org/3"
IMG_BASE = "https://image.tmdb.org/t/p"

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
        movie = results[0]
        return await self._enrich(movie)

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
        }
