/**
 * Organization & Branch — Pure Domain Logic
 *
 * Pure functions and constants for organization/branch business rules.
 *
 * No Supabase, no Next.js, no React.
 * All DB access stays in apps/web/src/server/services/organization.service.ts.
 */

import {
  BRANCHES_CREATE,
  BRANCHES_DELETE,
  BRANCHES_UPDATE,
  INVITES_CANCEL,
  INVITES_CREATE,
  INVITES_READ,
  MEMBERS_MANAGE,
  MEMBERS_READ,
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  ORG_READ,
  ORG_UPDATE,
} from "@repo/contracts/permissions";

// ---------------------------------------------------------------------------
// Org-only permission set
// ---------------------------------------------------------------------------

/**
 * Permissions that are meaningful only at org scope.
 *
 * Branch-scoped roles must NOT be assigned any of these slugs.
 * The DB enforces this via the `validate_role_assignment_scope` trigger;
 * this set lets the application layer validate and surface a clear error
 * before any DB round-trip.
 *
 * Note: branch.roles.manage (BRANCH_ROLES_MANAGE) is intentionally excluded —
 * it IS a branch-scope permission that delegates role assignment within a branch.
 */
export const ORG_ONLY_PERMISSIONS = new Set<string>([
  ORG_READ,
  ORG_UPDATE,
  BRANCHES_CREATE,
  BRANCHES_UPDATE,
  BRANCHES_DELETE,
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  MEMBERS_READ,
  MEMBERS_MANAGE,
  INVITES_READ,
  INVITES_CREATE,
  INVITES_CANCEL,
]);

/**
 * Returns true if the given permission slug is org-scope-only.
 * Branch-scoped roles must not contain org-only permissions.
 */
export function isOrgOnlyPermission(slug: string): boolean {
  return ORG_ONLY_PERMISSIONS.has(slug);
}

// ---------------------------------------------------------------------------
// Branch role permission validation
// ---------------------------------------------------------------------------

/**
 * Validate that a set of permission slugs is compatible with the given role scope.
 *
 * Branch-scoped roles may not contain org-only permissions.
 * Org-scoped roles may contain any permission.
 *
 * @param scopeType  Role scope — "org" or "branch"
 * @param permissionSlugs  Permissions being assigned to the role
 * @returns `{ valid: true }` or `{ valid: false; invalidSlugs: string[] }`
 *
 * @example
 * validateBranchRolePermissions("branch", ["members.read", "branch.roles.manage"])
 * // { valid: false, invalidSlugs: ["members.read"] }
 *
 * validateBranchRolePermissions("branch", ["branch.roles.manage"])
 * // { valid: true }
 *
 * validateBranchRolePermissions("org", ["members.read"])
 * // { valid: true }
 */
export function validateBranchRolePermissions(
  scopeType: "org" | "branch",
  permissionSlugs: string[]
): { valid: true } | { valid: false; invalidSlugs: string[] } {
  if (scopeType === "org") {
    return { valid: true };
  }

  const invalidSlugs = permissionSlugs.filter((s) => ORG_ONLY_PERMISSIONS.has(s));

  if (invalidSlugs.length === 0) {
    return { valid: true };
  }

  return { valid: false, invalidSlugs };
}

// ---------------------------------------------------------------------------
// Member grouping by branch
// ---------------------------------------------------------------------------

/**
 * Minimal structural interface for member grouping.
 * Callers pass their full member objects — TypeScript structural subtyping
 * ensures compatibility without casts.
 */
export interface MemberWithBranchRoles {
  roles: Array<{ scope: "org" | "branch"; scope_id: string }>;
}

/**
 * One group in the result of groupMembersByBranch.
 * Generic over the member type so callers keep their concrete member shape.
 */
export interface BranchMemberGroup<T extends MemberWithBranchRoles = MemberWithBranchRoles> {
  /** Branch UUID, or null for the "org-only / unassigned" group. */
  branchId: string | null;
  /** Branch display name, or null for the unassigned group. */
  branchName: string | null;
  /** Members in this group. */
  members: T[];
}

/**
 * Group pre-fetched organization members by branch assignment.
 *
 * Algorithm:
 * 1. For each member, find all branch-scoped role assignments.
 * 2. If none, place member in the "unassigned" group (branchId: null).
 * 3. If any, place member in each distinct branch group (member appears
 *    in multiple groups if they have roles in multiple branches).
 * 4. Sort branch groups by branch name; unassigned group is always last.
 *
 * Pure function — takes already-fetched data, performs no I/O.
 *
 * @param members   Members with role assignments already loaded
 * @param branchNameMap   Map of branch UUID → branch name (or null)
 * @returns Grouped members, sorted by branch name, unassigned last
 */
export function groupMembersByBranch<T extends MemberWithBranchRoles>(
  members: T[],
  branchNameMap: Map<string, string | null>
): BranchMemberGroup<T>[] {
  const branchGroups = new Map<string, T[]>();
  const unassigned: T[] = [];

  for (const member of members) {
    const branchRoles = member.roles.filter((r) => r.scope === "branch");
    if (branchRoles.length === 0) {
      unassigned.push(member);
      continue;
    }
    const seenBranches = new Set<string>();
    for (const role of branchRoles) {
      if (seenBranches.has(role.scope_id)) continue;
      seenBranches.add(role.scope_id);
      const existing = branchGroups.get(role.scope_id) ?? [];
      existing.push(member);
      branchGroups.set(role.scope_id, existing);
    }
  }

  const result: BranchMemberGroup<T>[] = [];
  for (const [branchId, branchMembers] of branchGroups) {
    result.push({
      branchId,
      branchName: branchNameMap.get(branchId) ?? null,
      members: branchMembers,
    });
  }
  result.sort((a, b) => (a.branchName ?? "").localeCompare(b.branchName ?? ""));

  if (unassigned.length > 0) {
    result.push({ branchId: null, branchName: null, members: unassigned });
  }

  return result;
}
