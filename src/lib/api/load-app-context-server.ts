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

  if (prefError) {
    console.error("Error fetching user preferences:", prefError);
  }

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

    if (orgError) {
      console.error("Error fetching organization profile:", orgError);
    }
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

  // 5. Load locations for the active branch
  let locations: Tables<"locations">[] = [];
  if (activeBranchId) {
    const { data: locationData } = await supabase
      .from("locations")
      .select("*")
      .eq("branch_id", activeBranchId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    locations = locationData || [];
  }

  // 6. Load suppliers for the organization
  let suppliers: Tables<"suppliers">[] = [];
  let productTypes: Tables<"product_types">[] = [];
  if (activeOrgId) {
    const [suppliersResult, productTypesResult] = await Promise.all([
      supabase
        .from("suppliers")
        .select("*")
        .eq("organization_id", activeOrgId)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      supabase
        .from("product_types")
        .select("*")
        .eq("organization_id", activeOrgId)
        .order("name", { ascending: true }),
    ]);

    suppliers = suppliersResult.data || [];
    productTypes = productTypesResult.data || [];
  }

  const mappedBranches: BranchData[] = (availableBranches ?? []).map((branch) => ({
    ...branch,
    branch_id: branch.id, // Add branch_id for compatibility
    name: branch.name || "Unknown Branch",
  }));

  return {
    activeOrgId: activeOrgId,
    activeBranchId: activeBranchId,
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
    locations,
    suppliers,
    productTypes,
  };
}
export const loadAppContextServer = cache(_loadAppContextServer);
