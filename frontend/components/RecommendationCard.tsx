"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Recommendation } from "@/lib/types";
import StreamingBadge from "./StreamingBadge";

function PosterFallback({ title }: { title: string }) {
  const initials = title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-2"
      style={{
        background: "linear-gradient(160deg, rgba(229,9,20,0.18) 0%, rgba(10,10,26,0.9) 100%)",
        minHeight: "240px",
      }}
    >
      <span className="text-4xl font-bold" style={{ color: "rgba(229,9,20,0.6)" }}>
        {initials}
      </span>
      <span className="text-[10px] text-white/20 text-center px-2 leading-tight">{title}</span>
    </div>
  );
}

export type FeedbackOpinion = "liked" | "disliked" | null;

interface Props {
  rec: Recommendation;
  index: number;
  onView?: () => void;
  feedback: FeedbackOpinion;
  onFeedback: (title: string, opinion: "liked" | "disliked") => void;
  saving?: boolean;
}

export default function RecommendationCard({
  rec,
  index,
  onView,
  feedback,
  onFeedback,
  saving,
}: Props) {
  const genres = rec.genre ? rec.genre.split(",").map((g) => g.trim()) : [];
  const cardRef = useRef<HTMLDivElement>(null);
  const viewFired = useRef(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

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

  const handleFeedback = (opinion: "liked" | "disliked") => {
    // Toggle off if already selected
    if (feedback === opinion) return;
    onFeedback(rec.title, opinion);
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.12, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      className="relative flex gap-5 rounded-2xl overflow-hidden group"
      style={{
        background: "rgba(14, 14, 26, 0.75)",
        backdropFilter: "blur(24px)",
        border: feedback
          ? feedback === "liked"
            ? "1px solid rgba(34,197,94,0.4)"
            : "1px solid rgba(239,68,68,0.4)"
          : "1px solid rgba(255,255,255,0.07)",
        transition: "border-color 0.3s, box-shadow 0.3s",
        boxShadow: feedback
          ? feedback === "liked"
            ? "0 8px 40px rgba(34,197,94,0.1)"
            : "0 8px 40px rgba(239,68,68,0.1)"
          : "none",
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
      <div className="flex-shrink-0 w-[130px] md:w-[175px] self-stretch overflow-hidden relative">
        {rec.poster_url && !imgError ? (
          <>
            {/* Shimmer shown until image finishes loading */}
            {!imgLoaded && (
              <div
                className="absolute inset-0 animate-pulse"
                style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)", minHeight: "240px" }}
              />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={rec.poster_url}
              alt={rec.title}
              className="w-full h-full object-cover"
              style={{ minHeight: "240px", opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s" }}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          </>
        ) : (
          <PosterFallback title={rec.title} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 py-5 pr-5 flex flex-col justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-xl font-bold text-white leading-tight">{rec.title}</h3>
            {rec.year && <span className="text-sm text-white/40 flex-shrink-0">{rec.year}</span>}
          </div>

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

          {rec.imdb_rating && (
            <div className="flex items-center gap-1.5">
              <span style={{ color: "#f5c518" }} className="text-sm">★</span>
              <span className="text-sm font-semibold text-white/80">{rec.imdb_rating}</span>
              <span className="text-xs text-white/30">IMDB</span>
            </div>
          )}
        </div>

        <div
          className="py-3 px-4 rounded-lg"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderLeft: "2px solid rgba(229,9,20,0.5)",
          }}
        >
          <p className="text-sm leading-relaxed italic text-white/65">{rec.explanation}</p>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <StreamingBadge providers={rec.streaming} />

          {/* 👍 / 👎 feedback buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-white/25 mr-1">Watched it?</span>
            <FeedbackButton
              emoji="👍"
              label="Loved it"
              active={feedback === "liked"}
              activeColor="rgba(34,197,94,0.85)"
              onClick={() => handleFeedback("liked")}
              disabled={saving}
            />
            <FeedbackButton
              emoji="👎"
              label="Didn't like it"
              active={feedback === "disliked"}
              activeColor="rgba(239,68,68,0.85)"
              onClick={() => handleFeedback("disliked")}
              disabled={saving}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FeedbackButton({
  emoji, label, active, activeColor, onClick, disabled,
}: {
  emoji: string;
  label: string;
  active: boolean;
  activeColor: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.15 } : {}}
      whileTap={!disabled ? { scale: 0.9 } : {}}
      title={label}
      className="w-9 h-9 rounded-full flex items-center justify-center text-base transition-all duration-200 disabled:opacity-50"
      style={{
        background: active ? activeColor : "rgba(255,255,255,0.07)",
        border: active ? "none" : "1px solid rgba(255,255,255,0.1)",
        boxShadow: active ? `0 0 16px ${activeColor}` : "none",
      }}
    >
      {emoji}
    </motion.button>
  );
}
