"use client";

import { CompactBreadcrumbs } from "@/components/v2/layout/compact-breadcrumbs";
import { DashboardStatusBarActivity } from "@/components/activity/DashboardStatusBarActivity";
import type { ProjectedEvent } from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DashboardStatusBarProps {
  /** SSR-loaded initial recent events — passed through to the activity controller */
  initialRecentEvents: ProjectedEvent[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardStatusBar({ initialRecentEvents }: DashboardStatusBarProps) {
  // TODO: Make breadcrumbs dynamic based on current route/page context
  const breadcrumbs = [{ label: "Dashboard", href: "/dashboard/start" }];

  return (
    <div className="sticky bottom-0 z-20 flex h-8 items-center justify-between bg-muted px-6 text-xs shadow-[0_-1px_3px_0_rgb(0,0,0,0.1)]">
      <div className="flex items-center space-x-2">
        <CompactBreadcrumbs breadcrumbs={breadcrumbs} />
      </div>
      <DashboardStatusBarActivity initialEvents={initialRecentEvents} />
    </div>
  );
}
