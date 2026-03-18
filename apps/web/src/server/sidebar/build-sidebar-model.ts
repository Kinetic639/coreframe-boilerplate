import { cache } from "react";
import { resolveSidebarModel } from "@/lib/sidebar/v2/resolver";
import { getSidebarRegistry } from "@/lib/sidebar/v2/registry";
import type { SidebarResolverInput, SidebarModel } from "@/lib/types/v2/sidebar";
import type { AppContextV2 } from "@/lib/stores/v2/app-store";
import type { UserContextV2 } from "@/lib/stores/v2/user-store";
import type { OrganizationEntitlements } from "@/lib/types/entitlements";

/**
 * Build sidebar model server-side (pure computation, no caching)
 *
 * IMPORTANT: This function computes VISIBILITY only (permissions + entitlements).
 * It does NOT compute active state (that's client-side, using router pathname).
 * It does NOT read request headers or routing state.
 *
 * Server concerns: What can user SEE?
 * Client concerns: What is user VIEWING?
 *
 * Exported for direct use in tests — tests should call this, NOT `buildSidebarModel`,
 * so they validate pure computation and are immune to cache() memoization artifacts.
 *
 * @param appContext - SSR-loaded app context (org/branch IDs, userModules)
 * @param userContext - SSR-loaded user context (permissionSnapshot)
 * @param entitlements - Organization entitlements (nullable, fail-closed)
 * @param locale - Current locale for i18n
 * @returns Filtered sidebar model based on permissions + entitlements
 */
export function buildSidebarModelUncached(
  appContext: AppContextV2,
  userContext: UserContextV2,
  entitlements: OrganizationEntitlements | null,
  locale: string
): SidebarModel {
  // Build resolver input (NO pathname, NO routing state)
  const input: SidebarResolverInput = {
    locale,
    permissionSnapshot: userContext.permissionSnapshot,
    entitlements,
    context: {
      activeOrgId: appContext.activeOrgId,
      activeBranchId: appContext.activeBranchId,
      userModules: appContext.userModules,
    },
  };

  // Get registry
  const registry = getSidebarRegistry();

  // Resolve model (pure function, deterministic)
  return resolveSidebarModel(input, registry);
}

/**
 * Build sidebar model server-side (cached within RSC render execution context)
 *
 * This is the SSR entry point for sidebar generation.
 * Returns pre-filtered model based on permissions + entitlements.
 *
 * Caching semantics:
 * - cache() is scoped to the RSC render execution context
 * - Same inputs within a single request → same model (deduplication)
 * - NO global state, NO cross-user leakage
 * - NO cross-request persistence guarantee
 * - Deterministic: same user + same org → same output (every time)
 *
 * Safe because:
 * - No global mutable state
 * - No cross-user leakage
 * - No cross-request persistence guarantee
 * - Deterministic input → deterministic output
 *
 * NOTE: Do NOT use this in unit tests — use `buildSidebarModelUncached` instead
 * to test pure computation without cache() memoization artifacts.
 */
export const buildSidebarModel = cache(buildSidebarModelUncached);
