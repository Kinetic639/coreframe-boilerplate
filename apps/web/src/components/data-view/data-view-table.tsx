"use client";

import React, { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
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
import { useDataView } from "./use-data-view";
import { Skeleton } from "@/components/ui/skeleton";

interface DataViewTableProps {
  /** When true, renders only the first (primary) column — used during collapse transition */
  primaryOnly?: boolean;
}

export function DataViewTable({ primaryOnly = false }: DataViewTableProps) {
  // columnVisibility comes from context — single shared state with DataViewColumnManager
  const {
    columns: colDefs,
    listData,
    urlState,
    getRowId,
    columnVisibility,
    listIsLoading,
  } = useDataView();

  const sortingState: SortingState = useMemo(() => {
    if (!urlState.sort) return [];
    return [{ id: urlState.sort.field, desc: urlState.sort.direction === "desc" }];
  }, [urlState.sort]);

  const tableColumns = useMemo<ColumnDef<(typeof listData.rows)[0]>[]>(() => {
    let visible = colDefs.filter((c) => columnVisibility[c.key] !== false);
    if (primaryOnly) visible = visible.slice(0, 1);
    return visible.map((c) => ({
      id: c.key,
      accessorFn: (row) => row,
      header: c.header,
      cell: ({ row }) => c.accessor(row.original),
      enableSorting: c.sortable ?? false,
    }));
  }, [colDefs, columnVisibility, primaryOnly]);

  const table = useReactTable({
    data: listData.rows,
    columns: tableColumns,
    state: { sorting: sortingState },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sortingState) : updater;
      if (next.length === 0) {
        urlState.setSort(null);
      } else {
        urlState.setSort({ field: next[0].id, direction: next[0].desc ? "desc" : "asc" });
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true,
  });

  return (
    <div className="relative flex-1 overflow-auto">
      {listIsLoading && (
        <div
          className="absolute inset-0 z-10 bg-background/60 flex items-start justify-center pt-12"
          aria-hidden
        >
          <div className="space-y-2 w-full px-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      )}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "whitespace-nowrap",
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
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 && !listIsLoading ? (
            <TableRow>
              <TableCell
                colSpan={tableColumns.length || 1}
                className="text-center text-muted-foreground py-10"
              >
                No results found.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => {
              const rowId = getRowId(row.original);
              const isSelected = urlState.selected === rowId;
              return (
                <TableRow
                  key={rowId}
                  data-state={isSelected ? "selected" : undefined}
                  className={cn("cursor-pointer hover:bg-muted/50", isSelected && "bg-muted")}
                  onClick={() => urlState.setSelected(rowId)}
                  role="row"
                  aria-selected={isSelected}
                  data-testid={`row-${rowId}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
