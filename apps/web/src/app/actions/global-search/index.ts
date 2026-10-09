"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { EntitlementsService } from "@/server/services/entitlements-service";
import { detectSearchIds } from "@/lib/global-search/id-patterns";
import { resolveSearchSources, type SearchSourceId } from "@/lib/global-search/sources";
import {
  GlobalSearchService,
  MIN_TEXT_QUERY,
  type SearchExactHit,
} from "@/server/services/global-search.service";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

const MAX_QUERY_LENGTH = 80;

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
 *
 * @param scope optional single source (palette scope prefix such as `zl:`);
 *   it can only narrow the allowed sources, never widen them.
 */
export async function globalSearchAction(
  rawQuery: string,
  scope?: SearchSourceId
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
    const allowed = resolveSearchSources(
      context.user.permissionSnapshot,
      entitlements?.enabled_modules ?? []
    );
    const sources = new Set(scope ? allowed.filter((source) => source === scope) : allowed);
    if (sources.size === 0) return { success: true, data: EMPTY };

    const searchScope = { orgId, branchId: context.app.activeBranchId, sources };
    const [exact, text] = await Promise.all([
      detected.length ? GlobalSearchService.findExactHits(supabase, searchScope, detected) : [],
      // A slow or failed fragment search must not hide the exact hits
      GlobalSearchService.searchText(supabase, searchScope, query).catch((error: unknown) => {
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
