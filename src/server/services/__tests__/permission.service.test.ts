/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import { PermissionService } from "../permission.service";

describe("PermissionService.getPermissionsForUser", () => {
  const createMockSupabase = (config: {
    roleAssignments?: any;
    roleError?: any;
    rpcData?: any;
    rpcError?: any;
    overrides?: any;
    overrideError?: any;
    permissions?: any;
    permissionError?: any;
  }) => {
    const roleQuery = {
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({
        data: config.roleAssignments ?? [],
        error: config.roleError ?? null,
      }),
    };

    const overrideQuery = {
      eq: vi
        .fn(function (this: any) {
          this.eq = vi.fn().mockReturnThis();
          return this;
        })
        .mockReturnThis(),
      is: vi.fn().mockResolvedValue({
        data: config.overrides ?? [],
        error: config.overrideError ?? null,
      }),
    };

    const permissionQuery = {
      in: vi.fn().mockResolvedValue({
        data: config.permissions ?? [],
        error: config.permissionError ?? null,
      }),
    };

    return {
      from: vi.fn((table: string) => {
        if (table === "user_role_assignments") {
          return { select: () => roleQuery };
        }
        if (table === "user_permission_overrides") {
          return { select: () => overrideQuery };
        }
        if (table === "permissions") {
          return { select: () => permissionQuery };
        }
        return { select: () => ({}) };
      }),
      rpc: vi.fn().mockResolvedValue({
        data: config.rpcData ?? [],
        error: config.rpcError ?? null,
      }),
    } as any;
  };

  it("should fetch permissions from roles successfully", async () => {
    const mockSupabase = createMockSupabase({
      roleAssignments: [
        { role_id: "role-1", scope: "org", scope_id: "org-1" },
        { role_id: "role-2", scope: "branch", scope_id: "branch-1" },
      ],
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
      roleAssignments: [{ role_id: "role-1", scope: "org", scope_id: "org-1" }],
      rpcData: ["warehouse.products.read"],
      overrides: [{ permission_id: "perm-1", allowed: true }],
      permissions: [{ id: "perm-1", slug: "warehouse.products.create" }],
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
      roleAssignments: [{ role_id: "role-1", scope: "org", scope_id: "org-1" }],
      rpcData: ["warehouse.products.read", "warehouse.products.create"],
      overrides: [{ permission_id: "perm-1", allowed: false }],
      permissions: [{ id: "perm-1", slug: "warehouse.products.create" }],
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
      roleAssignments: [],
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
      roleAssignments: [{ role_id: "role-1", scope: "org", scope_id: "org-1" }],
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
      roleAssignments: [{ role_id: "role-1", scope: "org", scope_id: "org-1" }],
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
});

describe("PermissionService.can", () => {
  it("should return true when exact permission exists", () => {
    const permissions = ["warehouse.products.read", "warehouse.products.create"];

    expect(PermissionService.can(permissions, "warehouse.products.read")).toBe(true);
  });

  it("should return false when permission is missing", () => {
    const permissions = ["warehouse.products.read"];

    expect(PermissionService.can(permissions, "warehouse.products.delete")).toBe(false);
  });

  it("should support wildcard matching - module level", () => {
    const permissions = ["warehouse.*"];

    expect(PermissionService.can(permissions, "warehouse.products.read")).toBe(true);
    expect(PermissionService.can(permissions, "warehouse.locations.create")).toBe(true);
    expect(PermissionService.can(permissions, "warehouse.anything.action")).toBe(true);
  });

  it("should support wildcard matching - entity level", () => {
    const permissions = ["warehouse.products.*"];

    expect(PermissionService.can(permissions, "warehouse.products.read")).toBe(true);
    expect(PermissionService.can(permissions, "warehouse.products.create")).toBe(true);
    expect(PermissionService.can(permissions, "warehouse.products.delete")).toBe(true);
    // Should not match different entity
    expect(PermissionService.can(permissions, "warehouse.locations.read")).toBe(false);
  });

  it("should support multiple wildcard levels", () => {
    const permissions = ["*"];

    expect(PermissionService.can(permissions, "warehouse.products.read")).toBe(true);
    expect(PermissionService.can(permissions, "teams.members.create")).toBe(true);
    expect(PermissionService.can(permissions, "any.thing.here")).toBe(true);
  });

  it("should prioritize exact match over wildcard", () => {
    const permissions = ["warehouse.*", "warehouse.products.read"];

    expect(PermissionService.can(permissions, "warehouse.products.read")).toBe(true);
  });

  it("should handle empty permissions array", () => {
    const permissions: string[] = [];

    expect(PermissionService.can(permissions, "any.permission")).toBe(false);
  });

  it("should handle permission with special characters in wildcard", () => {
    const permissions = ["warehouse.products-v2.*"];

    expect(PermissionService.can(permissions, "warehouse.products-v2.read")).toBe(true);
    expect(PermissionService.can(permissions, "warehouse.products.read")).toBe(false);
  });

  it("should be case-sensitive", () => {
    const permissions = ["warehouse.products.READ"];

    expect(PermissionService.can(permissions, "warehouse.products.read")).toBe(false);
    expect(PermissionService.can(permissions, "warehouse.products.READ")).toBe(true);
  });
});
