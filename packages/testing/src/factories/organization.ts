/**
 * Organization Domain Factories
 *
 * Reusable builders for @repo/domain organization test fixtures.
 */

// Inline structural interface — mirrors MemberWithBranchRoles from @repo/domain/organization.
// TypeScript structural subtyping ensures domain types remain assignable without importing domain.
interface MemberWithBranchRoles {
  roles: Array<{ scope: "org" | "branch"; scope_id: string }>;
}

// ---------------------------------------------------------------------------
// MemberWithBranchRoles factory
// ---------------------------------------------------------------------------

/**
 * Build a MemberWithBranchRoles with optional role overrides.
 *
 * @example
 * makeMemberWithRoles([
 *   { scope: "branch", scope_id: BRANCH_ID },
 *   { scope: "org", scope_id: ORG_ID },
 * ])
 */
export function makeMemberWithRoles(
  roles: Array<{ scope: "org" | "branch"; scope_id: string }> = []
): MemberWithBranchRoles {
  return { roles };
}

/**
 * Build a member with no role assignments.
 */
export function makeMemberWithNoRoles(): MemberWithBranchRoles {
  return { roles: [] };
}

/**
 * Build a member with a single org-scoped role.
 */
export function makeOrgMember(orgId: string): MemberWithBranchRoles {
  return { roles: [{ scope: "org", scope_id: orgId }] };
}

/**
 * Build a member with a single branch-scoped role.
 */
export function makeBranchMember(branchId: string): MemberWithBranchRoles {
  return { roles: [{ scope: "branch", scope_id: branchId }] };
}
