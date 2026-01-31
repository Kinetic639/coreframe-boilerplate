"use client";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { ColorThemeSwitcher } from "@/components/color-theme-switcher";
import { CompactBreadcrumbs } from "@/components/v2/layout/compact-breadcrumbs";
import { StatusBarHistory } from "@/components/v2/layout/status-bar-history";

export function DashboardStatusBar() {
  // TODO: Make breadcrumbs dynamic based on current route/page context
  const breadcrumbs = [{ label: "Dashboard", href: "/dashboard/start" }];

  return (
    <div className="sticky bottom-0 z-20 flex h-8 items-center justify-between bg-muted px-6 text-xs shadow-[0_-1px_3px_0_rgb(0,0,0,0.1)]">
      <div className="flex items-center space-x-2">
        <CompactBreadcrumbs breadcrumbs={breadcrumbs} />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <ColorThemeSwitcher variant="icon" />
          <ThemeSwitcher />
        </div>
        <StatusBarHistory />
      </div>
    </div>
  );
}
