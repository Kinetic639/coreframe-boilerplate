"use client";

import { useEffect } from "react";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { useBranchPermissionsQuery } from "@/hooks/queries/v2/use-branch-permissions-query";

/**
 * PermissionsSync Component
 *
 * Syncs permission data from React Query → Zustand store
 * Runs automatically when branch switches (detects activeBranchId change via query key)
 *
 * Architecture:
 * - React Query owns permission fetching
 * - Zustand stores permission snapshot
 * - This component bridges the two
 *
 * Security: Permissions are UI gating only. Server actions must validate server-side.
 */
export function PermissionsSync() {
  const { activeOrgId, activeBranchId } = useAppStoreV2();
  const setPermissionSnapshot = useUserStoreV2((state) => state.setPermissionSnapshot);

  // Only fetch when both org and branch are set
  const { data, isFetched } = useBranchPermissionsQuery({
    orgId: activeOrgId,
    branchId: activeBranchId,
    enabled: !!activeOrgId && !!activeBranchId,
  });

  // Sync to Zustand when data changes
  useEffect(() => {
    if (isFetched && data) {
      // Always update (including empty arrays) to prevent stale state
      setPermissionSnapshot(data.permissions);
    }
  }, [data, isFetched, setPermissionSnapshot]);

  // No UI, just sync logic
  return null;
}
