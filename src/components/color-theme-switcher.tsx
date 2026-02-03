"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Palette, Check } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  COLOR_THEMES,
  COLOR_THEME_STORAGE_KEY,
  COLOR_THEME_CHANGE_EVENT,
} from "@/lib/constants/color-themes";

interface ColorThemeSwitcherProps {
  variant?: "button" | "icon";
  align?: "start" | "center" | "end";
}

export function ColorThemeSwitcher({ variant = "button", align = "end" }: ColorThemeSwitcherProps) {
  const [mounted, setMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState("default");

  // Listen for color theme changes from other components (e.g. preferences page)
  const handleExternalChange = useCallback((e: Event) => {
    const themeName = (e as CustomEvent<string>).detail;
    if (themeName) {
      setCurrentTheme(themeName);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    // Load theme from localStorage
    const saved = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    if (saved) {
      setCurrentTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  useEffect(() => {
    window.addEventListener(COLOR_THEME_CHANGE_EVENT, handleExternalChange);
    return () => window.removeEventListener(COLOR_THEME_CHANGE_EVENT, handleExternalChange);
  }, [handleExternalChange]);

  const handleThemeChange = (themeName: string) => {
    setCurrentTheme(themeName);
    document.documentElement.setAttribute("data-theme", themeName);
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, themeName);
    window.dispatchEvent(new CustomEvent(COLOR_THEME_CHANGE_EVENT, { detail: themeName }));
  };

  if (!mounted) {
    return null;
  }

  const selectedTheme = COLOR_THEMES.find((t) => t.name === currentTheme) || COLOR_THEMES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Palette className="h-4 w-4" />
            <span className="sr-only">Change color theme</span>
          </Button>
        ) : (
          <Button variant="outline" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">{selectedTheme.label}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        <DropdownMenuLabel>Color Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {COLOR_THEMES.map((t) => (
          <DropdownMenuItem
            key={t.name}
            onClick={() => handleThemeChange(t.name)}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {t.colors.map((color, index) => (
                  <div
                    key={index}
                    className="h-4 w-4 rounded-sm border border-border/50"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span>{t.label}</span>
            </div>
            {currentTheme === t.name && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
