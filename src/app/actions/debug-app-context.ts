"use server";

import { createClient } from "@/utils/supabase/server";

export async function debugAppContext() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { error: "No session" };

  const userId = session.user.id;

  // DEBUG: Check what's actually in the JWT
  let jwtClaims = null;
  let jwtRoles = null;
  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.decode(session.access_token);
    jwtClaims = decoded;
    jwtRoles = decoded?.roles || [];
  } catch (err) {
    console.error("JWT decode error:", err);
  }

  // 1. Check user preferences
  const { data: preferences, error: prefError } = await supabase
    .from("user_preferences")
    .select("organization_id, default_branch_id")
    .eq("user_id", userId)
    .single();

  const activeOrgId = preferences?.organization_id ?? null;

  // 2. Check organization profile access
  let orgProfileResult = null;
  let orgProfileError = null;

  if (activeOrgId) {
    const result = await supabase
      .from("organization_profiles")
      .select("*")
      .eq("organization_id", activeOrgId)
      .single();

    orgProfileResult = result.data;
    orgProfileError = result.error;
  }

  // 3. Check what loadAppContextServer would return
  const activeOrg = orgProfileResult
    ? {
        ...orgProfileResult,
        id: orgProfileResult.organization_id,
        name: orgProfileResult.name || "Unknown Organization",
      }
    : null;

  // 4. Test branch access too
  let branchesResult = null;
  let branchesError = null;

  if (activeOrgId) {
    const result = await supabase
      .from("branches")
      .select("*")
      .eq("organization_id", activeOrgId)
      .is("deleted_at", null);

    branchesResult = result.data;
    branchesError = result.error;
  }

  // 5. Test roles access
  let rolesResult = null;
  let rolesError = null;

  const rolesTest = await supabase.from("roles").select("*").limit(5);

  rolesResult = rolesTest.data;
  rolesError = rolesTest.error;

  // 6. Test user_role_assignments access
  let roleAssignmentsResult = null;
  let roleAssignmentsError = null;

  if (activeOrgId) {
    const assignmentsTest = await supabase
      .from("user_role_assignments")
      .select("*")
      .eq("scope_id", activeOrgId)
      .limit(5);

    roleAssignmentsResult = assignmentsTest.data;
    roleAssignmentsError = assignmentsTest.error;
  }

  return {
    userId,
    jwtClaims,
    jwtRoles,
    preferences,
    prefError,
    activeOrgId,
    orgProfileResult,
    orgProfileError,
    activeOrg,
    branchesResult,
    branchesError,
    rolesResult,
    rolesError,
    roleAssignmentsResult,
    roleAssignmentsError,
    wouldRedirect: !activeOrg, // This is the key check
    wouldRedirectBranches: !activeOrgId, // Check for branches page
  };
}
