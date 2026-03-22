/**
 * @repo/domain — Organization Tests
 *
 * Tests pure organization/branch domain logic.
 *
 * Suites:
 *   T-ORG-ORGONLY:   isOrgOnlyPermission() and ORG_ONLY_PERMISSIONS set
 *   T-ORG-VALIDATE:  validateBranchRolePermissions()
 *   T-ORG-GROUP:     groupMembersByBranch()
 */

import { describe, it, expect } from "vitest";
import {
  isOrgOnlyPermission,
  validateBranchRolePermissions,
  groupMembersByBranch,
  ORG_ONLY_PERMISSIONS,
} from "../organization.js";
import {
  MEMBERS_READ,
  MEMBERS_MANAGE,
  ORG_READ,
  ORG_UPDATE,
  BRANCHES_CREATE,
  BRANCHES_UPDATE,
  BRANCHES_DELETE,
  INVITES_READ,
  INVITES_CREATE,
  INVITES_CANCEL,
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
} from "@repo/contracts/permissions";
import {
  makeMemberWithNoRoles,
  makeOrgMember,
  makeBranchMember,
  makeMemberWithRoles,
} from "@repo/testing/factories/organization";

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const BRANCH_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BRANCH_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

// ---------------------------------------------------------------------------
// T-ORG-ORGONLY: isOrgOnlyPermission() and ORG_ONLY_PERMISSIONS
// ---------------------------------------------------------------------------

describe("T-ORG-ORGONLY: isOrgOnlyPermission()", () => {
  const ORG_ONLY_SLUGS = [
    MEMBERS_READ,
    MEMBERS_MANAGE,
    ORG_READ,
    ORG_UPDATE,
    BRANCHES_CREATE,
    BRANCHES_UPDATE,
    BRANCHES_DELETE,
    INVITES_READ,
    INVITES_CREATE,
    INVITES_CANCEL,
    MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  ];

  it("returns true for all known org-only slugs", () => {
    for (const slug of ORG_ONLY_SLUGS) {
      expect(isOrgOnlyPermission(slug), `expected ${slug} to be org-only`).toBe(true);
    }
  });

  it("returns false for branch-assignable slugs", () => {
    expect(isOrgOnlyPermission("branch.roles.manage")).toBe(false);
    expect(isOrgOnlyPermission("events.org_activity.read")).toBe(false);
    expect(isOrgOnlyPermission("warehouse.products.read")).toBe(false);
  });

  it("ORG_ONLY_PERMISSIONS set contains at least the expected 11 slugs", () => {
    expect(ORG_ONLY_PERMISSIONS.size).toBeGreaterThanOrEqual(11);
  });

  it("ORG_ONLY_PERMISSIONS does not contain branch.roles.manage", () => {
    expect(ORG_ONLY_PERMISSIONS.has("branch.roles.manage")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-ORG-VALIDATE: validateBranchRolePermissions()
// ---------------------------------------------------------------------------

describe("T-ORG-VALIDATE: validateBranchRolePermissions()", () => {
  it("org scope always returns valid regardless of slugs", () => {
    const result = validateBranchRolePermissions("org", [MEMBERS_READ, MEMBERS_MANAGE]);
    expect(result).toEqual({ valid: true });
  });

  it("org scope valid for empty slug list", () => {
    expect(validateBranchRolePermissions("org", [])).toEqual({ valid: true });
  });

  it("branch scope valid when no org-only slugs present", () => {
    const result = validateBranchRolePermissions("branch", [
      "branch.roles.manage",
      "events.org_activity.read",
    ]);
    expect(result).toEqual({ valid: true });
  });

  it("branch scope valid for empty slug list", () => {
    expect(validateBranchRolePermissions("branch", [])).toEqual({ valid: true });
  });

  it("branch scope invalid when org-only slug is present", () => {
    const result = validateBranchRolePermissions("branch", ["branch.roles.manage", MEMBERS_READ]);
    expect(result).toEqual({ valid: false, invalidSlugs: [MEMBERS_READ] });
  });

  it("branch scope collects all invalid slugs", () => {
    const result = validateBranchRolePermissions("branch", [
      MEMBERS_READ,
      MEMBERS_MANAGE,
      "events.org_activity.read",
    ]);
    expect(result).toEqual({
      valid: false,
      invalidSlugs: expect.arrayContaining([MEMBERS_READ, MEMBERS_MANAGE]),
    });
    if ("invalidSlugs" in result) {
      expect(result.invalidSlugs).toHaveLength(2);
    }
  });

  it("branch scope with all org-only slugs — all are reported invalid", () => {
    const result = validateBranchRolePermissions("branch", [ORG_READ, ORG_UPDATE]);
    expect("invalidSlugs" in result).toBe(true);
    if ("invalidSlugs" in result) {
      expect(result.invalidSlugs).toContain(ORG_READ);
      expect(result.invalidSlugs).toContain(ORG_UPDATE);
    }
  });
});

// ---------------------------------------------------------------------------
// T-ORG-GROUP: groupMembersByBranch()
// ---------------------------------------------------------------------------

describe("T-ORG-GROUP: groupMembersByBranch()", () => {
  it("places members with no branch roles in unassigned group", () => {
    const members = [makeMemberWithNoRoles(), makeMemberWithNoRoles()];
    const groups = groupMembersByBranch(members, new Map());
    expect(groups).toHaveLength(1);
    expect(groups[0].branchId).toBeNull();
    expect(groups[0].members).toHaveLength(2);
  });

  it("places org-only members in unassigned group", () => {
    const members = [makeOrgMember(ORG_ID)];
    const groups = groupMembersByBranch(members, new Map());
    expect(groups).toHaveLength(1);
    expect(groups[0].branchId).toBeNull();
    expect(groups[0].members).toHaveLength(1);
  });

  it("places branch members in correct branch group", () => {
    const members = [makeBranchMember(BRANCH_A)];
    const nameMap = new Map([[BRANCH_A, "Alpha Branch"]]);
    const groups = groupMembersByBranch(members, nameMap);
    expect(groups).toHaveLength(1);
    expect(groups[0].branchId).toBe(BRANCH_A);
    expect(groups[0].branchName).toBe("Alpha Branch");
    expect(groups[0].members).toHaveLength(1);
  });

  it("places member in multiple groups when they have roles in multiple branches", () => {
    const member = makeMemberWithRoles([
      { scope: "branch", scope_id: BRANCH_A },
      { scope: "branch", scope_id: BRANCH_B },
    ]);
    const nameMap = new Map([
      [BRANCH_A, "Alpha"],
      [BRANCH_B, "Beta"],
    ]);
    const groups = groupMembersByBranch([member], nameMap);
    expect(groups).toHaveLength(2);
    const branchIds = groups.map((g) => g.branchId);
    expect(branchIds).toContain(BRANCH_A);
    expect(branchIds).toContain(BRANCH_B);
  });

  it("deduplicates branch assignment when member has two roles in same branch", () => {
    const member = makeMemberWithRoles([
      { scope: "branch", scope_id: BRANCH_A },
      { scope: "branch", scope_id: BRANCH_A }, // duplicate
    ]);
    const nameMap = new Map([[BRANCH_A, "Alpha"]]);
    const groups = groupMembersByBranch([member], nameMap);
    // Only one group for BRANCH_A, member appears once
    const alphaGroup = groups.find((g) => g.branchId === BRANCH_A);
    expect(alphaGroup?.members).toHaveLength(1);
  });

  it("sorts branch groups by name, unassigned group is last", () => {
    const memberA = makeBranchMember(BRANCH_A);
    const memberB = makeBranchMember(BRANCH_B);
    const unassigned = makeMemberWithNoRoles();
    const nameMap = new Map([
      [BRANCH_A, "Zeta"],
      [BRANCH_B, "Alpha"],
    ]);
    const groups = groupMembersByBranch([memberA, memberB, unassigned], nameMap);
    expect(groups).toHaveLength(3);
    expect(groups[0].branchName).toBe("Alpha");
    expect(groups[1].branchName).toBe("Zeta");
    expect(groups[2].branchId).toBeNull(); // unassigned last
  });

  it("does not include unassigned group when all members have branch roles", () => {
    const members = [makeBranchMember(BRANCH_A), makeBranchMember(BRANCH_B)];
    const nameMap = new Map([
      [BRANCH_A, "Alpha"],
      [BRANCH_B, "Beta"],
    ]);
    const groups = groupMembersByBranch(members, nameMap);
    expect(groups.every((g) => g.branchId !== null)).toBe(true);
  });

  it("returns empty array for empty member list", () => {
    const groups = groupMembersByBranch([], new Map());
    expect(groups).toEqual([]);
  });

  it("branchName falls back to null when branchId not in name map", () => {
    const member = makeBranchMember(BRANCH_A);
    const groups = groupMembersByBranch([member], new Map()); // no entry for BRANCH_A
    expect(groups[0].branchName).toBeNull();
  });
});
