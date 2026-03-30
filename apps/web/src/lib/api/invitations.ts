import { createClient } from "@/utils/supabase/client";
import { Database } from "../../../supabase/types/types";

type Tables = Database["public"]["Tables"];
type Invitation = Tables["invitations"]["Row"];

export interface InvitationWithDetails extends Invitation {
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

/**
 * Fetch invitation by token
 */
export async function fetchInvitationByToken(token: string): Promise<InvitationWithDetails | null> {
  const supabase = createClient();

  // First, get the invitation
  const { data: invitation, error: invitationError } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (invitationError) {
    if (invitationError.code === "PGRST116") {
      return null; // Invitation not found
    }
    throw new Error(`Failed to fetch invitation: ${invitationError.message}`);
  }

  if (!invitation) {
    return null;
  }

  // Fetch related data in parallel
  const [roleData, branchData, organizationData] = await Promise.all([
    invitation.role_id
      ? supabase
          .from("roles")
          .select("id, name, display_name")
          .eq("id", invitation.role_id)
          .single()
      : { data: null, error: null },
    invitation.branch_id
      ? supabase.from("branches").select("id, name").eq("id", invitation.branch_id).single()
      : { data: null, error: null },
    invitation.organization_id
      ? supabase
          .from("organization_profiles")
          .select("organization_id, name")
          .eq("organization_id", invitation.organization_id)
          .single()
      : { data: null, error: null },
  ]);

  // Combine data
  const result: InvitationWithDetails = {
    ...invitation,
    role: roleData.data || null,
    branch: branchData.data || null,
    organization: organizationData.data
      ? { id: organizationData.data.organization_id, name: organizationData.data.name }
      : null,
  };

  return result;
}
