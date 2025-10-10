"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdvancedDataTableProps } from "./types";
import { useTableStore } from "./store/table-store";
import { useTableData } from "./hooks/use-table-data";
import { TableFilters } from "./table-filters";
import { TableSidebar } from "./table-sidebar";
import { TableDetailPanel } from "./table-detail-panel";
import { TableMobileView } from "./table-mobile-view";
import { TableCheckbox } from "./components/table-checkbox";

export function AdvancedDataTable<T>({
  data,
  columns,
  renderDetail,
  onRowClick,
  selectable = false,
  onSelectionChange,
  loading = false,
  error = null,
  emptyMessage = "No data found",
  emptyState,
  getRowId = (row: any) => row.id,
  className,
  searchPlaceholder = "Search...",
  showSearch = true,
  toolbarActions,
  responsive = true,
}: AdvancedDataTableProps<T>) {
  // Zustand store selectors
  const selectedRow = useTableStore((state) => state.selectedRow);
  const selectedRowIds = useTableStore((state) => state.selectedRowIds);
  const layoutMode = useTableStore((state) => state.layoutMode);
  const sort = useTableStore((state) => state.sort);

  // Zustand store actions
  const openDetail = useTableStore((state) => state.openDetail);
  const closeDetail = useTableStore((state) => state.closeDetail);
  const toggleRowSelection = useTableStore((state) => state.toggleRowSelection);
  const selectAllRows = useTableStore((state) => state.selectAllRows);
  const clearSelection = useTableStore((state) => state.clearSelection);
  const toggleSort = useTableStore((state) => state.toggleSort);

  // Process data with filters, search, and sorting
  const processedData = useTableData(data, columns);

  const [isMobile, setIsMobile] = React.useState(false);

  // Detect mobile screen size
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle row click
  const handleRowClick = React.useCallback(
    (row: T) => {
      openDetail(row);
      onRowClick?.(row);
    },
    [openDetail, onRowClick]
  );

  // Handle selection change callback
  React.useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = processedData.filter((row) => selectedRowIds.has(getRowId(row)));
      onSelectionChange(selectedRows);
    }
  }, [selectedRowIds, processedData, onSelectionChange, getRowId]);

  // Handle select all
  const handleSelectAll = React.useCallback(() => {
    if (selectedRowIds.size === processedData.length) {
      clearSelection();
    } else {
      selectAllRows(processedData.map(getRowId));
    }
  }, [selectedRowIds.size, processedData, clearSelection, selectAllRows, getRowId]);

  const isAllSelected = processedData.length > 0 && selectedRowIds.size === processedData.length;
  const isSomeSelected = selectedRowIds.size > 0 && !isAllSelected;
  const checkboxState = isAllSelected ? true : isSomeSelected ? "indeterminate" : false;

  // Mobile view
  if (responsive && isMobile && layoutMode === "full") {
    return (
      <div className={cn("space-y-4", className)}>
        <TableFilters
          columns={columns}
          searchPlaceholder={searchPlaceholder}
          showSearch={showSearch}
        />

        {toolbarActions && <div className="flex justify-end">{toolbarActions}</div>}

        {loading ? (
          <LoadingSkeleton count={5} />
        ) : error ? (
          <ErrorState error={error} />
        ) : processedData.length === 0 ? (
          emptyState || <EmptyState message={emptyMessage} />
        ) : (
          <TableMobileView
            data={processedData}
            columns={columns}
            onRowClick={handleRowClick}
            getRowId={getRowId}
            selectable={selectable}
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col space-y-4", className)}>
      {/* Filters */}
      <TableFilters
        columns={columns}
        searchPlaceholder={searchPlaceholder}
        showSearch={showSearch}
      />

      {/* Toolbar Actions */}
      {toolbarActions && <div className="flex justify-end">{toolbarActions}</div>}

      {/* Table Container with Sidebar and Detail Panel */}
      <div className="flex flex-1 overflow-hidden rounded-lg border">
        <AnimatePresence mode="wait">
          {layoutMode === "sidebar-detail" ? (
            // Sidebar + Detail Panel Layout
            <React.Fragment key="sidebar-detail">
              <TableSidebar
                data={processedData}
                columns={columns}
                onRowSelect={handleRowClick}
                getRowId={getRowId}
              />
              <TableDetailPanel
                row={selectedRow}
                onClose={closeDetail}
                renderDetail={renderDetail}
                columns={columns}
              />
            </React.Fragment>
          ) : (
            // Full Table Layout
            <motion.div
              key="full-table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-auto"
            >
              {loading ? (
                <div className="p-4">
                  <LoadingSkeleton count={10} />
                </div>
              ) : error ? (
                <div className="p-4">
                  <ErrorState error={error} />
                </div>
              ) : processedData.length === 0 ? (
                <div className="p-4">{emptyState || <EmptyState message={emptyMessage} />}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {selectable && (
                        <TableHead className="w-12">
                          <TableCheckbox
                            checked={checkboxState}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all rows"
                          />
                        </TableHead>
                      )}
                      {columns.map((column) => (
                        <TableHead
                          key={column.key}
                          style={{ width: column.width }}
                          className={cn(
                            column.sortable && "cursor-pointer select-none hover:bg-muted/50",
                            column.align === "center" && "text-center",
                            column.align === "right" && "text-right"
                          )}
                          onClick={() => column.sortable && toggleSort(column.key)}
                        >
                          <div className="flex items-center gap-2">
                            <span>{column.header}</span>
                            {column.sortable && (
                              <SortIcon
                                active={sort?.key === column.key}
                                direction={sort?.direction}
                              />
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedData.map((row) => {
                      const rowId = getRowId(row);
                      const isSelected = selectedRowIds.has(rowId);

                      return (
                        <TableRow
                          key={rowId}
                          className="cursor-pointer"
                          onClick={() => handleRowClick(row)}
                          data-state={isSelected ? "selected" : undefined}
                        >
                          {selectable && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <TableCheckbox
                                checked={isSelected}
                                onCheckedChange={() => toggleRowSelection(rowId)}
                                aria-label={`Select row ${rowId}`}
                              />
                            </TableCell>
                          )}
                          {columns.map((column) => {
                            const value = (row as any)[column.key];
                            const displayValue = column.render ? column.render(value, row) : value;

                            return (
                              <TableCell
                                key={column.key}
                                className={cn(
                                  column.align === "center" && "text-center",
                                  column.align === "right" && "text-right"
                                )}
                              >
                                {displayValue}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Sort icon component
function SortIcon({ active, direction }: { active: boolean; direction?: "asc" | "desc" }) {
  if (!active) {
    return <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />;
  }

  return direction === "asc" ? (
    <ChevronUp className="h-4 w-4" />
  ) : (
    <ChevronDown className="h-4 w-4" />
  );
}

// Loading skeleton
function LoadingSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Error state
function ErrorState({ error }: { error: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-destructive">{error}</p>
    </div>
  );
}

// Empty state
function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-muted-foreground">
      <p>{message}</p>
    </div>
  );
}
