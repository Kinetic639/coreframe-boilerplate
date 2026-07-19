"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "./button";

export interface ThemeSwitcherProps {
  onThemeChange?: (theme: "light" | "dark") => void;
  label?: string;
}

export function ThemeSwitcher({ onThemeChange, label = "Toggle theme" }: ThemeSwitcherProps) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleToggle = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    onThemeChange?.(newTheme);
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleToggle} className="h-9 w-9">
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
