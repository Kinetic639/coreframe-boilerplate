"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { HeaderSearch } from "./header-search";
import { HeaderNotifications } from "./header-notifications";
import { HeaderUserMenu } from "./header-user-menu";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";

/**
 * Dashboard Header V2
 *
 * Main header component for Dashboard V2 layout
 * Follows shadcn/ui sidebar-07 pattern
 *
 * Features:
 * - Sidebar toggle button (integrated from shadcn)
 * - Global search with command palette (Cmd+K)
 * - Notifications bell (placeholder)
 * - User profile menu with avatar
 *
 * Layout:
 * - Left: Sidebar trigger + separator
 * - Center: Search bar
 * - Right: Notifications + User menu
 *
 * SSR-first: Reads from Zustand stores hydrated on server
 */
export function DashboardHeaderV2() {
  const { user } = useUserStoreV2();

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
      </div>

      {/* Center: Search */}
      <div className="hidden md:flex flex-1 max-w-md">
        <HeaderSearch />
      </div>

      {/* Right: Notifications + User Menu */}
      <div className="flex items-center gap-2 ml-auto px-4">
        {/* Mobile: Search icon */}
        <div className="md:hidden">
          <HeaderSearch />
        </div>

        <HeaderNotifications />
        {user && <HeaderUserMenu />}
      </div>
    </header>
  );
}
