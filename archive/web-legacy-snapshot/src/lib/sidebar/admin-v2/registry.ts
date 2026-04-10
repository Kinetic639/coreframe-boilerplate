import type { SidebarItem, SidebarModel } from "@/lib/types/v2/sidebar";
import {
  SUPERADMIN_ADMIN_READ,
  SUPERADMIN_PLANS_READ,
  SUPERADMIN_PRICING_READ,
} from "@/lib/constants/permissions";

/**
 * Admin Sidebar V2 Registry
 *
 * Pure data catalog of Admin Dashboard V2 navigation items.
 * NO hooks, NO permission checks, NO React components.
 *
 * IMPORTANT:
 * - All permission slugs MUST be imported from @/lib/constants/permissions
 * - Raw strings are NOT allowed
 * - No module gating (admin sidebar uses permissions only)
 */

export const ADMIN_MAIN_NAV_ITEMS: SidebarItem[] = [
  {
    id: "admin.home",
    title: "Admin Home",
    iconKey: "home",
    href: "/admin",
    match: { exact: "/admin" },
    visibility: {
      requiresPermissions: [SUPERADMIN_ADMIN_READ],
    },
  },
  {
    id: "admin.plans",
    title: "Plans",
    iconKey: "analytics",
    href: "/admin/plans",
    match: { startsWith: "/admin/plans" },
    visibility: {
      requiresPermissions: [SUPERADMIN_PLANS_READ],
    },
  },
  {
    id: "admin.pricing",
    title: "Pricing",
    iconKey: "settings",
    href: "/admin/pricing",
    match: { startsWith: "/admin/pricing" },
    visibility: {
      requiresPermissions: [SUPERADMIN_PRICING_READ],
    },
  },
];

export const ADMIN_FOOTER_NAV_ITEMS: SidebarItem[] = [];

/**
 * Get full admin sidebar registry
 */
export function getAdminSidebarRegistry(): Pick<SidebarModel, "main" | "footer"> {
  return {
    main: ADMIN_MAIN_NAV_ITEMS,
    footer: ADMIN_FOOTER_NAV_ITEMS,
  };
}
