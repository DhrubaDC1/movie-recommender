import type { RecommendResponse, TMDBSearchResult } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function searchMovies(query: string): Promise<TMDBSearchResult[]> {
  if (query.trim().length < 2) return [];
  const res = await fetch(`${API}/search-movies?q=${encodeURIComponent(query)}`);
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
): Promise<RecommendResponse> {
  const res = await fetch(`${API}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ liked, disliked, num_results: numResults, session_id: sessionId, languages }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to fetch recommendations");
  }
  return res.json();
}
