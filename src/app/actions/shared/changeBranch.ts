"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { BRANCHES_VIEW_UPDATE_ANY, BRANCHES_VIEW_REMOVE_ANY } from "@/lib/constants/permissions";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * changeBranch — secure server action for switching active branch.
 *
 * Validation:
 *   1. Requires authenticated session (getUser(), not getSession()).
 *   2. Branch must belong to the user's active org (prevents cross-org spoofing).
 *   3a. If user has BRANCHES_VIEW_UPDATE_ANY → may switch to any branch in active org.
 *   3b. Otherwise → branch must be in the user's accessibleBranches
 *       (i.e. they have a branch-scoped role assignment or BRANCHES_VIEW_ANY).
 *
 * Returns a structured result (never throws) so the UI can toast on failure.
 */
export async function changeBranch(branchId: string): Promise<ActionResult> {
  if (!branchId || typeof branchId !== "string") {
    return { success: false, error: "Invalid branch ID" };
  }

  const supabase = await createClient();

  // Use getUser() — validates JWT server-side (not just cookie read)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized" };
  }

  // Load the authoritative dashboard context (cached for this request)
  // This gives us: activeOrgId, availableBranches, accessibleBranches, permissionSnapshot
  const context = await loadDashboardContextV2();

  if (!context) {
    return { success: false, error: "Unauthorized" };
  }

  const { activeOrgId, availableBranches, accessibleBranches } = context.app;
  const { permissionSnapshot } = context.user;

  if (!activeOrgId) {
    return { success: false, error: "No active organization" };
  }

  // 1. Branch must exist in org and not be deleted
  const branchInOrg = availableBranches.find((b) => b.id === branchId);
  if (!branchInOrg) {
    return { success: false, error: "Branch not found in your organization" };
  }

  // 2. Authorization check
  const canSwitchToAny = checkPermission(permissionSnapshot, BRANCHES_VIEW_UPDATE_ANY);
  const isAccessible = accessibleBranches.some((b) => b.id === branchId);

  if (!canSwitchToAny && !isAccessible) {
    return { success: false, error: "You do not have access to this branch" };
  }

  // 3. Persist preference
  const { error } = await supabase
    .from("user_preferences")
    .update({ default_branch_id: branchId })
    .eq("user_id", user.id);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[changeBranch] DB update failed:", error);
    }
    return { success: false, error: "Failed to update branch preference" };
  }

  return { success: true };
}

/**
 * removeBranchPreference — clears the user's stored default branch.
 *
 * After clearing, the next page load will fall back to the first accessible branch.
 *
 * Authorization:
 *   - Always allowed for own preference (it's the user's own row).
 *   - BRANCHES_VIEW_REMOVE_ANY grants this explicitly (future: admin-facing flows).
 *   - No further restriction needed since users can only modify their own preferences
 *     (user_preferences RLS: user_preferences_update_own enforces user_id = auth.uid()).
 */
export async function removeBranchPreference(): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized" };
  }

  // Optional: confirm user has BRANCHES_VIEW_REMOVE_ANY or is acting on own record.
  // Since user_preferences RLS already enforces user_id = auth.uid() for UPDATE,
  // a bare authenticated user may reset their own preference without the permission.
  // The permission is reserved for future admin-facing use cases.
  const context = await loadDashboardContextV2();
  const hasRemoveAny = context
    ? checkPermission(context.user.permissionSnapshot, BRANCHES_VIEW_REMOVE_ANY)
    : false;

  // Allow: own preference reset is always permitted (RLS enforces row ownership).
  // hasRemoveAny is checked here for audit/logging purposes; it will be the required
  // gate if admin-facing "reset other user's branch" is added in the future.
  void hasRemoveAny;

  const { error } = await supabase
    .from("user_preferences")
    .update({ default_branch_id: null })
    .eq("user_id", user.id);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[removeBranchPreference] DB update failed:", error);
    }
    return { success: false, error: "Failed to clear branch preference" };
  }

  return { success: true };
}
