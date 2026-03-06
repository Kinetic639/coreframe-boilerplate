/**
 * @vitest-environment node
 *
 * Unit tests for OrgInvitationsService.acceptInvitation
 * Tests the RPC call pattern and result mapping.
 */
import { describe, it, expect, vi } from "vitest";
import { OrgInvitationsService } from "@/server/services/organization.service";

function makeSupabase(rpcResult: { data: unknown; error: null | { message: string } }) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
  } as unknown as Parameters<typeof OrgInvitationsService.acceptInvitation>[0];
}

describe("OrgInvitationsService.acceptInvitation", () => {
  it("returns success with organization_id on RPC success", async () => {
    const supabase = makeSupabase({
      data: { success: true, organization_id: "org-123" },
      error: null,
    });

    const result = await OrgInvitationsService.acceptInvitation(supabase, "tok-abc");

    expect(result).toEqual({ success: true, data: { organization_id: "org-123" } });
    expect(supabase.rpc).toHaveBeenCalledWith("accept_invitation_and_join_org", {
      p_token: "tok-abc",
    });
  });

  it("returns error when RPC returns success=false", async () => {
    const supabase = makeSupabase({
      data: { success: false, error_code: "INVITE_EXPIRED" },
      error: null,
    });

    const result = await OrgInvitationsService.acceptInvitation(supabase, "expired-tok");

    expect(result).toEqual({ success: false, error: "INVITE_EXPIRED" });
  });

  it("returns error when RPC returns success=false with no error message", async () => {
    const supabase = makeSupabase({
      data: { success: false },
      error: null,
    });

    const result = await OrgInvitationsService.acceptInvitation(supabase, "tok");

    expect(result).toEqual({ success: false, error: "Acceptance failed" });
  });

  it("returns error when Supabase RPC itself errors", async () => {
    const supabase = makeSupabase({
      data: null,
      error: { message: "Connection timeout" },
    });

    const result = await OrgInvitationsService.acceptInvitation(supabase, "tok");

    expect(result).toEqual({ success: false, error: "Connection timeout" });
  });

  it("returns error when RPC succeeds but organization_id is missing", async () => {
    const supabase = makeSupabase({
      data: { success: true },
      error: null,
    });

    const result = await OrgInvitationsService.acceptInvitation(supabase, "tok");

    expect(result).toEqual({ success: false, error: "No organization returned" });
  });

  it("returns email mismatch error from RPC", async () => {
    const supabase = makeSupabase({
      data: { success: false, error_code: "EMAIL_MISMATCH" },
      error: null,
    });

    const result = await OrgInvitationsService.acceptInvitation(supabase, "tok");

    expect(result).toEqual({ success: false, error: "EMAIL_MISMATCH" });
  });
});

describe("OrgInvitationsService.resendInvitation", () => {
  it("returns token, email, and organization_id on success", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { token: "new-tok", email: "user@example.com", organization_id: "org-123" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof OrgInvitationsService.resendInvitation>[0];

    const result = await OrgInvitationsService.resendInvitation(supabase, "inv-id");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        token: "new-tok",
        email: "user@example.com",
        organization_id: "org-123",
      });
    }
  });

  it("returns error when invitation not found", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof OrgInvitationsService.resendInvitation>[0];

    const result = await OrgInvitationsService.resendInvitation(supabase, "inv-id");

    expect(result).toEqual({ success: false, error: "Invitation not found or unauthorized" });
  });
});
