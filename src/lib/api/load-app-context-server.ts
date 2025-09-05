"use server";

import { createClient } from "@/utils/supabase/server";
import { Tables } from "../../../supabase/types/types";
import { cache } from "react";
import { AppContext, BranchData } from "@/lib/stores/app-store";

// Pomocnicza funkcja sprawdzająca, czy JSON to obiekt (do bezpiecznego spreadowania)
function safeObject(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

export async function _loadAppContextServer(): Promise<AppContext | null> {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;
  const userId = session.user.id;

  // 1. Get user preferences
  const { data: preferences, error: prefError } = await supabase
    .from("user_preferences")
    .select("organization_id, default_branch_id")
    .eq("user_id", userId)
    .single();

  console.log("🔍 User preferences query:", {
    userId,
    preferences,
    prefError,
    query: `user_preferences WHERE user_id = ${userId}`,
  });

  let activeOrgId = preferences?.organization_id ?? null;
  const activeBranchId = preferences?.default_branch_id ?? null;

  // FALLBACK: If preferences fail, try to get org_id from JWT roles
  if (!activeOrgId) {
    try {
      const { jwtDecode } = await import("jwt-decode");
      const jwt = jwtDecode<{ roles?: Array<{ org_id?: string }> }>(session.access_token);
      const orgFromJWT = jwt.roles?.find((r) => r.org_id)?.org_id;
      if (orgFromJWT) {
        activeOrgId = orgFromJWT;
        console.log("🔍 Using organization from JWT roles:", orgFromJWT);
      }
    } catch (err) {
      console.warn("Failed to decode JWT for org fallback:", err);
    }
  }

  // 🔄 Fallback: If no preferences, find user's owned organization
  if (!activeOrgId) {
    const { data: ownedOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("created_by", userId)
      .limit(1)
      .single();

    if (ownedOrg) {
      activeOrgId = ownedOrg.id;

      // Create default preferences for this user
      await supabase.from("user_preferences").upsert({
        user_id: userId,
        organization_id: activeOrgId,
        default_branch_id: null, // Will be set later when branches are available
      });
    }
  }

  // 2. Organization profile
  let activeOrg = null;
  let orgError = null;

  if (activeOrgId) {
    const result = await supabase
      .from("organization_profiles")
      .select("*")
      .eq("organization_id", activeOrgId)
      .single();

    activeOrg = result.data;
    orgError = result.error;

    console.log("🔍 Organization query:", {
      activeOrgId,
      activeOrg,
      orgError,
      query: `organization_profiles WHERE organization_id = ${activeOrgId}`,
    });
  } else {
    console.log("🔍 No activeOrgId, skipping organization profile query");
  }

  // 3. Branches - Load directly from branches table
  const { data: availableBranches } = activeOrgId
    ? await supabase
        .from("branches")
        .select("*")
        .eq("organization_id", activeOrgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
    : { data: [] };

  const activeBranch = availableBranches?.find((b) => b.id === activeBranchId) ?? null;

  // 4. User modules
  const { data: userModulesRaw } = await supabase
    .from("user_modules")
    .select("setting_overrides, modules(*)")
    .eq("user_id", userId)
    .is("deleted_at", null);

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

  // Locations will be loaded client-side via useLocations hook

  console.log("🔍 Final app context state:", {
    activeOrgId,
    activeBranchId,
    hasActiveOrg: !!activeOrg,
    activeOrgName: activeOrg?.name,
    branchesCount: availableBranches?.length || 0,
    modulesCount: userModules.length,
  });

  const mappedBranches: BranchData[] = (availableBranches ?? []).map((branch) => ({
    ...branch,
    branch_id: branch.id, // Add branch_id for compatibility
    name: branch.name || "Unknown Branch",
  }));

  return {
    activeOrgId: activeOrgId,
    activeBranchId: activeBranchId,
    activeOrg: activeOrg
      ? {
          ...activeOrg,
          id: activeOrg.organization_id,
          name: activeOrg.name || "Unknown Organization",
        }
      : null,
    activeBranch: activeBranch
      ? {
          ...activeBranch,
          branch_id: activeBranch.id, // Add branch_id for compatibility
          name: activeBranch.name || "Unknown Branch",
        }
      : null,
    availableBranches: mappedBranches,
    userModules,
    location: null,
    locations: [], // Will be loaded client-side
  };
}
export const loadAppContextServer = cache(_loadAppContextServer);
