/**
 * @vitest-environment node
 * Tests: src/app/actions/onboarding/index.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetUser, mockFrom, mockRpc, mockEventEmit, mockCreateClient } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockEventEmit: vi.fn(),
  mockCreateClient: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/server/services/event.service", () => ({
  eventService: { emit: mockEventEmit },
}));

import { getAvailablePlansAction, checkOrgSlugAction, createOrganizationAction } from "../index";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetCreateClient() {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetCreateClient();
  mockEventEmit.mockResolvedValue({ success: true });
});

// ─── Fluent chain builder ─────────────────────────────────────────────────────

function makeChain(result: unknown) {
  const node: Record<string, unknown> = {};
  ["select", "eq", "is", "order", "limit", "in"].forEach((m) => {
    node[m] = vi.fn().mockReturnValue(node);
  });
  node.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  node.maybeSingle = vi.fn().mockResolvedValue(result);
  node.single = vi.fn().mockResolvedValue(result);
  return node;
}

// ─── getAvailablePlansAction ──────────────────────────────────────────────────

describe("getAvailablePlansAction", () => {
  it("returns mapped plans on success", async () => {
    const rawPlans = [
      {
        id: "plan-1",
        name: "starter",
        price_monthly: "9.99",
        price_yearly: "99.99",
        limits: { "warehouse.max_branches": 3, "organization.max_users": 10 },
        enabled_modules: ["warehouse"],
      },
    ];
    mockFrom.mockReturnValue(makeChain({ data: rawPlans, error: null }));

    const result = await getAvailablePlansAction();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("starter");
    expect(result[0].display_name).toBe("Starter");
    expect(result[0].price_monthly_cents).toBe(999);
    expect(result[0].price_yearly_cents).toBe(9999);
    expect(result[0].max_branches).toBe(3);
    expect(result[0].max_members).toBe(10);
    expect(result[0].enabled_modules).toEqual(["warehouse"]);
  });

  it("returns [] on DB error", async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: "db fail" } }));

    const result = await getAvailablePlansAction();
    expect(result).toEqual([]);
  });

  it("returns [] when data is null", async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));

    const result = await getAvailablePlansAction();
    expect(result).toEqual([]);
  });

  it("uses -1 for missing limit values", async () => {
    const rawPlans = [
      {
        id: "plan-2",
        name: "free",
        price_monthly: "0",
        price_yearly: "0",
        limits: {},
        enabled_modules: [],
      },
    ];
    mockFrom.mockReturnValue(makeChain({ data: rawPlans, error: null }));

    const result = await getAvailablePlansAction();
    expect(result[0].max_branches).toBe(-1);
    expect(result[0].max_members).toBe(-1);
    expect(result[0].max_storage_mb).toBe(-1);
  });

  it("handles non-array enabled_modules gracefully", async () => {
    const rawPlans = [
      {
        id: "plan-3",
        name: "basic",
        price_monthly: "5",
        price_yearly: "50",
        limits: {},
        enabled_modules: null,
      },
    ];
    mockFrom.mockReturnValue(makeChain({ data: rawPlans, error: null }));

    const result = await getAvailablePlansAction();
    expect(result[0].enabled_modules).toEqual([]);
  });
});

// ─── checkOrgSlugAction ───────────────────────────────────────────────────────

describe("checkOrgSlugAction", () => {
  it("returns { available: false } for empty slug", async () => {
    expect(await checkOrgSlugAction("")).toEqual({ available: false });
  });

  it("returns { available: false } for slug shorter than 2 chars", async () => {
    expect(await checkOrgSlugAction("a")).toEqual({ available: false });
  });

  it("returns { available: false } for slug with uppercase letters", async () => {
    expect(await checkOrgSlugAction("MyOrg")).toEqual({ available: false });
  });

  it("returns { available: false } for slug with spaces", async () => {
    expect(await checkOrgSlugAction("my org")).toEqual({ available: false });
  });

  it("returns { available: true } when RPC returns true", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    expect(await checkOrgSlugAction("my-org")).toEqual({ available: true });
  });

  it("returns { available: false } when RPC returns false", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    expect(await checkOrgSlugAction("taken-slug")).toEqual({ available: false });
  });

  it("returns { available: false } on RPC error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "rpc error" } });
    expect(await checkOrgSlugAction("my-org")).toEqual({ available: false });
  });
});

// ─── createOrganizationAction ─────────────────────────────────────────────────

describe("createOrganizationAction", () => {
  it("returns success with organizationId on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRpc.mockResolvedValue({
      data: { success: true, organization_id: "org-123", already_existed: false },
      error: null,
    });

    const result = await createOrganizationAction("Acme", "HQ", "plan-1");

    expect(result).toEqual({
      success: true,
      organizationId: "org-123",
      alreadyExisted: false,
    });
  });

  it("emits org.created and org.onboarding.completed events on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRpc.mockResolvedValue({
      data: { success: true, organization_id: "org-123" },
      error: null,
    });

    await createOrganizationAction("Acme", "HQ", null);

    expect(mockEventEmit).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = mockEventEmit.mock.calls;
    expect(firstCall[0].actionKey).toBe("org.created");
    expect(secondCall[0].actionKey).toBe("org.onboarding.completed");
  });

  it("returns failure when RPC call fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "rpc failed" },
    });

    const result = await createOrganizationAction("Acme", "HQ", null);

    expect(result).toEqual({ success: false, error: "rpc failed" });
  });

  it("returns failure when RPC result.success is false", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRpc.mockResolvedValue({
      data: { success: false, error: "Org name taken" },
      error: null,
    });

    const result = await createOrganizationAction("Taken Org", "HQ", null);

    expect(result).toEqual({ success: false, error: "Org name taken" });
  });

  it("returns failure with 'Unknown error' when rpc result has no error message", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRpc.mockResolvedValue({
      data: { success: false },
      error: null,
    });

    const result = await createOrganizationAction("Org", "HQ", null);

    expect(result).toEqual({ success: false, error: "Unknown error" });
  });

  it("skips event emission when user session unavailable", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockRpc.mockResolvedValue({
      data: { success: true, organization_id: "org-123" },
      error: null,
    });

    const result = await createOrganizationAction("Acme", "HQ", null);

    // Success still returned but no events emitted
    expect(result.success).toBe(true);
    expect(mockEventEmit).not.toHaveBeenCalled();
  });

  it("still returns success even when event emission fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRpc.mockResolvedValue({
      data: { success: true, organization_id: "org-123" },
      error: null,
    });
    mockEventEmit.mockResolvedValue({ success: false, error: "event failed" });

    const result = await createOrganizationAction("Acme", "HQ", null);

    expect(result.success).toBe(true);
    expect((result as { success: true; organizationId: string }).organizationId).toBe("org-123");
  });

  it("passes trimmed orgName, branchName, orgSlug to RPC", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRpc.mockResolvedValue({
      data: { success: true, organization_id: "org-123" },
      error: null,
    });

    await createOrganizationAction("  Acme  ", "  HQ  ", null, null, "  my-slug  ");

    expect(mockRpc).toHaveBeenCalledWith(
      "create_organization_for_current_user",
      expect.objectContaining({
        p_name: "Acme",
        p_branch_name: "HQ",
        p_slug: "my-slug",
      })
    );
  });

  it("sets alreadyExisted to true when RPC returns already_existed=true", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRpc.mockResolvedValue({
      data: { success: true, organization_id: "org-existing", already_existed: true },
      error: null,
    });

    const result = await createOrganizationAction("Acme", "HQ", null);
    expect(result).toMatchObject({ success: true, alreadyExisted: true });
  });
});
