import { hasModuleAccess, getEffectiveLimit } from "@repo/domain/entitlements";
import type { LimitKey, OrganizationEntitlements } from "@repo/contracts/entitlements";

import { useAppContext } from "@/contexts/app-context";

/**
 * Provides entitlement helpers derived from the bootstrap AppContext.
 *
 * NO network calls. NO React Query. NO state duplication.
 *
 * The entitlements snapshot is loaded once at bootstrap by AppProvider and
 * stored in AppContext. This hook is a thin accessor that exposes the snapshot
 * plus two pure domain functions from @repo/domain/entitlements so that feature
 * screens do not need to import domain functions and AppContext separately.
 *
 * entitlements === null is a valid state for free-tier orgs (no subscription
 * row). Callers must handle null — both helpers return safe defaults in that case:
 *   hasModuleAccess → false
 *   getEffectiveLimit → 0
 *
 * UI note: these checks are informational only. Backend RLS enforces access.
 * Client-side entitlement checks control visibility, not authorization.
 */
export function useEntitlements(): {
  entitlements: OrganizationEntitlements | null;
  hasModuleAccess: (moduleSlug: string) => boolean;
  getEffectiveLimit: (limitKey: LimitKey) => number;
} {
  const { appState } = useAppContext();
  const { entitlements } = appState;

  return {
    entitlements,
    hasModuleAccess: (moduleSlug: string) => hasModuleAccess(entitlements, moduleSlug),
    getEffectiveLimit: (limitKey: LimitKey) => getEffectiveLimit(entitlements, limitKey),
  };
}
