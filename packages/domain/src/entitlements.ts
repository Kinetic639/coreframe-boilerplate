/**
 * Entitlement Domain Logic
 *
 * Pure decision functions that answer entitlement questions given a
 * pre-loaded OrganizationEntitlements snapshot.
 *
 * These functions contain no DB access, no async logic, and no platform
 * runtime dependencies. They are mechanical extractions of the inner
 * decision logic from apps/web EntitlementsService — behavior is identical.
 *
 * The app-local EntitlementsService is responsible for loading snapshots
 * from the database and for enforcement (throwing EntitlementError).
 * These functions evaluate decisions against an already-loaded snapshot.
 */

import type {
  OrganizationEntitlements,
  LimitKey,
  LimitCheckResult,
} from "@repo/contracts/entitlements";

/**
 * Check if an organization has access to a module.
 *
 * Mechanical extract of the inner decision from EntitlementsService.hasModuleAccess().
 *
 * @param entitlements - Pre-loaded org entitlements snapshot, or null if unavailable.
 * @param moduleSlug - Module slug to check (e.g. "warehouse").
 * @returns true if the module is in enabled_modules; false if entitlements missing or module absent.
 */
export function hasModuleAccess(
  entitlements: OrganizationEntitlements | null,
  moduleSlug: string
): boolean {
  if (!entitlements) return false;
  return entitlements.enabled_modules.includes(moduleSlug);
}

/**
 * Get the effective numeric limit for a given limit key.
 *
 * Mechanical extract of the inner decision from EntitlementsService.getEffectiveLimit().
 *
 * @param entitlements - Pre-loaded org entitlements snapshot, or null if unavailable.
 * @param limitKey - Limit key to look up (use LIMIT_KEYS constants from @repo/contracts).
 * @returns Limit value. -1 means unlimited. 0 if entitlements missing or key absent/non-numeric.
 */
export function getEffectiveLimit(
  entitlements: OrganizationEntitlements | null,
  limitKey: LimitKey
): number {
  if (!entitlements) return 0;
  const limit = entitlements.limits[limitKey];
  if (typeof limit !== "number") return 0;
  return limit;
}

/**
 * Compute a LimitCheckResult from a limit value and a current usage count.
 *
 * Mechanical extract of the pure arithmetic from EntitlementsService.checkLimit().
 * The DB count query (getCurrentUsage) remains in EntitlementsService.
 *
 * @param limit - Effective limit value from getEffectiveLimit(). -1 means unlimited.
 * @param current - Current usage count from the DB.
 * @returns LimitCheckResult describing whether the limit is exceeded and by how much.
 */
export function checkLimitStatus(limit: number, current: number): LimitCheckResult {
  if (limit === -1) {
    return { limit: -1, current: 0, canProceed: true };
  }
  return {
    limit,
    current,
    canProceed: current < limit,
    percentageUsed: limit > 0 ? Math.round((current / limit) * 100) : 0,
  };
}
