"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { getUserRolesFromJWT } from "@/utils/auth/getUserRolesFromJWT";
import { hasMatchingRole } from "@/utils/auth/hasMatchingRole";
import { z } from "zod";

// Validation schemas
const CreateRoleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  organization_id: z.string().uuid("Invalid organization ID"),
  is_basic: z.boolean().default(false),
});

const AssignRoleSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  role_id: z.string().uuid("Invalid role ID"),
  scope: z.enum(["org", "branch"], { message: "Scope must be org or branch" }),
  scope_id: z.string().uuid("Invalid scope ID"),
});

const RevokeRoleSchema = z.object({
  assignment_id: z.string().uuid("Invalid assignment ID"),
});

const CreatePermissionOverrideSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  permission_id: z.string().uuid("Invalid permission ID"),
  organization_id: z.string().uuid("Invalid organization ID"),
  is_granted: z.boolean(),
});

// Helper function to verify org owner permissions
async function verifyOrgOwnerAccess(organizationId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return false;
  }

  const roles = getUserRolesFromJWT(session.access_token);
  return (
    hasMatchingRole(roles, [
      {
        role: "org_owner",
        scope: "org",
      },
    ]) && roles.some((r) => r.role === "org_owner" && r.scope_id === organizationId)
  );
}

// Server Actions

/**
 * Get all roles available for an organization
 */
export async function getRolesForOrganization(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("You must be signed in to perform this action");
  }

  const { data: roles, error } = await supabase
    .from("roles")
    .select("*")
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .is("deleted_at", null)
    .order("is_basic", { ascending: false })
    .order("name");

  if (error) {
    throw new Error(`Failed to fetch roles: ${error.message}`);
  }

  return roles || [];
}

/**
 * Get all permissions available in the system
 */
export async function getAllPermissions() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("You must be signed in to perform this action");
  }

  const { data: permissions, error } = await supabase.from("permissions").select("*").order("slug");

  if (error) {
    throw new Error(`Failed to fetch permissions: ${error.message}`);
  }

  return permissions || [];
}

/**
 * Get user role assignments for an organization
 */
export async function getUserRoleAssignments(organizationId: string) {
  const supabase = await createClient();

  // Check if user has access to view assignments
  if (!(await verifyOrgOwnerAccess(organizationId))) {
    throw new Error("Unauthorized: Only organization owners can view role assignments");
  }

  const { data: assignments, error } = await supabase
    .from("user_role_assignments")
    .select(
      `
      *,
      users:user_id (
        id,
        email,
        first_name,
        last_name,
        avatar_url
      ),
      roles:role_id (
        id,
        name,
        is_basic
      )
    `
    )
    .eq("scope_id", organizationId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to fetch user role assignments: ${error.message}`);
  }

  return assignments || [];
}

/**
 * Create a custom role for an organization
 */
export async function createCustomRole(
  state: unknown,
  formData: FormData
): Promise<{ success?: boolean; error?: string; errors?: Record<string, string[]> }> {
  const validatedFields = CreateRoleSchema.safeParse({
    name: formData.get("name"),
    organization_id: formData.get("organization_id"),
    is_basic: formData.get("is_basic") === "true",
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { name, organization_id, is_basic } = validatedFields.data;

  // Verify permissions
  if (!(await verifyOrgOwnerAccess(organization_id))) {
    return { error: "Unauthorized: Only organization owners can create custom roles" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("roles")
    .insert({
      name,
      organization_id,
      is_basic,
    })
    .select()
    .single();

  if (error) {
    return { error: `Failed to create role: ${error.message}` };
  }

  revalidatePath("/dashboard/organization/users/roles");
  return { success: true };
}

/**
 * Assign a role to a user
 */
export async function assignUserRole(
  state: unknown,
  formData: FormData
): Promise<{ success?: boolean; error?: string; errors?: Record<string, string[]> }> {
  const validatedFields = AssignRoleSchema.safeParse({
    user_id: formData.get("user_id"),
    role_id: formData.get("role_id"),
    scope: formData.get("scope"),
    scope_id: formData.get("scope_id"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { user_id, role_id, scope, scope_id } = validatedFields.data;

  // Verify permissions (only org owners can assign roles)
  if (scope === "org" && !(await verifyOrgOwnerAccess(scope_id))) {
    return { error: "Unauthorized: Only organization owners can assign roles" };
  }

  const supabase = await createClient();

  // Check if assignment already exists
  const { data: existingAssignment } = await supabase
    .from("user_role_assignments")
    .select("id")
    .eq("user_id", user_id)
    .eq("role_id", role_id)
    .eq("scope", scope)
    .eq("scope_id", scope_id)
    .is("deleted_at", null)
    .single();

  if (existingAssignment) {
    return { error: "User already has this role assigned" };
  }

  const { error } = await supabase.from("user_role_assignments").insert({
    user_id,
    role_id,
    scope,
    scope_id,
  });

  if (error) {
    return { error: `Failed to assign role: ${error.message}` };
  }

  revalidatePath("/dashboard/organization/users/roles");
  return { success: true };
}

/**
 * Revoke a role assignment from a user
 */
export async function revokeUserRole(
  state: unknown,
  formData: FormData
): Promise<{ success?: boolean; error?: string; errors?: Record<string, string[]> }> {
  const validatedFields = RevokeRoleSchema.safeParse({
    assignment_id: formData.get("assignment_id"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { assignment_id } = validatedFields.data;
  const supabase = await createClient();

  // Get assignment details to verify permissions
  const { data: assignment, error: fetchError } = await supabase
    .from("user_role_assignments")
    .select("scope_id, scope")
    .eq("id", assignment_id)
    .single();

  if (fetchError || !assignment) {
    return { error: "Role assignment not found" };
  }

  // Verify permissions
  if (assignment.scope === "org" && !(await verifyOrgOwnerAccess(assignment.scope_id))) {
    return { error: "Unauthorized: Only organization owners can revoke roles" };
  }

  // Soft delete the assignment
  const { error } = await supabase
    .from("user_role_assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", assignment_id);

  if (error) {
    return { error: `Failed to revoke role: ${error.message}` };
  }

  revalidatePath("/dashboard/organization/users/roles");
  return { success: true };
}

/**
 * Create a permission override for a user
 */
export async function createPermissionOverride(
  state: unknown,
  formData: FormData
): Promise<{ success?: boolean; error?: string; errors?: Record<string, string[]> }> {
  const validatedFields = CreatePermissionOverrideSchema.safeParse({
    user_id: formData.get("user_id"),
    permission_id: formData.get("permission_id"),
    organization_id: formData.get("organization_id"),
    is_granted: formData.get("is_granted") === "true",
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { user_id, permission_id, organization_id, is_granted } = validatedFields.data;

  // Verify permissions
  if (!(await verifyOrgOwnerAccess(organization_id))) {
    return { error: "Unauthorized: Only organization owners can create permission overrides" };
  }

  const supabase = await createClient();

  // Check if override already exists
  const { data: existingOverride } = await supabase
    .from("user_permission_overrides")
    .select("id")
    .eq("user_id", user_id)
    .eq("permission_id", permission_id)
    .eq("organization_id", organization_id)
    .is("deleted_at", null)
    .single();

  if (existingOverride) {
    // Update existing override
    const { error } = await supabase
      .from("user_permission_overrides")
      .update({ is_granted })
      .eq("id", existingOverride.id);

    if (error) {
      return { error: `Failed to update permission override: ${error.message}` };
    }
  } else {
    // Create new override
    const { error } = await supabase.from("user_permission_overrides").insert({
      user_id,
      permission_id,
      organization_id,
      is_granted,
    });

    if (error) {
      return { error: `Failed to create permission override: ${error.message}` };
    }
  }

  revalidatePath("/dashboard/organization/users/roles");
  return { success: true };
}

/**
 * Get permission overrides for a user in an organization
 */
export async function getUserPermissionOverrides(userId: string, organizationId: string) {
  const supabase = await createClient();

  // Verify permissions
  if (!(await verifyOrgOwnerAccess(organizationId))) {
    throw new Error("Unauthorized: Only organization owners can view permission overrides");
  }

  const { data: overrides, error } = await supabase
    .from("user_permission_overrides")
    .select(
      `
      *,
      permissions:permission_id (
        id,
        slug,
        label
      )
    `
    )
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to fetch permission overrides: ${error.message}`);
  }

  return overrides || [];
}

/**
 * Remove a permission override
 */
export async function removePermissionOverride(
  state: unknown,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const overrideId = formData.get("override_id") as string;

  if (!overrideId) {
    return { error: "Override ID is required" };
  }

  const supabase = await createClient();

  // Get override details to verify permissions
  const { data: override, error: fetchError } = await supabase
    .from("user_permission_overrides")
    .select("organization_id")
    .eq("id", overrideId)
    .single();

  if (fetchError || !override) {
    return { error: "Permission override not found" };
  }

  // Verify permissions
  if (!(await verifyOrgOwnerAccess(override.organization_id))) {
    return { error: "Unauthorized: Only organization owners can remove permission overrides" };
  }

  // Soft delete the override
  const { error } = await supabase
    .from("user_permission_overrides")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", overrideId);

  if (error) {
    return { error: `Failed to remove permission override: ${error.message}` };
  }

  revalidatePath("/dashboard/organization/users/roles");
  return { success: true };
}
