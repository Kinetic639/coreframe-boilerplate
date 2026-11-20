/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRpc, mockGetSession, mockGetAuthUser, cookieJar } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetSession: vi.fn(),
  mockGetAuthUser: vi.fn(),
  cookieJar: new Map<string, string>(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => cookieJar.set(name, value),
  })),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    rpc: mockRpc,
    auth: { getSession: mockGetSession },
  }),
}));
vi.mock("@/server/auth/get-auth-user", () => ({ getAuthUser: mockGetAuthUser }));
vi.mock("@/server/storage/avatar-signed-url", () => ({
  getSignedAvatarUrl: vi.fn(async (_id: string, path: string) => `signed:${path}`),
}));
vi.mock("@/server/services/auth.service", () => ({
  AuthService: { getUserRoles: vi.fn(() => [{ role: "member" }]) },
}));

import {
  loadDashboardContextFromRpc,
  buildDashboardContextFromRpc,
  __resetDashboardContextRpcState,
  bumpDashboardContextVersion,
  CONTEXT_TTL_MS,
  CONTEXT_VERSION_COOKIE,
  type DashboardContextRpcPayload,
} from "../load-dashboard-context-rpc.v2";

const AUTH_USER = { id: "user-1", email: "u@example.com", user_metadata: {} };

function branch(id: string, created_at: string) {
  return {
    id,
    name: id,
    organization_id: "org-1",
    branch_number: 1,
    slug: id,
    public_warehouse_maps_enabled: null,
    created_at,
  };
}

function payload(overrides: Partial<DashboardContextRpcPayload> = {}): DashboardContextRpcPayload {
  return {
    preferences: { organization_id: "org-1", default_branch_id: "b-2" },
    active_org_id: "org-1",
    org: {
      id: "org-1",
      name: "Org",
      slug: "org",
      profile: { name: "Profile name", name_2: null, slug: "profile-slug", logo_url: null },
    },
    branches: [branch("b-1", "2024-01-01"), branch("b-2", "2024-01-02")],
    user: {
      id: "user-1",
      email: "u@example.com",
      first_name: "Ala",
      last_name: "Kot",
      avatar_url: null,
      avatar_path: "user-1/a.png",
    },
    org_permissions: ["branches.view.any", "planning.tasks.read"],
    branch_permissions: { "b-2": ["warehouse.read", "planning.tasks.read"], "b-1": ["x.only.b1"] },
    branch_assignment_ids: [],
    ...overrides,
  };
}

describe("buildDashboardContextFromRpc", () => {
  it("uses the preferred branch and merges org and branch permissions", async () => {
    const ctx = await buildDashboardContextFromRpc(payload(), AUTH_USER, "token");

    expect(ctx.app.activeOrgId).toBe("org-1");
    expect(ctx.app.activeOrg).toEqual({
      id: "org-1",
      name: "Profile name",
      name_2: null,
      slug: "profile-slug",
      logo_url: null,
    });
    expect(ctx.app.activeBranchId).toBe("b-2");
    expect(ctx.app.availableBranches.map((b) => b.id)).toEqual(["b-1", "b-2"]);
    expect(ctx.app.accessibleBranches.map((b) => b.id)).toEqual(["b-1", "b-2"]);
    expect(ctx.app.availableBranches[0].public_warehouse_maps_enabled).toBe(false);
    expect(ctx.user.permissionSnapshot).toEqual({
      allow: ["branches.view.any", "planning.tasks.read", "warehouse.read"],
      deny: [],
    });
    expect(ctx.user.user?.avatar_signed_url).toBe("signed:user-1/a.png");
    expect(ctx.user.roles).toEqual([{ role: "member" }]);
  });

  it("falls back to the first branch when the preferred one is gone", async () => {
    const ctx = await buildDashboardContextFromRpc(
      payload({ preferences: { organization_id: "org-1", default_branch_id: "deleted" } }),
      AUTH_USER,
      "token"
    );
    expect(ctx.app.activeBranchId).toBe("b-1");
    expect(ctx.user.permissionSnapshot.allow).toContain("x.only.b1");
  });

  it("without branches.view.any, limits branches to assignments and re-picks the branch", async () => {
    const ctx = await buildDashboardContextFromRpc(
      payload({ org_permissions: ["planning.tasks.read"], branch_assignment_ids: ["b-1"] }),
      AUTH_USER,
      "token"
    );
    expect(ctx.app.accessibleBranches.map((b) => b.id)).toEqual(["b-1"]);
    expect(ctx.app.activeBranchId).toBe("b-1");
    expect(ctx.app.activeBranch?.id).toBe("b-1");
    // The snapshot follows the branch finally chosen, not the preferred one
    expect(ctx.user.permissionSnapshot.allow).toEqual(["planning.tasks.read", "x.only.b1"]);
  });

  it("returns no branch when nothing is accessible", async () => {
    const ctx = await buildDashboardContextFromRpc(
      payload({ org_permissions: [], branch_permissions: {}, branch_assignment_ids: [] }),
      AUTH_USER,
      "token"
    );
    expect(ctx.app.accessibleBranches).toEqual([]);
    expect(ctx.app.activeBranchId).toBeNull();
    expect(ctx.app.activeBranch).toBeNull();
    expect(ctx.user.permissionSnapshot).toEqual({ allow: [], deny: [] });
  });

  it("handles a user without an organization", async () => {
    const ctx = await buildDashboardContextFromRpc(
      payload({
        active_org_id: null,
        org: null,
        branches: [],
        org_permissions: [],
        branch_permissions: {},
      }),
      AUTH_USER,
      "token"
    );
    expect(ctx.app.activeOrgId).toBeNull();
    expect(ctx.app.activeOrg).toBeNull();
    expect(ctx.app.activeBranchId).toBeNull();
    expect(ctx.user.permissionSnapshot).toEqual({ allow: [], deny: [] });
  });

  it("falls back to session metadata when the users row is missing", async () => {
    const ctx = await buildDashboardContextFromRpc(
      payload({ user: null }),
      { id: "user-1", email: "u@example.com", user_metadata: { first_name: "Jan" } },
      "token"
    );
    expect(ctx.user.user).toEqual({
      id: "user-1",
      email: "u@example.com",
      first_name: "Jan",
      last_name: null,
      avatar_url: null,
      avatar_signed_url: null,
    });
  });
});

describe("loadDashboardContextFromRpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    cookieJar.clear();
    __resetDashboardContextRpcState();
    mockGetAuthUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
  });

  it("makes one RPC call and builds the context", async () => {
    mockRpc.mockResolvedValue({ data: payload(), error: null });

    const ctx = await loadDashboardContextFromRpc();

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("get_dashboard_context_v2");
    expect(ctx?.app.activeBranchId).toBe("b-2");
  });

  it("returns null without a session", async () => {
    mockGetAuthUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await loadDashboardContextFromRpc()).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns undefined (fall back) on an RPC error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockRpc.mockResolvedValue({ data: null, error: { code: "57014", message: "timeout" } });
    expect(await loadDashboardContextFromRpc()).toBeUndefined();
    spy.mockRestore();
  });

  it("stops asking once the function is missing", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } });

    expect(await loadDashboardContextFromRpc()).toBeUndefined();
    expect(await loadDashboardContextFromRpc()).toBeUndefined();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  describe("short cache across requests", () => {
    it("requests close together share one RPC call", async () => {
      mockRpc.mockResolvedValue({ data: payload(), error: null });

      const [a, b] = await Promise.all([
        loadDashboardContextFromRpc(),
        loadDashboardContextFromRpc(),
      ]);
      const c = await loadDashboardContextFromRpc();

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(a?.app.activeBranchId).toBe("b-2");
      expect(b).toBe(a);
      expect(c).toBe(a);
    });

    it("asks again after the entry expires", async () => {
      vi.useFakeTimers();
      mockRpc.mockResolvedValue({ data: payload(), error: null });

      await loadDashboardContextFromRpc();
      vi.advanceTimersByTime(CONTEXT_TTL_MS + 1);
      await loadDashboardContextFromRpc();

      expect(mockRpc).toHaveBeenCalledTimes(2);
    });

    it("a new context version (branch switch) misses the cache", async () => {
      mockRpc.mockResolvedValue({ data: payload(), error: null });

      await loadDashboardContextFromRpc();
      await bumpDashboardContextVersion("user-1");
      expect(cookieJar.get(CONTEXT_VERSION_COOKIE)).toBeTruthy();
      await loadDashboardContextFromRpc();

      expect(mockRpc).toHaveBeenCalledTimes(2);
    });

    it("another user or another session never shares an entry", async () => {
      mockRpc.mockResolvedValue({ data: payload(), error: null });

      await loadDashboardContextFromRpc();
      mockGetSession.mockResolvedValue({ data: { session: { access_token: "other-token" } } });
      await loadDashboardContextFromRpc();
      mockGetAuthUser.mockResolvedValue({
        data: { user: { ...AUTH_USER, id: "user-2" } },
        error: null,
      });
      await loadDashboardContextFromRpc();

      expect(mockRpc).toHaveBeenCalledTimes(3);
    });

    it("does not keep a failed answer", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      mockRpc
        .mockResolvedValueOnce({ data: null, error: { code: "57014", message: "timeout" } })
        .mockResolvedValueOnce({ data: payload(), error: null });

      expect(await loadDashboardContextFromRpc()).toBeUndefined();
      expect((await loadDashboardContextFromRpc())?.app.activeBranchId).toBe("b-2");
      expect(mockRpc).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });
  });
});
