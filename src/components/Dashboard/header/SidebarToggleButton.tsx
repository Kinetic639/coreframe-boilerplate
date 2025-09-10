"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { cn } from "@/lib/utils";

export function SidebarToggleButton() {
  const { open, toggleSidebar } = useSidebar();
  const { mode } = useSidebarStore();

  // Don't show in auto mode
  if (mode === "auto") {
    return null;
  }

  return (
    <button
      onClick={toggleSidebar}
      className={cn(
        "flex h-10 w-6 items-center justify-center pr-1",
        // Use themed colors to match organization profile
        "bg-[var(--theme-color)] text-[color:var(--font-color)]",
        // Position to touch the sidebar without gap, centered vertically
        "absolute -left-1 top-1/2 z-10 -translate-y-1/2",
        // Rounded corners only on right side
        "rounded-r-2xl",
        // Remove all hover animations and effects
        "focus:outline-none focus-visible:ring-0"
      )}
    >
      {open ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
    </button>
  );
}
