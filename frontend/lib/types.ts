export interface TMDBSearchResult {
  tmdb_id: number;
  title: string;
  year: string;
  poster_url: string | null;
}

export interface StreamingProvider {
  name: string;
  logo_url: string | null;
}

export interface Recommendation {
  rank: number;
  title: string;
  explanation: string;
  poster_url: string | null;
  backdrop_url: string | null;
  streaming: StreamingProvider[];
  year: string;
  genre: string;
  imdb_rating: number | null;
  original_language: string;
}

export interface RecommendResponse {
  recommendations: Recommendation[];
}
