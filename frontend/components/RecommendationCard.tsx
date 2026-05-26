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
      className="w-full h-full flex flex-col items-center justify-center gap-2 select-none"
      style={{
        background: "linear-gradient(160deg, rgba(229,9,20,0.1) 0%, rgba(6,6,12,0.95) 100%)",
        minHeight: "240px",
      }}
    >
      <span className="text-3xl font-extrabold text-[#e50914]/50 tracking-wider">
        {initials}
      </span>
      <span className="text-[9px] font-bold text-white/20 text-center px-3 leading-tight tracking-wider uppercase">{title}</span>
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

  // Mouse move states for soft 3D rotation effect
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const box = card.getBoundingClientRect();
    const x = e.clientX - box.left - box.width / 2;
    const y = e.clientY - box.top - box.height / 2;
    
    // Cap rotation at a very subtle, premium 3 degrees
    setRotateX(-y / (box.height / 6));
    setRotateY(x / (box.width / 6));
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

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
    if (feedback === opinion) return;
    onFeedback(rec.title, opinion);
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 32 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        rotateX: rotateX,
        rotateY: rotateY,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      transition={{ 
        type: "spring",
        stiffness: 260,
        damping: 30,
        delay: index * 0.1,
      }}
      whileHover={{ 
        scale: 1.01,
        borderColor: feedback 
          ? feedback === "liked" 
            ? "rgba(34,197,94,0.45)" 
            : "rgba(239,68,68,0.45)"
          : "rgba(255, 255, 255, 0.15)",
        boxShadow: feedback
          ? feedback === "liked"
            ? "0 15px 40px -10px rgba(34,197,94,0.18), 0 4px 20px rgba(0,0,0,0.6)"
            : "0 15px 40px -10px rgba(239,68,68,0.18), 0 4px 20px rgba(0,0,0,0.6)"
          : "0 15px 45px -12px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.08)",
      }}
      className="relative flex flex-col sm:flex-row gap-5 rounded-3xl overflow-hidden group border"
      style={{
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%), rgba(7, 7, 15, 0.65)",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
        borderColor: feedback
          ? feedback === "liked"
            ? "rgba(34,197,94,0.3)"
            : "rgba(239,68,68,0.3)"
          : "rgba(255,255,255,0.06)",
        boxShadow: feedback
          ? feedback === "liked"
            ? "0 10px 35px -10px rgba(34,197,94,0.12), inset 0 1px 1px rgba(255,255,255,0.08)"
            : "0 10px 35px -10px rgba(239,68,68,0.12), inset 0 1px 1px rgba(255,255,255,0.08)"
          : "0 10px 30px -10px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255,255,255,0.08)",
        transformStyle: "preserve-3d",
        perspective: 1000,
        transition: "border-color 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Rank badge */}
      <div
        className="absolute top-4 left-4 z-20 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg border border-white/[0.08] select-none"
        style={{ 
          background: "linear-gradient(135deg, #e50914 0%, #a3000b 100%)", 
          color: "#fff",
          boxShadow: "0 4px 12px rgba(229,9,20,0.4)"
        }}
      >
        {rec.rank}
      </div>

      {/* Poster wrapper */}
      <div 
        className="flex-shrink-0 w-full sm:w-[150px] md:w-[185px] self-stretch overflow-hidden relative min-h-[220px] sm:min-h-0 border-b sm:border-b-0 sm:border-r"
        style={{ borderColor: "rgba(255, 255, 255, 0.05)" }}
      >
        {rec.poster_url && !imgError ? (
          <>
            {/* Shimmer */}
            {!imgLoaded && (
              <div
                className="absolute inset-0 animate-pulse bg-gradient-to-r from-white/[0.02] via-white/[0.06] to-white/[0.02]"
                style={{ minHeight: "240px" }}
              />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={rec.poster_url}
              alt={rec.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-[0.16,1,0.3,1] select-none"
              style={{ 
                minHeight: "240px", 
                opacity: imgLoaded ? 1 : 0, 
                transition: "opacity 0.4s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)" 
              }}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
            {/* Ambient vignette overlay on the poster itself */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          </>
        ) : (
          <PosterFallback title={rec.title} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-5 md:py-6 md:pr-6 flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h3 className="text-lg md:text-xl font-extrabold text-white leading-snug tracking-tight">{rec.title}</h3>
            {rec.year && <span className="text-xs font-bold text-white/35 bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.03]">{rec.year}</span>}
          </div>

          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {genres.map((g) => (
                <span
                  key={g}
                  className="text-[10px] font-bold px-2.5 py-0.75 rounded-md tracking-wider uppercase select-none"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    color: "rgba(255,255,255,0.45)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {rec.imdb_rating && (
            <div className="flex items-center gap-1.5 select-none">
              <span style={{ color: "#f5c518" }} className="text-xs">★</span>
              <span className="text-xs font-bold text-white/80">{rec.imdb_rating}</span>
              <span className="text-[9px] font-extrabold text-[#f5c518]/70 border border-[#f5c518]/20 px-1.5 py-0.25 rounded bg-[#f5c518]/5 tracking-widest uppercase">IMDB</span>
            </div>
          )}
        </div>

        {/* AI Explanation Box */}
        <div
          className="py-3.5 px-4.5 rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderLeft: "3px solid #e50914",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.15)",
          }}
        >
          <p className="text-xs md:text-sm leading-relaxed italic text-white/60 font-medium">{rec.explanation}</p>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3.5 pt-1">
          <StreamingBadge providers={rec.streaming} />

          {/* 👍 / 👎 feedback buttons */}
          <div className="flex items-center gap-2 flex-shrink-0 select-none">
            <span className="text-[10px] font-bold tracking-wider text-white/20 uppercase mr-1">Watched it?</span>
            <FeedbackButton
              emoji="👍"
              label="Loved it"
              active={feedback === "liked"}
              activeColor="linear-gradient(135deg, #22c55e 0%, #15803d 100%)"
              glowColor="rgba(34,197,94,0.3)"
              borderColor="rgba(34,197,94,0.3)"
              onClick={() => handleFeedback("liked")}
              disabled={saving}
            />
            <FeedbackButton
              emoji="👎"
              label="Didn't like it"
              active={feedback === "disliked"}
              activeColor="linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
              glowColor="rgba(239,68,68,0.3)"
              borderColor="rgba(239,68,68,0.3)"
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
  emoji, label, active, activeColor, glowColor, borderColor, onClick, disabled,
}: {
  emoji: string;
  label: string;
  active: boolean;
  activeColor: string;
  glowColor: string;
  borderColor: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.12, y: -1 } : {}}
      whileTap={!disabled ? { scale: 0.92 } : {}}
      title={label}
      className="w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all duration-300 disabled:opacity-40 cursor-pointer"
      style={{
        background: active ? activeColor : "rgba(255,255,255,0.03)",
        border: active ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.05)",
        boxShadow: active ? `0 4px 15px ${glowColor}` : "none",
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) {
          e.currentTarget.style.borderColor = borderColor;
          e.currentTarget.style.boxShadow = `0 0 10px ${glowColor}`;
          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active && !disabled) {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)";
        }
      }}
    >
      {emoji}
    </motion.button>
  );
}
