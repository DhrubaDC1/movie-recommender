import type { RecommendResponse, TMDBSearchResult, GameMovie } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function getGameMovies(languages: string[] = [], page = 1, adultCerts: string[] = []): Promise<GameMovie[]> {
  const params = new URLSearchParams();
  languages.forEach((l) => params.append("language", l));
  adultCerts.forEach((c) => params.append("adult_cert", c));
  params.set("page", String(page));
  const res = await fetch(`${API}/game/movies?${params}`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

export async function searchMovies(query: string, adult = false): Promise<TMDBSearchResult[]> {
  if (query.trim().length < 2) return [];
  const params = new URLSearchParams({ q: query });
  if (adult) params.set("adult", "true");
  const res = await fetch(`${API}/search-movies?${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getRecommendations(
  liked: string[],
  disliked: string[],
  numResults = 5,
  sessionId?: string,
  signal?: AbortSignal,
  languages: string[] = [],
  era = "",
  adultCerts: string[] = [],
): Promise<RecommendResponse> {
  const res = await fetch(`${API}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ liked, disliked, num_results: numResults, session_id: sessionId, languages, era, adult_certs: adultCerts }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to fetch recommendations");
  }
  return res.json();
}
