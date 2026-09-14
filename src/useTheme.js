import { useEffect, useState } from "react";

const STORAGE_KEY = "strut-theme-mode"; // 'light' | 'dark' | 'system'

function getSystemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Theme preference is stored per-device (localStorage) rather than synced
// through Firestore — that lets it apply instantly on load (including on the
// Google sign-in screen, before any network round trip) with no flash of the
// wrong theme.
export function useTheme() {
  const [mode, setModeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "system";
    } catch {
      return "system";
    }
  });
  const [systemDark, setSystemDark] = useState(getSystemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setMode = (next) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private browsing, etc. — theme just won't persist */
    }
  };

  const effective = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  return { mode, setMode, effective };
}
