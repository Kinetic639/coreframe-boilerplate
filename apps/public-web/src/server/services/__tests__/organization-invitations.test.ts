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

describe("OrgInvitationsService.acceptInvitation — stabilized org_member-only path", () => {
  // These tests document the stabilized acceptance behavior:
  // - RPC resolves org_member dynamically (no hardcoded UUID in response)
  // - RPC returns organization_id for post-accept routing
  // - No invited role_id assignment in this phase

  it("always calls accept_invitation_and_join_org with only p_token", async () => {
    const supabase = makeSupabase({
      data: { success: true, organization_id: "org-invited" },
      error: null,
    });

    await OrgInvitationsService.acceptInvitation(supabase, "tok-stable-1");

    // The stabilized RPC takes only p_token — no role_id, no branch_id
    expect(supabase.rpc).toHaveBeenCalledWith("accept_invitation_and_join_org", {
      p_token: "tok-stable-1",
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("returns organization_id enabling client to route to invited org context", async () => {
    const supabase = makeSupabase({
      data: { success: true, organization_id: "org-target-abc" },
      error: null,
    });

    const result = await OrgInvitationsService.acceptInvitation(supabase, "tok-route-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.organization_id).toBe("org-target-abc");
    }
  });

  it("surfaces INTERNAL_ERROR from RPC (covers FK violation, broken-hook users)", async () => {
    // Before the fix, broken-hook users (no public.users row) caused a FK
    // violation on organization_members.user_id → public.users(id), caught
    // as INTERNAL_ERROR. The stabilized function UPSERTs public.users first.
    const supabase = makeSupabase({
      data: { success: false, error_code: "INTERNAL_ERROR" },
      error: null,
    });

    const result = await OrgInvitationsService.acceptInvitation(supabase, "tok-internal-err");

    expect(result).toEqual({ success: false, error: "INTERNAL_ERROR" });
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

// ─── createInvitation eligibility checks ────────────────────────────────────

describe("OrgInvitationsService.createInvitation — eligibility checks", () => {
  function makeSupabaseForCreate(opts: {
    eligResult: { eligible: boolean; reason?: string };
    insertData?: Record<string, unknown> | null;
    insertError?: { message: string } | null;
    iraError?: { message: string } | null;
  }) {
    const iraInsert = vi.fn().mockResolvedValue({ error: opts.iraError ?? null });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === "invitation_role_assignments") {
        return { insert: iraInsert };
      }
      // invitations table
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: opts.insertData ?? null,
              error: opts.insertError ?? null,
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
    });

    return {
      rpc: vi.fn().mockResolvedValue({ data: opts.eligResult, error: null }),
      from: fromMock,
      _iraInsert: iraInsert,
    } as unknown as Parameters<typeof OrgInvitationsService.createInvitation>[0] & {
      _iraInsert: ReturnType<typeof vi.fn>;
    };
  }

  it("rejects SELF_INVITE from eligibility RPC", async () => {
    const supabase = makeSupabaseForCreate({
      eligResult: { eligible: false, reason: "SELF_INVITE" },
    });
    const result = await OrgInvitationsService.createInvitation(supabase, "org-1", "user-1", {
      email: "me@example.com",
    });
    expect(result).toEqual({ success: false, error: "SELF_INVITE" });
    expect(supabase.rpc).toHaveBeenCalledWith("check_invitation_eligibility", {
      p_org_id: "org-1",
      p_email: "me@example.com",
      p_inviter_id: "user-1",
    });
  });

  it("rejects ALREADY_MEMBER from eligibility RPC", async () => {
    const supabase = makeSupabaseForCreate({
      eligResult: { eligible: false, reason: "ALREADY_MEMBER" },
    });
    const result = await OrgInvitationsService.createInvitation(supabase, "org-1", "admin-1", {
      email: "existing@example.com",
    });
    expect(result).toEqual({ success: false, error: "ALREADY_MEMBER" });
  });

  it("rejects DUPLICATE_PENDING from eligibility RPC", async () => {
    const supabase = makeSupabaseForCreate({
      eligResult: { eligible: false, reason: "DUPLICATE_PENDING" },
    });
    const result = await OrgInvitationsService.createInvitation(supabase, "org-1", "admin-1", {
      email: "pending@example.com",
    });
    expect(result).toEqual({ success: false, error: "DUPLICATE_PENDING" });
  });

  it("creates invitation with names when eligible", async () => {
    const supabase = makeSupabaseForCreate({
      eligResult: { eligible: true },
      insertData: {
        id: "inv-new",
        email: "new@example.com",
        invited_by: "admin-1",
        organization_id: "org-1",
        branch_id: null,
        role_id: null,
        token: "tok-new",
        status: "pending",
        expires_at: null,
        accepted_at: null,
        declined_at: null,
        created_at: null,
        deleted_at: null,
        invited_first_name: "Jane",
        invited_last_name: "Smith",
      },
    });

    const result = await OrgInvitationsService.createInvitation(supabase, "org-1", "admin-1", {
      email: "new@example.com",
      invited_first_name: "Jane",
      invited_last_name: "Smith",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.invited_first_name).toBe("Jane");
      expect(result.data.invited_last_name).toBe("Smith");
      expect(result.data.role_summary).toBeNull();
    }
  });

  it("inserts IRA rows when role_assignments provided", async () => {
    const supabase = makeSupabaseForCreate({
      eligResult: { eligible: true },
      insertData: {
        id: "inv-roles",
        email: "roles@example.com",
        invited_by: "admin-1",
        organization_id: "org-1",
        branch_id: null,
        role_id: null,
        token: "tok-roles",
        status: "pending",
        expires_at: null,
        accepted_at: null,
        declined_at: null,
        created_at: null,
        deleted_at: null,
        invited_first_name: null,
        invited_last_name: null,
      },
    }) as ReturnType<typeof makeSupabaseForCreate>;

    await OrgInvitationsService.createInvitation(supabase, "org-1", "admin-1", {
      email: "roles@example.com",
      role_assignments: [
        { role_id: "role-abc", scope: "org" },
        { role_id: "role-branch", scope: "branch", scope_id: "branch-x" },
      ],
    });

    const iraInsert = (supabase as unknown as { _iraInsert: ReturnType<typeof vi.fn> })._iraInsert;
    expect(iraInsert).toHaveBeenCalledWith([
      { invitation_id: "inv-roles", role_id: "role-abc", scope: "org", scope_id: null },
      { invitation_id: "inv-roles", role_id: "role-branch", scope: "branch", scope_id: "branch-x" },
    ]);
  });

  it("rolls back invitation when IRA insert fails", async () => {
    const supabase = makeSupabaseForCreate({
      eligResult: { eligible: true },
      insertData: {
        id: "inv-rollback",
        email: "rollback@example.com",
        invited_by: "admin-1",
        organization_id: "org-1",
        branch_id: null,
        role_id: null,
        token: "tok-rb",
        status: "pending",
        expires_at: null,
        accepted_at: null,
        declined_at: null,
        created_at: null,
        deleted_at: null,
        invited_first_name: null,
        invited_last_name: null,
      },
      iraError: { message: "FK violation" },
    });

    const result = await OrgInvitationsService.createInvitation(supabase, "org-1", "admin-1", {
      email: "rollback@example.com",
      role_assignments: [{ role_id: "bad-role", scope: "org" }],
    });

    expect(result).toEqual({ success: false, error: "FK violation" });
  });
});
