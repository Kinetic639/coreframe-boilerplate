"use client";

import React, { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/utils";
import {
  useDataViewColumns,
  useDataViewDetail,
  useDataViewList,
  useDataViewSelection,
  useDataViewStatic,
  useDataViewUrl,
} from "./use-data-view";
import { DataViewDetail } from "./data-view-detail";
import { DataViewFilters } from "./data-view-filters";
import { DataViewSearchControl } from "./data-view-search-control";
import { invalidateDataViewEntity } from "./data-view-query-keys";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function DataViewMobileToolbar() {
  const { renderToolbarControls, entity, scope } = useDataViewStatic();
  const { listIsTransitioning } = useDataViewList();
  const {
    selectedRowCount,
    keepOnlySelected,
    enableKeepOnlySelected,
    disableKeepOnlySelected,
    clearSelectedRows,
  } = useDataViewSelection();
  const queryClient = useQueryClient();
  const t = useTranslations("dataView");

  const handleRefresh = useCallback(() => {
    void invalidateDataViewEntity(queryClient, entity, scope);
  }, [queryClient, entity, scope]);

  return (
    <div className="shrink-0 border-b bg-background">
      <div className="flex min-h-12 items-center gap-2 px-3 py-1.5">
        <DataViewSearchControl />
        <DataViewFilters mode="dropdown" />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleRefresh}
          disabled={listIsTransitioning}
          aria-label={t("toolbar.refreshAria")}
          title={t("toolbar.refreshAria")}
          data-testid="mobile-refresh-button"
        >
          <RefreshCw className={cn("h-4 w-4", listIsTransitioning && "animate-spin")} />
        </Button>
        <div className="min-w-0 flex-1" />
        {renderToolbarControls ? (
          <div className="flex shrink-0 items-center gap-1">{renderToolbarControls()}</div>
        ) : null}
      </div>

      {selectedRowCount > 0 ? (
        <div className="flex items-center gap-2 border-t px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {t("selection.selectedCount", { count: selectedRowCount })}
          </span>
          <Button
            variant="secondary"
            size="sm"
            className="h-8 shrink-0 text-xs"
            onClick={keepOnlySelected ? disableKeepOnlySelected : enableKeepOnlySelected}
          >
            {keepOnlySelected ? t("selection.showAll") : t("selection.keepSelected")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 text-xs"
            onClick={clearSelectedRows}
          >
            {t("selection.clear")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function DataViewMobilePagination() {
  const { listData } = useDataViewList();
  const { urlState } = useDataViewUrl();
  const { clearReturnHighlight, returnHighlightId } = useDataViewDetail();
  const { keepOnlySelected, selectedRowCount } = useDataViewSelection();
  const { totalCount, page, pageSize } = listData;
  const t = useTranslations("dataView");

  const totalPages = keepOnlySelected ? 1 : Math.max(1, Math.ceil(totalCount / pageSize));
  const validPage = keepOnlySelected ? 1 : Math.min(Math.max(page, 1), totalPages);
  const pageDisplay = validPage;
  const from = keepOnlySelected
    ? selectedRowCount === 0
      ? 0
      : 1
    : totalCount === 0
      ? 0
      : (validPage - 1) * pageSize + 1;
  const to = keepOnlySelected ? selectedRowCount : Math.min(validPage * pageSize, totalCount);
  const canPrev = !keepOnlySelected && validPage > 1;
  const canNext = !keepOnlySelected && validPage < totalPages;

  const handleMeaningfulInteraction = () => {
    if (returnHighlightId) clearReturnHighlight();
  };

  return (
    <div className="shrink-0 space-y-2 border-t bg-background px-3 py-2 text-sm">
      <p className="text-xs text-muted-foreground" data-testid="mobile-pagination-info">
        {keepOnlySelected
          ? selectedRowCount === 0
            ? t("pagination.noSelectedRows")
            : t("pagination.showingSelected", { from, to, count: selectedRowCount })
          : totalCount === 0
            ? t("pagination.noResults")
            : t("pagination.showingResults", { from, to, count: totalCount })}
      </p>

      <div className="flex items-center justify-between gap-2">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            handleMeaningfulInteraction();
            urlState.setPageSize(Number(v));
          }}
          disabled={keepOnlySelected}
        >
          <SelectTrigger className="h-9 w-24" aria-label={t("pagination.rowsPerPage")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => {
              handleMeaningfulInteraction();
              urlState.setPage(validPage - 1);
            }}
            disabled={!canPrev}
            aria-label={t("pagination.previousPageAria")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-14 text-center text-xs text-muted-foreground">
            {pageDisplay} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => {
              handleMeaningfulInteraction();
              urlState.setPage(validPage + 1);
            }}
            disabled={!canNext}
            aria-label={t("pagination.nextPageAria")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function DataViewMobileCard<TRow>({ row }: { row: TRow }) {
  const { columns, getRowId, renderMobileItem, renderCompactItem, renderRowControl } =
    useDataViewStatic();
  const { columnVisibility } = useDataViewColumns();
  const { urlState } = useDataViewUrl();
  const { isRowSelected, toggleRowSelected } = useDataViewSelection();
  const t = useTranslations("dataView");
  const rowId = getRowId(row);
  const isSelected = urlState.selected === rowId;
  const visibleColumns = useMemo(
    () => columns.filter((column) => columnVisibility[column.key] ?? true),
    [columns, columnVisibility]
  );
  const primaryColumn = visibleColumns[0] ?? columns[0];
  const secondaryColumns = visibleColumns
    .filter((column) => column.key !== primaryColumn?.key)
    .slice(0, 3);
  const customContent = renderMobileItem?.(row) ?? renderCompactItem?.(row);

  return (
    <article
      className={cn(
        "rounded-md border bg-card text-card-foreground shadow-sm transition-colors",
        isSelected && "border-primary/50 bg-muted/50"
      )}
      data-testid={`mobile-card-${rowId}`}
    >
      <div className="flex gap-2 p-3">
        <div className="pt-0.5" onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={isRowSelected(rowId)}
            onCheckedChange={() => toggleRowSelected(rowId)}
            aria-label={t("selection.selectRowAria", { rowId })}
            data-testid={`mobile-row-select-${rowId}`}
          />
        </div>

        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => urlState.setSelected(rowId)}
          aria-selected={isSelected}
        >
          {customContent ? (
            <div className="min-w-0">{customContent}</div>
          ) : (
            <div className="min-w-0 space-y-2">
              <div className="truncate text-sm font-semibold">
                {primaryColumn ? primaryColumn.accessor(row) : rowId}
              </div>
              {secondaryColumns.length > 0 ? (
                <dl className="grid gap-1 text-xs text-muted-foreground">
                  {secondaryColumns.map((column) => (
                    <div key={column.key} className="flex min-w-0 items-center gap-2">
                      <dt className="shrink-0 font-medium">{column.header}</dt>
                      <dd className="min-w-0 flex-1 truncate text-right text-foreground/80">
                        {column.accessor(row)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          )}
        </button>

        {renderRowControl ? (
          <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
            {renderRowControl(row)}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function DataViewMobileList() {
  const { getRowId } = useDataViewStatic();
  const { urlState } = useDataViewUrl();
  const { listData, listIsLoading, listIsTransitioning, listError } = useDataViewList();
  const { keepOnlySelected, isRowSelected } = useDataViewSelection();
  const { returnHighlightId, clearReturnHighlight } = useDataViewDetail();
  const t = useTranslations("dataView");

  const visibleRows = useMemo(
    () =>
      keepOnlySelected
        ? listData.rows.filter((row) => isRowSelected(getRowId(row)))
        : listData.rows,
    [getRowId, isRowSelected, keepOnlySelected, listData.rows]
  );

  const handleMeaningfulInteraction = useCallback(() => {
    if (returnHighlightId && !urlState.selected) clearReturnHighlight();
  }, [clearReturnHighlight, returnHighlightId, urlState.selected]);

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-3"
      onPointerDownCapture={handleMeaningfulInteraction}
      onWheelCapture={handleMeaningfulInteraction}
      onKeyDownCapture={handleMeaningfulInteraction}
      data-testid="data-view-mobile-list"
    >
      {listIsTransitioning ? (
        <div
          className="absolute inset-x-0 top-0 z-20 h-0.5 animate-pulse bg-primary/60"
          role="status"
          aria-label={t("table.updating")}
        />
      ) : null}
      {listIsLoading ? (
        <div className="space-y-2" aria-label={t("mobile.loadingAria")}>
          {Array.from({ length: Math.min(Math.max(listData.pageSize, 1), 8) }).map((_, index) => (
            <div key={index} className="rounded-md border bg-card p-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : listError ? (
        <div
          className="flex min-h-40 items-center justify-center rounded-md border bg-card p-6 text-center text-sm text-destructive"
          role="alert"
        >
          {t("table.error")}
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          {t("table.noResults")}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleRows.map((row) => (
            <DataViewMobileCard key={getRowId(row)} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DataViewMobileLayout() {
  const { isDetailOpen } = useDataViewUrl();

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-md border bg-background">
      {isDetailOpen ? (
        <div className="flex min-h-0 flex-1 overflow-hidden" data-testid="data-view-mobile-detail">
          <DataViewDetail />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DataViewMobileToolbar />
          <DataViewMobileList />
          <DataViewMobilePagination />
        </div>
      )}
    </div>
  );
}
