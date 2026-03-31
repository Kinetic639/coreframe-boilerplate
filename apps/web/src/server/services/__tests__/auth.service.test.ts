/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { AuthService, TokenRole } from "../auth.service";

// ============================================================
// JWT factories
// ============================================================

/**
 * Creates a mock JWT with roles in the TARGET location: claims.app_metadata.roles
 * This is the PRIMARY decode path — canonical target hook shape.
 * Fields: role_id, name, is_basic, scope, scope_id, scope_type
 */
const createTargetJWT = (
  roles: {
    role_id: string;
    name: string;
    is_basic: boolean;
    scope: "org" | "branch";
    scope_id: string;
    scope_type: "org" | "branch";
  }[]
): string => {
  const payload = {
    sub: "user-123",
    email: "test@example.com",
    app_metadata: { roles },
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };

  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
};

/**
 * Creates a mock JWT with roles in the LEGACY location: claims.roles
 * This is the FALLBACK decode path — transitional legacy hook shape.
 * Fields: role_id, role, org_id, branch_id, scope, scope_id
 *
 * TRANSITIONAL: Remove when legacy schema is retired.
 */
const createLegacyJWT = (
  roles: {
    role_id?: string;
    role: string;
    org_id?: string | null;
    branch_id?: string | null;
    scope?: "org" | "branch";
    scope_id?: string;
  }[]
): string => {
  const payload = {
    sub: "user-123",
    email: "test@example.com",
    roles,
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };

  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
};

// ============================================================
// TokenRole fixture builders
//
// Used for hasRole / getUserOrganizations / getUserBranches tests
// where normalized TokenRole objects are passed directly (not via decode).
// ============================================================

function makeOrgRole(name: string, orgId: string, overrides?: Partial<TokenRole>): TokenRole {
  return {
    role_id: `role-${name}-${orgId}`,
    name,
    scope: "org",
    scope_id: orgId,
    scope_type: "org",
    is_basic: false,
    org_id: orgId,
    branch_id: null,
    role: name, // deprecated alias — always equals name
    ...overrides,
  };
}

function makeBranchRole(
  name: string,
  branchId: string,
  orgId: string | null = null,
  overrides?: Partial<TokenRole>
): TokenRole {
  return {
    role_id: `role-${name}-${branchId}`,
    name,
    scope: "branch",
    scope_id: branchId,
    scope_type: "branch",
    is_basic: false,
    org_id: orgId,
    branch_id: branchId,
    role: name, // deprecated alias — always equals name
    ...overrides,
  };
}

// ============================================================
// AuthService.getUserRoles — target shape (PRIMARY PATH)
// ============================================================

describe("AuthService.getUserRoles — target shape (PRIMARY PATH)", () => {
  it("should decode roles from claims.app_metadata.roles using canonical `name` field", () => {
    const token = createTargetJWT([
      {
        role_id: "role-1",
        name: "org_owner",
        is_basic: true,
        scope: "org",
        scope_id: "org-1",
        scope_type: "org",
      },
      {
        role_id: "role-2",
        name: "branch_manager",
        is_basic: false,
        scope: "branch",
        scope_id: "branch-1",
        scope_type: "branch",
      },
    ]);

    const result = AuthService.getUserRoles(token);

    expect(result).toHaveLength(2);

    // First role: org-scoped — canonical fields and derivation
    expect(result[0].name).toBe("org_owner");
    expect(result[0].role).toBe("org_owner"); // deprecated alias must equal name
    expect(result[0].scope).toBe("org");
    expect(result[0].scope_id).toBe("org-1");
    expect(result[0].scope_type).toBe("org");
    expect(result[0].is_basic).toBe(true);
    // org_id derived from scope + scope_id (not in target wire format)
    expect(result[0].org_id).toBe("org-1");
    expect(result[0].branch_id).toBeNull();

    // Second role: branch-scoped — canonical fields and derivation
    expect(result[1].name).toBe("branch_manager");
    expect(result[1].role).toBe("branch_manager"); // deprecated alias must equal name
    expect(result[1].scope).toBe("branch");
    expect(result[1].scope_id).toBe("branch-1");
    expect(result[1].scope_type).toBe("branch");
    expect(result[1].is_basic).toBe(false);
    // branch_id derived from scope + scope_id (not in target wire format)
    expect(result[1].org_id).toBeNull();
    expect(result[1].branch_id).toBe("branch-1");
  });

  it("should return empty array when app_metadata.roles is empty", () => {
    const token = createTargetJWT([]);
    expect(AuthService.getUserRoles(token)).toEqual([]);
  });

  it("deprecated role alias always equals name for target tokens", () => {
    const token = createTargetJWT([
      {
        role_id: "r1",
        name: "org_admin",
        is_basic: false,
        scope: "org",
        scope_id: "org-99",
        scope_type: "org",
      },
    ]);
    const [role] = AuthService.getUserRoles(token);
    expect(role.role).toBe(role.name);
    expect(role.name).toBe("org_admin");
  });
});

// ============================================================
// AuthService.getUserRoles — legacy shape (FALLBACK PATH)
// TRANSITIONAL: Remove when legacy schema is retired.
// ============================================================

describe("AuthService.getUserRoles — legacy shape (FALLBACK PATH, transitional)", () => {
  it("should normalize claims.roles `role` field to canonical `name`", () => {
    const token = createLegacyJWT([
      {
        role_id: "role-1",
        role: "admin",
        org_id: "org-1",
        branch_id: null,
        scope: "org",
        scope_id: "org-1",
      },
      {
        role_id: "role-2",
        role: "warehouse_manager",
        org_id: null,
        branch_id: "branch-1",
        scope: "branch",
        scope_id: "branch-1",
      },
    ]);

    const result = AuthService.getUserRoles(token);

    expect(result).toHaveLength(2);

    // First role: org-scoped — verify normalization from legacy shape
    expect(result[0].name).toBe("admin"); // normalized from legacy `role` field
    expect(result[0].role).toBe("admin"); // deprecated alias must equal name
    expect(result[0].scope).toBe("org");
    expect(result[0].org_id).toBe("org-1"); // from raw legacy field
    expect(result[0].branch_id).toBeNull();
    // Transitional defaults — not present in legacy wire format
    expect(result[0].scope_type).toBe("org"); // derived from scope
    expect(result[0].is_basic).toBe(false); // default: not available in legacy format

    // Second role: branch-scoped — verify normalization from legacy shape
    expect(result[1].name).toBe("warehouse_manager");
    expect(result[1].role).toBe("warehouse_manager"); // deprecated alias must equal name
    expect(result[1].scope).toBe("branch");
    expect(result[1].org_id).toBeNull();
    expect(result[1].branch_id).toBe("branch-1");
    // Transitional defaults
    expect(result[1].scope_type).toBe("branch"); // derived from scope
    expect(result[1].is_basic).toBe(false); // default: not available in legacy format
  });

  it("should return empty array when root roles claim is empty", () => {
    const token = createLegacyJWT([]);
    expect(AuthService.getUserRoles(token)).toEqual([]);
  });

  it("deprecated role alias always equals name for legacy tokens", () => {
    const token = createLegacyJWT([
      { role_id: "r1", role: "org_member", org_id: "org-5", scope: "org", scope_id: "org-5" },
    ]);
    const [role] = AuthService.getUserRoles(token);
    expect(role.role).toBe(role.name);
    expect(role.name).toBe("org_member");
  });

  it("target path takes priority when both app_metadata.roles and root roles are present", () => {
    const payload = {
      sub: "user-123",
      email: "test@example.com",
      app_metadata: {
        roles: [
          {
            role_id: "target-role",
            name: "org_owner",
            is_basic: true,
            scope: "org",
            scope_id: "org-1",
            scope_type: "org",
          },
        ],
      },
      roles: [
        {
          role_id: "legacy-role",
          role: "legacy_role",
          org_id: "org-1",
          scope: "org",
          scope_id: "org-1",
        },
      ],
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };

    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = btoa(JSON.stringify(payload));
    const token = `${header}.${body}.fake-signature`;

    const result = AuthService.getUserRoles(token);
    // Must return only the target role — legacy fallback ignored when target is present
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("org_owner");
  });
});

// ============================================================
// AuthService.getUserRoles — edge cases
// ============================================================

describe("AuthService.getUserRoles — edge cases", () => {
  it("should return empty array for invalid JWT", () => {
    expect(AuthService.getUserRoles("invalid.jwt.token")).toEqual([]);
  });

  it("should return empty array when JWT has no roles in either location", () => {
    const payload = {
      sub: "user-123",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = btoa(JSON.stringify(payload));
    const token = `${header}.${body}.fake-signature`;
    expect(AuthService.getUserRoles(token)).toEqual([]);
  });

  it("should return empty array when root roles is not an array (malformed)", () => {
    const payload = {
      sub: "user-123",
      roles: "not-an-array",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = btoa(JSON.stringify(payload));
    const token = `${header}.${body}.fake-signature`;
    expect(AuthService.getUserRoles(token)).toEqual([]);
  });
});

// ============================================================
// AuthService.hasRole
//
// Fixtures use normalized TokenRole objects (not going through decode).
// hasRole checks the canonical `name` field.
// ============================================================

describe("AuthService.hasRole", () => {
  it("should return true when exact role name match exists (checks `name` field)", () => {
    const roles = [makeOrgRole("admin", "org-1")];
    expect(AuthService.hasRole(roles, "admin")).toBe(true);
  });

  it("should return false when role name does not exist", () => {
    const roles = [makeOrgRole("admin", "org-1")];
    expect(AuthService.hasRole(roles, "moderator")).toBe(false);
  });

  it("should validate org scope correctly", () => {
    const roles = [makeOrgRole("admin", "org-1"), makeOrgRole("admin", "org-2")];

    expect(AuthService.hasRole(roles, "admin", { orgId: "org-1" })).toBe(true);
    expect(AuthService.hasRole(roles, "admin", { orgId: "org-2" })).toBe(true);
    expect(AuthService.hasRole(roles, "admin", { orgId: "org-3" })).toBe(false);
  });

  it("should validate branch scope correctly", () => {
    const roles = [
      makeBranchRole("warehouse_manager", "branch-1"),
      makeBranchRole("warehouse_manager", "branch-2"),
    ];

    expect(AuthService.hasRole(roles, "warehouse_manager", { branchId: "branch-1" })).toBe(true);
    expect(AuthService.hasRole(roles, "warehouse_manager", { branchId: "branch-2" })).toBe(true);
    expect(AuthService.hasRole(roles, "warehouse_manager", { branchId: "branch-3" })).toBe(false);
  });

  it("should support multiple role names (any match)", () => {
    const roles = [makeOrgRole("moderator", "org-1")];
    expect(AuthService.hasRole(roles, ["admin", "moderator"])).toBe(true);
    expect(AuthService.hasRole(roles, ["admin", "superadmin"])).toBe(false);
  });

  it("should reject org-scoped role when branch filter is applied", () => {
    const roles = [makeOrgRole("admin", "org-1"), makeBranchRole("warehouse_manager", "branch-1")];

    expect(AuthService.hasRole(roles, "admin", { orgId: "org-1", branchId: "branch-1" })).toBe(
      false
    );
    expect(AuthService.hasRole(roles, "warehouse_manager", { branchId: "branch-1" })).toBe(true);
  });

  it("should return false for empty roles array", () => {
    expect(AuthService.hasRole([], "admin")).toBe(false);
  });
});

// ============================================================
// AuthService.getUserOrganizations
// ============================================================

describe("AuthService.getUserOrganizations", () => {
  it("should return unique organization IDs from org-scoped roles", () => {
    const roles = [
      makeOrgRole("admin", "org-1"),
      makeOrgRole("moderator", "org-2"),
      makeOrgRole("admin", "org-1"), // duplicate
    ];

    const result = AuthService.getUserOrganizations(roles);
    expect(result).toHaveLength(2);
    expect(result).toContain("org-1");
    expect(result).toContain("org-2");
  });

  it("should exclude branch-scoped roles", () => {
    const roles = [makeOrgRole("admin", "org-1"), makeBranchRole("warehouse_manager", "branch-1")];

    const result = AuthService.getUserOrganizations(roles);
    expect(result).toHaveLength(1);
    expect(result).toContain("org-1");
  });

  it("should return empty array when no org-scoped roles exist", () => {
    const result = AuthService.getUserOrganizations([
      makeBranchRole("warehouse_manager", "branch-1"),
    ]);
    expect(result).toEqual([]);
  });

  it("should return empty array for empty roles", () => {
    expect(AuthService.getUserOrganizations([])).toEqual([]);
  });
});

// ============================================================
// AuthService.getUserBranches
// ============================================================

describe("AuthService.getUserBranches", () => {
  it("should return unique branch IDs from branch-scoped roles", () => {
    const roles = [
      makeBranchRole("warehouse_manager", "branch-1"),
      makeBranchRole("warehouse_manager", "branch-2"),
      makeBranchRole("admin", "branch-1"), // duplicate branch
    ];

    const result = AuthService.getUserBranches(roles);
    expect(result).toHaveLength(2);
    expect(result).toContain("branch-1");
    expect(result).toContain("branch-2");
  });

  it("should exclude org-scoped roles", () => {
    const roles = [makeOrgRole("admin", "org-1"), makeBranchRole("warehouse_manager", "branch-1")];

    const result = AuthService.getUserBranches(roles);
    expect(result).toHaveLength(1);
    expect(result).toContain("branch-1");
  });

  it("should filter by organization ID when provided", () => {
    const roles = [
      makeBranchRole("warehouse_manager", "branch-1", "org-1"),
      makeBranchRole("warehouse_manager", "branch-2", "org-2"),
      makeBranchRole("warehouse_manager", "branch-3", "org-1"),
    ];

    const result = AuthService.getUserBranches(roles, "org-1");
    expect(result).toHaveLength(2);
    expect(result).toContain("branch-1");
    expect(result).toContain("branch-3");
    expect(result).not.toContain("branch-2");
  });

  it("should return empty array when no branch-scoped roles exist", () => {
    const result = AuthService.getUserBranches([makeOrgRole("admin", "org-1")]);
    expect(result).toEqual([]);
  });

  it("should return empty array for empty roles", () => {
    expect(AuthService.getUserBranches([])).toEqual([]);
  });
});

// ============================================================
// AuthService.getUserRoles — app_metadata.roles non-array edge case
// ============================================================

describe("AuthService.getUserRoles — app_metadata non-array edge cases", () => {
  it("returns empty array when app_metadata.roles is not an array", () => {
    const payload = {
      sub: "user-abc",
      email: "user@example.com",
      app_metadata: { roles: "not-an-array" },
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = btoa(JSON.stringify(payload));
    const token = `${header}.${body}.fake-signature`;

    // Falls through to legacy path — no root-level roles either → empty
    expect(AuthService.getUserRoles(token)).toEqual([]);
  });

  it("returns empty array when app_metadata is present but roles key is missing", () => {
    const payload = {
      sub: "user-abc",
      app_metadata: { provider: "email" },
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = btoa(JSON.stringify(payload));
    const token = `${header}.${body}.fake-signature`;

    expect(AuthService.getUserRoles(token)).toEqual([]);
  });
});

// ============================================================
// AuthService.getUserBranches — orgId filter with null org_id on branch role
// ============================================================

describe("AuthService.getUserBranches — null org_id filtering", () => {
  it("excludes branch roles with null org_id when filtering by orgId", () => {
    const roles = [
      makeBranchRole("warehouse_manager", "branch-1", null), // null org_id
      makeBranchRole("warehouse_manager", "branch-2", "org-1"),
    ];

    const result = AuthService.getUserBranches(roles, "org-1");
    expect(result).toHaveLength(1);
    expect(result).toContain("branch-2");
    expect(result).not.toContain("branch-1");
  });
});
