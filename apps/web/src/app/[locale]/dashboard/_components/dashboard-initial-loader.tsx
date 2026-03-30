"use client";

import Loader from "@/components/ui/Loader";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";

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
    return <Loader fullScreen message="Loading dashboard..." className="bg-background" />;
  }

  // Hydrated, show dashboard content
  return <>{children}</>;
}
