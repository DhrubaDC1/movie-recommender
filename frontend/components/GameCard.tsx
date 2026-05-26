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
  };

  const exitTarget =
    exitDir === "right"
      ? { x: 700, rotate: 25, opacity: 0 }
      : exitDir === "left"
      ? { x: -700, rotate: -25, opacity: 0 }
      : exitDir === "up"
      ? { y: -500, opacity: 0 }
      : {};

  const dragEnabled = interactive && !exitDir;

  return (
    <motion.div
      style={{ x, rotate, cursor: dragEnabled ? "grab" : "default" }}
      drag={dragEnabled ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      onDragEnd={handleDragEnd}
      animate={exitDir ? exitTarget : {}}
      transition={exitDir ? { duration: 0.38, ease: "easeOut" } : {}}
      onAnimationComplete={() => {
        if (exitDir) {
          onAction(exitDir === "right" ? "liked" : exitDir === "left" ? "disliked" : "skip");
        }
      }}
      className="absolute inset-0 select-none"
    >
      {/* LIKE stamp */}
      <motion.div
        style={{ opacity: likedOpacity }}
        className="absolute top-9 left-7 z-20 pointer-events-none"
      >
        <div className="px-4 py-1.5 rounded-xl" style={{ border: "3px solid #22c55e", transform: "rotate(-18deg)" }}>
          <span className="text-xl font-black tracking-[0.15em] text-green-400">LIKE</span>
        </div>
      </motion.div>

      {/* NOPE stamp */}
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="absolute top-9 right-7 z-20 pointer-events-none"
      >
        <div className="px-4 py-1.5 rounded-xl" style={{ border: "3px solid #ef4444", transform: "rotate(18deg)" }}>
          <span className="text-xl font-black tracking-[0.15em] text-red-400">NOPE</span>
        </div>
      </motion.div>

      {/* Card — everything absolutely positioned so nothing shifts on image load */}
      <div
        className="absolute inset-0 rounded-2xl overflow-hidden"
        style={{
          background: "rgba(12, 12, 22, 0.98)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Poster — fills the entire card; text overlays on top */}
        <div className="absolute inset-0">
          {/* Shimmer shown until image resolves */}
          {!imgLoaded && !imgError && (
            <div
              className="absolute inset-0 animate-pulse"
              style={{
                background:
                  "linear-gradient(160deg, rgba(229,9,20,0.08) 0%, rgba(12,12,22,0.9) 100%)",
              }}
            />
          )}

          {movie.poster_url && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={movie.poster_url}
              alt={movie.title}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.25s" }}
              draggable={false}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          ) : (
            <PosterFallback title={movie.title} />
          )}
        </div>

        {/* Bottom gradient — always present so text is readable before image loads */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: "62%",
            background:
              "linear-gradient(to top, rgba(10,10,22,1) 0%, rgba(10,10,22,0.92) 45%, rgba(10,10,22,0.5) 72%, transparent 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Rating badge — top right, always visible */}
        <div
          className="absolute top-4 right-4 z-10 flex items-center gap-1 px-2.5 py-1 rounded-lg"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
        >
          <span style={{ color: "#f5c518" }} className="text-sm">★</span>
          <span className="text-sm font-bold text-white/90">
            {movie.vote_average?.toFixed(1)}
          </span>
        </div>

        {/* Info + buttons — absolutely pinned to the bottom, always full-height */}
        <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-5 pt-4 flex flex-col gap-2">
          <div>
            <h3 className="text-[1.35rem] font-bold text-white leading-tight">
              {movie.title}
            </h3>
            <p className="text-xs text-white/45 mt-0.5">
              {[movie.year, movie.genre].filter(Boolean).join(" · ")}
            </p>
            {movie.overview && (
              <p className="text-xs text-white/30 leading-relaxed mt-1.5 line-clamp-2">
                {movie.overview}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div
            className="flex items-center justify-center gap-5 mt-2"
            style={{ pointerEvents: interactive ? "auto" : "none" }}
          >
            <ActionButton
              onClick={() => triggerLeave("left")}
              color="rgba(239,68,68,0.88)"
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
              color="rgba(255,255,255,0.10)"
              hoverShadow="0 0 16px rgba(255,255,255,0.1)"
              label="Haven't watched"
              small
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L12 15M12 19v.01" />
              </svg>
            </ActionButton>

            <ActionButton
              onClick={() => triggerLeave("right")}
              color="rgba(34,197,94,0.88)"
              hoverShadow="0 0 20px rgba(34,197,94,0.4)"
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
      className="absolute inset-0 flex flex-col items-center justify-center gap-3"
      style={{
        background:
          "linear-gradient(160deg, rgba(229,9,20,0.15) 0%, rgba(10,10,26,0.98) 100%)",
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
  const size = small ? "w-11 h-11" : "w-16 h-16";
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.12, boxShadow: hoverShadow }}
      whileTap={{ scale: 0.92 }}
      title={label}
      aria-label={label}
      className={`${size} rounded-full flex items-center justify-center text-white`}
      style={{ background: color, border: "2px solid rgba(255,255,255,0.08)" }}
    >
      {children}
    </motion.button>
  );
}
