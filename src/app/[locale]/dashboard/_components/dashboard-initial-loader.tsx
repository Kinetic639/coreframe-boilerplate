"use client";

import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import { Loader2 } from "lucide-react";

interface DashboardInitialLoaderProps {
  children: React.ReactNode;
}

/**
 * Dashboard Initial Loader
 *
 * Shows a loading screen until Zustand hydrates from localStorage.
 * This prevents flash of unstyled content (FOUC) and settings changing on screen.
 *
 * Uses _hasHydrated from Zustand's onRehydrateStorage callback - deterministic,
 * no arbitrary timeouts, no React Query dependency that could cause re-render cascades.
 *
 * @param children - Dashboard content to show after hydration
 */
export function DashboardInitialLoader({ children }: DashboardInitialLoaderProps) {
  const hasHydrated = useUiStoreV2((s) => s._hasHydrated);

  // Show loading screen until Zustand hydrates from localStorage
  if (!hasHydrated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Hydrated, show dashboard content
  return <>{children}</>;
}
