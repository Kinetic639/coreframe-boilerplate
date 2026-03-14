/**
 * @vitest-environment node
 *
 * T-FEED-ACTIONS: Verify the three audit feed server actions + query helpers.
 *
 * Covered:
 *   getPersonalActivityAction  — personal scope, org+org-null merge
 *   getOrgActivityAction       — org scope, requires org.read
 *   getAuditFeedAction         — audit scope, requires audit.events.read
 *   computeFetchLimit          — bounded fetch strategy
 *   validatePagination         — server-side input clamping
 *
 * Strategy:
 *   - loadDashboardContextV2 is mocked to return controlled context
 *   - supabase createClient (RLS path) mocked via mockFromChain
 *   - @supabase/service (service-role path) mocked via mockServiceFromChain
 *   - projectEvents called for real — row fixtures match registry visibility
 *   - Permission denial tested by configuring checkPermission to return false
 *
 * Boundary / security guarantees verified:
 *   - Personal feed includes eligible org-null self auth events
 *   - Unrelated org-null events (other user) are NOT leaked
 *   - ip/ua absent from personal and org scope results
 *   - ip/ua present in audit scope results
 *   - audit-only events not leaked into org scope
 *   - sensitive metadata stripped from personal/org scope
 *   - results are ProjectedEvent shapes, not raw PlatformEventRow shapes
 *   - unauthorized access blocked on org and audit actions
 *   - negative/oversized pagination inputs are clamped server-side
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Constants + mock helpers — vi.hoisted for availability in vi.mock factories
// ---------------------------------------------------------------------------

const { ORG_ID, USER_ID, OTHER_USER_ID, mockFromChain, mockServiceFromChain } = vi.hoisted(() => {
  const ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const OTHER_USER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  return {
    ORG_ID,
    USER_ID,
    OTHER_USER_ID,
    mockFromChain: vi.fn(),
    mockServiceFromChain: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// RLS-enforced path (org-scoped queries)
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: mockFromChain,
  }),
}));

// Service-role path (org-null personal auth events)
vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: vi.fn().mockReturnValue({
    from: mockServiceFromChain,
  }),
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: vi.fn().mockResolvedValue({
    app: { activeOrgId: ORG_ID },
    user: {
      user: { id: USER_ID },
      permissionSnapshot: {
        allow: ["org.*", "audit.events.read"],
        deny: [],
      },
    },
  }),
}));

vi.mock("@/lib/utils/permissions", () => ({
  checkPermission: vi.fn().mockReturnValue(true),
}));

// ---------------------------------------------------------------------------
// Static imports (after mocks)
// ---------------------------------------------------------------------------

import { checkPermission } from "@/lib/utils/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { getPersonalActivityAction } from "@/app/actions/audit/get-personal-activity";
import { getOrgActivityAction } from "@/app/actions/audit/get-org-activity";
import { getAuditFeedAction } from "@/app/actions/audit/get-audit-feed";
import { computeFetchLimit, validatePagination } from "@/app/actions/audit/_query";

// ---------------------------------------------------------------------------
// Row factories
// ---------------------------------------------------------------------------

/**
 * auth.login.failed — visibleTo: ["auditor"] — audit scope ONLY.
 * Carries ip_address/user_agent and a sensitive "email" field.
 */
function makeAuditOnlyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-audit-1",
    created_at: new Date().toISOString(),
    organization_id: ORG_ID,
    branch_id: null,
    actor_user_id: USER_ID,
    actor_type: "user",
    module_slug: "auth",
    action_key: "auth.login.failed",
    entity_type: "user",
    entity_id: "user@example.com",
    target_type: null,
    target_id: null,
    metadata: { email: "secret@example.com", reason: "invalid_password" },
    event_tier: "baseline",
    request_id: null,
    ip_address: "1.2.3.4",
    user_agent: "Mozilla/5.0",
    ...overrides,
  };
}

/**
 * auth.login — visibleTo: ["self","auditor"] — personal scope when actor=viewer.
 * org-scoped variant (organization_id = ORG_ID).
 */
function makePersonalRow(overrides: Record<string, unknown> = {}) {
  return {
    ...makeAuditOnlyRow({ id: "evt-personal-1" }),
    action_key: "auth.login",
    metadata: { email: "secret@example.com" },
    ...overrides,
  };
}

/**
 * auth.login with organization_id = null — global auth event, personal scope.
 * Fetched via service-role path.
 */
function makeOrgNullPersonalRow(overrides: Record<string, unknown> = {}) {
  return {
    ...makePersonalRow({ id: "evt-orgnull-1" }),
    organization_id: null,
    ...overrides,
  };
}

/**
 * org.created — visibleTo: ["org_member","org_admin","auditor"] — org scope.
 */
function makeOrgRow(overrides: Record<string, unknown> = {}) {
  return {
    ...makeAuditOnlyRow({ id: "evt-org-1" }),
    action_key: "org.created",
    module_slug: "org",
    entity_type: "organization",
    entity_id: ORG_ID,
    metadata: { org_name: "Test Org" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock chain helpers
// ---------------------------------------------------------------------------

/** Configure the RLS-client from() chain to resolve rows on .limit(). */
function mockFromReturning(rows: unknown[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  mockFromChain.mockReturnValue(chain);
  return chain;
}

/** Configure the RLS-client from() chain to resolve a DB error on .limit(). */
function mockFromError(message: string) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: null, error: { message } }),
  };
  mockFromChain.mockReturnValue(chain);
}

/** Configure the service-client from() chain (org-null path). */
function mockServiceFromReturning(rows: unknown[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  mockServiceFromChain.mockReturnValue(chain);
  return chain;
}

/** Configure the service-client from() chain to return a DB error. */
function mockServiceFromError(message: string) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: null, error: { message } }),
  };
  mockServiceFromChain.mockReturnValue(chain);
}

// ---------------------------------------------------------------------------
// T-FEED-QUERY-HELPER: computeFetchLimit
// ---------------------------------------------------------------------------

describe("T-FEED-QUERY-HELPER: computeFetchLimit", () => {
  it("returns at least offset + limit (no undercount)", () => {
    expect(computeFetchLimit(0, 50)).toBeGreaterThanOrEqual(50);
    expect(computeFetchLimit(50, 50)).toBeGreaterThanOrEqual(100);
  });

  it("applies the 2x buffer above offset + limit for typical requests", () => {
    expect(computeFetchLimit(0, 50)).toBe(100); // (0+50)*2 = 100
    expect(computeFetchLimit(100, 50)).toBe(300); // (100+50)*2 = 300
  });

  it("clamps at ABSOLUTE_CAP=500 for large page requests", () => {
    expect(computeFetchLimit(400, 50)).toBe(500); // (400+50)*2 = 900 → 500
    expect(computeFetchLimit(0, 300)).toBe(500); // (0+300)*2 = 600 → 500
  });

  it("never returns 0 or negative", () => {
    expect(computeFetchLimit(0, 1)).toBeGreaterThan(0);
    expect(computeFetchLimit(0, 50)).toBeGreaterThan(0);
  });

  it("returns correct minimum for edge case limit=1 offset=0", () => {
    expect(computeFetchLimit(0, 1)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// T-FEED-PAGINATION-VALIDATION: validatePagination
// ---------------------------------------------------------------------------

describe("T-FEED-PAGINATION-VALIDATION: validatePagination", () => {
  it("returns defaults for typical valid input", () => {
    const { limit, offset } = validatePagination(50, 0);
    expect(limit).toBe(50);
    expect(offset).toBe(0);
  });

  it("clamps negative offset to 0", () => {
    expect(validatePagination(50, -10).offset).toBe(0);
    expect(validatePagination(50, -1).offset).toBe(0);
  });

  it("clamps limit below 1 to 1", () => {
    expect(validatePagination(0, 0).limit).toBe(1);
    expect(validatePagination(-5, 0).limit).toBe(1);
  });

  it("clamps limit above MAX (50) to 50", () => {
    expect(validatePagination(100, 0).limit).toBe(50);
    expect(validatePagination(999, 0).limit).toBe(50);
  });

  it("accepts valid limit=1", () => {
    expect(validatePagination(1, 0).limit).toBe(1);
  });

  it("truncates fractional values", () => {
    expect(validatePagination(25.9, 10.7)).toEqual({ limit: 25, offset: 10 });
  });
});

// ---------------------------------------------------------------------------
// T-FEED-ACTIONS-PERSONAL: getPersonalActivityAction
// ---------------------------------------------------------------------------

describe("T-FEED-ACTIONS-PERSONAL: getPersonalActivityAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPermission).mockReturnValue(true);
  });

  it("returns success with org-scoped projected events on happy path", async () => {
    mockFromReturning([makePersonalRow()]);
    mockServiceFromReturning([]);
    const result = await getPersonalActivityAction(50, 0);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.events.length).toBe(1);
    expect(result.data.events[0].action_key).toBe("auth.login");
  });

  it("includes org-null self auth events merged with org-scoped events", async () => {
    const orgEvent = makePersonalRow({ id: "org-1", created_at: "2026-03-14T10:00:00Z" });
    const authEvent = makeOrgNullPersonalRow({ id: "null-1", created_at: "2026-03-14T11:00:00Z" });
    mockFromReturning([orgEvent]);
    mockServiceFromReturning([authEvent]);
    const result = await getPersonalActivityAction(50, 0);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("narrowing");
    // Both events project: auth.login has visibleTo: ["self","auditor"]
    expect(result.data.total).toBe(2);
    // Newer event (auth event at 11:00) should be first
    expect(result.data.events[0].id).toBe("null-1");
    expect(result.data.events[1].id).toBe("org-1");
  });

  it("[SECURITY] org-null event from another user is NOT included", async () => {
    // In production the service-role query filters actor_user_id = userId,
    // so the other user's event would never be returned by the DB.
    // Here we simulate the projection layer as a second line of defence:
    // a row with actor_user_id = OTHER_USER_ID would be filtered by the
    // personal-scope actor guard even if somehow returned.
    const otherUserEvent = makeOrgNullPersonalRow({
      id: "other-user-null",
      actor_user_id: OTHER_USER_ID,
    });
    mockFromReturning([]);
    mockServiceFromReturning([otherUserEvent]);
    const result = await getPersonalActivityAction(50, 0);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("narrowing");
    // Projection actor guard strips events not belonging to the viewer
    expect(result.data.total).toBe(0);
    expect(result.data.events).toHaveLength(0);
  });

  it("continues gracefully when org-null query fails (non-fatal)", async () => {
    mockFromReturning([makePersonalRow()]);
    mockServiceFromError("service unavailable");
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await getPersonalActivityAction(50, 0);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("narrowing");
    // Org-scoped events still returned
    expect(result.data.events.length).toBe(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[getPersonalActivityAction]"),
      expect.objectContaining({ error: "service unavailable" })
    );
    consoleSpy.mockRestore();
  });

  it("returns success with empty list when DB returns no rows from either source", async () => {
    mockFromReturning([]);
    mockServiceFromReturning([]);
    const result = await getPersonalActivityAction(50, 0);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.events).toHaveLength(0);
    expect(result.data.total).toBe(0);
  });

  it("returns failure when org-scoped DB errors", async () => {
    mockFromError("connection timeout");
    mockServiceFromReturning([]);
    const result = await getPersonalActivityAction(50, 0);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain(
      "Failed to load activity"
    );
  });

  it("returns failure when no active org", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValueOnce(null as any);
    const result = await getPersonalActivityAction(50, 0);
    expect(result.success).toBe(false);
  });

  it("respects pagination: returns correct slice", async () => {
    const rows = [makePersonalRow({ id: "e1" }), makePersonalRow({ id: "e2" })];
    mockFromReturning(rows);
    mockServiceFromReturning([]);
    const result = await getPersonalActivityAction(1, 0);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.events).toHaveLength(1);
    expect(result.data.total).toBe(2);
    expect(result.data.limit).toBe(1);
    expect(result.data.offset).toBe(0);
  });

  it("[PAGINATION] negative offset is clamped to 0", async () => {
    mockFromReturning([makePersonalRow()]);
    mockServiceFromReturning([]);
    const result = await getPersonalActivityAction(50, -10);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.offset).toBe(0);
  });

  it("[PAGINATION] oversized limit is clamped to 50", async () => {
    mockFromReturning([makePersonalRow()]);
    mockServiceFromReturning([]);
    const result = await getPersonalActivityAction(999, 0);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.limit).toBe(50);
  });

  // ------------------------------------------------------------------
  // Boundary / security guarantees
  // ------------------------------------------------------------------

  it("[BOUNDARY] ip_address is absent from projected personal events", async () => {
    mockFromReturning([makePersonalRow()]);
    mockServiceFromReturning([]);
    const result = await getPersonalActivityAction(50, 0);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.events[0].ip_address).toBeUndefined();
  });

  it("[BOUNDARY] user_agent is absent from projected personal events", async () => {
    mockFromReturning([makePersonalRow()]);
    mockServiceFromReturning([]);
    const result = await getPersonalActivityAction(50, 0);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.events[0].user_agent).toBeUndefined();
  });

  it("[BOUNDARY] sensitive field 'email' is stripped from personal scope metadata", async () => {
    mockFromReturning([makePersonalRow()]);
    mockServiceFromReturning([]);
    const result = await getPersonalActivityAction(50, 0);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.events[0].metadata).not.toHaveProperty("email");
  });

  it("[BOUNDARY] org-null auth event also has sensitive field stripped in personal scope", async () => {
    mockFromReturning([]);
    mockServiceFromReturning([makeOrgNullPersonalRow()]);
    const result = await getPersonalActivityAction(50, 0);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.events[0].metadata).not.toHaveProperty("email");
    expect(result.data.events[0].ip_address).toBeUndefined();
  });

  it("[BOUNDARY] projected events have ProjectedEvent shape, not raw PlatformEventRow shape", async () => {
    mockFromReturning([makePersonalRow()]);
    mockServiceFromReturning([]);
    const result = await getPersonalActivityAction(50, 0);
    if (!result.success) throw new Error("narrowing");
    const ev = result.data.events[0];
    expect(ev).toHaveProperty("actor_display");
    expect(ev).toHaveProperty("summary");
    expect(ev).not.toHaveProperty("actor_type");
    expect(ev).not.toHaveProperty("module_slug");
  });
});

// ---------------------------------------------------------------------------
// T-FEED-ACTIONS-ORG: getOrgActivityAction
// ---------------------------------------------------------------------------

describe("T-FEED-ACTIONS-ORG: getOrgActivityAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPermission).mockReturnValue(true);
  });

  it("returns success with projected events on happy path", async () => {
    mockFromReturning([makeOrgRow()]);
    const result = await getOrgActivityAction(50, 0);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.events.length).toBe(1);
    expect(result.data.events[0].action_key).toBe("org.created");
  });

  it("returns Unauthorized when checkPermission returns false", async () => {
    vi.mocked(checkPermission).mockReturnValue(false);
    const result = await getOrgActivityAction(50, 0);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns failure when DB errors", async () => {
    mockFromError("timeout");
    const result = await getOrgActivityAction(50, 0);
    expect(result.success).toBe(false);
  });

  it("returns failure when no active org", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValueOnce(null as any);
    const result = await getOrgActivityAction(50, 0);
    expect(result.success).toBe(false);
  });

  it("[PAGINATION] negative offset is clamped to 0", async () => {
    mockFromReturning([makeOrgRow()]);
    const result = await getOrgActivityAction(50, -5);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.offset).toBe(0);
  });

  it("[PAGINATION] oversized limit is clamped to 50", async () => {
    mockFromReturning([makeOrgRow()]);
    const result = await getOrgActivityAction(200, 0);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.limit).toBe(50);
  });

  // ------------------------------------------------------------------
  // Boundary / security guarantees
  // ------------------------------------------------------------------

  it("[BOUNDARY] ip_address is absent from projected org events", async () => {
    mockFromReturning([makeOrgRow()]);
    const result = await getOrgActivityAction(50, 0);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.events[0].ip_address).toBeUndefined();
  });

  it("[BOUNDARY] user_agent is absent from projected org events", async () => {
    mockFromReturning([makeOrgRow()]);
    const result = await getOrgActivityAction(50, 0);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.events[0].user_agent).toBeUndefined();
  });

  it("[BOUNDARY] audit-only event (auth.login.failed) is NOT leaked into org scope", async () => {
    mockFromReturning([makeAuditOnlyRow()]);
    const result = await getOrgActivityAction(50, 0);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.events).toHaveLength(0);
    expect(result.data.total).toBe(0);
  });

  it("[BOUNDARY] mix of visible and audit-only events: only visible ones returned", async () => {
    mockFromReturning([makeOrgRow(), makeAuditOnlyRow()]);
    const result = await getOrgActivityAction(50, 0);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.events).toHaveLength(1);
    expect(result.data.events[0].action_key).toBe("org.created");
  });
});

// ---------------------------------------------------------------------------
// T-FEED-ACTIONS-AUDIT: getAuditFeedAction
// ---------------------------------------------------------------------------

describe("T-FEED-ACTIONS-AUDIT: getAuditFeedAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPermission).mockReturnValue(true);
  });

  it("returns success with ip_address included in audit scope", async () => {
    mockFromReturning([makeAuditOnlyRow()]);
    const result = await getAuditFeedAction(50, 0);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.events.length).toBe(1);
    expect(result.data.events[0].ip_address).toBe("1.2.3.4");
    expect(result.data.events[0].user_agent).toBe("Mozilla/5.0");
  });

  it("returns Unauthorized when audit.events.read is denied", async () => {
    vi.mocked(checkPermission).mockReturnValue(false);
    const result = await getAuditFeedAction(50, 0);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns failure when DB errors", async () => {
    mockFromError("permission denied");
    const result = await getAuditFeedAction(50, 0);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain(
      "Failed to load audit feed"
    );
  });

  it("returns failure when no active org", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValueOnce(null as any);
    const result = await getAuditFeedAction(50, 0);
    expect(result.success).toBe(false);
  });

  it("respects pagination offset", async () => {
    const rows = [
      makeAuditOnlyRow({ id: "a" }),
      makeAuditOnlyRow({ id: "b" }),
      makeAuditOnlyRow({ id: "c" }),
    ];
    mockFromReturning(rows);
    const result = await getAuditFeedAction(2, 2);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.events).toHaveLength(1);
    expect(result.data.total).toBe(3);
    expect(result.data.offset).toBe(2);
  });

  it("[PAGINATION] negative offset is clamped to 0", async () => {
    mockFromReturning([makeAuditOnlyRow()]);
    const result = await getAuditFeedAction(50, -3);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.offset).toBe(0);
  });

  it("[PAGINATION] oversized limit is clamped to 50", async () => {
    mockFromReturning([makeAuditOnlyRow()]);
    const result = await getAuditFeedAction(500, 0);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.limit).toBe(50);
  });

  // ------------------------------------------------------------------
  // Boundary / security guarantees
  // ------------------------------------------------------------------

  it("[BOUNDARY] audit scope does NOT strip sensitive metadata fields", async () => {
    mockFromReturning([makeAuditOnlyRow()]);
    const result = await getAuditFeedAction(50, 0);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.events[0].metadata).toHaveProperty("email", "secret@example.com");
  });

  it("[BOUNDARY] all event types visible in audit scope including auditor-only ones", async () => {
    mockFromReturning([makeAuditOnlyRow(), makeOrgRow(), makePersonalRow()]);
    const result = await getAuditFeedAction(50, 0);
    if (!result.success) throw new Error("narrowing");
    expect(result.data.total).toBe(3);
  });

  it("[BOUNDARY] projected audit events have ProjectedEvent shape with ip/ua fields", async () => {
    mockFromReturning([makeAuditOnlyRow()]);
    const result = await getAuditFeedAction(50, 0);
    if (!result.success) throw new Error("narrowing");
    const ev = result.data.events[0];
    expect(ev).toHaveProperty("actor_display");
    expect(ev).toHaveProperty("summary");
    expect(ev).toHaveProperty("ip_address");
    expect(ev).toHaveProperty("user_agent");
    expect(ev).not.toHaveProperty("actor_type");
    expect(ev).not.toHaveProperty("module_slug");
  });
});
