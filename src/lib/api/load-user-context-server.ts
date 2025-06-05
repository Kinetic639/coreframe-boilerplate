"use server";

import { createClient } from "@/utils/supabase/server";

export async function loadUserContextServer() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const { data: roles } = await supabase
    .from("user_roles")
    .select(
      `
      *,
      roles (
        slug, label
      )
    `
    )
    .eq("user_id", user.id);

  return {
    user,
    preferences,
    roles,
  };
}
