"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface AppSidebarWrapperProps {
  children: React.ReactNode;
  themeColor?: string | null;
}

export function AppSidebarWrapper({ children, themeColor }: AppSidebarWrapperProps) {
  return (
    <Sidebar
      collapsible="icon"
      className={cn("border-none", themeColor ? "bg-[color:var(--theme-color)]" : "bg-sidebar")}
    >
      {children}
    </Sidebar>
  );
}
