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
import { useEffect, useState } from "react";

const COLOR_THEME_STORAGE_KEY = "color-theme";

const themes = [
  {
    name: "default",
    label: "Default",
    colors: ["#e87952", "#5b9ad5", "#4472c4", "#ed7d31"],
  },
  {
    name: "graphite",
    label: "Graphite",
    colors: ["#606060", "#909090", "#565656", "#a8a8a8"],
  },
  {
    name: "doom64",
    label: "Doom 64",
    colors: ["#b71c1c", "#33691e", "#5b8ab8", "#ff6d00"],
  },
  {
    name: "amber",
    label: "Amber",
    colors: ["#ff8000", "#ffa040", "#cc6600", "#ffb366"],
  },
  {
    name: "amethyst-haze",
    label: "Amethyst",
    colors: ["#8a79ab", "#e6a5b8", "#77b8a1", "#f0c88d"],
  },
  {
    name: "bold-tech",
    label: "Bold Tech",
    colors: ["#8b5cf6", "#7c3aed", "#6d28d9", "#dbeafe"],
  },
  {
    name: "bubblegum",
    label: "Bubblegum",
    colors: ["#d04f99", "#8acfd1", "#fbe2a7", "#e670ab"],
  },
  {
    name: "caffeine",
    label: "Caffeine",
    colors: ["#524232", "#ffd99e", "#e8e8e8", "#ffe0b1"],
  },
  {
    name: "candyland",
    label: "Candyland",
    colors: ["#ffdddd", "#9ed4e0", "#ffff00", "#ff99ff"],
  },
  {
    name: "catppuccin",
    label: "Catppuccin",
    colors: ["#8b5cf6", "#40b5e4", "#5fb952", "#ff844b"],
  },
  {
    name: "claude",
    label: "Claude",
    colors: ["#c67b51", "#b89df4", "#d9c9aa", "#cbaff1"],
  },
  {
    name: "elegant-luxury",
    label: "Elegant",
    colors: ["#9d3939", "#f8e194", "#e8d7c5", "#ff6b45"],
  },
  {
    name: "kodama-grove",
    label: "Kodama",
    colors: ["#7b9960", "#d6c899", "#cfb886", "#a6c08f"],
  },
  {
    name: "mocha-mousse",
    label: "Mocha",
    colors: ["#8d6146", "#c4a774", "#dab98e", "#966e52"],
  },
  {
    name: "perpetuity",
    label: "Perpetuity",
    colors: ["#0ba5a5", "#96e8e8", "#6fd2d2", "#b7f1f1"],
  },
];

interface ColorThemeSwitcherProps {
  variant?: "button" | "icon";
  align?: "start" | "center" | "end";
}

export function ColorThemeSwitcher({ variant = "button", align = "end" }: ColorThemeSwitcherProps) {
  const [mounted, setMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState("default");

  useEffect(() => {
    setMounted(true);
    // Load theme from localStorage
    const saved = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    if (saved) {
      setCurrentTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const handleThemeChange = (themeName: string) => {
    setCurrentTheme(themeName);
    document.documentElement.setAttribute("data-theme", themeName);
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, themeName);
  };

  if (!mounted) {
    return null;
  }

  const selectedTheme = themes.find((t) => t.name === currentTheme) || themes[0];

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
        {themes.map((t) => (
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
