"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import type { DashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { PermissionsSync } from "./_components/permissions-sync";
import { DashboardInitialLoader } from "./_components/dashboard-initial-loader";
// UiSettingsSync removed - using manual Save/Load instead of auto-sync

interface DashboardV2ProvidersProps {
  context: DashboardContextV2;
  children: React.ReactNode;
}

/**
 * Dashboard V2 Providers
 *
 * Main provider component that:
 * 1. Creates QueryClient for React Query
 * 2. Hydrates V2 stores from server context
 * 3. Includes PermissionsSync for automatic permission updates
 *
 * Pattern: Server loads context → Client hydrates stores → Components use hydrated data
 */
export function DashboardV2Providers({ context, children }: DashboardV2ProvidersProps) {
  // Create QueryClient once per component instance (not per render)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute default
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  // Hydrate stores on mount
  useEffect(() => {
    useAppStoreV2.getState().hydrateFromServer(context.app);
    useUserStoreV2.getState().hydrateFromServer(context.user);
  }, [context]);

  return (
    <QueryClientProvider client={queryClient}>
      <PermissionsSync />
      <DashboardInitialLoader>{children}</DashboardInitialLoader>
    </QueryClientProvider>
  );
}
