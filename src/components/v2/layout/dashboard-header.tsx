"use client";

import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { HeaderSearch } from "./header-search";
import { HeaderNotifications } from "./header-notifications";
import { HeaderUserMenu } from "./header-user-menu";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";

/**
 * Dashboard Header V2
 *
 * Main header component for Dashboard V2 layout
 *
 * Features:
 * - Sidebar toggle button (mobile/desktop)
 * - Global search with command palette (Cmd+K)
 * - Notifications bell (placeholder)
 * - User profile menu with avatar
 *
 * Layout:
 * - Left: Sidebar toggle
 * - Center: Search bar
 * - Right: Notifications + User menu
 *
 * SSR-first: Reads from Zustand stores hydrated on server
 * Uses shadcn/ui useSidebar() hook for sidebar toggle
 */
export function DashboardHeaderV2() {
  const { toggleSidebar } = useSidebar();
  const { user } = useUserStoreV2();

  return (
    <header className="flex-shrink-0 z-50 w-full border-b bg-background">
      <div className="flex h-16 items-center gap-4 px-4">
        {/* Left: Sidebar toggle */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            className="h-9 w-9"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Center: Search */}
        <div className="hidden md:flex flex-1 max-w-md">
          <HeaderSearch />
        </div>

        {/* Right: Notifications + User Menu */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Mobile: Search icon */}
          <div className="md:hidden">
            <HeaderSearch />
          </div>

          <HeaderNotifications />
          {user && <HeaderUserMenu />}
        </div>
      </div>
    </header>
  );
}
