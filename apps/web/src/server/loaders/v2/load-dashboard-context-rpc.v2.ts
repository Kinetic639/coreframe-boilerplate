import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AuthService } from "@/server/services/auth.service";
import { getAuthUser } from "@/server/auth/get-auth-user";
import { getSignedAvatarUrl } from "@/server/storage/avatar-signed-url";
import { checkPermission } from "@/lib/utils/permissions";
import { BRANCHES_VIEW_ANY } from "@/lib/constants/permissions";
import { resolveActiveBranch } from "@repo/domain/branch";
import type { ActiveOrgV2, BranchDataV2 } from "@/lib/stores/v2/app-store";
import type { UserV2 } from "@/lib/stores/v2/user-store";
import type { PermissionSnapshot } from "@/lib/types/permissions";
import type { DashboardContextV2 } from "./load-dashboard-context.v2";

/**
 * Dashboard context from one database call (get_dashboard_context_v2).
 *
 * The step by step loaders (loadAppContextV2 + loadUserContextV2 + the
 * accessible-branch query) take 6 to 8 requests to Supabase on every page
 * load. The RPC returns the same rows in one request, under the user's RLS
 * (SECURITY INVOKER), and the rules below are the same as in those loaders:
 *   - branch: preferences.default_branch_id if it exists, else the first branch
 *   - permission snapshot: org-scope slugs + slugs for the chosen branch
 *   - accessible branches: all with branches.view.any, else assigned ones
 *   - the chosen branch must be accessible, else the first accessible one
 *
 * Returns:
 *   - DashboardContextV2 when the RPC answered
 *   - null when there is no session (same as the old loaders)
 *   - undefined when the RPC is not usable (not deployed yet, or an error):
 *     the caller then falls back to the step by step loaders.
 */

interface RpcBranch {
  id: string;
  name: string;
  organization_id: string;
  branch_number: number | null;
  slug: string | null;
  public_warehouse_maps_enabled: boolean | null;
  created_at: string;
}

export interface DashboardContextRpcPayload {
  preferences: { organization_id: string | null; default_branch_id: string | null } | null;
  active_org_id: string | null;
  org: {
    id: string;
    name: string;
    slug: string | null;
    profile: {
      name: string | null;
      name_2: string | null;
      slug: string | null;
      logo_url: string | null;
    } | null;
  } | null;
  branches: RpcBranch[] | null;
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    avatar_path: string | null;
  } | null;
  org_permissions: string[] | null;
  branch_permissions: Record<string, string[]> | null;
  branch_assignment_ids: string[] | null;
}

// Set once the database says the function does not exist, so an instance
// running before the migration is applied does not ask again on every request.
let rpcMissing = false;

/**
 * Short cache of the built context, shared by requests on the same server
 * instance.
 *
 * A dashboard page fires several server actions as it mounts (task list,
 * members, comments, chat, counters) and each one is its own request, so
 * React's per-request cache did not help: every action asked the database for
 * the same context again. With this cache the page and the actions that
 * follow it within a few seconds share one answer.
 *
 * Key: the user id, the session's access token (hashed) and the context
 * version cookie. Another user, another session or a refreshed token never
 * hit the same entry. Requests that arrive while the first one is still
 * waiting share its promise.
 *
 * Freshness: an entry lives CONTEXT_TTL_MS. Changes the user makes to their
 * own context (branch, organization, profile, branches, organization profile)
 * call bumpDashboardContextVersion(), which sets a new version cookie, so the
 * next request misses on every instance. Changes made by someone else (an
 * admin changes this user's roles) show up within CONTEXT_TTL_MS; reads and
 * writes are still checked by RLS on every query.
 */
export const CONTEXT_TTL_MS = 10_000;
const CONTEXT_CACHE_MAX = 500;
export const CONTEXT_VERSION_COOKIE = "ambra-ctx-v";

type CacheEntry = {
  expiresAt: number;
  userId: string;
  value: Promise<DashboardContextV2 | null | undefined>;
};
const contextCache = new Map<string, CacheEntry>();

/** Test hook: forget that the RPC was missing and drop cached contexts. */
export function __resetDashboardContextRpcState() {
  rpcMissing = false;
  contextCache.clear();
}

/** Drops this instance's cached contexts for one user. */
export function forgetCachedDashboardContext(userId: string) {
  for (const [key, entry] of contextCache) {
    if (entry.userId === userId) contextCache.delete(key);
  }
}

/**
 * Call after a change to the current user's dashboard context (branch,
 * organization, own profile, branches, organization profile). Sets a new
 * context version cookie, so the following requests on every instance load
 * the context again, and drops this instance's entries for the user.
 * Must run in a server action or route handler (it sets a cookie).
 */
export async function bumpDashboardContextVersion(userId?: string) {
  if (userId) forgetCachedDashboardContext(userId);
  try {
    const cookieStore = await cookies();
    cookieStore.set(CONTEXT_VERSION_COOKIE, Date.now().toString(36), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } catch {
    // Not in an action or route handler (cookies are read-only): the entry
    // still expires after CONTEXT_TTL_MS.
  }
}

async function contextVersion(): Promise<string> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(CONTEXT_VERSION_COOKIE)?.value ?? "0";
  } catch {
    return "0";
  }
}

function cacheKey(userId: string, accessToken: string, version: string) {
  const token = createHash("sha256").update(accessToken).digest("base64url").slice(0, 22);
  return `${userId}:${token}:${version}`;
}

function pruneCache(now: number) {
  for (const [key, entry] of contextCache) {
    if (entry.expiresAt <= now) contextCache.delete(key);
  }
  // Still too many: drop the oldest (Map keeps insertion order)
  while (contextCache.size >= CONTEXT_CACHE_MAX) {
    const oldest = contextCache.keys().next().value;
    if (oldest === undefined) break;
    contextCache.delete(oldest);
  }
}

function snapshotFor(
  payload: DashboardContextRpcPayload,
  branchId: string | null
): PermissionSnapshot {
  if (!payload.active_org_id) return { allow: [], deny: [] };
  const orgSlugs = payload.org_permissions ?? [];
  const branchSlugs = branchId ? (payload.branch_permissions?.[branchId] ?? []) : [];
  return { allow: [...new Set([...orgSlugs, ...branchSlugs])].sort(), deny: [] };
}

/**
 * Builds the dashboard context from the RPC payload. Pure, apart from signing
 * the avatar URL.
 */
export async function buildDashboardContextFromRpc(
  payload: DashboardContextRpcPayload,
  authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> },
  accessToken: string
): Promise<DashboardContextV2> {
  const activeOrgId = payload.active_org_id ?? null;

  let activeOrg: ActiveOrgV2 | null = null;
  if (activeOrgId && payload.org) {
    const profile = payload.org.profile;
    activeOrg = {
      id: payload.org.id,
      name: profile?.name || payload.org.name,
      name_2: profile?.name_2 || null,
      slug: (profile?.slug || payload.org.slug) as string,
      logo_url: profile?.logo_url || null,
    };
  }

  const availableBranches: BranchDataV2[] = activeOrgId
    ? (payload.branches ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        organization_id: b.organization_id,
        // same value the branches query returned (null when not set)
        branch_number: b.branch_number as number | undefined,
        slug: b.slug,
        public_warehouse_maps_enabled: b.public_warehouse_maps_enabled ?? false,
        created_at: b.created_at,
      }))
    : [];

  // Branch from preferences, as loadAppContextV2 does
  const preferredBranchId = resolveActiveBranch(
    payload.preferences?.default_branch_id ?? null,
    availableBranches.map((b) => b.id)
  );

  // Accessible branches, as loadDashboardContextV2 does
  let accessibleBranches: BranchDataV2[] = [];
  if (activeOrgId) {
    if (checkPermission(snapshotFor(payload, preferredBranchId), BRANCHES_VIEW_ANY)) {
      accessibleBranches = availableBranches;
    } else {
      const assigned = new Set(payload.branch_assignment_ids ?? []);
      accessibleBranches = availableBranches.filter(
        (b) => assigned.has(b.id) && b.organization_id === activeOrgId
      );
    }
  }

  const activeBranchId = resolveActiveBranch(
    preferredBranchId,
    accessibleBranches.map((b) => b.id)
  );
  const activeBranch = activeBranchId
    ? (accessibleBranches.find((b) => b.id === activeBranchId) ?? null)
    : null;

  // Identity, as loadUserContextV2 does (users row, else the session metadata)
  const row = payload.user;
  const user: UserV2 = row
    ? {
        id: row.id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        avatar_url: row.avatar_url,
        avatar_signed_url: row.avatar_path
          ? await getSignedAvatarUrl(row.id, row.avatar_path)
          : null,
      }
    : {
        id: authUser.id,
        email: authUser.email!,
        first_name: (authUser.user_metadata?.first_name as string | undefined) || null,
        last_name: (authUser.user_metadata?.last_name as string | undefined) || null,
        avatar_url: null,
        avatar_signed_url: null,
      };

  return {
    app: {
      activeOrgId,
      activeBranchId,
      activeOrg,
      activeBranch,
      availableBranches,
      accessibleBranches,
      userModules: [],
    },
    user: {
      user,
      roles: AuthService.getUserRoles(accessToken),
      // Snapshot for the branch finally chosen (the old loader reloaded it
      // when the branch changed; here every branch's slugs are already loaded)
      permissionSnapshot: snapshotFor(payload, activeBranchId),
    },
  };
}

export async function loadDashboardContextFromRpc(): Promise<
  DashboardContextV2 | null | undefined
> {
  if (rpcMissing) return undefined;

  try {
    const {
      data: { user: authUser },
      error: authError,
    } = await getAuthUser();
    if (authError || !authUser) return null;

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;

    const now = Date.now();
    const key = cacheKey(authUser.id, session.access_token, await contextVersion());
    const hit = contextCache.get(key);
    if (hit && hit.expiresAt > now) return await hit.value;

    const value = (async () => {
      const { data, error } = await supabase.rpc("get_dashboard_context_v2");
      if (error) {
        // PGRST202: function not found (migration not applied yet)
        if (error.code === "PGRST202" || error.code === "42883") rpcMissing = true;
        else console.error("[loadDashboardContextFromRpc] RPC failed:", error);
        return undefined;
      }
      if (!data) return undefined;

      return await buildDashboardContextFromRpc(
        data as DashboardContextRpcPayload,
        authUser,
        session.access_token
      );
    })();

    pruneCache(now);
    contextCache.set(key, { expiresAt: now + CONTEXT_TTL_MS, userId: authUser.id, value });

    let result: DashboardContextV2 | null | undefined;
    try {
      result = await value;
    } catch (e) {
      contextCache.delete(key);
      throw e;
    }
    // Only a built context is kept; errors are asked again next time
    if (!result && contextCache.get(key)?.value === value) contextCache.delete(key);
    return result;
  } catch (e) {
    // Next.js control flow (dynamic rendering, redirects) must pass through
    unstable_rethrow(e);
    console.error("[loadDashboardContextFromRpc] Unexpected error:", e);
    return undefined;
  }
}
