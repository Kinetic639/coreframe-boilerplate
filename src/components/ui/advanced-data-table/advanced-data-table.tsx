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
import { ColumnManager } from "./components/column-manager";

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
  const columnVisibility = useTableStore((state) => state.columnVisibility);
  const columnOrder = useTableStore((state) => state.columnOrder);

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

  // Get visible columns in correct order
  const visibleColumns = React.useMemo(() => {
    const orderedCols =
      columnOrder.length > 0
        ? columnOrder
            .map((key) => columns.find((col) => col.key === key))
            .filter((col): col is (typeof columns)[0] => col !== undefined)
        : columns;

    return orderedCols.filter((col) => columnVisibility[col.key] !== false);
  }, [columns, columnOrder, columnVisibility]);

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
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between gap-2">
          <TableFilters
            columns={columns}
            searchPlaceholder={searchPlaceholder}
            showSearch={showSearch}
          />
          <ColumnManager columns={columns} />
        </div>

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
            columns={visibleColumns}
            onRowClick={handleRowClick}
            getRowId={getRowId}
            selectable={selectable}
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Toolbar Actions */}
      {toolbarActions && <div className="mb-2 flex justify-end">{toolbarActions}</div>}

      {/* Table Container with Sidebar and Detail Panel */}
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-md border bg-background">
        {/* Inline Filters Header - Like inFlow */}
        <div className="flex items-center justify-between border-b bg-muted/30">
          <TableFilters
            columns={columns}
            searchPlaceholder={searchPlaceholder}
            showSearch={showSearch}
          />
          <div className="flex items-center gap-2 pr-3">
            <ColumnManager columns={columns} />
          </div>
        </div>

        {/* Table Content */}
        <div className="relative flex flex-1 overflow-hidden">
          <AnimatePresence initial={false} mode="sync">
            {layoutMode === "sidebar-detail" ? (
              // Sidebar + Detail Panel Layout
              <React.Fragment key="sidebar-detail">
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "280px", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{
                    duration: 0.2,
                    ease: "easeInOut",
                  }}
                  className="border-r"
                >
                  <TableSidebar
                    data={processedData}
                    columns={visibleColumns}
                    onRowSelect={handleRowClick}
                    getRowId={getRowId}
                  />
                </motion.div>
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{
                    duration: 0.2,
                    ease: "easeInOut",
                  }}
                  className="flex-1"
                >
                  <TableDetailPanel
                    row={selectedRow}
                    onClose={closeDetail}
                    renderDetail={renderDetail}
                    columns={visibleColumns}
                  />
                </motion.div>
              </React.Fragment>
            ) : (
              // Full Table Layout
              <motion.div
                key="full-table"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
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
                    <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur">
                      <TableRow className="hover:bg-transparent">
                        {selectable && (
                          <TableHead className="h-9 w-10 p-2">
                            <TableCheckbox
                              checked={checkboxState}
                              onCheckedChange={handleSelectAll}
                              aria-label="Select all rows"
                            />
                          </TableHead>
                        )}
                        {visibleColumns.map((column) => (
                          <TableHead
                            key={column.key}
                            style={{
                              width: column.width,
                              minWidth: column.minWidth,
                            }}
                            className={cn(
                              "h-9 px-3 py-2 text-xs font-medium",
                              column.sortable &&
                                "cursor-pointer select-none transition-colors hover:bg-muted/80",
                              column.align === "center" && "text-center",
                              column.align === "right" && "text-right"
                            )}
                            onClick={() => column.sortable && toggleSort(column.key)}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{column.header}</span>
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
                            onClick={() => handleRowClick(row)}
                            className={cn(
                              "h-10 cursor-pointer transition-colors",
                              isSelected && "bg-muted/50"
                            )}
                          >
                            {selectable && (
                              <TableCell className="p-2">
                                <TableCheckbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleRowSelection(rowId)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Select row ${rowId}`}
                                />
                              </TableCell>
                            )}
                            {visibleColumns.map((column) => {
                              const value = (row as any)[column.key];
                              return (
                                <TableCell
                                  key={column.key}
                                  className={cn(
                                    "px-3 py-2 text-sm",
                                    column.align === "center" && "text-center",
                                    column.align === "right" && "text-right"
                                  )}
                                >
                                  {column.render ? column.render(value, row) : String(value ?? "")}
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
    </div>
  );
}

// Sort Icon Component
function SortIcon({ active, direction }: { active: boolean; direction?: "asc" | "desc" }) {
  if (!active) {
    return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
  }

  return direction === "asc" ? (
    <ChevronUp className="h-3.5 w-3.5 text-foreground" />
  ) : (
    <ChevronDown className="h-3.5 w-3.5 text-foreground" />
  );
}

// Loading Skeleton
function LoadingSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// Error State
function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm font-medium text-destructive">{error}</p>
    </div>
  );
}

// Empty State
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
