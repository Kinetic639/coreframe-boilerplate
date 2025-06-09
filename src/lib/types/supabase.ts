import { Database } from "../../../supabase/types/types";

export type BranchProfile = Database["public"]["Tables"]["branch_profiles"]["Row"];
export type OrganizationProfile = Database["public"]["Tables"]["organization_profiles"]["Row"];
export type UserModule = Database["public"]["Tables"]["user_modules"]["Row"];
export type Module = Database["public"]["Tables"]["modules"]["Row"];

export type LoadedUserModule = {
  id: string;
  slug: string;
  label: string;
  settings: Record<string, unknown>;
};
