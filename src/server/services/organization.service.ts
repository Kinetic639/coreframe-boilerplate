import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import type {
  CreateBranchInput,
  UpdateBranchInput,
  UpdateOrganizationInput,
} from "@/server/schemas/organization.schema";

// ==========================================
// TYPE DEFINITIONS
// ==========================================

type Organization = Database["public"]["Tables"]["organizations"]["Row"];
type Branch = Database["public"]["Tables"]["branches"]["Row"];

// ==========================================
// ORGANIZATION SERVICE
// ==========================================

export class OrganizationService {
  /**
   * Get organization by ID
   */
  static async getOrganization(
    supabase: SupabaseClient<Database>,
    organizationId: string
  ): Promise<Organization | null> {
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch organization: ${error.message}`);
    }

    return data;
  }

  /**
   * Update organization profile
   */
  static async updateOrganization(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    input: UpdateOrganizationInput
  ): Promise<Organization> {
    // If slug is being updated, check uniqueness
    if (input.slug) {
      const { data: existing } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", input.slug)
        .neq("id", organizationId)
        .is("deleted_at", null)
        .single();

      if (existing) {
        throw new Error(`Organization slug "${input.slug}" is already in use`);
      }
    }

    const { data, error } = await supabase
      .from("organizations")
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", organizationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update organization: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all branches for an organization
   */
  static async getBranches(
    supabase: SupabaseClient<Database>,
    organizationId: string
  ): Promise<Branch[]> {
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name");

    if (error) {
      throw new Error(`Failed to fetch branches: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single branch by ID
   */
  static async getBranch(
    supabase: SupabaseClient<Database>,
    branchId: string
  ): Promise<Branch | null> {
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .eq("id", branchId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch branch: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new branch
   */
  static async createBranch(
    supabase: SupabaseClient<Database>,
    input: CreateBranchInput
  ): Promise<Branch> {
    // If slug is provided, check uniqueness within organization
    if (input.slug) {
      const { data: existing } = await supabase
        .from("branches")
        .select("id")
        .eq("organization_id", input.organization_id)
        .eq("slug", input.slug)
        .is("deleted_at", null)
        .single();

      if (existing) {
        throw new Error(`Branch slug "${input.slug}" is already in use`);
      }
    }

    const { data, error } = await supabase
      .from("branches")
      .insert({
        name: input.name,
        slug: input.slug || null,
        organization_id: input.organization_id,
      } as any)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create branch: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a branch
   */
  static async updateBranch(
    supabase: SupabaseClient<Database>,
    branchId: string,
    input: UpdateBranchInput
  ): Promise<Branch> {
    // If slug is being updated, check uniqueness
    if (input.slug) {
      // Get current branch to find organization_id
      const currentBranch = await this.getBranch(supabase, branchId);

      if (!currentBranch) {
        throw new Error("Branch not found");
      }

      const { data: existing } = await supabase
        .from("branches")
        .select("id")
        .eq("organization_id", currentBranch.organization_id)
        .eq("slug", input.slug)
        .neq("id", branchId)
        .is("deleted_at", null)
        .single();

      if (existing) {
        throw new Error(`Branch slug "${input.slug}" is already in use`);
      }
    }

    const { data, error } = await supabase
      .from("branches")
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", branchId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update branch: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a branch (soft delete)
   */
  static async deleteBranch(supabase: SupabaseClient<Database>, branchId: string): Promise<void> {
    // Check if branch has users assigned
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("default_branch_id", branchId)
      .is("deleted_at", null);

    if (users && users.length > 0) {
      throw new Error(
        `Cannot delete branch with ${users.length} assigned user(s). Please reassign users first.`
      );
    }

    const { error } = await supabase
      .from("branches")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", branchId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to delete branch: ${error.message}`);
    }
  }
}
