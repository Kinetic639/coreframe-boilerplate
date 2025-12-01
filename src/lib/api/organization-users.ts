import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/supabase";

type Tables = Database["public"]["Tables"];
type User = Tables["users"]["Row"];
type Role = Tables["roles"]["Row"];
type Branch = Tables["branches"]["Row"];

export interface OrganizationUserWithDetails extends User {
  role: Role | null;
  branch: Branch | null;
  userRoleAssignment: {
    id: string;
    scope: string;
    scope_id: string;
  } | null;
}

/**
 * Fetch all users in an organization with their roles and branch details
 */
export async function fetchOrganizationUsersWithDetails(
  organizationId: string
): Promise<OrganizationUserWithDetails[]> {
  const supabase = createClient();

  // Get all user role assignments for this organization (without joins first)
  const { data: assignments, error: assignmentsError } = await supabase
    .from("user_role_assignments")
    .select("*")
    .eq("scope_id", organizationId)
    .is("deleted_at", null);

  if (assignmentsError) {
    throw new Error(`Failed to fetch user assignments: ${assignmentsError.message}`);
  }

  if (!assignments || assignments.length === 0) {
    return [];
  }

  // Get unique user IDs and role IDs
  const userIds = [...new Set(assignments.map((a) => a.user_id))];
  const roleIds = [...new Set(assignments.map((a) => a.role_id))];

  // Fetch users separately
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("*")
    .in("id", userIds)
    .is("deleted_at", null);

  if (usersError) {
    throw new Error(`Failed to fetch users: ${usersError.message}`);
  }

  // Fetch roles separately
  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .select("*")
    .in("id", roleIds)
    .is("deleted_at", null);

  if (rolesError) {
    throw new Error(`Failed to fetch roles: ${rolesError.message}`);
  }

  // Create maps for quick lookup
  const userMap = new Map<string, User>();
  const roleMap = new Map<string, Role>();

  users?.forEach((user) => userMap.set(user.id, user));
  roles?.forEach((role) => roleMap.set(role.id, role));

  // Get branch details for users
  const branchIds = users?.map((user) => user.default_branch_id).filter(Boolean) || [];

  let branches: Branch[] = [];
  if (branchIds.length > 0) {
    const { data: branchData, error: branchError } = await supabase
      .from("branches")
      .select("*")
      .in("id", branchIds)
      .is("deleted_at", null);

    if (branchError) {
      throw new Error(`Failed to fetch branches: ${branchError.message}`);
    }

    branches = branchData || [];
  }

  // Create a map for quick branch lookup
  const branchMap = new Map<string, Branch>();
  branches.forEach((branch) => {
    branchMap.set(branch.id, branch);
  });

  // Create a map for users to avoid duplicates (users might have multiple roles)
  const usersMap = new Map<string, OrganizationUserWithDetails>();

  assignments.forEach((assignment) => {
    const user = userMap.get(assignment.user_id);
    const role = roleMap.get(assignment.role_id);

    if (user && !user.deleted_at) {
      const branch = user.default_branch_id ? branchMap.get(user.default_branch_id) || null : null;

      // If we already have this user, check if this role has higher priority
      const existingUser = usersMap.get(user.id);
      if (existingUser) {
        // Prioritize org-level roles over branch-level roles
        if (assignment.scope === "org" && existingUser.userRoleAssignment?.scope === "branch") {
          usersMap.set(user.id, {
            ...user,
            role: role || null,
            branch,
            userRoleAssignment: {
              id: assignment.id,
              scope: assignment.scope,
              scope_id: assignment.scope_id,
            },
          });
        }
      } else {
        usersMap.set(user.id, {
          ...user,
          role: role || null,
          branch,
          userRoleAssignment: {
            id: assignment.id,
            scope: assignment.scope,
            scope_id: assignment.scope_id,
          },
        });
      }
    }
  });

  // Convert map to array and sort by creation date
  return Array.from(usersMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Get user statistics for the organization dashboard
 */
export async function fetchOrganizationUserStatistics(organizationId: string) {
  const supabase = createClient();

  // Get total users count
  const { count: totalUsers, error: usersCountError } = await supabase
    .from("user_role_assignments")
    .select("user_id", { count: "exact", head: true })
    .eq("scope_id", organizationId)
    .is("deleted_at", null);

  if (usersCountError) {
    throw new Error(`Failed to fetch users count: ${usersCountError.message}`);
  }

  // This is a simplified version - you could expand this to get more detailed stats
  return {
    totalUsers: totalUsers || 0,
  };
}
