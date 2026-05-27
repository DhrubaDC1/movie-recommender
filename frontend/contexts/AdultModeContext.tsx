"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { logger } from "@/lib/logger";

export const ADULT_CERT_OPTIONS = [
  { label: "NC-17", sub: "Restricted only", certs: ["NC-17"] as string[] },
  { label: "R",     sub: "R-rated only",   certs: ["R"] as string[] },
  { label: "Both",  sub: "R + NC-17",      certs: ["R", "NC-17"] as string[] },
] as const;

const ADULT_CONFIRM_KEY = "cm_adult_confirmed";

interface AdultModeContextType {
  adultMode: boolean;
  adultCertLabel: string;
  adultCerts: string[];
  setAdultCertLabel: (label: string) => void;
  requestEnableAdult: () => void;
  disableAdult: () => void;
}

const AdultModeContext = createContext<AdultModeContextType>({
  adultMode: false,
  adultCertLabel: "Both",
  adultCerts: [],
  setAdultCertLabel: () => {},
  requestEnableAdult: () => {},
  disableAdult: () => {},
});

export function AdultModeProvider({ children }: { children: ReactNode }) {
  const [adultMode, setAdultMode] = useState(false);
  const [adultCertLabel, setAdultCertLabel] = useState("Both");
  const [adultConfirmOpen, setAdultConfirmOpen] = useState(false);

  const adultCerts = adultMode
    ? (ADULT_CERT_OPTIONS.find((o) => o.label === adultCertLabel)?.certs ?? [])
    : [];

  const requestEnableAdult = () => {
    if (typeof window !== "undefined" && localStorage.getItem(ADULT_CONFIRM_KEY) === "1") {
      setAdultMode(true);
      logger.track("adult_mode_toggle", { on: true, cert: adultCertLabel, source: "remembered" });
      return;
    }
    setAdultConfirmOpen(true);
  };

  const confirmAdult = () => {
    if (typeof window !== "undefined") localStorage.setItem(ADULT_CONFIRM_KEY, "1");
    setAdultMode(true);
    setAdultConfirmOpen(false);
    logger.track("adult_mode_toggle", { on: true, cert: adultCertLabel, source: "confirmed" });
  };

  const disableAdult = () => {
    setAdultMode(false);
    logger.track("adult_mode_toggle", { on: false });
  };

  return (
    <AdultModeContext.Provider value={{ adultMode, adultCertLabel, adultCerts, setAdultCertLabel, requestEnableAdult, disableAdult }}>
      {children}

      <AnimatePresence>
        {adultConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
            style={{ background: "rgba(3, 3, 8, 0.85)", backdropFilter: "blur(8px)" }}
            onClick={() => setAdultConfirmOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl p-7 glass-satin"
              style={{
                border: "1px solid rgba(229, 9, 20, 0.3)",
                boxShadow: "0 30px 60px rgba(0,0,0,0.6), 0 0 25px rgba(229,9,20,0.15)",
              }}
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #e50914 0%, #8a0009 100%)", boxShadow: "0 6px 20px rgba(229,9,20,0.4)" }}
                >
                  <span className="text-white text-[11px] font-black tracking-[0.15em]">18+</span>
                </div>
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Confirm you are 18 or older
                </h2>
                <p className="text-[11px] text-white/50 leading-relaxed font-medium">
                  Adult mode shows R-rated and NC-17 restricted titles only. By continuing, you confirm you are of legal age to view this content in your region.
                </p>
                <div className="flex w-full gap-2 mt-2">
                  <button
                    onClick={() => setAdultConfirmOpen(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-[10px] font-bold tracking-widest uppercase text-white/60 hover:text-white hover:bg-white/[0.04] transition-all duration-300 border border-white/[0.06] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmAdult}
                    className="flex-1 px-4 py-2.5 rounded-xl text-[10px] font-extrabold tracking-widest uppercase text-white cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                    style={{
                      background: "linear-gradient(135deg, #e50914 0%, #b0060f 100%)",
                      boxShadow: "0 4px 15px rgba(229,9,20,0.35)",
                    }}
                  >
                    I am 18+
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdultModeContext.Provider>
  );
}

export function useAdultMode() {
  return useContext(AdultModeContext);
}
