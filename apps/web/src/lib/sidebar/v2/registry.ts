import type { SidebarItem, SidebarModel } from "@/lib/types/v2/sidebar";
import {
  ORG_READ,
  ORG_UPDATE,
  MEMBERS_READ,
  BRANCHES_READ,
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  PERMISSION_TOOLS_READ,
  MODULE_WAREHOUSE_ACCESS,
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_LOCATIONS_READ,
  WAREHOUSE_PRODUCTS_READ,
  MODULE_ANALYTICS_ACCESS,
  ANALYTICS_READ,
  ANALYTICS_ACTIVITY_READ,
  ANALYTICS_AUDIT_READ,
  MODULE_WORKSHOP_ACCESS,
  WORKSHOP_READ,
  MODULE_HELPDESK_ACCESS,
  HELPDESK_READ,
  HELPDESK_TICKETS_READ,
  HELPDESK_TICKET_TYPES_MANAGE,
  HELPDESK_SETTINGS_MANAGE,
  MODULE_PLANNING_ACCESS,
  PLANNING_READ,
  PLANNING_BOARDS_READ,
  PLANNING_TASKS_READ,
  PLANNING_SETTINGS_MANAGE,
} from "@/lib/constants/permissions";
import {
  MODULE_ORGANIZATION_MANAGEMENT,
  MODULE_WAREHOUSE,
  MODULE_ANALYTICS,
  MODULE_WORKSHOP,
  MODULE_HELPDESK,
  MODULE_PLANNING,
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
 * Active modules (V2 scope):
 * - Tools        — always visible for users with tools.read
 * - Organization Management — visible for org members with module access + org.read
 * - Warehouse    — currently module-entitled placeholder shell, mirroring legacy tree
 *
 * User Account is intentionally NOT in the sidebar. It is accessible via the
 * user menu (NavUser dropdown) in the sidebar footer.
 *
 * All other modules (Analytics, Development, Support, Home)
 * have been removed from the sidebar. Their routes return 404 via the
 * dashboard catch-all ([...slug]/page.tsx → notFound()).
 */

/**
 * Main navigation sections
 */
export const MAIN_NAV_ITEMS: SidebarItem[] = [
  // ── Group: workspace (Warehouse + Tools) ────────────────────────────────

  // Warehouse (plan-gated: MODULE_WAREHOUSE must be in enabled_modules,
  // user-gated: MODULE_WAREHOUSE_ACCESS permission required)
  {
    id: "warehouse",
    group: "workspace",
    title: "Warehouse",
    titleKey: "modules.warehouse.titleSidebar",
    iconKey: "warehouse",
    visibility: {
      requiresModules: [MODULE_WAREHOUSE],
      requiresPermissions: [MODULE_WAREHOUSE_ACCESS],
    },
    children: [
      {
        id: "warehouse.inventory",
        title: "Inventory",
        titleKey: "modules.warehouse.items.inventory.title",
        iconKey: "clipboard",
        href: "/dashboard/warehouse/inventory",
        match: { startsWith: "/dashboard/warehouse/inventory" },
        visibility: {
          requiresPermissions: [WAREHOUSE_INVENTORY_READ],
        },
        children: [
          {
            id: "warehouse.inventory.movements",
            title: "Stock Movements",
            titleKey: "modules.warehouse.items.inventory.movements",
            iconKey: "transfers",
            href: "/dashboard/warehouse/inventory/movements",
            match: { startsWith: "/dashboard/warehouse/inventory/movements" },
            visibility: {
              requiresPermissions: [WAREHOUSE_INVENTORY_READ],
            },
          },
          {
            id: "warehouse.items",
            title: "Items",
            titleKey: "modules.warehouse.items.products.title",
            iconKey: "products",
            href: "/dashboard/warehouse/items",
            match: { startsWith: "/dashboard/warehouse/items" },
            visibility: {
              requiresPermissions: [WAREHOUSE_PRODUCTS_READ],
            },
          },
        ],
      },

      {
        id: "warehouse.purchases",
        title: "Purchases",
        titleKey: "modules.warehouse.items.purchases.title",
        iconKey: "truck",
        href: "/dashboard/warehouse/purchases",
        match: { startsWith: "/dashboard/warehouse/purchases" },
        children: [
          {
            id: "warehouse.deliveries",
            title: "Deliveries",
            titleKey: "modules.warehouse.items.deliveries.title",
            iconKey: "truck",
            href: "/dashboard/warehouse/deliveries",
            match: { startsWith: "/dashboard/warehouse/deliveries" },
          },
          {
            id: "warehouse.suppliers",
            title: "Suppliers",
            titleKey: "modules.warehouse.items.suppliers.title",
            iconKey: "building",
            href: "/dashboard/warehouse/suppliers",
            match: { startsWith: "/dashboard/warehouse/suppliers" },
          },
        ],
      },
      {
        id: "warehouse.locations",
        title: "Locations",
        titleKey: "modules.warehouse.items.locations",
        iconKey: "locations",
        href: "/dashboard/warehouse/locations",
        match: { startsWith: "/dashboard/warehouse/locations" },
        visibility: {
          requiresPermissions: [WAREHOUSE_LOCATIONS_READ],
        },
      },
      {
        id: "warehouse.settings",
        title: "Settings",
        titleKey: "modules.warehouse.items.settings.title",
        iconKey: "settings",
        href: "/dashboard/warehouse/settings",
        match: { startsWith: "/dashboard/warehouse/settings" },
      },
    ],
  },

  // Workshop (plan-gated: MODULE_WORKSHOP must be in enabled_modules,
  // user-gated: MODULE_WORKSHOP_ACCESS permission required)
  {
    id: "workshop",
    group: "workspace",
    title: "Workshop",
    titleKey: "modules.workshop.titleSidebar",
    iconKey: "car",
    href: "/dashboard/workshop",
    match: { startsWith: "/dashboard/workshop" },
    visibility: {
      requiresModules: [MODULE_WORKSHOP],
      requiresPermissions: [MODULE_WORKSHOP_ACCESS],
    },
  },

  // Help Desk (plan-gated: MODULE_HELPDESK must be in enabled_modules,
  // user-gated: MODULE_HELPDESK_ACCESS permission required)
  {
    id: "help-desk",
    group: "workspace",
    title: "Help Desk",
    titleKey: "modules.helpDesk.titleSidebar",
    iconKey: "lifeBuoy",
    visibility: {
      requiresModules: [MODULE_HELPDESK],
      requiresPermissions: [MODULE_HELPDESK_ACCESS],
    },
    children: [
      {
        id: "help-desk.overview",
        title: "Overview",
        titleKey: "modules.helpDesk.items.overview",
        iconKey: "dashboard",
        href: "/dashboard/help-desk",
        match: { exact: "/dashboard/help-desk" },
        visibility: {
          requiresPermissions: [HELPDESK_READ],
        },
      },
      {
        id: "help-desk.tickets",
        title: "Tickets",
        titleKey: "modules.helpDesk.items.tickets",
        iconKey: "ticket",
        href: "/dashboard/help-desk/tickets",
        match: { startsWith: "/dashboard/help-desk/tickets" },
        visibility: {
          requiresPermissions: [HELPDESK_TICKETS_READ],
        },
      },
      {
        id: "help-desk.ticket-types",
        title: "Ticket Types",
        titleKey: "modules.helpDesk.items.ticketTypes",
        iconKey: "tags",
        href: "/dashboard/help-desk/ticket-types",
        match: { startsWith: "/dashboard/help-desk/ticket-types" },
        visibility: {
          requiresPermissions: [HELPDESK_TICKET_TYPES_MANAGE],
        },
      },
      {
        id: "help-desk.settings",
        title: "Settings",
        titleKey: "modules.helpDesk.items.settings",
        iconKey: "settings",
        href: "/dashboard/help-desk/settings",
        match: { startsWith: "/dashboard/help-desk/settings" },
        visibility: {
          requiresPermissions: [HELPDESK_SETTINGS_MANAGE],
        },
      },
    ],
  },

  // Tools (always available — no requiresModules gate)
  {
    id: "tools",
    group: "workspace",
    title: "Tools",
    titleKey: "modules.tools.titleSidebar",
    iconKey: "tools",
    href: "/dashboard/tools",
    match: { startsWith: "/dashboard/tools" },
    visibility: {
      requiresPermissions: [PERMISSION_TOOLS_READ],
    },
  },

  // ── Group: admin (Organization Management) ──────────────────────────────

  // Organization Management
  {
    id: "organization",
    group: "admin",
    title: "Organization",
    titleKey: "modules.organizationManagement.titleSidebar",
    iconKey: "building",
    visibility: {
      requiresModules: [MODULE_ORGANIZATION_MANAGEMENT],
      requiresPermissions: [MODULE_ORGANIZATION_MANAGEMENT_ACCESS],
    },
    children: [
      {
        id: "organization.profile",
        title: "Profile",
        titleKey: "modules.organizationManagement.items.profile",
        iconKey: "building",
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
        iconKey: "branch",
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
        iconKey: "creditCard",
        href: "/dashboard/organization/billing",
        match: { exact: "/dashboard/organization/billing" },
        visibility: {
          requiresPermissions: [ORG_UPDATE], // Only owners see billing
        },
      },
    ],
  },

  // ── Group: planning ─────────────────────────────────────────────────────

  // Planning (plan-gated: MODULE_PLANNING must be in enabled_modules,
  // user-gated: MODULE_PLANNING_ACCESS permission required)
  {
    id: "planning",
    group: "planning",
    title: "Planning",
    titleKey: "modules.planning.titleSidebar",
    iconKey: "checkSquare",
    visibility: {
      requiresModules: [MODULE_PLANNING],
      requiresPermissions: [MODULE_PLANNING_ACCESS],
    },
    children: [
      {
        id: "planning.overview",
        title: "Overview",
        titleKey: "modules.planning.items.overview",
        iconKey: "layoutGrid",
        href: "/dashboard/planning",
        match: { exact: "/dashboard/planning" },
        visibility: {
          requiresPermissions: [PLANNING_READ],
        },
      },
      {
        id: "planning.tasks",
        title: "Tasks",
        titleKey: "modules.planning.items.tasks",
        iconKey: "checkSquare",
        href: "/dashboard/planning/tasks",
        match: { startsWith: "/dashboard/planning/tasks" },
        visibility: {
          requiresPermissions: [PLANNING_TASKS_READ],
        },
      },
      {
        id: "planning.boards",
        title: "Boards",
        titleKey: "modules.planning.items.boards",
        iconKey: "layoutGrid",
        href: "/dashboard/planning/boards",
        match: { exact: "/dashboard/planning/boards" },
        visibility: {
          requiresPermissions: [PLANNING_BOARDS_READ],
        },
      },
      {
        id: "planning.settings",
        title: "Settings",
        titleKey: "modules.planning.items.settings",
        iconKey: "settings",
        href: "/dashboard/planning/settings",
        match: { startsWith: "/dashboard/planning/settings" },
        visibility: {
          requiresPermissions: [PLANNING_SETTINGS_MANAGE],
        },
      },
    ],
  },

  // ── Group: analytics ────────────────────────────────────────────────────

  // Analytics & Reports (plan-gated: MODULE_ANALYTICS must be in enabled_modules,
  // user-gated: MODULE_ANALYTICS_ACCESS permission required)
  {
    id: "analytics",
    group: "analytics",
    title: "Analytics & Reports",
    titleKey: "modules.analytics.titleSidebar",
    iconKey: "barChart",
    visibility: {
      requiresModules: [MODULE_ANALYTICS],
      requiresPermissions: [MODULE_ANALYTICS_ACCESS],
    },
    children: [
      {
        id: "analytics.overview",
        title: "Overview",
        titleKey: "modules.analytics.items.overview",
        iconKey: "trending",
        href: "/dashboard/analytics",
        match: { exact: "/dashboard/analytics" },
        visibility: {
          requiresPermissions: [ANALYTICS_READ],
        },
      },
      {
        id: "analytics.activity",
        title: "Activity",
        titleKey: "modules.analytics.items.activity",
        iconKey: "activity",
        href: "/dashboard/analytics/activity",
        match: { exact: "/dashboard/analytics/activity" },
        visibility: {
          requiresPermissions: [ANALYTICS_ACTIVITY_READ],
        },
      },
      {
        id: "analytics.audit",
        title: "Audit Log",
        titleKey: "modules.analytics.items.audit",
        iconKey: "shieldCheck",
        href: "/dashboard/analytics/audit",
        match: { exact: "/dashboard/analytics/audit" },
        visibility: {
          requiresPermissions: [ANALYTICS_AUDIT_READ],
        },
      },
    ],
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
