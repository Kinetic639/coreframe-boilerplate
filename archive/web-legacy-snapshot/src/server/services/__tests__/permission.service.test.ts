/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import { PermissionService } from "../permission.service";

describe("PermissionService.getPermissionsForUser", () => {
  const createMockSupabase = (config: {
    orgRoleAssignments?: any;
    branchRoleAssignments?: any;
    roleError?: any;
    rpcData?: any;
    rpcError?: any;
    overrides?: any; // Now includes {permissions: {slug}} due to join
    overrideError?: any;
  }) => {
    // Mock for org roles query
    const orgRoleQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((field: string, value: any) => {
        if (field === "scope" && value === "org") {
          return {
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({
              data: config.orgRoleAssignments ?? [],
              error: config.roleError ?? null,
            }),
          };
        }
        return orgRoleQuery;
      }),
    };

    // Mock for branch roles query
    const branchRoleQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((field: string, value: any) => {
        if (field === "scope" && value === "branch") {
          return {
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({
              data: config.branchRoleAssignments ?? [],
              error: config.roleError ?? null,
            }),
          };
        }
        return branchRoleQuery;
      }),
    };

    // Mock for overrides query (with join optimization + .in() instead of .or())
    const overrideQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(), // Changed from .or() to .in()
      is: vi.fn().mockResolvedValue({
        data: config.overrides ?? [],
        error: config.overrideError ?? null,
      }),
    };

    let roleQueryCallCount = 0;

    return {
      from: vi.fn((table: string) => {
        if (table === "user_role_assignments") {
          // Alternate between org and branch query mocks
          roleQueryCallCount++;
          return roleQueryCallCount === 1 ? orgRoleQuery : branchRoleQuery;
        }
        if (table === "user_permission_overrides") {
          return overrideQuery;
        }
        return {};
      }),
      rpc: vi.fn().mockResolvedValue({
        data: config.rpcData ?? [],
        error: config.rpcError ?? null,
      }),
    } as any;
  };

  it("should fetch permissions from roles successfully", async () => {
    const mockSupabase = createMockSupabase({
      orgRoleAssignments: [{ role_id: "role-1" }, { role_id: "role-2" }],
      branchRoleAssignments: [],
      rpcData: ["warehouse.products.read", "warehouse.products.create", "warehouse.locations.read"],
    });

    const permissions = await PermissionService.getPermissionsForUser(
      mockSupabase,
      "user-1",
      "org-1"
    );

    expect(permissions).toHaveLength(3);
    expect(permissions).toContain("warehouse.products.read");
    expect(permissions).toContain("warehouse.products.create");
    expect(permissions).toContain("warehouse.locations.read");
  });

  it("should apply permission overrides - grant additional permission", async () => {
    const mockSupabase = createMockSupabase({
      orgRoleAssignments: [{ role_id: "role-1" }],
      branchRoleAssignments: [],
      rpcData: ["warehouse.products.read"],
      // NEW: overrides now include {permissions: {slug}} due to join optimization
      overrides: [
        {
          allowed: true,
          scope: "org",
          scope_id: "org-1",
          created_at: "2024-01-01T00:00:00Z",
          permissions: { slug: "warehouse.products.create" },
        },
      ],
    });

    const permissions = await PermissionService.getPermissionsForUser(
      mockSupabase,
      "user-1",
      "org-1"
    );

    expect(permissions).toContain("warehouse.products.read");
    expect(permissions).toContain("warehouse.products.create");
  });

  it("should apply permission overrides - deny permission", async () => {
    const mockSupabase = createMockSupabase({
      orgRoleAssignments: [{ role_id: "role-1" }],
      branchRoleAssignments: [],
      rpcData: ["warehouse.products.read", "warehouse.products.create"],
      // NEW: overrides now include {permissions: {slug}} due to join optimization
      overrides: [
        {
          allowed: false,
          scope: "org",
          scope_id: "org-1",
          created_at: "2024-01-01T00:00:00Z",
          permissions: { slug: "warehouse.products.create" },
        },
      ],
    });

    const permissions = await PermissionService.getPermissionsForUser(
      mockSupabase,
      "user-1",
      "org-1"
    );

    expect(permissions).toContain("warehouse.products.read");
    expect(permissions).not.toContain("warehouse.products.create");
  });

  it("should handle RLS denial gracefully", async () => {
    const mockSupabase = createMockSupabase({
      roleError: { message: "Row level security policy violation", code: "42501" },
    });

    const permissions = await PermissionService.getPermissionsForUser(
      mockSupabase,
      "user-1",
      "org-1"
    );

    expect(permissions).toEqual([]);
  });

  it("should return empty array for user with no roles", async () => {
    const mockSupabase = createMockSupabase({
      orgRoleAssignments: [],
      branchRoleAssignments: [],
    });

    const permissions = await PermissionService.getPermissionsForUser(
      mockSupabase,
      "user-1",
      "org-1"
    );

    expect(permissions).toEqual([]);
  });

  it("should handle RPC error gracefully", async () => {
    const mockSupabase = createMockSupabase({
      orgRoleAssignments: [{ role_id: "role-1", scope: "org", scope_id: "org-1" }],
      branchRoleAssignments: [],
      rpcError: { message: "RPC function failed", code: "500" },
    });

    const permissions = await PermissionService.getPermissionsForUser(
      mockSupabase,
      "user-1",
      "org-1"
    );

    expect(permissions).toEqual([]);
  });

  it("should handle override fetch error gracefully", async () => {
    const mockSupabase = createMockSupabase({
      orgRoleAssignments: [{ role_id: "role-1" }],
      branchRoleAssignments: [],
      rpcData: ["warehouse.products.read"],
      overrideError: { message: "Override fetch failed", code: "500" },
    });

    const permissions = await PermissionService.getPermissionsForUser(
      mockSupabase,
      "user-1",
      "org-1"
    );

    expect(permissions).toContain("warehouse.products.read");
  });

  it("should include branch-scoped roles when branchId is provided", async () => {
    const mockSupabase = createMockSupabase({
      orgRoleAssignments: [{ role_id: "role-1" }],
      branchRoleAssignments: [{ role_id: "role-2" }],
      rpcData: ["org.members.read", "branch.settings.update", "warehouse.products.create"],
    });

    const permissions = await PermissionService.getPermissionsForUser(
      mockSupabase,
      "user-1",
      "org-1",
      "branch-1" // With branch context
    );

    expect(permissions).toContain("org.members.read");
    expect(permissions).toContain("branch.settings.update");
    expect(permissions).toContain("warehouse.products.create");
  });

  it("should only include org-scoped roles when branchId is not provided", async () => {
    const mockSupabase = createMockSupabase({
      orgRoleAssignments: [{ role_id: "role-1" }],
      branchRoleAssignments: [],
      rpcData: ["org.members.read", "org.branches.manage"],
    });

    const permissions = await PermissionService.getPermissionsForUser(
      mockSupabase,
      "user-1",
      "org-1"
      // No branchId
    );

    expect(permissions).toContain("org.members.read");
    expect(permissions).toContain("org.branches.manage");
  });

  it("should apply override precedence correctly (branch > org > global)", async () => {
    const mockSupabase = createMockSupabase({
      orgRoleAssignments: [{ role_id: "role-1" }],
      branchRoleAssignments: [],
      rpcData: ["warehouse.products.read"],
      // NEW: overrides now include {permissions: {slug}} due to join optimization
      overrides: [
        // Global override grants create
        {
          allowed: true,
          scope: "global",
          scope_id: null,
          created_at: "2024-01-01T00:00:00Z",
          permissions: { slug: "warehouse.products.create" },
        },
        // Org override denies create (should override global)
        {
          allowed: false,
          scope: "org",
          scope_id: "org-1",
          created_at: "2024-01-02T00:00:00Z",
          permissions: { slug: "warehouse.products.create" },
        },
        // Branch override grants create again (should override org)
        {
          allowed: true,
          scope: "branch",
          scope_id: "branch-1",
          created_at: "2024-01-03T00:00:00Z",
          permissions: { slug: "warehouse.products.create" },
        },
      ],
    });

    const permissions = await PermissionService.getPermissionsForUser(
      mockSupabase,
      "user-1",
      "org-1",
      "branch-1"
    );

    // Branch override (allowed=true) should win
    expect(permissions).toContain("warehouse.products.create");
  });

  it("should apply branch deny override over org grant", async () => {
    const mockSupabase = createMockSupabase({
      orgRoleAssignments: [{ role_id: "role-1" }],
      branchRoleAssignments: [],
      rpcData: ["warehouse.products.delete"], // Granted by role
      // NEW: overrides now include {permissions: {slug}} due to join optimization
      overrides: [
        // Branch override denies delete
        {
          allowed: false,
          scope: "branch",
          scope_id: "branch-1",
          created_at: "2024-01-01T00:00:00Z",
          permissions: { slug: "warehouse.products.delete" },
        },
      ],
    });

    const permissions = await PermissionService.getPermissionsForUser(
      mockSupabase,
      "user-1",
      "org-1",
      "branch-1"
    );

    // Branch deny should remove the permission
    expect(permissions).not.toContain("warehouse.products.delete");
  });
});

describe("PermissionService.can", () => {
  it("should return true when exact permission exists", () => {
    const snapshot = { allow: ["warehouse.products.read", "warehouse.products.create"], deny: [] };

    expect(PermissionService.can(snapshot, "warehouse.products.read")).toBe(true);
  });

  it("should return false when permission is missing", () => {
    const snapshot = { allow: ["warehouse.products.read"], deny: [] };

    expect(PermissionService.can(snapshot, "warehouse.products.delete")).toBe(false);
  });

  it("should support wildcard matching - module level", () => {
    const snapshot = { allow: ["warehouse.*"], deny: [] };

    expect(PermissionService.can(snapshot, "warehouse.products.read")).toBe(true);
    expect(PermissionService.can(snapshot, "warehouse.locations.create")).toBe(true);
    expect(PermissionService.can(snapshot, "warehouse.anything.action")).toBe(true);
  });

  it("should support wildcard matching - entity level", () => {
    const snapshot = { allow: ["warehouse.products.*"], deny: [] };

    expect(PermissionService.can(snapshot, "warehouse.products.read")).toBe(true);
    expect(PermissionService.can(snapshot, "warehouse.products.create")).toBe(true);
    expect(PermissionService.can(snapshot, "warehouse.products.delete")).toBe(true);
    // Should not match different entity
    expect(PermissionService.can(snapshot, "warehouse.locations.read")).toBe(false);
  });

  it("should support multiple wildcard levels", () => {
    const snapshot = { allow: ["*"], deny: [] };

    expect(PermissionService.can(snapshot, "warehouse.products.read")).toBe(true);
    expect(PermissionService.can(snapshot, "teams.members.create")).toBe(true);
    expect(PermissionService.can(snapshot, "any.thing.here")).toBe(true);
  });

  it("should prioritize exact match over wildcard", () => {
    const snapshot = { allow: ["warehouse.*", "warehouse.products.read"], deny: [] };

    expect(PermissionService.can(snapshot, "warehouse.products.read")).toBe(true);
  });

  it("should handle empty permissions array", () => {
    const snapshot = { allow: [], deny: [] };

    expect(PermissionService.can(snapshot, "any.permission")).toBe(false);
  });

  it("should handle permission with special characters in wildcard", () => {
    const snapshot = { allow: ["warehouse.products-v2.*"], deny: [] };

    expect(PermissionService.can(snapshot, "warehouse.products-v2.read")).toBe(true);
    expect(PermissionService.can(snapshot, "warehouse.products.read")).toBe(false);
  });

  it("should be case-sensitive", () => {
    const snapshot = { allow: ["warehouse.products.READ"], deny: [] };

    expect(PermissionService.can(snapshot, "warehouse.products.read")).toBe(false);
    expect(PermissionService.can(snapshot, "warehouse.products.READ")).toBe(true);
  });
});
