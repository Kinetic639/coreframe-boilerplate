"use server";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import {
  EntitlementError,
  type EntitlementErrorCode,
  type EntitlementErrorContext,
  type LimitKey,
  type LimitCheckResult,
  type OrganizationEntitlements,
} from "@/lib/types/entitlements";
import { EntitlementsService } from "@/server/services/entitlements-service";

/**
 * Entitlements Guards (Server-Side)
 *
 * **Architecture**:
 * - Thin wrapper around EntitlementsService (no duplication)
 * - Auto-extracts org context (callers don't pass orgId)
 * - Adds app-specific behaviors (redirects, error mapping)
 * - No `this` usage - safe for destructuring
 *
 * **Usage**:
 * ```typescript
 * import { entitlements } from "@/server/guards/entitlements-guards";
 *
 * export async function createLocation(data) {
 *   const ctx = await entitlements.requireOrgContext();
 *   await entitlements.requireModuleAccess("warehouse");
 *   await entitlements.requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);
 *   // Create location...
 * }
 *
 * // Safe destructuring:
 * const { requireWithinLimit } = entitlements;
 * await requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);
 * ```
 */

/**
 * Organization context extracted from session + app context
 */
export interface OrgContext {
  userId: string;
  orgId: string;
  branchId: string | null;
  /** undefined = no snapshot available (service will load from DB), null = explicitly missing */
  entitlements: OrganizationEntitlements | null | undefined;
}

/**
 * Request-scoped context getter (using React cache)
 *
 * This ensures context is NOT leaked across concurrent requests.
 * React's cache() creates a per-request cache that is automatically cleaned up.
 */
const getOrgContext = cache(async (): Promise<OrgContext> => {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("EntitlementsGuard: Unauthorized - no session");
  }

  const appContext = await loadAppContextServer();
  if (!appContext?.activeOrgId) {
    throw new Error("EntitlementsGuard: No active organization");
  }

  // Snapshot trust boundary: verify entitlements belong to the active org.
  // If mismatch (edge case / bug), discard snapshot — service will fall back to DB.
  // Use undefined (not null) so resolveEntitlements triggers a fresh DB load.
  let ents: OrganizationEntitlements | null | undefined = appContext.entitlements;
  const entOrgId = ents?.organization_id;
  if (entOrgId && entOrgId !== appContext.activeOrgId) {
    ents = undefined;
  }

  return {
    userId: session.user.id,
    orgId: appContext.activeOrgId,
    branchId: appContext.activeBranchId,
    entitlements: ents,
  };
});

// ============================================================================
// GUARD FUNCTIONS (no `this` usage - safe for destructuring)
// ============================================================================

/**
 * Require organization context (auth + org)
 *
 * Extracts org context for the current request.
 * Uses React's cache() for request-scoped caching (no cross-request leakage).
 *
 * @returns OrgContext with userId, orgId, branchId, entitlements
 * @throws Error if no session or no active organization
 *
 * @example
 * ```typescript
 * const ctx = await entitlements.requireOrgContext();
 * // ctx has: { userId, orgId, branchId, entitlements }
 * ```
 */
async function requireOrgContext(): Promise<OrgContext> {
  return await getOrgContext();
}

/**
 * Require module access (throws if denied)
 *
 * Auto-extracts orgId internally. No need to pass it.
 *
 * @param moduleSlug - Module slug (e.g., "warehouse", "analytics")
 * @throws EntitlementError if access denied
 *
 * @example
 * ```typescript
 * await entitlements.requireModuleAccess("warehouse");
 * // Module access verified
 * ```
 */
async function requireModuleAccess(moduleSlug: string): Promise<void> {
  const ctx = await requireOrgContext();
  await EntitlementsService.requireModuleAccess(ctx.orgId, moduleSlug, ctx.entitlements);
}

/**
 * Require feature access (throws if denied)
 *
 * Auto-extracts orgId internally.
 *
 * @param featureKey - Feature key (e.g., "advanced_analytics")
 * @throws EntitlementError if feature unavailable
 *
 * @example
 * ```typescript
 * await entitlements.requireFeatureAccess("advanced_exports");
 * ```
 */
async function requireFeatureAccess(featureKey: string): Promise<void> {
  const ctx = await requireOrgContext();
  await EntitlementsService.requireFeatureAccess(ctx.orgId, featureKey, ctx.entitlements);
}

/**
 * Require within limit (throws if exceeded)
 *
 * Auto-extracts orgId internally.
 * **Fail-closed**: Throws on any error (including count failures).
 *
 * @param limitKey - Limit key (use LIMIT_KEYS constants)
 * @throws EntitlementError if limit exceeded or check fails
 *
 * @example
 * ```typescript
 * import { LIMIT_KEYS } from "@/lib/types/entitlements";
 *
 * await entitlements.requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);
 * ```
 */
async function requireWithinLimit(limitKey: LimitKey): Promise<void> {
  const ctx = await requireOrgContext();
  await EntitlementsService.requireWithinLimit(ctx.orgId, limitKey, ctx.entitlements);
}

/**
 * Check limit without throwing (for UI feedback)
 *
 * Auto-extracts orgId internally.
 * Returns null on errors (UI can show "unknown" status).
 *
 * @param limitKey - Limit key
 * @returns Limit check result or null if check failed
 *
 * @example
 * ```typescript
 * const status = await entitlements.checkLimit(LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS);
 * if (status) {
 *   // Show: {status.current} / {status.limit}
 * }
 * ```
 */
async function checkLimit(limitKey: LimitKey): Promise<LimitCheckResult | null> {
  const ctx = await requireOrgContext();
  return await EntitlementsService.checkLimit(ctx.orgId, limitKey, ctx.entitlements);
}

// ============================================================================
// REDIRECT WRAPPERS (for pages/route handlers)
// ============================================================================

/**
 * Require module access or redirect to upgrade page
 *
 * **IMPORTANT - Use ONLY in Server Components (page.tsx) or Route Handlers (route.ts)**
 *
 * **DO NOT use in Server Actions** - redirect() in actions is often unwanted behavior.
 * For Server Actions, use `requireModuleAccess()` and handle errors with `mapEntitlementError()`.
 *
 * **Only redirects on MODULE_ACCESS_DENIED** - other errors are thrown.
 *
 * @param moduleSlug - Module slug
 * @param opts - Options: redirectTo (default: "/upgrade")
 * @returns OrgContext if access granted, redirects if MODULE_ACCESS_DENIED
 * @throws EntitlementError for other errors (ENTITLEMENTS_MISSING, etc.)
 *
 * @example Server Component (page.tsx) - ✅ CORRECT
 * ```typescript
 * // app/[locale]/analytics/page.tsx
 * export default async function AnalyticsPage() {
 *   await entitlements.requireModuleOrRedirect("analytics");
 *   // User has access, render page
 * }
 * ```
 *
 * @example Server Action - ❌ WRONG - use requireModuleAccess instead
 * ```typescript
 * // DON'T DO THIS in actions:
 * export async function createAnalyticsReport(data) {
 *   await entitlements.requireModuleOrRedirect("analytics"); // ❌ redirect in action!
 * }
 *
 * // DO THIS instead:
 * export async function createAnalyticsReport(data) {
 *   try {
 *     await entitlements.requireModuleAccess("analytics"); // ✅ throws
 *     // Create report...
 *     return { success: true };
 *   } catch (error) {
 *     const mapped = mapEntitlementError(error);
 *     if (mapped) return { success: false, error: mapped };
 *     throw error;
 *   }
 * }
 * ```
 */
async function requireModuleOrRedirect(
  moduleSlug: string,
  opts?: { redirectTo?: string }
): Promise<OrgContext> {
  // Get context once (not twice)
  const ctx = await requireOrgContext();

  try {
    await EntitlementsService.requireModuleAccess(ctx.orgId, moduleSlug, ctx.entitlements);
    return ctx;
  } catch (error) {
    if (error instanceof EntitlementError) {
      const { code, context } = error;

      // Only redirect on MODULE_ACCESS_DENIED
      if (code === "MODULE_ACCESS_DENIED") {
        // Get plan name from best available source
        const planName = context.planName || ctx.entitlements?.plan_name || "unknown";

        const baseUrl = opts?.redirectTo || "/upgrade";
        const params = new URLSearchParams({
          reason: "module",
          module: moduleSlug,
          plan: planName,
          org: ctx.orgId,
        });

        redirect(`${baseUrl}?${params.toString()}`);
      }

      // For all other errors (ENTITLEMENTS_MISSING, LIMIT_CHECK_FAILED, etc.), throw
      throw error;
    }

    throw error;
  }
}

/**
 * Require within limit or redirect to upgrade page
 *
 * **IMPORTANT - Use ONLY in Server Components (page.tsx) or Route Handlers (route.ts)**
 *
 * **DO NOT use in Server Actions** - redirect() in actions is often unwanted behavior.
 * For Server Actions, use `requireWithinLimit()` and handle errors with `mapEntitlementError()`.
 *
 * **Only redirects on LIMIT_EXCEEDED** - other errors are thrown.
 * Query params only include current/limit if they're present as numbers.
 *
 * @param limitKey - Limit key
 * @param opts - Options: redirectTo (default: "/upgrade")
 * @throws EntitlementError for errors other than LIMIT_EXCEEDED
 *
 * @example Server Component (page.tsx) - ✅ CORRECT
 * ```typescript
 * export default async function LocationsPage() {
 *   await entitlements.requireWithinLimitOrRedirect(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);
 *   // Within limit, render page
 * }
 * ```
 *
 * @example Server Action - ❌ WRONG - use requireWithinLimit instead
 * ```typescript
 * // DON'T DO THIS in actions:
 * export async function createLocation(data) {
 *   await entitlements.requireWithinLimitOrRedirect(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS); // ❌
 * }
 *
 * // DO THIS instead:
 * export async function createLocation(data) {
 *   try {
 *     await entitlements.requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS); // ✅
 *     // Create location...
 *     return { success: true };
 *   } catch (error) {
 *     const mapped = mapEntitlementError(error);
 *     if (mapped) return { success: false, error: mapped };
 *     throw error;
 *   }
 * }
 * ```
 */
async function requireWithinLimitOrRedirect(
  limitKey: LimitKey,
  opts?: { redirectTo?: string }
): Promise<void> {
  // Get context once (not twice)
  const ctx = await requireOrgContext();

  try {
    await EntitlementsService.requireWithinLimit(ctx.orgId, limitKey, ctx.entitlements);
  } catch (error) {
    if (error instanceof EntitlementError) {
      const { code, context } = error;

      // Only redirect on LIMIT_EXCEEDED
      if (code === "LIMIT_EXCEEDED") {
        // Get plan name from best available source
        const planName = context.planName || ctx.entitlements?.plan_name || "unknown";

        const baseUrl = opts?.redirectTo || "/upgrade";
        const params = new URLSearchParams({
          reason: "limit",
          key: limitKey,
          plan: planName,
          org: ctx.orgId,
        });

        // Only include current/limit if they're present as numbers
        if (typeof context.current === "number") {
          params.set("current", String(context.current));
        }
        if (typeof context.limit === "number") {
          params.set("limit", String(context.limit));
        }

        redirect(`${baseUrl}?${params.toString()}`);
      }

      // For all other errors (ENTITLEMENTS_MISSING, LIMIT_CHECK_FAILED, etc.), throw
      throw error;
    }

    throw error;
  }
}

// ============================================================================
// EXPORTED NAMESPACE (all functions, no `this` usage)
// ============================================================================

/**
 * Entitlements guard facade (namespace-style export)
 *
 * All entitlement checks go through this object.
 * Methods auto-extract orgId, so callers don't need to pass it.
 *
 * Safe for destructuring:
 * ```typescript
 * const { requireWithinLimit } = entitlements;
 * await requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);
 * ```
 */
export const entitlements = {
  requireOrgContext,
  requireModuleAccess,
  requireFeatureAccess,
  requireWithinLimit,
  checkLimit,
  requireModuleOrRedirect,
  requireWithinLimitOrRedirect,
};

// ============================================================================
// ERROR MAPPING (for UI responses)
// ============================================================================

/**
 * Map entitlement error to user-friendly message
 *
 * Use this in server actions to return consistent error responses.
 *
 * @param error - Error from entitlement check
 * @returns Mapped error object or null if not an entitlement error
 *
 * @example
 * ```typescript
 * export async function createProduct(data) {
 *   try {
 *     await entitlements.requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS);
 *     // Create product...
 *     return { success: true, data: product };
 *   } catch (error) {
 *     const mapped = mapEntitlementError(error);
 *     if (mapped) {
 *       return { success: false, error: mapped };
 *     }
 *     throw error;
 *   }
 * }
 * ```
 */
export function mapEntitlementError(error: unknown): {
  code: EntitlementErrorCode;
  message: string;
  context?: EntitlementErrorContext;
} | null {
  if (!(error instanceof EntitlementError)) {
    return null;
  }

  // Exhaustive mapping - no fallback needed (EntitlementErrorCode is a strict union)
  const messages: Record<EntitlementErrorCode, string> = {
    MODULE_ACCESS_DENIED: "This module is not available on your plan.",
    FEATURE_UNAVAILABLE: "This feature is not available on your plan.",
    LIMIT_EXCEEDED: "You've reached your plan limit.",
    LIMIT_CHECK_FAILED: "Couldn't verify your plan limits. Please try again.",
    ENTITLEMENTS_MISSING: "Subscription configuration is missing. Contact support.",
    NO_ACTIVE_SUBSCRIPTION: "No active subscription found. Contact support.",
  };

  return {
    code: error.code,
    message: messages[error.code],
    context: error.context,
  };
}
