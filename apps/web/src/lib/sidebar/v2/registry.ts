import type { SidebarItem, SidebarModel } from "@/lib/types/v2/sidebar";
import {
  ORG_READ,
  ORG_UPDATE,
  MEMBERS_READ,
  BRANCHES_READ,
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  PERMISSION_TOOLS_READ,
  AUDIT_EVENTS_READ,
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
 *
 * User Account is intentionally NOT in the sidebar. It is accessible via the
 * user menu (NavUser dropdown) in the sidebar footer.
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
      {
        id: "organization.activity",
        title: "Activity",
        titleKey: "modules.organizationManagement.items.activity",
        iconKey: "settings",
        href: "/dashboard/organization/activity",
        match: { exact: "/dashboard/organization/activity" },
        visibility: {
          requiresPermissions: [ORG_READ],
        },
      },
      {
        id: "organization.audit",
        title: "Audit Log",
        titleKey: "modules.organizationManagement.items.audit",
        iconKey: "settings",
        href: "/dashboard/organization/audit",
        match: { exact: "/dashboard/organization/audit" },
        visibility: {
          requiresPermissions: [AUDIT_EVENTS_READ],
        },
      },
    ],
  },

  // My Activity (available to any authenticated org member)
  {
    id: "activity",
    title: "My Activity",
    titleKey: "activityFeed.personalTitle",
    iconKey: "settings",
    href: "/dashboard/activity",
    match: { exact: "/dashboard/activity" },
    visibility: {},
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
 * Footer navigation — empty.
 * User Account is accessed via the NavUser dropdown in the sidebar footer,
 * not via a dedicated sidebar section.
 */
export const FOOTER_NAV_ITEMS: SidebarItem[] = [];

/**
 * Get full sidebar registry
 */
export function getSidebarRegistry(): Pick<SidebarModel, "main" | "footer"> {
  return {
    main: MAIN_NAV_ITEMS,
    footer: FOOTER_NAV_ITEMS,
  };
}
