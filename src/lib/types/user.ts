import { Database } from "../../../supabase/types/types";

export type User = Pick<
  Database["public"]["Tables"]["users"]["Row"],
  "id" | "email" | "first_name" | "last_name"
>;

export type UserPreferences = Pick<
  Database["public"]["Tables"]["user_preferences"]["Row"],
  "organization_id" | "default_branch_id"
>;

export type Role = {
  role: string;
  org_id: string;
  branch_id: string | null;
  team_id: string | null;
};
