import { createClient } from "@/utils/supabase/server";
import { cache } from "react";
import type {
  AppContextV2,
  ActiveOrgV2,
  BranchDataV2,
  LoadedUserModuleV2,
} from "@/lib/stores/v2/app-store";

/**
 * V2 App Context Loader
 *
 * Loads minimal app context for Dashboard V2 only.
 * NO legacy fields (locations, suppliers, subscription, etc.)
 *
 * Contract:
 * - Returns null when no session exists
 * - Uses DETERMINISTIC org/branch selection (same as legacy)
 * - Loads minimal org snapshot (id, name, slug only)
 * - Loads minimal branch snapshot
 * - Loads available branches for branch switcher (with deleted_at filter)
 * - Loads user modules with proper join
 *
 * Deterministic Fallbacks:
 * 1. Org: preferences.organization_id (validated) → oldest org with membership → oldest created org
 * 2. Branch: preferences.default_branch_id (if valid) → first available branch
 *
 * Responsibilities:
 * - Org/branch selection (single source of truth)
 * - Module loading
 *
 * NOT responsible for:
 * - User identity loading (handled by load-user-context.v2.ts)
 * - Permission loading (handled by load-user-context.v2.ts)
 *
 * @returns AppContextV2 or null
 */
async function _loadAppContextV2(): Promise<AppContextV2 | null> {
  const supabase = await createClient();

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const userId = session.user.id;

  // 1. Load user preferences
  const { data: preferences, error: prefError } = await supabase
    .from("user_preferences")
    .select("organization_id, default_branch_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (prefError && process.env.NODE_ENV === "development") {
    console.error("[loadAppContextV2] Preferences query failed:", prefError);
  }

  // 2. Resolve activeOrgId with deterministic fallback
  let activeOrgId: string | null = null;

  // 2a) Try preferences.organization_id BUT validate it exists and isn't deleted
  if (preferences?.organization_id) {
    const { data: prefOrg, error: prefOrgErr } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", preferences.organization_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (prefOrgErr && process.env.NODE_ENV === "development") {
      console.error("[loadAppContextV2] Preferred org validation failed:", prefOrgErr);
    }

    activeOrgId = prefOrg?.id ?? null;
  }

  // 2b) Fallback 1: Oldest org where user is a MEMBER (via role assignments) - NO JOIN (schema can't join)
  if (!activeOrgId) {
    const { data: orgAssignments, error: memberErr } = await supabase
      .from("user_role_assignments")
      .select("scope_id")
      .eq("user_id", userId)
      .eq("scope", "org")
      .is("deleted_at", null);

    if (memberErr && process.env.NODE_ENV === "development") {
      console.error("[loadAppContextV2] Member org assignments query failed:", memberErr);
    }

    const orgIds = Array.from(new Set((orgAssignments ?? []).map((x) => x.scope_id))).filter(
      Boolean
    );

    if (orgIds.length > 0) {
      const { data: oldestMemberOrg, error: orgErr } = await supabase
        .from("organizations")
        .select("id")
        .in("id", orgIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (orgErr && process.env.NODE_ENV === "development") {
        console.error("[loadAppContextV2] Oldest member org query failed:", orgErr);
      }

      activeOrgId = oldestMemberOrg?.id ?? null;
    }
  }

  // 2c) Fallback 2: Oldest org CREATED BY user (schema uses created_by, not owner_user_id)
  if (!activeOrgId) {
    const { data: ownedOrgs, error: ownedErr } = await supabase
      .from("organizations")
      .select("id")
      .eq("created_by", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (ownedErr && process.env.NODE_ENV === "development") {
      console.error("[loadAppContextV2] Owned org query failed:", ownedErr);
    }

    activeOrgId = ownedOrgs?.id ?? null;
  }

  // 3. Load minimal org snapshot (if activeOrgId exists)
  let activeOrg: ActiveOrgV2 | null = null;

  if (activeOrgId) {
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("id", activeOrgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (orgError && process.env.NODE_ENV === "development") {
      console.error("[loadAppContextV2] Organization query failed:", orgError);
    }

    if (orgData) {
      activeOrg = {
        id: orgData.id,
        name: orgData.name,
        slug: orgData.slug,
      };
    }
  }

  // 4. Load available branches (if activeOrgId exists)
  let availableBranches: BranchDataV2[] = [];

  if (activeOrgId) {
    const { data: branches, error: branchesError } = await supabase
      .from("branches")
      .select("id, name, organization_id, slug, created_at")
      .eq("organization_id", activeOrgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (branchesError && process.env.NODE_ENV === "development") {
      console.error("[loadAppContextV2] Branches query failed:", branchesError);
    }

    availableBranches = (branches || []).map((b) => ({
      id: b.id,
      name: b.name,
      organization_id: b.organization_id,
      slug: b.slug,
      created_at: b.created_at,
    }));
  }

  // 5. Resolve activeBranchId with deterministic fallback
  let activeBranchId: string | null = null;
  let activeBranch: BranchDataV2 | null = null;

  if (availableBranches.length > 0) {
    // Try preferences.default_branch_id first (if it exists in available branches)
    const preferredBranch = availableBranches.find((b) => b.id === preferences?.default_branch_id);

    if (preferredBranch) {
      activeBranchId = preferredBranch.id;
      activeBranch = preferredBranch;
    } else {
      // Fallback: first available branch (deterministic sort by created_at)
      activeBranchId = availableBranches[0].id;
      activeBranch = availableBranches[0];
    }
  }

  // 6. Load user modules with proper join (if activeOrgId exists)
  let userModules: LoadedUserModuleV2[] = [];

  if (activeOrgId) {
    // NOTE: If user_modules has organization_id column, add .eq("organization_id", activeOrgId)
    // to prevent loading modules from other orgs when user belongs to multiple orgs
    const { data: userModulesRaw, error: modulesError } = await supabase
      .from("user_modules")
      .select("setting_overrides, modules!left(id, slug, label, settings)")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (modulesError && process.env.NODE_ENV === "development") {
      console.error("[loadAppContextV2] Modules query failed:", modulesError);
    }

    userModules = (userModulesRaw || [])
      .filter((um: any) => um.modules) // Filter out rows where module was deleted or join failed
      .map((um: any) => ({
        id: um.modules.id,
        slug: um.modules.slug,
        label: um.modules.label,
        settings: {
          ...um.modules.settings,
          ...um.setting_overrides, // Merge user overrides
        },
      }));
  }

  return {
    activeOrgId,
    activeBranchId,
    activeOrg,
    activeBranch,
    availableBranches,
    userModules,
  };
}

/**
 * Cached version of loadAppContextV2 (deduplicates multiple calls in same request)
 */
export const loadAppContextV2 = cache(_loadAppContextV2);
