"use server";

import { createClient } from "@/utils/supabase/server";
import { jwtDecode } from "jwt-decode";
import { CustomJwtPayload } from "@/utils/auth/adminAuth";

export async function loadUserContextServer() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  // Dekoduj JWT i wyciągnij tylko roles
  let roles: CustomJwtPayload["roles"] = [];

  try {
    const jwt = jwtDecode<CustomJwtPayload>(session.access_token);
    roles = jwt.roles || [];
  } catch (err) {
    console.warn("❌ JWT decode error:", err);
  }

  // Pobierz preferencje użytkownika
  const userId = session.user.id;
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("organization_id, default_branch_id")
    .eq("user_id", userId)
    .single();

  return {
    user: {
      id: session.user.id,
      email: session.user.email!,
      first_name: session.user.user_metadata?.first_name ?? null,
      last_name: session.user.user_metadata?.last_name ?? null,
    },
    preferences: preferences ?? {
      organization_id: null,
      default_branch_id: null,
    },
    roles,
  };
}
