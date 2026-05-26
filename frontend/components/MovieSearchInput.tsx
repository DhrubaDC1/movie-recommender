"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { searchMovies } from "@/lib/api";
import type { TMDBSearchResult } from "@/lib/types";

interface Props {
  placeholder: string;
  onSelect: (title: string) => void;
  disabled?: boolean;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function MovieSearchInput({ placeholder, onSelect, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDBSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    searchMovies(debouncedQuery).then((r) => {
      setResults(r);
      setOpen(r.length > 0);
      setLoading(false);
    });
  }, [debouncedQuery]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = useCallback(
    (title: string) => {
      onSelect(title);
      setQuery("");
      setResults([]);
      setOpen(false);
    },
    [onSelect]
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all duration-200 disabled:opacity-40"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim().length > 1) {
              handleSelect(query.trim());
            }
          }}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          </div>
        )}
      </div>

      {open && (
        <div
          className="absolute z-50 w-full mt-2 rounded-xl overflow-hidden shadow-2xl"
          style={{
            background: "rgba(12,12,22,0.97)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(20px)",
          }}
        >
          {results.map((r) => (
            <button
              key={r.tmdb_id}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
              onClick={() => handleSelect(r.title)}
            >
              {r.poster_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.poster_url}
                  alt={r.title}
                  className="w-8 h-12 object-cover rounded flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-12 rounded flex-shrink-0 bg-white/10 flex items-center justify-center text-white/30 text-xs">
                  ?
                </div>
              )}
              <div>
                <p className="text-sm text-white font-medium">{r.title}</p>
                {r.year && <p className="text-xs text-white/40">{r.year}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
