"use server";

import { createClient } from "@/lib/supabase/server";
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
 * Fetch all users in an organization using RPC function instead of direct table access
 */
export async function fetchOrganizationUsersWithRpc(
  organizationId: string
): Promise<OrganizationUser[]> {
  // Check if user has access to view users
  if (!(await verifyOrgOwnerAccess(organizationId))) {
    throw new Error("Unauthorized: Only organization owners can view organization users");
  }

  const supabase = await createClient();

  // Instead of directly querying tables, use an RPC function that can bypass RLS internally
  const { data: users, error } = await supabase.rpc("get_organization_users_mvp", {
    org_id: organizationId,
  });

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return users || [];
}

/**
 * Get user statistics for the organization dashboard using RPC
 */
export async function fetchOrganizationUserStatisticsWithRpc(organizationId: string) {
  // Check if user has access to view statistics
  if (!(await verifyOrgOwnerAccess(organizationId))) {
    throw new Error("Unauthorized: Only organization owners can view user statistics");
  }

  const supabase = await createClient();

  // Use RPC function for statistics
  const { data: stats, error } = await supabase.rpc("get_organization_user_stats", {
    org_id: organizationId,
  });

  if (error) {
    throw new Error(`Failed to fetch user statistics: ${error.message}`);
  }

  return stats || { totalUsers: 0 };
}
