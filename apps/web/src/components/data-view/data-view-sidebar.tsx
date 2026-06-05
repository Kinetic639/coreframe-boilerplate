"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils";
import {
  useDataViewSelection,
  useDataViewSidebar,
  useDataViewStatic,
  useDataViewUrl,
} from "./use-data-view";

const ROW_HEIGHT = 56;
const LOAD_THRESHOLD = 120;
const LOAD_INDICATOR_HEIGHT = 40;
const VIRTUALIZATION_THRESHOLD = 30;

export function DataViewSidebar() {
  const { columns, getRowId, renderCompactItem } = useDataViewStatic();
  const { urlState } = useDataViewUrl();
  const { keepOnlySelected, isRowSelected, selectedRowCount } = useDataViewSelection();
  const t = useTranslations("dataView");
  const {
    sidebarRows,
    sidebarTotalCount,
    sidebarHasNextPage,
    sidebarHasPreviousPage,
    sidebarIsFetchingNextPage,
    sidebarIsFetchingPreviousPage,
    fetchSidebarNextPage,
    fetchSidebarPreviousPage,
  } = useDataViewSidebar();

  const scrollRef = useRef<HTMLDivElement>(null);
  const loadNextInFlightRef = useRef(false);
  const loadPreviousInFlightRef = useRef(false);
  const seededNeighborsRef = useRef<string | null>(null);
  const primaryColumn = columns[0];
  const visibleSidebarRows = useMemo(
    () =>
      keepOnlySelected ? sidebarRows.filter((row) => isRowSelected(getRowId(row))) : sidebarRows,
    [getRowId, isRowSelected, keepOnlySelected, sidebarRows]
  );
  const effectiveSidebarTotalCount = keepOnlySelected ? selectedRowCount : sidebarTotalCount;
  const showInfiniteLoading = !keepOnlySelected;

  const selectedRowIndex = useMemo(() => {
    if (!urlState.selected) return -1;
    return visibleSidebarRows.findIndex((row) => getRowId(row) === urlState.selected);
  }, [visibleSidebarRows, getRowId, urlState.selected]);
  const shouldVirtualize = visibleSidebarRows.length > VIRTUALIZATION_THRESHOLD;

  const topInset =
    showInfiniteLoading && (sidebarHasPreviousPage || sidebarIsFetchingPreviousPage)
      ? LOAD_INDICATOR_HEIGHT
      : 0;
  const bottomInset =
    showInfiniteLoading && (sidebarHasNextPage || sidebarIsFetchingNextPage)
      ? LOAD_INDICATOR_HEIGHT
      : 0;

  const rowVirtualizer = useVirtualizer({
    count: visibleSidebarRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    paddingStart: topInset,
    paddingEnd: bottomInset,
  });

  const loadPreviousPage = useCallback(async () => {
    if (
      loadPreviousInFlightRef.current ||
      !sidebarHasPreviousPage ||
      sidebarIsFetchingPreviousPage
    ) {
      return;
    }

    loadPreviousInFlightRef.current = true;
    const container = scrollRef.current;
    const previousScrollHeight = container?.scrollHeight ?? 0;
    const previousScrollTop = container?.scrollTop ?? 0;

    try {
      await fetchSidebarPreviousPage();
      requestAnimationFrame(() => {
        const nextScrollHeight = container?.scrollHeight ?? 0;
        if (container) {
          container.scrollTop = previousScrollTop + (nextScrollHeight - previousScrollHeight);
        }
      });
    } finally {
      loadPreviousInFlightRef.current = false;
    }
  }, [fetchSidebarPreviousPage, sidebarHasPreviousPage, sidebarIsFetchingPreviousPage]);

  const loadNextPage = useCallback(async () => {
    if (loadNextInFlightRef.current || !sidebarHasNextPage || sidebarIsFetchingNextPage) {
      return;
    }

    loadNextInFlightRef.current = true;

    try {
      await fetchSidebarNextPage();
    } finally {
      loadNextInFlightRef.current = false;
    }
  }, [fetchSidebarNextPage, sidebarHasNextPage, sidebarIsFetchingNextPage]);

  useEffect(() => {
    if (!urlState.selected || keepOnlySelected) return;

    const seedKey = JSON.stringify([
      urlState.selected,
      urlState.search,
      urlState.sort,
      urlState.filters,
      urlState.page,
      urlState.pageSize,
    ]);

    if (seededNeighborsRef.current === seedKey) return;
    seededNeighborsRef.current = seedKey;

    void (async () => {
      if (sidebarHasNextPage) {
        await loadNextPage();
      }
    })();
  }, [
    keepOnlySelected,
    loadNextPage,
    sidebarHasNextPage,
    urlState.filters,
    urlState.page,
    urlState.pageSize,
    urlState.search,
    urlState.selected,
    urlState.sort,
  ]);

  useEffect(() => {
    if (selectedRowIndex < 0) return;
    if (!shouldVirtualize) return;
    rowVirtualizer.scrollToIndex(selectedRowIndex, { align: "auto" });
  }, [rowVirtualizer, selectedRowIndex, shouldVirtualize]);

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
      data-testid="data-view-sidebar"
    >
      <div className="flex h-12 shrink-0 items-center border-b px-4 text-left align-middle font-medium text-muted-foreground">
        {primaryColumn?.header ?? t("sidebar.fallbackPrimaryHeader")}
      </div>

      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto"
        onScroll={(event) => {
          const element = event.currentTarget;
          if (element.scrollTop <= LOAD_THRESHOLD) {
            void loadPreviousPage();
          }

          if (element.scrollHeight - element.scrollTop - element.clientHeight <= LOAD_THRESHOLD) {
            void loadNextPage();
          }
        }}
      >
        {showInfiniteLoading && (sidebarHasPreviousPage || sidebarIsFetchingPreviousPage) ? (
          <div className="absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-center border-b bg-background text-xs text-muted-foreground">
            {sidebarIsFetchingPreviousPage ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-label={t("sidebar.loadingPreviousAria")}
              />
            ) : (
              t("sidebar.scrollForMore")
            )}
          </div>
        ) : null}

        {shouldVirtualize ? (
          <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
            {virtualRows.map((virtualRow) => {
              const row = visibleSidebarRows[virtualRow.index];
              if (!row) return null;

              const rowId = getRowId(row);
              const isSelected = urlState.selected === rowId;

              return (
                <button
                  key={rowId}
                  className={cn(
                    "absolute left-0 top-0 flex h-14 w-full items-center border-b px-4 text-left text-sm transition-colors hover:bg-muted/50",
                    isSelected && "bg-muted"
                  )}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                  onClick={() => urlState.setSelected(rowId)}
                  aria-selected={isSelected}
                  data-testid={`sidebar-item-${rowId}`}
                >
                  {renderCompactItem ? (
                    <div className="min-w-0 flex-1 overflow-hidden">{renderCompactItem(row)}</div>
                  ) : (
                    <span className="block w-full truncate font-medium">
                      {primaryColumn ? primaryColumn.accessor(row) : rowId}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          visibleSidebarRows.map((row) => {
            const rowId = getRowId(row);
            const isSelected = urlState.selected === rowId;

            return (
              <button
                key={rowId}
                className={cn(
                  "flex h-14 w-full items-center border-b px-4 text-left text-sm transition-colors hover:bg-muted/50",
                  isSelected && "bg-muted"
                )}
                onClick={() => urlState.setSelected(rowId)}
                aria-selected={isSelected}
                data-testid={`sidebar-item-${rowId}`}
              >
                {renderCompactItem ? (
                  <div className="min-w-0 flex-1 overflow-hidden">{renderCompactItem(row)}</div>
                ) : (
                  <span className="block w-full truncate font-medium">
                    {primaryColumn ? primaryColumn.accessor(row) : rowId}
                  </span>
                )}
              </button>
            );
          })
        )}

        {showInfiniteLoading && (sidebarHasNextPage || sidebarIsFetchingNextPage) ? (
          <div className="absolute inset-x-0 bottom-0 z-10 flex h-10 items-center justify-center border-t bg-background text-xs text-muted-foreground">
            {sidebarIsFetchingNextPage ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-label={t("sidebar.loadingMoreAria")} />
            ) : (
              t("sidebar.loadedCount", {
                loaded: visibleSidebarRows.length,
                total: effectiveSidebarTotalCount,
              })
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
