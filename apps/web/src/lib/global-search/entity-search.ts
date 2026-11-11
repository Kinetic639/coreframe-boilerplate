import { globalSearchAction, type GlobalSearchResult } from "@/app/actions/global-search";
import type { SearchSourceId } from "./sources";

/**
 * The data search of the app as a TanStack query: one definition for the
 * Ctrl+K palette and the "@" mention list, so both share results and cache.
 */

export const EMPTY_SEARCH_RESULT: GlobalSearchResult = {
  exact: [],
  results: [],
  otherBranches: [],
};

/** The server ignores shorter queries */
export const MIN_ENTITY_QUERY = 3;
export const ENTITY_SEARCH_DEBOUNCE_MS = 200;

export function entitySearchQuery(
  activeBranchId: string | null | undefined,
  scope: SearchSourceId | undefined,
  text: string
) {
  return {
    queryKey: ["global-search", "data", activeBranchId, scope ?? "all", text] as const,
    queryFn: async (): Promise<GlobalSearchResult> => {
      const result = await globalSearchAction(text, scope);
      return result.success ? result.data : EMPTY_SEARCH_RESULT;
    },
    staleTime: 30_000,
  };
}
