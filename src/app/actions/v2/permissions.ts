"use server";

import { createClient } from "@/utils/supabase/server";
import { PermissionService, type PermissionSnapshot } from "@/server/services/permission.service";

/**
 * Server action to fetch permissions for a given org/branch context
 *
 * @param orgId - Organization ID
 * @param branchId - Branch ID (can be null for org-level permissions)
 * @returns Object with permissions snapshot
 *
 * Security: Validates session server-side, calls PermissionService with RLS
 */
export async function getBranchPermissions(
  orgId: string,
  branchId: string | null
): Promise<{ permissions: PermissionSnapshot }> {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Return empty snapshot if no session
    if (!session) {
      return { permissions: { allow: [], deny: [] } };
    }

    // Fetch permissions using PermissionService (applies RLS)
    const permissions = await PermissionService.getPermissionSnapshotForUser(
      supabase,
      session.user.id,
      orgId,
      branchId
    );

    return { permissions };
  } catch (error) {
    console.error("Failed to fetch permissions:", error);
    // Return empty snapshot on error instead of throwing
    return { permissions: { allow: [], deny: [] } };
  }
}
