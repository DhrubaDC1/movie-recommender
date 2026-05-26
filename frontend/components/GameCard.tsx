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
  interactive?: boolean;
}

const SWIPE_THRESHOLD = 110;

const GameCard = forwardRef<GameCardHandle, Props>(({ movie, onAction, interactive = true }, ref) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-15, 15]);
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
  };

  const exitTarget =
    exitDir === "right"
      ? { x: 700, rotate: 20, opacity: 0 }
      : exitDir === "left"
      ? { x: -700, rotate: -20, opacity: 0 }
      : exitDir === "up"
      ? { y: -500, opacity: 0 }
      : {};

  const dragEnabled = interactive && !exitDir;

  return (
    <motion.div
      style={{ x, rotate, cursor: dragEnabled ? "grab" : "default" }}
      drag={dragEnabled ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
      animate={exitDir ? exitTarget : {}}
      transition={exitDir ? { duration: 0.35, ease: "easeOut" } : {}}
      onAnimationComplete={() => {
        if (exitDir) {
          onAction(exitDir === "right" ? "liked" : exitDir === "left" ? "disliked" : "skip");
        }
      }}
      className="absolute inset-0 select-none touch-none"
    >
      {/* LIKE stamp */}
      <motion.div
        style={{ opacity: likedOpacity }}
        className="absolute top-10 left-8 z-30 pointer-events-none"
      >
        <div 
          className="px-5 py-2.5 rounded-2xl border-4 select-none shadow-2xl" 
          style={{ 
            borderColor: "#22c55e", 
            transform: "rotate(-14deg)",
            boxShadow: "0 0 25px rgba(34,197,94,0.35)",
            background: "rgba(4, 120, 87, 0.2)",
          }}
        >
          <span className="text-2xl font-black tracking-[0.2em] text-[#22c55e]">LIKE</span>
        </div>
      </motion.div>

      {/* NOPE stamp */}
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="absolute top-10 right-8 z-30 pointer-events-none"
      >
        <div 
          className="px-5 py-2.5 rounded-2xl border-4 select-none shadow-2xl" 
          style={{ 
            borderColor: "#ef4444", 
            transform: "rotate(14deg)",
            boxShadow: "0 0 25px rgba(239,68,68,0.35)",
            background: "rgba(185, 28, 28, 0.2)",
          }}
        >
          <span className="text-2xl font-black tracking-[0.2em] text-[#ef4444]">NOPE</span>
        </div>
      </motion.div>

      {/* Card Wrapper */}
      <div
        className="absolute inset-0 rounded-3xl overflow-hidden border backdrop-filter backdrop-blur-md"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.002) 100%), rgba(7,7,15,0.85)",
          borderColor: "rgba(255, 255, 255, 0.08)",
          boxShadow: "0 30px 70px rgba(0,0,0,0.85), inset 0 1px 1px rgba(255,255,255,0.08)",
        }}
      >
        {/* Poster */}
        <div className="absolute inset-0">
          {!imgLoaded && !imgError && (
            <div
              className="absolute inset-0 animate-pulse"
              style={{
                background: "linear-gradient(160deg, rgba(229,9,20,0.08) 0%, rgba(6,6,12,0.95) 100%)",
              }}
            />
          )}

          {movie.poster_url && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={movie.poster_url}
              alt={movie.title}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s" }}
              draggable={false}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          ) : (
            <PosterFallback title={movie.title} />
          )}
        </div>

        {/* Bottom gradient mask */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: "65%",
            background: "linear-gradient(to top, #06060c 0%, rgba(6,6,12,0.95) 45%, rgba(6,6,12,0.55) 75%, transparent 100%)",
          }}
        />

        {/* Rating badge */}
        <div
          className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded-xl shadow-lg border border-white/[0.05]"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)" }}
        >
          <span style={{ color: "#f5c518" }} className="text-xs">★</span>
          <span className="text-xs font-bold text-white/90">
            {movie.vote_average?.toFixed(1)}
          </span>
        </div>

        {/* Info + buttons */}
        <div className="absolute inset-x-0 bottom-0 z-20 px-6 pb-6 pt-4 flex flex-col gap-4">
          <div className="space-y-1.5">
            <h3 className="text-xl md:text-2xl font-extrabold text-white leading-tight tracking-tight">
              {movie.title}
            </h3>
            <p className="text-xs font-bold text-white/40 tracking-wide uppercase">
              {[movie.year, movie.genre].filter(Boolean).join(" · ")}
            </p>
            {movie.overview && (
              <p className="text-xs leading-relaxed text-white/50 line-clamp-3 font-medium">
                {movie.overview}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div
            className="flex items-center justify-center gap-5 mt-2 select-none"
            style={{ pointerEvents: interactive ? "auto" : "none" }}
          >
            {/* Dislike Action */}
            <ActionButton
              onClick={() => triggerLeave("left")}
              color="linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
              hoverShadow="0 4px 18px rgba(239,68,68,0.3)"
              borderColor="rgba(239,68,68,0.4)"
              label="Disliked"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </ActionButton>

            {/* Skip Action */}
            <ActionButton
              onClick={() => triggerLeave("up")}
              color="rgba(255,255,255,0.05)"
              hoverShadow="0 4px 12px rgba(255,255,255,0.08)"
              borderColor="rgba(255,255,255,0.15)"
              label="Haven't watched"
              small
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L12 15M12 19v.01" />
              </svg>
            </ActionButton>

            {/* Like Action */}
            <ActionButton
              onClick={() => triggerLeave("right")}
              color="linear-gradient(135deg, #22c55e 0%, #15803d 100%)"
              hoverShadow="0 4px 18px rgba(34,197,94,0.3)"
              borderColor="rgba(34,197,94,0.4)"
              label="Liked"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </ActionButton>
          </div>
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
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 select-none"
      style={{
        background: "linear-gradient(160deg, rgba(229,9,20,0.1) 0%, rgba(6,6,12,0.98) 100%)",
      }}
    >
      <span className="text-5xl font-black text-[#e50914]/40 tracking-wider">
        {initials}
      </span>
      <span className="text-[10px] font-bold text-white/20 tracking-wider uppercase text-center px-4">{title}</span>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  color,
  hoverShadow,
  borderColor,
  label,
  small = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  color: string;
  hoverShadow: string;
  borderColor: string;
  label: string;
  small?: boolean;
}) {
  const size = small ? "w-11 h-11" : "w-16 h-16";
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.1, boxShadow: hoverShadow, borderColor: borderColor }}
      whileTap={{ scale: 0.92 }}
      title={label}
      aria-label={label}
      className={`${size} rounded-full flex items-center justify-center text-white border transition-all duration-300 cursor-pointer shadow-md`}
      style={{ background: color, borderColor: "rgba(255,255,255,0.06)" }}
    >
      {children}
    </motion.button>
  );
}
