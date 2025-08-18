"use server";

import { createClient } from "@/utils/supabase/server";
import { jwtDecode } from "jwt-decode";

// 🔸 Typy JWT
export type UserRoleFromToken = {
  role_id: string;
  role: string;
  org_id: string | null;
  branch_id: string | null;
};

export type CustomJwtPayload = {
  roles: UserRoleFromToken[];
};

// 🔸 Typ wyniku
export type UserContext = {
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  preferences: {
    organization_id: string | null;
    default_branch_id: string | null;
  };
  roles: UserRoleFromToken[];
  permissions: string[];
};

export async function loadUserContextServer(): Promise<UserContext | null> {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const userId = session.user.id;

  // 🔐 First try to get roles from JWT claims (if hook is configured)
  let roles: UserRoleFromToken[] = [];

  try {
    const jwt = jwtDecode<CustomJwtPayload>(session.access_token);
    roles = jwt.roles ?? [];
  } catch (err) {
    console.warn("❌ JWT decode error:", err);
  }

  // 🔄 Fallback: If no roles in JWT, fetch directly from database
  if (roles.length === 0) {
    const { data: roleAssignments } = await supabase
      .from("user_role_assignments")
      .select(
        `
        role_id,
        scope,
        scope_id,
        roles(name)
      `
      )
      .eq("user_id", userId)
      .is("deleted_at", null);

    roles = (roleAssignments ?? [])
      .map((assignment) => ({
        role_id: assignment.role_id,
        role: Array.isArray(assignment.roles) ? assignment.roles[0]?.name : assignment.roles?.name,
        org_id: assignment.scope === "org" ? assignment.scope_id : null,
        branch_id: assignment.scope === "branch" ? assignment.scope_id : null,
      }))
      .filter((role) => role.role); // Filter out roles without names
  }

  // 🧠 Preferencje użytkownika
  const { data: preferencesRaw } = await supabase
    .from("user_preferences")
    .select("organization_id, default_branch_id")
    .eq("user_id", userId)
    .single();

  const preferences = {
    organization_id: preferencesRaw?.organization_id ?? null,
    default_branch_id: preferencesRaw?.default_branch_id ?? null,
  };

  // 🔐 Pobierz uprawnienia wynikające z ról (JOIN z permissions)
  const { data: permissionsRaw } = await supabase
    .from("role_permissions")
    .select("permissions(slug)")
    .in(
      "role_id",
      roles.map((r) => r.role_id)
    );

  const permissions: string[] = (permissionsRaw ?? [])
    .flatMap((p) => {
      const perms = p.permissions;

      // Jeśli Supabase zwróciło tablicę (relacja nie została poprawnie oznaczona jako 1-1)
      if (Array.isArray(perms)) {
        return perms
          .filter((x): x is { slug: string } => typeof x?.slug === "string")
          .map((x) => x.slug);
      }

      // Jeśli pojedynczy obiekt
      if (perms && typeof perms === "object" && "slug" in perms) {
        return [(perms as { slug: string }).slug];
      }

      return [];
    })
    .filter((slug): slug is string => typeof slug === "string");

  // ✅ Zbuduj kontekst
  return {
    user: {
      id: userId,
      email: session.user.email!,
      first_name: session.user.user_metadata?.first_name ?? null,
      last_name: session.user.user_metadata?.last_name ?? null,
    },
    preferences,
    roles,
    permissions,
  };
}
