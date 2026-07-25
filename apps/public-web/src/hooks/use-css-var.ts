"use client";

/**
 * Reads one or more CSS custom properties from :root and re-evaluates
 * whenever the `class` attribute on <html> changes (theme / dark-mode toggle).
 *
 * Returns resolved color strings usable directly in Konva fills/strokes.
 *
 * Usage:
 *   const { "--background": bg, "--border": border } = useCssVars(["--background", "--border"]);
 */

import { useEffect, useState, useCallback } from "react";

type CssVarMap<T extends string> = Record<T, string>;

function readVars<T extends string>(names: T[]): CssVarMap<T> {
  const style = getComputedStyle(document.documentElement);
  const result = {} as CssVarMap<T>;
  for (const name of names) {
    result[name] = style.getPropertyValue(name).trim();
  }
  return result;
}

/** Returns true when the <html> element has the "dark" class. Reactive. */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark"))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export function useCssVars<T extends string>(names: T[]): CssVarMap<T> {
  // Stable key so the dep array below doesn't change on every render
  const key = names.join(",");

  const [vars, setVars] = useState<CssVarMap<T>>(() => {
    // SSR guard — return empty strings server-side, filled in after mount
    if (typeof window === "undefined") {
      return names.reduce((acc, n) => {
        acc[n] = "";
        return acc;
      }, {} as CssVarMap<T>);
    }
    return readVars(names);
  });

  const refresh = useCallback(() => {
    setVars(readVars(names.join(",").split(",") as T[]));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh();
    // Watch for class changes on <html> (dark mode toggle, theme switch)
    const obs = new MutationObserver(refresh);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => obs.disconnect();
  }, [refresh]);

  return vars;
}
