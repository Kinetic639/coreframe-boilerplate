"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/utils/assert-auth";
import { OrganizationService } from "@/server/services/organization.service";
import {
  createBranchSchema,
  updateBranchSchema,
  updateOrganizationSchema,
  type CreateBranchInput,
  type UpdateBranchInput,
  type UpdateOrganizationInput,
} from "@/server/schemas/organization.schema";

// ==========================================
// ORGANIZATION ACTIONS
// ==========================================

/**
 * Get organization details
 */
export async function getOrganizationAction() {
  try {
    const { supabase, organizationId } = await getUserContext();

    const organization = await OrganizationService.getOrganization(supabase, organizationId);

    if (!organization) {
      return { success: false, error: "Organization not found" };
    }

    return { success: true, data: organization };
  } catch (error) {
    console.error("[getOrganizationAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch organization",
    };
  }
}

/**
 * Update organization profile
 */
export async function updateOrganizationAction(input: UpdateOrganizationInput) {
  try {
    const { supabase, organizationId } = await getUserContext();

    // Validate input
    const validatedInput = updateOrganizationSchema.parse(input);

    const organization = await OrganizationService.updateOrganization(
      supabase,
      organizationId,
      validatedInput
    );

    // Revalidate organization pages
    revalidatePath("/dashboard/organization");

    return { success: true, data: organization };
  } catch (error) {
    console.error("[updateOrganizationAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update organization",
    };
  }
}

// ==========================================
// BRANCH ACTIONS
// ==========================================

/**
 * Get all branches for the organization
 */
export async function getBranchesAction() {
  try {
    const { supabase, organizationId } = await getUserContext();

    const branches = await OrganizationService.getBranches(supabase, organizationId);

    return { success: true, data: branches };
  } catch (error) {
    console.error("[getBranchesAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch branches",
    };
  }
}

/**
 * Get a single branch by ID
 */
export async function getBranchAction(branchId: string) {
  try {
    const { supabase } = await getUserContext();

    const branch = await OrganizationService.getBranch(supabase, branchId);

    if (!branch) {
      return { success: false, error: "Branch not found" };
    }

    return { success: true, data: branch };
  } catch (error) {
    console.error("[getBranchAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch branch",
    };
  }
}

/**
 * Create a new branch
 */
export async function createBranchAction(input: Omit<CreateBranchInput, "organization_id">) {
  try {
    const { supabase, organizationId } = await getUserContext();

    // Validate input
    const validatedInput = createBranchSchema.parse({
      ...input,
      organization_id: organizationId,
    });

    const branch = await OrganizationService.createBranch(supabase, validatedInput);

    // Revalidate organization and branch pages
    revalidatePath("/dashboard/organization");
    revalidatePath("/dashboard/organization/branches");

    return { success: true, data: branch };
  } catch (error) {
    console.error("[createBranchAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create branch",
    };
  }
}

/**
 * Update a branch
 */
export async function updateBranchAction(branchId: string, input: UpdateBranchInput) {
  try {
    const { supabase } = await getUserContext();

    // Validate input
    const validatedInput = updateBranchSchema.parse(input);

    const branch = await OrganizationService.updateBranch(supabase, branchId, validatedInput);

    // Revalidate organization and branch pages
    revalidatePath("/dashboard/organization");
    revalidatePath("/dashboard/organization/branches");
    revalidatePath(`/dashboard/organization/branches/${branchId}`);

    return { success: true, data: branch };
  } catch (error) {
    console.error("[updateBranchAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update branch",
    };
  }
}

/**
 * Delete a branch (soft delete)
 */
export async function deleteBranchAction(branchId: string) {
  try {
    const { supabase } = await getUserContext();

    await OrganizationService.deleteBranch(supabase, branchId);

    // Revalidate organization and branch pages
    revalidatePath("/dashboard/organization");
    revalidatePath("/dashboard/organization/branches");

    return { success: true };
  } catch (error) {
    console.error("[deleteBranchAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete branch",
    };
  }
}
