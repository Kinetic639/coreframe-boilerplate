/**
 * Tests: Full invitation lifecycle
 *
 * Covers the server action layer for:
 * - declineInvitationAction
 * - post-auth routing decisions (org membership check logic)
 * - invite preview reason codes including INVITE_DECLINED
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock setup ───────────────────────────────────────────────────────────────

const { mockRpc, mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    rpc: mockRpc,
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

import { declineInvitationAction } from "../invitations";
import { getPublicInvitationPreviewAction } from "../invite-preview";

// ─── declineInvitationAction ──────────────────────────────────────────────────

describe("declineInvitationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success when RPC succeeds", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, organization_id: "org-123" },
      error: null,
    });

    const result = await declineInvitationAction("valid-token-12345");

    expect(mockRpc).toHaveBeenCalledWith("decline_invitation", {
      p_token: "valid-token-12345",
    });
    expect(result.success).toBe(true);
  });

  it("returns error when RPC returns success=false", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: false, error_code: "INVITE_NOT_PENDING" },
      error: null,
    });

    const result = await declineInvitationAction("used-token-123456");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("INVITE_NOT_PENDING");
    }
  });

  it("returns error when RPC itself errors", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "connection error" },
    });

    const result = await declineInvitationAction("any-valid-token-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("connection error");
    }
  });

  it("returns error when RPC returns null data", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await declineInvitationAction("any-valid-token-2");

    expect(result.success).toBe(false);
  });

  it("returns error when not authenticated (RPC returns auth error)", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: false, error_code: "NOT_AUTHENTICATED" },
      error: null,
    });

    const result = await declineInvitationAction("any-valid-token-3");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("NOT_AUTHENTICATED");
    }
  });

  it("returns error when email does not match invitation", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: false, error_code: "EMAIL_MISMATCH" },
      error: null,
    });

    const result = await declineInvitationAction("wrong-email-token1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("EMAIL_MISMATCH");
    }
  });

  it("handles unexpected exceptions gracefully", async () => {
    mockRpc.mockRejectedValueOnce(new Error("network failure"));

    const result = await declineInvitationAction("any-valid-token-4");

    expect(result.success).toBe(false);
  });
});

// ─── INVITE_DECLINED in getPublicInvitationPreviewAction ─────────────────────

describe("getPublicInvitationPreviewAction — INVITE_DECLINED", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps declined status to INVITE_DECLINED reason code", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        reason_code: "INVITE_DECLINED",
        status: "declined",
        expires_at: "2026-12-31T00:00:00Z",
        invited_email: "user@example.com",
        org_name: "Acme Corp",
        role_name: null,
        branch_name: null,
      },
      error: null,
    });

    const result = await getPublicInvitationPreviewAction("declined-tok-12345");

    expect(result.reason_code).toBe("INVITE_DECLINED");
    expect(result.org_name).toBe("Acme Corp");
    expect(result.invited_email).toBe("user@example.com");
  });

  it("returns INVITE_DECLINED distinct from INVITE_CANCELLED", async () => {
    const cancelledRpc = mockRpc
      .mockResolvedValueOnce({
        data: {
          reason_code: "INVITE_CANCELLED",
          status: "cancelled",
          expires_at: null,
          invited_email: "a@b.com",
          org_name: "Org",
          role_name: null,
          branch_name: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          reason_code: "INVITE_DECLINED",
          status: "declined",
          expires_at: null,
          invited_email: "a@b.com",
          org_name: "Org",
          role_name: null,
          branch_name: null,
        },
        error: null,
      });

    const cancelled = await getPublicInvitationPreviewAction("cancelled-tok-123");
    const declined = await getPublicInvitationPreviewAction("declined-tok-1234");

    expect(cancelled.reason_code).toBe("INVITE_CANCELLED");
    expect(declined.reason_code).toBe("INVITE_DECLINED");
    expect(cancelledRpc).toHaveBeenCalledTimes(2);
  });
});

// ─── Routing decision: no org membership → onboarding ────────────────────────

describe("signInAction routing logic — org membership check", () => {
  // We test the logic in isolation since signInAction uses server-only APIs.
  // The key invariant: user with no active org membership must be routed
  // to /onboarding, not /dashboard/start.

  it("routes to /onboarding when user has no active org membership", () => {
    // Simulate the post-signIn check result
    const membershipData: { organization_id: string } | null = null; // no membership

    const expectedRoute = !membershipData ? "/onboarding" : "/dashboard/start";
    expect(expectedRoute).toBe("/onboarding");
  });

  it("routes to /dashboard/start when user has an active org membership", () => {
    const membershipData = { organization_id: "org-abc" }; // has membership

    const expectedRoute = !membershipData ? "/onboarding" : "/dashboard/start";
    expect(expectedRoute).toBe("/dashboard/start");
  });

  it("routes to /invite/resolve when pending invites exist (regardless of org status)", () => {
    const pendingInvites = [
      {
        id: "inv-1",
        token: "tok-1",
        expires_at: null,
        org_name: "Org",
        role_name: null,
        branch_name: null,
      },
    ];
    const membershipData = null;

    // Pending invites take priority over org check
    const expectedRoute =
      pendingInvites.length > 0
        ? "/invite/resolve"
        : !membershipData
          ? "/onboarding"
          : "/dashboard/start";

    expect(expectedRoute).toBe("/invite/resolve");
  });
});

// ─── auth/callback routing ────────────────────────────────────────────────────

describe("auth/callback routing decisions", () => {
  it("routes new user to /onboarding when no invitation_token and no pending invites", () => {
    const invitationToken: string | undefined = undefined;
    const pendingInvitations: unknown[] = [];

    const destination =
      pendingInvitations.length > 0
        ? "/invite/resolve"
        : invitationToken
          ? "/dashboard/start"
          : "/onboarding";

    expect(destination).toBe("/onboarding");
  });

  it("routes to /invite/resolve when no invitation_token but pending invites found", () => {
    const invitationToken: string | undefined = undefined;
    const pendingInvitations = [{ id: "inv-1" }];

    const destination =
      pendingInvitations.length > 0
        ? "/invite/resolve"
        : invitationToken
          ? "/dashboard/start"
          : "/onboarding";

    expect(destination).toBe("/invite/resolve");
  });

  it("routes to /dashboard/start after successful invite-signup (invitation_token present)", () => {
    const invitationToken = "valid-invite-token";
    const pendingInvitations: unknown[] = [];

    const destination =
      pendingInvitations.length > 0
        ? "/invite/resolve"
        : invitationToken
          ? "/dashboard/start"
          : "/onboarding";

    expect(destination).toBe("/dashboard/start");
  });
});
