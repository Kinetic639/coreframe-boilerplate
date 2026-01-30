"use client";

import { Shield } from "lucide-react";

/**
 * Admin Sidebar Header
 *
 * Header component for admin panel sidebar
 * Displays admin panel title with icon
 */
export function AdminSidebarHeader() {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-red-600 text-white">
        <Shield className="size-4" />
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-semibold">Admin Panel</span>
        <span className="truncate text-xs text-muted-foreground">System Management</span>
      </div>
    </div>
  );
}
