import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { DARK_THEME, LIGHT_THEME, THEME_STORAGE_KEY } from "@/constants";

function getInitialTheme(): string {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved) return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? DARK_THEME
    : LIGHT_THEME;
}

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return getInitialTheme() === DARK_THEME;
  });

  useEffect(() => {
    const theme = isDark ? DARK_THEME : LIGHT_THEME;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [isDark]);

  return (
    <button
      aria-label="theme-toggle"
      onClick={() => setIsDark((prev) => !prev)}
      className={`btn btn-sm btn-ghost swap swap-rotate btn-square rounded-lg ${isDark ? "swap-active" : ""}`}
    >
      <Sun className="w-4 h-4 swap-off" />
      <Moon className="w-4 h-4 swap-on" />
    </button>
  );
}
