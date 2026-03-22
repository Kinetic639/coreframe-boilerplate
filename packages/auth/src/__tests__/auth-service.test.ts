/**
 * @repo/auth — AuthService Tests
 *
 * Tests the dual-shape JWT decoder and role query helpers.
 * Uses @repo/testing factories to build minimal fake JWTs.
 *
 * Suites:
 *   T-AUTH-TARGET:   Target-shape decode path (app_metadata.roles[])
 *   T-AUTH-LEGACY:   Legacy-shape decode path (claims.roles[])
 *   T-AUTH-FALLBACK: Fallback and error handling
 *   T-AUTH-HASROLE:  hasRole() scope filtering
 *   T-AUTH-ORGS:     getUserOrganizations()
 *   T-AUTH-BRANCHES: getUserBranches()
 */

import { describe, it, expect } from "vitest";
import { AuthService } from "../auth-service";
import {
  makeTargetJwt,
  makeLegacyJwt,
  makeTargetRawRole,
  makeLegacyRawRole,
} from "@repo/testing/factories/auth";

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const ORG_ID_2 = "22222222-2222-2222-2222-222222222222";
const BRANCH_ID = "33333333-3333-3333-3333-333333333333";

// ---------------------------------------------------------------------------
// T-AUTH-TARGET: Target-shape decode path
// ---------------------------------------------------------------------------

describe("T-AUTH-TARGET: target-shape decode (app_metadata.roles)", () => {
  it("returns empty array for empty token", () => {
    expect(AuthService.getUserRoles("not.a.jwt")).toEqual([]);
  });

  it("decodes a single org-scoped role from target shape", () => {
    const token = makeTargetJwt([
      makeTargetRawRole("org_owner", "org", ORG_ID, { is_basic: true }),
    ]);
    const roles = AuthService.getUserRoles(token);
    const role = roles[0]!;

    expect(roles).toHaveLength(1);
    expect(role.name).toBe("org_owner");
    expect(role.scope).toBe("org");
    expect(role.scope_id).toBe(ORG_ID);
    expect(role.org_id).toBe(ORG_ID);
    expect(role.branch_id).toBeNull();
    expect(role.is_basic).toBe(true);
    // deprecated alias must equal name
    expect(role.role).toBe("org_owner");
  });

  it("decodes a branch-scoped role from target shape", () => {
    const token = makeTargetJwt([makeTargetRawRole("branch_manager", "branch", BRANCH_ID)]);
    const roles = AuthService.getUserRoles(token);
    const role = roles[0]!;

    expect(roles).toHaveLength(1);
    expect(role.name).toBe("branch_manager");
    expect(role.scope).toBe("branch");
    expect(role.branch_id).toBe(BRANCH_ID);
    expect(role.org_id).toBeNull();
  });

  it("decodes multiple roles from target shape", () => {
    const token = makeTargetJwt([
      makeTargetRawRole("org_owner", "org", ORG_ID),
      makeTargetRawRole("branch_manager", "branch", BRANCH_ID),
    ]);
    const roles = AuthService.getUserRoles(token);

    expect(roles).toHaveLength(2);
    expect(roles.map((r) => r.name)).toContain("org_owner");
    expect(roles.map((r) => r.name)).toContain("branch_manager");
  });

  it("uses target path exclusively when app_metadata.roles is non-empty", () => {
    // Token has both target and legacy roles — should use target only
    const roles = AuthService.getUserRoles(
      makeTargetJwt([makeTargetRawRole("org_owner", "org", ORG_ID)])
    );
    expect(roles).toHaveLength(1);
    expect(roles[0]!.name).toBe("org_owner");
  });
});

// ---------------------------------------------------------------------------
// T-AUTH-LEGACY: Legacy-shape decode path
// ---------------------------------------------------------------------------

describe("T-AUTH-LEGACY: legacy-shape decode (claims.roles)", () => {
  it("decodes a single org-scoped role from legacy shape", () => {
    const token = makeLegacyJwt([makeLegacyRawRole("org_owner", { org_id: ORG_ID })]);
    const roles = AuthService.getUserRoles(token);
    const role = roles[0]!;

    expect(roles).toHaveLength(1);
    expect(role.name).toBe("org_owner");
    expect(role.scope).toBe("org");
    expect(role.org_id).toBe(ORG_ID);
    expect(role.branch_id).toBeNull();
    // is_basic defaults to false in legacy path
    expect(role.is_basic).toBe(false);
    // deprecated alias equals name
    expect(role.role).toBe("org_owner");
  });

  it("decodes a branch-scoped role from legacy shape", () => {
    const token = makeLegacyJwt([
      makeLegacyRawRole("branch_manager", { branch_id: BRANCH_ID, scope: "branch" }),
    ]);
    const roles = AuthService.getUserRoles(token);
    const role = roles[0]!;

    expect(roles).toHaveLength(1);
    expect(role.name).toBe("branch_manager");
    expect(role.scope).toBe("branch");
    expect(role.branch_id).toBe(BRANCH_ID);
  });

  it("normalizes name from legacy role field", () => {
    const token = makeLegacyJwt([makeLegacyRawRole("org_admin")]);
    const roles = AuthService.getUserRoles(token);
    expect(roles[0]!.name).toBe("org_admin");
  });
});

// ---------------------------------------------------------------------------
// T-AUTH-FALLBACK: Error handling
// ---------------------------------------------------------------------------

describe("T-AUTH-FALLBACK: fallback and error handling", () => {
  it("returns empty array for invalid token string", () => {
    expect(AuthService.getUserRoles("invalid")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(AuthService.getUserRoles("")).toEqual([]);
  });

  it("returns empty array when target roles array is empty and no legacy roles", () => {
    const token = makeTargetJwt([]);
    expect(AuthService.getUserRoles(token)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T-AUTH-HASROLE: hasRole() scope filtering
// ---------------------------------------------------------------------------

describe("T-AUTH-HASROLE: hasRole()", () => {
  const roles = AuthService.getUserRoles(
    makeTargetJwt([
      makeTargetRawRole("org_owner", "org", ORG_ID),
      makeTargetRawRole("org_member", "org", ORG_ID_2),
      makeTargetRawRole("branch_manager", "branch", BRANCH_ID),
    ])
  );

  it("matches by name without scope filter", () => {
    expect(AuthService.hasRole(roles, "org_owner")).toBe(true);
    expect(AuthService.hasRole(roles, "branch_manager")).toBe(true);
    expect(AuthService.hasRole(roles, "superadmin")).toBe(false);
  });

  it("matches multiple role names (any)", () => {
    expect(AuthService.hasRole(roles, ["org_owner", "superadmin"])).toBe(true);
    expect(AuthService.hasRole(roles, ["superadmin", "platform_admin"])).toBe(false);
  });

  it("filters by orgId correctly", () => {
    expect(AuthService.hasRole(roles, "org_owner", { orgId: ORG_ID })).toBe(true);
    expect(AuthService.hasRole(roles, "org_owner", { orgId: ORG_ID_2 })).toBe(false);
  });

  it("filters by branchId correctly", () => {
    expect(AuthService.hasRole(roles, "branch_manager", { branchId: BRANCH_ID })).toBe(true);
    expect(AuthService.hasRole(roles, "branch_manager", { branchId: "other-branch" })).toBe(false);
  });

  it("returns false for empty roles array", () => {
    expect(AuthService.hasRole([], "org_owner")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-AUTH-ORGS: getUserOrganizations()
// ---------------------------------------------------------------------------

describe("T-AUTH-ORGS: getUserOrganizations()", () => {
  it("returns org IDs from org-scoped roles only", () => {
    const roles = AuthService.getUserRoles(
      makeTargetJwt([
        makeTargetRawRole("org_owner", "org", ORG_ID),
        makeTargetRawRole("org_member", "org", ORG_ID_2),
        makeTargetRawRole("branch_manager", "branch", BRANCH_ID),
      ])
    );
    const orgs = AuthService.getUserOrganizations(roles);
    expect(orgs).toContain(ORG_ID);
    expect(orgs).toContain(ORG_ID_2);
    expect(orgs).not.toContain(BRANCH_ID);
  });

  it("deduplicates org IDs", () => {
    const roles = AuthService.getUserRoles(
      makeTargetJwt([
        makeTargetRawRole("org_owner", "org", ORG_ID),
        makeTargetRawRole("org_admin", "org", ORG_ID), // same org
      ])
    );
    const orgs = AuthService.getUserOrganizations(roles);
    expect(orgs.filter((id) => id === ORG_ID)).toHaveLength(1);
  });

  it("returns empty array when no org-scoped roles", () => {
    const roles = AuthService.getUserRoles(
      makeTargetJwt([makeTargetRawRole("branch_manager", "branch", BRANCH_ID)])
    );
    expect(AuthService.getUserOrganizations(roles)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T-AUTH-BRANCHES: getUserBranches()
// ---------------------------------------------------------------------------

describe("T-AUTH-BRANCHES: getUserBranches()", () => {
  const BRANCH_ID_2 = "44444444-4444-4444-4444-444444444444";

  it("returns branch IDs from branch-scoped roles only", () => {
    const roles = AuthService.getUserRoles(
      makeTargetJwt([
        makeTargetRawRole("org_owner", "org", ORG_ID),
        makeTargetRawRole("branch_manager", "branch", BRANCH_ID),
        makeTargetRawRole("branch_viewer", "branch", BRANCH_ID_2),
      ])
    );
    const branches = AuthService.getUserBranches(roles);
    expect(branches).toContain(BRANCH_ID);
    expect(branches).toContain(BRANCH_ID_2);
    expect(branches).not.toContain(ORG_ID);
  });

  it("returns empty array when no branch-scoped roles", () => {
    const roles = AuthService.getUserRoles(
      makeTargetJwt([makeTargetRawRole("org_owner", "org", ORG_ID)])
    );
    expect(AuthService.getUserBranches(roles)).toEqual([]);
  });
});
