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
import { useAdultMode } from "@/contexts/AdultModeContext";
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
  const { adultMode, adultCerts } = useAdultMode();
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
    logger.track("discover_click", { liked, disliked, languages: selectedLangs, era: selectedEra, adult_certs: adultCerts });
    await logger.flush();
    const params = new URLSearchParams();
    liked.forEach((m) => params.append("liked", m));
    disliked.forEach((m) => params.append("disliked", m));
    selectedLangs.forEach((l) => params.append("language", l));
    if (selectedEra) params.set("era", selectedEra);
    adultCerts.forEach((c) => params.append("adult_cert", c));
    params.append("session_id", logger.getSessionId());
    router.push(`/results?${params.toString()}`);
  };

  const canDiscover = liked.length > 0 && !loading;

  return (
    <main className="h-svh flex flex-col bg-[#030308] selection:bg-[#e50914]/30 selection:text-white overflow-hidden">
      <HeroBackground />
      <NavBar />

      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-between px-4 pb-6 pt-2 overflow-hidden">
        {/* Header - Compact Spacing */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-xl select-none"
        >
          <p 
            className="text-[9px] tracking-[0.3em] uppercase mb-1.5 font-black" 
            style={{ color: "var(--color-accent)" }}
          >
            Powered by LLM · RAG · ChromaDB
          </p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight text-gradient tracking-tight mb-2">
            Your Perfect Film, Algorithmically Discovered
          </h1>
          <p className="text-xs text-white/40 leading-relaxed max-w-md mx-auto font-medium hidden sm:block">
            {user
              ? `Welcome back, ${user.username}. Your taste history has been automatically loaded.`
              : "Tell us what you've loved and what missed the mark. Our AI finds your next obsession."}
          </p>
        </motion.div>

        {/* Core Config Box - High Compression */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-3xl min-h-0 flex flex-col justify-center"
        >
          <div className="rounded-3xl p-4 md:p-6 glass-satin flex flex-col gap-3 md:gap-4 overflow-hidden max-h-full">
            {/* Language Selector - Horizontal Scroll on Mobile */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[10px] font-bold tracking-[0.15em] text-white/50 uppercase">
                  Language
                </h2>
                {selectedLangs.length > 0 && (
                  <button
                    onClick={() => setSelectedLangs([])}
                    className="text-[10px] font-semibold text-[#e50914] hover:text-[#ff3b45] transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="flex flex-row overflow-x-auto no-scrollbar gap-2 max-w-full pb-0.5">
                {LANGUAGE_OPTIONS.map((lang) => {
                  const active = selectedLangs.includes(lang);
                  return (
                    <motion.button
                      key={lang}
                      onClick={() => toggleLang(lang)}
                      whileTap={{ scale: 0.94 }}
                      className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-300 cursor-pointer flex-shrink-0"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, #e50914 0%, #b0060f 100%)"
                          : "rgba(255,255,255,0.02)",
                        border: active
                          ? "1px solid rgba(255,255,255,0.15)"
                          : "1px solid rgba(255,255,255,0.04)",
                        color: active ? "#fff" : "rgba(255,255,255,0.45)",
                        boxShadow: active ? "0 4px 10px rgba(229,9,20,0.25)" : "none",
                      }}
                    >
                      {lang}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Era Selector - Horizontal Scroll on Mobile */}
            <div>
              <div className="flex items-center justify-between mb-2 gap-3">
                <h2 className="text-[10px] font-bold tracking-[0.15em] text-white/50 uppercase">
                  Era
                </h2>
                {selectedEra && (
                  <button
                    onClick={() => setSelectedEra("")}
                    className="text-[10px] font-semibold text-[#e50914] hover:text-[#ff3b45] transition-colors cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="flex flex-row overflow-x-auto no-scrollbar gap-2 max-w-full pb-0.5">
                {ERA_OPTIONS.map(({ label, sub }) => {
                  const active = selectedEra === label;
                  return (
                    <motion.button
                      key={label}
                      onClick={() => setSelectedEra(active ? "" : label)}
                      whileTap={{ scale: 0.94 }}
                      className="px-4 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-300 flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, #e50914 0%, #b0060f 100%)"
                          : "rgba(255,255,255,0.02)",
                        border: active
                          ? "1px solid rgba(255,255,255,0.15)"
                          : "1px solid rgba(255,255,255,0.04)",
                        color: active ? "#fff" : "rgba(255,255,255,0.45)",
                        boxShadow: active ? "0 4px 10px rgba(229,9,20,0.25)" : "none",
                      }}
                    >
                      {label}
                      <span className="text-[9px] font-medium opacity-50">{sub}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div
              className="hidden md:block"
              style={{ height: "1px", background: "rgba(255,255,255,0.04)" }}
            />

            {/* Input Selection Columns - Side-by-Side on Desktop, tightly stacked on Mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden min-h-0">
              {/* Liked list - limited height */}
              <div className="flex flex-col min-h-0 overflow-hidden">
                <div className="flex items-center justify-between mb-1.5">
                  <h2 className="text-[10px] font-bold tracking-[0.15em] text-white/50 uppercase">
                    Loved Films
                  </h2>
                  <span className="text-[9px] font-bold text-white/35 bg-white/[0.02] px-1.5 py-0.25 rounded border border-white/[0.03]">
                    {liked.length}/{MAX_LIKED}
                  </span>
                </div>
                <MovieSearchInput
                  placeholder="Search a film…"
                  onSelect={addLiked}
                  disabled={liked.length >= MAX_LIKED}
                  adult={adultMode}
                />
                <div className="flex flex-wrap gap-1.5 mt-2 overflow-y-auto max-h-[75px] pr-1.5">
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
                    <p className="text-[10px] text-white/20 italic pt-1 pl-0.5 select-none font-semibold">
                      e.g. Inception, Parasite
                    </p>
                  )}
                </div>
              </div>

              {/* Disliked list - limited height */}
              <div className="flex flex-col min-h-0 overflow-hidden mt-1 md:mt-0">
                <div className="flex items-center justify-between mb-1.5">
                  <h2 className="text-[10px] font-bold tracking-[0.15em] text-white/50 uppercase">
                    Didn&apos;t Click With
                  </h2>
                  <span className="text-[9px] font-bold text-white/35 bg-white/[0.02] px-1.5 py-0.25 rounded border border-white/[0.03]">
                    {disliked.length}/{MAX_DISLIKED}
                  </span>
                </div>
                <MovieSearchInput
                  placeholder="Search a film…"
                  onSelect={addDisliked}
                  disabled={disliked.length >= MAX_DISLIKED}
                  adult={adultMode}
                />
                <div className="flex flex-wrap gap-1.5 mt-2 overflow-y-auto max-h-[75px] pr-1.5">
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
                    <p className="text-[10px] text-white/20 italic pt-1 pl-0.5 select-none font-semibold">
                      Optional — narrows matches
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
                  className="text-[10px] text-center font-bold tracking-wide uppercase"
                  style={{ color: "#fca5a5" }}
                >
                  ⚠ {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Discover Trigger Button */}
            <div className="mt-2.5 flex justify-center">
              <motion.button
                onClick={handleDiscover}
                disabled={!canDiscover}
                whileHover={canDiscover ? { scale: 1.025 } : {}}
                whileTap={canDiscover ? { scale: 0.975 } : {}}
                className="relative px-10 py-3 rounded-xl text-[10px] font-black tracking-[0.2em] uppercase text-white transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer animate-pulse-glow"
                style={{
                  background: canDiscover
                    ? "linear-gradient(135deg, var(--color-accent) 0%, rgba(229,9,20,0.65) 100%)"
                    : "rgba(255,255,255,0.03)",
                  boxShadow: canDiscover ? "0 4px 15px var(--color-accent-glow)" : "none",
                }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin inline-block" />
                    Finding your films…
                  </span>
                ) : (
                  "Discover My Films →"
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* CineSwipe compact CTA link */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="w-full max-w-3xl mt-3 md:mt-4 select-none"
        >
          <Link
            href="/game"
            className="flex items-center justify-between px-5 py-3.5 rounded-2xl group transition-all duration-300 border backdrop-blur-md cursor-pointer"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)",
              borderColor: "var(--color-border)",
              boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--color-accent)";
              e.currentTarget.style.boxShadow = "0 6px 22px var(--color-accent-glow)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.15)";
            }}
          >
            <div className="flex items-center gap-3.5">
              <span className="text-xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">🎬</span>
              <div>
                <p className="text-xs font-bold text-white/95">
                  CineSwipe — Rate movies, shape your taste profile
                </p>
                <p className="text-[10px] text-white/30 mt-0.5 font-medium hidden sm:block">
                  Swipe through top-rated films · Likes feed directly into future recommendations
                </p>
              </div>
            </div>
            <span
              className="text-[10px] font-extrabold tracking-widest uppercase flex-shrink-0 ml-4 group-hover:translate-x-1.5 transition-transform duration-300"
              style={{ color: "var(--color-accent)" }}
            >
              Play →
            </span>
          </Link>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-[9px] text-white/20 text-center tracking-widest uppercase font-bold select-none mt-3"
        >
          RAG pipeline · ChromaDB · Groq LLaMA · TMDB
        </motion.p>
      </div>

    </main>
  );
}
