"use client";

import { useQuery } from "@tanstack/react-query";
import { getBranchPermissions } from "@/app/actions/v2/permissions";
import type { PermissionSnapshot } from "@/lib/types/permissions";

interface UseBranchPermissionsQueryOptions {
  orgId: string | null;
  branchId: string | null;
  enabled?: boolean;
}

/**
 * React Query hook to fetch permissions for a specific org/branch context
 *
 * Auto-refetches when orgId or branchId changes (detected via query key)
 * Only enabled when both IDs are present
 *
 * @param options - Query options with orgId, branchId, and enabled flag
 * @returns React Query result with permissions snapshot
 */
export function useBranchPermissionsQuery({
  orgId,
  branchId,
  enabled = true,
}: UseBranchPermissionsQueryOptions) {
  return useQuery<{ permissions: PermissionSnapshot }>({
    queryKey: ["v2", "permissions", orgId, branchId],
    queryFn: async () => {
      // Defensive: Return empty snapshot if no orgId
      if (!orgId) return { permissions: { allow: [], deny: [] } };

      // Call server action
      return getBranchPermissions(orgId, branchId);
    },
    enabled: enabled && !!orgId && !!branchId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
