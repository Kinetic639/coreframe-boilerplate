/**
 * Session-local active branch persistence.
 *
 * Stores the active branch ID in sessionStorage keyed by org, giving each
 * browser tab its own independent working branch. This prevents one client
 * (e.g. mobile) writing default_branch_id to the DB from silently changing
 * the working branch of an already-open web tab on its next refresh.
 *
 * Key design decisions:
 * - sessionStorage is tab-isolated: two tabs can hold different active branches.
 * - The key is org-scoped: switching orgs naturally starts a fresh branch context.
 * - All operations are try/catch-wrapped: private browsing and storage quota
 *   failures are silently ignored — callers must not depend on storage succeeding.
 *
 * Lifecycle:
 *   Fresh tab        → no entry → initialize from default_branch_id (DB default)
 *   Existing tab     → entry present → override SSR-derived branch if accessible
 *   Branch switch    → setSessionBranchId called by app-store setActiveBranch
 *   Stale entry      → cleared by _providers.tsx hydration logic, then re-initialized
 */

const sessionKey = (orgId: string) => `active-branch:${orgId}`;

/**
 * Returns the session-local active branch ID for the given org, or null if
 * none is stored (fresh tab) or storage is unavailable.
 */
export function getSessionBranchId(orgId: string): string | null {
  try {
    return sessionStorage.getItem(sessionKey(orgId));
  } catch {
    return null;
  }
}

/**
 * Saves the active branch ID for the given org to sessionStorage.
 * Silently no-ops if storage is unavailable.
 */
export function setSessionBranchId(orgId: string, branchId: string): void {
  try {
    sessionStorage.setItem(sessionKey(orgId), branchId);
  } catch {
    // ignore: private browsing, storage quota, SSR
  }
}

/**
 * Removes the active-branch entry for the given org from sessionStorage.
 * Called when the stored branch is no longer accessible (access revoked,
 * branch deleted) so the stale ID is not re-read on subsequent refreshes.
 */
export function clearSessionBranchId(orgId: string): void {
  try {
    sessionStorage.removeItem(sessionKey(orgId));
  } catch {
    // ignore
  }
}
