"use client";

import { useDashboardSettingsQuery } from "@/hooks/queries/user-preferences";
import { Loader2 } from "lucide-react";

interface DashboardInitialLoaderProps {
  children: React.ReactNode;
}

/**
 * Dashboard Initial Loader
 *
 * Shows a loading screen until initial settings are fetched from the database.
 * This prevents flash of unstyled content (FOUC) and settings changing on screen.
 *
 * Flow:
 * 1. User logs in and is redirected to dashboard
 * 2. This component shows loading screen
 * 3. Settings are fetched from database
 * 4. Once fetched, dashboard content is shown with correct settings applied
 *
 * @param children - Dashboard content to show after settings load
 */
export function DashboardInitialLoader({ children }: DashboardInitialLoaderProps) {
  const { isFetched } = useDashboardSettingsQuery();

  // Show loading screen until settings are fetched
  if (!isFetched) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Settings loaded, show dashboard content
  return <>{children}</>;
}
