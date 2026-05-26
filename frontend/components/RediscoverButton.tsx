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
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 26 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 select-none"
        >
          <motion.button
            onClick={onClick}
            disabled={loading}
            whileHover={!loading ? { scale: 1.03 } : {}}
            whileTap={!loading ? { scale: 0.97 } : {}}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl text-xs font-extrabold tracking-widest uppercase text-white shadow-2xl disabled:opacity-50 border border-white/[0.15] cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #e50914 0%, #a3000b 100%)",
              boxShadow: "0 12px 40px rgba(229,9,20,0.45), 0 4px 12px rgba(0,0,0,0.5)",
            }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                Rediscovering…
              </>
            ) : (
              <>
                <span className="animate-pulse">✦</span>
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
