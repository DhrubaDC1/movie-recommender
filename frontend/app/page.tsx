"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import HeroBackground from "@/components/HeroBackground";
import MovieSearchInput from "@/components/MovieSearchInput";
import PreferenceTag from "@/components/PreferenceTag";
import NavBar from "@/components/NavBar";
import { logger } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserHistory } from "@/lib/auth";

const MAX_LIKED = 5;
const MAX_DISLIKED = 3;

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [liked, setLiked] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    logger.init();
    logger.track("page_view", { page: "home" });
  }, []);

  // Pre-populate preferences from history when user logs in
  useEffect(() => {
    if (!user || historyLoaded) return;
    setHistoryLoaded(true);
    fetchUserHistory().then(({ liked: hl, disliked: hd }) => {
      if (hl.length === 0 && hd.length === 0) return;
      setLiked((prev) => {
        const merged = [...new Set([...prev, ...hl])].slice(0, MAX_LIKED);
        return merged;
      });
      setDisliked((prev) => {
        const merged = [...new Set([...prev, ...hd])].slice(0, MAX_DISLIKED);
        return merged;
      });
    });
  }, [user, historyLoaded]);

  // Reset history flag so re-login re-populates
  useEffect(() => {
    if (!user) setHistoryLoaded(false);
  }, [user]);

  const addLiked = useCallback(
    (title: string) => {
      if (liked.length >= MAX_LIKED) return;
      if (!liked.includes(title) && !disliked.includes(title)) {
        setLiked((prev) => [...prev, title]);
        logger.track("movie_add_liked", { title, total_liked: liked.length + 1 });
      }
    },
    [liked, disliked]
  );

  const addDisliked = useCallback(
    (title: string) => {
      if (disliked.length >= MAX_DISLIKED) return;
      if (!liked.includes(title) && !disliked.includes(title)) {
        setDisliked((prev) => [...prev, title]);
        logger.track("movie_add_disliked", { title, total_disliked: disliked.length + 1 });
      }
    },
    [liked, disliked]
  );

  const handleDiscover = async () => {
    if (liked.length === 0) {
      setError("Add at least one movie you love.");
      return;
    }
    setError(null);
    setLoading(true);
    logger.track("discover_click", { liked, disliked });
    await logger.flush();
    const params = new URLSearchParams();
    liked.forEach((m) => params.append("liked", m));
    disliked.forEach((m) => params.append("disliked", m));
    params.append("session_id", logger.getSessionId());
    router.push(`/results?${params.toString()}`);
  };

  const canDiscover = liked.length > 0 && !loading;

  return (
    <main className="min-h-screen flex flex-col">
      <HeroBackground />
      <NavBar />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-16 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-10 max-w-2xl"
        >
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "#e50914" }}>
            Powered by LLM · RAG · ChromaDB
          </p>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-5 text-gradient">
            Your Perfect Film,<br />Algorithmically Discovered
          </h1>
          <p className="text-base text-white/50 leading-relaxed max-w-lg mx-auto">
            {user
              ? `Welcome back, ${user.username}. Your taste history is already loaded.`
              : "Tell us what you've loved and what missed the mark. Our AI finds your next obsession."}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="w-full max-w-3xl"
        >
          <div
            className="rounded-2xl p-6 md:p-8"
            style={{
              background: "rgba(10, 10, 20, 0.7)",
              backdropFilter: "blur(32px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {user && liked.length > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-white/30 mb-4 text-center"
              >
                Pre-filled from your watch history — edit freely
              </motion.p>
            )}

            <div className="grid md:grid-cols-2 gap-6 md:gap-8">
              {/* Liked */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-wide text-white/80 uppercase">
                    Movies I Love
                  </h2>
                  <span className="text-xs text-white/30">{liked.length}/{MAX_LIKED}</span>
                </div>
                <MovieSearchInput
                  placeholder="Search a film…"
                  onSelect={addLiked}
                  disabled={liked.length >= MAX_LIKED}
                />
                <div className="flex flex-wrap gap-2 min-h-[2rem]">
                  <AnimatePresence>
                    {liked.map((title) => (
                      <PreferenceTag
                        key={title}
                        title={title}
                        type="liked"
                        onRemove={() => {
                          setLiked((prev) => prev.filter((t) => t !== title));
                          logger.track("movie_remove_liked", { title });
                        }}
                      />
                    ))}
                  </AnimatePresence>
                  {liked.length === 0 && (
                    <p className="text-xs text-white/20 italic pt-1">
                      e.g. Inception, Parasite, Interstellar
                    </p>
                  )}
                </div>
              </div>

              {/* Disliked */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-wide text-white/80 uppercase">
                    Didn&apos;t Click With
                  </h2>
                  <span className="text-xs text-white/30">{disliked.length}/{MAX_DISLIKED}</span>
                </div>
                <MovieSearchInput
                  placeholder="Search a film…"
                  onSelect={addDisliked}
                  disabled={disliked.length >= MAX_DISLIKED}
                />
                <div className="flex flex-wrap gap-2 min-h-[2rem]">
                  <AnimatePresence>
                    {disliked.map((title) => (
                      <PreferenceTag
                        key={title}
                        title={title}
                        type="disliked"
                        onRemove={() => {
                          setDisliked((prev) => prev.filter((t) => t !== title));
                          logger.track("movie_remove_disliked", { title });
                        }}
                      />
                    ))}
                  </AnimatePresence>
                  {disliked.length === 0 && (
                    <p className="text-xs text-white/20 italic pt-1">
                      Optional — helps narrow it down
                    </p>
                  )}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 text-sm text-center"
                  style={{ color: "#fca5a5" }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="mt-6 flex justify-center">
              <motion.button
                onClick={handleDiscover}
                disabled={!canDiscover}
                whileHover={canDiscover ? { scale: 1.03 } : {}}
                whileTap={canDiscover ? { scale: 0.97 } : {}}
                className="relative px-10 py-3.5 rounded-full text-sm font-semibold tracking-wide text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed animate-pulse-glow"
                style={{
                  background: canDiscover
                    ? "linear-gradient(135deg, #e50914 0%, #b0060f 100%)"
                    : "rgba(229,9,20,0.3)",
                }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                    Finding your films…
                  </span>
                ) : (
                  "Discover My Films →"
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-8 text-xs text-white/20 text-center"
        >
          RAG pipeline · ChromaDB · Groq LLaMA · TMDB
        </motion.p>
      </div>
    </main>
  );
}
