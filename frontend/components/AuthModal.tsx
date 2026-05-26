"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onClose: () => void;
  defaultTab?: "login" | "signup";
}

type Tab = "login" | "signup";

export default function AuthModal({ onClose, defaultTab = "login" }: Props) {
  const { login, signup } = useAuth();
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup fields
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup(signupUsername, signupEmail, signupPassword);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: "rgba(10, 10, 20, 0.95)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        }}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-lg font-bold text-white">Cine</span>
              <span className="text-lg font-bold" style={{ color: "#e50914" }}>Match</span>
            </div>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/70 transition-colors text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div
            className="flex rounded-lg p-1 mb-6"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            {(["login", "signup"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); }}
                className="flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 capitalize"
                style={{
                  background: tab === t ? "rgba(229,9,20,0.85)" : "transparent",
                  color: tab === t ? "#fff" : "rgba(255,255,255,0.4)",
                }}
              >
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="px-8 pb-8">
          <AnimatePresence mode="wait">
            {tab === "login" ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <Field
                  label="Email"
                  type="email"
                  value={loginEmail}
                  onChange={setLoginEmail}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <Field
                  label="Password"
                  type="password"
                  value={loginPassword}
                  onChange={setLoginPassword}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <ErrorMsg msg={error} />
                <SubmitBtn loading={loading}>Sign In</SubmitBtn>
              </motion.form>
            ) : (
              <motion.form
                key="signup"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                onSubmit={handleSignup}
                className="space-y-4"
              >
                <Field
                  label="Username"
                  type="text"
                  value={signupUsername}
                  onChange={setSignupUsername}
                  placeholder="cinephile42"
                  autoComplete="username"
                />
                <Field
                  label="Email"
                  type="email"
                  value={signupEmail}
                  onChange={setSignupEmail}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <Field
                  label="Password"
                  type="password"
                  value={signupPassword}
                  onChange={setSignupPassword}
                  placeholder="Min 6 characters"
                  autoComplete="new-password"
                />
                <ErrorMsg msg={error} />
                <SubmitBtn loading={loading}>Create Account</SubmitBtn>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({
  label, type, value, onChange, placeholder, autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-white/50 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all duration-200"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(229,9,20,0.5)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
      />
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p className="text-sm text-center" style={{ color: "#fca5a5" }}>
      {msg}
    </p>
  );
}

function SubmitBtn({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60 mt-2"
      style={{ background: "linear-gradient(135deg, #e50914 0%, #b0060f 100%)" }}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          Working…
        </span>
      ) : (
        children
      )}
    </button>
  );
}
