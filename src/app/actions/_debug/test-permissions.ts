"use server";

import { createClient } from "@/utils/supabase/server";

export async function testUserPermissions() {
  const supabase = await createClient();

  // Get current session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "No active session" };
  }

  const userId = session.user.id;

  // Get user's organization from preferences
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("organization_id")
    .eq("user_id", userId)
    .single();

  if (!preferences?.organization_id) {
    return { error: "No organization assigned to user" };
  }

  // Use Supabase authorize function to check permissions
  const { data: authResult } = await supabase.rpc("authorize", {
    user_id: userId,
    required_permissions: ["organization.profile.update", "org.edit"],
    organization_id: preferences.organization_id,
  });

  return {
    userId,
    organizationId: preferences.organization_id,
    authResult,
    isAuthorized: authResult?.authorized || false,
  };
}
