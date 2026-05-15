"use client";

import React, { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  useDataViewColumns,
  useDataViewDetail,
  useDataViewList,
  useDataViewSelection,
  useDataViewStatic,
  useDataViewUrl,
} from "./use-data-view";
import { Skeleton } from "@/components/ui/skeleton";
import { DataViewColumnManager } from "./data-view-columns";
import { Checkbox } from "@/components/ui/checkbox";

interface DataViewTableProps {
  /** When true, renders only the first (primary) column — used during collapse transition */
  primaryOnly?: boolean;
}

export function DataViewTable({ primaryOnly = false }: DataViewTableProps) {
  const { columns: colDefs, getRowId, renderExpandedRow } = useDataViewStatic();
  const { urlState } = useDataViewUrl();
  const { listData, listIsLoading, listIsTransitioning } = useDataViewList();
  const { columnVisibility } = useDataViewColumns();
  const { returnHighlightId, clearReturnHighlight } = useDataViewDetail();
  const {
    keepOnlySelected,
    isRowSelected,
    toggleRowSelected,
    toggleSelectAllCurrentPage,
    allCurrentPageRowsSelected,
    someCurrentPageRowsSelected,
  } = useDataViewSelection();
  const t = useTranslations("dataView");
  const containerRef = useRef<HTMLDivElement>(null);
  const scrolledHighlightKeyRef = useRef<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  const sortingState: SortingState = useMemo(() => {
    if (!urlState.sort) return [];
    return [{ id: urlState.sort.field, desc: urlState.sort.direction === "desc" }];
  }, [urlState.sort]);

  const tableColumns = useMemo<ColumnDef<(typeof listData.rows)[0]>[]>(() => {
    return colDefs.map((c) => ({
      id: c.key,
      accessorFn: (row) => row,
      header: c.header,
      cell: ({ row }) => c.accessor(row.original),
      enableSorting: c.sortable ?? false,
    }));
  }, [colDefs]);

  const effectiveColumnVisibility = useMemo<VisibilityState>(() => {
    const primaryColumnKey = colDefs[0]?.key;
    const baseVisibility = colDefs.reduce<VisibilityState>((acc, column) => {
      acc[column.key] = columnVisibility[column.key] ?? true;
      return acc;
    }, {});

    if (!primaryOnly || !primaryColumnKey) {
      return baseVisibility;
    }

    return colDefs.reduce<VisibilityState>((acc, column) => {
      acc[column.key] = column.key === primaryColumnKey;
      return acc;
    }, {});
  }, [colDefs, columnVisibility, primaryOnly]);

  const visibleRows = useMemo(
    () =>
      keepOnlySelected
        ? listData.rows.filter((row) => isRowSelected(getRowId(row)))
        : listData.rows,
    [getRowId, isRowSelected, keepOnlySelected, listData.rows]
  );

  const table = useReactTable({
    data: visibleRows,
    columns: tableColumns,
    state: { sorting: sortingState, columnVisibility: effectiveColumnVisibility },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sortingState) : updater;
      if (next.length === 0) {
        urlState.setSort(null);
      } else {
        urlState.setSort({ field: next[0].id, direction: next[0].desc ? "desc" : "asc" });
      }
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  const skeletonRowCount = Math.max(1, listData.pageSize);
  const showControlColumn = !primaryOnly;
  const visibleColumnCount = table.getVisibleLeafColumns().length || 1;
  const totalColumnCount = visibleColumnCount + (showControlColumn ? 1 : 0);

  useLayoutEffect(() => {
    if (!returnHighlightId || urlState.selected || listIsTransitioning) {
      scrolledHighlightKeyRef.current = null;
      return;
    }

    const highlightKey = `${returnHighlightId}:${listData.page}:${listData.pageSize}`;
    if (scrolledHighlightKeyRef.current === highlightKey) {
      return;
    }

    const target = rowRefs.current.get(returnHighlightId);

    if (target) {
      scrolledHighlightKeyRef.current = highlightKey;
      requestAnimationFrame(() => {
        const container = containerRef.current;
        const latestTarget = rowRefs.current.get(returnHighlightId);
        if (!container || !latestTarget) return;

        const headerOffset = 48;
        const containerRect = container.getBoundingClientRect();
        const targetRect = latestTarget.getBoundingClientRect();
        const targetTop = container.scrollTop + (targetRect.top - containerRect.top) - headerOffset;

        container.scrollTo({ top: Math.max(targetTop, 0) });
      });
    }
  }, [
    returnHighlightId,
    urlState.selected,
    listIsTransitioning,
    listData.page,
    listData.pageSize,
    listData.rows,
  ]);

  const handleMeaningfulInteraction = useCallback(() => {
    if (returnHighlightId && !urlState.selected) {
      clearReturnHighlight();
    }
  }, [clearReturnHighlight, returnHighlightId, urlState.selected]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-auto"
      onPointerDownCapture={handleMeaningfulInteraction}
      onWheelCapture={handleMeaningfulInteraction}
      onKeyDownCapture={handleMeaningfulInteraction}
    >
      <Table
        containerClassName="overflow-visible"
        className="[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-background"
      >
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {showControlColumn ? (
                <TableHead className="w-12 px-2 shadow-[inset_0_-1px_0_hsl(var(--border))]">
                  <div className="flex h-full items-center justify-center">
                    <Checkbox
                      checked={
                        allCurrentPageRowsSelected
                          ? true
                          : someCurrentPageRowsSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={() => toggleSelectAllCurrentPage()}
                      aria-label={t("selection.selectAllRowsAria")}
                    />
                  </div>
                </TableHead>
              ) : null}
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "whitespace-nowrap shadow-[inset_0_-1px_0_hsl(var(--border))]",
                      canSort && "cursor-pointer select-none hover:bg-muted/50"
                    )}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                    }
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="ml-1 opacity-60">
                          {sorted === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5" />
                          )}
                        </span>
                      )}
                    </div>
                  </TableHead>
                );
              })}
              {showControlColumn ? (
                <TableHead className="w-12 px-2 shadow-[inset_0_-1px_0_hsl(var(--border))]">
                  <div className="flex items-center justify-center">
                    <DataViewColumnManager />
                  </div>
                </TableHead>
              ) : null}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {listIsTransitioning ? (
            Array.from({ length: skeletonRowCount }).map((_, rowIndex) => (
              <TableRow
                key={`skeleton-row-${rowIndex}`}
                aria-hidden="true"
                data-testid="table-loading-row"
              >
                {showControlColumn ? (
                  <TableCell key={`skeleton-control-${rowIndex}`} className="h-14 w-12 px-2 py-0" />
                ) : null}
                {Array.from({ length: visibleColumnCount }).map((__, cellIndex) => (
                  <TableCell key={`skeleton-cell-${rowIndex}-${cellIndex}`} className="h-14 py-0">
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
                {showControlColumn ? (
                  <TableCell key={`skeleton-manager-${rowIndex}`} className="h-14 w-12 px-2 py-0" />
                ) : null}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length === 0 && !listIsLoading ? (
            <TableRow>
              <TableCell
                colSpan={totalColumnCount}
                className="text-center text-muted-foreground py-10"
              >
                {t("table.noResults")}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => {
              const rowId = getRowId(row.original);
              const isSelected = urlState.selected === rowId;
              const isReturnHighlight = !isSelected && returnHighlightId === rowId;
              const expandedContent = !primaryOnly ? renderExpandedRow?.(row.original) : null;
              return (
                <React.Fragment key={rowId}>
                  <TableRow
                    ref={(node) => {
                      if (node) {
                        rowRefs.current.set(rowId, node);
                      } else {
                        rowRefs.current.delete(rowId);
                      }
                    }}
                    data-state={isSelected ? "selected" : undefined}
                    className={cn(
                      "h-14 cursor-pointer hover:bg-muted/50",
                      isSelected && "bg-muted",
                      isReturnHighlight && "bg-muted/50 hover:bg-muted/50 transition-colors"
                    )}
                    onClick={() => urlState.setSelected(rowId)}
                    role="row"
                    aria-selected={isSelected}
                    data-row-id={rowId}
                    data-return-highlight={isReturnHighlight || undefined}
                    data-testid={`row-${rowId}`}
                  >
                    {showControlColumn ? (
                      <TableCell className="h-14 w-12 px-2 py-0">
                        <div
                          className="flex h-full items-center justify-center"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Checkbox
                            checked={isRowSelected(rowId)}
                            onCheckedChange={() => toggleRowSelected(rowId)}
                            aria-label={t("selection.selectRowAria", { rowId })}
                            data-testid={`row-select-${rowId}`}
                          />
                        </div>
                      </TableCell>
                    ) : null}
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="h-14 py-0">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                    {showControlColumn ? <TableCell className="h-14 w-12 px-2 py-0" /> : null}
                  </TableRow>
                  {expandedContent ? (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={totalColumnCount} className="p-0">
                        {expandedContent}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
