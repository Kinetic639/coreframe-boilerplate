"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type RoleWithPermissions = {
  id: string;
  name: string;
  description: string | null;
  organization_id: string | null;
  is_basic: boolean;
  deleted_at: string | null;
  permissions: {
    id: string;
    slug: string;
    label: string | null;
    category: string;
    allowed: boolean;
  }[];
  assignedUsersCount?: number;
};

export type UserWithRole = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  assignedAt: string;
};

export type PermissionsByCategory = {
  [category: string]: {
    id: string;
    slug: string;
    label: string | null;
    category: string;
    description: string | null;
  }[];
};

/**
 * Fetch all permissions grouped by category
 */
export async function fetchPermissionsByCategory(): Promise<PermissionsByCategory> {
  const supabase = await createClient();

  const { data: permissions, error } = await supabase
    .from("permissions")
    .select("id, slug, label, category, description")
    .is("deleted_at", null)
    .order("category")
    .order("slug");

  if (error) {
    throw new Error(`Failed to fetch permissions: ${error.message}`);
  }

  const grouped = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as PermissionsByCategory);

  return grouped;
}

/**
 * Fetch role details with permissions
 */
export async function fetchRoleDetails(roleId: string): Promise<RoleWithPermissions | null> {
  const supabase = await createClient();

  // Get current session and organization
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("No active session");
  }

  // Get user's organization
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("organization_id")
    .eq("user_id", session.user.id)
    .single();

  if (!preferences?.organization_id) {
    throw new Error("No organization assigned to user");
  }

  // Verify user has permission to read roles
  const { data: authResult } = await supabase.rpc("authorize", {
    user_id: session.user.id,
    required_permissions: ["role.read"],
    organization_id: preferences.organization_id,
  });

  if (!authResult?.authorized) {
    throw new Error("Insufficient permissions to read roles");
  }

  // Fetch role details
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("*")
    .eq("id", roleId)
    .single();

  if (roleError) {
    throw new Error(`Failed to fetch role: ${roleError.message}`);
  }

  if (!role) {
    return null;
  }

  // For organization-specific roles, check if it belongs to user's organization
  if (role.organization_id && role.organization_id !== preferences.organization_id) {
    throw new Error("Access denied: Role belongs to different organization");
  }

  // Fetch role permissions
  const { data: rolePermissions, error: permError } = await supabase
    .from("role_permissions")
    .select(
      `
      permission_id,
      allowed,
      permissions!inner (
        id,
        slug,
        label,
        category
      )
    `
    )
    .eq("role_id", roleId)
    .is("deleted_at", null);

  if (permError) {
    throw new Error(`Failed to fetch role permissions: ${permError.message}`);
  }

  // Count assigned users for this organization
  const { count: assignedUsersCount } = await supabase
    .from("user_role_assignments")
    .select("*", { count: "exact", head: true })
    .eq("role_id", roleId)
    .eq("scope_id", preferences.organization_id)
    .is("deleted_at", null);

  const permissions = rolePermissions.map((rp: any) => ({
    id: rp.permissions.id,
    slug: rp.permissions.slug,
    label: rp.permissions.label,
    category: rp.permissions.category,
    allowed: rp.allowed,
  }));

  return {
    ...role,
    permissions,
    assignedUsersCount: assignedUsersCount || 0,
  };
}

/**
 * Fetch all roles for the current organization
 */
export async function fetchOrganizationRoles(): Promise<RoleWithPermissions[]> {
  const supabase = await createClient();

  // Get current session and organization
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("No active session");
  }

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("organization_id")
    .eq("user_id", session.user.id)
    .single();

  if (!preferences?.organization_id) {
    throw new Error("No organization assigned to user");
  }

  // Verify user has permission to read roles
  const { data: authResult } = await supabase.rpc("authorize", {
    user_id: session.user.id,
    required_permissions: ["role.read"],
    organization_id: preferences.organization_id,
  });

  if (!authResult?.authorized) {
    throw new Error("Insufficient permissions to read roles");
  }

  // Fetch basic roles and organization-specific roles
  const { data: roles, error } = await supabase
    .from("roles")
    .select("*")
    .or(`organization_id.is.null,organization_id.eq.${preferences.organization_id}`)
    .is("deleted_at", null)
    .order("is_basic", { ascending: false })
    .order("name");

  if (error) {
    throw new Error(`Failed to fetch roles: ${error.message}`);
  }

  // Get user counts for each role filtered by organization
  const rolesWithCounts = await Promise.all(
    roles.map(async (role) => {
      const { count } = await supabase
        .from("user_role_assignments")
        .select("*", { count: "exact", head: true })
        .eq("role_id", role.id)
        .eq("scope_id", preferences.organization_id)
        .is("deleted_at", null);

      return {
        ...role,
        permissions: [],
        assignedUsersCount: count || 0,
      };
    })
  );

  return rolesWithCounts;
}

/**
 * Create a new role
 */
export async function createRole(data: {
  name: string;
  description?: string;
  permissionIds: string[];
}): Promise<{ success: boolean; roleId?: string; error?: string }> {
  const supabase = await createClient();

  try {
    // Get current session and organization
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "No active session" };
    }

    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("organization_id")
      .eq("user_id", session.user.id)
      .single();

    if (!preferences?.organization_id) {
      return { success: false, error: "No organization assigned to user" };
    }

    // Verify user has permission to create roles
    const { data: authResult } = await supabase.rpc("authorize", {
      user_id: session.user.id,
      required_permissions: ["role.create"],
      organization_id: preferences.organization_id,
    });

    if (!authResult?.authorized) {
      return { success: false, error: "Insufficient permissions to create roles" };
    }

    // Create the role
    const { data: newRole, error: roleError } = await supabase
      .from("roles")
      .insert({
        name: data.name,
        description: data.description || null,
        organization_id: preferences.organization_id,
        is_basic: false,
      })
      .select()
      .single();

    if (roleError) {
      return { success: false, error: `Failed to create role: ${roleError.message}` };
    }

    // Add permissions to the role
    if (data.permissionIds.length > 0) {
      const rolePermissions = data.permissionIds.map((permissionId) => ({
        role_id: newRole.id,
        permission_id: permissionId,
        allowed: true,
      }));

      const { error: permError } = await supabase.from("role_permissions").insert(rolePermissions);

      if (permError) {
        // Clean up: delete the created role if permission assignment fails
        await supabase.from("roles").delete().eq("id", newRole.id);
        return { success: false, error: `Failed to assign permissions: ${permError.message}` };
      }
    }

    revalidatePath("/dashboard/organization/users/roles");
    return { success: true, roleId: newRole.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Update an existing role
 */
export async function updateRole(
  roleId: string,
  data: {
    name: string;
    description?: string;
    permissionIds: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get current session and organization
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "No active session" };
    }

    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("organization_id")
      .eq("user_id", session.user.id)
      .single();

    if (!preferences?.organization_id) {
      return { success: false, error: "No organization assigned to user" };
    }

    // Verify user has permission to update roles
    const { data: authResult } = await supabase.rpc("authorize", {
      user_id: session.user.id,
      required_permissions: ["role.update"],
      organization_id: preferences.organization_id,
    });

    if (!authResult?.authorized) {
      return { success: false, error: "Insufficient permissions to update roles" };
    }

    // Check if role exists and belongs to organization
    const { data: existingRole, error: fetchError } = await supabase
      .from("roles")
      .select("*")
      .eq("id", roleId)
      .single();

    if (fetchError || !existingRole) {
      return { success: false, error: "Role not found" };
    }

    // Don't allow editing basic roles
    if (existingRole.is_basic) {
      return { success: false, error: "Cannot edit basic roles" };
    }

    // Verify role belongs to user's organization
    if (existingRole.organization_id !== preferences.organization_id) {
      return { success: false, error: "Access denied: Role belongs to different organization" };
    }

    // Update role details
    const { error: updateError } = await supabase
      .from("roles")
      .update({
        name: data.name,
        description: data.description || null,
      })
      .eq("id", roleId);

    if (updateError) {
      return { success: false, error: `Failed to update role: ${updateError.message}` };
    }

    // Update permissions: delete existing and add new ones
    const { error: deleteError } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId);

    if (deleteError) {
      return { success: false, error: `Failed to update permissions: ${deleteError.message}` };
    }

    if (data.permissionIds.length > 0) {
      const rolePermissions = data.permissionIds.map((permissionId) => ({
        role_id: roleId,
        permission_id: permissionId,
        allowed: true,
      }));

      const { error: insertError } = await supabase
        .from("role_permissions")
        .insert(rolePermissions);

      if (insertError) {
        return { success: false, error: `Failed to assign permissions: ${insertError.message}` };
      }
    }

    revalidatePath("/dashboard/organization/users/roles");
    revalidatePath(`/dashboard/organization/roles/${roleId}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Delete a role
 */
export async function deleteRole(roleId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get current session and organization
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "No active session" };
    }

    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("organization_id")
      .eq("user_id", session.user.id)
      .single();

    if (!preferences?.organization_id) {
      return { success: false, error: "No organization assigned to user" };
    }

    // Verify user has permission to delete roles
    const { data: authResult } = await supabase.rpc("authorize", {
      user_id: session.user.id,
      required_permissions: ["role.delete"],
      organization_id: preferences.organization_id,
    });

    if (!authResult?.authorized) {
      return { success: false, error: "Insufficient permissions to delete roles" };
    }

    // Check if role exists and belongs to organization
    const { data: existingRole, error: fetchError } = await supabase
      .from("roles")
      .select("*")
      .eq("id", roleId)
      .single();

    if (fetchError || !existingRole) {
      return { success: false, error: "Role not found" };
    }

    // Don't allow deleting basic roles
    if (existingRole.is_basic) {
      return { success: false, error: "Cannot delete basic roles" };
    }

    // Verify role belongs to user's organization
    if (existingRole.organization_id !== preferences.organization_id) {
      return { success: false, error: "Access denied: Role belongs to different organization" };
    }

    // Check if role is assigned to any users in this organization
    const { count: assignedUsers } = await supabase
      .from("user_role_assignments")
      .select("*", { count: "exact", head: true })
      .eq("role_id", roleId)
      .eq("scope_id", preferences.organization_id)
      .is("deleted_at", null);

    if (assignedUsers && assignedUsers > 0) {
      return {
        success: false,
        error: "Cannot delete role that is assigned to users. Please reassign users first.",
      };
    }

    // Delete role permissions first
    const { error: deletePermError } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId);

    if (deletePermError) {
      return {
        success: false,
        error: `Failed to delete role permissions: ${deletePermError.message}`,
      };
    }

    // Soft delete the role
    const { error: deleteError } = await supabase
      .from("roles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", roleId);

    if (deleteError) {
      return { success: false, error: `Failed to delete role: ${deleteError.message}` };
    }

    revalidatePath("/dashboard/organization/users/roles");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Clone a role with all its permissions
 */
export async function cloneRole(
  sourceRoleId: string,
  newName: string
): Promise<{ success: boolean; roleId?: string; error?: string }> {
  try {
    // Get the source role with permissions
    const sourceRole = await fetchRoleDetails(sourceRoleId);
    if (!sourceRole) {
      return { success: false, error: "Source role not found" };
    }

    // Get permission IDs that are allowed
    const permissionIds = sourceRole.permissions.filter((p) => p.allowed).map((p) => p.id);

    // Create the new role
    const result = await createRole({
      name: newName,
      permissionIds,
    });

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Fetch users assigned to a specific role
 */
export async function fetchRoleUsers(roleId: string): Promise<UserWithRole[]> {
  const supabase = await createClient();

  // Get current session and organization
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("No active session");
  }

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("organization_id")
    .eq("user_id", session.user.id)
    .single();

  if (!preferences?.organization_id) {
    throw new Error("No organization assigned to user");
  }

  // Verify user has permission to read users
  const { data: authResult } = await supabase.rpc("authorize", {
    user_id: session.user.id,
    required_permissions: ["user.read"],
    organization_id: preferences.organization_id,
  });

  if (!authResult?.authorized) {
    throw new Error("Insufficient permissions to read users");
  }

  // Fetch users assigned to this role in the current organization
  const { data, error } = await supabase
    .from("user_role_assignments")
    .select(
      `
      created_at,
      users!inner (
        id,
        first_name,
        last_name,
        email
      )
    `
    )
    .eq("role_id", roleId)
    .eq("scope_id", preferences.organization_id)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to fetch role users: ${error.message}`);
  }

  return data.map((assignment: any) => ({
    id: assignment.users.id,
    first_name: assignment.users.first_name,
    last_name: assignment.users.last_name,
    email: assignment.users.email,
    assignedAt: assignment.created_at,
  }));
}
