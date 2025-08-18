"use server";

import { createClient } from "@/utils/supabase/server";
import { Tables } from "../../../supabase/types/types";
import { cache } from "react";
// Typ reprezentujący jeden moduł z nadpisanymi ustawieniami użytkownika
type LoadedUserModule = {
  id: string;
  slug: string;
  label: string;
  settings: Record<string, unknown>;
};

// Pomocnicza funkcja sprawdzająca, czy JSON to obiekt (do bezpiecznego spreadowania)
function safeObject(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj)
    ? (obj as Record<string, unknown>)
    : {};
}

export async function _loadAppContextServer() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;
  const userId = session.user.id;

  // 1. Get user preferences, or fallback to their owned organization
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("organization_id, default_branch_id")
    .eq("user_id", userId)
    .single();

  let activeOrgId = preferences?.organization_id ?? null;
  const activeBranchId = preferences?.default_branch_id ?? null;

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
  const { data: activeOrg } = await supabase
    .from("organization_profiles")
    .select("*")
    .eq("organization_id", activeOrgId)
    .single();

  // 3. Branches
  const { data: branchesRaw } = await supabase
    .from("branches")
    .select("id")
    .eq("organization_id", activeOrgId)
    .is("deleted_at", null);

  const branchIds = branchesRaw?.map((b) => b.id) ?? [];

  const { data: availableBranches } = await supabase
    .from("branch_profiles")
    .select("*")
    .in("branch_id", branchIds);

  const activeBranch = availableBranches?.find((b) => b.branch_id === activeBranchId) ?? null;

  // 4. User modules
  const { data: userModulesRaw } = await supabase
    .from("user_modules")
    .select("setting_overrides, modules(*)")
    .eq("user_id", userId)
    .is("deleted_at", null);

  const userModules: LoadedUserModule[] = (userModulesRaw ?? [])
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
    .filter((m): m is LoadedUserModule => m !== null);

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
          id: activeBranch.branch_id,
          name: activeBranch.name || "Unknown Branch",
        }
      : null,
    availableBranches: (availableBranches ?? []).map((branch) => ({
      ...branch,
      id: branch.branch_id,
      name: branch.name || "Unknown Branch",
    })),
    userModules,
    location: null,
  };
}
export const loadAppContextServer = cache(_loadAppContextServer);
