"use client";

import { motion } from "framer-motion";

interface Props {
  title: string;
  type: "liked" | "disliked";
  onRemove: () => void;
}

const COLORS = {
  liked: {
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.35)",
    dot: "#22c55e",
    text: "#86efac",
  },
  disliked: {
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.35)",
    dot: "#ef4444",
    text: "#fca5a5",
  },
};

export default function PreferenceTag({ title, type, onRemove }: Props) {
  const c = COLORS[type];
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.18 }}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium select-none"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
      {title}
      <button
        onClick={onRemove}
        className="ml-1 opacity-60 hover:opacity-100 transition-opacity leading-none"
        aria-label={`Remove ${title}`}
      >
        ×
      </button>
    </motion.span>
  );
}
