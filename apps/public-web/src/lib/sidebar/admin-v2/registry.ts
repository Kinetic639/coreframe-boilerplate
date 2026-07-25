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
  {
    id: "admin.branding",
    title: "Branding",
    iconKey: "development",
    href: "/admin/branding",
    match: { startsWith: "/admin/branding" },
    visibility: {
      requiresPermissions: [SUPERADMIN_ADMIN_READ],
    },
  },
  {
    id: "admin.site",
    title: "Site Settings",
    iconKey: "settings",
    href: "/admin/site",
    match: { startsWith: "/admin/site" },
    visibility: {
      requiresPermissions: [SUPERADMIN_ADMIN_READ],
    },
  },
  {
    id: "admin.data-view-demo",
    title: "DataView Demo",
    iconKey: "development",
    href: "/admin/data-view-demo",
    match: { startsWith: "/admin/data-view-demo" },
    visibility: {
      requiresPermissions: [SUPERADMIN_ADMIN_READ],
    },
  },
  {
    id: "admin.rich-text-demo",
    title: "Rich Text Demo",
    iconKey: "documentation",
    href: "/admin/rich-text-demo",
    match: { startsWith: "/admin/rich-text-demo" },
    visibility: {
      requiresPermissions: [SUPERADMIN_ADMIN_READ],
    },
  },
  {
    id: "admin.comments-demo",
    title: "Comments Demo",
    iconKey: "documentation",
    href: "/admin/comments-demo",
    match: { startsWith: "/admin/comments-demo" },
    visibility: {
      requiresPermissions: [SUPERADMIN_ADMIN_READ],
    },
  },
  {
    id: "admin.avatar-demo",
    title: "Avatar Demo",
    iconKey: "users",
    href: "/admin/avatar-demo",
    match: { startsWith: "/admin/avatar-demo" },
    visibility: {
      requiresPermissions: [SUPERADMIN_ADMIN_READ],
    },
  },
  {
    id: "admin.calendar-demo",
    title: "Calendar Demo",
    iconKey: "calendar",
    href: "/admin/calendar-demo",
    match: { startsWith: "/admin/calendar-demo" },
    visibility: {
      requiresPermissions: [SUPERADMIN_ADMIN_READ],
    },
  },
  {
    id: "admin.org-members",
    title: "Org Members",
    iconKey: "users",
    href: "/admin/org-members",
    match: { startsWith: "/admin/org-members" },
    visibility: {
      requiresPermissions: [SUPERADMIN_ADMIN_READ],
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
