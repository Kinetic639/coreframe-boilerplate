"use client";

import { StatusBarMessage } from "./StatusBarMessage";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ColorThemeSwitcher } from "@/components/color-theme-switcher";
import { CompactBreadcrumbs } from "@/components/v2/layout/compact-breadcrumbs";

export function DashboardStatusBar() {
  // TODO: Make breadcrumbs dynamic based on current route/page context
  const breadcrumbs = [{ label: "Dashboard", href: "/dashboard/start" }];

  return (
    <div className="sticky bottom-0 z-20 flex h-8 items-center justify-between border-t bg-muted/30 px-4 text-xs shadow-lg">
      <div className="flex items-center space-x-2">
        <CompactBreadcrumbs breadcrumbs={breadcrumbs} />
      </div>
      <div className="flex items-center gap-2">
        <StatusBarMessage message="Status: All systems nominal" />
        <div className="flex items-center gap-1">
          <ColorThemeSwitcher variant="icon" />
          <ThemeSwitcher />
        </div>
      </div>
    </div>
  );
}
