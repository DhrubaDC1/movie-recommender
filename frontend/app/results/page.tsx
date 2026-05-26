"use client";

import { useEffect, useState, useCallback, Suspense, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getRecommendations } from "@/lib/api";
import { submitFeedback } from "@/lib/auth";
import type { Recommendation } from "@/lib/types";
import type { FeedbackOpinion } from "@/components/RecommendationCard";
import HeroBackground from "@/components/HeroBackground";
import NavBar from "@/components/NavBar";
import RecommendationCard from "@/components/RecommendationCard";
import RediscoverButton from "@/components/RediscoverButton";
import { logger } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";

type State = "loading" | "success" | "error";

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [state, setState] = useState<State>("loading");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // feedback[title] = 'liked' | 'disliked' | null
  const [feedback, setFeedback] = useState<Record<string, FeedbackOpinion>>({});
  const [savingTitle, setSavingTitle] = useState<string | null>(null);
  const [rediscovering, setRediscovering] = useState(false);

  // Memoize to stable references — searchParams.getAll() returns a new array every render
  const liked = useMemo(() => searchParams.getAll("liked"), [searchParams]);
  const disliked = useMemo(() => searchParams.getAll("disliked"), [searchParams]);
  const languages = useMemo(() => searchParams.getAll("language"), [searchParams]);
  const era = searchParams.get("era") ?? "";
  const sessionId = searchParams.get("session_id") ?? undefined;

  // Track extra liked/disliked injected across rediscovery rounds
  const extraLikedRef = useRef<string[]>([]);
  const extraDislikedRef = useRef<string[]>([]);

  useEffect(() => {
    logger.init();
    logger.track("page_view", { page: "results", liked, disliked });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRecs = useCallback(
    async (extraLiked: string[] = [], extraDisliked: string[] = [], signal?: AbortSignal) => {
      if (liked.length === 0) {
        router.push("/");
        return;
      }
      setState("loading");
      const t0 = performance.now();
      try {
        const allLiked = [...new Set([...liked, ...extraLiked])];
        const allDisliked = [...new Set([...disliked, ...extraDisliked])];
        const data = await getRecommendations(allLiked, allDisliked, 5, sessionId, signal, languages, era);
        const latencyMs = Math.round(performance.now() - t0);
        setRecommendations(data.recommendations);
        setFeedback({});
        setState("success");
        logger.track("recommendations_received", {
          liked: allLiked,
          disliked: allDisliked,
          latency_ms: latencyMs,
          is_rediscovery: extraLiked.length > 0 || extraDisliked.length > 0,
          results: data.recommendations.map((r) => ({ title: r.title, rank: r.rank })),
        });
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return; // cancelled — not an error
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setErrorMsg(msg);
        setState("error");
        logger.track("recommendations_error", { liked, disliked, error: msg });
      }
    },
    [liked, disliked, languages, era, sessionId, router]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchRecs([], [], controller.signal);
    return () => controller.abort();
  }, [fetchRecs]);

  const handleFeedback = useCallback(
    async (title: string, opinion: "liked" | "disliked") => {
      setFeedback((prev) => ({ ...prev, [title]: opinion }));
      logger.track("movie_feedback", { title, opinion, source: "post_recommendation" });

      if (!user) return; // Guest users: log only, don't persist

      setSavingTitle(title);
      try {
        await submitFeedback(title, opinion, sessionId, "post_recommendation");
      } catch {
        // Silently ignore — feedback is still tracked in the event log
      } finally {
        setSavingTitle(null);
      }
    },
    [user, sessionId]
  );

  const handleRediscover = async () => {
    const ratedLiked = Object.entries(feedback)
      .filter(([, v]) => v === "liked")
      .map(([k]) => k);
    const ratedDisliked = Object.entries(feedback)
      .filter(([, v]) => v === "disliked")
      .map(([k]) => k);

    // Accumulate across rounds
    extraLikedRef.current = [...new Set([...extraLikedRef.current, ...ratedLiked])];
    extraDislikedRef.current = [...new Set([...extraDislikedRef.current, ...ratedDisliked])];

    logger.track("rediscover_click", {
      extra_liked: extraLikedRef.current,
      extra_disliked: extraDislikedRef.current,
    });
    await logger.flush();

    setRediscovering(true);
    await fetchRecs(extraLikedRef.current, extraDislikedRef.current);
    setRediscovering(false);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const ratedCount = Object.values(feedback).filter(Boolean).length;
  const topBackdrop = recommendations[0]?.backdrop_url ?? null;

  return (
    <main className="min-h-screen pb-32 bg-[#030308] selection:bg-[#e50914]/30 selection:text-white">
      <HeroBackground overridePoster={topBackdrop} />
      <NavBar
        onBack={async () => {
          logger.track("refine_click", { liked, disliked });
          await logger.flush();
          router.push("/");
        }}
        subtitle={
          state === "success"
            ? [
                `Based on: ${liked.join(", ")}`,
                languages.length ? languages.join(", ") : null,
                era || null,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
      />

      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6">
        {/* Loading */}
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center min-h-[65vh] gap-6 select-none">
            <div className="relative flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
                className="w-14 h-14 rounded-full border-2 border-white/5 border-t-[#e50914] shadow-[0_0_20px_rgba(229,9,20,0.2)]"
              />
              <div className="absolute w-6 h-6 rounded-full bg-[#e50914]/10 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-white/60 text-sm font-bold tracking-wider uppercase">Analyzing your taste profile…</p>
              <p className="text-white/30 text-xs font-semibold tracking-wide">Running RAG pipeline + LLM reasoning</p>
            </div>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="flex flex-col items-center justify-center min-h-[65vh] gap-5 text-center max-w-sm mx-auto px-6 py-10 rounded-3xl glass-satin border border-white/[0.08]">
            <p className="text-4xl animate-bounce">🎬</p>
            <h3 className="text-lg font-extrabold text-white">Oops, something happened</h3>
            <p className="text-white/50 text-xs leading-relaxed font-semibold">{errorMsg}</p>
            <button
              onClick={() => fetchRecs()}
              className="mt-3 px-8 py-3 rounded-2xl text-xs font-extrabold tracking-widest uppercase text-white cursor-pointer shadow-lg hover:scale-[1.02] transition-transform duration-300"
              style={{
                background: "linear-gradient(135deg, #e50914 0%, #a3000b 100%)",
                boxShadow: "0 4px 15px rgba(229,9,20,0.3)"
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => router.push("/")}
              className="text-xs font-bold tracking-wider uppercase text-white/30 hover:text-[#e50914] transition-colors mt-1 cursor-pointer"
            >
              ← Start Over
            </button>
          </div>
        )}

        {/* Success */}
        <AnimatePresence>
          {state === "success" && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="pt-6 pb-10 text-center max-w-2xl mx-auto select-none">
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[10px] tracking-[0.35em] uppercase mb-4.5 font-black"
                  style={{ color: "var(--color-accent)" }}
                >
                  Curated for you
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-4xl md:text-5xl font-extrabold text-gradient leading-tight tracking-tight"
                >
                  {recommendations.length} Films Chosen for You
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="text-xs md:text-sm text-white/40 mt-4 leading-relaxed font-semibold"
                >
                  {user
                    ? "Rate the films you have watched — they will directly shape your next discovery round"
                    : "Sign in to save your history permanently and improve future recommendations"}
                </motion.p>
              </div>

              <div className="space-y-5">
                {recommendations.map((rec, i) => (
                  <RecommendationCard
                    key={`${rec.title}-${i}`}
                    rec={rec}
                    index={i}
                    feedback={feedback[rec.title] ?? null}
                    onFeedback={handleFeedback}
                    saving={savingTitle === rec.title}
                    onView={() =>
                      logger.track("card_view", { title: rec.title, rank: rec.rank })
                    }
                  />
                ))}
              </div>

              {/* Hint text when nothing rated yet */}
              <AnimatePresence>
                {ratedCount === 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center text-[10px] font-bold tracking-widest uppercase text-white/20 mt-10 select-none animate-pulse"
                  >
                    👆 Rate movies you have watched to unlock Rediscovery
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-12 flex justify-center"
              >
                <button
                  onClick={async () => {
                    logger.track("refine_click", { liked, disliked });
                    await logger.flush();
                    router.push("/");
                  }}
                  className="px-10 py-3 rounded-2xl text-xs font-bold tracking-widest uppercase text-white/40 hover:text-white/70 hover:bg-white/5 transition-all duration-300 border border-white/[0.08] cursor-pointer"
                >
                  ← Start fresh
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky rediscover button */}
      <RediscoverButton
        count={ratedCount}
        onClick={handleRediscover}
        loading={rediscovering}
      />
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <main className="h-svh flex items-center justify-center bg-[#030308]">
          <HeroBackground />
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-white/5 border-t-red-500 animate-spin" />
            <p className="text-white/40 text-sm font-semibold tracking-wider uppercase">Loading Curations…</p>
          </div>
        </main>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
