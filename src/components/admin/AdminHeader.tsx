"use client";

import { Bell, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ColorThemeSwitcher } from "@/components/color-theme-switcher";

export function AdminHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Administrator Access
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <ColorThemeSwitcher variant="icon" />
        <ThemeSwitcher />
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon">
          <User className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
