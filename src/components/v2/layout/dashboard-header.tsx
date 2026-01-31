"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { HeaderSearch } from "./header-search";
import { HeaderNotifications } from "./header-notifications";
import { HeaderMessages } from "./header-messages";

/**
 * Dashboard Header V2
 *
 * Main header component for Dashboard V2 layout
 * Follows shadcn/ui sidebar-07 pattern
 *
 * Features:
 * - Sidebar toggle button (integrated from shadcn)
 * - Global search with command palette (Cmd+K)
 * - Messages drawer
 * - Notifications drawer
 *
 * Layout:
 * - Left: Sidebar trigger + separator
 * - Center: Search bar
 * - Right: Messages + Notifications
 *
 * SSR-first: Reads from Zustand stores hydrated on server
 * Note: User menu is available in the sidebar footer
 */
export function DashboardHeaderV2() {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 bg-muted shadow-sm transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-6">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 h-4" />
      </div>

      {/* Center: Search */}
      <div className="hidden md:flex flex-1 max-w-md">
        <HeaderSearch />
      </div>

      {/* Right: Messages + Notifications */}
      <div className="flex items-center gap-2 ml-auto px-6">
        {/* Mobile: Search icon */}
        <div className="md:hidden">
          <HeaderSearch />
        </div>

        <HeaderMessages />
        <HeaderNotifications />
      </div>
    </header>
  );
}
