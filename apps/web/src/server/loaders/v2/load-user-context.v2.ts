import { createClient } from "@/utils/supabase/server";
import { cache } from "react";
import { AuthService, type JWTRole } from "@/server/services/auth.service";
import { PermissionServiceV2 } from "@/server/services/permission-v2.service";
import type { PermissionSnapshot } from "@/lib/types/permissions";
import type { UserContextV2, UserV2 } from "@/lib/stores/v2/user-store";
import { getAuthUser } from "@/server/auth/get-auth-user";
import { getSignedAvatarUrl } from "@/server/storage/avatar-signed-url";

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

  // Verified session token (signature + expiry), see getAuthUser. getSession()
  // alone would only read the cookie without verifying it.
  const {
    data: { user: authUser },
    error: authError,
  } = await getAuthUser();

  if (authError || !authUser) {
    return null;
  }

  const userId = authUser.id;

  // Get session for access_token (needed for JWT role extraction below).
  // The token has already been verified by getAuthUser() above.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  // The permission snapshot does not depend on the identity below: it is
  // fetched at the same time.
  const permissionsPromise: Promise<PermissionSnapshot> = activeOrgId
    ? PermissionServiceV2.getPermissionSnapshotForUser(
        supabase,
        userId,
        activeOrgId,
        activeBranchId // Uses RESOLVED branch from app context
      )
    : Promise.resolve({ allow: [], deny: [] });
  // Never left unhandled while the identity loads; awaited below.
  permissionsPromise.catch(() => undefined);

  // 1. Load user identity from users table
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, email, first_name, last_name, avatar_url, avatar_path")
    .eq("id", userId)
    .maybeSingle();

  if (userError) {
    // Always log — user identity load failure is an infrastructure event,
    // not a user data leak. Falls back to auth metadata below.
    console.error("[loadUserContextV2] User query failed:", userError);
  }

  // Signed URL for the private-bucket avatar, reused across requests until near expiry
  const avatarSignedUrl = userData?.avatar_path
    ? await getSignedAvatarUrl(userData.id, userData.avatar_path)
    : null;

  // Fallback to session metadata if users row missing
  const user: UserV2 = userData
    ? {
        id: userData.id,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        avatar_url: userData.avatar_url,
        avatar_signed_url: avatarSignedUrl,
      }
    : {
        id: userId,
        email: authUser.email!,
        first_name: authUser.user_metadata?.first_name || null,
        last_name: authUser.user_metadata?.last_name || null,
        avatar_url: null,
        avatar_signed_url: null,
      };

  // 2. Extract roles from JWT (single source of truth for UI role display)
  //
  // KNOWN STALE WINDOW (G7): JWT roles are valid until the token expires
  // (Supabase default: 1 hour).  If an admin revokes a user's role, these
  // decoded roles remain stale for up to 1 hour, affecting:
  //   - HasAnyRole*/HasAnyRoleClient: UI-level role-gated components
  //   - userContext.roles: the roles array shown in the debug panel
  //
  // This is NOT a database security issue:
  //   - RLS policies check user_effective_permissions (always fresh, recompiled
  //     by DB triggers within the same transaction as any role change).
  //   - PermissionServiceV2.getPermissionSnapshotForUser() reads UEP directly
  //     (always fresh on every SSR page load).
  //   - Server action permission checks use has_permission() / has_branch_permission()
  //     which read UEP (always fresh).
  //
  // The maximum exposure window is: next token expiry (~1 hour).
  // Middleware calls getUser() which refreshes the token if NEAR expiry,
  // but does NOT force re-issue when roles change mid-session.
  //
  // Accepted risk: UI-only display artefacts for ≤1h after role changes.
  // Security invariant: DB operations are always gated by fresh RLS/UEP.
  const roles: JWTRole[] = AuthService.getUserRoles(session.access_token);

  // 3. Load permission snapshot for the RESOLVED org/branch context
  // Returns { allow: [...], deny: [...] } for proper wildcard + deny semantics
  const permissionSnapshot: PermissionSnapshot = await permissionsPromise;

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
