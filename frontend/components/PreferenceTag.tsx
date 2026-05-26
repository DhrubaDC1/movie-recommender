"use client";

import { motion } from "framer-motion";

interface Props {
  title: string;
  type: "liked" | "disliked";
  onRemove: () => void;
}

const COLORS = {
  liked: {
    bg: "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.03) 100%)",
    border: "rgba(34,197,94,0.22)",
    borderHover: "rgba(34,197,94,0.45)",
    dot: "#22c55e",
    dotGlow: "0 0 10px #22c55e",
    text: "#86efac",
  },
  disliked: {
    bg: "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.03) 100%)",
    border: "rgba(239,68,68,0.22)",
    borderHover: "rgba(239,68,68,0.45)",
    dot: "#ef4444",
    dotGlow: "0 0 10px #ef4444",
    text: "#fca5a5",
  },
};

export default function PreferenceTag({ title, type, onRemove }: Props) {
  const c = COLORS[type];
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.82, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.82, y: -4 }}
      whileHover={{ y: -1, borderColor: c.borderHover }}
      transition={{ duration: 0.2, type: "spring", stiffness: 350, damping: 25 }}
      className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold select-none border backdrop-filter backdrop-blur-md"
      style={{ 
        background: c.bg, 
        borderColor: c.border, 
        color: c.text,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <span 
        className="w-1.5 h-1.5 rounded-full flex-shrink-0" 
        style={{ 
          background: c.dot,
          boxShadow: c.dotGlow,
        }} 
      />
      <span className="leading-none">{title}</span>
      <button
        onClick={onRemove}
        className="ml-1 opacity-45 hover:opacity-100 hover:scale-110 active:scale-95 transition-all leading-none text-sm cursor-pointer p-0.5"
        aria-label={`Remove ${title}`}
      >
        ×
      </button>
    </motion.span>
  );
}
