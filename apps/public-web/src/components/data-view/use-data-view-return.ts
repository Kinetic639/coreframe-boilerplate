"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DataViewListParams, PaginatedResult } from "./data-view.types";
import type { DataViewUrlStateHook } from "./data-view-url-state";

type UseDataViewReturnOptions<TListRow> = {
  enabled: boolean;
  listParams: DataViewListParams;
  resolveSelectedPage?: (args: {
    selectedId: string;
    listParams: DataViewListParams;
  }) => Promise<number | null>;
  sidebarPages?: PaginatedResult<TListRow>[];
  getRowId: (row: TListRow) => string;
  urlState: DataViewUrlStateHook;
};

export function useDataViewReturn<TListRow>({
  enabled,
  listParams,
  resolveSelectedPage,
  sidebarPages,
  getRowId,
  urlState,
}: UseDataViewReturnOptions<TListRow>) {
  const [returnHighlightId, setReturnHighlightId] = useState<string | null>(null);
  const [pendingReturnPage, setPendingReturnPage] = useState<number | null>(null);
  const pageResolutionCacheRef = useRef<Map<string, number | null>>(new Map());
  const pendingPageResolutionRef = useRef<Map<string, Promise<number | null>>>(new Map());
  const pendingCloseResolutionRef = useRef<{
    key: string;
    selectedId: string;
  } | null>(null);
  const selectedRef = useRef<string | null>(urlState.selected);

  const makeResolutionKey = useCallback(
    (selectedId: string, nextListParams: DataViewListParams) => {
      return JSON.stringify({
        selectedId,
        search: nextListParams.search,
        sort: nextListParams.sort,
        filters: nextListParams.filters,
        pageSize: nextListParams.pageSize,
      });
    },
    []
  );

  const resolvePageInBackground = useCallback(
    (selectedId: string, nextListParams: DataViewListParams) => {
      if (!resolveSelectedPage) return Promise.resolve<number | null>(null);

      const key = makeResolutionKey(selectedId, nextListParams);
      const cached = pageResolutionCacheRef.current.get(key);
      if (cached !== undefined) {
        return Promise.resolve(cached);
      }

      const pending = pendingPageResolutionRef.current.get(key);
      if (pending) {
        return pending;
      }

      const promise = resolveSelectedPage({
        selectedId,
        listParams: nextListParams,
      })
        .then((page) => {
          pageResolutionCacheRef.current.set(key, page);
          pendingPageResolutionRef.current.delete(key);
          return page;
        })
        .catch(() => {
          pendingPageResolutionRef.current.delete(key);
          return null;
        });

      pendingPageResolutionRef.current.set(key, promise);
      return promise;
    },
    [makeResolutionKey, resolveSelectedPage]
  );

  const resolvedPageFromSidebar = useCallback(
    (selectedId: string) =>
      sidebarPages?.find((page) => page.rows.some((row) => getRowId(row) === selectedId))?.page ??
      null,
    [getRowId, sidebarPages]
  );

  const closeDetail = useCallback(() => {
    const selectedId = urlState.selected;
    if (!selectedId) {
      urlState.closeDetail();
      return;
    }

    const resolutionKey = makeResolutionKey(selectedId, listParams);
    const resolvedPage =
      resolvedPageFromSidebar(selectedId) ??
      pageResolutionCacheRef.current.get(resolutionKey) ??
      null;

    setReturnHighlightId(selectedId);
    setPendingReturnPage(resolvedPage);
    urlState.closeDetail(resolvedPage ?? undefined);

    if (resolvedPage != null || !resolveSelectedPage) {
      return;
    }

    pendingCloseResolutionRef.current = { key: resolutionKey, selectedId };

    void resolvePageInBackground(selectedId, listParams).then((page) => {
      const pendingClose = pendingCloseResolutionRef.current;
      if (!pendingClose) return;
      if (pendingClose.key !== resolutionKey || pendingClose.selectedId !== selectedId) return;
      if (page == null) return;
      if (selectedRef.current) return;

      setPendingReturnPage(page);
    });
  }, [
    listParams,
    makeResolutionKey,
    resolvePageInBackground,
    resolveSelectedPage,
    resolvedPageFromSidebar,
    urlState,
  ]);

  const clearReturnHighlight = useCallback(() => {
    setReturnHighlightId(null);
    setPendingReturnPage(null);
  }, []);

  useEffect(() => {
    selectedRef.current = urlState.selected;
  }, [urlState.selected]);

  useEffect(() => {
    if (!enabled || !urlState.selected || !resolveSelectedPage) return;
    void resolvePageInBackground(urlState.selected, listParams);
  }, [enabled, listParams, resolvePageInBackground, resolveSelectedPage, urlState.selected]);

  useEffect(() => {
    if (urlState.selected) {
      setReturnHighlightId(null);
      setPendingReturnPage(null);
      pendingCloseResolutionRef.current = null;
    }
  }, [urlState.selected]);

  useEffect(() => {
    if (urlState.selected || pendingReturnPage == null) return;
    if (urlState.page === pendingReturnPage) return;
    urlState.setPage(pendingReturnPage);
  }, [pendingReturnPage, urlState]);

  return useMemo(
    () => ({
      closeDetail,
      returnHighlightId,
      clearReturnHighlight,
    }),
    [clearReturnHighlight, closeDetail, returnHighlightId]
  );
}
