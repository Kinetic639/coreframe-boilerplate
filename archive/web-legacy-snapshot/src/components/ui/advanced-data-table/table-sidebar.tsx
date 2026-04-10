"use client";

import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ColumnConfig } from "./types";
import { useTableStore } from "./store/table-store";

interface TableSidebarProps<T = any> {
  data: T[];
  columns: ColumnConfig<T>[];
  onRowSelect: (row: T) => void;
  getRowId: (row: T) => string;
}

export function TableSidebar<T>({ data, columns, onRowSelect, getRowId }: TableSidebarProps<T>) {
  // Get selected row from Zustand store
  const selectedRow = useTableStore((state) => state.selectedRow);
  const primaryColumn = columns.find((col) => col.isPrimary) || columns[0];

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="border-b px-3 py-2">
        <h3 className="text-xs font-semibold text-muted-foreground">Items ({data.length})</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y">
          {data.map((row) => {
            const rowId = getRowId(row);
            const isSelected = selectedRow && getRowId(selectedRow) === rowId;

            // Get primary column value for display
            const primaryValue = (row as any)[primaryColumn.key];
            const displayValue = primaryColumn.renderSidebar
              ? primaryColumn.renderSidebar(primaryValue, row)
              : primaryColumn.render
                ? primaryColumn.render(primaryValue, row)
                : primaryValue;

            return (
              <button
                key={rowId}
                onClick={() => onRowSelect(row)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                  "hover:bg-accent focus:bg-accent focus:outline-none",
                  isSelected && "bg-accent"
                )}
              >
                <div className="min-w-0 flex-1">
                  {typeof displayValue === "string" ? (
                    <div className="truncate font-medium">{displayValue}</div>
                  ) : (
                    displayValue
                  )}

                  {/* Show secondary info from additional columns */}
                  {columns.slice(1, 2).map((col) => {
                    const value = (row as any)[col.key];
                    if (!value) return null;

                    return (
                      <div key={col.key} className="truncate text-xs text-muted-foreground">
                        {String(value)}
                      </div>
                    );
                  })}
                </div>

                {/* Selected indicator */}
                {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
