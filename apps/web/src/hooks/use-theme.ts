import { useEffect, useCallback } from "react";
import { useSettings, useUpdateSetting } from "./use-settings";

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else if (theme === "light") {
    root.classList.remove("dark");
    root.classList.add("light");
  } else {
    // System preference
    root.classList.remove("dark", "light");
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    }
  }
}

function getResolvedTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

/**
 * Manages theme state with system preference detection and manual override.
 * Reads persisted theme from Convex settings, applies it to the DOM,
 * and listens for system preference changes when in "system" mode.
 */
export function useTheme() {
  const storedTheme = useSettings("theme");
  const updateSetting = useUpdateSetting();

  const theme: Theme =
    storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : "system";

  // Apply theme whenever the setting changes
  useEffect(() => {
    if (storedTheme === undefined) return; // Still loading
    applyTheme(theme);
  }, [storedTheme, theme]);

  // Listen for system preference changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    function handleChange() {
      applyTheme("system");
    }

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = useCallback(
    async (value: Theme) => {
      await updateSetting({ key: "theme", value });
      applyTheme(value);
    },
    [updateSetting],
  );

  const toggle = useCallback(async () => {
    const resolved = getResolvedTheme(theme);
    const next = resolved === "dark" ? "light" : "dark";
    await setTheme(next);
  }, [theme, setTheme]);

  return {
    theme,
    resolvedTheme: getResolvedTheme(theme),
    setTheme,
    toggle,
    isLoading: storedTheme === undefined,
  } as const;
}
