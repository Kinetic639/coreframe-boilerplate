import { createClient } from "@/utils/supabase/server";
import { cache } from "react";
import { AuthService, type JWTRole } from "@/server/services/auth.service";
import { PermissionService, type PermissionSnapshot } from "@/server/services/permission.service";
import type { UserContextV2, UserV2 } from "@/lib/stores/v2/user-store";

/**
 * V2 User Context Loader
 *
 * Loads minimal user context for Dashboard V2 only.
 * NO legacy fields, NO preferences (preferences in app context).
 *
 * Contract:
 * - Returns null when no session exists
 * - Loads user identity from users table (fallback to session metadata)
 * - Extracts roles from JWT via AuthService.getUserRoles()
 * - Loads PermissionSnapshot (allow/deny) for the RESOLVED org/branch
 * - If activeOrgId is null, returns empty snapshot
 *
 * Responsibilities:
 * - User identity loading
 * - Role extraction from JWT
 * - Permission snapshot loading for RESOLVED context
 *
 * NOT responsible for:
 * - Org/branch selection (handled by load-app-context.v2.ts)
 * - Preference loading (handled by load-app-context.v2.ts)
 *
 * Forbidden:
 * - NO service role usage
 * - NO JWT decode fallback
 * - NO database fallback for roles
 * - NO org/branch resolution
 *
 * @param activeOrgId - The RESOLVED active organization ID (from app context)
 * @param activeBranchId - The RESOLVED active branch ID (from app context)
 * @returns UserContextV2 or null
 */
async function _loadUserContextV2(
  activeOrgId: string | null = null,
  activeBranchId: string | null = null
): Promise<UserContextV2 | null> {
  const supabase = await createClient();

  // Validate JWT against Supabase Auth (getUser() is preferred over getSession()
  // because getSession() only reads cookies without server-side token validation)
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return null;
  }

  const userId = authUser.id;

  // Get session for access_token (needed for JWT role extraction below).
  // Auth has already been validated by getUser() above.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  // 1. Load user identity from users table
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, email, first_name, last_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (userError && process.env.NODE_ENV === "development") {
    console.error("[loadUserContextV2] User query failed:", userError);
  }

  // Fallback to session metadata if users row missing
  const user: UserV2 = userData
    ? {
        id: userData.id,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        avatar_url: userData.avatar_url,
      }
    : {
        id: userId,
        email: authUser.email!,
        first_name: authUser.user_metadata?.first_name || null,
        last_name: authUser.user_metadata?.last_name || null,
        avatar_url: null,
      };

  // 2. Extract roles from JWT (single source of truth)
  const roles: JWTRole[] = AuthService.getUserRoles(session.access_token);

  // 3. Load permission snapshot for the RESOLVED org/branch context
  // Returns { allow: [...], deny: [...] } for proper wildcard + deny semantics
  let permissionSnapshot: PermissionSnapshot = { allow: [], deny: [] };

  if (activeOrgId) {
    permissionSnapshot = await PermissionService.getPermissionSnapshotForUser(
      supabase,
      userId,
      activeOrgId,
      activeBranchId // Uses RESOLVED branch from app context
    );
  }

  return {
    user,
    roles,
    permissionSnapshot,
  };
}

/**
 * Cached version of loadUserContextV2 (deduplicates multiple calls in same request)
 */
export const loadUserContextV2 = cache(_loadUserContextV2);
