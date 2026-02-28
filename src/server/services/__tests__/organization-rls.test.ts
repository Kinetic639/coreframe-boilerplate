/**
 * @vitest-environment node
 *
 * T1: RLS behavior tests for Organization Management service layer.
 *
 * These tests verify that:
 * 1. Service methods correctly propagate Supabase RLS errors as structured failures.
 * 2. Service methods never throw raw errors to callers.
 * 3. Service methods handle "no rows returned" (also an RLS outcome) gracefully.
 *
 * Real RLS policy expectations (verified via Supabase MCP, Feb 2026):
 *
 * organization_profiles:
 *   - SELECT: is_org_member(organization_id) — status='active' AND deleted_at IS NULL
 *   - UPDATE: is_org_member(organization_id) AND has_permission(organization_id, 'org.update')
 *
 * organization_members:
 *   - UPDATE (additive V2): is_org_member(organization_id) AND has_permission('members.manage')
 *
 * org_positions:
 *   - SELECT/INSERT/UPDATE/DELETE: is_org_member + has_permission('members.manage') for mutations
 *
 * is_org_member(org_id) — confirmed definition:
 *   WHERE status = 'active' AND deleted_at IS NULL
 *   → 'inactive' BLOCKS access at DB level (not UI-only)
 *   → 'pending'  BLOCKS access at DB level
 *
 * DB CHECK constraint on organization_members.status:
 *   ARRAY['active', 'inactive', 'pending'] — 'removed'/'suspended' are INVALID
 */
import { describe, it, expect, vi } from "vitest";
import {
  OrgProfileService,
  OrgMembersService,
  OrgPositionsService,
  OrgBranchesService,
  OrgInvitationsService,
} from "../organization.service";

// ─── Mock builder helpers ─────────────────────────────────────────────────────

/**
 * Creates a fully-chainable Supabase query mock that resolves with an RLS error.
 * Every chainable method returns the same proxy object.
 * Terminal methods (maybeSingle, awaitable .order/.is) resolve with the error.
 */
function makeRlsDeniedClient() {
  const rlsError = { code: "42501", message: "permission denied for table organization_profiles" };
  const errResult = { data: null, error: rlsError };

  function makeChainable(): Record<string, unknown> {
    const q: Record<string, unknown> = {};
    const chain = [
      "select",
      "insert",
      "update",
      "delete",
      "eq",
      "neq",
      "is",
      "in",
      "not",
      "filter",
      "match",
      "ilike",
      "contains",
      "overlaps",
      "gt",
      "gte",
      "lt",
      "lte",
    ];
    for (const m of chain) {
      q[m] = vi.fn().mockImplementation(() => makeChainable());
    }
    q["maybeSingle"] = vi.fn().mockResolvedValue(errResult);
    // Make the object itself awaitable (covers .order().then() and .is().then())
    q["then"] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(errResult).then(onFulfilled);
    q["order"] = vi.fn().mockImplementation(() => makeChainable());
    return q;
  }

  return {
    from: vi.fn().mockImplementation(() => makeChainable()),
    storage: { from: vi.fn() },
  };
}

/**
 * Creates a Supabase client mock that returns empty results (RLS filtered rows).
 */
function makeRlsEmptyClient() {
  const okResult = { data: [], error: null };
  const okSingle = { data: null, error: null };

  function makeChainable(): Record<string, unknown> {
    const q: Record<string, unknown> = {};
    const chain = [
      "select",
      "insert",
      "update",
      "delete",
      "eq",
      "neq",
      "is",
      "in",
      "not",
      "filter",
      "match",
    ];
    for (const m of chain) {
      q[m] = vi.fn().mockImplementation(() => makeChainable());
    }
    q["maybeSingle"] = vi.fn().mockResolvedValue(okSingle);
    q["then"] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(okResult).then(onFulfilled);
    q["order"] = vi.fn().mockImplementation(() => makeChainable());
    return q;
  }

  return { from: vi.fn().mockImplementation(() => makeChainable()) };
}

/**
 * Creates a Supabase client mock that returns a single row successfully.
 */
function makeSuccessClient(data: unknown) {
  const listResult = { data: Array.isArray(data) ? data : [data], error: null };
  const singleResult = { data, error: null };
  const voidResult = { data: null, error: null };

  function makeChainable(): Record<string, unknown> {
    const q: Record<string, unknown> = {};
    const chain = [
      "select",
      "insert",
      "update",
      "upsert",
      "delete",
      "eq",
      "neq",
      "is",
      "in",
      "not",
      "filter",
      "match",
    ];
    for (const m of chain) {
      q[m] = vi.fn().mockImplementation(() => makeChainable());
    }
    q["maybeSingle"] = vi.fn().mockResolvedValue(singleResult);
    q["then"] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(listResult).then(onFulfilled);
    q["order"] = vi.fn().mockImplementation(() => {
      const sub = makeChainable();
      sub["then"] = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(listResult).then(onFulfilled);
      return sub;
    });
    // For update/is that resolves void
    q["is"] = vi.fn().mockImplementation(() => {
      const sub = makeChainable();
      sub["then"] = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(voidResult).then(onFulfilled);
      return sub;
    });
    return q;
  }

  return { from: vi.fn().mockImplementation(() => makeChainable()) };
}

// ─── OrgProfileService ────────────────────────────────────────────────────────

describe("OrgProfileService", () => {
  describe("getProfile", () => {
    it("returns structured failure when RLS denies SELECT (non-member)", async () => {
      const supabase = makeRlsDeniedClient();
      const result = await OrgProfileService.getProfile(supabase as never, "org-123");
      expect(result.success).toBe(false);
      expect((result as { success: false; error: string }).error).toContain("permission denied");
    });

    it("returns not-found when RLS filters row to empty", async () => {
      const supabase = makeRlsEmptyClient();
      const result = await OrgProfileService.getProfile(supabase as never, "org-456");
      expect(result.success).toBe(false);
      expect((result as { success: false; error: string }).error).toBe(
        "Organization profile not found"
      );
    });

    it("returns data when RLS allows SELECT", async () => {
      const profileData = {
        organization_id: "org-123",
        name: "Acme Corp",
        name_2: null,
        slug: "acme",
        bio: null,
        website: null,
        logo_url: null,
        theme_color: null,
        font_color: null,
        created_at: "2026-01-01T00:00:00Z",
      };
      const supabase = makeSuccessClient(profileData);
      const result = await OrgProfileService.getProfile(supabase as never, "org-123");
      expect(result.success).toBe(true);
      expect((result as { success: true; data: typeof profileData }).data.name).toBe("Acme Corp");
    });

    it("never throws — always returns ServiceResult", async () => {
      const supabase = makeRlsDeniedClient();
      await expect(
        OrgProfileService.getProfile(supabase as never, "org-123")
      ).resolves.toMatchObject({ success: false });
    });
  });

  describe("updateProfile", () => {
    it("returns structured failure when RLS denies UPDATE", async () => {
      const supabase = makeRlsDeniedClient();
      const result = await OrgProfileService.updateProfile(supabase as never, "org-123", {
        name: "New Name",
      });
      expect(result.success).toBe(false);
    });

    it("returns not-found when update produces no row (WITH CHECK blocked)", async () => {
      const supabase = makeRlsEmptyClient();
      const result = await OrgProfileService.updateProfile(supabase as never, "org-123", {
        name: "New Name",
      });
      expect(result.success).toBe(false);
      expect((result as { success: false; error: string }).error).toBe(
        "Update failed or unauthorized"
      );
    });
  });
});

// ─── OrgMembersService ────────────────────────────────────────────────────────

describe("OrgMembersService", () => {
  describe("removeMember", () => {
    it("does NOT write status='removed' (violates DB CHECK constraint)", async () => {
      const capturedUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      // branches query (step 3): select chain that returns empty list
      const branchSelectChain = {
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      const supabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "branches") return { select: vi.fn().mockReturnValue(branchSelectChain) };
          return { update: capturedUpdate };
        }),
      };

      await OrgMembersService.removeMember(supabase as never, "org-123", "user-456");

      expect(capturedUpdate).toHaveBeenCalledWith(
        expect.not.objectContaining({ status: "removed" })
      );
      expect(capturedUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) })
      );
    });

    it("returns structured failure when RLS denies UPDATE", async () => {
      const supabase = makeRlsDeniedClient();
      const result = await OrgMembersService.removeMember(supabase as never, "org-123", "user-456");
      expect(result.success).toBe(false);
    });
  });

  describe("updateMemberStatus", () => {
    it("passes 'inactive' (canonical) — NOT 'suspended' (invalid)", async () => {
      const capturedUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      const supabase = { from: vi.fn().mockReturnValue({ update: capturedUpdate }) };

      await OrgMembersService.updateMemberStatus(
        supabase as never,
        "org-123",
        "user-456",
        "inactive"
      );

      expect(capturedUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "inactive" }));
      expect(capturedUpdate).toHaveBeenCalledWith(
        expect.not.objectContaining({ status: "suspended" })
      );
    });
  });
});

// ─── OrgPositionsService ──────────────────────────────────────────────────────

describe("OrgPositionsService", () => {
  describe("listPositions", () => {
    it("returns empty array when RLS filters all rows", async () => {
      const supabase = makeRlsEmptyClient();
      const result = await OrgPositionsService.listPositions(supabase as never, "org-123");
      expect(result.success).toBe(true);
      expect((result as { success: true; data: unknown[] }).data).toEqual([]);
    });

    it("returns structured failure when RLS returns a hard error", async () => {
      const supabase = makeRlsDeniedClient();
      const result = await OrgPositionsService.listPositions(supabase as never, "org-123");
      expect(result.success).toBe(false);
    });
  });
});

// ─── OrgBranchesService ───────────────────────────────────────────────────────

describe("OrgBranchesService", () => {
  describe("listBranches", () => {
    it("returns structured failure when DB returns error", async () => {
      const supabase = makeRlsDeniedClient();
      const result = await OrgBranchesService.listBranches(supabase as never, "org-123");
      expect(result.success).toBe(false);
    });
  });

  describe("createBranch", () => {
    it("returns structured failure when RLS denies INSERT", async () => {
      const supabase = makeRlsDeniedClient();
      const result = await OrgBranchesService.createBranch(supabase as never, "org-123", {
        name: "New Branch",
      });
      expect(result.success).toBe(false);
    });
  });
});

// ─── OrgInvitationsService ────────────────────────────────────────────────────

describe("OrgInvitationsService", () => {
  describe("cancelInvitation", () => {
    it("only writes status='cancelled' — matches invitations_update_self_cancel WITH CHECK", async () => {
      const capturedUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      const supabase = { from: vi.fn().mockReturnValue({ update: capturedUpdate }) };

      await OrgInvitationsService.cancelInvitation(supabase as never, "inv-123");

      expect(capturedUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
      // Must NOT update role_id, branch_id, or other sensitive columns —
      // the invitations_update_self_cancel WITH CHECK would reject those.
      expect(capturedUpdate).toHaveBeenCalledWith(
        expect.not.objectContaining({ role_id: expect.anything() })
      );
      expect(capturedUpdate).toHaveBeenCalledWith(
        expect.not.objectContaining({ branch_id: expect.anything() })
      );
    });

    it("returns structured failure when RLS denies UPDATE", async () => {
      const supabase = makeRlsDeniedClient();
      const result = await OrgInvitationsService.cancelInvitation(supabase as never, "inv-123");
      expect(result.success).toBe(false);
    });
  });
});

// ─── Invitations UPDATE self-cancel RLS semantics (Gap #6 fix) ───────────────

describe("Invitations UPDATE self-cancel RLS semantics (invitations_update_self_cancel)", () => {
  /**
   * Gap #6 fix (applied 2026-02-27):
   * The invitee email-match UPDATE policy now enforces WITH CHECK: status = 'cancelled'.
   *
   * invitations_update_self_cancel:
   *   USING:      lower(email) = lower(auth.jwt()->>'email') AND deleted_at IS NULL
   *   WITH CHECK: lower(email) = lower(auth.jwt()->>'email')
   *               AND status = 'cancelled'
   *               AND deleted_at IS NULL
   *
   * Exploit path blocked:
   *   invitee PATCHes role_id to admin role while keeping status='pending'
   *   → WITH CHECK fails (status != 'cancelled') → DB rejects → 42501
   *
   * Legitimate self-cancel (status='cancelled', no other column changes) still passes.
   * Org members with invites.cancel permission use the separate invitations_update_org_cancel
   * policy (no status restriction on that branch).
   */
  it("documents that self-cancel WITH CHECK requires status='cancelled'", () => {
    const selfCancelWithCheckWouldPass = (status: string, email: string, jwtEmail: string) =>
      email.toLowerCase() === jwtEmail.toLowerCase() && status === "cancelled";

    // Legitimate self-cancel
    expect(selfCancelWithCheckWouldPass("cancelled", "user@example.com", "user@example.com")).toBe(
      true
    );
    // Exploit attempt: keep status=pending while changing role_id
    expect(selfCancelWithCheckWouldPass("pending", "user@example.com", "user@example.com")).toBe(
      false
    );
    // Exploit attempt: use a different terminal status
    expect(selfCancelWithCheckWouldPass("accepted", "user@example.com", "user@example.com")).toBe(
      false
    );
    // Non-invitee email — wrong JWT
    expect(selfCancelWithCheckWouldPass("cancelled", "user@example.com", "other@example.com")).toBe(
      false
    );
  });
});

// ─── Invitations UPDATE self-accept RLS semantics (regression fix) ───────────

describe("Invitations UPDATE self-accept RLS semantics (invitations_update_self_accept)", () => {
  /**
   * Regression fix (applied 2026-02-27, migration 20260227200001):
   *
   * Gap #6 fix left no UPDATE policy permitting status='accepted' for email-match users,
   * breaking the invite acceptance flow at DB level (all acceptance writes returned 42501).
   *
   * invitations_update_self_accept:
   *   USING:      lower(email) = lower(auth.jwt()->>'email') AND deleted_at IS NULL
   *   WITH CHECK: lower(email) = lower(auth.jwt()->>'email')
   *               AND status = 'accepted'
   *               AND accepted_at IS NOT NULL
   *               AND deleted_at IS NULL
   *
   * Gap #6 security property remains intact:
   *   - No policy permits status='pending' for email-match invitees.
   *   - role_id/branch_id pivot while pending is still blocked.
   *   - self-cancel (status='cancelled') still works via invitations_update_self_cancel.
   *
   * NOTE: These are logic-level documentation tests. The real DB behaviour (permissive
   * policy OR-combining) requires an integration test against a live Postgres instance
   * with seeded RLS-aware users. The logic tests below document the expected per-policy
   * WITH CHECK expressions; they do not prove cross-policy OR combination at DB level.
   */

  /** Models WITH CHECK for invitations_update_self_accept */
  const selfAcceptWithCheckWouldPass = (
    status: string,
    acceptedAt: string | null,
    email: string,
    jwtEmail: string
  ) =>
    email.toLowerCase() === jwtEmail.toLowerCase() && status === "accepted" && acceptedAt !== null;

  /** Models WITH CHECK for invitations_update_self_cancel */
  const selfCancelWithCheckWouldPass = (email: string, jwtEmail: string, status: string) =>
    email.toLowerCase() === jwtEmail.toLowerCase() && status === "cancelled";

  it("(1) invitee CAN accept their invite — status='accepted', accepted_at set", () => {
    expect(
      selfAcceptWithCheckWouldPass(
        "accepted",
        "2026-02-27T10:00:00Z",
        "user@example.com",
        "user@example.com"
      )
    ).toBe(true);
  });

  it("(2) invitee CAN cancel their invite — status='cancelled'", () => {
    expect(selfCancelWithCheckWouldPass("user@example.com", "user@example.com", "cancelled")).toBe(
      true
    );
  });

  it("(3) invitee CANNOT keep status='pending' while changing role_id — no policy permits pending writes", () => {
    // Neither self-accept nor self-cancel WITH CHECK passes for status='pending'.
    expect(
      selfAcceptWithCheckWouldPass("pending", null, "user@example.com", "user@example.com")
    ).toBe(false);
    expect(selfCancelWithCheckWouldPass("user@example.com", "user@example.com", "pending")).toBe(
      false
    );
  });

  it("(4) invitee CANNOT accept without accepted_at — WITH CHECK requires accepted_at IS NOT NULL", () => {
    expect(
      selfAcceptWithCheckWouldPass("accepted", null, "user@example.com", "user@example.com")
    ).toBe(false);
  });

  it("non-invitee email is blocked by both policies", () => {
    expect(
      selfAcceptWithCheckWouldPass(
        "accepted",
        "2026-02-27T10:00:00Z",
        "user@example.com",
        "other@example.com"
      )
    ).toBe(false);
    expect(selfCancelWithCheckWouldPass("user@example.com", "other@example.com", "cancelled")).toBe(
      false
    );
  });
});

// ─── Status semantics documentation ──────────────────────────────────────────

describe("Member status semantics (DB constraint compliance)", () => {
  /**
   * Canonical values: CHECK (status = ANY (ARRAY['active', 'inactive', 'pending']))
   *
   * RLS gate (is_org_member):
   *   WHERE status = 'active' AND deleted_at IS NULL
   *   → 'inactive' = complete DB-level access block (not UI-only)
   *   → 'pending'  = complete DB-level access block
   *   → deleted_at IS NOT NULL = complete DB-level access block
   */
  it("documents that only active|inactive|pending are valid status values", () => {
    const valid = ["active", "inactive", "pending"] as const;
    const invalid = ["suspended", "removed", "banned"];
    for (const s of invalid) {
      expect(valid).not.toContain(s);
    }
  });

  it("documents that inactive blocks RLS (same as deletion)", () => {
    // is_org_member checks: status = 'active' AND deleted_at IS NULL
    // So inactive → is_org_member = false → all RLS policies that use is_org_member block
    // This is confirmed by the DB function definition verified via Supabase MCP.
    const isOrgMemberWouldAllow = (status: string, deletedAt: string | null) =>
      status === "active" && deletedAt === null;

    expect(isOrgMemberWouldAllow("active", null)).toBe(true);
    expect(isOrgMemberWouldAllow("inactive", null)).toBe(false);
    expect(isOrgMemberWouldAllow("pending", null)).toBe(false);
    expect(isOrgMemberWouldAllow("active", "2026-01-01")).toBe(false);
  });
});
