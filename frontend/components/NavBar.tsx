"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import AuthModal from "./AuthModal";

interface Props {
  onBack?: () => void;
  subtitle?: string;
}

export default function NavBar({ onBack, subtitle }: Props) {
  const { user, logout, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<"login" | "signup">("login");
  const [showSettings, setShowSettings] = useState(false);
  
  const pathname = usePathname();
  const onGamePage = pathname === "/game";

  const openLogin = () => { setModalTab("login"); setShowModal(true); };
  const openSignup = () => { setModalTab("signup"); setShowModal(true); };

  // Theme descriptions and design values
  const THEME_OPTIONS: { id: Theme; name: string; desc: string; colors: string[] }[] = [
    {
      id: "classic",
      name: "Cinema Red",
      desc: "The signature cinematic brand layout",
      colors: ["#e50914", "#4f46e5", "#07070f"],
    },
    {
      id: "cyberpunk",
      name: "Cyberpunk Void",
      desc: "Electric glacial teal meets hot magenta",
      colors: ["#06b6d4", "#d946ef", "#0a0815"],
    },
    {
      id: "gold",
      name: "Golden Slate",
      desc: "Luxurious amber gold and volcanic slate",
      colors: ["#e2b13c", "#f5e6d3", "#111113"],
    },
    {
      id: "aurora",
      name: "Aurora Jade",
      desc: "Glacial green and cyan northern lights",
      colors: ["#10b981", "#06b6d4", "#060d0a"],
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full px-4 md:px-8 pt-4 pb-2">
        <nav 
          className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4 rounded-2xl glass-satin transition-all duration-300"
          style={{
            borderColor: "rgba(255, 255, 255, 0.08)",
            boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0px rgba(255, 255, 255, 0.08)",
          }}
        >
          {/* Logo / back button */}
          <button
            onClick={onBack}
            className={`flex items-center gap-1.5 group outline-none ${onBack ? "cursor-pointer" : "cursor-default"}`}
          >
            {onBack && (
              <span className="text-white/40 group-hover:text-white group-hover:-translate-x-0.5 transition-all text-sm mr-1.5 duration-200">
                ←
              </span>
            )}
            <span className="text-xl font-extrabold tracking-tight text-white select-none">
              Cine
            </span>
            <span 
              className="text-xl font-extrabold tracking-tight select-none bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-hover)] bg-clip-text text-transparent transition-colors duration-500"
            >
              Match
            </span>
          </button>

          {/* CineSwipe game link — shown on non-game pages */}
          {!onGamePage && !subtitle && (
            <Link
              href="/game"
              className="hidden sm:flex items-center gap-2 text-xs font-semibold transition-all duration-300 px-4.5 py-2 rounded-full border cursor-pointer"
              style={{
                background: "rgba(255,255,255,0.02)",
                borderColor: "var(--color-border)",
                color: "var(--color-accent)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--color-accent)";
                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border)";
                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)";
              }}
            >
              <span className="animate-bounce">🎬</span>
              <span className="hover:text-white transition-colors">CineSwipe</span>
            </Link>
          )}

          {/* Subtitle (results page) */}
          {subtitle && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-white/40 tracking-[0.2em] uppercase hidden md:block max-w-xs truncate font-medium"
            >
              {subtitle}
            </motion.p>
          )}

          {/* Settings & Auth area */}
          <div className="flex items-center gap-3">
            {/* Theme Settings cog */}
            <button
              onClick={() => setShowSettings(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white hover:bg-white/[0.05] hover:rotate-45 active:scale-95 transition-all duration-300 cursor-pointer shadow-sm select-none"
              title="Theme Settings"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            <div className="w-[1px] h-5 bg-white/10 hidden sm:block" />

            {!loading && (
              <div className="flex items-center gap-3">
                {user ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.05]">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, var(--color-accent) 0%, rgba(0,0,0,0.5) 100%)" }}
                      >
                        {user.username[0].toUpperCase()}
                      </div>
                      <span className="text-[11px] font-bold text-white/70 hidden sm:block pr-1">{user.username}</span>
                    </div>
                    <button
                      onClick={logout}
                      className="text-xs text-white/40 hover:text-white hover:bg-white/[0.05] transition-all px-3 py-1.5 rounded-xl border border-white/[0.07] cursor-pointer"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={openLogin}
                      className="text-xs font-semibold text-white/50 hover:text-white transition-colors px-3 py-2 rounded-xl cursor-pointer"
                    >
                      Sign in
                    </button>
                    <button
                      onClick={openSignup}
                      className="text-xs font-bold text-white px-4.5 py-2 rounded-xl transition-all duration-300 hover:scale-[1.03] cursor-pointer"
                      style={{
                        background: "linear-gradient(135deg, var(--color-accent) 0%, rgba(229,9,20,0.5) 100%)",
                        boxShadow: "0 4px 15px var(--color-accent-glow)",
                      }}
                    >
                      Join free
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* Auth Modal */}
      <AnimatePresence>
        {showModal && (
          <AuthModal onClose={() => setShowModal(false)} defaultTab={modalTab} />
        )}
      </AnimatePresence>

      {/* Theme Settings Drawer (Slide-in from right) */}
      <AnimatePresence>
        {showSettings && (
          <>
            {/* Dark Backdrop mask */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm cursor-pointer select-none"
            />

            {/* Slide-out Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm glass-strong p-6 md:p-8 flex flex-col justify-between border-l"
              style={{ borderColor: "rgba(255, 255, 255, 0.08)", boxShadow: "-10px 0 40px rgba(0,0,0,0.8)" }}
            >
              <div className="space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-extrabold text-gradient">Appearance</h2>
                    <p className="text-xs text-white/40 mt-1 font-medium">Select your cinematic environment</p>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/[0.05] bg-white/[0.02] text-white/40 hover:text-white hover:bg-white/[0.05] transition-all cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                {/* Theme Options list */}
                <div className="space-y-3.5">
                  {THEME_OPTIONS.map((opt) => {
                    const isActive = theme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setTheme(opt.id)}
                        className={`w-full text-left p-4.5 rounded-2xl border transition-all duration-300 cursor-pointer group flex flex-col gap-3 relative overflow-hidden`}
                        style={{
                          background: isActive 
                            ? "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.005) 100%), rgba(255,255,255,0.01)" 
                            : "rgba(255,255,255,0.01)",
                          borderColor: isActive 
                            ? opt.colors[0] 
                            : "rgba(255,255,255,0.05)",
                          boxShadow: isActive 
                            ? `0 8px 25px -10px ${opt.colors[0]}40` 
                            : "none",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white group-hover:text-white transition-colors">{opt.name}</span>
                          {/* Color dots preview */}
                          <div className="flex gap-1 items-center select-none">
                            {opt.colors.map((c, idx) => (
                              <span 
                                key={idx} 
                                className="w-2 h-2 rounded-full border border-white/[0.08]" 
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-white/35 font-medium leading-relaxed max-w-[90%]">{opt.desc}</p>

                        {/* Active check indicator */}
                        {isActive && (
                          <div 
                            className="absolute bottom-0 right-0 w-8 h-8 rounded-tl-2xl flex items-center justify-center text-[10px]"
                            style={{ background: opt.colors[0] }}
                          >
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Close / Confirm Footer */}
              <button
                onClick={() => setShowSettings(false)}
                className="w-full py-3.5 rounded-2xl text-xs font-extrabold tracking-widest uppercase text-white hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer shadow-md text-center"
                style={{ 
                  background: "linear-gradient(135deg, var(--color-accent) 0%, rgba(229,9,20,0.5) 100%)",
                  boxShadow: "0 4px 15px var(--color-accent-glow)"
                }}
              >
                Save Environment
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
