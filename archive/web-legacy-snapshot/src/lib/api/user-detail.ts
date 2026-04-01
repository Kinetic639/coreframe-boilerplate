import { createClient } from "@/utils/supabase/client";
import { Database } from "../../../supabase/types/types";

type Tables = Database["public"]["Tables"];
type User = Tables["users"]["Row"];
type Role = Tables["roles"]["Row"];
type Branch = Tables["branches"]["Row"];
type Permission = Tables["permissions"]["Row"];
type UserRoleAssignment = Tables["user_role_assignments"]["Row"];
type UserPermissionOverride = Tables["user_permission_overrides"]["Row"];

export interface UserWithRoleAssignment extends UserRoleAssignment {
  role: Role;
  scope_name?: string;
}

export interface UserPermissionOverrideWithDetails extends UserPermissionOverride {
  permission: Permission;
}

export interface UserDetailWithAssignments extends User {
  roles: UserWithRoleAssignment[];
  branch: Branch | null;
  permissionOverrides: UserPermissionOverrideWithDetails[];
}

/**
 * Fetch detailed user information including all roles and permission overrides
 */
export async function fetchUserDetail(
  userId: string,
  organizationId: string
): Promise<UserDetailWithAssignments | null> {
  const supabase = createClient();

  // Fetch user basic info
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .is("deleted_at", null)
    .single();

  if (userError) {
    throw new Error(`Failed to fetch user: ${userError.message}`);
  }

  if (!user) {
    return null;
  }

  // Fetch all role assignments for this user in the organization
  const { data: roleAssignments, error: roleAssignmentsError } = await supabase
    .from("user_role_assignments")
    .select("*")
    .eq("user_id", userId)
    .eq("scope_id", organizationId)
    .is("deleted_at", null);

  if (roleAssignmentsError) {
    throw new Error(`Failed to fetch role assignments: ${roleAssignmentsError.message}`);
  }

  // Fetch role details if we have assignments
  let roles: UserWithRoleAssignment[] = [];
  if (roleAssignments && roleAssignments.length > 0) {
    const roleIds = [...new Set(roleAssignments.map((ra) => ra.role_id))];

    const { data: roleData, error: roleError } = await supabase
      .from("roles")
      .select("*")
      .in("id", roleIds)
      .is("deleted_at", null);

    if (roleError) {
      throw new Error(`Failed to fetch roles: ${roleError.message}`);
    }

    // Create role map for quick lookup
    const roleMap = new Map<string, Role>();
    roleData?.forEach((role) => roleMap.set(role.id, role));

    // Fetch organization and branch names for scope display
    const { data: orgData } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", organizationId)
      .single();

    const branchIds = roleAssignments
      .filter((ra) => ra.scope === "branch")
      .map((ra) => ra.scope_id);

    const branchMap = new Map<string, string>();
    if (branchIds.length > 0) {
      const { data: branchData } = await supabase
        .from("branches")
        .select("id, name")
        .in("id", branchIds)
        .is("deleted_at", null);

      branchData?.forEach((branch) => branchMap.set(branch.id, branch.name || ""));
    }

    // Combine role assignments with role details
    roles = roleAssignments.map((assignment) => {
      const role = roleMap.get(assignment.role_id);
      let scopeName = "";

      if (assignment.scope === "org") {
        scopeName = orgData?.name || "Organization";
      } else if (assignment.scope === "branch") {
        scopeName = branchMap.get(assignment.scope_id) || "Branch";
      }

      return {
        ...assignment,
        role: role!,
        scope_name: scopeName,
      };
    });
  }

  // Fetch user's default branch details
  let branch: Branch | null = null;
  if (user.default_branch_id) {
    const { data: branchData, error: branchError } = await supabase
      .from("branches")
      .select("*")
      .eq("id", user.default_branch_id)
      .is("deleted_at", null)
      .single();

    if (!branchError && branchData) {
      branch = branchData;
    }
  }

  // Fetch permission overrides for this user in the organization
  const { data: permissionOverrides, error: overridesError } = await supabase
    .from("user_permission_overrides")
    .select("*")
    .eq("user_id", userId)
    .eq("scope_id", organizationId)
    .is("deleted_at", null);

  if (overridesError) {
    throw new Error(`Failed to fetch permission overrides: ${overridesError.message}`);
  }

  // Fetch permission details for overrides
  let permissionOverridesWithDetails: UserPermissionOverrideWithDetails[] = [];
  if (permissionOverrides && permissionOverrides.length > 0) {
    const permissionIds = [...new Set(permissionOverrides.map((po) => po.permission_id))];

    const { data: permissionData, error: permissionError } = await supabase
      .from("permissions")
      .select("*")
      .in("id", permissionIds)
      .is("deleted_at", null);

    if (permissionError) {
      throw new Error(`Failed to fetch permissions: ${permissionError.message}`);
    }

    // Create permission map for quick lookup
    const permissionMap = new Map<string, Permission>();
    permissionData?.forEach((permission) => permissionMap.set(permission.id, permission));

    // Combine overrides with permission details
    permissionOverridesWithDetails = permissionOverrides.map((override) => ({
      ...override,
      permission: permissionMap.get(override.permission_id)!,
    }));
  }

  return {
    ...user,
    roles,
    branch,
    permissionOverrides: permissionOverridesWithDetails,
  };
}

/**
 * Update user profile information
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    first_name?: string;
    last_name?: string;
    default_branch_id?: string | null;
  }
): Promise<void> {
  const supabase = createClient();

  // Filter out undefined values to avoid database issues
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, value]) => value !== undefined)
  );

  const { error } = await supabase.from("users").update(cleanUpdates).eq("id", userId);

  if (error) {
    console.error("Update user profile error:", error);
    throw new Error(`Failed to update user profile: ${error.message}`);
  }
}

/**
 * Update user status
 */
export async function updateUserStatus(userId: string, status: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("users").update({ status_id: status }).eq("id", userId);

  if (error) {
    throw new Error(`Failed to update user status: ${error.message}`);
  }
}

/**
 * Assign a role to a user
 */
export async function assignUserRole(
  userId: string,
  roleId: string,
  scope: "org" | "branch",
  scopeId: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("user_role_assignments").insert({
    user_id: userId,
    role_id: roleId,
    scope,
    scope_id: scopeId,
  });

  if (error) {
    throw new Error(`Failed to assign role: ${error.message}`);
  }
}

/**
 * Remove a role assignment from a user
 */
export async function removeUserRole(assignmentId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("user_role_assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", assignmentId);

  if (error) {
    throw new Error(`Failed to remove role: ${error.message}`);
  }
}

/**
 * Create or update a permission override for a user
 */
export async function upsertPermissionOverride(
  userId: string,
  organizationId: string,
  permissionId: string,
  isGranted: boolean,
  branchId?: string | null
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("user_permission_overrides").upsert({
    user_id: userId,
    permission_id: permissionId,
    allowed: isGranted,
    scope: branchId ? "branch" : "org",
    scope_id: branchId || organizationId,
  });

  if (error) {
    throw new Error(`Failed to update permission override: ${error.message}`);
  }
}

/**
 * Remove a permission override
 */
export async function removePermissionOverride(overrideId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("user_permission_overrides")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", overrideId);

  if (error) {
    throw new Error(`Failed to remove permission override: ${error.message}`);
  }
}

/**
 * Fetch all available roles for the organization
 */
export async function fetchAvailableRoles(organizationId: string): Promise<Role[]> {
  const supabase = createClient();

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
 * Fetch all available permissions
 */
export async function fetchAvailablePermissions(): Promise<Permission[]> {
  const supabase = createClient();

  const { data: permissions, error } = await supabase
    .from("permissions")
    .select("*")
    .is("deleted_at", null)
    .order("slug");

  if (error) {
    throw new Error(`Failed to fetch permissions: ${error.message}`);
  }

  return permissions || [];
}
