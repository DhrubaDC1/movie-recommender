"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal from "./AuthModal";

interface Props {
  onBack?: () => void;
  subtitle?: string;
}

export default function NavBar({ onBack, subtitle }: Props) {
  const { user, logout, loading } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<"login" | "signup">("login");
  const pathname = usePathname();
  const onGamePage = pathname === "/game";

  const openLogin = () => { setModalTab("login"); setShowModal(true); };
  const openSignup = () => { setModalTab("signup"); setShowModal(true); };

  return (
    <>
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-8 py-5">
        {/* Logo / back button */}
        <button
          onClick={onBack}
          className={`flex items-center gap-1.5 group ${!onBack ? "cursor-default" : ""}`}
        >
          {onBack && (
            <span className="text-white/40 group-hover:text-white/80 transition-colors text-sm mr-1">
              ←
            </span>
          )}
          <span className="text-xl font-bold tracking-wide text-white">Cine</span>
          <span className="text-xl font-bold tracking-wide" style={{ color: "#e50914" }}>Match</span>
        </button>

        {/* CineSwipe game link — shown on non-game pages */}
        {!onGamePage && !subtitle && (
          <Link
            href="/game"
            className="hidden sm:flex items-center gap-2 text-xs font-medium transition-all duration-200 px-4 py-2 rounded-full"
            style={{
              background: "rgba(229,9,20,0.12)",
              border: "1px solid rgba(229,9,20,0.25)",
              color: "rgba(229,9,20,0.85)",
            }}
          >
            <span>🎬</span>
            <span>CineSwipe</span>
          </Link>
        )}

        {/* Subtitle (results page) */}
        {subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-white/30 tracking-widest uppercase hidden md:block max-w-xs truncate"
          >
            {subtitle}
          </motion.p>
        )}

        {/* Auth area */}
        {!loading && (
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: "rgba(229,9,20,0.8)" }}
                  >
                    {user.username[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-white/70 hidden sm:block">{user.username}</span>
                </div>
                <button
                  onClick={logout}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors px-2 py-1 rounded-lg"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={openLogin}
                  className="text-sm text-white/50 hover:text-white/80 transition-colors px-3 py-1.5 rounded-lg"
                >
                  Sign in
                </button>
                <button
                  onClick={openSignup}
                  className="text-sm font-medium text-white px-3 py-1.5 rounded-lg transition-all duration-200"
                  style={{ background: "rgba(229,9,20,0.8)" }}
                >
                  Join free
                </button>
              </div>
            )}
          </div>
        )}
      </nav>

      <AnimatePresence>
        {showModal && (
          <AuthModal onClose={() => setShowModal(false)} defaultTab={modalTab} />
        )}
      </AnimatePresence>
    </>
  );
}
