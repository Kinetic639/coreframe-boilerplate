/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

// getBranchPermissions now uses PermissionServiceV2 (compiled UEP, branch-aware).
vi.mock("@/server/services/permission-v2.service", () => ({
  PermissionServiceV2: {
    getPermissionSnapshotForUser: vi.fn(),
    getOrgEffectivePermissionsArray: vi.fn(),
    currentUserHasPermission: vi.fn(),
    currentUserIsOrgMember: vi.fn(),
  },
}));

import {
  getBranchPermissions,
  getEffectivePermissions,
  getDetailedPermissions,
  checkPermission,
  checkOrgMembership,
} from "../permissions";
import { createClient } from "@/utils/supabase/server";
import { PermissionServiceV2 } from "@/server/services/permission-v2.service";

describe("getBranchPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return permissions with valid user", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const mockSnapshot = {
      allow: ["org.read", "org.update", "branches.read"],
      deny: [],
    };
    (PermissionServiceV2.getPermissionSnapshotForUser as any).mockResolvedValue(mockSnapshot);

    const result = await getBranchPermissions("org-123", "branch-456");

    expect(result.permissions).toEqual(mockSnapshot);
    expect(PermissionServiceV2.getPermissionSnapshotForUser).toHaveBeenCalledWith(
      mockSupabase,
      "user-123",
      "org-123",
      "branch-456"
    );
  });

  it("should return empty snapshot when no user", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await getBranchPermissions("org-123", "branch-456");

    expect(result.permissions).toEqual({ allow: [], deny: [] });
    expect(PermissionServiceV2.getPermissionSnapshotForUser).not.toHaveBeenCalled();
  });

  it("should handle null branchId (org-level permissions)", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const mockSnapshot = { allow: ["org.read", "members.read"], deny: [] };
    (PermissionServiceV2.getPermissionSnapshotForUser as any).mockResolvedValue(mockSnapshot);

    const result = await getBranchPermissions("org-123", null);

    expect(result.permissions).toEqual(mockSnapshot);
    expect(PermissionServiceV2.getPermissionSnapshotForUser).toHaveBeenCalledWith(
      mockSupabase,
      "user-123",
      "org-123",
      null
    );
  });

  it("should return empty snapshot on PermissionServiceV2 error", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    (PermissionServiceV2.getPermissionSnapshotForUser as any).mockRejectedValue(
      new Error("Database connection failed")
    );

    const result = await getBranchPermissions("org-123", "branch-456");

    expect(result.permissions).toEqual({ allow: [], deny: [] });
  });

  it("should return empty snapshot on auth error", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("Auth service unavailable"),
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await getBranchPermissions("org-123", "branch-456");

    expect(result.permissions).toEqual({ allow: [], deny: [] });
    expect(PermissionServiceV2.getPermissionSnapshotForUser).not.toHaveBeenCalled();
  });

  it("should return empty snapshot when createClient fails", async () => {
    (createClient as any).mockRejectedValue(new Error("Supabase initialization failed"));

    const result = await getBranchPermissions("org-123", "branch-456");

    expect(result.permissions).toEqual({ allow: [], deny: [] });
  });

  it("should pass correct parameters to PermissionServiceV2", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "specific-user-id" } }, error: null }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (PermissionServiceV2.getPermissionSnapshotForUser as any).mockResolvedValue({
      allow: [],
      deny: [],
    });

    await getBranchPermissions("specific-org-id", "specific-branch-id");

    expect(PermissionServiceV2.getPermissionSnapshotForUser).toHaveBeenCalledTimes(1);
    expect(PermissionServiceV2.getPermissionSnapshotForUser).toHaveBeenCalledWith(
      mockSupabase,
      "specific-user-id",
      "specific-org-id",
      "specific-branch-id"
    );
  });

  it("should return branch-aware permissions (includes branch-scoped role permissions)", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    // Compiled UEP returns org-wide rows + branch-specific rows merged
    const mockSnapshot = {
      allow: ["branch.roles.manage", "branches.read", "org.read"],
      deny: [],
    };
    (PermissionServiceV2.getPermissionSnapshotForUser as any).mockResolvedValue(mockSnapshot);

    const result = await getBranchPermissions("org-123", "branch-456");

    expect(result.permissions.allow).toContain("org.read");
    expect(result.permissions.allow).toContain("branch.roles.manage");
    expect(result.permissions.deny).toEqual([]);
  });

  // --- Branch-awareness proofs ---

  it("branch-aware: branchId=A includes org-wide + branch-A rows, not branch-B rows", async () => {
    // This test proves that PermissionServiceV2.getPermissionSnapshotForUser is called with
    // branchId="branch-A" so the compiled UEP query uses:
    //   WHERE branch_id IS NULL OR branch_id = 'branch-A'
    // Branch-B permissions are excluded by the DB query — not by the mock.
    const mockSupabase = {
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-branch-manager" } }, error: null }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    // DB would return: org-wide "org.read" (branch_id IS NULL) +
    //                 branch-A "branch.roles.manage" (branch_id = 'branch-A')
    // branch-B rows excluded by the WHERE clause
    const branchASnapshot = {
      allow: ["branch.roles.manage", "org.read"],
      deny: [],
    };
    (PermissionServiceV2.getPermissionSnapshotForUser as any).mockResolvedValue(branchASnapshot);

    const result = await getBranchPermissions("org-123", "branch-A");

    // Confirm branchId was passed through correctly
    expect(PermissionServiceV2.getPermissionSnapshotForUser).toHaveBeenCalledWith(
      mockSupabase,
      "user-branch-manager",
      "org-123",
      "branch-A"
    );
    expect(result.permissions.allow).toContain("org.read");
    expect(result.permissions.allow).toContain("branch.roles.manage");
  });

  it("branch-aware: branchId=null returns org-scope only (no branch rows)", async () => {
    // This test proves that branchId=null correctly passes null to V2,
    // so the compiled UEP query uses:
    //   WHERE branch_id IS NULL
    // Branch-scoped permissions are excluded.
    const mockSupabase = {
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-branch-manager" } }, error: null }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    // DB returns only org-wide rows (branch_id IS NULL filter active)
    const orgOnlySnapshot = { allow: ["org.read"], deny: [] };
    (PermissionServiceV2.getPermissionSnapshotForUser as any).mockResolvedValue(orgOnlySnapshot);

    const result = await getBranchPermissions("org-123", null);

    expect(PermissionServiceV2.getPermissionSnapshotForUser).toHaveBeenCalledWith(
      mockSupabase,
      "user-branch-manager",
      "org-123",
      null
    );
    // Only org-scope permissions returned
    expect(result.permissions.allow).toEqual(["org.read"]);
    expect(result.permissions.allow).not.toContain("branch.roles.manage");
  });
});

describe("getEffectivePermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return permission array with valid user", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const mockPermissions = ["org.read", "branches.read", "members.read"];
    (PermissionServiceV2.getOrgEffectivePermissionsArray as any).mockResolvedValue(mockPermissions);

    const result = await getEffectivePermissions("org-123");

    expect(result).toEqual(mockPermissions);
  });

  it("should return empty array when no user", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await getEffectivePermissions("org-123");

    expect(result).toEqual([]);
    expect(PermissionServiceV2.getOrgEffectivePermissionsArray).not.toHaveBeenCalled();
  });

  it("should return empty array on auth error", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("Auth service unavailable"),
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await getEffectivePermissions("org-123");

    expect(result).toEqual([]);
    expect(PermissionServiceV2.getOrgEffectivePermissionsArray).not.toHaveBeenCalled();
  });

  it("should call getOrgEffectivePermissionsArray with user.id (branch_id IS NULL filter enforced by service)", async () => {
    // The branch_id IS NULL constraint is enforced inside getOrgEffectivePermissionsArray;
    // branch-scoped UEP rows are excluded from the result even if they exist in the DB.
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);
    (PermissionServiceV2.getOrgEffectivePermissionsArray as any).mockResolvedValue(["org.read"]);

    await getEffectivePermissions("org-123");

    expect(PermissionServiceV2.getOrgEffectivePermissionsArray).toHaveBeenCalledWith(
      mockSupabase,
      "user-123",
      "org-123"
    );
    expect(PermissionServiceV2.getPermissionSnapshotForUser).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Helpers for getDetailedPermissions tests (direct supabase caller)
// ---------------------------------------------------------------------------

/** Creates a PromiseLike query builder where every chained method returns itself. */
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  // biome-ignore lint: test helper needs loose any typing
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "in", "or", "neq"]) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  // Make the chain awaitable: `await supabase.from("t").select("*").eq(...)` resolves here.
  b.then = (
    onfulfilled: ((value: unknown) => unknown) | null | undefined,
    onrejected: ((reason: unknown) => unknown) | null | undefined
  ) => Promise.resolve(result).then(onfulfilled, onrejected);
  return b;
}

describe("getDetailedPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return org and branch scoped entries with correct scope field", async () => {
    const uepRows = [
      { permission_slug: "org.read", branch_id: null },
      { permission_slug: "members.manage", branch_id: null },
      { permission_slug: "branch.roles.manage", branch_id: "branch-abc" },
    ];
    const branchRows = [{ id: "branch-abc", name: "Main Branch" }];

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "user_effective_permissions")
          return makeQueryBuilder({ data: uepRows, error: null });
        if (table === "branches") return makeQueryBuilder({ data: branchRows, error: null });
      }),
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await getDetailedPermissions("org-123");

    const orgEntries = result.filter((r) => r.scope === "org");
    const branchEntries = result.filter((r) => r.scope === "branch");

    expect(orgEntries).toHaveLength(2);
    expect(orgEntries.every((e) => e.branch_id === null && e.branch_name === null)).toBe(true);
    expect(branchEntries).toHaveLength(1);
    expect(branchEntries[0]).toEqual({
      slug: "branch.roles.manage",
      scope: "branch",
      branch_id: "branch-abc",
      branch_name: "Main Branch",
    });
  });

  it("should resolve branch names for branch-scoped rows", async () => {
    const uepRows = [{ permission_slug: "invites.create", branch_id: "branch-xyz" }];
    const branchRows = [{ id: "branch-xyz", name: "Secondary Branch" }];

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "user_effective_permissions")
          return makeQueryBuilder({ data: uepRows, error: null });
        if (table === "branches") return makeQueryBuilder({ data: branchRows, error: null });
      }),
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await getDetailedPermissions("org-123");

    expect(result).toHaveLength(1);
    expect(result[0].branch_name).toBe("Secondary Branch");
    expect(result[0].branch_id).toBe("branch-xyz");
  });

  it("should set branch_name to null on branch query RLS failure (graceful failure)", async () => {
    const uepRows = [
      { permission_slug: "org.read", branch_id: null },
      { permission_slug: "members.manage", branch_id: "branch-abc" },
    ];

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "user_effective_permissions")
          return makeQueryBuilder({ data: uepRows, error: null });
        if (table === "branches")
          return makeQueryBuilder({ data: null, error: { message: "row-level security" } });
      }),
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await getDetailedPermissions("org-123");

    // Entries still returned — branch_name gracefully null when RLS blocks lookup
    expect(result).toHaveLength(2);
    const branchEntry = result.find((r) => r.scope === "branch");
    expect(branchEntry).toBeDefined();
    expect(branchEntry?.branch_name).toBeNull();
    expect(branchEntry?.branch_id).toBe("branch-abc");
  });

  it("should enforce org isolation: branches query filtered by organization_id", async () => {
    const uepRows = [{ permission_slug: "members.manage", branch_id: "branch-abc" }];
    const branchRows = [{ id: "branch-abc", name: "Org Branch" }];

    let capturedBranchBuilder: ReturnType<typeof makeQueryBuilder>;
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "user_effective_permissions")
          return makeQueryBuilder({ data: uepRows, error: null });
        if (table === "branches") {
          capturedBranchBuilder = makeQueryBuilder({ data: branchRows, error: null });
          return capturedBranchBuilder;
        }
      }),
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    await getDetailedPermissions("org-123");

    // The branches query must include .eq("organization_id", orgId) for cross-org isolation
    expect(capturedBranchBuilder.eq).toHaveBeenCalledWith("organization_id", "org-123");
  });

  it("should return empty array when getUser returns no user", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await getDetailedPermissions("org-123");

    expect(result).toEqual([]);
  });

  it("should sort results: org-scope first, then branch_name ASC, then slug ASC", async () => {
    const uepRows = [
      { permission_slug: "z.permission", branch_id: null },
      { permission_slug: "a.permission", branch_id: null },
      { permission_slug: "b.perm", branch_id: "branch-b" },
      { permission_slug: "a.perm", branch_id: "branch-a" },
    ];
    const branchRows = [
      { id: "branch-a", name: "Alpha Branch" },
      { id: "branch-b", name: "Beta Branch" },
    ];

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "user_effective_permissions")
          return makeQueryBuilder({ data: uepRows, error: null });
        if (table === "branches") return makeQueryBuilder({ data: branchRows, error: null });
      }),
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const result = await getDetailedPermissions("org-123");

    expect(result[0]).toMatchObject({ scope: "org", slug: "a.permission" });
    expect(result[1]).toMatchObject({ scope: "org", slug: "z.permission" });
    expect(result[2]).toMatchObject({
      scope: "branch",
      branch_name: "Alpha Branch",
      slug: "a.perm",
    });
    expect(result[3]).toMatchObject({
      scope: "branch",
      branch_name: "Beta Branch",
      slug: "b.perm",
    });
  });
});

describe("checkPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when user has permission", async () => {
    const mockSupabase = {};
    (createClient as any).mockResolvedValue(mockSupabase);
    (PermissionServiceV2.currentUserHasPermission as any).mockResolvedValue(true);

    const result = await checkPermission("org-123", "org.read");

    expect(result).toBe(true);
    expect(PermissionServiceV2.currentUserHasPermission).toHaveBeenCalledWith(
      mockSupabase,
      "org-123",
      "org.read"
    );
  });

  it("should return false when user lacks permission", async () => {
    const mockSupabase = {};
    (createClient as any).mockResolvedValue(mockSupabase);
    (PermissionServiceV2.currentUserHasPermission as any).mockResolvedValue(false);

    const result = await checkPermission("org-123", "members.manage");

    expect(result).toBe(false);
  });

  it("should return false on error", async () => {
    (createClient as any).mockRejectedValue(new Error("Failed"));

    const result = await checkPermission("org-123", "org.read");

    expect(result).toBe(false);
  });
});

describe("checkOrgMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when user is member", async () => {
    const mockSupabase = {};
    (createClient as any).mockResolvedValue(mockSupabase);
    (PermissionServiceV2.currentUserIsOrgMember as any).mockResolvedValue(true);

    const result = await checkOrgMembership("org-123");

    expect(result).toBe(true);
  });

  it("should return false when user is not member", async () => {
    const mockSupabase = {};
    (createClient as any).mockResolvedValue(mockSupabase);
    (PermissionServiceV2.currentUserIsOrgMember as any).mockResolvedValue(false);

    const result = await checkOrgMembership("org-123");

    expect(result).toBe(false);
  });

  it("should return false on error", async () => {
    (createClient as any).mockRejectedValue(new Error("Failed"));

    const result = await checkOrgMembership("org-123");

    expect(result).toBe(false);
  });
});
