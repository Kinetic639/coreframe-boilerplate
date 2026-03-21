"use client";

import { useLayoutEffect } from "react";
import { COLOR_THEME_STORAGE_KEY } from "@/lib/constants/color-themes";

export function DashboardColorThemeLoader() {
  useLayoutEffect(() => {
    try {
      const theme = localStorage.getItem(COLOR_THEME_STORAGE_KEY) || "default";

      if (theme === "default") {
        document.documentElement.removeAttribute("data-theme");
        return;
      }

      document.documentElement.setAttribute("data-theme", theme);
    } catch {
      // Ignore storage access issues and keep the default theme.
    }
  }, []);

  return null;
}
