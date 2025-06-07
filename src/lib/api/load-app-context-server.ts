"use server";

import { createClient } from "@/utils/supabase/server";

export async function loadAppContextServer() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const userId = session.user.id;

  // 1. User preferences
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("organization_id, default_branch_id")
    .eq("user_id", userId)
    .single();

  const activeOrgId = preferences?.organization_id ?? null;
  const activeBranchId = preferences?.default_branch_id ?? null;

  // 2. Organization profile
  const { data: activeOrg } = await supabase
    .from("organization_profiles")
    .select("organization_id, logo_url, website, bio, slug, name")
    .eq("organization_id", activeOrgId)
    .single();

  // 3. All public branches in the organization
  const { data: availableBranchesRaw } = await supabase
    .from("branches")
    .select("id")
    .eq("organization_id", activeOrgId)
    .is("deleted_at", null);

  const branchIds = availableBranchesRaw?.map((b) => b.id) ?? [];

  // 4. Corresponding branch profiles
  const { data: availableBranches } = await supabase
    .from("branch_profiles")
    .select("branch_id, name, slug")
    .in("branch_id", branchIds);

  // 5. Set activeBranch from loaded profiles
  const activeBranch = availableBranches?.find((b) => b.branch_id === activeBranchId) ?? null;

  return {
    active_org_id: activeOrgId,
    active_branch_id: activeBranchId,
    activeOrg: activeOrg ?? null,
    activeBranch,
    availableBranches: availableBranches ?? [],
  };
}
