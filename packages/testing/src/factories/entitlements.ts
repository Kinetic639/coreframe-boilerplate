/**
 * Entitlement Snapshot Factories
 *
 * Reusable builders for OrganizationEntitlements test fixtures.
 * Used by @repo/domain tests and apps/web tests.
 */

import type { OrganizationEntitlements } from "@repo/contracts/entitlements";

const DEFAULT_ENTITLEMENTS: OrganizationEntitlements = {
  organization_id: "00000000-0000-0000-0000-000000000001",
  plan_id: "plan-basic",
  enabled_modules: [],
  contexts: [],
  limits: {},
  updated_at: "2026-01-01T00:00:00.000Z",
};

/**
 * Build an OrganizationEntitlements object with optional overrides.
 *
 * @example
 * makeOrganizationEntitlements({ enabled_modules: ["warehouse", "tools"] })
 * makeOrganizationEntitlements({ limits: { members: 5 } })
 */
export function makeOrganizationEntitlements(
  overrides?: Partial<OrganizationEntitlements>
): OrganizationEntitlements {
  return { ...DEFAULT_ENTITLEMENTS, ...overrides };
}

/**
 * Build entitlements with the given modules enabled.
 *
 * @example
 * makeEntitlementsWithModules("warehouse", "tools")
 */
export function makeEntitlementsWithModules(...moduleSlug: string[]): OrganizationEntitlements {
  return { ...DEFAULT_ENTITLEMENTS, enabled_modules: moduleSlug };
}

/**
 * Build entitlements with the given numeric limits.
 *
 * @example
 * makeEntitlementsWithLimits({ members: 10, branches: 3 })
 */
export function makeEntitlementsWithLimits(
  limits: Record<string, number>
): OrganizationEntitlements {
  return { ...DEFAULT_ENTITLEMENTS, limits };
}
