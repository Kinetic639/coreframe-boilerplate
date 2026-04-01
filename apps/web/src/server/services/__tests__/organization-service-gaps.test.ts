/**
 * @vitest-environment node
 *
 * Gap tests for organization.service.ts — methods not covered by
 * organization-service-core.test.ts:
 *   - OrgMembersService.updateMemberStatus
 *   - OrgMembersService.removeMember  (multi-step soft-delete + role revocation)
 *   - OrgBillingService.getBillingOverview
 */
import { describe, it, expect, vi } from "vitest";
import { OrgMembersService, OrgBillingService } from "../organization.service";

// ─── Chain builder ────────────────────────────────────────────────────────────

/**
 * Creates a fully-chainable query mock.
 * `terminal` = the result resolved by `maybeSingle` / `single`.
 * `listResult` = the result resolved when the chain is awaited directly.
 */
function makeChain(
  terminal: { data: unknown; error: unknown } | null,
  listOverride?: { data: unknown; error: unknown }
) {
  const single = terminal ?? { data: null, error: null };
  const list = listOverride ?? {
    data: terminal?.data !== null && terminal?.data !== undefined ? [terminal.data] : [],
    error: terminal?.error ?? null,
  };

  const q: Record<string, unknown> = {};
  const chainMethods = [
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
    "ilike",
    "or",
    "gt",
    "gte",
    "lt",
    "lte",
  ];
  for (const m of chainMethods) {
    q[m] = vi.fn().mockReturnThis();
  }
  q["order"] = vi.fn().mockReturnThis();
  q["limit"] = vi.fn().mockReturnThis();
  q["maybeSingle"] = vi.fn().mockResolvedValue(single);
  q["single"] = vi.fn().mockResolvedValue(single);
  q["then"] = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(list).then(onFulfilled);
  return q;
}

type Chain = ReturnType<typeof makeChain>;

/** Helper: build a mock supabase client with a single shared chain for all `from()` calls */
function makeSupabase(chain: Chain) {
  return {
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn(),
    storage: { from: vi.fn() },
  } as unknown as Parameters<typeof OrgMembersService.updateMemberStatus>[0];
}

/** Helper: build a mock supabase client that returns different chains per table name */
function makeMultiTableSupabase(tableMap: Record<string, Chain>) {
  const defaultChain = makeChain({ data: null, error: null });
  return {
    from: vi.fn().mockImplementation((table: string) => tableMap[table] ?? defaultChain),
    rpc: vi.fn(),
    storage: { from: vi.fn() },
  } as unknown as Parameters<typeof OrgMembersService.updateMemberStatus>[0];
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "org-111";
const USER_ID = "user-222";
const BRANCH_ID_A = "branch-aaa";
const BRANCH_ID_B = "branch-bbb";

// ─── OrgMembersService.updateMemberStatus ─────────────────────────────────────

describe("OrgMembersService.updateMemberStatus", () => {
  it("returns success when update succeeds", async () => {
    const chain = makeChain({ data: null, error: null });
    const supabase = makeSupabase(chain);

    const result = await OrgMembersService.updateMemberStatus(
      supabase as any,
      ORG_ID,
      USER_ID,
      "inactive"
    );

    expect(result.success).toBe(true);
  });

  it("passes correct status value to update", async () => {
    const chain = makeChain({ data: null, error: null });
    const supabase = makeSupabase(chain);

    await OrgMembersService.updateMemberStatus(supabase as any, ORG_ID, USER_ID, "active");

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });

  it("returns failure when DB update errors", async () => {
    const chain = makeChain({
      data: null,
      error: { message: "row-level security policy violation" },
    });
    // The chain.then resolves with this error
    (chain as any)["then"] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve({
        data: null,
        error: { message: "row-level security policy violation" },
      }).then(onFulfilled);
    const supabase = makeSupabase(chain);

    const result = await OrgMembersService.updateMemberStatus(
      supabase as any,
      ORG_ID,
      USER_ID,
      "inactive"
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      "row-level security policy violation"
    );
  });
});

// ─── OrgMembersService.removeMember ──────────────────────────────────────────

describe("OrgMembersService.removeMember", () => {
  it("returns success when all steps complete without error", async () => {
    // Step 1: soft-delete membership
    const membersChain = makeChain({ data: null, error: null });
    (membersChain as any)["then"] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled);

    // Step 2: revoke org-scoped role assignments
    const orgRolesChain = makeChain({ data: null, error: null });
    (orgRolesChain as any)["then"] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled);

    // Step 3: fetch branches
    const branchesChain = makeChain(
      { data: null, error: null },
      { data: [{ id: BRANCH_ID_A }, { id: BRANCH_ID_B }], error: null }
    );

    // Step 4: revoke branch-scoped role assignments
    const branchRolesChain = makeChain({ data: null, error: null });
    (branchRolesChain as any)["then"] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled);

    let callCount = 0;
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "organization_members") {
          return membersChain;
        }
        if (table === "user_role_assignments") {
          callCount++;
          if (callCount === 1) return orgRolesChain;
          return branchRolesChain;
        }
        if (table === "branches") {
          return branchesChain;
        }
        return makeChain({ data: null, error: null });
      }),
      rpc: vi.fn(),
    } as any;

    const result = await OrgMembersService.removeMember(supabase, ORG_ID, USER_ID);

    expect(result.success).toBe(true);
  });

  it("returns failure when soft-deleting membership fails", async () => {
    const membersChain = makeChain({ data: null, error: null });
    (membersChain as any)["then"] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: { message: "membership delete failed" } }).then(
        onFulfilled
      );

    const supabase = {
      from: vi.fn().mockReturnValue(membersChain),
      rpc: vi.fn(),
    } as any;

    const result = await OrgMembersService.removeMember(supabase, ORG_ID, USER_ID);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("membership delete failed");
  });

  it("skips branch-role revocation when org has no branches", async () => {
    const membersChain = makeChain({ data: null, error: null });
    (membersChain as any)["then"] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled);

    const orgRolesChain = makeChain({ data: null, error: null });
    (orgRolesChain as any)["then"] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled);

    const branchesChain = makeChain({ data: null, error: null }, { data: [], error: null });

    const branchRolesChain = makeChain({ data: null, error: null });
    const branchRolesSpy = vi.fn().mockReturnValue(branchRolesChain);

    let callCount = 0;
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "organization_members") return membersChain;
        if (table === "user_role_assignments") {
          callCount++;
          if (callCount === 1) return orgRolesChain;
          return branchRolesSpy();
        }
        if (table === "branches") return branchesChain;
        return makeChain({ data: null, error: null });
      }),
      rpc: vi.fn(),
    } as any;

    const result = await OrgMembersService.removeMember(supabase, ORG_ID, USER_ID);

    expect(result.success).toBe(true);
    // Branch-role revocation should NOT be called when branches list is empty
    expect(branchRolesSpy).not.toHaveBeenCalled();
  });

  it("returns success even when org-role revocation errors (best-effort step)", async () => {
    // Step 1 succeeds
    const membersChain = makeChain({ data: null, error: null });
    (membersChain as any)["then"] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled);

    // Step 2 errors — but it's fire-and-forget, no return check
    const orgRolesChain = makeChain({ data: null, error: null });
    (orgRolesChain as any)["then"] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: { message: "role revoke failed" } }).then(onFulfilled);

    // Step 3: branches
    const branchesChain = makeChain({ data: null, error: null }, { data: [], error: null });

    let callCount = 0;
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "organization_members") return membersChain;
        if (table === "user_role_assignments") {
          callCount++;
          return orgRolesChain;
        }
        if (table === "branches") return branchesChain;
        return makeChain({ data: null, error: null });
      }),
      rpc: vi.fn(),
    } as any;

    const result = await OrgMembersService.removeMember(supabase, ORG_ID, USER_ID);
    // The service only fails on step 1 error; steps 2/3/4 are best-effort
    expect(result.success).toBe(true);
  });
});

// ─── OrgBillingService.getBillingOverview ─────────────────────────────────────

describe("OrgBillingService.getBillingOverview", () => {
  it("returns success with billing overview data (plan as object)", async () => {
    const billingData = {
      organization_id: ORG_ID,
      plan_id: "plan-1",
      enabled_modules: ["warehouse"],
      limits: { max_branches: 3 },
      updated_at: "2026-01-01T00:00:00Z",
      subscription_plans: { name: "Starter" },
    };
    const chain = makeChain({ data: billingData, error: null });
    const supabase = makeSupabase(chain);

    const result = await OrgBillingService.getBillingOverview(supabase as any, ORG_ID);

    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> }).data;
    expect(data.plan_name).toBe("Starter");
    expect(data.enabled_modules).toEqual(["warehouse"]);
    expect(data.limits).toEqual({ max_branches: 3 });
  });

  it("returns success when subscription_plans is an array", async () => {
    const billingData = {
      organization_id: ORG_ID,
      plan_id: "plan-1",
      enabled_modules: [],
      limits: {},
      updated_at: "2026-01-01T00:00:00Z",
      subscription_plans: [{ name: "Pro" }],
    };
    const chain = makeChain({ data: billingData, error: null });
    const supabase = makeSupabase(chain);

    const result = await OrgBillingService.getBillingOverview(supabase as any, ORG_ID);

    expect(result.success).toBe(true);
    expect((result as { success: true; data: Record<string, unknown> }).data.plan_name).toBe("Pro");
  });

  it("returns success with empty plan name when subscription_plans is null", async () => {
    const billingData = {
      organization_id: ORG_ID,
      plan_id: null,
      enabled_modules: [],
      limits: {},
      updated_at: "2026-01-01T00:00:00Z",
      subscription_plans: null,
    };
    const chain = makeChain({ data: billingData, error: null });
    const supabase = makeSupabase(chain);

    const result = await OrgBillingService.getBillingOverview(supabase as any, ORG_ID);

    expect(result.success).toBe(true);
    expect((result as { success: true; data: Record<string, unknown> }).data.plan_name).toBe("");
  });

  it("returns failure when entitlements not found (data is null)", async () => {
    const chain = makeChain({ data: null, error: null });
    const supabase = makeSupabase(chain);

    const result = await OrgBillingService.getBillingOverview(supabase as any, ORG_ID);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      "Entitlements not found for organization"
    );
  });

  it("returns failure when DB query errors", async () => {
    const chain = makeChain({ data: null, error: { message: "permission denied" } });
    const supabase = makeSupabase(chain);

    const result = await OrgBillingService.getBillingOverview(supabase as any, ORG_ID);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("permission denied");
  });

  it("returns empty arrays and objects when enabled_modules and limits are null", async () => {
    const billingData = {
      organization_id: ORG_ID,
      plan_id: "plan-1",
      enabled_modules: null,
      limits: null,
      updated_at: "2026-01-01T00:00:00Z",
      subscription_plans: { name: "Free" },
    };
    const chain = makeChain({ data: billingData, error: null });
    const supabase = makeSupabase(chain);

    const result = await OrgBillingService.getBillingOverview(supabase as any, ORG_ID);

    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> }).data;
    expect(data.enabled_modules).toEqual([]);
    expect(data.limits).toEqual({});
  });
});
