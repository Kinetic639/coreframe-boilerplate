"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { GlobalSearchDialog } from "@/components/v2/global-search/global-search-dialog";
import { GlobalSearchTrigger } from "@/components/v2/global-search/global-search-trigger";
import type { SearchEntry } from "@/lib/global-search/types";
import type { SearchSourceId } from "@/lib/global-search/sources";
import { HeaderNotifications } from "./header-notifications";
import { HeaderMessages } from "./header-messages";
import { HeaderContacts } from "./header-contacts";
import { HeaderQuickAdd } from "./header-quick-add";

/**
 * Dashboard Header V2
 *
 * Main header component for Dashboard V2 layout
 * Follows shadcn/ui sidebar-07 pattern
 *
 * Features:
 * - Sidebar toggle button (integrated from shadcn)
 * - Global search palette (Ctrl+K / ⌘K) — pages and actions resolved server-side
 * - Messages drawer
 * - Notifications drawer
 * - Contacts drawer
 *
 * Layout:
 * - Left: Sidebar trigger + separator
 * - Center: Search bar
 * - Right: Contacts + Messages + Notifications
 *
 * Note: Recent activity is accessible via the status bar at the bottom.
 * Note: User menu is available in the sidebar footer.
 */
interface DashboardHeaderV2Props {
  /** Server-resolved global search entries (pages + actions) */
  searchEntries?: SearchEntry[];
  /** Data sources the user may search (scope chips) */
  searchSources?: SearchSourceId[];
}

export function DashboardHeaderV2({
  searchEntries = [],
  searchSources = [],
}: DashboardHeaderV2Props) {
  return (
    <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center gap-2 bg-muted shadow-sm transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-6">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 h-4" />
      </div>

      {/* Center: Search */}
      <div className="hidden md:flex flex-1 max-w-md">
        <GlobalSearchTrigger variant="bar" />
      </div>

      {/* Right: Quick Add + Contacts + Messages + Notifications */}
      <div className="flex items-center gap-2 ml-auto px-6">
        {/* Mobile: Search icon */}
        <div className="md:hidden">
          <GlobalSearchTrigger variant="icon" />
        </div>

        <HeaderQuickAdd />
        <HeaderContacts />
        <HeaderMessages />
        <HeaderNotifications />
      </div>

      {/* Mounted once: both triggers open this palette */}
      <GlobalSearchDialog entries={searchEntries} sources={searchSources} />
    </header>
  );
}
