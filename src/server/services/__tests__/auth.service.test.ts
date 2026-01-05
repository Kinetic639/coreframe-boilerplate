/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { AuthService, JWTRole } from "../auth.service";

// Mock JWT tokens for testing
const createMockJWT = (roles: any[]): string => {
  const payload = {
    sub: "user-123",
    email: "test@example.com",
    roles: roles,
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };

  // Create a fake JWT (we're only testing decoding, not verification)
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const signature = "fake-signature";

  return `${header}.${body}.${signature}`;
};

describe("AuthService.getUserRoles", () => {
  it("should extract roles from valid JWT", () => {
    const roles: JWTRole[] = [
      {
        role_id: "role-1",
        role: "admin",
        org_id: "org-1",
        branch_id: null,
        scope: "org" as const,
        scope_id: "org-1",
      },
      {
        role_id: "role-2",
        role: "warehouse_manager",
        org_id: null,
        branch_id: "branch-1",
        scope: "branch" as const,
        scope_id: "branch-1",
      },
    ];

    const token = createMockJWT(roles);
    const result = AuthService.getUserRoles(token);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      role_id: "role-1",
      role: "admin",
      org_id: "org-1",
      branch_id: null,
      scope: "org" as const,
      scope_id: "org-1",
    });
    expect(result[1]).toEqual({
      role_id: "role-2",
      role: "warehouse_manager",
      org_id: null,
      branch_id: "branch-1",
      scope: "branch" as const,
      scope_id: "branch-1",
    });
  });

  it("should return empty array when JWT has no roles claim", () => {
    const token = createMockJWT([]);
    const result = AuthService.getUserRoles(token);

    expect(result).toEqual([]);
  });

  it("should return empty array for invalid JWT", () => {
    const invalidToken = "invalid.jwt.token";
    const result = AuthService.getUserRoles(invalidToken);

    expect(result).toEqual([]);
  });

  it("should handle JWT with malformed roles claim", () => {
    const payload = {
      sub: "user-123",
      roles: "not-an-array", // Invalid roles format
    };

    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = btoa(JSON.stringify(payload));
    const token = `${header}.${body}.fake-signature`;

    const result = AuthService.getUserRoles(token);

    expect(result).toEqual([]);
  });
});

describe("AuthService.hasRole", () => {
  it("should return true when exact role match exists", () => {
    const roles = [
      {
        role_id: "role-1",
        role: "admin",
        org_id: "org-1",
        branch_id: null,
        scope: "org" as const,
        scope_id: "org-1",
      },
    ];

    const result = AuthService.hasRole(roles, "admin");
    expect(result).toBe(true);
  });

  it("should return false when role does not exist", () => {
    const roles = [
      {
        role_id: "role-1",
        role: "admin",
        org_id: "org-1",
        branch_id: null,
        scope: "org" as const,
        scope_id: "org-1",
      },
    ];

    const result = AuthService.hasRole(roles, "moderator");
    expect(result).toBe(false);
  });

  it("should validate org scope correctly", () => {
    const roles = [
      {
        role_id: "role-1",
        role: "admin",
        org_id: "org-1",
        branch_id: null,
        scope: "org" as const,
        scope_id: "org-1",
      },
      {
        role_id: "role-2",
        role: "admin",
        org_id: "org-2",
        branch_id: null,
        scope: "org" as const,
        scope_id: "org-2",
      },
    ];

    // Should find admin role in org-1
    expect(AuthService.hasRole(roles, "admin", { orgId: "org-1" })).toBe(true);

    // Should find admin role in org-2
    expect(AuthService.hasRole(roles, "admin", { orgId: "org-2" })).toBe(true);

    // Should not find admin role in org-3
    expect(AuthService.hasRole(roles, "admin", { orgId: "org-3" })).toBe(false);
  });

  it("should validate branch scope correctly", () => {
    const roles = [
      {
        role_id: "role-1",
        role: "warehouse_manager",
        org_id: null,
        branch_id: "branch-1",
        scope: "branch" as const,
        scope_id: "branch-1",
      },
      {
        role_id: "role-2",
        role: "warehouse_manager",
        org_id: null,
        branch_id: "branch-2",
        scope: "branch" as const,
        scope_id: "branch-2",
      },
    ];

    // Should find role in branch-1
    expect(AuthService.hasRole(roles, "warehouse_manager", { branchId: "branch-1" })).toBe(true);

    // Should find role in branch-2
    expect(AuthService.hasRole(roles, "warehouse_manager", { branchId: "branch-2" })).toBe(true);

    // Should not find role in branch-3
    expect(AuthService.hasRole(roles, "warehouse_manager", { branchId: "branch-3" })).toBe(false);
  });

  it("should support multiple role names", () => {
    const roles = [
      {
        role_id: "role-1",
        role: "moderator",
        org_id: "org-1",
        branch_id: null,
        scope: "org" as const,
        scope_id: "org-1",
      },
    ];

    // Should match when one of the roles exists
    expect(AuthService.hasRole(roles, ["admin", "moderator"])).toBe(true);

    // Should not match when none of the roles exist
    expect(AuthService.hasRole(roles, ["admin", "superadmin"])).toBe(false);
  });

  it("should validate org and branch scope together", () => {
    const roles = [
      {
        role_id: "role-1",
        role: "admin",
        org_id: "org-1",
        branch_id: null,
        scope: "org" as const,
        scope_id: "org-1",
      },
      {
        role_id: "role-2",
        role: "warehouse_manager",
        org_id: null,
        branch_id: "branch-1",
        scope: "branch" as const,
        scope_id: "branch-1",
      },
    ];

    // Org-scoped role should not match with branch filter
    expect(AuthService.hasRole(roles, "admin", { orgId: "org-1", branchId: "branch-1" })).toBe(
      false
    );

    // Should find branch-scoped role with matching branch
    expect(AuthService.hasRole(roles, "warehouse_manager", { branchId: "branch-1" })).toBe(true);
  });

  it("should return false for empty roles array", () => {
    const result = AuthService.hasRole([], "admin");
    expect(result).toBe(false);
  });
});

describe("AuthService.getUserOrganizations", () => {
  it("should return unique organization IDs from org-scoped roles", () => {
    const roles = [
      {
        role_id: "role-1",
        role: "admin",
        org_id: "org-1",
        branch_id: null,
        scope: "org" as const,
        scope_id: "org-1",
      },
      {
        role_id: "role-2",
        role: "moderator",
        org_id: "org-2",
        branch_id: null,
        scope: "org" as const,
        scope_id: "org-2",
      },
      {
        role_id: "role-3",
        role: "admin",
        org_id: "org-1",
        branch_id: null,
        scope: "org" as const,
        scope_id: "org-1",
      },
    ];

    const result = AuthService.getUserOrganizations(roles);

    expect(result).toHaveLength(2);
    expect(result).toContain("org-1");
    expect(result).toContain("org-2");
  });

  it("should exclude null org_id values", () => {
    const roles = [
      {
        role_id: "role-1",
        role: "admin",
        org_id: "org-1",
        branch_id: null,
        scope: "org" as const,
        scope_id: "org-1",
      },
      {
        role_id: "role-2",
        role: "warehouse_manager",
        org_id: null,
        branch_id: "branch-1",
        scope: "branch" as const,
        scope_id: "branch-1",
      },
    ];

    const result = AuthService.getUserOrganizations(roles);

    expect(result).toHaveLength(1);
    expect(result).toContain("org-1");
  });

  it("should return empty array when no org-scoped roles exist", () => {
    const roles = [
      {
        role_id: "role-1",
        role: "warehouse_manager",
        org_id: null,
        branch_id: "branch-1",
        scope: "branch" as const,
        scope_id: "branch-1",
      },
    ];

    const result = AuthService.getUserOrganizations(roles);
    expect(result).toEqual([]);
  });

  it("should return empty array for empty roles", () => {
    const result = AuthService.getUserOrganizations([]);
    expect(result).toEqual([]);
  });
});

describe("AuthService.getUserBranches", () => {
  it("should return unique branch IDs from branch-scoped roles", () => {
    const roles = [
      {
        role_id: "role-1",
        role: "warehouse_manager",
        org_id: null,
        branch_id: "branch-1",
        scope: "branch" as const,
        scope_id: "branch-1",
      },
      {
        role_id: "role-2",
        role: "warehouse_manager",
        org_id: null,
        branch_id: "branch-2",
        scope: "branch" as const,
        scope_id: "branch-2",
      },
      {
        role_id: "role-3",
        role: "admin",
        org_id: null,
        branch_id: "branch-1",
        scope: "branch" as const,
        scope_id: "branch-1",
      },
    ];

    const result = AuthService.getUserBranches(roles);

    expect(result).toHaveLength(2);
    expect(result).toContain("branch-1");
    expect(result).toContain("branch-2");
  });

  it("should exclude null branch_id values", () => {
    const roles = [
      {
        role_id: "role-1",
        role: "admin",
        org_id: "org-1",
        branch_id: null,
        scope: "org" as const,
        scope_id: "org-1",
      },
      {
        role_id: "role-2",
        role: "warehouse_manager",
        org_id: null,
        branch_id: "branch-1",
        scope: "branch" as const,
        scope_id: "branch-1",
      },
    ];

    const result = AuthService.getUserBranches(roles);

    expect(result).toHaveLength(1);
    expect(result).toContain("branch-1");
  });

  it("should filter by organization ID when provided", () => {
    const roles = [
      {
        role_id: "role-1",
        role: "warehouse_manager",
        org_id: "org-1",
        branch_id: "branch-1",
        scope: "branch" as const,
        scope_id: "branch-1",
      },
      {
        role_id: "role-2",
        role: "warehouse_manager",
        org_id: "org-2",
        branch_id: "branch-2",
        scope: "branch" as const,
        scope_id: "branch-2",
      },
      {
        role_id: "role-3",
        role: "warehouse_manager",
        org_id: "org-1",
        branch_id: "branch-3",
        scope: "branch" as const,
        scope_id: "branch-3",
      },
    ];

    const result = AuthService.getUserBranches(roles, "org-1");

    expect(result).toHaveLength(2);
    expect(result).toContain("branch-1");
    expect(result).toContain("branch-3");
    expect(result).not.toContain("branch-2");
  });

  it("should return empty array when no branch-scoped roles exist", () => {
    const roles = [
      {
        role_id: "role-1",
        role: "admin",
        org_id: "org-1",
        branch_id: null,
        scope: "org" as const,
        scope_id: "org-1",
      },
    ];

    const result = AuthService.getUserBranches(roles);
    expect(result).toEqual([]);
  });

  it("should return empty array for empty roles", () => {
    const result = AuthService.getUserBranches([]);
    expect(result).toEqual([]);
  });
});
