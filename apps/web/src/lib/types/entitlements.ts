/**
 * Entitlements Type Definitions
 *
 * These types define the structure of organization entitlements used throughout the application.
 * They follow the SSR-first pattern where entitlements are loaded on the server and hydrated to the client.
 */

/**
 * Compiled organization entitlements (single source of truth)
 *
 * This represents the fully computed entitlements for an organization,
 * combining the base plan + active addons + custom overrides.
 *
 * **Architecture**: Compiled at write-time (not read-time)
 * - Updated automatically via database triggers when subscriptions/addons/overrides change
 * - Loaded in SSR via a single row query (fast)
 * - No runtime computation needed
 */
export interface OrganizationEntitlements {
  organization_id: string;
  plan_id: string | null;
  plan_name: string;
  enabled_modules: string[];
  enabled_contexts: string[];
  features: Record<string, boolean | number | string>;
  limits: Record<string, number>;
  updated_at: string;
}

/**
 * Limit check result (for UI feedback)
 */
export interface LimitCheckResult {
  limit: number; // -1 means unlimited
  current: number;
  canProceed: boolean;
  percentageUsed?: number;
}

/**
 * Entitlement error codes (for typed error handling)
 */
export type EntitlementErrorCode =
  | "MODULE_ACCESS_DENIED"
  | "FEATURE_UNAVAILABLE"
  | "LIMIT_EXCEEDED"
  | "LIMIT_CHECK_FAILED" // Count query failed - fail-closed
  | "NO_ACTIVE_SUBSCRIPTION"
  | "ENTITLEMENTS_MISSING";

/**
 * Entitlement error context (for detailed error messages)
 */
export interface EntitlementErrorContext {
  orgId: string;
  moduleSlug?: string;
  featureKey?: string;
  limitKey?: string;
  current?: number;
  limit?: number;
  planName?: string;
}

/**
 * Entitlement error class (for server actions)
 */
export class EntitlementError extends Error {
  constructor(
    public code: EntitlementErrorCode,
    public context: EntitlementErrorContext
  ) {
    super(`Entitlement error: ${code}`);
    this.name = "EntitlementError";
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      context: this.context,
      message: this.message,
    };
  }
}

/**
 * Limit keys registry (namespaced format)
 *
 * **FORMAT**: module.limit_name (flat JSONB keys with dot notation)
 *
 * These keys MUST match exactly what's stored in:
 * - subscription_plans.limits (JSONB keys)
 * - organization_entitlements.limits (JSONB keys)
 * - organization_limit_overrides.limit_key (text column)
 *
 * **IMPORTANT**: The dot (.) is just a naming convention — it's NOT a JSONB path separator.
 * The key "warehouse.max_products" is a single top-level JSONB key.
 */
export const LIMIT_KEYS = {
  // Warehouse module limits (derived — count rows)
  WAREHOUSE_MAX_PRODUCTS: "warehouse.max_products",
  WAREHOUSE_MAX_LOCATIONS: "warehouse.max_locations",
  WAREHOUSE_MAX_BRANCHES: "warehouse.max_branches",

  // Organization limits (derived)
  ORGANIZATION_MAX_USERS: "organization.max_users",

  // Analytics module limits (metered — counter in subscription_usage)
  ANALYTICS_MONTHLY_EXPORTS: "analytics.monthly_exports",
} as const;

export type LimitKey = (typeof LIMIT_KEYS)[keyof typeof LIMIT_KEYS];

/**
 * Limit strategy definition
 *
 * "derived" = count rows in a table (e.g., products, locations)
 *   - Always current, no counter drift
 *   - Requires partial index for performance
 *   - Uses explicit WHERE filters (no assumptions about table structure)
 *
 * "metered" = increment counter in subscription_usage table
 *   - For event-based limits (exports, API calls)
 *   - Resets per billing period
 */
export type WhereFilter = {
  col: string;
  op: "eq" | "is" | "neq";
  value: string | null | "$orgId";
};

export interface DerivedStrategy {
  type: "derived";
  table: string;
  where: WhereFilter[];
}

export interface MeteredStrategy {
  type: "metered";
  periodBoundary: "month" | "day"; // For future: daily vs monthly limits
}

export type LimitStrategy = DerivedStrategy | MeteredStrategy;

/**
 * Limit strategies per key
 *
 * **Important**: Filters are explicit — no assumptions about table structure.
 * - "$orgId" is replaced with actual org ID at query time
 * - All limits are org-wide (no branch-scoped limits)
 */
export const LIMIT_STRATEGIES: Record<LimitKey, LimitStrategy> = {
  [LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS]: {
    type: "derived",
    table: "products",
    where: [
      { col: "organization_id", op: "eq", value: "$orgId" },
      { col: "deleted_at", op: "is", value: null },
    ],
  },
  [LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS]: {
    type: "derived",
    table: "locations",
    where: [
      { col: "organization_id", op: "eq", value: "$orgId" },
      { col: "deleted_at", op: "is", value: null },
    ],
  },
  [LIMIT_KEYS.WAREHOUSE_MAX_BRANCHES]: {
    type: "derived",
    table: "branches",
    where: [
      { col: "organization_id", op: "eq", value: "$orgId" },
      { col: "deleted_at", op: "is", value: null },
    ],
  },
  [LIMIT_KEYS.ORGANIZATION_MAX_USERS]: {
    type: "derived",
    table: "organization_members",
    where: [
      { col: "organization_id", op: "eq", value: "$orgId" },
      { col: "status", op: "eq", value: "active" },
      { col: "deleted_at", op: "is", value: null },
    ],
  },
  [LIMIT_KEYS.ANALYTICS_MONTHLY_EXPORTS]: {
    type: "metered",
    periodBoundary: "month",
  },
};
