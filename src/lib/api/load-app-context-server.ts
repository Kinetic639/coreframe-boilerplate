"use server";

import { createClient } from "@/utils/supabase/server";

export async function loadAppContextServer() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const userId = session.user.id;

  // 1. Pobierz preferencje użytkownika
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("organization_id, default_branch_id")
    .eq("user_id", userId)
    .single();

  const activeOrgId = preferences?.organization_id ?? null;
  const activeBranchId = preferences?.default_branch_id ?? null;

  // 2. Pobierz publiczny profil organizacji
  const { data: activeOrg } = await supabase
    .from("organization_profiles")
    .select("organization_id, logo_url, website, bio")
    .eq("organization_id", activeOrgId)
    .single();

  // 3. Pobierz wszystkie oddziały organizacji
  const { data: availableBranches } = await supabase
    .from("branches")
    .select("id, name, organization_id")
    .eq("organization_id", activeOrgId)
    .is("deleted_at", null);

  return {
    active_org_id: activeOrgId,
    active_branch_id: activeBranchId,
    activeOrg: activeOrg ?? null,
    availableBranches: availableBranches ?? [],
  };
}
