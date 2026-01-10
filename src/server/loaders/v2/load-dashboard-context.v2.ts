import { cache } from "react";
import { loadAppContextV2 } from "./load-app-context.v2";
import { loadUserContextV2 } from "./load-user-context.v2";
import type { AppContextV2 } from "@/lib/stores/v2/app-store";
import type { UserContextV2 } from "@/lib/stores/v2/user-store";

/**
 * Combined Dashboard Context V2
 */
export interface DashboardContextV2 {
  app: AppContextV2;
  user: UserContextV2;
}

/**
 * V2 Combined Dashboard Context Loader
 *
 * Single entrypoint for Dashboard V2 that guarantees consistency.
 * Prevents "app picked branch A but user loaded perms for branch B" bugs permanently.
 *
 * How it works:
 * 1. Load app context (resolves org/branch deterministically)
 * 2. Load user context for RESOLVED org/branch (permissions match active branch)
 *
 * Performance Note:
 * - Both loaders call getSession() internally (2 calls per request)
 * - This is acceptable because session fetch is fast (~1ms) and cached by Supabase SDK
 * - Optional optimization: call getSession() once here and pass to both loaders
 *   (requires refactoring loaders to accept optional session parameter)
 *
 * Contract:
 * - Returns null when no session exists
 * - Loads app context first to resolve org/branch
 * - Passes resolved org/branch to user context loader
 * - Guarantees permission snapshot matches active branch
 *
 * Usage:
 * ```typescript
 * const context = await loadDashboardContextV2();
 * if (!context) redirect("/sign-in");
 *
 * // Hydrate stores
 * useAppStoreV2.getState().hydrateFromServer(context.app);
 * useUserStoreV2.getState().hydrateFromServer(context.user);
 * ```
 *
 * @returns DashboardContextV2 or null
 */
async function _loadDashboardContextV2(): Promise<DashboardContextV2 | null> {
  // 1. Load app context (resolves org/branch)
  const appContext = await loadAppContextV2();

  if (!appContext) {
    return null;
  }

  // 2. Load user context for the RESOLVED org/branch
  const userContext = await loadUserContextV2(appContext.activeOrgId, appContext.activeBranchId);

  if (!userContext) {
    return null;
  }

  // 3. Return combined context
  return {
    app: appContext,
    user: userContext,
  };
}

/**
 * Cached version of loadDashboardContextV2 (deduplicates multiple calls in same request)
 */
export const loadDashboardContextV2 = cache(_loadDashboardContextV2);
