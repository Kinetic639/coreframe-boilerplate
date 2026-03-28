"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { getSessionBranchId, setSessionBranchId, clearSessionBranchId } from "@/lib/session-branch";
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

  // Hydrate stores and resolve session-local active branch on every context change.
  //
  // Ordering:
  //   1. hydrateFromServer — sets activeBranchId from SSR-derived DB preference
  //   2. Session-branch override — if this tab already has a working branch in
  //      sessionStorage, use it instead of the DB default. This prevents another
  //      client's branch switch (which writes default_branch_id) from silently
  //      changing this tab's working context on refresh.
  //   3. Stale-entry clearing — if the session branch is no longer in
  //      accessibleBranches (access revoked, branch deleted), clear the stale
  //      entry and fall back to the SSR-derived branch, which is then written
  //      to sessionStorage so subsequent refreshes are stable.
  useEffect(() => {
    useAppStoreV2.getState().hydrateFromServer(context.app);
    useUserStoreV2.getState().hydrateFromServer(context.user);

    const orgId = context.app?.activeOrgId;
    if (orgId) {
      const sessionBranchId = getSessionBranchId(orgId);

      if (sessionBranchId) {
        const isAccessible = (context.app.accessibleBranches ?? []).some(
          (b) => b.id === sessionBranchId
        );

        if (isAccessible) {
          // Session branch is still valid — override SSR-derived branch
          useAppStoreV2.getState().setActiveBranch(sessionBranchId);
        } else {
          // Stale entry: branch was deleted or access revoked.
          // Clear it so it is not re-read on subsequent refreshes.
          clearSessionBranchId(orgId);
          // Initialize sessionStorage from the SSR-derived (DB default) branch
          if (context.app.activeBranchId) {
            setSessionBranchId(orgId, context.app.activeBranchId);
          }
        }
      } else {
        // Fresh tab: no session entry yet.
        // Seed sessionStorage from the SSR-derived branch so future refreshes
        // on this tab are stable against other clients' DB writes.
        if (context.app.activeBranchId) {
          setSessionBranchId(orgId, context.app.activeBranchId);
        }
      }
    }
  }, [context]);

  return (
    <QueryClientProvider client={queryClient}>
      <PermissionsSync />
      <DashboardInitialLoader>{children}</DashboardInitialLoader>
    </QueryClientProvider>
  );
}
