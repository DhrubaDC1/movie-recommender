"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
const LANGUAGE_OPTIONS = ["English", "Hindi", "Bangla", "Others"] as const;
const ERA_OPTIONS = [
  { label: "Latest", sub: "2022–now" },
  { label: "2010s",  sub: "2010–2019" },
  { label: "2000s",  sub: "2000–2009" },
  { label: "Classics", sub: "before 2000" },
] as const;

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [liked, setLiked] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [selectedEra, setSelectedEra] = useState<string>("");
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

  const toggleLang = (lang: string) => {
    setSelectedLangs((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const handleDiscover = async () => {
    if (liked.length === 0) {
      setError("Add at least one movie you love.");
      return;
    }
    setError(null);
    setLoading(true);
    logger.track("discover_click", { liked, disliked, languages: selectedLangs, era: selectedEra });
    await logger.flush();
    const params = new URLSearchParams();
    liked.forEach((m) => params.append("liked", m));
    disliked.forEach((m) => params.append("disliked", m));
    selectedLangs.forEach((l) => params.append("language", l));
    if (selectedEra) params.set("era", selectedEra);
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

            {/* Language selector */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-sm font-semibold tracking-wide text-white/80 uppercase">
                  Movie Language
                </h2>
                {selectedLangs.length > 0 && (
                  <button
                    onClick={() => setSelectedLangs([])}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((lang) => {
                  const active = selectedLangs.includes(lang);
                  return (
                    <motion.button
                      key={lang}
                      onClick={() => toggleLang(lang)}
                      whileTap={{ scale: 0.93 }}
                      className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, #e50914 0%, #b0060f 100%)"
                          : "rgba(255,255,255,0.06)",
                        border: active
                          ? "1px solid rgba(229,9,20,0.5)"
                          : "1px solid rgba(255,255,255,0.1)",
                        color: active ? "#fff" : "rgba(255,255,255,0.45)",
                        boxShadow: active ? "0 0 14px rgba(229,9,20,0.3)" : "none",
                      }}
                    >
                      {lang}
                    </motion.button>
                  );
                })}
              </div>
              <p className="text-[11px] text-white/20 mt-2">
                {selectedLangs.length === 0
                  ? "No filter — recommends from all languages"
                  : `Prioritising: ${selectedLangs.join(", ")}`}
              </p>
            </div>

            <div
              className="mb-6"
              style={{ height: "1px", background: "rgba(255,255,255,0.05)" }}
            />

            {/* Era selector */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-sm font-semibold tracking-wide text-white/80 uppercase">
                  Era
                </h2>
                {selectedEra && (
                  <button
                    onClick={() => setSelectedEra("")}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {ERA_OPTIONS.map(({ label, sub }) => {
                  const active = selectedEra === label;
                  return (
                    <motion.button
                      key={label}
                      onClick={() => setSelectedEra(active ? "" : label)}
                      whileTap={{ scale: 0.93 }}
                      className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, #e50914 0%, #b0060f 100%)"
                          : "rgba(255,255,255,0.06)",
                        border: active
                          ? "1px solid rgba(229,9,20,0.5)"
                          : "1px solid rgba(255,255,255,0.1)",
                        color: active ? "#fff" : "rgba(255,255,255,0.45)",
                        boxShadow: active ? "0 0 14px rgba(229,9,20,0.3)" : "none",
                      }}
                    >
                      {label}
                      <span style={{ fontSize: "10px", opacity: 0.65 }}>{sub}</span>
                    </motion.button>
                  );
                })}
              </div>
              <p className="text-[11px] text-white/20 mt-2">
                {selectedEra
                  ? `Searching ${selectedEra === "Latest" ? "recent releases" : selectedEra === "Classics" ? "films before 2000" : `films from the ${selectedEra}`}`
                  : "No filter — any release year"}
              </p>
            </div>

            <div
              className="mb-6"
              style={{ height: "1px", background: "rgba(255,255,255,0.05)" }}
            />

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

        {/* CineSwipe CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-6 w-full max-w-3xl"
        >
          <Link
            href="/game"
            className="flex items-center justify-between px-6 py-4 rounded-xl group transition-all duration-200"
            style={{
              background: "rgba(229,9,20,0.07)",
              border: "1px solid rgba(229,9,20,0.18)",
            }}
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl">🎬</span>
              <div>
                <p className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
                  CineSwipe — Rate movies, build your taste profile
                </p>
                <p className="text-xs text-white/30 mt-0.5">
                  Swipe through top-rated films · Your likes feed directly into recommendations
                </p>
              </div>
            </div>
            <span
              className="text-sm font-semibold flex-shrink-0 ml-4 group-hover:translate-x-1 transition-transform"
              style={{ color: "#e50914" }}
            >
              Play →
            </span>
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-6 text-xs text-white/20 text-center"
        >
          RAG pipeline · ChromaDB · Groq LLaMA · TMDB
        </motion.p>
      </div>
    </main>
  );
}
