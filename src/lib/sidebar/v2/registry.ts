import type { SidebarItem, SidebarModel } from "@/lib/types/v2/sidebar";
import {
  ACCOUNT_PROFILE_READ,
  ACCOUNT_PREFERENCES_READ,
  ORG_READ,
  ORG_UPDATE,
  MEMBERS_READ,
  BRANCHES_READ,
  BRANCH_ROLES_MANAGE,
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  PERMISSION_TOOLS_READ,
} from "@/lib/constants/permissions";
import { MODULE_ORGANIZATION_MANAGEMENT } from "@/lib/constants/modules";

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
 * Active modules (V2 scope):
 * - Tools        — always visible for users with tools.read
 * - Organization Management — visible for org members with module access + org.read
 * - User Account — always visible (footer)
 *
 * All other modules (Warehouse, Analytics, Development, Support, Home)
 * have been removed from the sidebar. Their routes return 404 via the
 * dashboard catch-all ([...slug]/page.tsx → notFound()).
 */

/**
 * Main navigation sections
 */
export const MAIN_NAV_ITEMS: SidebarItem[] = [
  // Organization Management
  {
    id: "organization",
    title: "Organization",
    titleKey: "modules.organizationManagement.titleSidebar",
    iconKey: "users",
    visibility: {
      requiresModules: [MODULE_ORGANIZATION_MANAGEMENT],
      requiresPermissions: [MODULE_ORGANIZATION_MANAGEMENT_ACCESS],
    },
    children: [
      {
        id: "organization.profile",
        title: "Profile",
        titleKey: "modules.organizationManagement.items.profile",
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
        titleKey: "modules.organizationManagement.items.users.title",
        iconKey: "users",
        href: "/dashboard/organization/users",
        match: { startsWith: "/dashboard/organization/users" },
        visibility: {
          requiresPermissions: [MEMBERS_READ],
        },
      },
      {
        id: "organization.branch-access",
        title: "Branch Access",
        titleKey: "modules.organizationManagement.items.branchAccess",
        iconKey: "users",
        href: "/dashboard/organization/users/branch-access",
        match: { exact: "/dashboard/organization/users/branch-access" },
        visibility: {
          requiresAnyPermissions: [MEMBERS_READ, BRANCH_ROLES_MANAGE],
        },
      },
      {
        id: "organization.branches",
        title: "Branches",
        titleKey: "modules.organizationManagement.items.branches",
        iconKey: "settings",
        href: "/dashboard/organization/branches",
        match: { exact: "/dashboard/organization/branches" },
        visibility: {
          requiresPermissions: [BRANCHES_READ],
        },
      },
      {
        id: "organization.billing",
        title: "Billing",
        titleKey: "modules.organizationManagement.items.billing",
        iconKey: "settings",
        href: "/dashboard/organization/billing",
        match: { exact: "/dashboard/organization/billing" },
        visibility: {
          requiresPermissions: [ORG_UPDATE], // Only owners see billing
        },
      },
    ],
  },

  // Tools (always available — no requiresModules gate, last in main nav)
  {
    id: "tools",
    title: "Tools",
    titleKey: "modules.tools.titleSidebar",
    iconKey: "tools",
    href: "/dashboard/tools",
    match: { startsWith: "/dashboard/tools" },
    visibility: {
      requiresPermissions: [PERMISSION_TOOLS_READ],
    },
  },
];

/**
 * Footer navigation (user account)
 */
export const FOOTER_NAV_ITEMS: SidebarItem[] = [
  {
    id: "account",
    title: "Account",
    titleKey: "modules.userAccount.title",
    iconKey: "settings",
    children: [
      {
        id: "account.profile",
        title: "Profile",
        titleKey: "modules.userAccount.items.profile",
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
        titleKey: "modules.userAccount.items.preferences",
        iconKey: "settings",
        href: "/dashboard/account/preferences",
        match: { exact: "/dashboard/account/preferences" },
        visibility: {
          requiresPermissions: [ACCOUNT_PREFERENCES_READ],
        },
      },
    ],
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
