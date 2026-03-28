import type { SupabaseClient } from "@supabase/supabase-js";
import type { PermissionSnapshot } from "@repo/contracts/permissions";

// ─── Result ───────────────────────────────────────────────────────────────────

/**
 * Discriminated union returned by loadBranchPermissionsData.
 *
 * "resolved"       — query succeeded; branchPermissions contains the snapshot
 *                    (allow may be empty — a branch with no effective permissions
 *                    is valid and distinct from a load failure).
 * "forbidden"      — RLS denied access (42501 / HTTP 403).
 * "invalid-session"— 401 / expired token. Caller should defer to the auth layer.
 * "error"          — unexpected server or network failure.
 */
export type BranchPermissionsLoadResult =
  | { kind: "resolved"; branchPermissions: PermissionSnapshot }
  | { kind: "forbidden" }
  | { kind: "invalid-session" }
  | { kind: "error"; message: string };

// ─── Error classification ─────────────────────────────────────────────────────

/**
 * Mirrors the classifyError strategy in bootstrap-loader.ts.
 * Each loader owns its own classification to avoid coupling between loaders.
 */
function classifyError(
  status: number,
  code: string | undefined,
  message: string
): Exclude<BranchPermissionsLoadResult, { kind: "resolved" }> {
  if (status === 401) return { kind: "invalid-session" };
  if (status === 403) return { kind: "forbidden" };
  if (code === "42501") return { kind: "forbidden" };
  return { kind: "error", message };
}

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Loads branch-scoped permissions for a specific branch from
 * user_effective_permissions (branch_id = branchId rows).
 *
 * Used by AppProvider's branch-reload effect when activeBranchId changes
 * (either from bootstrap initialization or from switchBranch). Intentionally
 * separated from loadBootstrapData so that a branch switch reloads only
 * branch permissions — not entitlements, org profile, or user preferences.
 *
 * The caller (AppProvider) is responsible for cancellation via the returned
 * cleanup function (cancelled flag pattern). This function itself has no
 * internal cancellation mechanism.
 *
 * @param supabase  Authenticated Supabase client
 * @param userId    Authenticated user's UUID
 * @param orgId     Active organization UUID
 * @param branchId  Active branch UUID to scope the query — must be non-null
 */
export async function loadBranchPermissionsData(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
  branchId: string
): Promise<BranchPermissionsLoadResult> {
  const { data, error, status } = await supabase
    .from("user_effective_permissions")
    .select("permission_slug_exact")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .eq("branch_id", branchId);

  if (error) {
    return classifyError(status, error.code, error.message);
  }

  const branchPermissions: PermissionSnapshot = {
    allow: (data ?? [])
      .map((r) => r.permission_slug_exact)
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .sort(),
    deny: [],
  };

  return { kind: "resolved", branchPermissions };
}
