"use client";

import { useAppStore } from "@/lib/stores/app-store";
import type { OrganizationEntitlements } from "@/lib/types/entitlements";

/**
 * Client-side entitlements checking hook
 *
 * This hook provides a clean API for checking organization entitlements in React components.
 * It uses the entitlements from the app store, which is hydrated from SSR.
 *
 * **Architecture**: "Compile, don't evaluate"
 * - Entitlements are compiled at write-time (when subscriptions/addons/overrides change)
 * - Pre-computed in `organization_entitlements` table
 * - Loaded once in SSR, no runtime computation
 * - Simple membership checks (module in array, feature in object)
 *
 * **Important**: This hook is for UI/UX only (not a security boundary).
 * Server-side guards in server actions/components are the authoritative checks.
 *
 * @example
 * ```tsx
 * function ProductsPage() {
 *   const { hasModule, getLimit } = useEntitlements();
 *
 *   if (!hasModule("warehouse")) {
 *     return <UpgradeRequired module="warehouse" />;
 *   }
 *
 *   const productLimit = getLimit("warehouse.max_products");
 *
 *   return (
 *     <div>
 *       <h1>Products ({productLimit === -1 ? "Unlimited" : `Limit: ${productLimit}`})</h1>
 *       {hasModule("analytics") && <AnalyticsPanel />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useEntitlements() {
  const entitlements = useAppStore((state) => state.entitlements);

  /**
   * Check if organization has access to a module
   *
   * @param moduleSlug - Module slug (e.g., "warehouse", "analytics")
   * @returns True if module is enabled in entitlements
   *
   * @example
   * ```tsx
   * const { hasModule } = useEntitlements();
   *
   * if (hasModule("analytics")) {
   *   // Show analytics features
   * }
   * ```
   */
  const hasModule = (moduleSlug: string): boolean => {
    if (!entitlements) {
      return false;
    }

    return entitlements.enabled_modules.includes(moduleSlug);
  };

  /**
   * Check if organization does NOT have access to a module
   *
   * Convenience method for readability.
   *
   * @param moduleSlug - Module slug
   * @returns True if module is NOT enabled
   *
   * @example
   * ```tsx
   * const { lacksModule } = useEntitlements();
   *
   * if (lacksModule("premium")) {
   *   return <UpgradeCTA />;
   * }
   * ```
   */
  const lacksModule = (moduleSlug: string): boolean => {
    return !hasModule(moduleSlug);
  };

  /**
   * Check if organization has access to any of the specified modules
   *
   * @param moduleSlugs - Array of module slugs
   * @returns True if at least one module is enabled
   *
   * @example
   * ```tsx
   * const { hasAnyModule } = useEntitlements();
   *
   * if (hasAnyModule(["warehouse", "inventory"])) {
   *   // Show inventory features
   * }
   * ```
   */
  const hasAnyModule = (moduleSlugs: string[]): boolean => {
    return moduleSlugs.some((slug) => hasModule(slug));
  };

  /**
   * Check if organization has access to all specified modules
   *
   * @param moduleSlugs - Array of module slugs
   * @returns True if all modules are enabled
   *
   * @example
   * ```tsx
   * const { hasAllModules } = useEntitlements();
   *
   * if (hasAllModules(["warehouse", "analytics"])) {
   *   // Show warehouse analytics dashboard
   * }
   * ```
   */
  const hasAllModules = (moduleSlugs: string[]): boolean => {
    return moduleSlugs.every((slug) => hasModule(slug));
  };

  /**
   * Get effective limit for a resource
   *
   * @param limitKey - Limit key (e.g., "warehouse.max_products")
   * @returns Limit value (-1 means unlimited, 0 means not allowed, >0 is the cap)
   *
   * @example
   * ```tsx
   * const { getLimit } = useEntitlements();
   *
   * const maxProducts = getLimit("warehouse.max_products");
   * const isUnlimited = maxProducts === -1;
   * ```
   */
  const getLimit = (limitKey: string): number => {
    if (!entitlements) {
      return 0;
    }

    const limit = entitlements.limits[limitKey];
    return limit !== undefined ? limit : 0;
  };

  /**
   * Check if limit is unlimited (-1)
   *
   * @param limitKey - Limit key
   * @returns True if limit is -1 (unlimited)
   *
   * @example
   * ```tsx
   * const { isUnlimited } = useEntitlements();
   *
   * if (isUnlimited("warehouse.max_products")) {
   *   return <p>Unlimited products!</p>;
   * }
   * ```
   */
  const isUnlimited = (limitKey: string): boolean => {
    return getLimit(limitKey) === -1;
  };

  /**
   * Get the full entitlements object
   *
   * Useful for debugging or passing to other utilities.
   *
   * @returns Current entitlements or null if not loaded
   *
   * @example
   * ```tsx
   * const { getEntitlements } = useEntitlements();
   *
   * const entitlements = getEntitlements();
   * console.log("Plan ID:", entitlements?.plan_id);
   * console.log("Modules:", entitlements?.enabled_modules);
   * ```
   */
  const getEntitlements = (): OrganizationEntitlements | null => {
    return entitlements;
  };

  return {
    // Module checks
    hasModule,
    lacksModule,
    hasAnyModule,
    hasAllModules,

    // Limit checks
    getLimit,
    isUnlimited,

    // Raw access
    getEntitlements,
  };
}
