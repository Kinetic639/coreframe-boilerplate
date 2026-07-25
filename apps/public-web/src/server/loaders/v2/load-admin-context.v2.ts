import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { AdminEntitlementsService } from "@/server/services/admin-entitlements.service";
import { SUPERADMIN_WILDCARD } from "@/lib/constants/permissions";
import type { AdminEntitlements } from "@/lib/types/admin-entitlements";

/**
 * Admin user identity with profile fields for UI rendering
 */
export interface AdminUserV2 {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  avatar_signed_url: string | null;
}

/**
 * Admin Dashboard V2 Context
 *
 * Separate from DashboardContextV2 — admin is global-scoped, not org-scoped.
 * The permission snapshot is synthesised from `admin_entitlements.enabled`,
 * NOT from `user_effective_permissions` (which is org-scoped).
 */
export interface AdminContextV2 {
  user: AdminUserV2;
  adminEntitlements: AdminEntitlements | null;
  /**
   * Synthetic permission snapshot:
   * - enabled=true  → { allow: ["superadmin.*"], deny: [] }
   * - enabled=false → { allow: [],              deny: [] }
   * - no row        → { allow: [],              deny: [] }
   */
  permissionSnapshot: {
    allow: string[];
    deny: string[];
  };
}

/**
 * Load Admin Dashboard V2 context server-side.
 *
 * Contract:
 * - Returns null when no session exists (unauthenticated)
 * - Loads admin_entitlements for the authenticated user
 * - Synthesises a permission snapshot directly from entitlements.enabled
 *   (bypasses org-scoped permission tables entirely)
 *
 * @returns AdminContextV2 or null
 */
async function _loadAdminContextV2(): Promise<AdminContextV2 | null> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return null;
  }

  // Load user profile for display (name, avatar) — fallback to auth metadata
  const { data: userData } = await supabase
    .from("users")
    .select("first_name, last_name, avatar_url, avatar_path")
    .eq("id", authUser.id)
    .maybeSingle();

  // Generate signed URL for private-bucket uploaded avatar (1 hour TTL)
  let avatarSignedUrl: string | null = null;
  if (userData?.avatar_path) {
    const { data: signedData } = await supabase.storage
      .from("user-avatars")
      .createSignedUrl(userData.avatar_path, 3600);
    avatarSignedUrl = signedData?.signedUrl ?? null;
  }

  const adminEntitlements = await AdminEntitlementsService.loadAdminEntitlements(
    supabase,
    authUser.id
  );

  // Synthesise permission snapshot — no DB role lookup needed
  const permissionSnapshot = adminEntitlements?.enabled
    ? { allow: [SUPERADMIN_WILDCARD], deny: [] }
    : { allow: [], deny: [] };

  return {
    user: {
      id: authUser.id,
      email: authUser.email!,
      first_name: userData?.first_name ?? authUser.user_metadata?.first_name ?? null,
      last_name: userData?.last_name ?? authUser.user_metadata?.last_name ?? null,
      avatar_url: userData?.avatar_url ?? null,
      avatar_signed_url: avatarSignedUrl,
    },
    adminEntitlements,
    permissionSnapshot,
  };
}

/**
 * Cached version — deduplicates multiple calls within a single RSC render.
 */
export const loadAdminContextV2 = cache(_loadAdminContextV2);
