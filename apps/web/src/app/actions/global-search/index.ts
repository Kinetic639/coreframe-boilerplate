"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { EntitlementsService } from "@/server/services/entitlements-service";
import { checkPermission } from "@/lib/utils/permissions";
import {
  HELPDESK_TICKETS_READ,
  MODULE_HELPDESK_ACCESS,
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
  MODULE_PLANNING,
  MODULE_WAREHOUSE,
  MODULE_WORKSHOP,
} from "@/lib/constants/modules";
import { detectSearchIds } from "@/lib/global-search/id-patterns";
import {
  GlobalSearchService,
  type SearchExactHit,
  type SearchSourceId,
} from "@/server/services/global-search.service";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

const MAX_QUERY_LENGTH = 80;

/** Module + permissions each source needs (mirrors the target pages' guards) */
const SOURCE_GATES: Record<SearchSourceId, { module: string; permissions: string[] }> = {
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
};

/**
 * Exact hits for an identifier typed, pasted or scanned into the global search
 * (ZL number, VIN, HD-/PT- number, PZ/RW/MM document, container / location
 * code, SKU or barcode). Returns an empty list when nothing is recognized.
 */
export async function findSearchExactHitsAction(
  query: string
): Promise<ActionResult<SearchExactHit[]>> {
  try {
    const detected = detectSearchIds(query.slice(0, MAX_QUERY_LENGTH));
    if (detected.length === 0) return { success: true, data: [] };

    const supabase = await createClient();
    const context = await loadDashboardContextV2();
    const orgId = context?.app.activeOrgId;
    if (!context || !orgId) return { success: false, error: "Unauthorized" };

    const entitlements = await EntitlementsService.loadEntitlements(orgId);
    const enabledModules = new Set(entitlements?.enabled_modules ?? []);
    const snapshot = context.user.permissionSnapshot;
    const sources = new Set<SearchSourceId>();
    for (const [source, gate] of Object.entries(SOURCE_GATES) as [
      SearchSourceId,
      (typeof SOURCE_GATES)[SearchSourceId],
    ][]) {
      if (
        enabledModules.has(gate.module) &&
        gate.permissions.every((permission) => checkPermission(snapshot, permission))
      ) {
        sources.add(source);
      }
    }
    if (sources.size === 0) return { success: true, data: [] };

    const hits = await GlobalSearchService.findExactHits(
      supabase,
      { orgId, branchId: context.app.activeBranchId, sources },
      detected
    );
    return { success: true, data: hits };
  } catch (error) {
    console.error("[findSearchExactHitsAction]", error);
    return { success: false, error: "Search failed" };
  }
}
