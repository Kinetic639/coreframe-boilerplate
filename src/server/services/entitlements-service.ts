"use server";

import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import {
  EntitlementError,
  LIMIT_STRATEGIES,
  type LimitKey,
  type LimitCheckResult,
  type OrganizationEntitlements,
  type DerivedStrategy,
  type MeteredStrategy,
} from "@/lib/types/entitlements";

/**
 * Request-scoped cache for loadEntitlements.
 * React cache() ensures multiple calls with the same orgId within a single
 * request only hit the DB once. Automatically cleaned up between requests.
 */
const cachedLoadEntitlements = cache(
  async (orgId: string): Promise<OrganizationEntitlements | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("organization_entitlements")
      .select("*")
      .eq("organization_id", orgId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as OrganizationEntitlements;
  }
);

/**
 * Entitlements Service (Server-Side)
 *
 * This service provides server-side entitlement checking and limit enforcement.
 * All methods are "use server" and safe to call from server components and server actions.
 *
 * **Architecture**:
 * - Reads from pre-compiled `organization_entitlements` table (single source of truth)
 * - No runtime computation — entitlements are updated via database triggers
 * - All checks are authoritative and cannot be bypassed by client code
 *
 * **Performance**:
 * - Entitlements: Single row query (~1ms)
 * - Limit counts: Uses partial indexes + select("id", ...) for efficiency
 *
 * @example
 * ```typescript
 * // In a server action
 * import { EntitlementsService } from "@/server/services/entitlements-service";
 *
 * export async function createProduct(orgId: string, data: ProductData) {
 *   // Check module access
 *   await EntitlementsService.requireModuleAccess(orgId, "warehouse");
 *
 *   // Check limit
 *   await EntitlementsService.requireWithinLimit(orgId, LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS);
 *
 *   // Proceed with creation...
 * }
 * ```
 */
export class EntitlementsService {
  /**
   * Load organization entitlements (compiled snapshot)
   *
   * @param orgId - Organization ID
   * @returns Entitlements or null if not found
   */
  static async loadEntitlements(orgId: string): Promise<OrganizationEntitlements | null> {
    return cachedLoadEntitlements(orgId);
  }

  /**
   * Resolve entitlements: use provided snapshot or fall back to DB load.
   *
   * @param orgId - Organization ID
   * @param entitlements - If provided (even null), returned as-is. If undefined, loads from DB.
   * @returns Entitlements or null
   */
  private static async resolveEntitlements(
    orgId: string,
    entitlements?: OrganizationEntitlements | null
  ): Promise<OrganizationEntitlements | null> {
    // IMPORTANT: `undefined` means "no snapshot provided → load from DB".
    // `null` means "snapshot explicitly absent/untrusted → treat as missing" (do NOT auto-load).
    if (entitlements !== undefined) {
      return entitlements;
    }
    return this.loadEntitlements(orgId);
  }

  /**
   * Check if organization has access to a module
   *
   * @param orgId - Organization ID
   * @param moduleSlug - Module slug (e.g., "warehouse", "analytics")
   * @param entitlements - Optional pre-loaded entitlements (avoids DB query)
   * @returns True if module is enabled
   */
  static async hasModuleAccess(
    orgId: string,
    moduleSlug: string,
    entitlements?: OrganizationEntitlements | null
  ): Promise<boolean> {
    const ents = await this.resolveEntitlements(orgId, entitlements);

    if (!ents) {
      return false;
    }

    return ents.enabled_modules.includes(moduleSlug);
  }

  /**
   * Require module access (throws if denied)
   *
   * Use this in server actions to enforce module-level access control.
   *
   * @param orgId - Organization ID
   * @param moduleSlug - Module slug
   * @param entitlements - Optional pre-loaded entitlements (avoids DB query)
   * @throws EntitlementError if access denied
   */
  static async requireModuleAccess(
    orgId: string,
    moduleSlug: string,
    entitlements?: OrganizationEntitlements | null
  ): Promise<void> {
    const ents = await this.resolveEntitlements(orgId, entitlements);

    if (!ents) {
      throw new EntitlementError("ENTITLEMENTS_MISSING", { orgId });
    }

    if (!ents.enabled_modules.includes(moduleSlug)) {
      throw new EntitlementError("MODULE_ACCESS_DENIED", {
        orgId,
        moduleSlug,
        planName: ents.plan_name,
      });
    }
  }

  /**
   * Check if organization has a feature enabled
   *
   * @param orgId - Organization ID
   * @param featureKey - Feature key (e.g., "basic_support", "advanced_analytics")
   * @param entitlements - Optional pre-loaded entitlements (avoids DB query)
   * @returns True if feature is enabled
   */
  static async hasFeatureAccess(
    orgId: string,
    featureKey: string,
    entitlements?: OrganizationEntitlements | null
  ): Promise<boolean> {
    const ents = await this.resolveEntitlements(orgId, entitlements);

    if (!ents) {
      return false;
    }

    return ents.features[featureKey] === true;
  }

  /**
   * Require feature access (throws if denied)
   *
   * @param orgId - Organization ID
   * @param featureKey - Feature key
   * @param entitlements - Optional pre-loaded entitlements (avoids DB query)
   * @throws EntitlementError if feature unavailable
   */
  static async requireFeatureAccess(
    orgId: string,
    featureKey: string,
    entitlements?: OrganizationEntitlements | null
  ): Promise<void> {
    const ents = await this.resolveEntitlements(orgId, entitlements);

    if (!ents) {
      throw new EntitlementError("ENTITLEMENTS_MISSING", { orgId });
    }

    const hasFeature = ents.features[featureKey] === true;
    if (!hasFeature) {
      throw new EntitlementError("FEATURE_UNAVAILABLE", {
        orgId,
        featureKey,
        planName: ents.plan_name,
      });
    }
  }

  /**
   * Get effective limit for organization
   *
   * @param orgId - Organization ID
   * @param limitKey - Limit key (use LIMIT_KEYS constants)
   * @param entitlements - Optional pre-loaded entitlements (avoids DB query)
   * @returns Limit value (-1 means unlimited, 0+ means cap)
   */
  static async getEffectiveLimit(
    orgId: string,
    limitKey: LimitKey,
    entitlements?: OrganizationEntitlements | null
  ): Promise<number> {
    const ents = await this.resolveEntitlements(orgId, entitlements);

    if (!ents) {
      return 0;
    }

    const limit = ents.limits[limitKey];
    if (typeof limit !== "number") {
      return 0;
    }
    return limit;
  }

  /**
   * Get current usage for a limit
   *
   * **Performance**: Uses select("id", ...) instead of select("*", ...)
   * to avoid fetching full rows. Combined with partial indexes, this is
   * efficient even for large tables.
   *
   * **Fail-Closed**: Throws on errors in enforcement paths
   *
   * @param orgId - Organization ID
   * @param limitKey - Limit key
   * @returns Current usage count
   * @throws Error if strategy unknown or count fails
   */
  static async getCurrentUsage(orgId: string, limitKey: LimitKey): Promise<number> {
    const strategy = LIMIT_STRATEGIES[limitKey];

    if (!strategy) {
      throw new Error(`Unknown limit key: ${limitKey}`);
    }

    if (strategy.type === "derived") {
      return this.getDerivedCount(orgId, strategy);
    } else {
      return this.getMeteredUsage(orgId, limitKey, strategy);
    }
  }

  /**
   * Check limit (returns status without throwing)
   *
   * Use this for UI feedback (e.g., progress bars, warnings).
   *
   * **Error Handling**: Returns null on errors (UI path can show "unknown" status).
   * For enforcement, use requireWithinLimit() which throws.
   *
   * @param orgId - Organization ID
   * @param limitKey - Limit key
   * @param entitlements - Optional pre-loaded entitlements (avoids DB query for limit lookup)
   * @returns Limit check result, or null if check failed
   */
  static async checkLimit(
    orgId: string,
    limitKey: LimitKey,
    entitlements?: OrganizationEntitlements | null
  ): Promise<LimitCheckResult | null> {
    try {
      const limit = await this.getEffectiveLimit(orgId, limitKey, entitlements);

      // -1 means unlimited
      if (limit === -1) {
        return { limit: -1, current: 0, canProceed: true };
      }

      const current = await this.getCurrentUsage(orgId, limitKey);

      return {
        limit,
        current,
        canProceed: current < limit,
        percentageUsed: limit > 0 ? Math.round((current / limit) * 100) : 0,
      };
    } catch (error) {
      // UI path: log error and return null (UI can show "unknown")
      console.error(`[Entitlements] Failed to check limit ${limitKey}:`, error);
      return null;
    }
  }

  /**
   * Require within limit (throws if exceeded)
   *
   * Use this in server actions before creating resources.
   *
   * **Fail-Closed**: Throws on ANY error (including count failures).
   * This ensures limits are enforced even if count queries fail.
   *
   * @param orgId - Organization ID
   * @param limitKey - Limit key
   * @param entitlements - Optional pre-loaded entitlements (avoids DB query for limit lookup)
   * @throws EntitlementError if limit exceeded or check fails
   */
  static async requireWithinLimit(
    orgId: string,
    limitKey: LimitKey,
    entitlements?: OrganizationEntitlements | null
  ): Promise<void> {
    try {
      const limit = await this.getEffectiveLimit(orgId, limitKey, entitlements);

      // -1 means unlimited
      if (limit === -1) {
        return;
      }

      // This will throw if count fails (fail-closed)
      const current = await this.getCurrentUsage(orgId, limitKey);

      if (current >= limit) {
        throw new EntitlementError("LIMIT_EXCEEDED", {
          orgId,
          limitKey,
          current,
          limit,
        });
      }
    } catch (error) {
      // If it's already an EntitlementError, re-throw as-is
      if (error instanceof EntitlementError) {
        throw error;
      }

      // Otherwise, wrap as LIMIT_CHECK_FAILED
      throw new EntitlementError("LIMIT_CHECK_FAILED", {
        orgId,
        limitKey,
      });
    }
  }

  /**
   * Get derived count from table with explicit filters
   *
   * **Performance**: Uses select("id", {count: "exact", head: true}) which:
   * - Only counts rows (no data fetch)
   * - Uses index-only scan when partial index exists
   * - Fast even for large tables (< 10ms for 100K rows)
   *
   * **Fail-Closed**: Throws error on query failure (no silent 0 return)
   *
   * @private
   */
  private static async getDerivedCount(orgId: string, strategy: DerivedStrategy): Promise<number> {
    const supabase = await createClient();

    let query = supabase.from(strategy.table).select("id", { count: "exact", head: true });

    // Apply explicit WHERE filters
    for (const filter of strategy.where) {
      let value = filter.value;

      // Replace $orgId placeholder with actual value
      if (value === "$orgId") {
        value = orgId;
      }

      // Apply filter based on operator
      switch (filter.op) {
        case "eq":
          query = query.eq(filter.col, value);
          break;
        case "neq":
          query = query.neq(filter.col, value);
          break;
        case "is":
          query = query.is(filter.col, value);
          break;
        default:
          throw new Error(`Unknown operator: ${filter.op}`);
      }
    }

    const { count, error } = await query;

    if (error) {
      // FAIL-CLOSED: Throw error instead of returning 0
      throw new Error(`Failed to count ${strategy.table} for limit check: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Get metered usage from subscription_usage table
   *
   * period_start is TIMESTAMPTZ with UNIQUE(organization_id, feature_key, period_start).
   * We use a range query [start, nextStart) with order+limit(1) instead of .single()
   * to be resilient against edge cases (backfills, clock skew, non-canonical boundaries).
   * If multiple rows match the range, the latest period_start wins deterministically.
   *
   * @private
   */
  private static async getMeteredUsage(
    orgId: string,
    limitKey: LimitKey,
    strategy: MeteredStrategy
  ): Promise<number> {
    const supabase = await createClient();

    // Compute period boundaries (always UTC).
    // period_start is TIMESTAMPTZ, so we use a range query [start, nextStart)
    // to avoid string vs timestamptz comparison mismatches.
    const now = new Date();
    let periodStart: string;
    let nextPeriodStart: string;

    if (strategy.periodBoundary === "month") {
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth(); // 0-indexed
      periodStart = new Date(Date.UTC(year, month, 1)).toISOString();
      nextPeriodStart = new Date(Date.UTC(year, month + 1, 1)).toISOString();
    } else {
      // Daily boundary
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth();
      const day = now.getUTCDate();
      periodStart = new Date(Date.UTC(year, month, day)).toISOString();
      nextPeriodStart = new Date(Date.UTC(year, month, day + 1)).toISOString();
    }

    // Use order+limit instead of .single() — resilient if range matches multiple rows.
    // Deterministically picks the latest period_start within range.
    const { data, error } = await supabase
      .from("subscription_usage")
      .select("current_value, period_start")
      .eq("organization_id", orgId)
      .eq("feature_key", limitKey)
      .gte("period_start", periodStart)
      .lt("period_start", nextPeriodStart)
      .order("period_start", { ascending: false })
      .limit(2);

    if (error) {
      // Fail-closed: throw on real DB errors
      throw new Error(`Failed to get metered usage for ${limitKey}: ${error.message}`);
    }

    // No rows = usage is 0 (not an error)
    if (!data || data.length === 0) {
      return 0;
    }

    // Observability: warn if multiple rows matched the same billing-period range
    if (data.length >= 2) {
      console.warn(
        `[Entitlements] Duplicate subscription_usage rows in period range: org=${orgId} key=${limitKey} range=[${periodStart}, ${nextPeriodStart}) rows=[${data[0].period_start}, ${data[1].period_start}] using value=${data[0].current_value ?? 0}`
      );
    }

    return data[0].current_value ?? 0;
  }
}
