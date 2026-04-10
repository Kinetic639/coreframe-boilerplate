"use server";

import { createClient } from "@/utils/supabase/server";
import { getUserRolesFromJWT } from "@/utils/auth/getUserRolesFromJWT";
import { hasMatchingRole } from "@/utils/auth/hasMatchingRole";

export interface InvitationWithDetails {
  id: string;
  email: string;
  role_id: string;
  branch_id: string | null;
  organization_id: string;
  invited_by: string;
  status: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
  token: string;
  expires_at: string | null;
  created_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  role?: {
    id: string;
    name: string;
    display_name: string | null;
  } | null;
  branch?: {
    id: string;
    name: string;
  } | null;
  organization?: {
    id: string;
    name: string;
  } | null;
}

export interface InvitationStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  expired: number;
  cancelled: number;
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
 * Fetch invitations for an organization using RPC function
 */
export async function fetchOrganizationInvitationsServer(
  organizationId: string
): Promise<InvitationWithDetails[]> {
  // Check if user has access to view invitations
  if (!(await verifyOrgOwnerAccess(organizationId))) {
    throw new Error("Unauthorized: Only organization owners can view invitations");
  }

  const supabase = await createClient();

  // Use RPC function to get invitations with related data
  const { data: invitations, error } = await supabase.rpc("get_organization_invitations", {
    org_id: organizationId,
  });

  if (error) {
    throw new Error(`Failed to fetch invitations: ${error.message}`);
  }

  return invitations || [];
}

/**
 * Get invitation statistics for organization dashboard using RPC
 */
export async function fetchInvitationStatisticsServer(
  organizationId: string
): Promise<InvitationStats> {
  // Check if user has access to view statistics
  if (!(await verifyOrgOwnerAccess(organizationId))) {
    throw new Error("Unauthorized: Only organization owners can view invitation statistics");
  }

  const supabase = await createClient();

  // Use RPC function for statistics
  const { data: stats, error } = await supabase.rpc("get_invitation_stats", {
    org_id: organizationId,
  });

  if (error) {
    throw new Error(`Failed to fetch invitation statistics: ${error.message}`);
  }

  return (
    stats || {
      total: 0,
      pending: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
      cancelled: 0,
    }
  );
}
