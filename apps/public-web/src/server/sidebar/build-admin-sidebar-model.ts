import { cache } from "react";
import { resolveSidebarModel } from "@/lib/sidebar/v2/resolver";
import { getAdminSidebarRegistry } from "@/lib/sidebar/admin-v2/registry";
import type { SidebarResolverInput, SidebarModel } from "@/lib/types/v2/sidebar";

/**
 * Build admin sidebar model server-side (pure computation, no caching).
 *
 * Admin sidebar uses only permission-based visibility — no org entitlements,
 * no modules. The permission snapshot is synthesised from `admin_entitlements`
 * in the admin context loader (not from user_effective_permissions which is
 * org-scoped).
 *
 * Exported for direct use in tests — tests should call this, NOT
 * `buildAdminSidebarModel`, to validate pure computation without cache()
 * memoisation artifacts.
 *
 * @param permissionSnapshot - Synthetic snapshot (e.g. { allow: ["superadmin.*"], deny: [] })
 * @param locale - Current locale for i18n
 * @returns Filtered admin sidebar model
 */
export function buildAdminSidebarModelUncached(
  permissionSnapshot: { allow: string[]; deny: string[] },
  locale: string
): SidebarModel {
  const input: SidebarResolverInput = {
    locale,
    permissionSnapshot,
    // Admin sidebar is not gated by org entitlements — fail-closed is fine
    entitlements: null,
    context: {
      activeOrgId: null,
      activeBranchId: null,
    },
  };

  const registry = getAdminSidebarRegistry();
  return resolveSidebarModel(input, registry);
}

/**
 * Cached admin sidebar model builder (deduplicated within a single RSC render).
 *
 * NOTE: Do NOT use in unit tests — use `buildAdminSidebarModelUncached` instead.
 */
export const buildAdminSidebarModel = cache(buildAdminSidebarModelUncached);
