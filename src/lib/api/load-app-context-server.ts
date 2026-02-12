"use server";

import { createClient } from "@/utils/supabase/server";
import { Tables } from "../../../supabase/types/types";
import { cache } from "react";
import { AppContext, BranchData } from "@/lib/stores/app-store";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Helper function to safely spread objects (avoid spreading non-objects)
 */
function safeObject(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

/**
 * Load application context from server (SSR-safe)
 *
 * Contract:
 * - Returns null when no session exists
 * - Deterministic org selection: preferences.organization_id ?? owned_org.id ?? null
 * - NO JWT decode fallback for org selection
 * - Loads minimal data:
 *   - Organization profile (minimal fields)
 *   - Branches for the org
 *   - Active branch from preferences (deterministic fallback)
 *   - User modules with merged settings
 * - Heavy data arrays empty: locations, suppliers, organizationUsers, privateContacts
 * - subscription set to null
 *
 * Forbidden:
 * - NO JWT decode to pick organization
 * - NO heavy data loading (locations, suppliers, etc.)
 *
 * @returns AppContext or null
 */
export async function _loadAppContextServer(): Promise<AppContext | null> {
  const supabase = await createClient();
  return _loadAppContextServerWithClient(supabase);
}

/**
 * Core implementation that accepts an injected Supabase client.
 * Used by _loadAppContextServer (creates its own client) and by server actions
 * that already have an authenticated client (avoids creating a duplicate).
 */
async function _loadAppContextServerWithClient(
  supabase: SupabaseClient
): Promise<AppContext | null> {
  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Return null if no session
  if (!session) return null;

  const userId = session.user.id;

  // 1. Load user preferences
  const { data: preferences, error: preferencesError } = await supabase
    .from("user_preferences")
    .select("organization_id, default_branch_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (preferencesError) {
    console.error("[AppContext] Failed to load user_preferences:", preferencesError);
  }

  // 2. Deterministic org selection: preferences ?? owned org ?? null
  let activeOrgId = preferences?.organization_id ?? null;

  // Fallback: If no preferences.organization_id, find user's owned organization
  // Use deterministic ordering (oldest first) for consistent fallback
  if (!activeOrgId) {
    const { data: ownedOrg, error: ownedOrgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("created_by", userId)
      .order("created_at", { ascending: true }) // Deterministic: oldest owned org first
      .limit(1)
      .maybeSingle();

    if (ownedOrgError) {
      console.error("[AppContext] Failed to load owned organization:", ownedOrgError);
    }

    activeOrgId = ownedOrg?.id ?? null;
  }

  // 3. Load organization profile (minimal fields only) when org chosen
  let activeOrg = null;

  if (activeOrgId) {
    const { data: orgProfile, error: orgProfileError } = await supabase
      .from("organization_profiles")
      .select(
        "organization_id, name, slug, logo_url, bio, theme_color, font_color, name_2, website"
      )
      .eq("organization_id", activeOrgId)
      .maybeSingle();

    if (orgProfileError) {
      console.error("[AppContext] Failed to load organization_profiles:", orgProfileError);
    }

    activeOrg = orgProfile;
  }

  // 4. Load branches for the organization (ordered by created_at ASC for deterministic fallback)
  const { data: availableBranches, error: branchesError } = activeOrgId
    ? await supabase
        .from("branches")
        .select("*")
        .eq("organization_id", activeOrgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }) // ASC for deterministic fallback to oldest/main branch
    : { data: [], error: null };

  if (branchesError) {
    console.error("[AppContext] Failed to load branches:", branchesError);
  }

  // 5. Determine active branch from preferences with deterministic fallback
  // Fallback chain: preferences.default_branch_id → first available branch (oldest) → null
  let activeBranch: Tables<"branches"> | null = null;

  const preferredBranchId = preferences?.default_branch_id ?? null;
  if (preferredBranchId) {
    activeBranch = availableBranches?.find((b) => b.id === preferredBranchId) ?? null;
  }

  // If no preference or preference invalid, fallback to first branch (deterministic)
  if (!activeBranch && availableBranches && availableBranches.length > 0) {
    activeBranch = availableBranches[0]; // First branch (oldest, typically main branch)
  }

  // FIX: Set activeBranchId to match the selected activeBranch (not just from preferences)
  // This ensures activeBranchId is consistent with activeBranch
  const finalActiveBranchId = activeBranch?.id ?? null;

  // 6. Load user modules with merged settings (for feature gating)
  const { data: userModulesRaw, error: userModulesError } = await supabase
    .from("user_modules")
    .select("setting_overrides, modules(*)")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (userModulesError) {
    console.error("[AppContext] Failed to load user_modules:", userModulesError);
  }

  const userModules = (userModulesRaw ?? [])
    .map((entry) => {
      const module = Array.isArray(entry.modules)
        ? (entry.modules[0] as Tables<"modules"> | undefined)
        : (entry.modules as Tables<"modules"> | undefined);

      if (!module) return null;

      return {
        id: module.id,
        slug: module.slug,
        label: module.label,
        settings: {
          ...safeObject(module.settings),
          ...safeObject(entry.setting_overrides),
        },
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  // 7. Map branches to BranchData format
  const mappedBranches: BranchData[] = (availableBranches ?? []).map((branch) => ({
    ...branch,
    branch_id: branch.id, // Add branch_id for compatibility
    name: branch.name || "Unknown Branch",
  }));

  // 8. Load compiled entitlements (single row, contains everything needed for SSR)
  let entitlements = null;

  if (activeOrgId) {
    const { data: entitlementsData, error: entitlementsError } = await supabase
      .from("organization_entitlements")
      .select("*")
      .eq("organization_id", activeOrgId)
      .maybeSingle();

    if (entitlementsError) {
      console.error("[AppContext] Failed to load organization_entitlements:", entitlementsError);
    }

    entitlements = entitlementsData;
  }

  // 9. Build and return app context
  return {
    activeOrgId,
    activeBranchId: finalActiveBranchId, // Use finalActiveBranchId to match activeBranch
    activeOrg: activeOrg
      ? ({
          ...activeOrg,
          id: activeOrg.organization_id,
          name: activeOrg.name || "Unknown Organization",
        } as Tables<"organization_profiles">)
      : null,
    activeBranch: activeBranch
      ? ({
          ...activeBranch,
          branch_id: activeBranch.id, // Add branch_id for compatibility
          name: activeBranch.name || "Unknown Branch",
        } as BranchData)
      : null,
    availableBranches: mappedBranches,
    userModules,
    location: null,
    // Heavy data arrays set to empty (load lazily on client)
    locations: [],
    suppliers: [],
    organizationUsers: [],
    privateContacts: [],
    // Subscription set to null (load lazily on client)
    subscription: null,
    // Entitlements loaded in SSR (single source of truth)
    entitlements,
  };
}

/**
 * Load app context using an existing server Supabase client.
 *
 * For use in server actions that already have an authenticated client,
 * avoiding the overhead of creating a second client and re-reading cookies.
 * NOT cached — server actions should call this once per request.
 */
export async function loadAppContextWithClient(
  supabase: SupabaseClient
): Promise<AppContext | null> {
  return _loadAppContextServerWithClient(supabase);
}

/**
 * Cached version of loadAppContextServer
 * Uses React cache for deduplication across multiple calls in the same request
 */
export const loadAppContextServer = cache(_loadAppContextServer);
