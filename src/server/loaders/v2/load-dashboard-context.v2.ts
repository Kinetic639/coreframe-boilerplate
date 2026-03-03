import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { loadAppContextV2 } from "./load-app-context.v2";
import { loadUserContextV2 } from "./load-user-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { BRANCHES_VIEW_ANY } from "@/lib/constants/permissions";
import type { AppContextV2, BranchDataV2 } from "@/lib/stores/v2/app-store";
import type { UserContextV2 } from "@/lib/stores/v2/user-store";
import type { PermissionSnapshot } from "@/server/services/permission.service";

/**
 * Combined Dashboard Context V2
 */
export interface DashboardContextV2 {
  app: AppContextV2;
  user: UserContextV2;
}

/**
 * Compute the set of branches the user may see in the branch switcher.
 *
 * Rules (in priority order):
 *   1. If user has BRANCHES_VIEW_ANY → return all non-deleted org branches.
 *   2. Otherwise → return only branches where the user has a branch-scoped
 *      role assignment (user_role_assignments WHERE scope='branch').
 *      RLS "View own role assignments" policy allows this without members.read.
 *
 * Branches are returned in the same deterministic order as allBranches (created_at ASC).
 */
async function _computeAccessibleBranches(
  userId: string,
  activeOrgId: string,
  allBranches: BranchDataV2[],
  permissionSnapshot: PermissionSnapshot
): Promise<BranchDataV2[]> {
  // Fast path: user has global branch visibility
  if (checkPermission(permissionSnapshot, BRANCHES_VIEW_ANY)) {
    return allBranches;
  }

  // Slow path: fetch only the user's own branch-scoped assignments.
  // RLS "View own role assignments" (user_id = auth.uid()) allows this
  // without requiring members.read permission.
  const supabase = await createClient();
  const { data: assignments, error } = await supabase
    .from("user_role_assignments")
    .select("scope_id")
    .eq("user_id", userId)
    .eq("scope", "branch")
    .is("deleted_at", null);

  if (error && process.env.NODE_ENV === "development") {
    console.error("[computeAccessibleBranches] Assignment query failed:", error);
  }

  const assignedBranchIds = new Set((assignments ?? []).map((a) => a.scope_id));

  // Filter allBranches to those with a matching assignment in this org (defensive)
  return allBranches.filter(
    (b) => assignedBranchIds.has(b.id) && b.organization_id === activeOrgId
  );
}

/**
 * V2 Combined Dashboard Context Loader
 *
 * Single entrypoint for Dashboard V2 that guarantees consistency.
 *
 * How it works:
 * 1. Load app context (resolves org/branch, fetches ALL available branches)
 * 2. Load user context for RESOLVED org/branch (permissions match active branch)
 * 3. Compute accessibleBranches from permission snapshot + user assignments
 * 4. Re-validate activeBranch against accessibleBranches (correct if needed)
 *
 * Contract:
 * - Returns null when no session exists
 * - app.accessibleBranches is authoritative for UI (branch switcher must use this)
 * - app.availableBranches is the full set (server-side changeBranch validation only)
 * - activeBranchId is guaranteed to be in accessibleBranches (or null if none accessible)
 *
 * @returns DashboardContextV2 or null
 */
async function _loadDashboardContextV2(): Promise<DashboardContextV2 | null> {
  // 1. Load app context (resolves org/branch, fetches ALL available branches)
  const appContext = await loadAppContextV2();

  if (!appContext) {
    return null;
  }

  // 2. Load user context for the RESOLVED org/branch
  let userContext = await loadUserContextV2(appContext.activeOrgId, appContext.activeBranchId);

  if (!userContext) {
    return null;
  }

  // 3. Compute accessibleBranches (requires permission snapshot + user assignments)
  let accessibleBranches: BranchDataV2[] = [];

  if (appContext.activeOrgId) {
    accessibleBranches = await _computeAccessibleBranches(
      userContext.user.id,
      appContext.activeOrgId,
      appContext.availableBranches,
      userContext.permissionSnapshot
    );
  }

  // 4. Re-validate activeBranch: if current preference is not in accessibleBranches,
  //    fall back to first accessible branch (or null if user has none).
  let activeBranchId = appContext.activeBranchId;
  let activeBranch = appContext.activeBranch;

  const isActiveAccessible =
    activeBranchId !== null && accessibleBranches.some((b) => b.id === activeBranchId);

  if (!isActiveAccessible) {
    activeBranchId = accessibleBranches[0]?.id ?? null;
    activeBranch = accessibleBranches[0] ?? null;

    // activeBranchId changed — reload userContext so permissionSnapshot reflects
    // branch-scoped roles for the correct branch, not the original stale branch.
    if (activeBranchId !== appContext.activeBranchId) {
      const reloadedContext = await loadUserContextV2(appContext.activeOrgId, activeBranchId);
      if (reloadedContext) {
        userContext = reloadedContext;
      }
    }
  }

  // 5. Return combined context with accessibleBranches stitched into app
  return {
    app: {
      ...appContext,
      accessibleBranches,
      activeBranchId,
      activeBranch,
    },
    user: userContext,
  };
}

/**
 * Cached version of loadDashboardContextV2 (deduplicates multiple calls in same request)
 */
export const loadDashboardContextV2 = cache(_loadDashboardContextV2);
