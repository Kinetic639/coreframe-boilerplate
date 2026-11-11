"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SearchSourceId } from "./sources";

const SearchSourcesContext = createContext<readonly SearchSourceId[]>([]);

/** Data sources the signed-in user may search (resolved on the server in the layout) */
export function SearchSourcesProvider({
  sources,
  children,
}: {
  sources: readonly SearchSourceId[] | undefined;
  children: ReactNode;
}) {
  return (
    <SearchSourcesContext.Provider value={sources ?? EMPTY}>
      {children}
    </SearchSourcesContext.Provider>
  );
}

const EMPTY: readonly SearchSourceId[] = [];

export function useSearchSources(): readonly SearchSourceId[] {
  return useContext(SearchSourcesContext);
}
