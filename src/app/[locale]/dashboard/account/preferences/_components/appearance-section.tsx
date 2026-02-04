"use client";

import { useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Sun, Moon, Laptop, Check, Palette } from "lucide-react";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import { cn } from "@/lib/utils";
import {
  COLOR_THEMES,
  COLOR_THEME_STORAGE_KEY,
  COLOR_THEME_CHANGE_EVENT,
} from "@/lib/constants/color-themes";

export function AppearanceSection() {
  const t = useTranslations("PreferencesPage");
  const { theme, setTheme } = useTheme();
  const setStoreTheme = useUiStoreV2((s) => s.setTheme);
  const setStoreColorTheme = useUiStoreV2((s) => s.setColorTheme);
  const [mounted, setMounted] = useState(false);
  // Initialize from localStorage synchronously to prevent flash
  const [currentColorTheme, setCurrentColorTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(COLOR_THEME_STORAGE_KEY) || "default";
    }
    return "default";
  });

  // Listen for color theme changes from other components (e.g. status bar)
  const handleExternalColorChange = useCallback((e: Event) => {
    const themeName = (e as CustomEvent<string>).detail;
    if (themeName) {
      setCurrentColorTheme(themeName);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    window.addEventListener(COLOR_THEME_CHANGE_EVENT, handleExternalColorChange);
    return () => window.removeEventListener(COLOR_THEME_CHANGE_EVENT, handleExternalColorChange);
  }, [handleExternalColorChange]);

  const handleThemeChange = (value: string) => {
    setTheme(value);
    setStoreTheme(value as "light" | "dark" | "system");
  };

  const handleColorThemeChange = (themeName: string) => {
    setCurrentColorTheme(themeName);
    setStoreColorTheme(themeName);
    document.documentElement.setAttribute("data-theme", themeName);
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, themeName);
    window.dispatchEvent(new CustomEvent(COLOR_THEME_CHANGE_EVENT, { detail: themeName }));
  };

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            {t("appearance")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Theme Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            {t("theme")}
          </CardTitle>
          <CardDescription>{t("themeDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={handleThemeChange}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            {[
              { value: "light", icon: Sun },
              { value: "dark", icon: Moon },
              { value: "system", icon: Laptop },
            ].map(({ value, icon: Icon }) => (
              <Label
                key={value}
                htmlFor={`theme-${value}`}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                  theme === value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <RadioGroupItem value={value} id={`theme-${value}`} />
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t(value as "light" | "dark" | "system")}
                </span>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Color Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {t("colorTheme")}
          </CardTitle>
          <CardDescription>{t("colorThemeDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {COLOR_THEMES.map((ct) => (
              <button
                key={ct.name}
                type="button"
                onClick={() => handleColorThemeChange(ct.name)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors",
                  currentColorTheme === ct.name
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <div className="flex gap-0.5 shrink-0">
                  {ct.colors.map((color, i) => (
                    <div
                      key={i}
                      className="h-4 w-4 rounded-sm border border-border/50"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium truncate">{ct.label}</span>
                {currentColorTheme === ct.name && (
                  <Check className="h-3.5 w-3.5 ml-auto text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
