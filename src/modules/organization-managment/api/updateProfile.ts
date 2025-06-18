"use server";

import { createClient } from "@/utils/supabase/server";
import { TablesUpdate } from "@/types/supabase";

export async function updateOrganizationProfile(data: TablesUpdate<"organization_profiles">) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { error: new Error("Brak aktywnej sesji użytkownika") };

  const userId = session.user.id;

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("organization_id")
    .eq("user_id", userId)
    .single();

  if (!preferences?.organization_id) {
    return { error: new Error("Brak organizacji przypisanej do użytkownika") };
  }

  return await supabase
    .from("organization_profiles")
    .update(data)
    .eq("organization_id", preferences.organization_id);
}
