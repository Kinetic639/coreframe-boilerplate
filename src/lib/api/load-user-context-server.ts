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

  // 🔄 Fallback: If no roles in JWT, fetch directly with service role
  if (roles.length === 0) {
    console.warn("⚠️ No roles found in JWT - fetching directly from database");

    // Use service role to bypass RLS policies
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: roleAssignments } = await serviceSupabase
      .from("user_role_assignments")
      .select(
        `
        role_id,
        scope,
        scope_id,
        roles!inner(name)
      `
      )
      .eq("user_id", userId)
      .is("deleted_at", null);

    roles = (roleAssignments ?? [])
      .map((assignment: any) => ({
        role_id: assignment.role_id,
        role: assignment.roles?.name || "Unknown Role",
        org_id: assignment.scope === "org" ? assignment.scope_id : null,
        branch_id: assignment.scope === "branch" ? assignment.scope_id : null,
      }))
      .filter((role) => role.role !== "Unknown Role");
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

  // 🔐 Pobierz uprawnienia wynikające z ról - use regular client with RPC function
  let permissionsRaw = null;

  if (roles.length > 0) {
    console.log(
      "🔍 Fetching permissions for roles:",
      roles.map((r) => r.role_id)
    );

    // Use regular supabase client since it works in test-permissions
    const roleIds = roles.map((r) => r.role_id);
    console.log("🔍 Role IDs being passed to RPC:", roleIds);

    const { data: servicePerms, error: serviceError } = await supabase.rpc(
      "get_permissions_for_roles",
      { role_ids: roleIds }
    );

    console.log("🔍 RPC result:", { servicePerms, serviceError });
    console.log("🔍 Service perms type:", typeof servicePerms, Array.isArray(servicePerms));
    console.log("🔍 Service perms raw:", JSON.stringify(servicePerms, null, 2));

    permissionsRaw = servicePerms;
  }

  console.log("🔍 Processing permissions, permissionsRaw:", permissionsRaw);
  console.log("🔍 permissionsRaw type:", typeof permissionsRaw, Array.isArray(permissionsRaw));

  const permissions: string[] = (permissionsRaw ?? [])
    .map((p: any) => {
      console.log("🔍 Processing permission item:", p);

      // Handle different RPC return formats
      if (p && typeof p === "object") {
        // Format 1: Direct slug property
        if ("slug" in p) {
          const slug = p.slug as string;
          console.log("🔍 Extracted slug (format 1):", slug);
          return slug;
        }

        // Format 2: Function name as key
        if ("get_permissions_for_roles" in p) {
          const slug = p.get_permissions_for_roles as string;
          console.log("🔍 Extracted slug (format 2):", slug);
          return slug;
        }
      }

      console.log("🔍 Item did not match any pattern:", p);
      return null;
    })
    .filter((slug: string | null): slug is string => typeof slug === "string");

  console.log("🔍 Final permissions array:", permissions);

  // ✅ Zbuduj kontekst
  const userContext = {
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

  console.log("🔍 User context built:", {
    userId,
    rolesCount: roles.length,
    permissionsCount: permissions.length,
    roles: roles.map((r) => r.role),
    permissions: permissions.slice(0, 5), // First 5 permissions for debugging
  });

  return userContext;
}
