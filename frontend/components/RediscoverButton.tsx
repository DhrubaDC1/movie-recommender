"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  count: number;
  onClick: () => void;
  loading: boolean;
}

export default function RediscoverButton({ count, onClick, loading }: Props) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40"
        >
          <motion.button
            onClick={onClick}
            disabled={loading}
            whileHover={!loading ? { scale: 1.04 } : {}}
            whileTap={!loading ? { scale: 0.97 } : {}}
            className="flex items-center gap-3 px-7 py-3.5 rounded-full text-sm font-semibold text-white shadow-2xl disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #e50914 0%, #b0060f 100%)",
              boxShadow: "0 8px 40px rgba(229,9,20,0.45)",
            }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Rediscovering…
              </>
            ) : (
              <>
                <span>✦</span>
                Rediscover with {count} new opinion{count !== 1 ? "s" : ""}
                <span>→</span>
              </>
            )}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
