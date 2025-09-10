"use client";

import { Sidebar, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { useEffect, useState } from "react";

interface AppSidebarWrapperProps {
  children: React.ReactNode;
  themeColor?: string | null;
  fontColor?: string | null;
}

export function AppSidebarWrapper({ children, themeColor, fontColor }: AppSidebarWrapperProps) {
  const { mode } = useSidebarStore();
  const { setOpen, state } = useSidebar();
  const [isHovered, setIsHovered] = useState(false);

  // Handle auto mode hover behavior
  useEffect(() => {
    if (mode === "auto") {
      if (isHovered && state === "collapsed") {
        setOpen(true);
      } else if (!isHovered && state === "expanded") {
        setOpen(false);
      }
    }
  }, [mode, isHovered, state, setOpen]);

  const handleMouseEnter = () => {
    if (mode === "auto") {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (mode === "auto") {
      setIsHovered(false);
    }
  };

  return (
    <Sidebar
      collapsible="icon"
      className={cn("border-none", themeColor ? "bg-[color:var(--theme-color)]" : "bg-sidebar")}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={
        {
          "--scrollbar-color": fontColor
            ? `color-mix(in srgb, ${fontColor} 30%, transparent)`
            : "rgba(0,0,0,0.3)",
          "--scrollbar-hover-color": fontColor
            ? `color-mix(in srgb, ${fontColor} 50%, transparent)`
            : "rgba(0,0,0,0.5)",
        } as React.CSSProperties
      }
    >
      {children}
    </Sidebar>
  );
}
