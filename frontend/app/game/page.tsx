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
          return [...rest, { ...top, skippedOnce: true }];
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
    <main className="h-svh flex flex-col bg-[#030308] selection:bg-[#e50914]/30 selection:text-white overflow-hidden">
      <HeroBackground />
      <NavBar onBack={() => router.push("/")} />

      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-4 pb-6 pt-2 overflow-hidden w-full">
        <AnimatePresence mode="wait">

          {/* ── Phase 1: Language Select ── */}
          {phase === "language-select" && (
            <motion.div
              key="lang-select"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md text-center px-4 select-none"
            >
              <p
                className="text-[10px] tracking-[0.4em] uppercase mb-3.5 font-black select-none"
                style={{ color: "var(--color-accent)" }}
              >
                CineSwipe
              </p>
              <h1 className="text-4xl font-extrabold text-gradient mb-4 leading-tight tracking-tight">
                Rate Movies,<br />Shape Your Taste
              </h1>
              <p className="text-xs md:text-sm text-white/50 mb-10 leading-relaxed max-w-xs mx-auto font-medium">
                Swipe through top-rated films. Every like and dislike feeds directly into your recommendation profile.{" "}
                {!user && (
                  <span className="text-white/30 block mt-2">Sign in to save your history.</span>
                )}
              </p>

              <p className="text-[10px] text-white/30 uppercase tracking-[0.25em] mb-4.5 font-bold select-none">
                Choose movie language
              </p>

              <div className="flex flex-wrap gap-2.5 justify-center mb-10">
                {LANGUAGE_OPTIONS.map((lang) => {
                  const active = selectedLangs.includes(lang);
                  return (
                    <motion.button
                      key={lang}
                      onClick={() => toggleLang(lang)}
                      whileTap={{ scale: 0.94 }}
                      className="px-5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, #e50914 0%, #b0060f 100%)"
                          : "rgba(255,255,255,0.03)",
                        border: active
                          ? "1px solid rgba(255,255,255,0.15)"
                          : "1px solid rgba(255,255,255,0.05)",
                        color: active ? "#fff" : "rgba(255,255,255,0.5)",
                        boxShadow: active ? "0 4px 15px rgba(229,9,20,0.3)" : "none",
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
                whileHover={selectedLangs.length > 0 ? { scale: 1.025 } : {}}
                whileTap={selectedLangs.length > 0 ? { scale: 0.975 } : {}}
                className="px-12 py-4 rounded-2xl text-xs font-extrabold tracking-[0.18em] uppercase text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer animate-pulse-glow"
                style={{
                  background:
                    selectedLangs.length > 0
                      ? "linear-gradient(135deg, #e50914 0%, #a3000b 100%)"
                      : "rgba(229,9,20,0.15)",
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
              className="w-full max-w-sm flex flex-col items-center justify-between h-full min-h-0 gap-3 md:gap-4 overflow-hidden"
            >
              {/* Stats row */}
              <div className="flex items-center gap-10 text-xs font-bold tracking-wider uppercase select-none bg-white/[0.02] border border-white/[0.04] px-6 py-2 rounded-full shadow-md flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[#22c55e] text-base animate-pulse">♥</span>
                  <span className="text-white/70">{likedCount}</span>
                </div>
                <span className="text-white/25 text-[10px]">{ratedCount} rated</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#ef4444] text-base">✕</span>
                  <span className="text-white/70">{dislikedCount}</span>
                </div>
              </div>

              {/* Card stack with responsive dynamic height */}
              <div className="relative w-full max-w-[340px] flex-1 min-h-0 my-1.5" style={{ height: "calc(100vh - 280px)", maxHeight: "420px" }}>
                {deck.slice(0, 3).map((movie, i) => i).reverse().map((i) => {
                  const movie = deck[i];
                  const isActive = i === 0;
                  const scale = i === 0 ? 1 : i === 1 ? 0.95 : 0.9;
                  const y = i === 0 ? 0 : i === 1 ? 16 : 32;
                  const rotateValue = i === 0 ? 0 : i === 1 ? 2.2 : -2.2;
                  const opacity = i === 0 ? 1 : i === 1 ? 0.75 : 0.45;
                  return (
                    <motion.div
                      key={movie.tmdb_id}
                      className="absolute inset-0"
                      style={{
                        zIndex: 10 - i,
                        transformOrigin: "bottom center",
                        pointerEvents: isActive ? "auto" : "none",
                      }}
                      animate={{ scale, y, opacity, rotate: rotateValue }}
                      transition={{ type: "spring", stiffness: 280, damping: 28 }}
                    >
                      <GameCard
                        ref={isActive ? cardRef : undefined}
                        movie={movie}
                        onAction={handleAction}
                        interactive={isActive}
                      />
                    </motion.div>
                  );
                })}

                {/* Loading spinner */}
                {!topCard && loadingMore && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full border-2 border-white/5 border-t-[#e50914] animate-spin" />
                  </div>
                )}
              </div>

              {/* Swipe hint */}
              <p className="text-[9px] font-bold text-white/20 text-center uppercase tracking-widest select-none flex-shrink-0">
                Drag right to like · Drag left to nope
              </p>

              {/* Guest note */}
              {!user && ratedCount > 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[10px] text-white/30 text-center font-semibold"
                >
                  ✦ Sign in to save ratings to your profile
                </motion.p>
              )}

              {/* End session */}
              <button
                onClick={() => ratedCount > 0 ? setPhase("done") : resetGame()}
                className="px-6 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase text-white/60 hover:text-white hover:bg-[#e50914] hover:border-transparent transition-all duration-300 border border-white/[0.08] cursor-pointer"
              >
                End Session
              </button>
            </motion.div>
          )}

          {/* ── Phase 3: Done ── */}
          {phase === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="text-center max-w-sm px-6 py-8 rounded-3xl glass-satin border border-white/[0.07]"
            >
              <div className="text-5xl mb-6 select-none animate-bounce">🎬</div>
              <h2 className="text-3xl font-extrabold text-gradient mb-4 tracking-tight">Nice taste!</h2>
              <p className="text-white/50 text-xs md:text-sm mb-3 leading-relaxed font-semibold select-none">
                You rated{" "}
                <span className="text-white font-extrabold">{ratedCount} films</span>
              </p>

              {/* Stats blocks */}
              <div className="flex items-center justify-center gap-6 mb-8 text-xs font-bold uppercase tracking-wider select-none bg-white/[0.02] border border-white/[0.04] py-3 px-5 rounded-2xl">
                <span className="flex items-center gap-2">
                  <span className="text-[#22c55e] text-base">♥</span>
                  <span className="text-white/70">{likedCount} liked</span>
                </span>
                <div className="w-[1px] h-4 bg-white/10" />
                <span className="flex items-center gap-2">
                  <span className="text-[#ef4444] text-base">✕</span>
                  <span className="text-white/70">{dislikedCount} passed</span>
                </span>
              </div>

              {user ? (
                <p className="text-[11px] text-white/30 mb-8 leading-relaxed font-medium">
                  Your taste profile has been automatically updated. These ratings will directly shape your recommendations.
                </p>
              ) : (
                <p className="text-[11px] text-white/30 mb-8 leading-relaxed font-medium">
                  Sign in to save these swipes permanently and unlock premium recommendations.
                </p>
              )}

              <div className="flex flex-col items-center gap-3">
                {likedCount > 0 && (
                  <motion.button
                    onClick={() => router.push("/")}
                    whileHover={{ scale: 1.025 }}
                    whileTap={{ scale: 0.975 }}
                    className="px-10 py-3.5 rounded-2xl text-xs font-extrabold tracking-widest uppercase text-white cursor-pointer shadow-lg"
                    style={{ 
                      background: "linear-gradient(135deg, #e50914 0%, #a3000b 100%)",
                      boxShadow: "0 4px 15px rgba(229,9,20,0.3)"
                    }}
                  >
                    Get Recommendations →
                  </motion.button>
                )}
                <button
                  onClick={resetGame}
                  className="px-10 py-3 rounded-2xl text-xs font-bold tracking-widest uppercase text-white/40 hover:text-white/70 hover:bg-white/5 transition-all duration-300 border border-white/[0.08] cursor-pointer"
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

