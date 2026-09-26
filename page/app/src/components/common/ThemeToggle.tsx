import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { DARK_THEME, LIGHT_THEME, THEME_STORAGE_KEY } from "@/constants";
import { Button } from "@/components/ui/button";

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
    <Button
      variant="ghost"
      size="icon"
      aria-label="theme-toggle"
      onClick={() => setIsDark((prev) => !prev)}
      className="rounded-lg"
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  );
}
