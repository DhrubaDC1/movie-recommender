"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-xl px-4.5 py-3.5 text-sm text-white placeholder-white/20 outline-none transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.2)",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "rgba(229, 9, 20, 0.6)";
            e.target.style.boxShadow = "0 0 15px rgba(229, 9, 20, 0.2), inset 0 2px 4px rgba(0, 0, 0, 0.2)";
            e.target.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
            if (results.length > 0) setOpen(true);
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "rgba(255, 255, 255, 0.06)";
            e.target.style.boxShadow = "inset 0 2px 4px rgba(0, 0, 0, 0.2)";
            e.target.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim().length > 1) {
              handleSelect(query.trim());
            }
          }}
        />
        {loading && (
          <div className="absolute right-4.5 top-1/2 -translate-y-1/2">
            <div className="w-4.5 h-4.5 rounded-full border-2 border-white/10 border-t-[#e50914] animate-spin" />
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute z-50 w-full mt-2.5 rounded-2xl overflow-hidden shadow-2xl glass-strong max-h-[320px] overflow-y-auto"
            style={{
              borderColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            {results.map((r) => (
              <button
                key={r.tmdb_id}
                className="w-full flex items-center gap-3 px-4.5 py-3 hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors text-left border-b border-white/[0.02] last:border-b-0 cursor-pointer"
                onClick={() => handleSelect(r.title)}
              >
                {r.poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.poster_url}
                    alt={r.title}
                    className="w-9 h-13 object-cover rounded-lg flex-shrink-0 border border-white/[0.05] shadow-md"
                  />
                ) : (
                  <div className="w-9 h-13 rounded-lg flex-shrink-0 bg-white/5 border border-white/[0.05] flex items-center justify-center text-white/20 text-[10px] font-bold">
                    FILM
                  </div>
                )}
                <div>
                  <p className="text-sm text-white font-semibold leading-tight">{r.title}</p>
                  {r.year && <p className="text-xs text-white/40 mt-1 font-medium">{r.year}</p>}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
