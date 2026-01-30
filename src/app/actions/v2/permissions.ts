"use server";

import { createClient } from "@/utils/supabase/server";
import { PermissionServiceV2 } from "@/server/services/permission-v2.service";
import type { PermissionSnapshot } from "@/lib/types/permissions";

// Re-export for backwards compatibility
export type { PermissionSnapshot };

/**
 * Server action to fetch permissions for a given org/branch context
 *
 * **V2 Architecture: "Compile, don't evaluate"**
 *
 * This action fetches pre-compiled effective permissions from the database.
 * The compilation happens via database triggers when:
 * - User role changes
 * - Role permissions change
 * - Permission overrides change
 *
 * No complex logic at request time - just read the facts.
 *
 * @param orgId - Organization ID
 * @param branchId - Branch ID (ignored in V2 - kept for API compatibility)
 * @returns Object with permissions snapshot (allow array, empty deny array)
 *
 * Security: Validates session server-side, uses RLS on user_effective_permissions
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

    // Fetch compiled effective permissions from V2 service
    const permissions = await PermissionServiceV2.getPermissionSnapshotForUser(
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

/**
 * Server action to get effective permissions as an array
 *
 * Simpler API for V2 - just returns the permission slugs.
 *
 * @param orgId - Organization ID
 * @returns Array of permission slugs the current user has
 */
export async function getEffectivePermissions(orgId: string): Promise<string[]> {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return [];
    }

    return await PermissionServiceV2.getEffectivePermissionsArray(supabase, session.user.id, orgId);
  } catch (error) {
    console.error("Failed to fetch effective permissions:", error);
    return [];
  }
}

/**
 * Server action to check if current user has a specific permission
 *
 * More efficient than fetching all permissions when you only need to check one.
 *
 * @param orgId - Organization ID
 * @param permission - Permission slug to check
 * @returns True if user has the permission
 */
export async function checkPermission(orgId: string, permission: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    return await PermissionServiceV2.currentUserHasPermission(supabase, orgId, permission);
  } catch (error) {
    console.error("Failed to check permission:", error);
    return false;
  }
}

/**
 * Server action to check if current user is a member of an organization
 *
 * @param orgId - Organization ID
 * @returns True if user is an active member
 */
export async function checkOrgMembership(orgId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    return await PermissionServiceV2.currentUserIsOrgMember(supabase, orgId);
  } catch (error) {
    console.error("Failed to check org membership:", error);
    return false;
  }
}
