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
        const data = await getRecommendations(allLiked, allDisliked, 5, sessionId, signal);
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
    [liked, disliked, sessionId, router]
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
    <main className="min-h-screen pb-28">
      <HeroBackground overridePoster={topBackdrop} />
      <NavBar
        onBack={async () => {
          logger.track("refine_click", { liked, disliked });
          await logger.flush();
          router.push("/");
        }}
        subtitle={state === "success" ? `Based on: ${liked.join(", ")}` : undefined}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-6">
        {/* Loading */}
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
              className="w-12 h-12 rounded-full border-2 border-white/10 border-t-red-500"
            />
            <div className="text-center space-y-2">
              <p className="text-white/60 text-sm">Analyzing your taste profile…</p>
              <p className="text-white/30 text-xs">Running RAG pipeline + LLM reasoning</p>
            </div>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
            <p className="text-4xl">🎬</p>
            <p className="text-white/70">{errorMsg}</p>
            <button
              onClick={() => fetchRecs()}
              className="mt-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white"
              style={{ background: "rgba(229,9,20,0.8)" }}
            >
              Try Again
            </button>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-white/30 hover:text-white/60 transition-colors"
            >
              ← Start Over
            </button>
          </div>
        )}

        {/* Success */}
        <AnimatePresence>
          {state === "success" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="pt-4 pb-8 text-center">
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs tracking-[0.3em] uppercase mb-3"
                  style={{ color: "#e50914" }}
                >
                  Curated for you
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-4xl md:text-5xl font-bold text-gradient"
                >
                  {recommendations.length} Films Chosen for You
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm text-white/35 mt-3"
                >
                  {user
                    ? "Rate the ones you've watched — they'll shape your next discovery"
                    : "Sign in to save your ratings and improve future recommendations"}
                </motion.p>
              </div>

              <div className="space-y-4">
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
                    className="text-center text-xs text-white/20 mt-8"
                  >
                    👆 Rate movies you&apos;ve watched to unlock Rediscovery
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="mt-10 flex justify-center"
              >
                <button
                  onClick={async () => {
                    logger.track("refine_click", { liked, disliked });
                    await logger.flush();
                    router.push("/");
                  }}
                  className="px-8 py-3 rounded-full text-sm font-semibold text-white/40 hover:text-white/70 transition-colors"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
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
        <main className="min-h-screen flex items-center justify-center">
          <HeroBackground />
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-red-500 animate-spin" />
            <p className="text-white/40 text-sm">Loading…</p>
          </div>
        </main>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
