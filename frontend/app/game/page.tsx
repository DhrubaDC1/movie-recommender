"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import HeroBackground from "@/components/HeroBackground";
import NavBar from "@/components/NavBar";
import GameCard, { type GameCardHandle, type GameAction } from "@/components/GameCard";
import { getGameMovies } from "@/lib/api";
import { submitFeedback } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";
import type { GameMovie } from "@/lib/types";

type Phase = "language-select" | "playing" | "done";
type DeckCard = GameMovie & { skippedOnce?: boolean };

const LANGUAGE_OPTIONS = ["English", "Hindi", "Bangla", "Others"] as const;
const FETCH_MORE_AT = 5; // fetch next batch when deck drops below this

export default function GamePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>("language-select");
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [deck, setDeck] = useState<DeckCard[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchPage, setFetchPage] = useState(1);
  const [likedCount, setLikedCount] = useState(0);
  const [dislikedCount, setDislikedCount] = useState(0);

  const cardRef = useRef<GameCardHandle>(null);
  const ratedCount = likedCount + dislikedCount;
  const topCard = deck[0] ?? null;

  // ── Language select ────────────────────────────────────────────────────────

  const toggleLang = (lang: string) => {
    setSelectedLangs((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  // ── Fetch movies ───────────────────────────────────────────────────────────

  const fetchBatch = useCallback(
    async (langs: string[], page: number) => {
      setLoadingMore(true);
      try {
        const movies = await getGameMovies(langs, page);
        setDeck((prev) => {
          const existingIds = new Set(prev.map((c) => c.tmdb_id));
          const fresh = movies.filter((m) => !existingIds.has(m.tmdb_id));
          return [...prev, ...fresh];
        });
      } finally {
        setLoadingMore(false);
      }
    },
    []
  );

  const startGame = async () => {
    logger.track("game_start", { languages: selectedLangs });
    setPhase("playing");
    setFetchPage(1);
    await fetchBatch(selectedLangs, 1);
  };

  // Fetch more when deck runs low
  useEffect(() => {
    if (phase !== "playing") return;
    if (deck.length < FETCH_MORE_AT && !loadingMore) {
      const next = fetchPage + 1;
      setFetchPage(next);
      fetchBatch(selectedLangs, next);
    }
    if (deck.length === 0 && !loadingMore && ratedCount > 0) {
      setPhase("done");
    }
  }, [deck.length, phase, loadingMore, fetchPage, selectedLangs, fetchBatch, ratedCount]);

  // ── Card action ────────────────────────────────────────────────────────────

  const handleAction = useCallback(
    (action: GameAction) => {
      setDeck((prev) => {
        if (!prev.length) return prev;
        const [top, ...rest] = prev;

        if (action === "skip") {
          return top.skippedOnce ? rest : [...rest, { ...top, skippedOnce: true }];
        }

        // liked / disliked — persist
        if (user) {
          submitFeedback(top.title, action, undefined, "swipe_game").catch(() => {});
        }
        logger.track("game_swipe", { title: top.title, action });

        if (action === "liked") setLikedCount((c) => c + 1);
        else setDislikedCount((c) => c + 1);

        return rest;
      });
    },
    [user]
  );

  const handleButtonAction = (action: GameAction) => {
    cardRef.current?.triggerAction(action);
    // Actual deck update happens in handleAction after the card exit animation
  };

  // ── Reset for "Play Again" ─────────────────────────────────────────────────

  const resetGame = () => {
    setDeck([]);
    setLikedCount(0);
    setDislikedCount(0);
    setFetchPage(1);
    setPhase("language-select");
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex flex-col overflow-hidden">
      <HeroBackground />
      <NavBar onBack={() => router.push("/")} />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-10 pt-2">
        <AnimatePresence mode="wait">

          {/* ── Phase 1: Language Select ── */}
          {phase === "language-select" && (
            <motion.div
              key="lang-select"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-sm text-center"
            >
              <p
                className="text-xs tracking-[0.35em] uppercase mb-3 font-semibold"
                style={{ color: "#e50914" }}
              >
                CineSwipe
              </p>
              <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-4 leading-tight">
                Rate Movies,<br />Shape Your Taste
              </h1>
              <p className="text-sm text-white/40 mb-10 leading-relaxed max-w-xs mx-auto">
                Swipe through top-rated films. Every like and dislike feeds your personalisation
                profile.{" "}
                {!user && (
                  <span className="text-white/25">Sign in to save your ratings.</span>
                )}
              </p>

              <p className="text-[11px] text-white/35 uppercase tracking-widest mb-4">
                Choose movie language
              </p>

              <div className="flex flex-wrap gap-3 justify-center mb-10">
                {LANGUAGE_OPTIONS.map((lang) => {
                  const active = selectedLangs.includes(lang);
                  return (
                    <motion.button
                      key={lang}
                      onClick={() => toggleLang(lang)}
                      whileTap={{ scale: 0.93 }}
                      className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-200"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, #e50914 0%, #b0060f 100%)"
                          : "rgba(255,255,255,0.06)",
                        border: active
                          ? "1px solid rgba(229,9,20,0.5)"
                          : "1px solid rgba(255,255,255,0.1)",
                        color: active ? "#fff" : "rgba(255,255,255,0.5)",
                        boxShadow: active ? "0 0 14px rgba(229,9,20,0.3)" : "none",
                      }}
                    >
                      {lang}
                    </motion.button>
                  );
                })}
              </div>

              <motion.button
                onClick={startGame}
                disabled={selectedLangs.length === 0}
                whileHover={selectedLangs.length > 0 ? { scale: 1.03 } : {}}
                whileTap={selectedLangs.length > 0 ? { scale: 0.97 } : {}}
                className="px-10 py-3.5 rounded-full text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed animate-pulse-glow"
                style={{
                  background:
                    selectedLangs.length > 0
                      ? "linear-gradient(135deg, #e50914 0%, #b0060f 100%)"
                      : "rgba(229,9,20,0.3)",
                }}
              >
                Start Swiping →
              </motion.button>
            </motion.div>
          )}

          {/* ── Phase 2: Playing ── */}
          {phase === "playing" && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-sm flex flex-col items-center gap-5"
            >
              {/* Stats row */}
              <div className="flex items-center gap-8 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-green-400/80 text-lg">♥</span>
                  <span className="text-white/60 font-semibold">{likedCount}</span>
                </div>
                <span className="text-white/20 text-xs">{ratedCount} rated</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-red-400/80 text-lg">✕</span>
                  <span className="text-white/60 font-semibold">{dislikedCount}</span>
                </div>
              </div>

              {/* Card stack */}
              <div className="relative w-full" style={{ height: 500 }}>
                {/* Ghost card 3 */}
                <AnimatePresence>
                  {deck[2] && (
                    <motion.div
                      key={`ghost2-${deck[2].tmdb_id}`}
                      className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
                      style={{ zIndex: 1, transformOrigin: "bottom center" }}
                      animate={{ scale: 0.88, y: 38, opacity: 0.45 }}
                      transition={{ type: "spring", stiffness: 280, damping: 28 }}
                    >
                      <GhostCard movie={deck[2]} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Ghost card 2 */}
                <AnimatePresence>
                  {deck[1] && (
                    <motion.div
                      key={`ghost1-${deck[1].tmdb_id}`}
                      className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
                      style={{ zIndex: 2, transformOrigin: "bottom center" }}
                      animate={{ scale: 0.94, y: 19, opacity: 0.7 }}
                      transition={{ type: "spring", stiffness: 280, damping: 28 }}
                    >
                      <GhostCard movie={deck[1]} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Active card */}
                <AnimatePresence>
                  {topCard && (
                    <motion.div
                      key={topCard.tmdb_id}
                      className="absolute inset-0"
                      style={{ zIndex: 10 }}
                      initial={{ scale: 0.93, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 26 }}
                    >
                      <GameCard
                        ref={cardRef}
                        movie={topCard}
                        onAction={handleAction}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Loading spinner when deck is empty and fetching */}
                {!topCard && loadingMore && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-red-500 animate-spin" />
                  </div>
                )}
              </div>

              {/* Swipe hint */}
              <p className="text-[11px] text-white/20 text-center">
                Drag right to like · Drag left to pass · or use buttons
              </p>

              {/* Guest note */}
              {!user && ratedCount > 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[11px] text-white/25 text-center"
                >
                  Sign in to save ratings to your taste profile
                </motion.p>
              )}
            </motion.div>
          )}

          {/* ── Phase 3: Done ── */}
          {phase === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.93 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="text-center max-w-sm px-4"
            >
              <div className="text-6xl mb-6">🎬</div>
              <h2 className="text-4xl font-bold text-gradient mb-4">Nice taste!</h2>
              <p className="text-white/50 text-sm mb-2 leading-relaxed">
                You rated{" "}
                <span className="text-white/80 font-semibold">{ratedCount} films</span>
              </p>
              <div className="flex items-center justify-center gap-6 mb-8 text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="text-green-400">♥</span>
                  <span className="text-green-400/80 font-semibold">{likedCount} liked</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-red-400">✕</span>
                  <span className="text-red-400/80 font-semibold">{dislikedCount} passed</span>
                </span>
              </div>

              {user ? (
                <p className="text-xs text-white/30 mb-8 leading-relaxed">
                  Your taste profile has been updated. These ratings will shape your next recommendations.
                </p>
              ) : (
                <p className="text-xs text-white/30 mb-8 leading-relaxed">
                  Sign in to save your ratings and unlock personalised recommendations.
                </p>
              )}

              <div className="flex flex-col items-center gap-3">
                {likedCount > 0 && (
                  <motion.button
                    onClick={() => router.push("/")}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-8 py-3 rounded-full text-sm font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, #e50914 0%, #b0060f 100%)" }}
                  >
                    Get Recommendations →
                  </motion.button>
                )}
                <button
                  onClick={resetGame}
                  className="px-8 py-2.5 rounded-full text-sm text-white/40 hover:text-white/70 transition-colors"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Play Again
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </main>
  );
}

// Simplified ghost card — just the poster, no interaction
function GhostCard({ movie }: { movie: GameMovie }) {
  return (
    <div
      className="w-full h-full rounded-2xl overflow-hidden"
      style={{
        background: "rgba(12, 12, 22, 0.9)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {movie.poster_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={movie.poster_url}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full"
          style={{
            background:
              "linear-gradient(160deg, rgba(229,9,20,0.1) 0%, rgba(10,10,26,0.95) 100%)",
          }}
        />
      )}
    </div>
  );
}
