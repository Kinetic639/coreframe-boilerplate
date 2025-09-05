"use server";

import { createClient } from "@/utils/supabase/server";
import { getUserRolesFromJWT } from "@/utils/auth/getUserRolesFromJWT";
import { hasMatchingRole } from "@/utils/auth/hasMatchingRole";

interface OrganizationUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status_id: string | null;
  created_at: string | null;
  default_branch_id: string | null;
  avatar_url: string | null;
  role: {
    id: string;
    name: string;
  } | null;
  branch: {
    id: string;
    name: string;
  } | null;
}

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

  // Use the same pattern as HasAnyRoleServer
  return hasMatchingRole(roles, [
    {
      role: "org_owner",
      scope: "org",
      id: organizationId,
    },
  ]);
}

/**
 * Fetch all users in an organization with their roles and branch details (server-side)
 */
export async function fetchOrganizationUsersServer(
  organizationId: string
): Promise<OrganizationUser[]> {
  // Check if user has access to view users (using regular client for auth)
  if (!(await verifyOrgOwnerAccess(organizationId))) {
    throw new Error("Unauthorized: Only organization owners can view organization users");
  }

  // Use service role client to bypass RLS policies since we've already verified permissions
  const { createServiceClient } = await import("@/utils/supabase/service");
  const serviceSupabase = createServiceClient();

  // Get all user role assignments for this organization
  const { data: assignments, error: assignmentsError } = await serviceSupabase
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
  const { data: users, error: usersError } = await serviceSupabase
    .from("users")
    .select("*")
    .in("id", userIds)
    .is("deleted_at", null);

  if (usersError) {
    throw new Error(`Failed to fetch users: ${usersError.message}`);
  }

  // Fetch roles separately
  const { data: roles, error: rolesError } = await serviceSupabase
    .from("roles")
    .select("*")
    .in("id", roleIds)
    .is("deleted_at", null);

  if (rolesError) {
    throw new Error(`Failed to fetch roles: ${rolesError.message}`);
  }

  // Create maps for quick lookup
  const userMap = new Map<string, any>();
  const roleMap = new Map<string, any>();

  users?.forEach((user) => userMap.set(user.id, user));
  roles?.forEach((role) => roleMap.set(role.id, role));

  // Get branch details for users
  const branchIds = users?.map((user) => user.default_branch_id).filter(Boolean) || [];

  let branches: any[] = [];
  if (branchIds.length > 0) {
    const { data: branchData, error: branchError } = await serviceSupabase
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
  const branchMap = new Map<string, any>();
  branches.forEach((branch) => {
    branchMap.set(branch.id, branch);
  });

  // Create a map for users to avoid duplicates (users might have multiple roles)
  const usersMap = new Map<string, OrganizationUser>();

  assignments.forEach((assignment) => {
    const user = userMap.get(assignment.user_id);
    const role = roleMap.get(assignment.role_id);

    if (user && !user.deleted_at) {
      const branch = user.default_branch_id ? branchMap.get(user.default_branch_id) || null : null;

      // If we already have this user, check if this role has higher priority
      const existingUser = usersMap.get(user.id);
      if (existingUser) {
        // Prioritize org-level roles over branch-level roles
        if (
          assignment.scope === "org" &&
          existingUser.role &&
          existingUser.role.name.includes("branch")
        ) {
          usersMap.set(user.id, {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            status_id: user.status_id,
            created_at: user.created_at,
            default_branch_id: user.default_branch_id,
            avatar_url: null, // Avatar URL not stored in users table
            role: role ? { id: role.id, name: role.name } : null,
            branch: branch ? { id: branch.id, name: branch.name } : null,
          });
        }
      } else {
        usersMap.set(user.id, {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          status_id: user.status_id,
          created_at: user.created_at,
          default_branch_id: user.default_branch_id,
          avatar_url: null, // Avatar URL not stored in users table
          role: role ? { id: role.id, name: role.name } : null,
          branch: branch ? { id: branch.id, name: branch.name } : null,
        });
      }
    }
  });

  // Convert map to array and sort by creation date
  return Array.from(usersMap.values()).sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
}

/**
 * Get user statistics for the organization dashboard
 */
export async function fetchOrganizationUserStatisticsServer(organizationId: string) {
  // Check if user has access to view statistics
  if (!(await verifyOrgOwnerAccess(organizationId))) {
    throw new Error("Unauthorized: Only organization owners can view user statistics");
  }

  // Use service role client to bypass RLS policies since we've already verified permissions
  const { createServiceClient } = await import("@/utils/supabase/service");
  const serviceSupabase = createServiceClient();

  // Get total users count
  const { count: totalUsers, error: usersCountError } = await serviceSupabase
    .from("user_role_assignments")
    .select("user_id", { count: "exact", head: true })
    .eq("scope_id", organizationId)
    .is("deleted_at", null);

  if (usersCountError) {
    throw new Error(`Failed to fetch users count: ${usersCountError.message}`);
  }

  return {
    totalUsers: totalUsers || 0,
  };
}
