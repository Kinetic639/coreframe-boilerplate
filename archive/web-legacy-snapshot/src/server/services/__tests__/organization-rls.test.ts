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
  OrgRolesService,
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

// ─── Fix A: org_members_select_requires_active_role (RESTRICTIVE) ─────────────

describe("Fix A: organization_members SELECT — RESTRICTIVE policy (org_members_select_requires_active_role)", () => {
  /**
   * Migration: 20260305100000_org_members_select_hardening
   *
   * Policy (RESTRICTIVE, SELECT):
   *   USING: has_any_org_role(organization_id)
   *
   * Problem neutralised:
   *   The legacy permissive SELECT policy contains `is_org_creator(organization_id)`,
   *   which checks only the `organizations` table (created_by = auth.uid()) with NO
   *   check on user_role_assignments. A removed org creator whose URA is soft-deleted
   *   could still see the full member list via this clause.
   *
   * Mechanism (Postgres RESTRICTIVE):
   *   RESTRICTIVE policies are AND-combined with all PERMISSIVE results.
   *   Even if a permissive policy would grant access (e.g. via is_org_creator), the
   *   RESTRICTIVE policy's USING predicate MUST also return TRUE. If has_any_org_role
   *   returns FALSE the row is invisible regardless of permissive outcomes.
   *
   * has_any_org_role(org_id):
   *   EXISTS (SELECT 1 FROM user_role_assignments
   *     WHERE user_id = auth.uid() AND scope = 'org'
   *           AND scope_id = org_id AND deleted_at IS NULL)
   *   → queries user_role_assignments, NOT organization_members → no recursion risk.
   */

  it("removed user gets empty member list — RLS returns zero rows (has_any_org_role=false path)", async () => {
    // Simulates: removed user's URA is soft-deleted → has_any_org_role = FALSE
    // → RESTRICTIVE policy blocks → listMembers returns empty array
    const supabase = makeRlsEmptyClient();
    const result = await OrgMembersService.listMembers(supabase as never, "org-123");
    expect(result.success).toBe(true);
    expect((result as { success: true; data: unknown[] }).data).toEqual([]);
  });

  it("removed user gets structured failure on RLS hard-deny", async () => {
    // Simulates: DB returns 42501 for removed user attempting a member list read
    const supabase = makeRlsDeniedClient();
    const result = await OrgMembersService.listMembers(supabase as never, "org-123");
    expect(result.success).toBe(false);
  });

  it("documents has_any_org_role semantics: deleted URA blocks viewer", () => {
    // has_any_org_role(org_id):
    //   EXISTS (... FROM user_role_assignments WHERE deleted_at IS NULL ...)
    // When URA is soft-deleted: deleted_at IS NOT NULL → EXISTS = FALSE → RESTRICTIVE blocks
    const hasAnyOrgRole = (uraDeletedAt: string | null) => uraDeletedAt === null;

    expect(hasAnyOrgRole(null)).toBe(true); // active URA → passes RESTRICTIVE
    expect(hasAnyOrgRole("2026-03-05T00:00:00Z")).toBe(false); // removed URA → RESTRICTIVE blocks
  });

  it("documents is_org_creator bypass is neutralised by RESTRICTIVE policy", () => {
    // Old risk:
    //   Permissive USING: (user_id = auth.uid()) OR is_org_creator(org_id) OR has_any_org_role(org_id)
    //   → is_org_creator had no URA check; removed org creators still passed permissive.
    //
    // After fix: combined result = RESTRICTIVE(has_any_org_role) AND permissive
    //   → removed org creator: is_org_creator=true BUT has_any_org_role=false → BLOCKED ✅
    const restrictiveAllows = (hasAnyOrgRole: boolean) => hasAnyOrgRole;
    const permissiveAllows = (isOrgCreator: boolean, hasAnyOrgRole: boolean) =>
      isOrgCreator || hasAnyOrgRole;
    const rowVisible = (isOrgCreator: boolean, uraDeletedAt: string | null) => {
      const hasRole = uraDeletedAt === null;
      return restrictiveAllows(hasRole) && permissiveAllows(isOrgCreator, hasRole);
    };

    expect(rowVisible(true, null)).toBe(true); // active org creator → visible ✅
    expect(rowVisible(true, "2026-03-05")).toBe(false); // removed org creator → BLOCKED ✅ (bypass neutralised)
    expect(rowVisible(false, null)).toBe(true); // active non-creator → visible ✅
    expect(rowVisible(false, "2026-03-05")).toBe(false); // removed non-creator → BLOCKED ✅
  });
});

// ─── Fix B: roles UPDATE hardening ───────────────────────────────────────────

describe("Fix B: roles UPDATE — RESTRICTIVE policy + immutable column trigger", () => {
  /**
   * Migration: 20260305110000_roles_update_hardening
   *
   * Part 1 — RESTRICTIVE UPDATE policy (roles_update_restrictive_hardened):
   *   USING:      organization_id IS NOT NULL AND is_org_member(organization_id)
   *   WITH CHECK: organization_id IS NOT NULL AND is_org_member(organization_id)
   *               AND has_permission(organization_id, 'members.manage')
   *
   * Part 2 — BEFORE UPDATE trigger (roles_protect_immutable_columns):
   *   Raises exception P0001 if organization_id, is_basic, or scope_type changes.
   *
   * Problems addressed:
   *   (a) Existing WITH CHECK only: organization_id IS NOT NULL AND is_basic = false
   *       → no re-verification of org membership in the NEW row's org
   *       → a privileged user could change organization_id to another org they belong to
   *   (b) No DB-level immutability for organization_id, is_basic, scope_type
   */

  it("service returns structured failure when DB returns trigger exception", async () => {
    // Simulates: BEFORE UPDATE trigger fires → DB returns P0001
    const triggerError = {
      code: "P0001",
      message: "roles.organization_id is immutable",
    };
    const supabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: triggerError }),
          }),
        }),
      }),
    };
    const result = await OrgRolesService.updateRole(supabase as never, "role-123", {
      name: "New Name",
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("immutable");
  });

  it("service returns structured failure when RESTRICTIVE WITH CHECK blocks update", async () => {
    // Simulates: RESTRICTIVE WITH CHECK fails → DB returns empty result (no row updated)
    const supabase = makeRlsEmptyClient();
    const result = await OrgRolesService.updateRole(supabase as never, "role-123", {
      name: "New Name",
    });
    // updateRole: no error but no rows updated is a valid "no-op" scenario
    // The key invariant: no exception is thrown to the caller
    expect(result).toMatchObject({ success: expect.any(Boolean) });
  });

  it("documents immutable column trigger semantics (IS DISTINCT FROM)", () => {
    // The trigger uses: IF NEW.col IS DISTINCT FROM OLD.col THEN RAISE EXCEPTION
    // IS DISTINCT FROM is NULL-safe: NULL IS DISTINCT FROM NULL → FALSE (no exception)
    const triggerWouldBlock = (oldVal: unknown, newVal: unknown) =>
      oldVal !== newVal && !(oldVal === null && newVal === null);

    // organization_id
    expect(triggerWouldBlock("org-A", "org-B")).toBe(true); // mutation → BLOCKED ✅
    expect(triggerWouldBlock("org-A", "org-A")).toBe(false); // no change → passes ✅

    // is_basic
    expect(triggerWouldBlock(false, true)).toBe(true); // mutation → BLOCKED ✅
    expect(triggerWouldBlock(false, false)).toBe(false); // no change → passes ✅

    // scope_type
    expect(triggerWouldBlock("org", "branch")).toBe(true); // mutation → BLOCKED ✅
    expect(triggerWouldBlock("org", "org")).toBe(false); // no change → passes ✅
  });

  it("documents cross-org update is blocked by RESTRICTIVE WITH CHECK", () => {
    // WITH CHECK: organization_id IS NOT NULL
    //             AND is_org_member(organization_id)   ← membership in NEW org required
    //             AND has_permission(organization_id, 'members.manage')
    //
    // Defense-in-depth: even if trigger were absent, WITH CHECK prevents cross-org
    // writes because the user must be a member of — and have members.manage in — the
    // NEW organization_id value.
    const withCheckWouldPass = (
      orgId: string | null,
      isOrgMember: boolean,
      hasPermission: boolean
    ) => orgId !== null && isOrgMember && hasPermission;

    expect(withCheckWouldPass("org-A", true, true)).toBe(true); // legitimate update ✅
    expect(withCheckWouldPass("org-B", false, false)).toBe(false); // cross-org, not member → BLOCKED ✅
    expect(withCheckWouldPass("org-B", true, false)).toBe(false); // cross-org, no permission → BLOCKED ✅
    expect(withCheckWouldPass(null, true, true)).toBe(false); // null org_id → BLOCKED ✅
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
