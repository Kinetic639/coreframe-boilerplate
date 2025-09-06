"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import {
  createInvitation,
  updateInvitation,
  cancelInvitation,
  checkEmailInvited,
  checkEmailIsUser,
  acceptInvitation as acceptInvitationAPI,
  rejectInvitation as rejectInvitationAPI,
  markExpiredInvitations,
} from "@/lib/api/invitations";
import { refreshBranchContext } from "@/lib/api/refresh-branch-context";

export interface CreateInvitationFormData {
  email: string;
  role_id: string;
  branch_id: string;
  expires_at?: string;
}

export interface InvitationActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Server action to create a new invitation
 */
export async function createInvitationAction(
  data: CreateInvitationFormData
): Promise<InvitationActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Get user's organization - check both user_organizations and users table
    const { data: userOrg, error: userOrgError } = await supabase
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    let organizationId: string;

    if (userOrgError || !userOrg) {
      // Fallback: try to get organization from users table (for org owners)
      const { data: userData, error: userDataError } = await supabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();

      if (userDataError || !userData) {
        return { success: false, error: "User not found" };
      }

      // Get organization where user is owner
      const { data: orgData, error: orgError } = await supabase
        .from("organization_profiles")
        .select("organization_id")
        .eq("created_by", userId)
        .single();

      if (orgError || !orgData) {
        return { success: false, error: "No organization found for user" };
      }

      organizationId = orgData.organization_id;
    } else {
      organizationId = userOrg.organization_id;
    }

    // Validate permissions using RLS - the authorize function will handle this
    const { data: authCheck, error: authError } = await supabase.rpc("authorize", {
      requested_permission: "invitation.create",
      resource_organization_id: organizationId,
    });

    if (authError || !authCheck) {
      return { success: false, error: "Brak uprawnień do wysyłania zaproszeń" };
    }

    // Check if email is already a user in the organization
    const isExistingUser = await checkEmailIsUser(organizationId, data.email);
    if (isExistingUser) {
      return { success: false, error: "Ten użytkownik już należy do organizacji" };
    }

    // Check if email is already invited (pending or accepted)
    const isAlreadyInvited = await checkEmailInvited(organizationId, data.email);
    if (isAlreadyInvited) {
      return { success: false, error: "Aktywne zaproszenie dla tego adresu email już istnieje" };
    }

    // Create invitation
    const invitation = await createInvitation({
      email: data.email,
      role_id: data.role_id,
      branch_id: data.branch_id,
      organization_id: organizationId,
      invited_by: userId,
      expires_at: data.expires_at,
    });

    // Revalidate relevant paths
    revalidatePath("/dashboard/organization/users");
    revalidatePath("/dashboard/organization/users/list");

    return { success: true, data: invitation };
  } catch (error) {
    console.error("Error creating invitation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd",
    };
  }
}

/**
 * Server action to cancel an invitation
 */
export async function cancelInvitationAction(
  invitationId: string
): Promise<InvitationActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Get user's organization
    const { data: userOrg, error: userOrgError } = await supabase
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    if (userOrgError || !userOrg) {
      return { success: false, error: "User not found in organization" };
    }

    const organizationId = userOrg.organization_id;

    // Validate permissions
    const { data: authCheck, error: authError } = await supabase.rpc("authorize", {
      requested_permission: "invitation.cancel",
      resource_organization_id: organizationId,
    });

    if (authError || !authCheck) {
      return { success: false, error: "Permission denied" };
    }

    await cancelInvitation(invitationId);

    // Revalidate relevant paths
    revalidatePath("/dashboard/organization/users");
    revalidatePath("/dashboard/organization/users/list");

    return { success: true };
  } catch (error) {
    console.error("Error cancelling invitation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Server action to resend an invitation (recreate with new expiry)
 */
export async function resendInvitationAction(
  invitationId: string
): Promise<InvitationActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Get user's organization
    const { data: userOrg, error: userOrgError } = await supabase
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    if (userOrgError || !userOrg) {
      return { success: false, error: "User not found in organization" };
    }

    const organizationId = userOrg.organization_id;

    // Validate permissions
    const { data: authCheck, error: authError } = await supabase.rpc("authorize", {
      requested_permission: "invitation.create",
      resource_organization_id: organizationId,
    });

    if (authError || !authCheck) {
      return { success: false, error: "Permission denied" };
    }

    // Update invitation with new expiry and reset to pending
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const updatedInvitation = await updateInvitation(invitationId, {
      status: "pending",
      expires_at: newExpiresAt,
    });

    // Revalidate relevant paths
    revalidatePath("/dashboard/organization/users");
    revalidatePath("/dashboard/organization/users/list");

    return { success: true, data: updatedInvitation };
  } catch (error) {
    console.error("Error resending invitation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Server action to accept an invitation
 */
export async function acceptInvitationAction(token: string): Promise<InvitationActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Musisz być zalogowany aby zaakceptować zaproszenie" };
    }

    // Accept the invitation
    const invitation = await acceptInvitationAPI(token);

    // Refresh branch context for the user
    await refreshBranchContext(invitation.organization_id!);

    // Revalidate relevant paths
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/organization");

    return { success: true, data: invitation };
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Server action to reject an invitation
 */
export async function rejectInvitationAction(token: string): Promise<InvitationActionResult> {
  try {
    // No authentication required for rejecting invitations
    const invitation = await rejectInvitationAPI(token);

    return { success: true, data: invitation };
  } catch (error) {
    console.error("Error rejecting invitation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Server action to clean up expired invitations
 */
export async function cleanupExpiredInvitationsAction(): Promise<InvitationActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Get user's organization
    const { data: userOrg, error: userOrgError } = await supabase
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    if (userOrgError || !userOrg) {
      return { success: false, error: "User not found in organization" };
    }

    const organizationId = userOrg.organization_id;

    // Validate permissions
    const { data: authCheck, error: authError } = await supabase.rpc("authorize", {
      requested_permission: "invitation.manage",
      resource_organization_id: organizationId,
    });

    if (authError || !authCheck) {
      return { success: false, error: "Permission denied" };
    }

    const expiredCount = await markExpiredInvitations();

    // Revalidate relevant paths
    revalidatePath("/dashboard/organization/users");
    revalidatePath("/dashboard/organization/users/list");

    return { success: true, data: { expiredCount } };
  } catch (error) {
    console.error("Error cleaning up expired invitations:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
