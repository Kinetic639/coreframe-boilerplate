"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { Database } from "../../../supabase/types/types";
import { refreshBranchContext } from "@/lib/api/refresh-branch-context";

type Tables = Database["public"]["Tables"];
type BranchInsert = Tables["branches"]["Insert"];
type BranchUpdate = Tables["branches"]["Update"];

export interface CreateBranchData {
  name: string;
  slug?: string;
  organization_id: string;
}

export interface UpdateBranchData {
  name?: string;
  slug?: string;
}

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Server action to create a new branch
 */
export async function createBranchAction(
  data: CreateBranchData
): Promise<ActionResult<Tables["branches"]["Row"]>> {
  try {
    const supabase = await createClient();

    // Validate input
    if (!data.name?.trim()) {
      return { success: false, error: "Branch name is required" };
    }

    if (!data.organization_id) {
      return { success: false, error: "Organization ID is required" };
    }

    // Check if slug is provided and validate uniqueness
    if (data.slug) {
      const slug = data.slug.trim().toLowerCase();

      // Check slug format (alphanumeric and hyphens only)
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return {
          success: false,
          error: "Slug can only contain lowercase letters, numbers, and hyphens",
        };
      }

      // Check if slug is already used
      const { data: existingBranch, error: slugCheckError } = await supabase
        .from("branches")
        .select("id")
        .eq("organization_id", data.organization_id)
        .eq("slug", slug)
        .is("deleted_at", null)
        .single();

      if (slugCheckError && slugCheckError.code !== "PGRST116") {
        return { success: false, error: "Failed to validate slug" };
      }

      if (existingBranch) {
        return { success: false, error: "Slug is already in use" };
      }
    }

    const branchData: BranchInsert = {
      name: data.name.trim(),
      slug: data.slug?.trim().toLowerCase() || null,
      organization_id: data.organization_id,
    };

    const { data: branch, error } = await supabase
      .from("branches")
      .insert(branchData)
      .select()
      .single();

    if (error) {
      console.error("Error creating branch:", error);
      return { success: false, error: "Failed to create branch" };
    }

    // Revalidate the branches page and refresh branch context
    revalidatePath("/dashboard-old/organization/branches");
    await refreshBranchContext(data.organization_id);

    return { success: true, data: branch };
  } catch (error) {
    console.error("Unexpected error creating branch:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Server action to update an existing branch
 */
export async function updateBranchAction(
  branchId: string,
  data: UpdateBranchData
): Promise<ActionResult<Tables["branches"]["Row"]>> {
  try {
    const supabase = await createClient();

    if (!branchId) {
      return { success: false, error: "Branch ID is required" };
    }

    // Validate name if provided
    if (data.name !== undefined && !data.name?.trim()) {
      return { success: false, error: "Branch name cannot be empty" };
    }

    // Validate slug if provided
    if (data.slug !== undefined && data.slug) {
      const slug = data.slug.trim().toLowerCase();

      // Check slug format
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return {
          success: false,
          error: "Slug can only contain lowercase letters, numbers, and hyphens",
        };
      }

      // Get current branch to check organization_id
      const { data: currentBranch, error: fetchError } = await supabase
        .from("branches")
        .select("organization_id")
        .eq("id", branchId)
        .is("deleted_at", null)
        .single();

      if (fetchError) {
        return { success: false, error: "Branch not found" };
      }

      // Check if slug is already used by another branch
      const { data: existingBranch, error: slugCheckError } = await supabase
        .from("branches")
        .select("id")
        .eq("organization_id", currentBranch.organization_id)
        .eq("slug", slug)
        .neq("id", branchId)
        .is("deleted_at", null)
        .single();

      if (slugCheckError && slugCheckError.code !== "PGRST116") {
        return { success: false, error: "Failed to validate slug" };
      }

      if (existingBranch) {
        return { success: false, error: "Slug is already in use" };
      }
    }

    const updateData: BranchUpdate = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }

    if (data.slug !== undefined) {
      updateData.slug = data.slug?.trim().toLowerCase() || null;
    }

    const { data: branch, error } = await supabase
      .from("branches")
      .update(updateData)
      .eq("id", branchId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      console.error("Error updating branch:", error);
      return { success: false, error: "Failed to update branch" };
    }

    // Revalidate the branches page and refresh branch context
    revalidatePath("/dashboard-old/organization/branches");
    await refreshBranchContext(branch.organization_id);

    return { success: true, data: branch };
  } catch (error) {
    console.error("Unexpected error updating branch:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Server action to soft delete a branch
 */
export async function deleteBranchAction(branchId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    if (!branchId) {
      return { success: false, error: "Branch ID is required" };
    }

    // Check if branch has users assigned
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id")
      .eq("default_branch_id", branchId)
      .is("deleted_at", null);

    if (usersError) {
      return { success: false, error: "Failed to check branch usage" };
    }

    if (users && users.length > 0) {
      return {
        success: false,
        error: `Cannot delete branch with ${users.length} assigned user(s). Please reassign users first.`,
      };
    }

    // Get the branch organization_id before deleting
    const { data: branchToDelete } = await supabase
      .from("branches")
      .select("organization_id")
      .eq("id", branchId)
      .is("deleted_at", null)
      .single();

    // Soft delete the branch
    const { error } = await supabase
      .from("branches")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", branchId)
      .is("deleted_at", null);

    if (error) {
      console.error("Error deleting branch:", error);
      return { success: false, error: "Failed to delete branch" };
    }

    // Revalidate the branches page and refresh branch context
    revalidatePath("/dashboard-old/organization/branches");
    if (branchToDelete) {
      await refreshBranchContext(branchToDelete.organization_id);
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error deleting branch:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
