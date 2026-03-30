/**
 * @repo/domain — Branch resolution helpers
 *
 * Pure policy functions for resolving active branch context.
 * No I/O, no platform dependencies, no side effects.
 */

/**
 * Resolve the active branch ID from a stored preference against the current
 * accessible branch set.
 *
 * Policy rule (shared invariant across web and mobile):
 *   - If savedBranchId is non-null AND present in accessibleBranchIds → return savedBranchId
 *   - Otherwise → return accessibleBranchIds[0] ?? null
 *
 * Callers are responsible for mapping platform-specific branch objects to string[]
 * before calling, and mapping the resolved ID back to an object if needed.
 *
 * @param savedBranchId       Stored/preferred branch ID (from DB preference or session), or null
 * @param accessibleBranchIds IDs of branches the user is currently allowed to access
 * @returns The resolved active branch ID, or null if no branches are accessible
 */
export function resolveActiveBranch(
  savedBranchId: string | null,
  accessibleBranchIds: string[]
): string | null {
  if (savedBranchId && accessibleBranchIds.includes(savedBranchId)) {
    return savedBranchId;
  }
  return accessibleBranchIds[0] ?? null;
}
