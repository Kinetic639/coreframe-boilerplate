import type { SidebarItem, SidebarModel } from "@/lib/types/v2/sidebar";
import {
  ORG_READ,
  ORG_UPDATE,
  MEMBERS_READ,
  BRANCHES_READ,
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  PERMISSION_TOOLS_READ,
  AUDIT_EVENTS_READ,
  MODULE_WAREHOUSE_ACCESS,
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_LOCATIONS_READ,
  WAREHOUSE_PRODUCTS_READ,
} from "@/lib/constants/permissions";
import { MODULE_ORGANIZATION_MANAGEMENT, MODULE_WAREHOUSE } from "@/lib/constants/modules";

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

  // Warehouse (plan-gated: MODULE_WAREHOUSE must be in enabled_modules,
  // user-gated: MODULE_WAREHOUSE_ACCESS permission required)
  {
    id: "warehouse",
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
        iconKey: "warehouse",
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
            iconKey: "warehouse",
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

          /* NOT YET IMPLEMENTED — etykiety i kody
          {
            id: "warehouse.labels",
            title: "Labels & QR",
            titleKey: "modules.warehouse.items.labels.title",
            iconKey: "products",
            href: "/dashboard/warehouse/labels",
            match: { startsWith: "/dashboard/warehouse/labels" },
          },
          */
          /* NOT YET IMPLEMENTED — alerty stanów
          {
            id: "warehouse.alerts",
            title: "Stock Alerts",
            titleKey: "modules.warehouse.items.alerts.title",
            iconKey: "warehouse",
            href: "/dashboard/warehouse/alerts",
            match: { startsWith: "/dashboard/warehouse/alerts" },
          },
          */
          /* NOT YET IMPLEMENTED — korekty stanów
          {
            id: "warehouse.inventory.adjustments",
            title: "Stock Adjustments",
            titleKey: "modules.warehouse.items.inventory.adjustments.title",
            iconKey: "settings",
            href: "/dashboard/warehouse/inventory/adjustments",
            match: { startsWith: "/dashboard/warehouse/inventory/adjustments" },
            children: [
              {
                id: "warehouse.audits",
                title: "Audits",
                titleKey: "modules.warehouse.items.audits.title",
                iconKey: "settings",
                href: "/dashboard/warehouse/audits",
                match: { startsWith: "/dashboard/warehouse/audits" },
              },
              {
                id: "warehouse.adjustments",
                title: "Single Adjustment",
                titleKey: "modules.warehouse.items.inventory.adjustments.single",
                iconKey: "settings",
                href: "/dashboard/warehouse/inventory/adjustments",
                match: { exact: "/dashboard/warehouse/inventory/adjustments" },
              },
            ],
          },
          */
        ],
      },

      /* NOT YET IMPLEMENTED — sprzedaż (cała sekcja)
      {
        id: "warehouse.sales",
        title: "Sales",
        titleKey: "modules.warehouse.items.sales.title",
        iconKey: "users",
        href: "/dashboard/warehouse/sales",
        match: { startsWith: "/dashboard/warehouse/sales" },
        children: [
          {
            id: "warehouse.sales-orders",
            title: "Sales Orders",
            titleKey: "modules.warehouse.items.sales.orders",
            iconKey: "products",
            href: "/dashboard/warehouse/sales-orders",
            match: { startsWith: "/dashboard/warehouse/sales-orders" },
          },
          {
            id: "warehouse.clients",
            title: "Clients",
            titleKey: "modules.warehouse.items.sales.clients",
            iconKey: "users",
            href: "/dashboard/warehouse/clients",
            match: { startsWith: "/dashboard/warehouse/clients" },
          },
        ],
      },
      */
      {
        id: "warehouse.purchases",
        title: "Purchases",
        titleKey: "modules.warehouse.items.purchases.title",
        iconKey: "warehouse",
        href: "/dashboard/warehouse/purchases",
        match: { startsWith: "/dashboard/warehouse/purchases" },
        children: [
          /* NOT YET IMPLEMENTED — zamówienia zakupu
          {
            id: "warehouse.purchase-orders",
            title: "Purchase Orders",
            titleKey: "modules.warehouse.items.purchases.orders",
            iconKey: "products",
            href: "/dashboard/warehouse/purchase-orders",
            match: { startsWith: "/dashboard/warehouse/purchase-orders" },
          },
          */
          {
            id: "warehouse.deliveries",
            title: "Deliveries",
            titleKey: "modules.warehouse.items.deliveries.title",
            iconKey: "warehouse",
            href: "/dashboard/warehouse/deliveries",
            match: { startsWith: "/dashboard/warehouse/deliveries" },
          },
          {
            id: "warehouse.suppliers",
            title: "Suppliers",
            titleKey: "modules.warehouse.items.suppliers.title",
            iconKey: "users",
            href: "/dashboard/warehouse/suppliers",
            match: { startsWith: "/dashboard/warehouse/suppliers" },
          },
          /* NOT YET IMPLEMENTED — skanowanie dostawy
          {
            id: "warehouse.scanning.delivery",
            title: "Delivery Scanning",
            titleKey: "modules.warehouse.items.scanning.delivery",
            iconKey: "warehouse",
            href: "/dashboard/warehouse/scanning/delivery",
            match: { startsWith: "/dashboard/warehouse/scanning/delivery" },
          },
          */
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
