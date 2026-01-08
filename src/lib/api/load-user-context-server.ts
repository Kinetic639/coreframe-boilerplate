"use server";

import { createClient } from "@/utils/supabase/server";
import { AuthService, type JWTRole } from "@/server/services/auth.service";
import { PermissionService } from "@/server/services/permission.service";
import { cache } from "react";

/**
 * User context loaded from server
 * Source of truth for user identity, preferences, roles, and permissions
 */
export type UserContext = {
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  preferences: {
    organization_id: string | null;
    default_branch_id: string | null;
  };
  roles: JWTRole[]; // Using JWTRole from AuthService (single source of truth)
  permissions: string[];
};

/**
 * Internal implementation of user context loader
 * Load user context from server (SSR-safe)
 *
 * Contract:
 * - Returns null when no session exists
 * - Loads user from public.users (fallback to session metadata)
 * - Loads preferences from user_preferences (defaults to null if missing)
 * - Extracts roles from JWT via AuthService.getUserRoles()
 * - Loads permissions via PermissionService.getPermissionsForUser() only when orgId exists
 *
 * Forbidden:
 * - NO service role usage
 * - NO JWT decode fallback
 * - NO database fallback for roles
 *
 * @returns UserContext or null
 */
async function _loadUserContextServer(): Promise<UserContext | null> {
  const supabase = await createClient();

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Return null if no session
  if (!session) return null;

  const userId = session.user.id;

  // Load user from public.users table
  const { data: userData } = await supabase
    .from("public.users")
    .select("id, email, first_name, last_name, avatar_url")
    .eq("id", userId)
    .single();

  // Fallback to session metadata if public.users row missing
  const userInfo = userData || {
    id: userId,
    email: session.user.email!,
    first_name: session.user.user_metadata?.first_name ?? null,
    last_name: session.user.user_metadata?.last_name ?? null,
    avatar_url: null,
  };

  // Load user preferences
  const { data: preferencesRaw } = await supabase
    .from("user_preferences")
    .select("organization_id, default_branch_id")
    .eq("user_id", userId)
    .single();

  const preferences = {
    organization_id: preferencesRaw?.organization_id ?? null,
    default_branch_id: preferencesRaw?.default_branch_id ?? null,
  };

  // Extract roles from JWT using AuthService (NO database fallback)
  const roles = AuthService.getUserRoles(session.access_token);

  // Load permissions via PermissionService only when orgId exists
  // Include branch context for branch-scoped permissions
  let permissions: string[] = [];

  console.log("[loadUserContext] Before permission loading:", {
    userId,
    orgId: preferences.organization_id,
    branchId: preferences.default_branch_id,
    hasOrgId: !!preferences.organization_id,
  });

  if (preferences.organization_id) {
    permissions = await PermissionService.getPermissionsForUser(
      supabase,
      userId,
      preferences.organization_id,
      preferences.default_branch_id // Pass branch context for branch-scoped permissions
    );

    console.log("[loadUserContext] After permission loading:", {
      userId,
      orgId: preferences.organization_id,
      branchId: preferences.default_branch_id,
      permissionCount: permissions.length,
      permissions: permissions.slice(0, 5), // First 5 for debugging
    });
  } else {
    console.warn("[loadUserContext] Skipping permission loading - no organization_id");
  }

  // Build and return user context
  return {
    user: {
      id: userInfo.id,
      email: userInfo.email,
      first_name: userInfo.first_name,
      last_name: userInfo.last_name,
      avatar_url: userInfo.avatar_url,
    },
    preferences,
    roles,
    permissions,
  };
}

/**
 * Cached version of loadUserContextServer
 * Uses React cache for deduplication across multiple calls in the same request
 */
export const loadUserContextServer = cache(_loadUserContextServer);
