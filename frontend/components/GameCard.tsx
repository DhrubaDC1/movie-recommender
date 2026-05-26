"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import type { GameMovie } from "@/lib/types";

export type GameAction = "liked" | "disliked" | "skip";

export interface GameCardHandle {
  triggerAction: (action: GameAction) => void;
}

interface Props {
  movie: GameMovie;
  onAction: (action: GameAction) => void;
}

const SWIPE_THRESHOLD = 110;

const GameCard = forwardRef<GameCardHandle, Props>(({ movie, onAction }, ref) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-22, 22]);
  const likedOpacity = useTransform(x, [40, SWIPE_THRESHOLD], [0, 1]);
  const nopeOpacity = useTransform(x, [-40, -SWIPE_THRESHOLD], [0, 1]);

  const [exitDir, setExitDir] = useState<"left" | "right" | "up" | null>(null);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const triggerLeave = (dir: "left" | "right" | "up") => {
    if (exitDir) return;
    setExitDir(dir);
  };

  useImperativeHandle(ref, () => ({
    triggerAction(action: GameAction) {
      if (action === "liked") triggerLeave("right");
      else if (action === "disliked") triggerLeave("left");
      else triggerLeave("up");
    },
  }));

  const handleDragEnd = (_: PointerEvent, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) triggerLeave("right");
    else if (info.offset.x < -SWIPE_THRESHOLD) triggerLeave("left");
    // below threshold: spring back (Framer Motion handles this automatically)
  };

  const exitTarget =
    exitDir === "right"
      ? { x: 700, rotate: 25, opacity: 0 }
      : exitDir === "left"
      ? { x: -700, rotate: -25, opacity: 0 }
      : exitDir === "up"
      ? { y: -500, opacity: 0 }
      : {};

  return (
    <motion.div
      style={{ x, rotate, zIndex: 10, cursor: exitDir ? "default" : "grab" }}
      drag={!exitDir ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      onDragEnd={handleDragEnd}
      animate={exitDir ? exitTarget : {}}
      transition={exitDir ? { duration: 0.38, ease: "easeOut" } : {}}
      onAnimationComplete={() => {
        if (exitDir) {
          onAction(
            exitDir === "right" ? "liked" : exitDir === "left" ? "disliked" : "skip"
          );
        }
      }}
      className="absolute inset-0 select-none"
    >
      {/* LIKE stamp */}
      <motion.div
        style={{ opacity: likedOpacity }}
        className="absolute top-9 left-7 z-20 pointer-events-none"
      >
        <div
          className="px-4 py-1.5 rounded-xl"
          style={{
            border: "3px solid #22c55e",
            transform: "rotate(-18deg)",
          }}
        >
          <span className="text-xl font-black tracking-[0.15em] text-green-400">LIKE</span>
        </div>
      </motion.div>

      {/* NOPE stamp */}
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="absolute top-9 right-7 z-20 pointer-events-none"
      >
        <div
          className="px-4 py-1.5 rounded-xl"
          style={{
            border: "3px solid #ef4444",
            transform: "rotate(18deg)",
          }}
        >
          <span className="text-xl font-black tracking-[0.15em] text-red-400">NOPE</span>
        </div>
      </motion.div>

      {/* Card body */}
      <div
        className="w-full h-full rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "rgba(12, 12, 22, 0.95)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Poster */}
        <div className="relative flex-1 overflow-hidden bg-black/40">
          {movie.poster_url && !imgError ? (
            <>
              {!imgLoaded && (
                <div
                  className="absolute inset-0 animate-pulse"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)",
                  }}
                />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={movie.poster_url}
                alt={movie.title}
                className="w-full h-full object-cover"
                style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s" }}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
            </>
          ) : (
            <PosterFallback title={movie.title} />
          )}

          {/* Rating badge top-right */}
          <div
            className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-lg"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
          >
            <span style={{ color: "#f5c518" }} className="text-sm">★</span>
            <span className="text-sm font-bold text-white/90">
              {movie.vote_average?.toFixed(1)}
            </span>
          </div>

          {/* Bottom gradient for readability */}
          <div
            className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
            style={{
              background: "linear-gradient(to top, rgba(12,12,22,0.98) 0%, transparent 100%)",
            }}
          />
        </div>

        {/* Info section */}
        <div className="px-5 pt-3 pb-2">
          <h3 className="text-xl font-bold text-white leading-tight truncate">{movie.title}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {movie.year && (
              <span className="text-xs text-white/40">{movie.year}</span>
            )}
            {movie.genre && (
              <>
                <span className="text-white/20 text-xs">·</span>
                <span className="text-xs text-white/40 truncate max-w-[200px]">{movie.genre}</span>
              </>
            )}
          </div>
          {movie.overview && (
            <p className="text-xs text-white/30 leading-relaxed mt-2 line-clamp-2">
              {movie.overview}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-5 px-5 pb-5 pt-2">
          <ActionButton
            onClick={() => triggerLeave("left")}
            color="rgba(239,68,68,0.9)"
            hoverShadow="0 0 20px rgba(239,68,68,0.4)"
            label="Disliked"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </ActionButton>

          <ActionButton
            onClick={() => triggerLeave("up")}
            color="rgba(255,255,255,0.12)"
            hoverShadow="0 0 16px rgba(255,255,255,0.1)"
            label="Haven't watched"
            small
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </ActionButton>

          <ActionButton
            onClick={() => triggerLeave("right")}
            color="rgba(34,197,94,0.9)"
            hoverShadow="0 0 20px rgba(34,197,94,0.4)"
            label="Liked"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </ActionButton>
        </div>
      </div>
    </motion.div>
  );
});

GameCard.displayName = "GameCard";
export default GameCard;

// ── Sub-components ──────────────────────────────────────────────────────────

function PosterFallback({ title }: { title: string }) {
  const initials = title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-3"
      style={{
        background:
          "linear-gradient(160deg, rgba(229,9,20,0.15) 0%, rgba(10,10,26,0.95) 100%)",
      }}
    >
      <span className="text-6xl font-black" style={{ color: "rgba(229,9,20,0.5)" }}>
        {initials}
      </span>
      <span className="text-xs text-white/20 text-center px-4">{title}</span>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  color,
  hoverShadow,
  label,
  small = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  color: string;
  hoverShadow: string;
  label: string;
  small?: boolean;
}) {
  const size = small ? "w-12 h-12" : "w-16 h-16";
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.12, boxShadow: hoverShadow }}
      whileTap={{ scale: 0.92 }}
      title={label}
      aria-label={label}
      className={`${size} rounded-full flex items-center justify-center text-white transition-colors duration-200`}
      style={{ background: color, border: "2px solid rgba(255,255,255,0.08)" }}
    >
      {children}
    </motion.button>
  );
}
