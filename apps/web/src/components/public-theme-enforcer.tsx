"use client";

import { useEffect } from "react";

/**
 * Component that enforces the default color theme on public pages.
 * Removes any custom data-theme attribute so the default (amber) theme is used.
 * This prevents dashboard theme selections from affecting public pages.
 */
export function PublicThemeEnforcer() {
  useEffect(() => {
    // Store the current theme so we can restore it if user navigates to dashboard
    const currentTheme = document.documentElement.getAttribute("data-theme");

    // Remove custom theme - this makes :root (default amber theme) apply
    document.documentElement.removeAttribute("data-theme");

    // Cleanup: restore previous theme when navigating away (optional)
    return () => {
      if (currentTheme) {
        document.documentElement.setAttribute("data-theme", currentTheme);
      }
    };
  }, []);

  return null;
}
