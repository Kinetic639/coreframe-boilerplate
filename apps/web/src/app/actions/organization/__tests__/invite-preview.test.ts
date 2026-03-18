/**
 * @vitest-environment node
 *
 * Unit tests for invite-preview server actions.
 * Tests getPublicInvitationPreviewAction and getMyPendingInvitationsAction.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Supabase mock ───────────────────────────────────────────────────────────
const { rpcMock, getUserMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    rpc: rpcMock,
    auth: { getUser: getUserMock },
  }),
}));

import {
  getPublicInvitationPreviewAction,
  getMyPendingInvitationsAction,
} from "@/app/actions/organization/invite-preview";

// ─── getPublicInvitationPreviewAction ────────────────────────────────────────

describe("getPublicInvitationPreviewAction", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns INVITE_INVALID for empty token", async () => {
    const result = await getPublicInvitationPreviewAction("");
    expect(result.reason_code).toBe("INVITE_INVALID");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns INVITE_INVALID for short token (< 8 chars)", async () => {
    const result = await getPublicInvitationPreviewAction("abc");
    expect(result.reason_code).toBe("INVITE_INVALID");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls get_invitation_preview_by_token RPC with the token", async () => {
    rpcMock.mockResolvedValue({
      data: {
        reason_code: "INVITE_PENDING",
        status: "pending",
        expires_at: "2026-12-31T00:00:00Z",
        invited_email: "user@example.com",
        org_name: "Acme Corp",
        role_name: "org_member",
        branch_name: "Warsaw",
      },
      error: null,
    });

    const result = await getPublicInvitationPreviewAction("tok-abc-12345");

    expect(rpcMock).toHaveBeenCalledWith("get_invitation_preview_by_token", {
      p_token: "tok-abc-12345",
    });
    expect(result.reason_code).toBe("INVITE_PENDING");
    expect(result.org_name).toBe("Acme Corp");
    expect(result.invited_email).toBe("user@example.com");
    expect(result.role_name).toBe("org_member");
    expect(result.branch_name).toBe("Warsaw");
  });

  it("returns INVITE_NOT_FOUND when RPC returns that reason code", async () => {
    rpcMock.mockResolvedValue({
      data: { reason_code: "INVITE_NOT_FOUND" },
      error: null,
    });

    const result = await getPublicInvitationPreviewAction("unknown-tok-x");
    expect(result.reason_code).toBe("INVITE_NOT_FOUND");
    expect(result.org_name).toBeNull();
  });

  it("returns INVITE_EXPIRED when RPC returns that reason code", async () => {
    rpcMock.mockResolvedValue({
      data: {
        reason_code: "INVITE_EXPIRED",
        status: "expired",
        expires_at: "2020-01-01T00:00:00Z",
        invited_email: "user@example.com",
        org_name: "Acme Corp",
        role_name: null,
        branch_name: null,
      },
      error: null,
    });

    const result = await getPublicInvitationPreviewAction("expired-tok-xyz");
    expect(result.reason_code).toBe("INVITE_EXPIRED");
    expect(result.status).toBe("expired");
  });

  it("returns INVITE_CANCELLED when RPC returns that reason code", async () => {
    rpcMock.mockResolvedValue({
      data: { reason_code: "INVITE_CANCELLED", status: "cancelled" },
      error: null,
    });

    const result = await getPublicInvitationPreviewAction("cancelled-tok-z");
    expect(result.reason_code).toBe("INVITE_CANCELLED");
  });

  it("returns INVITE_ACCEPTED when RPC returns that reason code", async () => {
    rpcMock.mockResolvedValue({
      data: { reason_code: "INVITE_ACCEPTED", status: "accepted" },
      error: null,
    });

    const result = await getPublicInvitationPreviewAction("accepted-tok-z");
    expect(result.reason_code).toBe("INVITE_ACCEPTED");
  });

  it("returns INVITE_INVALID when RPC itself errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "Connection timeout" },
    });

    const result = await getPublicInvitationPreviewAction("tok-error-abc");
    expect(result.reason_code).toBe("INVITE_INVALID");
  });

  it("does NOT expose invitation token in preview response", async () => {
    rpcMock.mockResolvedValue({
      data: {
        reason_code: "INVITE_PENDING",
        status: "pending",
        expires_at: null,
        invited_email: "user@example.com",
        org_name: "Test Org",
        role_name: null,
        branch_name: null,
      },
      error: null,
    });

    const result = await getPublicInvitationPreviewAction("safe-tok-123456");
    expect((result as unknown as Record<string, unknown>)["token"]).toBeUndefined();
    expect((result as unknown as Record<string, unknown>)["id"]).toBeUndefined();
  });
});

// ─── getMyPendingInvitationsAction ───────────────────────────────────────────

describe("getMyPendingInvitationsAction", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    getUserMock.mockReset();
  });

  it("returns error when user is not authenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getMyPendingInvitationsAction();
    expect(result.success).toBe(false);
    expect(result.invitations).toHaveLength(0);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls get_my_pending_invitations RPC when authenticated", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "user@example.com" } },
      error: null,
    });
    rpcMock.mockResolvedValue({
      data: {
        success: true,
        invitations: [
          {
            id: "inv-1",
            token: "tok-abc",
            expires_at: "2026-12-31T00:00:00Z",
            org_name: "Acme Corp",
            role_name: "org_member",
            branch_name: null,
          },
        ],
      },
      error: null,
    });

    const result = await getMyPendingInvitationsAction();

    expect(rpcMock).toHaveBeenCalledWith("get_my_pending_invitations");
    expect(result.success).toBe(true);
    expect(result.invitations).toHaveLength(1);
    expect(result.invitations[0].org_name).toBe("Acme Corp");
    expect(result.invitations[0].token).toBe("tok-abc");
  });

  it("returns empty list when no pending invites exist", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "user@example.com" } },
      error: null,
    });
    rpcMock.mockResolvedValue({
      data: { success: true, invitations: [] },
      error: null,
    });

    const result = await getMyPendingInvitationsAction();
    expect(result.success).toBe(true);
    expect(result.invitations).toHaveLength(0);
  });

  it("returns error when RPC itself fails", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "user@example.com" } },
      error: null,
    });
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });

    const result = await getMyPendingInvitationsAction();
    expect(result.success).toBe(false);
    expect(result.invitations).toHaveLength(0);
    expect(result.error).toBe("Database error");
  });

  it("returns multiple invites when multiple orgs have pending invites", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-456", email: "multi@example.com" } },
      error: null,
    });
    rpcMock.mockResolvedValue({
      data: {
        success: true,
        invitations: [
          {
            id: "inv-1",
            token: "tok-1",
            expires_at: null,
            org_name: "Org A",
            role_name: null,
            branch_name: null,
          },
          {
            id: "inv-2",
            token: "tok-2",
            expires_at: "2026-06-01T00:00:00Z",
            org_name: "Org B",
            role_name: "manager",
            branch_name: "Krakow",
          },
        ],
      },
      error: null,
    });

    const result = await getMyPendingInvitationsAction();
    expect(result.success).toBe(true);
    expect(result.invitations).toHaveLength(2);
    expect(result.invitations[1].branch_name).toBe("Krakow");
  });
});
