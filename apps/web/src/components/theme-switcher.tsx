"use client";

import { ThemeSwitcher as SharedThemeSwitcher } from "@repo/ui/theme-switcher";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";

const ThemeSwitcher = () => {
  const setStoreTheme = useUiStoreV2((s) => s.setTheme);

  return <SharedThemeSwitcher onThemeChange={setStoreTheme} />;
};

export { ThemeSwitcher };
