import {
  HELPDESK_TICKETS_READ,
  MEMBERS_READ,
  MODULE_HELPDESK_ACCESS,
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  MODULE_PLANNING_ACCESS,
  MODULE_WAREHOUSE_ACCESS,
  MODULE_WORKSHOP_ACCESS,
  PLANNING_TASKS_READ,
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_LOCATIONS_READ,
  WAREHOUSE_PRODUCTS_READ,
  WORKSHOP_REPAIR_ORDERS_READ,
} from "@/lib/constants/permissions";
import {
  MODULE_HELPDESK,
  MODULE_ORGANIZATION_MANAGEMENT,
  MODULE_PLANNING,
  MODULE_WAREHOUSE,
  MODULE_WORKSHOP,
} from "@/lib/constants/modules";
import { checkPermission, type PermissionSnapshot } from "@/lib/utils/permissions";

/**
 * Data sources of the global search and who may search them.
 *
 * Pure: shared by the dashboard layout (which scope chips to show) and the
 * server action (which sources to query). The gates mirror the target pages'
 * guards; RLS still decides row by row.
 */

export type SearchSourceId =
  | "repairOrders"
  | "tickets"
  | "tasks"
  | "documents"
  | "containers"
  | "locations"
  | "items"
  | "people";

/** Module + permissions each source needs */
export const SOURCE_GATES: Record<SearchSourceId, { module: string; permissions: string[] }> = {
  repairOrders: {
    module: MODULE_WORKSHOP,
    permissions: [MODULE_WORKSHOP_ACCESS, WORKSHOP_REPAIR_ORDERS_READ],
  },
  tickets: {
    module: MODULE_HELPDESK,
    permissions: [MODULE_HELPDESK_ACCESS, HELPDESK_TICKETS_READ],
  },
  tasks: { module: MODULE_PLANNING, permissions: [MODULE_PLANNING_ACCESS, PLANNING_TASKS_READ] },
  documents: {
    module: MODULE_WAREHOUSE,
    permissions: [MODULE_WAREHOUSE_ACCESS, WAREHOUSE_INVENTORY_READ],
  },
  containers: {
    module: MODULE_WAREHOUSE,
    permissions: [MODULE_WAREHOUSE_ACCESS, WAREHOUSE_INVENTORY_READ],
  },
  locations: {
    module: MODULE_WAREHOUSE,
    permissions: [MODULE_WAREHOUSE_ACCESS, WAREHOUSE_LOCATIONS_READ],
  },
  items: {
    module: MODULE_WAREHOUSE,
    permissions: [MODULE_WAREHOUSE_ACCESS, WAREHOUSE_PRODUCTS_READ],
  },
  // People link to the member page, which requires members.read
  people: {
    module: MODULE_ORGANIZATION_MANAGEMENT,
    permissions: [MODULE_ORGANIZATION_MANAGEMENT_ACCESS, MEMBERS_READ],
  },
};

/** Sources the user may search, in palette order */
export function resolveSearchSources(
  snapshot: PermissionSnapshot,
  enabledModules: readonly string[]
): SearchSourceId[] {
  const modules = new Set(enabledModules);
  return SEARCH_SCOPES.map((scope) => scope.source).filter((source) => {
    const gate = SOURCE_GATES[source];
    return (
      modules.has(gate.module) &&
      gate.permissions.every((permission) => checkPermission(snapshot, permission))
    );
  });
}

/**
 * Scope prefixes: typing one (or clicking its chip) limits the search to one
 * source. `>` (actions) is handled by the palette itself.
 */
export const SEARCH_SCOPES: { source: SearchSourceId; prefix: string }[] = [
  { source: "repairOrders", prefix: "zl:" },
  { source: "items", prefix: "cz:" },
  { source: "containers", prefix: "k:" },
  { source: "locations", prefix: "lok:" },
  { source: "documents", prefix: "dok:" },
  { source: "tickets", prefix: "hd:" },
  { source: "tasks", prefix: "pt:" },
  { source: "people", prefix: "@" },
];
