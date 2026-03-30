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
