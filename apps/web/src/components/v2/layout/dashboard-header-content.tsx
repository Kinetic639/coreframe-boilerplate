"use client";

import { HeaderSearch } from "./header-search";
import { HeaderNotifications } from "./header-notifications";
import { HeaderUserMenu } from "./header-user-menu";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";

/**
 * Dashboard Header Content
 *
 * Contains the main header elements (search, notifications, user menu)
 * Used inside the header element in layout
 */
export function DashboardHeader() {
  const { user } = useUserStoreV2();

  return (
    <div className="flex w-full items-center justify-between">
      {/* Search - hidden on mobile, shown on md+ */}
      <div className="hidden md:flex flex-1 max-w-md">
        <HeaderSearch />
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Mobile search */}
        <div className="md:hidden">
          <HeaderSearch />
        </div>

        <HeaderNotifications />

        {user && <HeaderUserMenu />}
      </div>
    </div>
  );
}
