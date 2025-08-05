import { createClient } from "@/utils/supabase/client";
import { Database } from "../../../supabase/types/types";

type Tables = Database["public"]["Tables"];
type Role = Tables["roles"]["Row"];
type Permission = Tables["permissions"]["Row"];
type UserRoleAssignment = Tables["user_role_assignments"]["Row"];
type User = Tables["users"]["Row"];

export interface RoleWithUserCount extends Role {
  userCount: number;
  users: User[];
}

export interface UserRoleAssignmentWithDetails extends UserRoleAssignment {
  users: User | null;
  roles: Role | null;
}

export interface PermissionOverride {
  id: string;
  user_id: string;
  permission_id: string;
  organization_id: string;
  is_granted: boolean;
  permissions: Permission | null;
}

/**
 * Fetch all roles for an organization with user counts
 */
export async function fetchRolesWithUserCounts(
  organizationId: string
): Promise<RoleWithUserCount[]> {
  const supabase = createClient();

  // Fetch roles
  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .select("*")
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .is("deleted_at", null)
    .order("is_basic", { ascending: false })
    .order("name");

  if (rolesError) {
    throw new Error(`Failed to fetch roles: ${rolesError.message}`);
  }

  // Fetch user role assignments with user details
  const { data: assignments, error: assignmentsError } = await supabase
    .from("user_role_assignments")
    .select(
      `
      role_id,
      users:user_id (
        id,
        email,
        first_name,
        last_name,
        avatar_url
      )
    `
    )
    .eq("scope_id", organizationId)
    .is("deleted_at", null);

  if (assignmentsError) {
    throw new Error(`Failed to fetch user assignments: ${assignmentsError.message}`);
  }

  // Combine roles with user counts and user details
  const rolesWithUserCounts: RoleWithUserCount[] = (roles || []).map((role) => {
    const roleAssignments = assignments?.filter((a) => a.role_id === role.id) || [];
    const users = roleAssignments.map((a) => a.users).filter(Boolean) as User[];

    return {
      ...role,
      userCount: roleAssignments.length,
      users,
    };
  });

  return rolesWithUserCounts;
}

/**
 * Fetch all permissions
 */
export async function fetchAllPermissions(): Promise<Permission[]> {
  const supabase = createClient();

  const { data: permissions, error } = await supabase.from("permissions").select("*").order("slug");

  if (error) {
    throw new Error(`Failed to fetch permissions: ${error.message}`);
  }

  return permissions || [];
}

/**
 * Fetch user role assignments for an organization
 */
export async function fetchUserRoleAssignments(
  organizationId: string
): Promise<UserRoleAssignmentWithDetails[]> {
  const supabase = createClient();

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
        avatar_url,
        status_id
      ),
      roles:role_id (
        id,
        name,
        is_basic,
        organization_id
      )
    `
    )
    .eq("scope_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch user role assignments: ${error.message}`);
  }

  return assignments || [];
}

/**
 * Fetch users in an organization
 */
export async function fetchOrganizationUsers(organizationId: string): Promise<User[]> {
  const supabase = createClient();

  // Get all users who have role assignments in this organization
  const { data: assignments, error: assignmentsError } = await supabase
    .from("user_role_assignments")
    .select(
      `
      user_id,
      users:user_id (
        id,
        email,
        first_name,
        last_name,
        avatar_url,
        status_id,
        created_at
      )
    `
    )
    .eq("scope_id", organizationId)
    .is("deleted_at", null);

  if (assignmentsError) {
    throw new Error(`Failed to fetch organization users: ${assignmentsError.message}`);
  }

  // Extract unique users
  const usersMap = new Map<string, User>();
  assignments?.forEach((assignment) => {
    if (assignment.users) {
      usersMap.set(assignment.users.id, assignment.users);
    }
  });

  return Array.from(usersMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Fetch permission overrides for a user
 */
export async function fetchUserPermissionOverrides(
  userId: string,
  organizationId: string
): Promise<PermissionOverride[]> {
  const supabase = createClient();

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
 * Get role statistics for dashboard
 */
export async function fetchRoleStatistics(organizationId: string) {
  const supabase = createClient();

  // Get total roles count
  const { count: totalRoles, error: rolesCountError } = await supabase
    .from("roles")
    .select("*", { count: "exact", head: true })
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .is("deleted_at", null);

  if (rolesCountError) {
    throw new Error(`Failed to fetch roles count: ${rolesCountError.message}`);
  }

  // Get total assignments count
  const { count: totalAssignments, error: assignmentsCountError } = await supabase
    .from("user_role_assignments")
    .select("*", { count: "exact", head: true })
    .eq("scope_id", organizationId)
    .is("deleted_at", null);

  if (assignmentsCountError) {
    throw new Error(`Failed to fetch assignments count: ${assignmentsCountError.message}`);
  }

  // Get org owners count
  const { data: orgOwnerRole, error: orgOwnerRoleError } = await supabase
    .from("roles")
    .select("id")
    .eq("name", "org_owner")
    .single();

  if (orgOwnerRoleError) {
    throw new Error(`Failed to fetch org owner role: ${orgOwnerRoleError.message}`);
  }

  const { count: orgOwnersCount, error: orgOwnersCountError } = await supabase
    .from("user_role_assignments")
    .select("*", { count: "exact", head: true })
    .eq("role_id", orgOwnerRole.id)
    .eq("scope_id", organizationId)
    .is("deleted_at", null);

  if (orgOwnersCountError) {
    throw new Error(`Failed to fetch org owners count: ${orgOwnersCountError.message}`);
  }

  // Get total permissions count
  const { count: totalPermissions, error: permissionsCountError } = await supabase
    .from("permissions")
    .select("*", { count: "exact", head: true });

  if (permissionsCountError) {
    throw new Error(`Failed to fetch permissions count: ${permissionsCountError.message}`);
  }

  return {
    totalRoles: totalRoles || 0,
    totalAssignments: totalAssignments || 0,
    orgOwnersCount: orgOwnersCount || 0,
    totalPermissions: totalPermissions || 0,
  };
}
