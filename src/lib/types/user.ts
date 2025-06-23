import { Database } from "../../../supabase/types/types";

export type User = Pick<
  Database["public"]["Tables"]["users"]["Row"],
  "id" | "email" | "first_name" | "last_name"
>;

export type UserPreferences = Pick<
  Database["public"]["Tables"]["user_preferences"]["Row"],
  "organization_id" | "default_branch_id"
>;

export type UserRole = Database["public"]["Tables"]["user_roles"]["Row"] & {
  roles: Pick<Database["public"]["Tables"]["roles"]["Row"], "slug" | "label">;
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
