"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserRolesFromJWT } from "@/utils/auth/getUserRolesFromJWT";
import { hasMatchingRole } from "@/utils/auth/hasMatchingRole";

export interface UserRoleAssignmentWithDetails {
  id: string;
  user_id: string;
  role_id: string;
  scope: "org" | "branch";
  scope_id: string;
  deleted_at: string | null;
  role: {
    id: string;
    name: string;
    organization_id: string | null;
    is_basic: boolean;
    deleted_at: string | null;
  };
  scope_name: string;
}

export interface UserPermissionOverrideWithDetails {
  id: string;
  user_id: string;
  permission_id: string;
  allowed: boolean;
  scope: "org" | "branch";
  scope_id: string;
  deleted_at: string | null;
  permission: {
    id: string;
    slug: string;
    label: string;
    deleted_at: string | null;
  };
}

export interface UserDetailWithAssignments {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status_id: string | null;
  created_at: string;
  default_branch_id: string | null;
  deleted_at: string | null;
  roles: UserRoleAssignmentWithDetails[];
  branch: {
    id: string;
    name: string;
    slug: string;
    organization_id: string;
    created_at: string;
    deleted_at: string | null;
  } | null;
  permissionOverrides: UserPermissionOverrideWithDetails[];
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

  return hasMatchingRole(roles, [
    {
      role: "org_owner",
      scope: "org",
      id: organizationId,
    },
  ]);
}

/**
 * Fetch detailed user information using RPC function
 */
export async function fetchUserDetailServer(
  userId: string,
  organizationId: string
): Promise<UserDetailWithAssignments | null> {
  // Check if user has access to view user details
  if (!(await verifyOrgOwnerAccess(organizationId))) {
    throw new Error("Unauthorized: Only organization owners can view user details");
  }

  const supabase = await createClient();

  // Use RPC function to get user details with all related data
  const { data: userDetails, error } = await supabase.rpc("get_user_detail", {
    target_user_id: userId,
    org_id: organizationId,
  });

  if (error) {
    throw new Error(`Failed to fetch user details: ${error.message}`);
  }

  if (!userDetails || userDetails.length === 0) {
    return null;
  }

  const userDetail = userDetails[0];

  return {
    id: userDetail.id,
    email: userDetail.email,
    first_name: userDetail.first_name,
    last_name: userDetail.last_name,
    status_id: userDetail.status_id,
    created_at: userDetail.created_at,
    default_branch_id: userDetail.default_branch_id,
    deleted_at: userDetail.deleted_at,
    roles: userDetail.roles || [],
    branch: userDetail.branch || null,
    permissionOverrides: userDetail.permission_overrides || [],
  };
}
