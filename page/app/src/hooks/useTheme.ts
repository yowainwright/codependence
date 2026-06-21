import { useEffect, useState } from "react";

type Theme = "codependence-light" | "codependence-dark";

function isTheme(value: string | null): value is Theme {
  return value === "codependence-light" || value === "codependence-dark";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "codependence-light";

    const stored = localStorage.getItem("theme");
    if (isTheme(stored)) return stored;

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "codependence-dark"
      : "codependence-light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () =>
    setTheme((currentTheme) =>
      currentTheme === "codependence-light" ? "codependence-dark" : "codependence-light",
    );

  return { theme, setTheme, toggle };
}
