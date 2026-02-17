import type { SidebarItem, SidebarModel } from "@/lib/types/v2/sidebar";
import {
  ACCOUNT_PROFILE_READ,
  ACCOUNT_PREFERENCES_READ,
  ORG_READ,
  ORG_UPDATE,
  MEMBERS_READ,
} from "@/lib/constants/permissions";
import {
  MODULE_WAREHOUSE,
  MODULE_ORGANIZATION_MANAGEMENT,
  MODULE_ANALYTICS,
  MODULE_DEVELOPMENT,
  MODULE_SUPPORT,
} from "@/lib/constants/modules";

/**
 * Sidebar V2 Registry
 *
 * Pure data catalog of all sidebar navigation items.
 * NO hooks, NO permission checks, NO React components.
 *
 * IMPORTANT:
 * - All permission slugs MUST be imported from @/lib/constants/permissions
 * - All module slugs MUST be imported from @/lib/constants/modules
 * - Raw strings are NOT allowed (enforced by tests)
 *
 * NOTE ON WAREHOUSE PERMISSIONS:
 * Warehouse does NOT have fine-grained permissions in database yet.
 * Use module gating (MODULE_WAREHOUSE) instead of permissions for now.
 * Fine-grained warehouse permissions are future work (separate project).
 */

/**
 * Main navigation sections
 */
export const MAIN_NAV_ITEMS: SidebarItem[] = [
  // Home
  {
    id: "home",
    title: "Home",
    iconKey: "home",
    href: "/dashboard/start",
    match: { exact: "/dashboard/start" },
  },

  // Warehouse (module-gated only, no fine-grained permissions yet)
  {
    id: "warehouse",
    title: "Warehouse",
    iconKey: "warehouse",
    href: "/dashboard/warehouse",
    match: { startsWith: "/dashboard/warehouse" },
    visibility: {
      requiresModules: [MODULE_WAREHOUSE],
    },
  },

  // Organization Management
  {
    id: "organization",
    title: "Organization",
    iconKey: "users",
    visibility: {
      requiresModules: [MODULE_ORGANIZATION_MANAGEMENT],
    },
    children: [
      {
        id: "organization.profile",
        title: "Profile",
        iconKey: "settings",
        href: "/dashboard/organization/profile",
        match: { exact: "/dashboard/organization/profile" },
        visibility: {
          requiresPermissions: [ORG_READ],
        },
      },
      {
        id: "organization.users",
        title: "Users",
        iconKey: "users",
        href: "/dashboard/organization/users",
        match: { startsWith: "/dashboard/organization/users" },
        visibility: {
          requiresPermissions: [MEMBERS_READ],
        },
      },
      {
        id: "organization.billing",
        title: "Billing",
        iconKey: "settings",
        href: "/dashboard/organization/billing",
        match: { exact: "/dashboard/organization/billing" },
        visibility: {
          requiresPermissions: [ORG_UPDATE], // Only owners see billing
        },
      },
    ],
  },

  // Analytics (Premium)
  {
    id: "analytics",
    title: "Analytics",
    iconKey: "analytics",
    href: "/dashboard/analytics",
    match: { startsWith: "/dashboard/analytics" },
    visibility: {
      requiresModules: [MODULE_ANALYTICS],
    },
  },

  // Development (Premium)
  {
    id: "development",
    title: "Development",
    iconKey: "settings",
    href: "/dashboard/development",
    match: { startsWith: "/dashboard/development" },
    visibility: {
      requiresModules: [MODULE_DEVELOPMENT],
    },
  },
];

/**
 * Footer navigation (settings, help, etc.)
 */
export const FOOTER_NAV_ITEMS: SidebarItem[] = [
  {
    id: "account",
    title: "Account",
    iconKey: "settings",
    children: [
      {
        id: "account.profile",
        title: "Profile",
        iconKey: "settings",
        href: "/dashboard/account/profile",
        match: { exact: "/dashboard/account/profile" },
        visibility: {
          requiresPermissions: [ACCOUNT_PROFILE_READ],
        },
      },
      {
        id: "account.preferences",
        title: "Preferences",
        iconKey: "settings",
        href: "/dashboard/account/preferences",
        match: { exact: "/dashboard/account/preferences" },
        visibility: {
          requiresPermissions: [ACCOUNT_PREFERENCES_READ],
        },
      },
    ],
  },
  {
    id: "support",
    title: "Support",
    iconKey: "documentation",
    href: "/dashboard/support",
    match: { startsWith: "/dashboard/support" },
    visibility: {
      requiresModules: [MODULE_SUPPORT],
    },
  },
];

/**
 * Get full sidebar registry
 */
export function getSidebarRegistry(): Pick<SidebarModel, "main" | "footer"> {
  return {
    main: MAIN_NAV_ITEMS,
    footer: FOOTER_NAV_ITEMS,
  };
}
