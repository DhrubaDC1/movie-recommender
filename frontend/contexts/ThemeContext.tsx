"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Theme = "classic" | "cyberpunk" | "gold" | "aurora";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "classic",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("classic");
  const [mounted, setMounted] = useState(false);

  // Read theme from localStorage on client mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("cinematch-theme") as Theme;
    if (savedTheme && ["classic", "cyberpunk", "gold", "aurora"].includes(savedTheme)) {
      setThemeState(savedTheme);
      document.body.className = `theme-${savedTheme}`;
    } else {
      document.body.className = "theme-classic";
    }
    setMounted(true);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("cinematch-theme", newTheme);
    document.body.className = `theme-${newTheme}`;
  };

  // Prevent flash of incorrect theme before client hydration
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div style={{ visibility: mounted ? "visible" : "hidden" }} className="min-h-screen flex flex-col">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
