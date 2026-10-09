"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { EntitlementsService } from "@/server/services/entitlements-service";
import { checkPermission } from "@/lib/utils/permissions";
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
import { detectSearchIds } from "@/lib/global-search/id-patterns";
import {
  GlobalSearchService,
  MIN_TEXT_QUERY,
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
  // People link to the member page, which requires members.read
  people: {
    module: MODULE_ORGANIZATION_MANAGEMENT,
    permissions: [MODULE_ORGANIZATION_MANAGEMENT_ACCESS, MEMBERS_READ],
  },
};

export interface GlobalSearchResult {
  /** Objects whose identifier equals the query (ZL, VIN, HD-, PZ/…, code) */
  exact: SearchExactHit[];
  /** Fragment matches, at most a few per source, exact hits excluded */
  results: SearchExactHit[];
}

const EMPTY: GlobalSearchResult = { exact: [], results: [] };

/**
 * Data search for the global search palette.
 *
 * Exact hits for an identifier typed, pasted or scanned into the palette
 * (ZL number, VIN, HD-/PT- number, PZ/RW/MM document, container / location
 * code, SKU or barcode) plus fragment matches across orders, parts, locations,
 * containers, documents, requests and people. Each source is searched only
 * when the module is enabled and the user holds its permissions; RLS applies.
 */
export async function globalSearchAction(
  rawQuery: string
): Promise<ActionResult<GlobalSearchResult>> {
  try {
    const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);
    if (query.length < MIN_TEXT_QUERY) return { success: true, data: EMPTY };
    const detected = detectSearchIds(query);

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
    if (sources.size === 0) return { success: true, data: EMPTY };

    const scope = { orgId, branchId: context.app.activeBranchId, sources };
    const [exact, text] = await Promise.all([
      detected.length ? GlobalSearchService.findExactHits(supabase, scope, detected) : [],
      // A slow or failed fragment search must not hide the exact hits
      GlobalSearchService.searchText(supabase, scope, query).catch((error: unknown) => {
        console.error("[globalSearchAction] text search", error);
        return [];
      }),
    ]);
    const exactKeys = new Set(exact.map((hit) => `${hit.type}:${hit.id}`));
    const results = text.filter((hit) => !exactKeys.has(`${hit.type}:${hit.id}`));
    return { success: true, data: { exact, results } };
  } catch (error) {
    console.error("[globalSearchAction]", error);
    return { success: false, error: "Search failed" };
  }
}
