import { Database } from "@/types/supabase";

export type User = Pick<
  Database["public"]["Tables"]["users"]["Row"],
  "id" | "email" | "first_name" | "last_name" | "avatar_url"
>;

export type UserPreferences = Pick<
  Database["public"]["Tables"]["user_preferences"]["Row"],
  "organization_id" | "default_branch_id"
>;

export type UserRole = any & {
  roles: any;
};
// types/roles.ts
export type Scope = "org" | "branch";

export type RoleCheck = {
  role: string;
  scope?: Scope; // jeśli nie podano, pasuje niezależnie od scope
  id?: string; // jeśli nie podano, pasuje niezależnie od id
};
export type UserRoleFromToken = {
  role: string;
  org_id: string | null;
  branch_id: string | null;
  team_id: string | null;
};
