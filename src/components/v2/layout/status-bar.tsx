"use client";

import { cn } from "@/lib/utils";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ColorThemeSwitcher } from "@/components/color-theme-switcher";

interface StatusBarProps {
  position?: "top" | "bottom";
  variant?: "full" | "compact";
  className?: string;
}

export function StatusBar({ position = "bottom", variant = "compact", className }: StatusBarProps) {
  const { user } = useUserStoreV2();

  return (
    <div
      className={cn(
        "flex-shrink-0 flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground bg-muted border-t",
        position === "top" && "border-t-0 border-b",
        className
      )}
    >
      <div className="ml-auto flex items-center gap-2">
        {variant === "full" && user && <span>User: {user.email}</span>}
        <div className="flex items-center gap-1">
          <ColorThemeSwitcher variant="icon" />
          <ThemeSwitcher />
        </div>
      </div>
    </div>
  );
}
