/**
 * @vitest-environment node
 *
 * Tests: src/server/loaders/v2/load-app-context.v2.ts
 *
 * Strategy: mock createClient and resolveActiveBranch; test all major paths
 * through org/branch resolution logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ──────────────────────────────────────────────────────────────

const { mockGetUser, mockFrom, mockResolveActiveBranch } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockResolveActiveBranch: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

vi.mock("@repo/domain/branch", () => ({
  resolveActiveBranch: mockResolveActiveBranch,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

import { loadAppContextV2 } from "../load-app-context.v2";

// ─── Query chain factory ──────────────────────────────────────────────────────
// Creates a chainable mock that resolves to `result` at any terminal method.

function chain(result: unknown) {
  const node: Record<string, unknown> = {};
  const terminal = vi.fn().mockResolvedValue(result);
  ["select", "eq", "in", "is", "order", "limit", "neq"].forEach((m) => {
    node[m] = vi.fn().mockReturnValue(node);
  });
  node["maybeSingle"] = terminal;
  // For non-maybeSingle terminals (branches query returns array directly via await)
  // Make the chain itself thenable for array responses
  node["then"] = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return node;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = "user-1";
const ORG_ID = "org-123";
const BRANCH_ID = "branch-456";

const AUTH_USER = { id: USER_ID };

const ORG_SNAPSHOT = {
  id: ORG_ID,
  name: "Test Org",
  slug: "test-org",
  organization_profiles: {
    name: "Test Org Profile",
    name_2: null,
    slug: "test-org",
    logo_url: null,
  },
};

const BRANCH_1 = {
  id: BRANCH_ID,
  name: "Main",
  organization_id: ORG_ID,
  slug: "main",
  created_at: "2024-01-01T00:00:00Z",
};
const BRANCH_2 = {
  id: "branch-789",
  name: "Secondary",
  organization_id: ORG_ID,
  slug: "secondary",
  created_at: "2024-01-02T00:00:00Z",
};

// ─── Mock setup helpers ───────────────────────────────────────────────────────

/**
 * Set up `mockFrom` to respond per table. Each key is a table name → chain result.
 * Tables called multiple times (organizations) can be provided as arrays of results.
 */
function setupFrom(
  tables: Record<string, unknown | unknown[]>,
  arrayCounts: Record<string, number> = {}
) {
  const callCounts: Record<string, number> = {};
  mockFrom.mockImplementation((table: string) => {
    callCounts[table] = (callCounts[table] ?? 0) + 1;
    const spec = tables[table];
    if (Array.isArray(spec) && !("id" in spec)) {
      // It's an array of sequential results
      const idx = (callCounts[table] ?? 1) - 1;
      return chain((spec as unknown[])[idx] ?? null);
    }
    return chain(spec);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("loadAppContextV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveActiveBranch.mockImplementation((prefBranchId: string | null, ids: string[]) =>
      prefBranchId && ids.includes(prefBranchId) ? prefBranchId : (ids[0] ?? null)
    );
  });

  // ── Auth guards ────────────────────────────────────────────────────────────

  it("returns null when auth fails (error)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "JWT invalid" } });
    const result = await loadAppContextV2();
    expect(result).toBeNull();
  });

  it("returns null when user is null (unauthenticated)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await loadAppContextV2();
    expect(result).toBeNull();
  });

  // ── No org found paths ─────────────────────────────────────────────────────

  it("returns context with null activeOrgId when no org found at all", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    // user_preferences: no org pref
    // user_role_assignments: no assignments
    // organizations (created_by): none
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences")
        return chain({ data: { organization_id: null, default_branch_id: null }, error: null });
      if (table === "user_role_assignments") return chain({ data: [], error: null });
      if (table === "organizations") return chain({ data: null, error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    expect(result).not.toBeNull();
    expect(result!.activeOrgId).toBeNull();
    expect(result!.activeOrg).toBeNull();
    expect(result!.availableBranches).toEqual([]);
  });

  it("returns null activeOrgId when preferences are missing entirely", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") return chain({ data: null, error: null });
      if (table === "user_role_assignments") return chain({ data: [], error: null });
      if (table === "organizations") return chain({ data: null, error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    expect(result!.activeOrgId).toBeNull();
  });

  // ── Org resolution via preferences ────────────────────────────────────────

  it("resolves activeOrgId from preferences.organization_id when valid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });

    const orgCalls: number[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences")
        return chain({
          data: { organization_id: ORG_ID, default_branch_id: BRANCH_ID },
          error: null,
        });

      if (table === "organizations") {
        orgCalls.push(orgCalls.length + 1);
        const callIdx = orgCalls.length;
        if (callIdx === 1) return chain({ data: { id: ORG_ID }, error: null }); // pref validation
        if (callIdx === 2) return chain({ data: ORG_SNAPSHOT, error: null }); // full snapshot
        return chain({ data: null, error: null });
      }
      if (table === "branches") return chain({ data: [BRANCH_1], error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    expect(result!.activeOrgId).toBe(ORG_ID);
    expect(result!.activeOrg?.id).toBe(ORG_ID);
    expect(result!.activeOrg?.name).toBe("Test Org Profile");
  });

  it("falls back to null org when preferences.organization_id is deleted/invalid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences")
        return chain({
          data: { organization_id: "deleted-org", default_branch_id: null },
          error: null,
        });
      if (table === "organizations") return chain({ data: null, error: null }); // validation returns null
      if (table === "user_role_assignments") return chain({ data: [], error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    expect(result!.activeOrgId).toBeNull();
  });

  // ── Org resolution via member role assignments (fallback 1) ───────────────

  it("falls back to oldest member org when preferences have no org", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });

    const orgCalls: number[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences")
        return chain({ data: { organization_id: null, default_branch_id: null }, error: null });
      if (table === "user_role_assignments")
        return chain({ data: [{ scope_id: ORG_ID }, { scope_id: ORG_ID }], error: null });
      if (table === "organizations") {
        orgCalls.push(1);
        const idx = orgCalls.length;
        if (idx === 1) return chain({ data: { id: ORG_ID }, error: null }); // oldest member org
        if (idx === 2) return chain({ data: ORG_SNAPSHOT, error: null }); // full snapshot
        return chain({ data: null, error: null });
      }
      if (table === "branches") return chain({ data: [BRANCH_1], error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    expect(result!.activeOrgId).toBe(ORG_ID);
  });

  it("deduplicates org IDs from role assignments before querying", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    // 3 assignments, all same org_id — should deduplicate to [ORG_ID]
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") return chain({ data: null, error: null });
      if (table === "user_role_assignments")
        return chain({
          data: [{ scope_id: ORG_ID }, { scope_id: ORG_ID }, { scope_id: ORG_ID }],
          error: null,
        });
      if (table === "organizations") return chain({ data: { id: ORG_ID }, error: null });
      if (table === "branches") return chain({ data: [], error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    expect(result!.activeOrgId).toBe(ORG_ID);
  });

  it("skips member fallback when role assignments are empty, tries created_by fallback", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });

    const orgCalls: number[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") return chain({ data: null, error: null });
      if (table === "user_role_assignments") return chain({ data: [], error: null });
      if (table === "organizations") {
        orgCalls.push(1);
        const idx = orgCalls.length;
        if (idx === 1) return chain({ data: { id: ORG_ID }, error: null }); // created_by query
        if (idx === 2) return chain({ data: ORG_SNAPSHOT, error: null }); // full snapshot
        return chain({ data: null, error: null });
      }
      if (table === "branches") return chain({ data: [BRANCH_1], error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    expect(result!.activeOrgId).toBe(ORG_ID);
  });

  // ── Org snapshot: profile as array vs object ───────────────────────────────

  it("handles organization_profiles returned as array", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });

    const profileArrayOrg = {
      id: ORG_ID,
      name: "Fallback Name",
      slug: "fallback-slug",
      organization_profiles: [
        { name: "Profile Name", name_2: "Alt", slug: "profile-slug", logo_url: "http://img" },
      ],
    };

    const orgCalls: number[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences")
        return chain({ data: { organization_id: ORG_ID, default_branch_id: null }, error: null });
      if (table === "organizations") {
        orgCalls.push(1);
        const idx = orgCalls.length;
        if (idx === 1) return chain({ data: { id: ORG_ID }, error: null });
        if (idx === 2) return chain({ data: profileArrayOrg, error: null });
        return chain({ data: null, error: null });
      }
      if (table === "branches") return chain({ data: [], error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    expect(result!.activeOrg?.name).toBe("Profile Name");
    expect(result!.activeOrg?.name_2).toBe("Alt");
    expect(result!.activeOrg?.logo_url).toBe("http://img");
  });

  it("falls back to org name/slug when no profile data", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });

    const noProfileOrg = {
      id: ORG_ID,
      name: "Org Direct Name",
      slug: "org-slug",
      organization_profiles: null,
    };

    const orgCalls: number[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences")
        return chain({ data: { organization_id: ORG_ID, default_branch_id: null }, error: null });
      if (table === "organizations") {
        orgCalls.push(1);
        const idx = orgCalls.length;
        if (idx === 1) return chain({ data: { id: ORG_ID }, error: null });
        if (idx === 2) return chain({ data: noProfileOrg, error: null });
        return chain({ data: null, error: null });
      }
      if (table === "branches") return chain({ data: [], error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    expect(result!.activeOrg?.name).toBe("Org Direct Name");
    expect(result!.activeOrg?.slug).toBe("org-slug");
  });

  // ── Branch resolution ──────────────────────────────────────────────────────

  it("resolves activeBranch from preferences.default_branch_id when valid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    mockResolveActiveBranch.mockReturnValue(BRANCH_ID);

    const orgCalls: number[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences")
        return chain({
          data: { organization_id: ORG_ID, default_branch_id: BRANCH_ID },
          error: null,
        });
      if (table === "organizations") {
        orgCalls.push(1);
        return chain(
          orgCalls.length === 1
            ? { data: { id: ORG_ID }, error: null }
            : { data: ORG_SNAPSHOT, error: null }
        );
      }
      if (table === "branches") return chain({ data: [BRANCH_1, BRANCH_2], error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    expect(result!.activeBranchId).toBe(BRANCH_ID);
    expect(result!.activeBranch?.id).toBe(BRANCH_ID);
    expect(mockResolveActiveBranch).toHaveBeenCalledWith(BRANCH_ID, [BRANCH_ID, BRANCH_2.id]);
  });

  it("falls back to first branch when pref branch_id is stale/invalid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    // resolveActiveBranch returns first branch when pref not in list
    mockResolveActiveBranch.mockReturnValue(BRANCH_1.id);

    const orgCalls: number[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences")
        return chain({
          data: { organization_id: ORG_ID, default_branch_id: "stale-id" },
          error: null,
        });
      if (table === "organizations") {
        orgCalls.push(1);
        return chain(
          orgCalls.length === 1
            ? { data: { id: ORG_ID }, error: null }
            : { data: ORG_SNAPSHOT, error: null }
        );
      }
      if (table === "branches") return chain({ data: [BRANCH_1], error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    expect(result!.activeBranchId).toBe(BRANCH_1.id);
    expect(result!.activeBranch?.id).toBe(BRANCH_1.id);
  });

  it("returns null activeBranch when no branches available", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    mockResolveActiveBranch.mockReturnValue(null);

    const orgCalls: number[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences")
        return chain({ data: { organization_id: ORG_ID, default_branch_id: null }, error: null });
      if (table === "organizations") {
        orgCalls.push(1);
        return chain(
          orgCalls.length === 1
            ? { data: { id: ORG_ID }, error: null }
            : { data: ORG_SNAPSHOT, error: null }
        );
      }
      if (table === "branches") return chain({ data: [], error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    expect(result!.activeBranchId).toBeNull();
    expect(result!.activeBranch).toBeNull();
    expect(result!.availableBranches).toEqual([]);
  });

  it("maps branch data fields correctly", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    mockResolveActiveBranch.mockReturnValue(BRANCH_1.id);

    const orgCalls: number[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences")
        return chain({
          data: { organization_id: ORG_ID, default_branch_id: BRANCH_1.id },
          error: null,
        });
      if (table === "organizations") {
        orgCalls.push(1);
        return chain(
          orgCalls.length === 1
            ? { data: { id: ORG_ID }, error: null }
            : { data: ORG_SNAPSHOT, error: null }
        );
      }
      if (table === "branches") return chain({ data: [BRANCH_1, BRANCH_2], error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    expect(result!.availableBranches).toHaveLength(2);
    expect(result!.availableBranches[0]).toEqual({
      id: BRANCH_1.id,
      name: BRANCH_1.name,
      organization_id: BRANCH_1.organization_id,
      slug: BRANCH_1.slug,
      created_at: BRANCH_1.created_at,
    });
  });

  // ── Return shape ───────────────────────────────────────────────────────────

  it("always returns empty userModules (module system is registry-driven)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") return chain({ data: null, error: null });
      if (table === "user_role_assignments") return chain({ data: [], error: null });
      if (table === "organizations") return chain({ data: null, error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    expect(result!.userModules).toEqual([]);
  });

  it("always returns empty accessibleBranches (computed by loadDashboardContextV2)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") return chain({ data: null, error: null });
      if (table === "user_role_assignments") return chain({ data: [], error: null });
      if (table === "organizations") return chain({ data: null, error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    expect(result!.accessibleBranches).toEqual([]);
  });

  // ── Error tolerance ────────────────────────────────────────────────────────

  it("tolerates preferences query error and continues", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences")
        return chain({ data: null, error: { message: "RLS violation" } });
      if (table === "user_role_assignments") return chain({ data: [], error: null });
      if (table === "organizations") return chain({ data: null, error: null });
      return chain({ data: null, error: null });
    });

    // Should not throw, just return context with null org
    const result = await loadAppContextV2();
    expect(result).not.toBeNull();
    expect(result!.activeOrgId).toBeNull();
  });

  it("tolerates role assignments query error and tries created_by fallback", async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    const orgCalls: number[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_preferences") return chain({ data: null, error: null });
      if (table === "user_role_assignments")
        return chain({ data: null, error: { message: "error" } });
      if (table === "organizations") {
        orgCalls.push(1);
        return chain(
          orgCalls.length === 1
            ? { data: { id: ORG_ID }, error: null }
            : { data: ORG_SNAPSHOT, error: null }
        );
      }
      if (table === "branches") return chain({ data: [], error: null });
      return chain({ data: null, error: null });
    });

    const result = await loadAppContextV2();
    // role assignments error → data is null → orgIds empty → skip → falls through to created_by
    expect(result!.activeOrgId).toBe(ORG_ID);
  });
});
