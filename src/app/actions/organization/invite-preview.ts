"use server";

import { createClient } from "@/utils/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InviteReasonCode =
  | "INVITE_PENDING"
  | "INVITE_NOT_FOUND"
  | "INVITE_EXPIRED"
  | "INVITE_CANCELLED"
  | "INVITE_DECLINED"
  | "INVITE_ACCEPTED"
  | "INVITE_INVALID";

export interface InvitePreview {
  reason_code: InviteReasonCode;
  status: string | null;
  expires_at: string | null;
  invited_email: string | null;
  org_name: string | null;
  role_name: string | null;
  branch_name: string | null;
}

export interface PendingInviteItem {
  id: string;
  token: string;
  expires_at: string | null;
  org_name: string | null;
  role_name: string | null;
  branch_name: string | null;
}

// ─── Public preview (anon-safe) ───────────────────────────────────────────────

/**
 * getPublicInvitationPreviewAction
 *
 * Safe for unauthenticated callers. Calls the SECURITY DEFINER
 * get_invitation_preview_by_token function which bypasses RLS and
 * returns only minimal display-safe fields. No token is echoed back.
 */
export async function getPublicInvitationPreviewAction(token: string): Promise<InvitePreview> {
  // Basic client-side input guard before hitting the DB
  if (!token || token.trim().length < 8) {
    return {
      reason_code: "INVITE_INVALID",
      status: null,
      expires_at: null,
      invited_email: null,
      org_name: null,
      role_name: null,
      branch_name: null,
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_invitation_preview_by_token", {
    p_token: token,
  });

  if (error || !data) {
    return {
      reason_code: "INVITE_INVALID",
      status: null,
      expires_at: null,
      invited_email: null,
      org_name: null,
      role_name: null,
      branch_name: null,
    };
  }

  const raw = data as Record<string, unknown>;

  return {
    reason_code: (raw.reason_code as InviteReasonCode) ?? "INVITE_INVALID",
    status: (raw.status as string) ?? null,
    expires_at: (raw.expires_at as string) ?? null,
    invited_email: (raw.invited_email as string) ?? null,
    org_name: (raw.org_name as string) ?? null,
    role_name: (raw.role_name as string) ?? null,
    branch_name: (raw.branch_name as string) ?? null,
  };
}

// ─── Authenticated pending invites ────────────────────────────────────────────

/**
 * getMyPendingInvitationsAction
 *
 * Authenticated only. Queries all pending, non-expired invitations
 * matching the current user's email via SECURITY DEFINER function.
 * Returns token so the client can navigate to /invite/[token].
 */
export async function getMyPendingInvitationsAction(): Promise<{
  success: boolean;
  invitations: PendingInviteItem[];
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, invitations: [], error: "Not authenticated" };
  }

  const { data, error } = await supabase.rpc("get_my_pending_invitations");

  if (error) {
    return { success: false, invitations: [], error: error.message };
  }

  const raw = data as { success: boolean; invitations?: unknown[]; error?: string } | null;

  if (!raw?.success) {
    return { success: false, invitations: [], error: raw?.error ?? "Failed to load invitations" };
  }

  const invitations = ((raw.invitations as PendingInviteItem[] | null) ?? []).map((inv) => ({
    id: String(inv.id),
    token: String(inv.token),
    expires_at: inv.expires_at ?? null,
    org_name: inv.org_name ?? null,
    role_name: inv.role_name ?? null,
    branch_name: inv.branch_name ?? null,
  }));

  return { success: true, invitations };
}
