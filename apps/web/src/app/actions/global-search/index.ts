"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { EntitlementsService } from "@/server/services/entitlements-service";
import { detectSearchIds } from "@/lib/global-search/id-patterns";
import { resolveSearchSources, type SearchSourceId } from "@/lib/global-search/sources";
import {
  GlobalSearchService,
  MIN_TEXT_QUERY,
  type OtherBranchCount,
  type SearchExactHit,
  type SearchPreview,
} from "@/server/services/global-search.service";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

const MAX_QUERY_LENGTH = 80;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface GlobalSearchResult {
  /** Objects whose identifier equals the query (ZL, VIN, HD-, PZ/…, code) */
  exact: SearchExactHit[];
  /** Fragment matches, at most a few per source, exact hits excluded */
  results: SearchExactHit[];
  /** Matches of branch-bound sources in other branches the user can see */
  otherBranches: OtherBranchCount[];
}

const EMPTY: GlobalSearchResult = { exact: [], results: [], otherBranches: [] };

/** Session, organization and the sources the user may search (module + permissions) */
async function loadSearchContext() {
  const supabase = await createClient();
  const context = await loadDashboardContextV2();
  const orgId = context?.app.activeOrgId;
  if (!context || !orgId) return null;
  const entitlements = await EntitlementsService.loadEntitlements(orgId);
  const allowed = resolveSearchSources(
    context.user.permissionSnapshot,
    entitlements?.enabled_modules ?? []
  );
  return { supabase, orgId, branchId: context.app.activeBranchId, allowed };
}

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

    const ctx = await loadSearchContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    const sources = new Set(scope ? ctx.allowed.filter((source) => source === scope) : ctx.allowed);
    if (sources.size === 0) return { success: true, data: EMPTY };

    const searchScope = { orgId: ctx.orgId, branchId: ctx.branchId, sources };
    // A slow or failed fragment search must not hide the exact hits
    const [exact, text, otherBranches] = await Promise.all([
      detected.length ? GlobalSearchService.findExactHits(ctx.supabase, searchScope, detected) : [],
      GlobalSearchService.searchText(ctx.supabase, searchScope, query).catch((error: unknown) => {
        console.error("[globalSearchAction] text search", error);
        return [];
      }),
      GlobalSearchService.countOtherBranches(ctx.supabase, searchScope, query).catch(
        (error: unknown) => {
          console.error("[globalSearchAction] other branches", error);
          return [];
        }
      ),
    ]);
    const exactKeys = new Set(exact.map((hit) => `${hit.type}:${hit.id}`));
    const results = text.filter((hit) => !exactKeys.has(`${hit.type}:${hit.id}`));
    return { success: true, data: { exact, results, otherBranches } };
  } catch (error) {
    console.error("[globalSearchAction]", error);
    return { success: false, error: "Search failed" };
  }
}

const PREVIEW_SOURCE: Record<SearchPreview["type"], SearchSourceId> = {
  item: "items",
  repairOrder: "repairOrders",
};

/**
 * Preview pane of the palette: stock and open orders of a part, or the header
 * and first lines of a repair order. Same source gates as the search; RLS
 * decides whether the row is visible at all.
 */
export async function getSearchPreviewAction(
  type: SearchPreview["type"],
  id: string
): Promise<ActionResult<SearchPreview | null>> {
  try {
    if (!(type in PREVIEW_SOURCE) || !UUID_RE.test(id)) {
      return { success: false, error: "Invalid preview" };
    }
    const ctx = await loadSearchContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!ctx.allowed.includes(PREVIEW_SOURCE[type])) return { success: true, data: null };
    const preview = await GlobalSearchService.getPreview(ctx.supabase, ctx.branchId, type, id);
    return { success: true, data: preview };
  } catch (error) {
    console.error("[getSearchPreviewAction]", error);
    return { success: false, error: "Preview failed" };
  }
}
