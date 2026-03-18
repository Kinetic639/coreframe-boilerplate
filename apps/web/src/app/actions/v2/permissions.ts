"use server";

import { createClient } from "@/utils/supabase/server";
import { PermissionServiceV2 } from "@/server/services/permission-v2.service";
import type { PermissionSnapshot } from "@/lib/types/permissions";

/**
 * Server action to fetch permissions for a given org/branch context.
 *
 * Reads from the compiled `user_effective_permissions` table (branch-aware) —
 * the same source of truth as the DB `has_branch_permission` function and the
 * SSR `loadUserContextV2` loader. This ensures PermissionsSync delivers an
 * identical snapshot to what was rendered server-side.
 *
 * Branch-aware semantics (mirrors DB `has_branch_permission`):
 *   - Includes org-wide rows (branch_id IS NULL) always.
 *   - When branchId is set, also includes rows for that exact branch.
 *   - When branchId is null, returns org-scope rows only.
 *
 * @param orgId - Organization ID
 * @param branchId - Active branch ID (null = org-scope only)
 * @returns Object with permissions snapshot (allow array, empty deny array)
 *
 * Security: JWT-validated via getUser() server-side; fail-closed (empty snapshot on error).
 */
export async function getBranchPermissions(
  orgId: string,
  branchId: string | null
): Promise<{ permissions: PermissionSnapshot }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Fail-closed: no user or auth error → empty snapshot
    if (authError || !user) {
      return { permissions: { allow: [], deny: [] } };
    }

    // Use compiled UEP query — branch-aware, mirrors has_branch_permission semantics.
    const permissions = await PermissionServiceV2.getPermissionSnapshotForUser(
      supabase,
      user.id,
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
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return [];
    }

    return await PermissionServiceV2.getOrgEffectivePermissionsArray(supabase, user.id, orgId);
  } catch (error) {
    console.error("Failed to fetch effective permissions:", error);
    return [];
  }
}

/**
 * Server action to check if current user has a specific permission via DB RPC.
 *
 * Uses `has_permission(org_id, slug)` — an **exact string match** against
 * `user_effective_permissions WHERE branch_id IS NULL`. This is intentionally
 * NOT wildcard-aware: it is appropriate only for checking concrete non-wildcard slugs.
 *
 * For wildcard-aware checks use `checkPermission(snapshot, slug)` from
 * `@/lib/utils/permissions` with a pre-fetched PermissionSnapshot.
 *
 * Renamed from `checkPermission` to avoid collision with the wildcard-aware utility
 * function of the same name exported from `@/lib/utils/permissions`.
 *
 * @param orgId - Organization ID
 * @param permission - Non-wildcard permission slug to check
 * @returns True if user has the exact permission (org-scope, DB RPC)
 */
export async function checkOrgPermissionExact(orgId: string, permission: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    return await PermissionServiceV2.currentUserHasPermission(supabase, orgId, permission);
  } catch (error) {
    console.error("Failed to check permission:", error);
    return false;
  }
}

/**
 * A single permission entry with scope metadata (for debug panel).
 */
export interface DetailedPermission {
  slug: string;
  scope: "org" | "branch";
  branch_id: string | null;
  branch_name: string | null;
}

/**
 * Server action to get all permission assignments with scope and branch metadata.
 *
 * Used by the debug panel to show per-permission scope and branch context.
 * Reads directly from the compiled `user_effective_permissions` table (UEP) —
 * the single source of truth — rather than deriving from role assignments.
 *
 * Wildcard slugs (e.g. `account.*`, `module.*`) are preserved as-is from UEP.
 * Branch names are resolved server-side with org isolation; RLS failure on the
 * branches lookup is handled gracefully (branch_name → null, no throw).
 *
 * Sort order: org-scope first, then branch_name ASC, then slug ASC.
 *
 * @param orgId - Organization ID
 * @returns Array of detailed permission entries (slug + scope + branch_id + branch_name)
 */
export async function getDetailedPermissions(orgId: string): Promise<DetailedPermission[]> {
  try {
    const supabase = await createClient();

    // Use getUser() to validate JWT server-side (not getSession() which is cookie-only).
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return [];

    const userId = user.id;

    // Read compiled UEP — single source of truth (org-isolated by organization_id).
    const { data: uepRows, error: uepError } = await supabase
      .from("user_effective_permissions")
      .select("permission_slug, branch_id")
      .eq("user_id", userId)
      .eq("organization_id", orgId);

    if (uepError) {
      console.error("[getDetailedPermissions] UEP query failed:", uepError);
      return [];
    }

    const rows = uepRows ?? [];

    // Collect unique branch IDs from branch-scoped rows.
    const branchIds = [
      ...new Set(rows.map((r) => r.branch_id).filter((id): id is string => id !== null)),
    ];

    // Resolve branch names with org isolation — prevents cross-org name leakage.
    // On RLS failure or query error, gracefully set branch_name = null (no throw).
    const branchNameMap = new Map<string, string>();
    if (branchIds.length > 0) {
      const { data: branchRows, error: branchError } = await supabase
        .from("branches")
        .select("id, name")
        .in("id", branchIds)
        .eq("organization_id", orgId);

      if (!branchError) {
        (branchRows ?? []).forEach((b) => branchNameMap.set(b.id, b.name));
      }
    }

    // Map UEP rows → DetailedPermission.
    const result: DetailedPermission[] = rows.map((r) => ({
      slug: r.permission_slug,
      scope: r.branch_id === null ? "org" : "branch",
      branch_id: r.branch_id,
      branch_name: r.branch_id !== null ? (branchNameMap.get(r.branch_id) ?? null) : null,
    }));

    // Deterministic sort: org first, then branch_name ASC (nulls last), then slug ASC.
    result.sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === "org" ? -1 : 1;
      const aName = a.branch_name ?? "\uFFFF";
      const bName = b.branch_name ?? "\uFFFF";
      if (aName !== bName) return aName.localeCompare(bName);
      return a.slug.localeCompare(b.slug);
    });

    return result;
  } catch (error) {
    console.error("Failed to fetch detailed permissions:", error);
    return [];
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
