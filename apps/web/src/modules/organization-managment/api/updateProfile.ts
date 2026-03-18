"use server";

import { createClient } from "@/utils/supabase/server";
import { TablesUpdate } from "../../../../supabase/types/types";

export async function updateOrganizationProfile(data: TablesUpdate<"organization_profiles">) {
  const supabase = await createClient();

  // Get current session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: new Error("Brak aktywnej sesji użytkownika") };
  }

  const userId = session.user.id;

  // Get user's organization from preferences
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("organization_id")
    .eq("user_id", userId)
    .single();

  if (!preferences?.organization_id) {
    return { error: new Error("Brak organizacji przypisanej do użytkownika") };
  }

  // Use Supabase authorize function to check permissions
  const { data: authResult } = await supabase.rpc("authorize", {
    user_id: userId,
    required_permissions: ["organization.profile.update"],
    organization_id: preferences.organization_id,
  });

  if (!authResult || !authResult.authorized) {
    const reason = authResult?.checks
      ? `Missing permissions: ${JSON.stringify(authResult.checks.required_permissions)}`
      : "Insufficient permissions";
    return {
      error: new Error(`Unauthorized: ${reason}`),
    };
  }

  // Update organization profile
  const result = await supabase
    .from("organization_profiles")
    .update({
      ...data,
      // Ensure organization_id cannot be changed
      organization_id: preferences.organization_id,
    })
    .eq("organization_id", preferences.organization_id);

  return result;
}
