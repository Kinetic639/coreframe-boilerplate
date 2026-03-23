import type { SupabaseClient } from "@supabase/supabase-js";
import type { PermissionSnapshot } from "@repo/contracts/permissions";
import type { OrganizationEntitlements } from "@repo/contracts/entitlements";

import { normalizeEntitlements } from "../normalizers/normalize-entitlements";

// ─── Result ───────────────────────────────────────────────────────────────────

/**
 * Discriminated union returned by loadBootstrapData.
 *
 * Semantic rules:
 *
 * "resolved"       — both queries returned without error.
 *                    entitlements === null means no subscription row exists in
 *                    organization_entitlements. This is a valid state for
 *                    free-tier orgs and must NOT be treated as a failure.
 *                    It is semantically distinct from "error".
 *
 * "forbidden"      — the authenticated user is not authorized to read the org's
 *                    data (RLS denied, 403, or insufficient_privilege from DB).
 *
 * "invalid-session"— the session token is expired or revoked (401). Caller
 *                    must trigger re-authentication.
 *
 * "error"          — unexpected server or network failure. Caller may retry.
 */
export type BootstrapLoadResult =
  | {
      kind: "resolved";
      permissions: PermissionSnapshot;
      /** null = no subscription row; distinct from a load error */
      entitlements: OrganizationEntitlements | null;
    }
  | { kind: "forbidden" }
  | { kind: "invalid-session" }
  | { kind: "error"; message: string };

// ─── Error classification ─────────────────────────────────────────────────────

/**
 * Maps a PostgREST / Supabase error to a BootstrapLoadResult failure kind.
 *
 * Classification strategy (in priority order):
 *
 * 1. HTTP `status` — the most reliable signal. 401 → invalid-session,
 *    403 → forbidden. All other non-2xx statuses map to "error".
 *
 * 2. PostgREST / PostgreSQL `code` — used as a secondary hint when `status`
 *    alone is ambiguous. Specifically:
 *    - "42501" (SQLSTATE insufficient_privilege) → forbidden. Some PostgREST
 *      deployments surface RLS denials with a non-403 HTTP status; the SQLSTATE
 *      code provides a more direct classification in those cases.
 *
 * 3. Unknown combinations → "error" (fail-closed). We never silently convert
 *    an unclassified failure into a "resolved" state.
 */
function classifyError(
  status: number,
  code: string | undefined,
  message: string
): Exclude<BootstrapLoadResult, { kind: "resolved" }> {
  // Primary: HTTP status
  if (status === 401) return { kind: "invalid-session" };
  if (status === 403) return { kind: "forbidden" };

  // Secondary hint: PostgreSQL SQLSTATE
  // 42501 = insufficient_privilege — RLS policy rejected at the DB level.
  // May surface without a 403 HTTP status depending on PostgREST configuration.
  if (code === "42501") return { kind: "forbidden" };

  // All other cases: generic error, fail-closed
  return { kind: "error", message };
}

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Loads org-scoped permissions and entitlements for the authenticated user.
 *
 * Reads from two pre-compiled tables updated by DB triggers:
 * - user_effective_permissions — wildcard-expanded, concrete slugs only
 * - organization_entitlements  — compiled plan + addon + override snapshot
 *
 * The mobile client is NOT an authorization authority. This data is used
 * exclusively for UI gating (show/hide, enable/disable). All mutating
 * operations are enforced by server-side RLS regardless of this snapshot.
 *
 * @param supabase  - Authenticated Supabase client (mobileSupabase singleton)
 * @param userId    - Authenticated user's UUID
 * @param orgId     - Active organization UUID to scope the queries
 */
export async function loadBootstrapData(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<BootstrapLoadResult> {
  // ── 1. Permissions ────────────────────────────────────────────────────────
  // Org-scope rows only (branch_id IS NULL). An empty result set is valid
  // and becomes allow: [] — a user with no assigned roles is a legitimate state.
  const {
    data: permRows,
    error: permError,
    status: permStatus,
  } = await supabase
    .from("user_effective_permissions")
    .select("permission_slug_exact")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .is("branch_id", null);

  if (permError) {
    return classifyError(permStatus, permError.code, permError.message);
  }

  // ── 2. Entitlements ───────────────────────────────────────────────────────
  // maybeSingle() returns { data: null, error: null } when no row is found.
  // This is not an error — it means the org has no subscription row.
  // normalizeEntitlements is only invoked when a row is present.
  const {
    data: entRow,
    error: entError,
    status: entStatus,
  } = await supabase
    .from("organization_entitlements")
    .select(
      "organization_id, plan_id, plan_name, enabled_modules, enabled_contexts, features, limits, updated_at"
    )
    .eq("organization_id", orgId)
    .maybeSingle();

  if (entError) {
    return classifyError(entStatus, entError.code, entError.message);
  }

  // ── 3. Build snapshot ─────────────────────────────────────────────────────
  const permissions: PermissionSnapshot = {
    allow: (permRows ?? [])
      .map((r) => r.permission_slug_exact as string)
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .sort(),
    deny: [],
  };

  // entRow is null when no subscription row exists — that's passed through
  // as null. The normalizer is only called when a concrete row was returned.
  const entitlements: OrganizationEntitlements | null =
    entRow !== null ? normalizeEntitlements(entRow as Record<string, unknown>) : null;

  return { kind: "resolved", permissions, entitlements };
}
