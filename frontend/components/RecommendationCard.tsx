"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { Recommendation } from "@/lib/types";
import StreamingBadge from "./StreamingBadge";

interface Props {
  rec: Recommendation;
  index: number;
  onView?: () => void;
}

export default function RecommendationCard({ rec, index, onView }: Props) {
  const genres = rec.genre ? rec.genre.split(",").map((g) => g.trim()) : [];
  const cardRef = useRef<HTMLElement>(null);
  const viewFired = useRef(false);

  useEffect(() => {
    if (!onView || !cardRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !viewFired.current) {
          viewFired.current = true;
          onView();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [onView]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.12, ease: "easeOut" }}
      ref={cardRef as React.Ref<HTMLDivElement>}
      whileHover={{ y: -4 }}
      className="relative flex gap-5 rounded-2xl overflow-hidden group cursor-default"
      style={{
        background: "rgba(14, 14, 26, 0.75)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.07)",
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(229,9,20,0.35)";
        e.currentTarget.style.boxShadow = "0 8px 40px rgba(229,9,20,0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Rank badge */}
      <div
        className="absolute top-4 left-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: "rgba(229,9,20,0.85)", color: "#fff" }}
      >
        {rec.rank}
      </div>

      {/* Poster */}
      <div className="flex-shrink-0 w-[120px] md:w-[160px]">
        {rec.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={rec.poster_url}
            alt={rec.title}
            className="w-full h-full object-cover"
            style={{ minHeight: "220px" }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-white/20 text-3xl"
            style={{ minHeight: "220px", background: "rgba(255,255,255,0.03)" }}
          >
            🎬
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 py-5 pr-5 flex flex-col justify-between gap-3">
        <div className="space-y-2">
          {/* Title + year */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-xl font-bold text-white leading-tight">{rec.title}</h3>
            {rec.year && (
              <span className="text-sm text-white/40 flex-shrink-0">{rec.year}</span>
            )}
          </div>

          {/* Genre tags */}
          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {genres.map((g) => (
                <span
                  key={g}
                  className="text-xs px-2.5 py-0.5 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    color: "rgba(255,255,255,0.5)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* IMDB rating */}
          {rec.imdb_rating && (
            <div className="flex items-center gap-1.5">
              <span style={{ color: "#f5c518" }} className="text-sm">★</span>
              <span className="text-sm font-semibold text-white/80">{rec.imdb_rating}</span>
              <span className="text-xs text-white/30">IMDB</span>
            </div>
          )}
        </div>

        {/* Explanation */}
        <div
          className="py-3 px-4 rounded-lg"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderLeft: "2px solid rgba(229,9,20,0.5)",
          }}
        >
          <p className="text-sm leading-relaxed italic text-white/65">{rec.explanation}</p>
        </div>

        {/* Streaming */}
        <StreamingBadge providers={rec.streaming} />
      </div>
    </motion.article>
  );
}
