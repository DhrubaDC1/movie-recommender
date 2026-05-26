"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getRecommendations } from "@/lib/api";
import type { Recommendation } from "@/lib/types";
import HeroBackground from "@/components/HeroBackground";
import RecommendationCard from "@/components/RecommendationCard";
import { logger } from "@/lib/logger";

type State = "loading" | "success" | "error";

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const liked = searchParams.getAll("liked");
  const disliked = searchParams.getAll("disliked");
  const sessionId = searchParams.get("session_id") ?? undefined;

  useEffect(() => {
    logger.init();
    logger.track("page_view", { page: "results", liked, disliked });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRecs = useCallback(async () => {
    if (liked.length === 0) {
      router.push("/");
      return;
    }
    setState("loading");
    const t0 = performance.now();
    try {
      const data = await getRecommendations(liked, disliked, 5, sessionId);
      const latencyMs = Math.round(performance.now() - t0);
      setRecommendations(data.recommendations);
      setState("success");
      logger.track("recommendations_received", {
        liked,
        disliked,
        latency_ms: latencyMs,
        results: data.recommendations.map((r) => ({ title: r.title, rank: r.rank })),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setErrorMsg(msg);
      setState("error");
      logger.track("recommendations_error", { liked, disliked, error: msg });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchRecs();
  }, [fetchRecs]);

  const handleRefine = async () => {
    logger.track("refine_click", { liked, disliked });
    await logger.flush();
    router.push("/");
  };

  const topBackdrop = recommendations[0]?.backdrop_url ?? null;

  return (
    <main className="min-h-screen">
      <HeroBackground overridePoster={topBackdrop} />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <button onClick={handleRefine} className="flex items-center gap-2 group">
          <span className="text-white/40 group-hover:text-white/80 transition-colors text-sm">←</span>
          <span className="text-xl font-bold tracking-wide text-white">Cine</span>
          <span className="text-xl font-bold tracking-wide" style={{ color: "#e50914" }}>Match</span>
        </button>
        {state === "success" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-white/30 tracking-widest uppercase hidden md:block"
          >
            Based on: {liked.join(", ")}
          </motion.div>
        )}
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pb-20">
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
              onClick={fetchRecs}
              className="mt-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white"
              style={{ background: "rgba(229,9,20,0.8)" }}
            >
              Try Again
            </button>
            <button
              onClick={handleRefine}
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
              <div className="pt-4 pb-10 text-center">
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
              </div>

              <div className="space-y-4">
                {recommendations.map((rec, i) => (
                  <RecommendationCard
                    key={rec.title}
                    rec={rec}
                    index={i}
                    onView={() =>
                      logger.track("card_view", { title: rec.title, rank: rec.rank })
                    }
                  />
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-12 flex justify-center"
              >
                <button
                  onClick={handleRefine}
                  className="px-8 py-3 rounded-full text-sm font-semibold text-white/60 hover:text-white transition-colors"
                  style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  ← Refine My Taste
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
